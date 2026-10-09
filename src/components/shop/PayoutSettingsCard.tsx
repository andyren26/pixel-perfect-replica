import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { BANKS } from "@/lib/banks";
import { isOnboarded, type Profile } from "@/lib/profile";
import { cardCls, hintCls, inputCls, labelCls, primaryBtn } from "@/lib/ui";

type Props = { profile: Profile; onSaved: () => void };

// Shop-level payout settings, written to the caller's own profiles row.
// Shop name + bank + account name + account number are all required to save.
export default function PayoutSettingsCard({ profile, onSaved }: Props) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bankCode, setBankCode] = useState(profile.bank_account_bank_code ?? "");
  const [accountName, setAccountName] = useState(profile.bank_account_name ?? "");
  const [accountNumber, setAccountNumber] = useState(profile.bank_account_number ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Keep a saved code selectable even if it is no longer in the list.
  const bankOptions =
    bankCode && !BANKS.some((b) => b.code === bankCode)
      ? [{ code: bankCode, name: "（其他 / other）" }, ...BANKS]
      : BANKS;

  const complete = [displayName, bankCode, accountName, accountNumber].every(
    (v) => v.trim() !== "",
  );
  const done = isOnboarded(profile);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!complete) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        bank_account_bank_code: bankCode,
        bank_account_name: accountName.trim(),
        bank_account_number: accountNumber.trim(),
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) return setMessage({ ok: false, text: error.message });
    setMessage({ ok: true, text: "已儲存 / Saved" });
    onSaved();
  }

  return (
    <section className={cardCls}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-3xl">撥款設定 / Payout settings</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${done ? "bg-secondary" : "bg-accent"}`}
        >
          {done
            ? "✓ 開店資料已完成 / Onboarding complete"
            : "尚未完成 / Required to finish shop signup"}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        店名與收款帳戶由這間店的所有理髮師共用。先用測試資料即可 / use test data first.
      </p>
      <form onSubmit={save} className="mt-6 grid gap-5 md:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="display_name">
            店名 / Shop name *
          </label>
          <input
            id="display_name"
            required
            className={inputCls}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Downtown Cuts"
          />
          <p className={hintCls}>
            你的理髮店名稱，會顯示在撥款紀錄上 / your shop's name, shown on payout records
          </p>
        </div>
        <div>
          <label className={labelCls} htmlFor="bank_account_bank_code">
            銀行 / Bank *
          </label>
          <select
            id="bank_account_bank_code"
            required
            className={inputCls}
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
          >
            <option value="" disabled>
              選擇銀行 / Select a bank
            </option>
            {bankOptions.map((b) => (
              <option key={b.code} value={b.code}>
                {b.code} {b.name}
              </option>
            ))}
          </select>
          <p className={hintCls}>收款帳戶所在的銀行（含代號）/ the bank holding the account</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="bank_account_name">
            匯款戶名 / Account name *
          </label>
          <input
            id="bank_account_name"
            required
            className={inputCls}
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
          <p className={hintCls}>
            你的理髮店收款的銀行帳戶 / the bank account where your shop gets paid
          </p>
        </div>
        <div>
          <label className={labelCls} htmlFor="bank_account_number">
            匯款帳號 / Account number *
          </label>
          <input
            id="bank_account_number"
            required
            inputMode="numeric"
            className={inputCls}
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
          />
          <p className={hintCls}>
            只有你和平台管理員看得到 / visible only to you and the platform admin
          </p>
        </div>
        <div className="flex items-center gap-3 md:col-span-2">
          <button className={primaryBtn} disabled={!complete || saving}>
            {saving ? "儲存中…" : "儲存 / Save"}
          </button>
          {message && (
            <span
              className={`text-sm ${message.ok ? "text-muted-foreground" : "text-destructive"}`}
            >
              {message.text}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
