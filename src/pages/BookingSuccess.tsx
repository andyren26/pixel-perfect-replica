import { useState } from "react";
import { Link, useLoaderData, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import AppHeader from "@/components/AppHeader";
import { useHead } from "@/hooks/use-head";
import { supabase } from "@/integrations/supabase/client";
import { errMessage } from "@/lib/errors";
import { formatMoney, usePlatformSettings } from "@/lib/platform";
import type { Session } from "@/lib/profile";
import { cardCls, ghostBtn, primaryBtn } from "@/lib/ui";

const head = [
  { title: "付款結果 — Barberly" },
  { name: "description", content: "你的 Barberly 預約付款結果。" },
];

const POLL_MS = 1500;
const GIVE_UP_MS = 60_000;

// /bookings/success?booking_id=… — Stripe sends the customer here after Checkout.
// UX ONLY: it polls the booking (RLS: only the owner can read it) until the webhook has
// flipped it to `paid`. It never writes anything — the webhook is the source of truth.
export default function BookingSuccess() {
  useHead(head);
  const { user, profile } = useLoaderData() as Session;
  const [params] = useSearchParams();
  const bookingId = params.get("booking_id");
  const { data: settings } = usePlatformSettings();
  const [startedAt] = useState(() => Date.now()); // fixed at first render

  const {
    data: booking,
    error,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["booking-status", bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, status, price, paid_at")
        .eq("id", bookingId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "paid" || status === "cancelled") return false;
      if (query.state.dataUpdatedAt - startedAt > GIVE_UP_MS) return false;
      return POLL_MS;
    },
  });

  const paid = booking?.status === "paid";
  const timedOut = !paid && dataUpdatedAt - startedAt > GIVE_UP_MS;

  let title = "付款處理中… / Processing payment…";
  let body = "正在等待 Stripe 確認付款，通常只需要幾秒鐘。請不要關閉這個頁面。";
  if (!bookingId || (booking === null && !error)) {
    title = "找不到這筆預約 / Booking not found";
    body = "請到「我的預約」查看你的預約狀態。";
  } else if (error) {
    title = "暫時無法讀取預約 / Could not load booking";
    body = errMessage(error, "請到「我的預約」查看。");
  } else if (paid) {
    title = "預約成功！/ Booking confirmed!";
    body = `已收到付款${booking?.price != null ? ` ${formatMoney(booking.price, settings)}` : ""}，你的時段已確認。`;
  } else if (booking?.status === "cancelled") {
    title = "這筆預約已取消 / Booking cancelled";
    body = "如果你已經付款，請聯絡我們協助處理。";
  } else if (timedOut) {
    title = "還在確認付款 / Still confirming";
    body = "付款確認比平常久一點。稍後到「我的預約」查看，付款成功後狀態會變成「已付款」。";
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={user.email} profile={profile} />
      <main className="mx-auto max-w-2xl px-6 pt-10 pb-24 animate-fade-up">
        <div className={`${cardCls} text-center`} aria-live="polite">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            {paid ? "Paid" : "Payment"}
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl">{title}</h1>
          <p className="mt-4 text-sm text-muted-foreground">{body}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/bookings" className={primaryBtn}>
              我的預約 / My bookings
            </Link>
            <Link to="/barbers" className={ghostBtn}>
              繼續逛逛 / Browse barbers
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
