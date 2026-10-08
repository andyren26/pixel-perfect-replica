import { useState } from "react";
import { useLoaderData, useNavigate } from "react-router";

import AppHeader from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { useHead } from "@/hooks/use-head";
import type { Session } from "@/lib/profile";

const head = [
  { title: "Your Barberly" },
  { name: "description", content: "Your Barberly home." },
  { property: "og:title", content: "Your Barberly" },
  { property: "og:description", content: "Your Barberly home." },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary" },
];

// Customer home at /app. Shops are redirected to /shop by the route loader.
export default function AppHome() {
  useHead(head);
  const { user, profile } = useLoaderData() as Session;
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function becomeShop() {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("become_shop");
    setBusy(false);
    if (error || data !== "shop")
      return setError(error?.message ?? "Could not upgrade this account.");
    navigate("/shop", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={user.email} profile={profile}>
        {profile.role === "customer" && (
          <button
            onClick={becomeShop}
            disabled={busy}
            className="rounded-full border border-primary px-5 py-2 font-medium transition hover:bg-secondary disabled:opacity-60"
          >
            {busy ? "Please wait…" : "開店 / Become a shop"}
          </button>
        )}
      </AppHeader>
      <main className="mx-auto max-w-3xl px-6 py-24 text-center animate-fade-up">
        {error && <p className="mb-6 text-sm text-destructive">{error}</p>}
        <div className="rounded-3xl bg-cream p-12">
          <h1 className="text-4xl">附近的理髮師即將上線 — 下一個里程碑會加上瀏覽與預約功能。</h1>
          <p className="mt-4 text-muted-foreground">
            Barbers near you are coming soon — browse & booking arrive in the next milestone.
          </p>
        </div>
      </main>
    </div>
  );
}
