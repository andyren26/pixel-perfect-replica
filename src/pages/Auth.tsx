import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHead } from "@/hooks/use-head";
import { getSession, homePathForRole, nextQuery, safeNext } from "@/lib/profile";
import {
  SOCIAL_PROVIDERS,
  asProvider,
  fetchEnabledProviders,
  type SocialProviderId,
} from "@/lib/oauth";
import { authInputClass, authPrimaryButtonClass } from "@/lib/ui";
import { authErrorText } from "@/lib/authErrors";

const head = [
  { title: "登入 — Barberly" },
  {
    name: "description",
    content: "以顧客或理髮師身分登入、建立 Barberly 帳號。",
  },
  { property: "og:title", content: "登入 — Barberly" },
  { property: "og:description", content: "登入或建立 Barberly 帳號。" },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary" },
];

// Rendered for both /sign-in and /sign-up; the URL decides the mode.
export default function AuthPage() {
  useHead(head);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  // Where to return after auth (e.g. the barber page whose Book button sent us here).
  const next = safeNext(params.get("next"));
  // Only ?next= is carried between auth pages and into redirect URLs. Anything
  // else (notably a previous attempt's ?error=…) must not ride along: supabase-js
  // treats an `error` param on the return URL as a failure and drops the session.
  const search = nextQuery(next);
  const mode: "signin" | "signup" =
    pathname.replace(/\/+$/, "") === "/sign-up" ? "signup" : "signin";
  const setMode = (m: "signin" | "signup") =>
    navigate((m === "signup" ? "/sign-up" : "/sign-in") + search, { replace: true });
  const [role, setRole] = useState<"customer" | "shop">("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Set once sign-up succeeds but the account still needs email confirmation.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [providers, setProviders] = useState<Set<SocialProviderId>>(new Set());

  useEffect(() => {
    // A failed social sign-in comes back as ?error_description=…: show it once,
    // then drop it from the address bar so a retry starts clean.
    const failed = params.get("error_description") ?? params.get("error");
    if (failed) {
      setError(authErrorText(failed));
      navigate(pathname + search, { replace: true });
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goHome();
    });
    // Coming back from Google/Facebook/LINE/Apple: the session lands after mount.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") goHome();
    });
    fetchEnabledProviders().then(setProviders);
    return () => sub.subscription.unsubscribe();
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
            options: {
              emailRedirectTo: `${window.location.origin}/sign-in${search}`,
              data: { role },
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (res.error) return setError(authErrorText(res.error.message));
    if (res.data.session) return goHome();
    // Sign-up with email confirmation on: no session until the link is clicked.
    if (mode === "signup") setSentTo(email);
  }

  async function signInWith(id: SocialProviderId) {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: asProvider(id),
      options: { redirectTo: `${window.location.origin}/sign-in${search}` },
    });
    if (error) setError(authErrorText(error.message));
  }

  // Social sign-up has no role tab, so it always creates a customer account;
  // barbers/shops sign up with email so their role is set correctly.
  const showSocial = providers.size > 0 && !(mode === "signup" && role === "shop");

  if (sentTo) {
    return (
      <Shell>
        <h1 className="text-center text-3xl">請確認您的信箱</h1>
        <p className="mt-6 text-center text-base">認證信已經寄到您的信箱，請至信箱收信並認證</p>
        <p className="mt-2 text-center text-sm text-muted-foreground">{sentTo}</p>
        <button
          type="button"
          onClick={() => {
            setSentTo(null);
            setPassword("");
            setMode("signin");
          }}
          className={`mt-8 ${authPrimaryButtonClass}`}
        >
          回到登入
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-center text-4xl">{mode === "signup" ? "建立帳號" : "歡迎回來"}</h1>

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
              {r === "customer" ? "我是顧客" : "我是理髮師"}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <input
          type="email"
          required
          placeholder="電子信箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={authInputClass}
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="密碼（至少 6 個字元）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={authInputClass}
        />
        {mode === "signin" && (
          <div className="text-right">
            <Link
              to={`/forgot-password${search}`}
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              忘記密碼？
            </Link>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button disabled={loading} className={authPrimaryButtonClass}>
          {loading ? "處理中…" : mode === "signup" ? "註冊" : "登入"}
        </button>
      </form>

      {showSocial && (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            或使用以下方式
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid gap-3">
            {SOCIAL_PROVIDERS.filter((p) => providers.has(p.id)).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => signInWith(p.id)}
                className="w-full rounded-full border bg-background py-3 text-sm font-medium transition hover:bg-secondary"
              >
                使用 {p.label} 登入
              </button>
            ))}
          </div>
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "signup" ? "已經有帳號了？" : "還沒有 Barberly 帳號？"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
          }}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {mode === "signup" ? "登入" : "註冊"}
        </button>
      </p>
    </Shell>
  );
}

// The cream page + card frame shared by every auth screen.
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4">
      <Link to="/" className="mb-8 font-serif text-4xl font-semibold">
        Barberly
      </Link>
      <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-sm animate-fade-up">
        {children}
      </div>
    </div>
  );
}
