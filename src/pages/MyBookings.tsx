import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import AppHeader from "@/components/AppHeader";
import ConfirmButton from "@/components/ConfirmButton";
import { useHead } from "@/hooks/use-head";
import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  TZ_LABEL,
  fmtDay,
  fmtTime,
  myBookingsKey,
  useMyBookings,
} from "@/lib/booking";
import { startCheckout } from "@/lib/checkout";
import { errMessage } from "@/lib/errors";
import { formatMoney, usePlatformSettings } from "@/lib/platform";
import type { Session } from "@/lib/profile";
import { cardCls, primaryBtn } from "@/lib/ui";

const head = [
  { title: "我的預約 — Barberly" },
  { name: "description", content: "你在 Barberly 的預約紀錄。" },
];

const STATUS_STYLE: Record<string, string> = {
  pending_payment: "bg-accent",
  paid: "bg-primary text-primary-foreground",
  cancelled: "bg-secondary text-muted-foreground",
};

// /bookings — the signed-in customer's own bookings (RLS: customer_id = auth.uid()).
// Start/end come from bookings_with_start (MIN/MAX over the booking's slots).
export default function MyBookings() {
  useHead(head);
  const { user, profile } = useLoaderData() as Session;
  const qc = useQueryClient();
  const { data: settings } = usePlatformSettings();
  const { data: bookings = [], isLoading, error } = useMyBookings(profile.id);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  // Resume payment for a booking that is still pending_payment (e.g. Checkout was closed).
  async function pay(id: string) {
    setCancelError(null);
    setPayingId(id);
    try {
      await startCheckout(id);
    } catch (e) {
      setPayingId(null);
      setCancelError(errMessage(e, "無法開始付款，請再試一次。"));
    }
  }

  async function cancel(id: string) {
    setCancelError(null);
    // Only flip the status. The trg_free_slots_on_cancel trigger deletes this
    // booking's booking_slots rows, which frees the slots for other customers.
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select("id");
    if (error || !data?.length) {
      setCancelError(errMessage(error, "無法取消這筆預約。"));
    } else {
      toast.success("已取消預約 / Booking cancelled");
    }
    qc.invalidateQueries({ queryKey: myBookingsKey(profile.id) });
    qc.invalidateQueries({ queryKey: ["available-slots"] });
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={user.email} profile={profile} />
      <main className="mx-auto max-w-4xl space-y-8 px-6 pt-6 pb-24 animate-fade-up">
        <div className="hem rounded-3xl bg-cream p-8 md:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            My bookings
          </p>
          <h1 className="mt-3 text-4xl md:text-5xl">我的預約</h1>
          <p className="mt-3 text-sm text-muted-foreground">時間皆為{TZ_LABEL}</p>
        </div>

        {cancelError && <p className="text-sm text-destructive">{cancelError}</p>}

        {error ? (
          <p className="text-sm text-destructive">{errMessage(error, "無法載入預約紀錄。")}</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">載入中…</p>
        ) : bookings.length === 0 ? (
          <div className={`${cardCls} text-center`}>
            <p className="text-muted-foreground">還沒有任何預約 / No bookings yet.</p>
            <Link to="/barbers" className={`${primaryBtn} mt-5 inline-block`}>
              找理髮師 / Find a barber
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {bookings.map((b) => {
              const status = b.status ?? "pending_payment";
              const barber = b.service?.barbers;
              return (
                <li
                  key={b.id}
                  className={`${cardCls} flex flex-wrap items-start justify-between gap-4`}
                >
                  <div className="min-w-0">
                    <span
                      className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? "bg-secondary"}`}
                    >
                      {STATUS_LABEL[status] ?? status}
                    </span>
                    <h2 className="mt-3 text-2xl">
                      {barber ? (
                        <Link to={`/barbers/${barber.id}`} className="hover:underline">
                          {barber.name}
                        </Link>
                      ) : (
                        "理髮師"
                      )}
                    </h2>
                    <p className="mt-1 text-sm">
                      {b.service?.name ?? "服務"}
                      {b.service && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {CATEGORY_LABEL[b.service.category] ?? b.service.category}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {b.starts_at && b.ends_at
                        ? `${fmtDay(b.starts_at)} ${fmtTime(b.starts_at)}–${fmtTime(b.ends_at)}`
                        : "時段已釋出 / slots released"}
                      {barber?.address && ` · ${barber.address}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xl font-semibold">
                      {formatMoney(b.price ?? 0, settings)}
                    </span>
                    {status === "pending_payment" && b.id && (
                      <button
                        type="button"
                        className={primaryBtn}
                        disabled={payingId !== null}
                        onClick={() => pay(b.id!)}
                      >
                        {payingId === b.id ? "前往付款中… / Redirecting…" : "付款 / Pay now"}
                      </button>
                    )}
                    {status === "pending_payment" && b.id && (
                      <ConfirmButton
                        label="取消預約 / Cancel"
                        confirmLabel="確定取消？/ Confirm"
                        onConfirm={() => cancel(b.id!)}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
