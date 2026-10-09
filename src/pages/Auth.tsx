import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHead } from "@/hooks/use-head";
import { getSession, homePathForRole, safeNext } from "@/lib/profile";

const head = [
  { title: "Sign in — Barberly" },
  { name: "description", content: "Sign in or create your Barberly account as a customer or barber." },
  { property: "og:title", content: "Sign in — Barberly" },
  { property: "og:description", content: "Sign in or create your Barberly account." },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary" },
];

// Rendered for both /sign-in and /sign-up; the URL decides the mode.
export default function AuthPage() {
  useHead(head);
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [params] = useSearchParams();
  // Where to return after auth (e.g. the barber page whose Book button sent us here).
  const next = safeNext(params.get("next"));
  const mode: "signin" | "signup" = pathname.replace(/\/+$/, "") === "/sign-up" ? "signup" : "signin";
  const setMode = (m: "signin" | "signup") =>
    navigate((m === "signup" ? "/sign-up" : "/sign-in") + search, { replace: true });
  const [role, setRole] = useState<"customer" | "shop">("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goHome();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Return to ?next= if given, else land on the page for this account's role
  // (read from profiles.role).
  async function goHome() {
    const session = await getSession();
    const home = session ? homePathForRole(session.profile.role) : "/barbers";
    navigate(next ?? home, { replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/sign-in${search}`, data: { role } },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (res.error) return setError(res.error.message);
    if (res.data.session) await goHome();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4">
      <Link to="/" className="mb-8 font-serif text-4xl font-semibold">Barberly</Link>
      <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-sm animate-fade-up">
        <h1 className="text-center text-4xl">{mode === "signup" ? "Create account" : "Welcome back"}</h1>

        {mode === "signup" && (
          <div className="mt-6 grid grid-cols-2 rounded-full bg-secondary p-1" role="tablist">
            {(["customer", "shop"] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={role === r}
                onClick={() => setRole(r)}
                className={`rounded-full py-2 text-sm font-medium transition ${role === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {r === "customer" ? "Customer" : "Barber"}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-full border bg-background px-5 py-3 text-sm outline-none focus:border-ring" />
          <input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-full border bg-background px-5 py-3 text-sm outline-none focus:border-ring" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button disabled={loading} className="w-full rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
            {loading ? "Please wait…" : mode === "signup" ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signup" ? "Already have an account?" : "New to Barberly?"}{" "}
          <button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); }} className="font-medium text-foreground underline underline-offset-4">
            {mode === "signup" ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
}
