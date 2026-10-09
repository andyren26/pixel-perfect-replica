import { supabase } from "@/integrations/supabase/client";

// Ask our server (POST /api/bookings/checkout) for a Stripe Checkout URL for one of the
// signed-in customer's pending_payment bookings, then send the browser there.
// The payment page is hosted by Stripe; the webhook (not this code) marks the booking paid.
export async function startCheckout(bookingId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("請先登入 / Please sign in.");

  const res = await fetch("/api/bookings/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ booking_id: bookingId }),
  });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !body.url) {
    throw new Error(body.error ?? "無法開啟付款頁面 / Could not start payment.");
  }
  window.location.assign(body.url);
}
