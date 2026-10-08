import { useState } from "react";

import type { Tables } from "@/integrations/supabase/types";
import { ghostBtn, inputCls, labelCls, primaryBtn, textareaCls } from "@/lib/ui";

export type BarberFields = Pick<Tables<"barbers">, "name" | "intro" | "address">;

type Props = {
  initial?: BarberFields;
  submitLabel: string;
  onSubmit: (fields: BarberFields) => Promise<string | null>;
  onCancel?: () => void;
};

// Create / edit form for one barber profile (name required; intro + address optional).
export default function BarberForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [intro, setIntro] = useState(initial?.intro ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const err = await onSubmit({
      name: name.trim(),
      intro: intro.trim() || null,
      address: address.trim() || null,
    });
    setSaving(false);
    if (err) return setError(err);
    if (!initial) {
      setName("");
      setIntro("");
      setAddress("");
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      <div>
        <label className={labelCls}>名稱 / Name *</label>
        <input
          required
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Marco Ruiz"
        />
      </div>
      <div>
        <label className={labelCls}>地址 / Address</label>
        <input
          className={inputCls}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="台北市大安區…"
        />
      </div>
      <div className="md:col-span-2">
        <label className={labelCls}>簡介 / Intro</label>
        <textarea
          rows={3}
          className={textareaCls}
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          placeholder="簡短介紹一下這位理髮師 / a short bio"
        />
      </div>
      <div className="flex items-center gap-2 md:col-span-2">
        <button className={primaryBtn} disabled={saving || !name.trim()}>
          {saving ? "儲存中…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className={ghostBtn} onClick={onCancel}>
            取消 / Cancel
          </button>
        )}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </form>
  );
}
