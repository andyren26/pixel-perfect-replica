import { useMemo, useState } from "react";
import { Link, useLoaderData } from "react-router";
import { MapPin, Scissors, Search } from "lucide-react";

import AppHeader from "@/components/AppHeader";
import { useHead } from "@/hooks/use-head";
import { CATEGORIES, CATEGORY_LABEL, photoUrl, repPhoto, useBarberDirectory } from "@/lib/booking";
import { formatMoney, usePlatformSettings } from "@/lib/platform";
import type { Session } from "@/lib/profile";

const head = [
  { title: "找理髮師 — Barberly" },
  { name: "description", content: "瀏覽理髮師、看作品照，線上預約時段。" },
  { property: "og:title", content: "找理髮師 — Barberly" },
  { property: "og:description", content: "瀏覽理髮師、看作品照，線上預約時段。" },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary" },
];

// /barbers: public marketplace grid of every barber, with search + category chips.
export default function Barbers() {
  useHead(head);
  const session = useLoaderData() as Session | null;
  const { data: settings } = usePlatformSettings();
  const { data: barbers = [], isLoading, error } = useBarberDirectory();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return barbers.filter((b) => {
      const matchesText =
        !q || [b.name, b.address, b.intro].some((v) => v?.toLowerCase().includes(q));
      const matchesCategory = category === "all" || b.services.some((s) => s.category === category);
      return matchesText && matchesCategory;
    });
  }, [barbers, query, category]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={session?.user.email} profile={session?.profile ?? null} />
      <main className="mx-auto max-w-7xl px-6 pt-4 pb-24 animate-fade-up">
        <section className="hem rounded-3xl bg-cream px-6 py-10 text-center md:py-14">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Find your stylist
          </p>
          <h1 className="mt-3 text-4xl md:text-6xl">找一位對的理髮師</h1>
          <div className="mx-auto mt-8 flex max-w-xl items-center gap-3 rounded-full border bg-card px-5 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋理髮師名稱或地址 / Search by name or address"
              className="w-full bg-transparent text-sm outline-none"
              aria-label="搜尋理髮師"
            />
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2" role="tablist">
            {(["all", ...CATEGORIES] as const).map((c) => (
              <button
                key={c}
                role="tab"
                aria-selected={category === c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-4 py-1.5 text-sm transition ${category === c ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
              >
                {c === "all" ? "All 全部" : CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="text-4xl">理髮師 / Barbers</h2>
            {!isLoading && (
              <span className="text-sm text-muted-foreground">{visible.length} 位</span>
            )}
          </div>

          {error ? (
            <p className="mt-8 text-sm text-destructive">
              無法載入理髮師清單 / Could not load barbers.
            </p>
          ) : isLoading ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-80 animate-pulse rounded-2xl bg-secondary" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="mt-8 rounded-3xl border bg-card p-10 text-center text-muted-foreground">
              {barbers.length === 0
                ? "還沒有理髮師上架 / No barbers yet."
                : "沒有符合條件的理髮師，換個關鍵字或分類試試 / No barbers match."}
            </div>
          ) : (
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {visible.map((b) => {
                const photo = repPhoto(b.barber_photos);
                const cats = CATEGORIES.filter((c) => b.services.some((s) => s.category === c));
                const from = b.services.length ? Math.min(...b.services.map((s) => s.price)) : null;
                return (
                  <li key={b.id}>
                    <Link
                      to={`/barbers/${b.id}`}
                      className="lift block h-full overflow-hidden rounded-2xl border bg-card"
                    >
                      {photo ? (
                        <img
                          src={photoUrl(photo.storage_path)}
                          alt={`${b.name} 的作品`}
                          className="aspect-square w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center bg-sand">
                          <Scissors className="h-10 w-10 text-muted-foreground/60" />
                        </div>
                      )}
                      <div className="p-5">
                        <h3 className="text-2xl font-semibold">{b.name}</h3>
                        {b.address && (
                          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{b.address}</span>
                          </p>
                        )}
                        {b.intro && (
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                            {b.intro}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {cats.map((c) => (
                            <span
                              key={c}
                              className="rounded-full bg-secondary px-2.5 py-0.5 text-xs"
                            >
                              {CATEGORY_LABEL[c]}
                            </span>
                          ))}
                        </div>
                        <p className="mt-4 text-sm">
                          {from !== null ? (
                            <>
                              <strong>{formatMoney(from, settings)}</strong> 起
                            </>
                          ) : (
                            <span className="text-muted-foreground">服務即將上架</span>
                          )}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
