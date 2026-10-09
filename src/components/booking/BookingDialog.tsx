import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORY_LABEL,
  TZ_LABEL,
  dayKey,
  fmtDay,
  fmtTime,
  startOptions,
  type Service,
  type SlotWithHold,
} from "@/lib/booking";
import { errMessage } from "@/lib/errors";
import { formatMoney, usePlatformSettings } from "@/lib/platform";
import { ghostBtn, primaryBtn } from "@/lib/ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barberName: string;
  services: Service[];
  slots: SlotWithHold[];
  initialDay?: string | null;
  // The time chip the dialog was opened from (pre-selected once a service fits it).
  initialStartId?: string | null;
  onBooked: () => void;
};

// The M1.2 booking pop-up: service -> date -> start slot -> Confirm.
// Confirm calls the create_booking RPC (1 pending_payment booking + N booking_slots
// rows, atomically) and closes back onto the same /barbers/:id page. No payment yet.
export default function BookingDialog({
  open,
  onOpenChange,
  barberName,
  services,
  slots,
  initialDay,
  initialStartId,
  onBooked,
}: Props) {
  const { data: settings } = usePlatformSettings();
  const slotMinutes = settings?.slot_minutes ?? 30;
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [startId, setStartId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const n = service?.required_slots ?? 1;
  const options = useMemo(() => startOptions(slots, n), [slots, n]);
  const free = useMemo(() => slots.filter((s) => !s.held), [slots]);

  // Days that have at least one legal start for the chosen service.
  const days = useMemo(() => {
    const keys: string[] = [];
    for (const s of free) {
      const k = dayKey(s.starts_at);
      if (options.has(s.id) && !keys.includes(k)) keys.push(k);
    }
    return keys;
  }, [free, options]);

  // Fresh state every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setServiceId(services.length === 1 ? (services[0]?.id ?? null) : null);
    setStartId(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the chosen day valid for the chosen service.
  useEffect(() => {
    if (!open) return;
    setDay((d) => {
      if (d && days.includes(d)) return d;
      if (initialDay && days.includes(initialDay)) return initialDay;
      return days[0] ?? null;
    });
  }, [open, days, initialDay]);

  // A new service or day clears the start time, except that the time chip the
  // dialog was opened from stays selected while it's a valid start on this day.
  useEffect(() => {
    const keep =
      initialStartId &&
      options.has(initialStartId) &&
      slots.some((s) => s.id === initialStartId && dayKey(s.starts_at) === day);
    setStartId(keep ? initialStartId : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, serviceId, day]);

  const daySlots = free.filter((s) => day && dayKey(s.starts_at) === day);
  const run = startId ? options.get(startId) : undefined;
  const covered = new Set(run?.map((s) => s.id));
  const runFirst = run?.[0];
  const runLast = run?.at(-1);

  async function confirm() {
    if (!service || !startId) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("create_booking", {
      p_service_id: service.id,
      p_start_slot_id: startId,
    });
    setBusy(false);
    if (error) {
      setError(errMessage(error, "Could not complete the booking."));
      onBooked(); // refresh availability: someone may have just taken these slots
      return;
    }
    onOpenChange(false);
    toast.success("預約成功！可在「我的預約」查看 / Booked — see My bookings.");
    onBooked();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-2xl sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-3xl font-normal">預約 {barberName}</DialogTitle>
          <DialogDescription>
            選擇服務、日期與開始時間 / Pick a service, day and start time.
          </DialogDescription>
        </DialogHeader>

        {/* 1. Service */}
        <section>
          <h3 className="mb-2 text-sm font-medium">1. 服務 / Service</h3>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">這位理髮師還沒有上架服務。</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={s.id === serviceId}
                  onClick={() => setServiceId(s.id)}
                  className={`rounded-2xl border p-4 text-left transition ${s.id === serviceId ? "border-primary bg-secondary" : "hover:bg-secondary/60"}`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{s.name}</span>
                    <span className="font-semibold">{formatMoney(s.price, settings)}</span>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {CATEGORY_LABEL[s.category] ?? s.category} · {s.required_slots * slotMinutes}{" "}
                    分鐘（{s.required_slots} 個時段）
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {service && (
          <>
            {/* 2. Day */}
            <section>
              <h3 className="mb-2 text-sm font-medium">2. 日期 / Day</h3>
              {days.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  目前沒有足夠的連續空檔可以做這個服務（需要連續 {n} 個時段）。
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {days.map((k) => {
                    const first = free.find((s) => dayKey(s.starts_at) === k)!;
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={k === day}
                        onClick={() => setDay(k)}
                        className={`rounded-full border px-4 py-1.5 text-sm transition ${k === day ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
                      >
                        {fmtDay(first.starts_at)}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 3. Start time */}
            {day && (
              <section>
                <h3 className="mb-1 text-sm font-medium">3. 開始時間 / Start time</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  {TZ_LABEL}
                  {n > 1 &&
                    ` · 此服務會連續佔用 ${n} 個時段；灰色格子表示「從這裡開始湊不滿 ${n} 個連續時段」`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((s) => {
                    const legal = options.has(s.id);
                    const isStart = s.id === startId;
                    const inRun = covered.has(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!legal}
                        onClick={() => setStartId(s.id)}
                        title={legal ? undefined : `無法從這裡開始（時段不足，需要連續 ${n} 個）`}
                        className={`rounded-full border px-3.5 py-1.5 text-sm tabular-nums transition ${
                          inRun
                            ? `border-primary bg-primary text-primary-foreground ${isStart ? "ring-2 ring-primary ring-offset-2" : ""}`
                            : legal
                              ? "bg-card hover:bg-secondary"
                              : "cursor-not-allowed border-dashed text-muted-foreground/60"
                        }`}
                      >
                        {fmtTime(s.starts_at)}
                        {!legal && !inRun && <span className="ml-1 text-[10px]">時段不足</span>}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {runFirst && runLast && service && (
          <div className="rounded-2xl bg-cream p-4 text-sm">
            <p className="font-medium">
              你的預約：{fmtDay(runFirst.starts_at)} {fmtTime(runFirst.starts_at)}–
              {fmtTime(runLast.ends_at)}
              {n > 1 && `（連佔 ${n} 個時段）`}
            </p>
            <p className="mt-1 text-muted-foreground">
              {service.name} ·{" "}
              <strong className="text-foreground">{formatMoney(service.price, settings)}</strong>
              <span className="ml-2 text-xs">（目前不需付款 / no payment yet）</span>
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="items-center gap-2 sm:gap-2">
          {!busy && (!service || !startId) && (
            <span className="mr-auto text-xs text-muted-foreground" aria-live="polite">
              {!service ? "請先選擇服務 / Pick a service" : "請選擇開始時間 / Pick a start time"}
            </span>
          )}
          <button
            type="button"
            className={ghostBtn}
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={primaryBtn}
            disabled={!service || !startId || busy}
            onClick={confirm}
          >
            {busy ? "預約中…" : "Confirm 確認預約"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
