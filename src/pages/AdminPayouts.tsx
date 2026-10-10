import { useMemo, useState } from "react";
import { useLoaderData } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import AppHeader from "@/components/AppHeader";
import ConfirmButton from "@/components/ConfirmButton";
import { useHead } from "@/hooks/use-head";
import { supabase } from "@/integrations/supabase/client";
import { bankLabel } from "@/lib/banks";
import { TZ_LABEL, dayKey, fmtDay } from "@/lib/booking";
import { errMessage } from "@/lib/errors";
import {
  PAYOUT_STATUS_LABEL,
  PAYOUT_STATUS_STYLE,
  owedKey,
  payoutsKey,
  useAdminPayouts,
  useCustomerLabels,
  useOwedBookings,
} from "@/lib/payouts";
import { formatMoney, usePlatformSettings } from "@/lib/platform";
import type { Session } from "@/lib/profile";
import { cardCls, ghostBtn, inputCls, primaryBtn } from "@/lib/ui";

const head = [
  { title: "撥款管理 — Barberly 後台" },
  { name: "description", content: "結算店家收入並記錄銀行轉帳。" },
];

const fmtDate = (iso: string | null) =>
  iso ? `${dayKey(iso)}（${fmtDay(iso).split(" ").at(-1)}）` : "—";

// /admin/payouts — admin only (adminLoader + RLS + admin-guarded RPCs).
// Part 1: the live owed pool → filter, select one shop's bookings, build a payout.
// Part 2: the payout ledger → mark transferred / cancel (pending_transfer only).
export default function AdminPayouts() {
  useHead(head);
  const { user, profile } = useLoaderData() as Session;
  const qc = useQueryClient();
  const { data: settings } = usePlatformSettings();
  const money = (n: number | null | undefined) => formatMoney(n ?? 0, settings);

  const { data: owed = [], isLoading: owedLoading, error: owedError } = useOwedBookings();
  const { data: payouts = [], isLoading: payoutsLoading, error: payoutsError } = useAdminPayouts();
  const { data: customers } = useCustomerLabels(
    owed.map((o) => o.customer_id).filter((x): x is string => !!x),
  );

  // ── Filters (UI convenience only — just WHERE clauses on the live owed list) ──
  const [shopFilter, setShopFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const shops = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of owed) if (o.shop_id) m.set(o.shop_id, o.shop_name || "（未命名店家）");
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [owed]);

  const customerLabel = (id: string | null) => (id ? (customers?.get(id) ?? id.slice(0, 8)) : "—");

  const visible = owed.filter((o) => {
    if (shopFilter && o.shop_id !== shopFilter) return false;
    if (
      customerFilter &&
      !customerLabel(o.customer_id).toLowerCase().includes(customerFilter.toLowerCase())
    )
      return false;
    const d = o.paid_at ? dayKey(o.paid_at) : "";
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  // ── Selection (one shop per payout; the RPC enforces it too) ──
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [building, setBuilding] = useState(false);

  const picked = owed.filter((o) => o.booking_id && selected.has(o.booking_id));
  const pickedShop = picked[0]?.shop_id ?? null;
  const totals = picked.reduce(
    (t, o) => ({
      gross: t.gross + (o.price ?? 0),
      platform: t.platform + (o.platform_cut ?? 0),
      shop: t.shop + (o.shop_cut ?? 0),
    }),
    { gross: 0, platform: 0, shop: 0 },
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Pre-check the chosen shop's owed bookings paid this month (Taipei time).
  function selectShopThisMonth() {
    if (!shopFilter) return;
    const month = dayKey(new Date().toISOString()).slice(0, 7);
    const ids = owed
      .filter((o) => o.shop_id === shopFilter && o.paid_at && dayKey(o.paid_at).startsWith(month))
      .map((o) => o.booking_id!)
      .filter(Boolean);
    setSelected(new Set(ids));
    if (!ids.length) toast.info("這間店本月沒有欠款 / Nothing owed this month for this shop");
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: owedKey });
    qc.invalidateQueries({ queryKey: payoutsKey });
  };

  async function buildPayout() {
    if (!picked.length) return;
    setBuilding(true);
    const trimmed = note.trim();
    const { error } = await supabase.rpc("build_payout", {
      p_booking_ids: picked.map((o) => o.booking_id!),
      ...(trimmed ? { p_note: trimmed } : {}),
    });
    setBuilding(false);
    if (error) {
      toast.error(errMessage(error, "無法建立撥款。"));
    } else {
      toast.success(`已建立撥款 / Payout built — ${money(totals.shop)}`);
      setSelected(new Set());
      setNote("");
    }
    refresh();
  }

  // ── Ledger actions ──
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function markTransferred(id: string) {
    setBusyId(id);
    const ref = refs[id]?.trim();
    const { error } = await supabase.rpc("mark_payout_transferred", {
      p_payout_id: id,
      ...(ref ? { p_bank_reference: ref } : {}),
    });
    setBusyId(null);
    if (error) toast.error(errMessage(error, "無法標記為已轉帳。"));
    else toast.success("已標記為已轉帳 / Marked as transferred");
    refresh();
  }

  async function cancelPayout(id: string) {
    setBusyId(id);
    const { error } = await supabase.rpc("cancel_payout", { p_payout_id: id });
    setBusyId(null);
    if (error) toast.error(errMessage(error, "無法取消這筆撥款。"));
    else toast.success("已取消撥款，預約已退回欠款池 / Cancelled — bookings are owed again");
    refresh();
  }

  const th = "px-3 py-2 text-left font-medium text-muted-foreground";
  const td = "px-3 py-2.5 align-top";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={user.email} profile={profile} />
      <main className="mx-auto max-w-7xl space-y-8 px-6 pt-6 pb-24 animate-fade-up">
        <div className="hem rounded-3xl bg-cream p-8 md:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Admin · Commission settlement
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold md:text-5xl">撥款管理 / Payouts</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            從欠款池勾選同一間店家的已付款預約，建立一筆撥款；在網銀轉帳後回來標記「已轉帳」。 Money
            moves in your online banking — this page only records it.
          </p>
        </div>

        {/* ── Part 1: owed pool builder ── */}
        <section className={cardCls}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-serif text-2xl font-semibold">欠款池 / Owed bookings</h2>
            <span className="text-xs text-muted-foreground">日期為{TZ_LABEL}</span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <select
              className={inputCls}
              value={shopFilter}
              onChange={(e) => setShopFilter(e.target.value)}
              aria-label="依店家篩選"
            >
              <option value="">全部店家 / All shops</option>
              {shops.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <input
              className={inputCls}
              placeholder="客人 / Customer"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            />
            <input
              type="date"
              className={inputCls}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="付款日期起"
            />
            <input
              type="date"
              className={inputCls}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="付款日期迄"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={ghostBtn}
              disabled={!shopFilter}
              onClick={selectShopThisMonth}
              title={shopFilter ? undefined : "先選一間店家 / Pick a shop first"}
            >
              全選此店本月欠款 / Select this shop's owed this month
            </button>
            {selected.size > 0 && (
              <button type="button" className={ghostBtn} onClick={() => setSelected(new Set())}>
                清除勾選 / Clear selection
              </button>
            )}
          </div>

          <div className="mt-5 overflow-x-auto">
            {owedLoading ? (
              <p className="py-6 text-sm text-muted-foreground">載入中…</p>
            ) : owedError ? (
              <p className="py-6 text-sm text-destructive">{errMessage(owedError)}</p>
            ) : visible.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                {owed.length === 0
                  ? "目前沒有欠款 — 所有已付款預約都已納入撥款。/ Nothing owed right now."
                  : "沒有符合篩選條件的預約。/ No owed bookings match these filters."}
              </p>
            ) : (
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b">
                  <tr>
                    <th className={th} />
                    <th className={th}>店家 / Shop</th>
                    <th className={th}>理髮師 / Barber</th>
                    <th className={th}>客人 / Customer</th>
                    <th className={th}>付款日 / Paid</th>
                    <th className={`${th} text-right`}>金額 / Price</th>
                    <th className={`${th} text-right`}>平台抽成</th>
                    <th className={`${th} text-right`}>店家所得 / Shop cut</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((o) => {
                    const id = o.booking_id!;
                    const otherShop = !!pickedShop && o.shop_id !== pickedShop;
                    return (
                      <tr
                        key={id}
                        className={`border-b last:border-0 ${otherShop ? "opacity-50" : ""}`}
                      >
                        <td className={td}>
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={selected.has(id)}
                            disabled={otherShop}
                            title={
                              otherShop
                                ? "一筆撥款只能包含同一間店家 / One shop per payout"
                                : undefined
                            }
                            onChange={() => toggle(id)}
                            aria-label={`選取預約 ${id.slice(0, 8)}`}
                          />
                        </td>
                        <td className={td}>{o.shop_name || "（未命名店家）"}</td>
                        <td className={td}>{o.barber_name}</td>
                        <td className={td}>{customerLabel(o.customer_id)}</td>
                        <td className={td}>{fmtDate(o.paid_at)}</td>
                        <td className={`${td} text-right tabular-nums`}>{money(o.price)}</td>
                        <td className={`${td} text-right tabular-nums text-muted-foreground`}>
                          {money(o.platform_cut)}
                        </td>
                        <td className={`${td} text-right font-medium tabular-nums`}>
                          {money(o.shop_cut)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-4 rounded-2xl bg-secondary/60 p-5">
            <div className="text-sm">
              <p className="text-muted-foreground">
                已勾選 {picked.length} 筆
                {picked[0] ? ` · ${picked[0].shop_name || "（未命名店家）"}` : ""}
              </p>
              <p className="mt-1 tabular-nums">
                總額 {money(totals.gross)} · 平台抽成 {money(totals.platform)} ·{" "}
                <span className="font-semibold">店家所得 {money(totals.shop)}</span>
              </p>
            </div>
            <input
              className={`${inputCls} max-w-xs flex-1`}
              placeholder="備註（選填）/ Note, e.g. 10 月撥款"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              type="button"
              className={`${primaryBtn} ml-auto`}
              disabled={!picked.length || building}
              onClick={buildPayout}
            >
              {building ? "建立中…" : "建立撥款 / Build payout"}
            </button>
          </div>
        </section>

        {/* ── Part 2: payout ledger ── */}
        <section className={cardCls}>
          <h2 className="font-serif text-2xl font-semibold">撥款紀錄 / Payouts</h2>
          <div className="mt-5 overflow-x-auto">
            {payoutsLoading ? (
              <p className="py-6 text-sm text-muted-foreground">載入中…</p>
            ) : payoutsError ? (
              <p className="py-6 text-sm text-destructive">{errMessage(payoutsError)}</p>
            ) : payouts.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                還沒有撥款。從上方欠款池勾選預約來建立第一筆。/ No payouts yet.
              </p>
            ) : (
              <table className="w-full min-w-[960px] text-sm">
                <thead className="border-b">
                  <tr>
                    <th className={th}>店家 / Shop</th>
                    <th className={th}>建立日 / Created</th>
                    <th className={`${th} text-right`}>筆數</th>
                    <th className={`${th} text-right`}>總額</th>
                    <th className={`${th} text-right`}>平台抽成</th>
                    <th className={`${th} text-right`}>店家所得</th>
                    <th className={th}>轉入帳戶 / Bank account</th>
                    <th className={th}>狀態 / Status</th>
                    <th className={th}>動作 / Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => {
                    const pending = p.status === "pending_transfer";
                    const bank = p.shop;
                    return (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className={td}>
                          <div className="font-medium">{p.shop_name || "（未命名店家）"}</div>
                          {p.note && <div className="text-xs text-muted-foreground">{p.note}</div>}
                        </td>
                        <td className={td}>{fmtDate(p.created_at)}</td>
                        <td className={`${td} text-right tabular-nums`}>{p.bookings_count}</td>
                        <td className={`${td} text-right tabular-nums`}>{money(p.gross)}</td>
                        <td className={`${td} text-right tabular-nums text-muted-foreground`}>
                          {money(p.platform_cut)}
                        </td>
                        <td className={`${td} text-right font-semibold tabular-nums`}>
                          {money(p.shop_cut)}
                        </td>
                        <td className={`${td} text-xs`}>
                          {bank?.bank_account_number ? (
                            <>
                              <div>
                                {bankLabel(bank.bank_account_bank_code) ??
                                  bank.bank_account_bank_code ??
                                  ""}
                              </div>
                              <div className="tabular-nums">{bank.bank_account_number}</div>
                              <div className="text-muted-foreground">{bank.bank_account_name}</div>
                            </>
                          ) : (
                            <span className="text-destructive">
                              未設定銀行帳戶 / No bank account
                            </span>
                          )}
                        </td>
                        <td className={td}>
                          <span
                            className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${PAYOUT_STATUS_STYLE[p.status] ?? ""}`}
                          >
                            {PAYOUT_STATUS_LABEL[p.status] ?? p.status}
                          </span>
                          {p.status === "transferred" && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {fmtDate(p.marked_transferred_at)}
                              {p.bank_reference ? ` · ${p.bank_reference}` : ""}
                            </div>
                          )}
                        </td>
                        <td className={td}>
                          {pending ? (
                            <div className="flex flex-col gap-2">
                              <input
                                className={`${inputCls} py-1.5 text-xs`}
                                placeholder="轉帳備註（選填）/ Bank ref"
                                value={refs[p.id] ?? ""}
                                onChange={(e) => setRefs((r) => ({ ...r, [p.id]: e.target.value }))}
                              />
                              <div className="flex flex-wrap items-center gap-1">
                                <button
                                  type="button"
                                  className={`${primaryBtn} px-4 py-1.5 text-xs`}
                                  disabled={busyId === p.id}
                                  onClick={() => markTransferred(p.id)}
                                >
                                  標記為已轉帳 / Mark as transferred
                                </button>
                                <ConfirmButton
                                  label="取消 / Cancel"
                                  confirmLabel="確定取消撥款？/ Confirm"
                                  disabled={busyId === p.id}
                                  onConfirm={() => cancelPayout(p.id)}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
