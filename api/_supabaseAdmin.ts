// Server-only Supabase client using the SERVICE-ROLE (secret) key, for the Vercel
// serverless functions in /api. It writes past RLS, so it must never be imported
// from src/ (the browser bundle). Files starting with "_" are not exposed as routes.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
const SUPABASE_SECRET_KEY = process.env["SUPABASE_SECRET_KEY"];

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error(
    "Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SECRET_KEY in the server environment.",
  );
}

const secretKey: string = SUPABASE_SECRET_KEY;

// New-format keys (sb_secret_…) are opaque strings, not JWTs: send them only as the
// `apikey` header and drop the `Authorization: Bearer <key>` header supabase-js adds.
const supabaseFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  if (secretKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${secretKey}`) {
    headers.delete("Authorization");
  }
  headers.set("apikey", secretKey);
  return fetch(input, { ...init, headers });
};

export const supabaseAdmin = createClient(SUPABASE_URL, secretKey, {
  global: { fetch: supabaseFetch },
  auth: { persistSession: false, autoRefreshToken: false },
});
