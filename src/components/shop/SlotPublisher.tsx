import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import ConfirmButton from "@/components/ConfirmButton";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { usePlatformSettings } from "@/lib/platform";
import { cardCls, inputCls, labelCls, primaryBtn } from "@/lib/ui";

// held = a booking holds this slot (a booking_slots row references it).
type Slot = Tables<"bookable_slots"> & { held: boolean };

const pad = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtTime = (iso: string) => toTimeInput(new Date(iso));
const fmtDay = (key: string) =>
  new Date(`${key}T00:00`).toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

// Publish bookable time windows for one barber. Each slot is slot_minutes long;
// a slot has no status — whether it's booked is derived later from bookings.
export default function SlotPublisher({ barberId }: { barberId: string }) {
  const qc = useQueryClient();
  const { data: settings } = usePlatformSettings();
  const slotMinutes = settings?.slot_minutes ?? 30;
  const key = ["bookable_slots", barberId];

  const [date, setDate] = useState(toDateInput(new Date()));
  const [from, setFrom] = useState("10:00");
  const [to, setTo] = useState("18:00");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: slots = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("bookable_slots")
        .select("*, booking_slots(slot_id)")
        .eq("barber_id", barberId)
        .gte("starts_at", startOfToday.toISOString())
        .order("starts_at");
      if (error) throw error;
      return data.map(({ booking_slots, ...s }) => ({
        ...s,
        held: Array.isArray(booking_slots) ? booking_slots.length > 0 : !!booking_slots,
      }));
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const overlaps = (start: number, end: number, ignoreId?: string) =>
    slots.some(
      (s) =>
        s.id !== ignoreId &&
        new Date(s.starts_at).getTime() < end &&
        new Date(s.ends_at).getTime() > start,
    );

  const preview = useMemo(() => {
    const start = new Date(`${date}T${from}`).getTime();
    const end = new Date(`${date}T${to}`).getTime();
    const step = slotMinutes * 60_000;
    const out: { starts_at: string; ends_at: string }[] = [];
    if (!Number.isFinite(start) || !Number.isFinite(end)) return out;
    for (let t = start; t + step <= end; t += step) {
      if (t < Date.now() || overlaps(t, t + step)) continue;
      out.push({ starts_at: new Date(t).toISOString(), ends_at: new Date(t + step).toISOString() });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, from, to, slotMinutes, slots]);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!preview.length) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase
      .from("bookable_slots")
      .insert(preview.map((s) => ({ ...s, barber_id: barberId })));
    setBusy(false);
    if (error) return setMessage({ ok: false, text: error.message });
    setMessage({
      ok: true,
      text: `已發布 ${preview.length} 個時段 / Published ${preview.length} slots`,
    });
    refresh();
  }

  async function removeSlots(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase.from("bookable_slots").delete().in("id", ids);
    if (error) setMessage({ ok: false, text: error.message });
    refresh();
  }

  async function moveSlot(slot: Slot, time: string) {
    const day = toDateInput(new Date(slot.starts_at));
    const start = new Date(`${day}T${time}`).getTime();
    const end = start + slotMinutes * 60_000;
    if (!Number.isFinite(start)) return;
    if (overlaps(start, end, slot.id))
      return setMessage({ ok: false, text: "這個時間和其他時段重疊 / overlaps another slot" });
    const { error } = await supabase
      .from("bookable_slots")
      .update({ starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString() })
      .eq("id", slot.id);
    if (error) setMessage({ ok: false, text: error.message });
    refresh();
  }

  const byDay = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    const k = toDateInput(new Date(s.starts_at));
    (acc[k] ??= []).push(s);
    return acc;
  }, {});

  return (
    <section className={cardCls}>
      <h2 className="text-3xl">可預約時段 / Bookable slots</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        每個時段 {slotMinutes}{" "}
        分鐘。選一天的營業時間，系統會產生一連串連續時段（自動略過已過去或重疊的時間）。
      </p>
      <form onSubmit={publish} className="mt-6 grid items-end gap-4 sm:grid-cols-4">
        <div>
          <label className={labelCls}>日期 / Date</label>
          <input
            type="date"
            required
            className={inputCls}
            value={date}
            min={toDateInput(new Date())}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>開始 / From</label>
          <input
            type="time"
            required
            step={slotMinutes * 60}
            className={inputCls}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>結束 / To</label>
          <input
            type="time"
            required
            step={slotMinutes * 60}
            className={inputCls}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <button className={primaryBtn} disabled={busy || preview.length === 0}>
          {busy ? "發布中…" : `發布 ${preview.length} 個時段`}
        </button>
      </form>
      {message && (
        <p className={`mt-3 text-sm ${message.ok ? "text-muted-foreground" : "text-destructive"}`}>
          {message.text}
        </p>
      )}

      <div className="mt-8 space-y-5">
        {Object.keys(byDay).length === 0 && (
          <p className="text-sm text-muted-foreground">還沒有發布任何時段 / No upcoming slots.</p>
        )}
        {Object.entries(byDay).map(([day, list]) => (
          <div key={day}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium">
                {fmtDay(day)} · {list.length} 個時段
                {list.some((s) => s.held) && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    （{list.filter((s) => s.held).length} 個已被預約）
                  </span>
                )}
              </h3>
              {list.some((s) => !s.held) && (
                <ConfirmButton
                  label="清空空檔 / Clear free slots"
                  onConfirm={() => removeSlots(list.filter((s) => !s.held).map((s) => s.id))}
                />
              )}
            </div>
            <ul className="flex flex-wrap gap-2">
              {list.map((s) =>
                s.held ? (
                  <li
                    key={s.id}
                    title="已被預約，無法修改或刪除 / Booked — can't edit or delete"
                    className="flex items-center gap-1 rounded-full border border-primary bg-primary py-1 pr-3 pl-3 text-sm text-primary-foreground"
                  >
                    <span className="tabular-nums">
                      {fmtTime(s.starts_at)} – {fmtTime(s.ends_at)}
                    </span>
                    <span className="ml-1 text-xs opacity-80">已預約</span>
                  </li>
                ) : (
                  <li
                    key={s.id}
                    className="flex items-center gap-1 rounded-full border bg-background py-1 pr-1 pl-3 text-sm"
                  >
                    <input
                      type="time"
                      aria-label="Slot start time"
                      step={slotMinutes * 60}
                      defaultValue={fmtTime(s.starts_at)}
                      onBlur={(e) =>
                        e.target.value !== fmtTime(s.starts_at) && moveSlot(s, e.target.value)
                      }
                      className="w-[5.5rem] bg-transparent outline-none"
                    />
                    <span className="text-muted-foreground">– {fmtTime(s.ends_at)}</span>
                    <button
                      type="button"
                      aria-label="Delete slot"
                      onClick={() => removeSlots([s.id])}
                      className="rounded-full px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      ×
                    </button>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
