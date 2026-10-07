import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LiveApiClient } from "../src/api/client";
import { App } from "../src/App";
import type { RunView } from "../src/contracts/provisional";
import { MockApiClient } from "../src/mock/client";
import { ev, FIXTURES, ScriptedClient } from "./fakes";

const resolveBtn = () => screen.getByRole("button", { name: /resolve/i });
async function ready() { await screen.findByRole("option", { name: /R1 · Material detour/ }); }

const judge = {
  ruling: "rider_upheld", findings: [{ point: "detour", evidenceIds: ["GPS-ROUTE", "GPS-ROUTE-2"], policyIds: ["RD-1"] }],
  remedyId: "refund_route_excess" as const, confidence: 0.8, reasoning: "r", riderExplanation: "to rider", driverExplanation: "to driver",
};
const evidenceRecord = (id: string, family: "gps" | "chat", facts: Record<string, unknown> = {}, kind: "route_metrics" | "chat_message" = "route_metrics") => ({
  id, family, kind, timestamp: null, summary: `${id} summary`, facts, provenance: { source: "synthetic_fixture" as const, fixtureId: "R1", fields: [], method: "m" },
});

describe("App", () => {
  it("disables Resolve while a run is active and ignores double clicks", async () => {
    const client = new ScriptedClient((id) => [{ runId: id, status: "running", events: [ev(id, 1, "run_started")] }], "live", 30);
    render(<App client={client} pollIntervalMs={20} />);
    await ready();
    const user = userEvent.setup();
    await user.dblClick(resolveBtn());
    await user.click(resolveBtn());
    await waitFor(() => expect(screen.getByLabelText("Run status")).toHaveAttribute("data-status", "running"));
    expect(resolveBtn()).toBeDisabled();
    expect(client.createCalls).toHaveLength(1);
    expect(client.createCalls[0]).toEqual({ fixtureId: "R1", riderClaim: "claim R1" });
  });

  it("failed run shows the error and no action card or amount", async () => {
    const failed: RunView = { runId: "run-1", status: "failed", events: [ev("run-1", 1, "run_failed")], error: { code: "provider_timeout", message: "timed out" },
      result: { judge, action: { remedyId: "refund_route_excess", recipient: "rider", currency: "SGD", amountCents: 198, text: "Refund" } } };
    render(<App client={new ScriptedClient(() => [failed])} pollIntervalMs={10} />);
    await ready();
    await userEvent.click(resolveBtn());
    await screen.findByText(/provider_timeout/);
    expect(screen.queryByTestId("action-card")).toBeNull();
    expect(screen.queryByText("S$1.98")).toBeNull();
    expect(screen.getByRole("button", { name: "Run again" })).toBeInTheDocument();
    expect(screen.queryByText(/no action/i)).toBeNull();
  });

  it("incomplete run lists the missing families and shows no action card or amount", async () => {
    const inc: RunView = { runId: "run-1", status: "incomplete", events: [ev("run-1", 1, "run_incomplete")], missingEvidence: [{ family: "gps", reason: "No GPS (synthetic)" }] };
    render(<App client={new ScriptedClient(() => [inc])} pollIntervalMs={10} />);
    await ready();
    await userEvent.click(resolveBtn());
    await waitFor(() => expect(screen.getByLabelText("Run status")).toHaveAttribute("data-status", "incomplete"));
    expect(within(screen.getByLabelText("Run status")).getByText("gps")).toBeInTheDocument();
    expect(screen.queryByTestId("action-card")).toBeNull();
    expect(screen.queryByText(/S\$/)).toBeNull();
    expect(screen.queryByText(/no action/i)).toBeNull();
  });

  it("completed run shows the action card with the amount", async () => {
    const done: RunView = { runId: "run-1", status: "completed", events: [ev("run-1", 1, "run_completed")], evidence: [evidenceRecord("GPS-ROUTE", "gps")],
      policyClauses: [], result: { judge, action: { remedyId: "refund_route_excess", recipient: "rider", currency: "SGD", amountCents: 198, text: "Refund S$1.98" } } };
    render(<App client={new ScriptedClient(() => [done])} pollIntervalMs={10} />);
    await ready();
    await userEvent.click(resolveBtn());
    const card = await screen.findByTestId("action-card");
    expect(within(card).getByText("S$1.98")).toBeInTheDocument();
    expect(screen.getByText(/Model-assessed confidence/)).toBeInTheDocument();
  });

  it("renders an unknown citation chip in the unresolved style", async () => {
    const done: RunView = { runId: "run-1", status: "completed", events: [ev("run-1", 1, "ruling_issued", { refs: { evidenceIds: ["GPS-ROUTE-2"] } })],
      evidence: [evidenceRecord("GPS-ROUTE", "gps")], policyClauses: [],
      result: { judge, action: { remedyId: "refund_route_excess", recipient: "rider", currency: "SGD", amountCents: 198, text: "x" } } };
    render(<App client={new ScriptedClient(() => [done])} pollIntervalMs={10} />);
    await ready();
    await userEvent.click(resolveBtn());
    await screen.findByTestId("action-card");
    const unknown = screen.getAllByRole("button", { name: /GPS-ROUTE-2/ });
    expect(unknown.length).toBeGreaterThan(0);
    for (const c of unknown) expect(c).toHaveClass("chip-unresolved");
    const known = screen.getAllByRole("button", { name: /^GPS-ROUTE$/ });
    for (const c of known) expect(c).not.toHaveClass("chip-unresolved");
    // RD-1 was never retrieved in this run: unresolved too.
    for (const c of screen.getAllByRole("button", { name: /RD-1/ })) expect(c).toHaveClass("chip-unresolved");
  });

  it("renders chat text literally, never as HTML", async () => {
    const text = "<b>bold</b><script>window.__pwned = true</script><img src=x onerror=alert(1)>";
    const done: RunView = { runId: "run-1", status: "running", events: [ev("run-1", 1, "tool_result")],
      evidence: [evidenceRecord("CHAT-01", "chat", { sender: "rider", text, tags: ["instruction_like"], untrusted: true }, "chat_message")] };
    const { container } = render(<App client={new ScriptedClient(() => [done])} pollIntervalMs={10} />);
    await ready();
    await userEvent.click(resolveBtn());
    const matches = await screen.findAllByText(text);
    expect(matches.map((m) => m.tagName)).toContain("BLOCKQUOTE");
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    expect(screen.getByText(/instruction-like content/)).toBeInTheDocument();
  });

  it("shows a contract mismatch state for a malformed response", async () => {
    const fetchImpl = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.endsWith("/api/fixtures")) return new Response(JSON.stringify(FIXTURES));
      if (u.endsWith("/api/runs")) return new Response(JSON.stringify({ runId: "run-9" }));
      return new Response(JSON.stringify({ runId: "run-9", status: "exploded", events: "nope" }));
    }) as typeof fetch;
    render(<App client={new LiveApiClient("", fetchImpl)} pollIntervalMs={10} />);
    await ready();
    await userEvent.click(resolveBtn());
    await screen.findByText("Contract mismatch.");
    expect(screen.getByLabelText("Run status")).toHaveAttribute("data-status", "contract_mismatch");
    expect(screen.queryByText(/no action/i)).toBeNull();
  });

  it("shows a fixture-loading error when the fixture list is malformed", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify([{ nope: 1 }]))) as unknown as typeof fetch;
    render(<App client={new LiveApiClient("", fetchImpl)} pollIntervalMs={10} />);
    await screen.findByText(/Contract mismatch on GET \/api\/fixtures/);
  });

  it("never shows a stale run's events after a new run starts", async () => {
    let runs = 0;
    const client = new ScriptedClient((id) => {
      runs = Number(id.split("-")[1]);
      return [{ runId: id, status: runs === 1 ? "failed" : "running", events: [ev(id, 1, runs === 1 ? "run_failed" : "run_started", { summary: `event of ${id}` })], error: { code: "x", message: "y" } }];
    });
    render(<App client={client} pollIntervalMs={10} />);
    await ready();
    await userEvent.click(resolveBtn());
    await screen.findByText("event of run-1");
    await userEvent.click(screen.getByRole("button", { name: "Run again" }));
    await screen.findByText("event of run-2");
    expect(screen.queryByText("event of run-1")).toBeNull();
  });
});

describe("App in DEV MOCK mode", () => {
  it("shows the banner and [DEV MOCK] events, with real evidence", async () => {
    let t = 1_000_000;
    const client = new MockApiClient(() => t);
    render(<App client={client} pollIntervalMs={10} />);
    expect(screen.getByText("DEV MOCK: agent activity is scripted, not live.")).toBeInTheDocument();
    await screen.findByRole("option", { name: /R1 · Material detour, unjustified/ });
    await userEvent.click(resolveBtn());
    await act(async () => { t += 10_000; });
    const card = await screen.findByTestId("action-card");
    expect(within(card).getByText("S$1.98")).toBeInTheDocument();
    const timeline = screen.getByLabelText("Timeline");
    const items = within(timeline).getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(5);
    for (const li of items) {
      expect(li).toHaveClass("event-dev");
      expect(li.textContent).toContain("[DEV MOCK]");
    }
    // Evidence records are genuine computations from @fairtrip/evidence.
    expect(screen.getByText(/Actual 10\.60 km vs reference 7\.96 km/)).toBeInTheDocument();
  });

  it("plays the X1 incomplete script with no amount", async () => {
    let t = 0;
    render(<App client={new MockApiClient(() => t)} pollIntervalMs={10} />);
    await screen.findByRole("option", { name: /X1 · Missing GPS/ });
    await userEvent.selectOptions(screen.getByLabelText("Fixture"), "X1");
    await userEvent.click(resolveBtn());
    await act(async () => { t += 10_000; });
    await waitFor(() => expect(screen.getByLabelText("Run status")).toHaveAttribute("data-status", "incomplete"));
    expect(screen.queryByTestId("action-card")).toBeNull();
    expect(within(screen.getByLabelText("Run status")).getByText("gps")).toBeInTheDocument();
  });
});
