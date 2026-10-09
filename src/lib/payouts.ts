import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type OwedBooking = Tables<"owed_bookings">;
export type Payout = Tables<"payouts">;

// Settlement is DERIVED from bookings.payout_id (never a booking status):
//   paid + payout_id NULL → owed (listed in the owed_bookings view)
//   paid + payout_id set  → in that payout (read payouts.status)
export const PAYOUT_STATUS_LABEL: Record<string, string> = {
  pending_transfer: "待轉帳 / Pending",
  transferred: "已轉帳 / Transferred",
  cancelled: "已取消 / Cancelled",
};

export const PAYOUT_STATUS_STYLE: Record<string, string> = {
  pending_transfer: "bg-accent",
  transferred: "bg-primary text-primary-foreground",
  cancelled: "bg-secondary text-muted-foreground",
};

export const owedKey = ["owed-bookings"] as const;
export const payoutsKey = ["payouts"] as const;

// The live owed pool (paid bookings with payout_id IS NULL). The view already
// carries shop_name + barber_name, so nothing is embedded onto it.
export function useOwedBookings(shopId?: string) {
  return useQuery({
    queryKey: shopId ? [...owedKey, shopId] : owedKey,
    queryFn: async () => {
      let q = supabase.from("owed_bookings").select("*").order("paid_at", { ascending: false });
      if (shopId) q = q.eq("shop_id", shopId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

// Admin: every payout batch, plus the shop's bank account to transfer to
// (profiles bank fields are readable only by the owning shop + admin).
export function useAdminPayouts() {
  return useQuery({
    queryKey: payoutsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select(
          "*, shop:profiles!payouts_shop_id_fkey(bank_account_name, bank_account_number, bank_account_bank_code)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// Admin: customer labels for the owed list (admin can read every profile).
export function useCustomerLabels(ids: string[]) {
  const sorted = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["customer-labels", sorted],
    enabled: sorted.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", sorted);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const p of data) map.set(p.id, p.display_name?.trim() || p.email || p.id.slice(0, 8));
      return map;
    },
  });
}

// Shop: its own paid bookings that are already in a payout, with that payout's status.
export function useShopPaidOutBookings(shopId: string) {
  return useQuery({
    queryKey: ["shop-paid-out", shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, price, paid_at, payout_id, services!inner(name, barbers!inner(name, shop_id))")
        .eq("status", "paid")
        .not("payout_id", "is", null)
        .eq("services.barbers.shop_id", shopId)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// Shop: its own payout batches (RLS: shop_id = auth.uid()).
export function useShopPayouts(shopId: string) {
  return useQuery({
    queryKey: [...payoutsKey, shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
