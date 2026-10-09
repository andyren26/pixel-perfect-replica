import { matchRoutes } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { routes } from "@/router";

// Match routes without running loaders or rendering: loaders need Supabase,
// which the test run lacks.
function leafPath(url: string) {
  const matches = matchRoutes(routes, url) ?? [];
  const leaf = matches.at(-1)?.route;
  return leaf?.index ? "(index)" : leaf?.path;
}

describe("App routing", () => {
  it.each([
    ["/", "(index)"],
    ["/app", "app"],
    ["/sign-in", "sign-in"],
    ["/sign-up", "sign-up"],
    ["/shop", "shop"],
    ["/shop/bookings", "shop/bookings"],
    ["/login", "login"],
    ["/barbers", "barbers"],
    ["/barbers/0b6c6f43-6a52-4a8e-9a8a-0f3a3c1f2b10", "barbers/:id"],
    ["/bookings", "bookings"],
  ])("matches a page for %s", (url, expected) => {
    expect(leafPath(url)).toBe(expected);
  });

  it("falls back to not found for unknown paths", () => {
    expect(leafPath("/nope")).toBe("*");
  });
});
