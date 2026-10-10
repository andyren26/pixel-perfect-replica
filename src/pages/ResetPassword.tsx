import { Link, useNavigate, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHead } from "@/hooks/use-head";
import { getSession, homePathForRole, safeNext } from "@/lib/profile";
import { authInputClass, authPrimaryButtonClass } from "@/lib/ui";
import { Shell } from "@/pages/Auth";

const head = [
  { title: "Choose a new password — Barberly" },
  { name: "description", content: "Set a new password for your Barberly account." },
];

// Landing page for the reset-password email link. Supabase signs the user in
// from the link, then we let them set a new password.
export default function ResetPasswordPage() {
  useHead(head);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady("ok");
    });
    supabase.auth.getSession().then(({ data }) => setReady(data.session ? "ok" : "invalid"));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("The two passwords don't match.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    const session = await getSession();
    navigate(next ?? (session ? homePathForRole(session.profile.role) : "/barbers"), {
      replace: true,
    });
  }

  return (
    <Shell>
      <h1 className="text-center text-3xl">Choose a new password</h1>
      {ready === "checking" && (
        <p className="mt-6 text-center text-sm text-muted-foreground">Checking your link…</p>
      )}
      {ready === "invalid" && (
        <div className="mt-6 text-center text-sm">
          <p>This reset link is invalid or has expired.</p>
          <Link
            to="/forgot-password"
            className="mt-4 inline-block font-medium underline underline-offset-4"
          >
            Send a new link
          </Link>
        </div>
      )}
      {ready === "ok" && (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            type="password"
            required
            minLength={6}
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={authInputClass}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button disabled={loading} className={authPrimaryButtonClass}>
            {loading ? "Please wait…" : "Update password"}
          </button>
        </form>
      )}
    </Shell>
  );
}
