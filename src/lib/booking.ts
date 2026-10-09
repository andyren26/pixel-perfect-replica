import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Barber = Tables<"barbers">;
export type Service = Tables<"services">;
export type Photo = Tables<"barber_photos">;
export type Slot = Tables<"bookable_slots">;

// A bookable slot plus whether a booking already holds it. Slots have no status:
// a slot is free unless a booking_slots row references it (the anti-join).
export type SlotWithHold = Slot & { held: boolean };

export const CATEGORIES = ["cut", "color", "perm", "beard"] as const;
export const CATEGORY_LABEL: Record<string, string> = {
  cut: "Cut 剪髮",
  color: "Color 染髮",
  perm: "Perm 燙髮",
  beard: "Beard 修鬍",
};

export const STATUS_LABEL: Record<string, string> = {
  pending_payment: "待付款 / Awaiting payment",
  paid: "已付款 / Paid",
  cancelled: "已取消 / Cancelled",
};

const BUCKET = "barber-photos";
export function photoUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Featured first (by sort_order), then the rest by sort_order, newest last.
export function orderPhotos<T extends Pick<Photo, "is_featured" | "sort_order" | "created_at">>(
  photos: T[],
): T[] {
  return [...photos].sort(
    (a, b) =>
      Number(b.is_featured) - Number(a.is_featured) ||
      a.sort_order - b.sort_order ||
      a.created_at.localeCompare(b.created_at),
  );
}

// The card photo: first featured photo, else the newest one.
export function repPhoto<T extends Pick<Photo, "is_featured" | "sort_order" | "created_at">>(
  photos: T[],
): T | undefined {
  const featured = orderPhotos(photos.filter((p) => p.is_featured))[0];
  if (featured) return featured;
  return [...photos].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

// ── Times ───────────────────────────────────────────────────────────────────
// Slots are timestamptz. Show them in ONE labelled zone (the barbers' local time)
// so a customer's browser zone can't shift the barber's published hours.
export const DISPLAY_TZ = "Asia/Taipei";
export const TZ_LABEL = "台北時間 (UTC+8)";

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: DISPLAY_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("zh-TW", {
  timeZone: DISPLAY_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dayLabelFmt = new Intl.DateTimeFormat("zh-TW", {
  timeZone: DISPLAY_TZ,
  month: "long",
  day: "numeric",
  weekday: "short",
});

export const dayKey = (iso: string) => dayKeyFmt.format(new Date(iso)); // "2026-10-09"
export const fmtTime = (iso: string) => timeFmt.format(new Date(iso)); // "18:00"
export const fmtDay = (iso: string) => dayLabelFmt.format(new Date(iso)); // "10月9日 週五"

// ── Availability ────────────────────────────────────────────────────────────
// A start slot is offered for a service needing N slots only if it and the next
// N-1 slots of this barber (in time order) are back-to-back and all free.
// This mirrors what create_booking checks server-side.
export function startOptions(slots: SlotWithHold[], n: number): Map<string, SlotWithHold[]> {
  const sorted = [...slots].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const out = new Map<string, SlotWithHold[]>();
  if (n < 1) return out;
  for (let i = 0; i < sorted.length; i++) {
    const run = sorted.slice(i, i + n);
    const first = run[0];
    if (!first || run.length < n) break;
    const ok = run.every((s, j) => {
      const prev = run[j - 1];
      return (
        !s.held && (!prev || new Date(s.starts_at).getTime() === new Date(prev.ends_at).getTime())
      );
    });
    if (ok) out.set(first.id, run);
  }
  return out;
}

// ── Queries ─────────────────────────────────────────────────────────────────
export function useBarberDirectory() {
  return useQuery({
    queryKey: ["barber-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbers")
        .select(
          "id, name, intro, address, created_at, services(category, price), barber_photos(storage_path, is_featured, sort_order, created_at)",
        )
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useBarber(id: string | undefined) {
  return useQuery({
    queryKey: ["barber", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbers")
        .select("id, name, intro, address, services(*), barber_photos(*)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export const availableSlotsKey = (barberId: string) => ["available-slots", barberId];

// Future slots for a barber, each marked held/free via its booking_slots rows.
export function useBarberSlots(barberId: string | undefined) {
  return useQuery({
    queryKey: availableSlotsKey(barberId ?? ""),
    enabled: !!barberId,
    queryFn: async (): Promise<SlotWithHold[]> => {
      const { data, error } = await supabase
        .from("bookable_slots")
        .select("*, booking_slots(slot_id)")
        .eq("barber_id", barberId!)
        .gt("starts_at", new Date().toISOString())
        .order("starts_at");
      if (error) throw error;
      return data.map(({ booking_slots, ...slot }) => ({
        ...slot,
        held: Array.isArray(booking_slots) ? booking_slots.length > 0 : !!booking_slots,
      }));
    },
  });
}

export const myBookingsKey = (customerId: string) => ["my-bookings", customerId];

// The signed-in customer's bookings with their DERIVED start/end (bookings_with_start),
// plus service + barber names reached through bookings -> services -> barbers.
export function useMyBookings(customerId: string) {
  return useQuery({
    queryKey: myBookingsKey(customerId),
    queryFn: async () => {
      const { data: bookings, error } = await supabase
        .from("bookings_with_start")
        .select("*")
        .eq("customer_id", customerId)
        .order("starts_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;

      const serviceIds = [
        ...new Set(bookings.map((b) => b.service_id).filter(Boolean)),
      ] as string[];
      const { data: services, error: svcError } = serviceIds.length
        ? await supabase
            .from("services")
            .select("id, name, category, required_slots, barbers(id, name, address)")
            .in("id", serviceIds)
        : { data: [], error: null };
      if (svcError) throw svcError;
      const byId = new Map(services.map((s) => [s.id, s]));
      return bookings.map((b) => ({
        ...b,
        service: b.service_id ? byId.get(b.service_id) : undefined,
      }));
    },
  });
}
