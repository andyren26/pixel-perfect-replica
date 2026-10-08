import { Navigate, Outlet, createBrowserRouter, redirect, type RouteObject } from "react-router";

import Index from "@/pages/Index";
import AuthPage from "@/pages/Auth";
import AppHome from "@/pages/AppHome";
import ShopOnboarding from "@/pages/ShopOnboarding";
import ShopBookings from "@/pages/ShopBookings";
import { ErrorComponent, NotFoundComponent } from "@/pages/RootErrors";
import { getSession } from "@/lib/profile";

// Signed-in guard: user + their profiles row (role comes from profiles.role).
async function requireSession() {
  const session = await getSession();
  if (!session) throw redirect("/sign-in");
  return session;
}

// Customer home. A shop lands on its own dashboard instead.
async function customerLoader() {
  const session = await requireSession();
  if (session.profile.role === "shop") throw redirect("/shop");
  return session;
}

// Shop-only pages.
async function shopLoader() {
  const session = await requireSession();
  if (session.profile.role !== "shop") throw redirect("/app");
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
      { path: "app", loader: customerLoader, element: <AppHome /> },
      { path: "shop", loader: shopLoader, element: <ShopOnboarding /> },
      { path: "shop/bookings", loader: shopLoader, element: <ShopBookings /> },
      // Old URLs from the TanStack version.
      { path: "login", element: <Navigate to="/sign-in" replace /> },
      { path: "barbers", element: <Navigate to="/app" replace /> },
      { path: "*", element: <NotFoundComponent /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
