import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn(async () => ({ data: "booking-id", error: null })) },
}));
vi.mock("@/lib/platform", async (orig) => ({
  ...(await orig<typeof import("@/lib/platform")>()),
  usePlatformSettings: () => ({
    data: { id: true, currency: "twd", currency_minor_units: 0, slot_minutes: 30, updated_at: "" },
  }),
}));

import BookingDialog from "@/components/booking/BookingDialog";
import type { Service, SlotWithHold } from "@/lib/booking";

const svc = (id: string, name: string, price: number): Service => ({
  id,
  name,
  price,
  barber_id: "b1",
  category: "cut",
  required_slots: 1,
  created_at: "2026-10-09T00:00:00Z",
});

// 10:00–12:00 Taipei on a future day, four 30-minute slots.
const base = Date.parse("2030-10-10T02:00:00Z");
const slots: SlotWithHold[] = Array.from({ length: 4 }, (_, i) => ({
  id: `s${i}`,
  barber_id: "b1",
  created_at: "2026-10-09T00:00:00Z",
  starts_at: new Date(base + i * 30 * 60_000).toISOString(),
  ends_at: new Date(base + (i + 1) * 30 * 60_000).toISOString(),
  held: false,
}));

function renderDialog(initialStartId: string | null = null) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <BookingDialog
        open
        onOpenChange={() => {}}
        barberName="Andy"
        services={[svc("a", "局部修瀏海", 100), svc("b", "兒童造型單剪", 200)]}
        slots={slots}
        initialDay={initialStartId ? "2030-10-10" : null}
        initialStartId={initialStartId}
        onBooked={() => {}}
      />
    </QueryClientProvider>,
  );
}

describe("BookingDialog", () => {
  it("enables Confirm once a service, day and start time are picked", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: /兒童造型單剪/ }));
    fireEvent.click(screen.getByRole("button", { name: "10:00" }));
    expect(screen.getByText(/你的預約/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Confirm/ }).hasAttribute("disabled")).toBe(false);
  });

  it("explains why Confirm is disabled until a start time is picked", () => {
    renderDialog();
    expect(screen.getByText(/請先選擇服務/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /兒童造型單剪/ }));
    expect(screen.getByText(/請選擇開始時間/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Confirm/ }).hasAttribute("disabled")).toBe(true);
  });

  it("keeps the time chip the dialog was opened from selected once a service is picked", () => {
    renderDialog("s2"); // 11:00 Taipei
    fireEvent.click(screen.getByRole("radio", { name: /局部修瀏海/ }));
    expect(screen.getByText(/11:00–11:30/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Confirm/ }).hasAttribute("disabled")).toBe(false);
  });
});
