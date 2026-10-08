import { Navigate, Outlet, createBrowserRouter, redirect, type RouteObject } from "react-router";

import { supabase } from "@/integrations/supabase/client";
import Index from "@/pages/Index";
import AuthPage from "@/pages/Auth";
import AppHome from "@/pages/AppHome";
import { ErrorComponent, NotFoundComponent } from "@/pages/RootErrors";

// Signed-in area guard: runs before /app renders, mirrors the old
// `_authenticated` beforeLoad (getUser → redirect to sign-in if missing).
async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw redirect("/sign-in");
  return { user: data.user };
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
      { path: "app", loader: requireUser, element: <AppHome /> },
      // Old URLs from the TanStack version.
      { path: "login", element: <Navigate to="/sign-in" replace /> },
      { path: "barbers", element: <Navigate to="/app" replace /> },
      { path: "*", element: <NotFoundComponent /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
