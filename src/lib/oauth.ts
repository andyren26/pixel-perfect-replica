import type { Provider } from "@supabase/supabase-js";

// Social sign-in options, in display order. LINE isn't a built-in Supabase
// provider, so it is configured as a custom OIDC provider named "custom:line".
export const SOCIAL_PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "facebook", label: "Facebook" },
  { id: "custom:line", label: "LINE" },
  { id: "apple", label: "Apple" },
] as const;

export type SocialProviderId = (typeof SOCIAL_PROVIDERS)[number]["id"];

// The SDK's Provider type predates custom providers; the "custom:" string is valid at runtime.
export const asProvider = (id: SocialProviderId) => id as Provider;

// Ask Supabase which providers are switched on, so a button only appears once its
// provider is configured in the dashboard (no dead buttons before setup).
export async function fetchEnabledProviders(): Promise<Set<SocialProviderId>> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return new Set();
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    if (!res.ok) return new Set();
    const external: Record<string, unknown> = (await res.json())?.external ?? {};
    const on = (k: string) => external[k] === true;
    return new Set(
      SOCIAL_PROVIDERS.map((p) => p.id).filter((id) =>
        id === "custom:line" ? on("custom:line") || on("line") : on(id),
      ),
    );
  } catch {
    return new Set();
  }
}
