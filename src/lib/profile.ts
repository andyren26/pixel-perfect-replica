import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

export type Session = { user: User; profile: Profile };

// Roles are read from public.profiles.role (never user_metadata).
export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();
  if (profileError || !profile) return null;
  return { user: data.user, profile };
}

// Post-login landing page by role. Only shop and customer are routed here.
export function homePathForRole(role: string): string {
  return role === "shop" ? "/shop" : "/app";
}

// A shop has finished onboarding once the shop name + both bank fields are saved.
export function isOnboarded(profile: Profile): boolean {
  return [profile.display_name, profile.bank_account_name, profile.bank_account_number].every(
    (v) => !!v && v.trim() !== "",
  );
}
