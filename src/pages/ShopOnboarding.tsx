import { useState } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

import AppHeader from "@/components/AppHeader";
import ConfirmButton from "@/components/ConfirmButton";
import BarberForm, { type BarberFields } from "@/components/shop/BarberForm";
import PayoutSettingsCard from "@/components/shop/PayoutSettingsCard";
import PhotoManager from "@/components/shop/PhotoManager";
import { useHead } from "@/hooks/use-head";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { myBarbersKey, useMyBarbers } from "@/lib/barbers";
import { isOnboarded, type Session } from "@/lib/profile";
import { cardCls, ghostBtn, primaryBtn } from "@/lib/ui";

const head = [
  { title: "My shop — Barberly" },
  { name: "description", content: "Set up your barber shop on Barberly." },
];

type Barber = Tables<"barbers">;

// Shop onboarding at /shop: payout settings + my barbers + sample photos.
export default function ShopOnboarding() {
  useHead(head);
  const { user, profile } = useLoaderData() as Session;
  const revalidator = useRevalidator();
  const qc = useQueryClient();
  const { data: barbers = [], isLoading } = useMyBarbers(profile.id);
  const [adding, setAdding] = useState(false);
  const onboarded = isOnboarded(profile);

  const refresh = () => qc.invalidateQueries({ queryKey: myBarbersKey(profile.id) });

  async function createBarber(fields: BarberFields) {
    const { error } = await supabase.from("barbers").insert({ ...fields, shop_id: profile.id });
    if (error) return error.message;
    setAdding(false);
    refresh();
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={user.email} profile={profile} />
      <main className="mx-auto max-w-5xl space-y-8 px-6 pt-6 pb-24 animate-fade-up">
        <div className="rounded-3xl bg-cream p-8 md:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Shop onboarding
          </p>
          <h1 className="mt-3 text-4xl md:text-5xl">
            {profile.display_name || "理髮店上架 / Set up your shop"}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            填好店名與收款帳戶、建立理髮師與作品照，再到「服務與時段」設定價目並發布可預約時段。
          </p>
          <div className="mt-6">
            {onboarded && barbers.length > 0 ? (
              <Link to="/shop/bookings" className={primaryBtn}>
                管理服務與時段 / Services & slots →
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">
                {onboarded
                  ? "新增至少一位理髮師後，就能設定服務與時段。"
                  : "先完成下方的撥款設定（店名＋銀行資訊）才算開店完成。"}
              </p>
            )}
          </div>
        </div>

        <PayoutSettingsCard profile={profile} onSaved={() => revalidator.revalidate()} />

        <section className={cardCls}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-3xl">我的理髮師 / My barbers</h2>
            {!adding && (
              <button className={ghostBtn} onClick={() => setAdding(true)}>
                ＋ 新增一位理髮師 / Add {barbers.length ? "another" : "a"} barber
              </button>
            )}
          </div>
          {adding && (
            <div className="mt-6 rounded-2xl bg-cream p-5">
              <BarberForm
                submitLabel="新增 / Add barber"
                onSubmit={createBarber}
                onCancel={() => setAdding(false)}
              />
            </div>
          )}
          {isLoading ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
          ) : barbers.length === 0 && !adding ? (
            <p className="mt-6 text-sm text-muted-foreground">
              還沒有理髮師。一間店可以有很多位理髮師 / A shop can run many barbers.
            </p>
          ) : (
            <ul className="mt-6 space-y-6">
              {barbers.map((b) => (
                <BarberItem key={b.id} barber={b} onChanged={refresh} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function BarberItem({ barber, onChanged }: { barber: Barber; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(fields: BarberFields) {
    const { error } = await supabase.from("barbers").update(fields).eq("id", barber.id);
    if (error) return error.message;
    setEditing(false);
    onChanged();
    return null;
  }

  async function remove() {
    // Remove this barber's photo files first; rows cascade with the barber.
    const { data: photos } = await supabase
      .from("barber_photos")
      .select("storage_path")
      .eq("barber_id", barber.id);
    if (photos?.length)
      await supabase.storage.from("barber-photos").remove(photos.map((p) => p.storage_path));
    const { error } = await supabase.from("barbers").delete().eq("id", barber.id);
    if (error) return setError(error.message);
    onChanged();
  }

  return (
    <li className="rounded-2xl border p-5">
      {editing ? (
        <BarberForm
          initial={barber}
          submitLabel="儲存 / Save"
          onSubmit={save}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-semibold">{barber.name}</h3>
            {barber.address && <p className="text-sm text-muted-foreground">{barber.address}</p>}
            {barber.intro && (
              <p className="mt-2 max-w-2xl whitespace-pre-line text-sm">{barber.intro}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button className={ghostBtn} onClick={() => setEditing(true)}>
              編輯 / Edit
            </button>
            <ConfirmButton label="刪除 / Delete" onConfirm={remove} />
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="mt-5 border-t pt-5">
        <PhotoManager barberId={barber.id} />
      </div>
    </li>
  );
}
