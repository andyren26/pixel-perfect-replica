import { useMemo, useState } from "react";
import { Link, useLoaderData, useLocation, useNavigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin } from "lucide-react";

import AppHeader from "@/components/AppHeader";
import BookingDialog from "@/components/booking/BookingDialog";
import PhotoCarousel from "@/components/booking/PhotoCarousel";
import { useHead } from "@/hooks/use-head";
import {
  CATEGORY_LABEL,
  TZ_LABEL,
  availableSlotsKey,
  dayKey,
  fmtDay,
  fmtTime,
  useBarber,
  useBarberSlots,
} from "@/lib/booking";
import { formatMoney, usePlatformSettings } from "@/lib/platform";
import { signInPath, type Session } from "@/lib/profile";
import { cardCls, primaryBtn } from "@/lib/ui";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// /barbers/:id — public barber detail (photos, services, open slots) + the Book
// dialog. Booking never navigates away: the dialog closes back onto this page.
export default function BarberDetail() {
  const session = useLoaderData() as Session | null;
  const { id: rawId } = useParams();
  const id = rawId && UUID.test(rawId) ? rawId : undefined;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const { data: settings } = usePlatformSettings();
  const { data: barber, isLoading } = useBarber(id);
  const { data: slots = [] } = useBarberSlots(id);
  const [open, setOpen] = useState(false);
  const [initialDay, setInitialDay] = useState<string | null>(null);

  useHead([
    { title: barber ? `${barber.name} — Barberly` : "Barber — Barberly" },
    { name: "description", content: barber?.intro ?? "Book a barber on Barberly." },
  ]);

  const services = useMemo(
    () => [...(barber?.services ?? [])].sort((a, b) => a.price - b.price),
    [barber],
  );
  const freeByDay = useMemo(() => {
    const out = new Map<string, typeof slots>();
    for (const s of slots) {
      if (s.held) continue;
      const k = dayKey(s.starts_at);
      out.set(k, [...(out.get(k) ?? []), s]);
    }
    return out;
  }, [slots]);

  const isShop = session?.profile.role === "shop";

  function book(day: string | null = null) {
    if (!session) return navigate(signInPath(pathname));
    setInitialDay(day);
    setOpen(true);
  }

  if (!isLoading && !barber) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader email={session?.user.email} profile={session?.profile ?? null} />
        <main className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h1 className="text-4xl">找不到這位理髮師 / Barber not found</h1>
          <Link to="/barbers" className={`${primaryBtn} mt-8 inline-block`}>
            回到理髮師列表 / All barbers
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={session?.user.email} profile={session?.profile ?? null} />
      <main className="mx-auto max-w-6xl px-6 pt-2 pb-24 animate-fade-up">
        <Link
          to="/barbers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> 所有理髮師 / All barbers
        </Link>

        {isLoading || !barber ? (
          <div className="mt-6 grid gap-10 md:grid-cols-2">
            <div className="aspect-[4/3] animate-pulse rounded-3xl bg-secondary" />
            <div className="h-64 animate-pulse rounded-3xl bg-secondary" />
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-10 md:grid-cols-2">
              <PhotoCarousel photos={barber.barber_photos} barberName={barber.name} />

              <div>
                <h1 className="text-5xl">{barber.name}</h1>
                {barber.address && (
                  <p className="mt-3 flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" /> {barber.address}
                  </p>
                )}
                {services[0] && (
                  <p className="mt-4 text-lg">
                    from <strong>{formatMoney(services[0].price, settings)}</strong>
                  </p>
                )}
                {barber.intro && (
                  <p className="mt-5 leading-relaxed whitespace-pre-line text-muted-foreground">
                    {barber.intro}
                  </p>
                )}

                <div className="mt-8">
                  {isShop ? (
                    <p className="rounded-2xl bg-cream p-4 text-sm">
                      店家帳號無法預約，請用顧客帳號登入預約。
                      <br />
                      Shop accounts can't book — sign in with a customer account.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => book()}
                      disabled={services.length === 0}
                      className={`${primaryBtn} w-full py-3.5 text-base sm:w-auto sm:px-10`}
                    >
                      {session ? "Book 預約" : "登入後預約 / Sign in to book"}
                    </button>
                  )}
                </div>

                <section className="mt-10">
                  <h2 className="text-3xl">服務 / Services</h2>
                  {services.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      服務即將上架 / Coming soon.
                    </p>
                  ) : (
                    <ul className="mt-4 divide-y rounded-2xl border bg-card">
                      {services.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-4 p-4">
                          <div>
                            <p className="font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {CATEGORY_LABEL[s.category] ?? s.category} ·{" "}
                              {s.required_slots * (settings?.slot_minutes ?? 30)} 分鐘
                            </p>
                          </div>
                          <span className="font-semibold">{formatMoney(s.price, settings)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>

            <section className={`${cardCls} mt-12`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-3xl">可預約時段 / Available slots</h2>
                <span className="text-xs text-muted-foreground">{TZ_LABEL}</span>
              </div>
              {freeByDay.size === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  目前沒有開放的時段，晚點再來看看 / No open slots right now.
                </p>
              ) : (
                <div className="mt-6 space-y-5">
                  {[...freeByDay.entries()].map(([k, list]) => (
                    <div key={k}>
                      <h3 className="mb-2 font-medium">{list[0] && fmtDay(list[0].starts_at)}</h3>
                      <div className="flex flex-wrap gap-2">
                        {list.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            disabled={isShop || services.length === 0}
                            onClick={() => book(k)}
                            className="rounded-full border bg-background px-3.5 py-1.5 text-sm tabular-nums transition hover:bg-secondary disabled:cursor-default disabled:hover:bg-background"
                          >
                            {fmtTime(s.starts_at)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {barber && (
        <BookingDialog
          open={open}
          onOpenChange={setOpen}
          barberName={barber.name}
          services={services}
          slots={slots}
          initialDay={initialDay}
          onBooked={() => qc.invalidateQueries({ queryKey: availableSlotsKey(barber.id) })}
        />
      )}
    </div>
  );
}
