import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PlatformSettings = Tables<"platform_settings">;

const FALLBACK: PlatformSettings = {
  id: true,
  currency: "twd",
  currency_minor_units: 0,
  slot_minutes: 30,
  updated_at: "",
};

// The single-row platform config (currency + slot length).
export function usePlatformSettings() {
  return useQuery({
    queryKey: ["platform_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_settings").select("*").single();
      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
    placeholderData: FALLBACK,
  });
}

// Prices are stored as whole integers in platform_settings.currency (no x100).
export function formatMoney(amount: number, settings: PlatformSettings = FALLBACK): string {
  try {
    const currency = settings.currency.toUpperCase();
    const text = new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency,
      minimumFractionDigits: settings.currency_minor_units,
      maximumFractionDigits: settings.currency_minor_units,
    }).format(amount);
    // zh-TW renders TWD as a bare "$"; spell it NT$ so it isn't read as US dollars.
    return currency === "TWD" ? text.replace(/^(-?)\$/, "$1NT$") : text;
  } catch {
    return `${amount} ${settings.currency.toUpperCase()}`;
  }
}
