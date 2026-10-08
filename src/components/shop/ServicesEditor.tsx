import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import ConfirmButton from "@/components/ConfirmButton";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatMoney, usePlatformSettings } from "@/lib/platform";
import { cardCls, ghostBtn, inputCls, labelCls, primaryBtn } from "@/lib/ui";

type Service = Tables<"services">;
const CATEGORIES = ["cut", "color", "perm", "beard"] as const;
const CATEGORY_LABEL: Record<string, string> = {
  cut: "Cut 剪髮",
  color: "Color 染髮",
  perm: "Perm 燙髮",
  beard: "Beard 修鬍",
};

type Fields = Pick<Service, "name" | "category" | "price" | "required_slots">;
const EMPTY: Fields = { name: "", category: "cut", price: 0, required_slots: 1 };

// Services & price editor for one barber. price = whole units of platform currency.
export default function ServicesEditor({ barberId }: { barberId: string }) {
  const qc = useQueryClient();
  const { data: settings } = usePlatformSettings();
  const key = ["services", barberId];
  const { data: services = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("barber_id", barberId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function create(f: Fields) {
    const { error } = await supabase.from("services").insert({ ...f, barber_id: barberId });
    if (error) return error.message;
    refresh();
    return null;
  }
  async function save(id: string, f: Fields) {
    const { error } = await supabase.from("services").update(f).eq("id", id);
    if (error) return error.message;
    setEditingId(null);
    refresh();
    return null;
  }
  async function remove(id: string) {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) setError(error.message);
    refresh();
  }

  const slotMinutes = settings?.slot_minutes ?? 30;

  return (
    <section className={cardCls}>
      <h2 className="text-3xl">服務與價格 / Services & prices</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        價格以整數儲存（{(settings?.currency ?? "twd").toUpperCase()}），例如 300 就是{" "}
        {formatMoney(300, settings)}。 一個時段是 {slotMinutes}{" "}
        分鐘，「所需時段數」是這個服務需要幾個連續時段。
      </p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <ul className="mt-6 divide-y">
        {services.length === 0 && (
          <li className="py-3 text-sm text-muted-foreground">還沒有服務 / No services yet.</li>
        )}
        {services.map((s) =>
          editingId === s.id ? (
            <li key={s.id} className="py-4">
              <ServiceForm
                initial={s}
                submitLabel="儲存 / Save"
                onSubmit={(f) => save(s.id, f)}
                onCancel={() => setEditingId(null)}
                slotMinutes={slotMinutes}
              />
            </li>
          ) : (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="mr-2 rounded-full bg-secondary px-2.5 py-0.5 text-xs">
                    {CATEGORY_LABEL[s.category] ?? s.category}
                  </span>
                  {s.required_slots} 個時段（{s.required_slots * slotMinutes} 分鐘）
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{formatMoney(s.price, settings)}</span>
                <button className={ghostBtn} onClick={() => setEditingId(s.id)}>
                  編輯
                </button>
                <ConfirmButton label="刪除" onConfirm={() => remove(s.id)} />
              </div>
            </li>
          ),
        )}
      </ul>
      <div className="mt-6 rounded-2xl bg-cream p-5">
        <h3 className="mb-4 font-medium">＋ 新增服務 / Add a service</h3>
        <ServiceForm
          initial={EMPTY}
          submitLabel="新增 / Add"
          onSubmit={create}
          slotMinutes={slotMinutes}
          resetOnSuccess
        />
      </div>
    </section>
  );
}

type FormProps = {
  initial: Fields;
  submitLabel: string;
  onSubmit: (f: Fields) => Promise<string | null>;
  onCancel?: () => void;
  slotMinutes: number;
  resetOnSuccess?: boolean;
};

function ServiceForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  slotMinutes,
  resetOnSuccess,
}: FormProps) {
  const [f, setF] = useState<Fields>({
    name: initial.name,
    category: initial.category,
    price: initial.price,
    required_slots: initial.required_slots,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid =
    f.name.trim() !== "" &&
    Number.isInteger(f.price) &&
    f.price >= 0 &&
    Number.isInteger(f.required_slots) &&
    f.required_slots >= 1;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    const err = await onSubmit({ ...f, name: f.name.trim() });
    setSaving(false);
    if (err) return setError(err);
    if (resetOnSuccess) setF(EMPTY);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className={labelCls}>名稱 / Name</label>
        <input
          required
          className={inputCls}
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          placeholder="經典剪髮"
        />
      </div>
      <div>
        <label className={labelCls}>分類 / Category</label>
        <select
          className={inputCls}
          value={f.category}
          onChange={(e) => setF({ ...f, category: e.target.value })}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>價格 / Price</label>
        <input
          required
          type="number"
          min={0}
          step={1}
          className={inputCls}
          value={f.price}
          onChange={(e) => setF({ ...f, price: Math.trunc(Number(e.target.value)) })}
        />
      </div>
      <div>
        <label className={labelCls}>所需時段數 / Slots</label>
        <input
          required
          type="number"
          min={1}
          step={1}
          className={inputCls}
          value={f.required_slots}
          onChange={(e) => setF({ ...f, required_slots: Math.trunc(Number(e.target.value)) })}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          = {f.required_slots * slotMinutes} 分鐘
        </p>
      </div>
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
        <button className={primaryBtn} disabled={!valid || saving}>
          {saving ? "儲存中…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className={ghostBtn} onClick={onCancel}>
            取消
          </button>
        )}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </form>
  );
}
