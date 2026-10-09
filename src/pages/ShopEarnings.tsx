import { useLoaderData } from "react-router";

import AppHeader from "@/components/AppHeader";
import { useHead } from "@/hooks/use-head";
import { TZ_LABEL, dayKey } from "@/lib/booking";
import { errMessage } from "@/lib/errors";
import {
  PAYOUT_STATUS_LABEL,
  PAYOUT_STATUS_STYLE,
  useOwedBookings,
  useShopPaidOutBookings,
  useShopPayouts,
} from "@/lib/payouts";
import { formatMoney, usePlatformSettings } from "@/lib/platform";
import type { Session } from "@/lib/profile";
import { cardCls } from "@/lib/ui";

const head = [
  { title: "Earnings — Barberly" },
  { name: "description", content: "Your shop's earnings and payouts on Barberly." },
];

// /shop/earnings — read-only mirror for the signed-in shop (all its barbers combined).
// Owed = paid bookings with payout_id NULL; in a payout = payout_id set (+ payout status).
// A cancelled payout's bookings have payout_id nulled, so they show as owed again.
export default function ShopEarnings() {
  useHead(head);
  const { user, profile } = useLoaderData() as Session;
  const { data: settings } = usePlatformSettings();
  const money = (n: number | null | undefined) => formatMoney(n ?? 0, settings);

  const owedQ = useOwedBookings(profile.id);
  const paidOutQ = useShopPaidOutBookings(profile.id);
  const payoutsQ = useShopPayouts(profile.id);
  const owed = owedQ.data ?? [];
  const paidOut = paidOutQ.data ?? [];
  const payouts = (payoutsQ.data ?? []).filter((p) => p.status !== "cancelled");

  const thisMonth = dayKey(new Date().toISOString()).slice(0, 7);
  const inMonth = (iso: string | null) => !!iso && dayKey(iso).startsWith(thisMonth);

  // Summary: owed rows carry a live split; batched rows use each payout's snapshot.
  const owedShop = owed.reduce((s, o) => s + (o.shop_cut ?? 0), 0);
  const all = {
    count: owed.length + payouts.reduce((s, p) => s + p.bookings_count, 0),
    gross: owed.reduce((s, o) => s + (o.price ?? 0), 0) + payouts.reduce((s, p) => s + p.gross, 0),
    platform:
      owed.reduce((s, o) => s + (o.platform_cut ?? 0), 0) +
      payouts.reduce((s, p) => s + p.platform_cut, 0),
    shop: owedShop + payouts.reduce((s, p) => s + p.shop_cut, 0),
  };
  const monthOwed = owed.filter((o) => inMonth(o.paid_at));
  const monthCount = monthOwed.length + paidOut.filter((b) => inMonth(b.paid_at)).length;
  const monthGross =
    monthOwed.reduce((s, o) => s + (o.price ?? 0), 0) +
    paidOut.filter((b) => inMonth(b.paid_at)).reduce((s, b) => s + b.price, 0);
  const transferred = payouts
    .filter((p) => p.status === "transferred")
    .reduce((s, p) => s + p.shop_cut, 0);
  const pendingTransfer = payouts
    .filter((p) => p.status === "pending_transfer")
    .reduce((s, p) => s + p.shop_cut, 0);

  const bookingsByPayout = new Map<string, typeof paidOut>();
  for (const b of paidOut) {
    if (!b.payout_id) continue;
    bookingsByPayout.set(b.payout_id, [...(bookingsByPayout.get(b.payout_id) ?? []), b]);
  }

  const loading = owedQ.isLoading || paidOutQ.isLoading || payoutsQ.isLoading;
  const error = owedQ.error || paidOutQ.error || payoutsQ.error;

  const stat = (label: string, value: string, strong = false) => (
    <div className="rounded-2xl bg-secondary/60 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 tabular-nums ${strong ? "text-xl font-semibold" : "text-lg"}`}>{value}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={user.email} profile={profile} />
      <main className="mx-auto max-w-5xl space-y-8 px-6 pt-6 pb-24 animate-fade-up">
        <div className="hem rounded-3xl bg-cream p-8 md:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Shop earnings
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold md:text-5xl">收入 / Earnings</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            平台會分批結算並撥款給你 / We settle and pay out your earnings in batches.
          </p>
        </div>

        {error ? (
          <p className="text-sm text-destructive">{errMessage(error)}</p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <section className={cardCls}>
              <h2 className="font-serif text-2xl font-semibold">總覽 / Summary</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                {stat("本月預約數 / This month", `${monthCount} 筆 · ${money(monthGross)}`)}
                {stat("累計預約數 / All time", `${all.count} 筆`)}
                {stat("累計總額 / Gross", money(all.gross))}
                {stat("平台抽成 / Platform cut", money(all.platform))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {stat("你的收入 / Your earnings", money(all.shop), true)}
                {stat("尚未撥款 / Owed", money(owedShop))}
                {stat("已轉帳 / Transferred", money(transferred))}
              </div>
              {pendingTransfer > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  另有 {money(pendingTransfer)} 已排入撥款、等待轉帳中。/ {money(pendingTransfer)}{" "}
                  is batched and awaiting transfer.
                </p>
              )}
            </section>

            <section className={cardCls}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-serif text-2xl font-semibold">尚未撥款 / Owed</h2>
                <span className="text-xs text-muted-foreground">日期為{TZ_LABEL}</span>
              </div>
              {owed.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  目前沒有待撥款項。/ Nothing owed right now.
                </p>
              ) : (
                <ul className="mt-4 divide-y text-sm">
                  {owed.map((o) => (
                    <li
                      key={o.booking_id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
                    >
                      <span className="w-28 tabular-nums text-muted-foreground">
                        {o.paid_at ? dayKey(o.paid_at) : "—"}
                      </span>
                      <span className="flex-1">{o.barber_name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {money(o.price)} − {money(o.platform_cut)}
                      </span>
                      <span className="w-28 text-right font-medium tabular-nums">
                        {money(o.shop_cut)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={cardCls}>
              <h2 className="font-serif text-2xl font-semibold">已納入撥款 / In a payout</h2>
              {payouts.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  還沒有撥款紀錄。/ No payouts yet.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {payouts.map((p) => (
                    <div key={p.id} className="rounded-2xl border p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`rounded-full px-3 py-0.5 text-xs font-medium ${PAYOUT_STATUS_STYLE[p.status] ?? ""}`}
                        >
                          {PAYOUT_STATUS_LABEL[p.status] ?? p.status}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          建立 {dayKey(p.created_at)}
                          {p.status === "transferred" && p.marked_transferred_at
                            ? ` · 轉帳 ${dayKey(p.marked_transferred_at)}`
                            : ""}
                        </span>
                        <span className="ml-auto text-sm tabular-nums">
                          {p.bookings_count} 筆 · 總額 {money(p.gross)} ·{" "}
                          <span className="font-semibold">你的收入 {money(p.shop_cut)}</span>
                        </span>
                      </div>
                      {p.note && <p className="mt-2 text-xs text-muted-foreground">{p.note}</p>}
                      <ul className="mt-3 divide-y text-sm">
                        {(bookingsByPayout.get(p.id) ?? []).map((b) => (
                          <li key={b.id} className="flex gap-4 py-2">
                            <span className="w-28 tabular-nums text-muted-foreground">
                              {b.paid_at ? dayKey(b.paid_at) : "—"}
                            </span>
                            <span className="flex-1">
                              {b.services.barbers.name} · {b.services.name}
                            </span>
                            <span className="tabular-nums">{money(b.price)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
