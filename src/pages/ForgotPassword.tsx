import { Link, useSearchParams } from "react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHead } from "@/hooks/use-head";
import { nextQuery, safeNext } from "@/lib/profile";
import { authInputClass, authPrimaryButtonClass } from "@/lib/ui";
import { Shell } from "@/pages/Auth";

const head = [
  { title: "Forgot password — Barberly" },
  { name: "description", content: "Reset your Barberly password." },
];

export default function ForgotPasswordPage() {
  useHead(head);
  const [params] = useSearchParams();
  const search = nextQuery(safeNext(params.get("next")));
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password${search}`,
    });
    setLoading(false);
    if (error) return setError(error.message);
    setSent(true);
  }

  return (
    <Shell>
      <h1 className="text-center text-3xl">Forgot password</h1>
      {sent ? (
        <p className="mt-6 text-center text-sm">
          If an account exists for <span className="font-medium">{email}</span>, a password-reset
          link is on its way. Open it to choose a new password.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Enter your account email and we'll send you a link to reset your password.
          </p>
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button disabled={loading} className={authPrimaryButtonClass}>
            {loading ? "Please wait…" : "Send reset link"}
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to={`/sign-in${search}`} className="font-medium underline underline-offset-4">
          Back to Sign In
        </Link>
      </p>
    </Shell>
  );
}
