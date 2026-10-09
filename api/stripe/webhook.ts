// POST /api/stripe/webhook — the ONLY place a booking becomes `paid`.
// Verifies Stripe's signature over the RAW body, then on checkout.session.completed with
// payment_status 'paid' flips the booking pending_payment → paid and stamps paid_at.
// No split is computed and no ledger row is written; M2.2 does that at payout-build time.
import type { IncomingMessage, ServerResponse } from "node:http";
import Stripe from "stripe";

import { supabaseAdmin } from "../_supabaseAdmin.js"; // .js extension: required for ESM at runtime

// Turn OFF Vercel's body parser: the signature is an HMAC over the exact raw bytes.
export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!);

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function rawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") return send(res, 405, { error: "method not allowed" });

  const buf = await rawBody(req);
  const sig = req.headers["stripe-signature"];

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      typeof sig === "string" ? sig : "",
      process.env["STRIPE_WEBHOOK_SECRET"]!,
    );
  } catch {
    return send(res, 400, { error: "signature verification failed" });
  }

  if (event.type !== "checkout.session.completed") {
    return send(res, 200, { received: true }); // ack unrelated events
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return send(res, 200, { received: true }); // only act on a real, paid session
  }

  const bookingId = session.metadata?.["booking_id"]; // set by our checkout route
  if (!bookingId) return send(res, 400, { error: "missing booking_id metadata" });

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  // First to pay wins. The status guard makes this idempotent: Stripe retries non-2xx and
  // re-delivers events, and a repeat matches zero rows because the booking is already paid.
  // The UNIQUE index on stripe_payment_intent_id is a hard backstop against a double write.
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntentId ?? null,
    })
    .eq("id", bookingId)
    .eq("status", "pending_payment")
    .select("id");

  if (error) {
    if (error.code === "23505") return send(res, 200, { received: true, duplicate: true });
    console.error("[webhook] booking update failed", error);
    return send(res, 500, { error: "booking update failed" }); // non-2xx → Stripe retries
  }

  if (!data?.length) {
    // Already paid (a re-delivery) or no longer pending (e.g. cancelled while paying).
    console.warn("[webhook] no pending_payment booking flipped", { bookingId, paymentIntentId });
  }

  return send(res, 200, { received: true });
}
