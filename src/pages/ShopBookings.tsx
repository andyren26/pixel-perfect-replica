import { useState } from "react";
import { Link, useLoaderData } from "react-router";

import AppHeader from "@/components/AppHeader";
import ServicesEditor from "@/components/shop/ServicesEditor";
import SlotPublisher from "@/components/shop/SlotPublisher";
import { useHead } from "@/hooks/use-head";
import { useMyBarbers } from "@/lib/barbers";
import { isOnboarded, type Session } from "@/lib/profile";
import { primaryBtn } from "@/lib/ui";

const head = [
  { title: "服務與時段 — Barberly" },
  { name: "description", content: "管理你的服務項目和可預約時段。" },
];

// /shop/bookings: per-barber service & price editor + slot publisher.
export default function ShopBookings() {
  useHead(head);
  const { user, profile } = useLoaderData() as Session;
  const { data: barbers = [], isLoading } = useMyBarbers(profile.id);
  const [selected, setSelected] = useState<string | null>(null);
  const barber = barbers.find((b) => b.id === selected) ?? barbers[0];
  const ready = isOnboarded(profile) && barbers.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={user.email} profile={profile} />
      <main className="mx-auto max-w-5xl space-y-8 px-6 pt-6 pb-24 animate-fade-up">
        <div className="hem rounded-3xl bg-cream p-8 md:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Shop · Bookings
          </p>
          <h1 className="mt-3 text-4xl md:text-5xl">服務與時段</h1>
          {ready && (
            <div className="mt-6 flex flex-wrap gap-2" role="tablist">
              {barbers.map((b) => (
                <button
                  key={b.id}
                  role="tab"
                  aria-selected={b.id === barber?.id}
                  onClick={() => setSelected(b.id)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${b.id === barber?.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">載入中…</p>
        ) : !ready || !barber ? (
          <div className="rounded-3xl border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              {isOnboarded(profile)
                ? "先新增至少一位理髮師。"
                : "先完成開店資料（店名＋銀行資訊）並新增理髮師。"}
            </p>
            <Link to="/shop" className={`${primaryBtn} mt-5 inline-block`}>
              前往我的理髮店 / Go to shop setup
            </Link>
          </div>
        ) : (
          <>
            <ServicesEditor key={`svc-${barber.id}`} barberId={barber.id} />
            <SlotPublisher key={`slot-${barber.id}`} barberId={barber.id} />
          </>
        )}
      </main>
    </div>
  );
}
