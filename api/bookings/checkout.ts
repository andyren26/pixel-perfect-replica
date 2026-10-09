// POST /api/bookings/checkout  { booking_id }
// Creates a Stripe Checkout Session for one of the caller's own pending_payment bookings
// and returns { url } for the browser to redirect to. The price comes from the booking's
// price SNAPSHOT (set by create_booking), never from the client.
import type { IncomingMessage, ServerResponse } from "node:http";
import Stripe from "stripe";

import { supabaseAdmin } from "../_supabaseAdmin.js"; // .js extension: required for ESM at runtime

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!);

// Stripe's zero-decimal currencies. Everything else (including TWD) is 2-decimal in
// Stripe, so whole-unit prices are scaled ×100 (NT$300 → 30000). This is NOT
// platform_settings.currency_minor_units, which only controls how prices are displayed.
const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
  "pyg", "rwf", "vnd", "vuv", "xaf", "xof", "xpf",
]);

type Req = IncomingMessage & { body?: unknown };

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function siteOrigin(req: Req): string {
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin) return origin;
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  return `${proto}://${host}`;
}

type BookingRow = {
  id: string;
  customer_id: string;
  status: string;
  price: number;
  services: { name: string; barber_id: string; barbers: { id: string; name: string } | null } | null;
};

export default async function handler(req: Req, res: ServerResponse) {
  if (req.method !== "POST") return send(res, 405, { error: "method not allowed" });

  // Who is asking? The browser sends its Supabase access token.
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return send(res, 401, { error: "please sign in" });
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) return send(res, 401, { error: "please sign in" });

  const body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as
    | { booking_id?: unknown }
    | undefined;
  const bookingId = typeof body?.booking_id === "string" ? body.booking_id : "";
  if (!bookingId) return send(res, 400, { error: "booking_id is required" });

  // bookings has no barber_id / start_slot_id: the barber is reached via the service.
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, customer_id, status, price, services(name, barber_id, barbers(id, name))")
    .eq("id", bookingId)
    .maybeSingle();
  const booking = data as BookingRow | null;

  if (error || !booking || booking.customer_id !== userData.user.id) {
    return send(res, 404, { error: "booking not found" });
  }
  if (booking.status !== "pending_payment" || !booking.services) {
    return send(res, 400, { error: "booking not payable" });
  }

  const { data: cfg } = await supabaseAdmin.from("platform_settings").select("currency").single();
  const currency = (cfg?.currency ?? "twd").toLowerCase();
  const factor = ZERO_DECIMAL.has(currency) ? 1 : 100;

  const barberId = booking.services.barber_id;
  const barberName = booking.services.barbers?.name ?? "Barber";
  const origin = siteOrigin(req);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: `${booking.services.name} @ ${barberName}` },
            unit_amount: booking.price * factor, // TWD 300 → 30000 (NT$300.00)
          },
          quantity: 1,
        },
      ],
      // booking_id is the only join key the webhook needs; set server-side, so unforgeable.
      metadata: { booking_id: booking.id, customer_id: booking.customer_id },
      client_reference_id: booking.id,
      customer_email: userData.user.email ?? undefined,
      success_url: `${origin}/bookings/success?booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/barbers/${barberId}`,
    });
    return send(res, 200, { url: session.url });
  } catch (e) {
    console.error("[checkout] stripe error", e);
    return send(res, 502, { error: "could not start payment, please try again" });
  }
}
