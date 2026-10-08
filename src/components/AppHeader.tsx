import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router";

import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/profile";

type Props = { email: string | undefined; profile: Profile; children?: ReactNode };

// Signed-in header shared by the customer and shop pages.
export default function AppHeader({ email, profile, children }: Props) {
  const navigate = useNavigate();
  const isShop = profile.role === "shop";

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/sign-in", { replace: true });
  }

  const tab = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-1.5 transition ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <header className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-5">
      <Link to="/" className="font-serif text-3xl font-semibold">
        Barberly
      </Link>
      {isShop && (
        <nav className="flex items-center gap-1 text-sm">
          <NavLink to="/shop" end className={tab}>
            我的理髮店 / Shop
          </NavLink>
          <NavLink to="/shop/bookings" className={tab}>
            服務與時段 / Bookings
          </NavLink>
        </nav>
      )}
      <div className="ml-auto flex items-center gap-3 text-sm">
        <span className="hidden sm:inline">Hi {email}</span>
        {isShop && (
          <span className="rounded-full bg-accent px-3 py-0.5 text-xs font-medium">barber</span>
        )}
        {children}
        <button
          onClick={signOut}
          className="rounded-full bg-primary px-5 py-2 text-primary-foreground hover:opacity-90"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
