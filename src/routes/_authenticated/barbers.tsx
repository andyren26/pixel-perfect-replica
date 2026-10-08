import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/barbers")({
  head: () => ({
    meta: [
      { title: "Your Barberly" },
      { name: "description", content: "Your Barberly home." },
      { property: "og:title", content: "Your Barberly" },
      { property: "og:description", content: "Your Barberly home." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BarbersPage,
});

function BarbersPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const isShop = user.user_metadata?.role === "shop";

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-5">
        <Link to="/" className="font-serif text-3xl font-semibold">Barberly</Link>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden sm:inline">Hi {user.email}</span>
          {isShop && <span className="rounded-full bg-accent px-3 py-0.5 text-xs font-medium">barber</span>}
          <button onClick={signOut} className="rounded-full bg-primary px-5 py-2 text-primary-foreground hover:opacity-90">Sign Out</button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-24 text-center animate-fade-up">
        <div className="rounded-3xl bg-cream p-12">
          {isShop ? (
            <>
              <h1 className="text-4xl">理髮師後台即將上線 — 下一個里程碑會加上個人檔案、服務項目與排班管理。</h1>
              <p className="mt-4 text-muted-foreground">Your barber dashboard is coming soon — profile, services & schedule arrive in the next milestone.</p>
            </>
          ) : (
            <>
              <h1 className="text-4xl">附近的理髮師即將上線 — 下一個里程碑會加上瀏覽與預約功能。</h1>
              <p className="mt-4 text-muted-foreground">Barbers near you are coming soon — browse & booking arrive in the next milestone.</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
