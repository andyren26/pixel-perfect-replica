import { Link } from "react-router";
import { Search, BadgeCheck, Zap, ShieldCheck, Star } from "lucide-react";
import heroLeft from "@/assets/hero-left.jpg";
import heroRight from "@/assets/hero-right.jpg";
import barbersImg from "@/assets/barbers.jpg";
import { useHead } from "@/hooks/use-head";

const head = [
  { title: "Barberly — 自信髮型，從預約開始" },
  { name: "description", content: "找到你附近的認證理髮師，幾個步驟就能完成預約。" },
  { property: "og:title", content: "Barberly — 自信髮型，從預約開始" },
  { property: "og:description", content: "找到你附近的認證理髮師，幾個步驟就能完成預約。" },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary_large_image" },
];

const chips = ["全部", "剪髮", "染髮", "燙髮", "修鬍"];
const logos = ["MAISON", "Atelier Nº5", "CROWN & CO", "Loft Salon", "BLADE", "Ivory"];
const features = [
  { icon: BadgeCheck, label: "認證理髮師", en: "Verified Barbers" },
  { icon: Zap, label: "即時預約", en: "Instant Booking" },
  { icon: ShieldCheck, label: "安全付款", en: "Secure Payment" },
  { icon: Star, label: "高評價髮型", en: "Top-Rated Styles" },
];
const barbers = [
  {
    name: "Marco Ruiz",
    shop: "Crown & Co · 大安區",
    services: ["剪髮", "修鬍"],
    rating: 4.9,
    reviews: 212,
    price: 600,
    pos: "0% 0%",
  },
  {
    name: "Jaylen Brooks",
    shop: "Blade Studio · 信義區",
    services: ["剪髮", "染髮"],
    rating: 4.8,
    reviews: 168,
    price: 800,
    pos: "100% 0%",
  },
  {
    name: "Tom Hayes",
    shop: "Loft Salon · 中山區",
    services: ["剪髮", "燙髮", "修鬍"],
    rating: 4.9,
    reviews: 301,
    price: 700,
    pos: "0% 100%",
  },
  {
    name: "Sofia Lin",
    shop: "Ivory Hair · 松山區",
    services: ["染髮", "燙髮"],
    rating: 5.0,
    reviews: 129,
    price: 1200,
    pos: "100% 100%",
  },
];

// Small English line paired with a Chinese heading (the bilingual landing look).
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
      {children}
    </p>
  );
}

export default function Index() {
  useHead(head);
  return (
    <div className="min-h-screen bg-background">
      <nav className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-5">
        <Link to="/" className="font-serif text-3xl font-semibold tracking-tight">
          Barberly
        </Link>
        <div className="mx-auto hidden w-full max-w-sm items-center gap-2 rounded-full border bg-card px-4 py-2 md:flex">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input placeholder="搜尋" className="w-full bg-transparent text-sm outline-none" />
        </div>
        <Link
          to="/sign-in"
          className="ml-auto rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 md:ml-0"
        >
          登入
        </Link>
      </nav>

      <section className="mx-auto max-w-7xl px-6 pt-6 pb-16">
        <div className="hem grid items-center gap-6 rounded-3xl bg-cream p-6 md:grid-cols-[1fr_1.4fr_1fr] md:p-10">
          <img
            src={heroLeft}
            alt="俐落的紋理短髮"
            width={768}
            height={1024}
            className="hidden aspect-[3/4] w-full rounded-2xl object-cover md:block animate-fade-up"
          />
          <div className="py-10 text-center animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <Eyebrow>全新造型 · New Look</Eyebrow>
            <h1 className="mt-4 text-5xl leading-[1.15] font-medium md:text-7xl">
              自信髮型
              <br />
              展現你的風格
            </h1>
            <p className="mt-3 font-serif text-lg text-muted-foreground italic">
              Style with Confident Hair
            </p>
            <div className="mx-auto mt-8 flex max-w-md items-center gap-2 rounded-full bg-card p-1.5 pl-5 shadow-sm">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                placeholder="找理髮師或搜尋髮型"
                className="w-full bg-transparent text-sm outline-none"
              />
              <button className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground">
                搜尋
              </button>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {chips.map((c, i) => (
                <button
                  key={c}
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${i === 0 ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <img
            src={heroRight}
            alt="光澤感波浪鮑伯頭"
            width={768}
            height={1024}
            className="hidden aspect-[3/4] w-full rounded-2xl object-cover md:block animate-fade-up"
            style={{ animationDelay: "0.2s" }}
          />
        </div>
      </section>

      <section className="border-y bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-around gap-6 px-6 py-8">
          {logos.map((l) => (
            <span key={l} className="font-serif text-2xl text-muted-foreground/70">
              {l}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 text-center">
        <Eyebrow>Best booking experience</Eyebrow>
        <h2 className="mt-3 text-4xl md:text-5xl">最好的預約體驗</h2>
        <div className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-4">
          {features.map(({ icon: Icon, label, en }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-3 rounded-2xl bg-cream p-8 text-center"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-card">
                <Icon className="h-6 w-6" />
              </span>
              <span className="font-medium">{label}</span>
              <span className="-mt-2 text-xs text-muted-foreground">{en}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <Eyebrow>Popular</Eyebrow>
        <h2 className="mt-3 text-4xl md:text-5xl">人氣理髮師</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {barbers.map((b) => (
            <Link
              key={b.name}
              to="/barbers"
              className="lift block overflow-hidden rounded-2xl border bg-card"
            >
              <div className="relative">
                <div
                  className="aspect-square w-full bg-sand"
                  style={{
                    backgroundImage: `url(${barbersImg})`,
                    backgroundSize: "200% 200%",
                    backgroundPosition: b.pos,
                  }}
                  role="img"
                  aria-label={b.name}
                />
                <span className="absolute top-3 left-3 rounded-full bg-card px-3 py-1 text-xs font-medium">
                  人氣
                </span>
              </div>
              <div className="p-5">
                <h3 className="text-2xl font-semibold">{b.name}</h3>
                <p className="text-sm text-muted-foreground">{b.shop}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {b.services.map((s) => (
                    <span key={s} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">
                      {s}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-current" />
                    {b.rating} <span className="text-muted-foreground">({b.reviews} 則評價)</span>
                  </span>
                  <span>
                    <strong>NT${b.price.toLocaleString()}</strong> 起
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © 2026 Barberly
      </footer>
    </div>
  );
}
