import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { errMessage } from "@/lib/errors";
import { signInPath, type Profile } from "@/lib/profile";

type Props = { email: string | undefined; profile: Profile | null; children?: ReactNode };

// Header shared by every app page. Shops see their dashboard tabs, customers see
// browse + my bookings, signed-out visitors (public /barbers pages) see Sign In.
export default function AppHeader({ email, profile, children }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const isShop = profile?.role === "shop";
  const isCustomer = profile?.role === "customer";
  const isAdmin = profile?.role === "admin";

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/sign-in", { replace: true });
  }

  async function becomeShop() {
    setBusy(true);
    const { data, error } = await supabase.rpc("become_shop");
    setBusy(false);
    if (error || data !== "shop") {
      setConfirming(false);
      toast.error(errMessage(error, "無法把這個帳號改成店家。"));
      return;
    }
    navigate("/shop", { replace: true });
  }

  const tab = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-1.5 transition ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <header className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-5">
      <Link to="/" className="font-serif text-3xl font-semibold">
        Barberly
      </Link>
      <nav className="flex items-center gap-1 text-sm">
        {isShop ? (
          <>
            <NavLink to="/shop" end className={tab}>
              我的理髮店 / Shop
            </NavLink>
            <NavLink to="/shop/bookings" className={tab}>
              服務與時段 / Bookings
            </NavLink>
            <NavLink to="/shop/earnings" className={tab}>
              收入 / Earnings
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/barbers" className={tab}>
              找理髮師 / Barbers
            </NavLink>
            {isCustomer && (
              <NavLink to="/bookings" className={tab}>
                我的預約 / My bookings
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/admin/payouts" className={tab}>
                撥款管理 / Payouts
              </NavLink>
            )}
          </>
        )}
      </nav>
      <div className="ml-auto flex items-center gap-3 text-sm">
        {profile ? (
          <>
            <span className="hidden sm:inline">嗨，{email || profile.display_name || "會員"}</span>
            {isShop && (
              <span className="rounded-full bg-accent px-3 py-0.5 text-xs font-medium">店家</span>
            )}
            {isAdmin && (
              <span className="rounded-full bg-accent px-3 py-0.5 text-xs font-medium">管理員</span>
            )}
            {children}
            {isCustomer &&
              (confirming ? (
                // Upgrading is one-way (there's no shop -> customer path), so ask first.
                <span className="hidden items-center gap-1 rounded-full border border-primary py-1 pr-1 pl-4 md:inline-flex">
                  <span>把這個帳號改成店家？</span>
                  <button
                    onClick={becomeShop}
                    disabled={busy}
                    className="rounded-full bg-primary px-4 py-1 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                  >
                    {busy ? "處理中…" : "確定開店"}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    disabled={busy}
                    className="rounded-full px-3 py-1 text-muted-foreground hover:bg-secondary"
                  >
                    取消
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirming(true)}
                  className="hidden rounded-full border border-primary px-5 py-2 font-medium transition hover:bg-secondary md:inline-block"
                >
                  開店 / Become a shop
                </button>
              ))}
            <button
              onClick={signOut}
              className="rounded-full bg-primary px-5 py-2 text-primary-foreground hover:opacity-90"
            >
              登出
            </button>
          </>
        ) : (
          <Link
            to={signInPath(pathname)}
            className="rounded-full bg-primary px-6 py-2 font-medium text-primary-foreground hover:opacity-90"
          >
            登入
          </Link>
        )}
      </div>
    </header>
  );
}
