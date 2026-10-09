import {
  Navigate,
  Outlet,
  createBrowserRouter,
  redirect,
  type LoaderFunctionArgs,
  type RouteObject,
} from "react-router";

import Index from "@/pages/Index";
import AuthPage from "@/pages/Auth";
import Barbers from "@/pages/Barbers";
import BarberDetail from "@/pages/BarberDetail";
import MyBookings from "@/pages/MyBookings";
import BookingSuccess from "@/pages/BookingSuccess";
import ShopOnboarding from "@/pages/ShopOnboarding";
import ShopBookings from "@/pages/ShopBookings";
import ShopEarnings from "@/pages/ShopEarnings";
import AdminPayouts from "@/pages/AdminPayouts";
import { ErrorComponent, NotFoundComponent } from "@/pages/RootErrors";
import { getSession, signInPath } from "@/lib/profile";

const currentPath = (request: Request) => {
  const url = new URL(request.url);
  return url.pathname + url.search;
};

// Signed-in guard: user + their profiles row (role comes from profiles.role).
// Sends a signed-out visitor to sign-in and back here afterwards.
async function requireSession({ request }: LoaderFunctionArgs) {
  const session = await getSession();
  if (!session) throw redirect(signInPath(currentPath(request)));
  return session;
}

// Public pages (barber browse/detail): the session is optional.
async function optionalSession() {
  return getSession();
}

// Customer-only pages. A shop lands on its own dashboard instead.
async function customerLoader(args: LoaderFunctionArgs) {
  const session = await requireSession(args);
  if (session.profile.role === "shop") throw redirect("/shop");
  return session;
}

// Shop-only pages.
async function shopLoader(args: LoaderFunctionArgs) {
  const session = await requireSession(args);
  if (session.profile.role !== "shop") throw redirect("/barbers");
  return session;
}

// Admin-only pages. This guard is UX only — the real control is RLS on payouts /
// bank fields plus the admin-guarded build/mark/cancel RPCs.
async function adminLoader(args: LoaderFunctionArgs) {
  const session = await requireSession(args);
  if (session.profile.role !== "admin") {
    throw redirect(session.profile.role === "shop" ? "/shop" : "/barbers");
  }
  return session;
}

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <Outlet />,
    errorElement: <ErrorComponent />,
    children: [
      { index: true, element: <Index /> },
      {
        // One mounted auth page shared by /sign-in and /sign-up, so switching
        // between them keeps what the user typed (as the old in-page toggle did).
        element: <AuthPage />,
        children: [
          { path: "sign-in", element: null },
          { path: "sign-up", element: null },
        ],
      },
      { path: "barbers", loader: optionalSession, element: <Barbers /> },
      { path: "barbers/:id", loader: optionalSession, element: <BarberDetail /> },
      { path: "bookings", loader: customerLoader, element: <MyBookings /> },
      { path: "bookings/success", loader: requireSession, element: <BookingSuccess /> },
      { path: "shop", loader: shopLoader, element: <ShopOnboarding /> },
      { path: "shop/bookings", loader: shopLoader, element: <ShopBookings /> },
      { path: "shop/earnings", loader: shopLoader, element: <ShopEarnings /> },
      { path: "admin", element: <Navigate to="/admin/payouts" replace /> },
      { path: "admin/payouts", loader: adminLoader, element: <AdminPayouts /> },
      // Old URLs: the M0 customer placeholder and the TanStack-era login.
      { path: "app", element: <Navigate to="/barbers" replace /> },
      { path: "login", element: <Navigate to="/sign-in" replace /> },
      { path: "*", element: <NotFoundComponent /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
