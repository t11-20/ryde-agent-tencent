// DEV MOCK scripted runs. Evidence and remedy amounts are REAL computations from @fairtrip/evidence;
// only the agent outputs (cases, Judge text) and the event timing are scripted. Every event is dev: true
// and its summary begins with "[DEV MOCK]".
import {
  createDisputeTools,
  formatSgd,
  getRemedyBasis,
  type Dataset,
  type EvidenceFamily,
  type EvidenceRecord,
  type PolicyClause,
  type RemedyId,
  type TripFixture,
} from "@fairtrip/evidence";
import type { ActivityEvent, AdvocateCase, CitedPoint, FinalAction, JudgeResult, RunStatus, RunView } from "../contracts/provisional";

export type ScenarioId = "completed" | "provider_timeout" | "unknown_citation" | "incomplete";

export interface ScenarioOption { id: ScenarioId; label: string }

/** Which scripted runs exist for which fixture. Other fixtures fail visibly in mock mode. */
export const SCENARIOS: Record<string, ScenarioOption[]> = {
  R1: [
    { id: "completed", label: "R1 · completed (refund)" },
    { id: "provider_timeout", label: "R1 · provider timeout (failed)" },
    { id: "unknown_citation", label: "R1 · unknown citation (failed validation)" },
  ],
  N2: [{ id: "completed", label: "N2 · completed (keep charge)" }],
  X1: [{ id: "incomplete", label: "X1 · incomplete (missing GPS)" }],
};

export const DEV = "[DEV MOCK]";

export interface MockState {
  view: RunView;
}

export interface Step {
  atMs: number;
  actor: string;
  type: string;
  summary: string;
  refs?: { evidenceIds?: string[]; policyIds?: string[] };
  data?: unknown;
  apply?: (s: MockState) => void;
}

const cp = (point: string, evidenceIds: string[], policyIds: string[]): CitedPoint => ({ point, evidenceIds, policyIds });

function addEvidence(s: MockState, records: EvidenceRecord[]): void {
  const have = new Set((s.view.evidence ?? []).map((r) => r.id));
  s.view.evidence = [...(s.view.evidence ?? []), ...records.filter((r) => !have.has(r.id))];
}
function addClauses(s: MockState, clauses: PolicyClause[]): void {
  const have = new Set((s.view.policyClauses ?? []).map((c) => c.id));
  s.view.policyClauses = [...(s.view.policyClauses ?? []), ...clauses.filter((c) => !have.has(c.id))];
}
const setStatus = (status: RunStatus) => (s: MockState) => { s.view.status = status; };

interface Script {
  riderSources: EvidenceFamily[];
  driverSources: EvidenceFamily[];
  rider: AdvocateCase;
  driver: AdvocateCase;
  ending:
    | { kind: "completed"; judge: JudgeResult; action: FinalAction }
    | { kind: "incomplete"; ruling: string; missingRefs: string[] }
    | { kind: "timeout" }
    | { kind: "unknown_citation"; judge: JudgeResult; unknownId: string };
}

function steps(dataset: Dataset, fixture: TripFixture, sc: Script): Step[] {
  const tools = createDisputeTools(dataset, fixture.dispute.id);
  const cat = fixture.dispute.category;
  const out: Step[] = [
    { atMs: 0, actor: "controller", type: "run_started", summary: `${DEV} Run started for ${fixture.dispute.id} (${cat}).`, apply: setStatus("running") },
  ];
  const advocate = (side: "rider" | "driver", sources: EvidenceFamily[], t0: number): void => {
    const actor = `${side}_advocate`;
    const ev = tools.get_evidence({ sources });
    const pol = tools.get_policy({ category: cat });
    out.push({ atMs: t0, actor, type: "tool_requested", summary: `${DEV} get_evidence(${sources.join(", ")})`, data: { tool: "get_evidence", args: { sources } } });
    if (ev.ok) {
      const ids = ev.data.records.map((r) => r.id);
      const missing = ev.data.unavailable.map((u) => `${u.family} unavailable`);
      out.push({
        atMs: t0 + 500, actor, type: "tool_result",
        summary: `${DEV} get_evidence returned ${ids.length} records${missing.length ? `; ${missing.join(", ")}` : ""}.`,
        refs: { evidenceIds: ids }, data: { tool: "get_evidence", ok: true, unavailable: ev.data.unavailable },
        apply: (s) => {
          addEvidence(s, ev.data.records);
          for (const u of ev.data.unavailable) {
            if (!(s.view.missingEvidence ?? []).some((m) => m.family === u.family)) s.view.missingEvidence = [...(s.view.missingEvidence ?? []), u];
          }
        },
      });
    }
    out.push({ atMs: t0 + 900, actor, type: "tool_requested", summary: `${DEV} get_policy(${cat})`, data: { tool: "get_policy", args: { category: cat } } });
    if (pol.ok) {
      out.push({
        atMs: t0 + 1100, actor, type: "tool_result", summary: `${DEV} get_policy returned ${pol.data.clauses.length} DEMONSTRATION POLICY clauses.`,
        refs: { policyIds: pol.data.clauses.map((c) => c.id) }, data: { tool: "get_policy", ok: true },
        apply: (s) => addClauses(s, pol.data.clauses),
      });
    }
  };
  advocate("rider", sc.riderSources, 400);
  advocate("driver", sc.driverSources, 600);
  const refsOf = (c: AdvocateCase) => ({
    evidenceIds: [...new Set([...c.arguments, ...c.counterevidence].flatMap((a) => a.evidenceIds))],
    policyIds: [...new Set([...c.arguments, ...c.counterevidence].flatMap((a) => a.policyIds))],
  });
  out.push({ atMs: 2600, actor: "rider_advocate", type: "case_submitted", summary: `${DEV} Rider case submitted: requests ${sc.rider.requestedRemedy}.`, refs: refsOf(sc.rider), apply: (s) => { s.view.cases = { ...s.view.cases, rider: sc.rider }; } });
  out.push({ atMs: 3000, actor: "driver_advocate", type: "case_submitted", summary: `${DEV} Driver case submitted: requests ${sc.driver.requestedRemedy}.`, refs: refsOf(sc.driver), apply: (s) => { s.view.cases = { ...s.view.cases, driver: sc.driver }; } });
  out.push({ atMs: 3400, actor: "controller", type: "handoff_to_judge", summary: `${DEV} Both advocate cases received. Handing off to the Judge.` });
  out.push({ atMs: 3700, actor: "judge", type: "judge_started", summary: `${DEV} Judge reviewing both cases against the DEMONSTRATION POLICY.` });

  const e = sc.ending;
  if (e.kind === "completed") {
    const refs = { evidenceIds: [...new Set(e.judge.findings.flatMap((f) => f.evidenceIds))], policyIds: [...new Set(e.judge.findings.flatMap((f) => f.policyIds))] };
    out.push({ atMs: 5200, actor: "judge", type: "ruling_issued", summary: `${DEV} Ruling: ${e.judge.ruling}; remedy ${e.judge.remedyId}.`, refs });
    out.push({ atMs: 5600, actor: "validator", type: "validation_passed", summary: `${DEV} All citations resolve; ${e.action.remedyId} ${formatSgd(e.action.amountCents)} matches the remedy basis.` });
    out.push({
      atMs: 5800, actor: "controller", type: "run_completed", summary: `${DEV} Run completed: ${e.action.text}`,
      apply: (s) => { s.view.result = { judge: e.judge, action: e.action }; s.view.status = "completed"; s.view.usage = { modelCalls: 0, latencyMs: 5800 }; },
    });
  } else if (e.kind === "incomplete") {
    out.push({ atMs: 5000, actor: "judge", type: "ruling_issued", summary: `${DEV} ${e.ruling}`, refs: { evidenceIds: e.missingRefs, policyIds: ["GEN-1"] } });
    out.push({
      atMs: 5400, actor: "controller", type: "run_incomplete", summary: `${DEV} Run incomplete: decisive evidence missing (GEN-1). Referred for human review. No amount issued.`,
      refs: { policyIds: ["GEN-1"] }, apply: setStatus("incomplete"),
    });
  } else if (e.kind === "timeout") {
    out.push({
      atMs: 6200, actor: "controller", type: "run_failed", summary: `${DEV} Judge model call timed out (simulated provider timeout).`,
      apply: (s) => { s.view.status = "failed"; s.view.error = { code: "provider_timeout", message: `${DEV} The model provider did not respond before the deadline (simulated).` }; },
    });
  } else {
    const refs = { evidenceIds: [...new Set(e.judge.findings.flatMap((f) => f.evidenceIds))], policyIds: [...new Set(e.judge.findings.flatMap((f) => f.policyIds))] };
    out.push({ atMs: 5200, actor: "judge", type: "ruling_issued", summary: `${DEV} Ruling: ${e.judge.ruling}; remedy ${e.judge.remedyId}.`, refs });
    out.push({ atMs: 5600, actor: "validator", type: "validation_failed", summary: `${DEV} Citation ${e.unknownId} does not exist in this dispute's evidence index.`, refs: { evidenceIds: [e.unknownId] } });
    out.push({
      atMs: 5800, actor: "controller", type: "run_failed", summary: `${DEV} Run failed validation: unknown citation ${e.unknownId}. No action issued.`,
      apply: (s) => { s.view.status = "failed"; s.view.error = { code: "citation_invalid", message: `${DEV} The Judge cited ${e.unknownId}, which is not in the evidence index.` }; },
    });
  }
  return out;
}

function basisCents(dataset: Dataset, disputeId: string, remedyId: RemedyId): number {
  const b = getRemedyBasis(dataset, disputeId).find((x) => x.remedyId === remedyId);
  if (!b || b.eligibleCents === null) throw new Error(`${DEV} no eligible amount for ${remedyId}`);
  return b.eligibleCents;
}

function r1Script(dataset: Dataset, f: TripFixture): Omit<Script, "ending"> & { judge: JudgeResult; action: FinalAction } {
  const cents = basisCents(dataset, f.dispute.id, "refund_route_excess");
  const rider: AdvocateCase = {
    side: "rider",
    summary: `${DEV} The driver took a materially longer route than the reference route, without my consent, and stopped mid-trip.`,
    arguments: [
      cp("The actual route exceeds the reference route by more than the RD-1 threshold.", ["GPS-ROUTE"], ["RD-1"]),
      cp("I questioned the route and asked the driver to follow the app route; I never agreed to the longer route.", ["CHAT-01", "CHAT-03"], ["RD-3"]),
      cp(`The eligible excess-distance refund is ${formatSgd(cents)}.`, ["PAY-FARE", "PAY-REMEDY"], ["RD-2"]),
    ],
    counterevidence: [cp("The driver cites congestion, but no advisory or navigation reroute is on record.", ["CHAT-02"], ["RD-4"])],
    requestedRemedy: "refund_route_excess",
    missingFacts: [],
  };
  const driver: AdvocateCase = {
    side: "driver",
    summary: `${DEV} The driver chose a route believed to be faster given typical evening congestion.`,
    arguments: [
      cp("The driver explained the route choice in chat at the time.", ["CHAT-02"], ["RD-4"]),
      cp("The driver has a long record of completed trips (context only).", ["HIST-DRIVER"], ["GEN-2"]),
    ],
    counterevidence: [cp("The route exceeds the RD-1 threshold.", ["GPS-ROUTE"], ["RD-1"])],
    requestedRemedy: "keep_charge",
    missingFacts: ["No traffic advisory or reroute event confirms the claimed congestion."],
  };
  const judge: JudgeResult = {
    ruling: "rider_upheld",
    findings: [
      cp("The detour is material under RD-1.", ["GPS-ROUTE"], ["RD-1"]),
      cp("The rider objected and did not consent to the longer route, so RD-3 does not apply.", ["CHAT-01", "CHAT-03"], ["RD-3"]),
      cp("No documented diversion explains the route, so RD-4 does not apply.", ["CHAT-02"], ["RD-4"]),
      cp(`RD-2 refund of the eligible excess-distance charge: ${formatSgd(cents)}.`, ["PAY-FARE", "PAY-REMEDY"], ["RD-2"]),
    ],
    remedyId: "refund_route_excess",
    confidence: 0.86,
    reasoning: `${DEV} Material, unjustified detour; refund the excess-distance charge per RD-2.`,
    riderExplanation: `${DEV} Your route was materially longer than the reference route and you did not agree to it. You will be refunded ${formatSgd(cents)}.`,
    driverExplanation: `${DEV} The route exceeded the demonstration-policy threshold without rider consent or a documented diversion, so the excess-distance charge is refunded to the rider.`,
  };
  const action: FinalAction = { remedyId: "refund_route_excess", recipient: "rider", currency: "SGD", amountCents: cents, text: `Refund ${formatSgd(cents)} to the rider (excess-distance charge).` };
  return { riderSources: ["gps", "chat", "payment"], driverSources: ["gps", "chat", "history"], rider, driver, judge, action };
}

function n2Script(f: TripFixture): Script {
  const rider: AdvocateCase = {
    side: "rider",
    summary: `${DEV} The rider says they were waiting at the pickup and never saw the car.`,
    arguments: [cp("The rider messaged that they were at the pickup.", ["CHAT-03"], ["NS-1"])],
    counterevidence: [cp("The rider's location trace places them far from the pickup pin at cancellation.", ["GPS-RIDER"], ["NS-1"])],
    requestedRemedy: "refund_no_show_fee",
    missingFacts: [],
  };
  const driver: AdvocateCase = {
    side: "driver",
    summary: `${DEV} The driver waited within range of the pin for over the minimum time and tried to contact the rider.`,
    arguments: [
      cp("The driver stayed within the NS-1 distance and waited longer than the minimum.", ["GPS-PICKUP"], ["NS-1"]),
      cp("The driver called and messaged the rider before cancelling.", ["CALL-01", "CHAT-01", "CHAT-CONTACT"], ["NS-1"]),
    ],
    counterevidence: [],
    requestedRemedy: "keep_charge",
    missingFacts: [],
  };
  const judge: JudgeResult = {
    ruling: "driver_upheld",
    findings: [
      cp("The driver came within the NS-1 distance and waited at least the minimum time.", ["GPS-PICKUP"], ["NS-1"]),
      cp("The driver made recorded contact attempts before cancelling.", ["CALL-01", "CHAT-01", "CHAT-CONTACT"], ["NS-1"]),
      cp("The rider was not at the pickup pin at cancellation.", ["GPS-RIDER"], ["NS-1"]),
    ],
    remedyId: "keep_charge",
    confidence: 0.9,
    reasoning: `${DEV} All NS-1 conditions are met; the no-show fee is retained.`,
    riderExplanation: `${DEV} The driver waited at the pickup point for longer than the minimum and tried to call and message you. The no-show fee stands.`,
    driverExplanation: `${DEV} Your wait and contact attempts meet the demonstration policy. The no-show fee is retained.`,
  };
  void f;
  return {
    riderSources: ["gps", "chat", "payment"], driverSources: ["gps", "chat", "history"], rider, driver,
    ending: { kind: "completed", judge, action: { remedyId: "keep_charge", recipient: null, currency: "SGD", amountCents: 0, text: "Keep the no-show fee. No refund." } },
  };
}

function x1Script(): Script {
  const missing = ["GPS trace unavailable: the route length cannot be compared with the reference route."];
  return {
    riderSources: ["gps", "chat", "payment"], driverSources: ["gps", "history"],
    rider: {
      side: "rider", summary: `${DEV} The fare was higher than usual, suggesting a long route.`,
      arguments: [cp("The fare is higher than the rider expects for this trip.", ["PAY-FARE", "CHAT-01"], ["RD-1"])],
      counterevidence: [], requestedRemedy: "refund_route_excess", missingFacts: missing,
    },
    driver: {
      side: "driver", summary: `${DEV} The driver says they followed the navigation.`,
      arguments: [cp("No evidence shows a deviation.", ["HIST-DRIVER"], ["GEN-2"])],
      counterevidence: [], requestedRemedy: "keep_charge", missingFacts: missing,
    },
    ending: { kind: "incomplete", ruling: "Ruling: incomplete. GPS evidence decisive to RD-1 is missing (GEN-1).", missingRefs: ["PAY-FARE"] },
  };
}

/** Builds the scripted steps for a fixture + scenario, or null if no script exists. */
export function buildScenario(dataset: Dataset, fixture: TripFixture, scenario: ScenarioId | undefined): Step[] | null {
  const options = SCENARIOS[fixture.fixtureId] ?? [];
  const chosen = scenario ?? options[0]?.id;
  if (!chosen || !options.some((o) => o.id === chosen)) return null;
  if (fixture.fixtureId === "R1") {
    const s = r1Script(dataset, fixture);
    if (chosen === "completed") return steps(dataset, fixture, { ...s, ending: { kind: "completed", judge: s.judge, action: s.action } });
    if (chosen === "provider_timeout") return steps(dataset, fixture, { ...s, ending: { kind: "timeout" } });
    const bad: JudgeResult = { ...s.judge, findings: [...s.judge.findings.slice(0, 1).map((x) => ({ ...x, evidenceIds: ["GPS-ROUTE-2"] })), ...s.judge.findings.slice(1)] };
    return steps(dataset, fixture, { ...s, ending: { kind: "unknown_citation", judge: bad, unknownId: "GPS-ROUTE-2" } });
  }
  if (fixture.fixtureId === "N2") return steps(dataset, fixture, n2Script(fixture));
  if (fixture.fixtureId === "X1") return steps(dataset, fixture, x1Script());
  return null;
}

/** Applies all steps up to elapsedMs and returns the run view (events with sequence > after). */
export function viewAt(runId: string, startEpochMs: number, base: Pick<RunView, "dispute">, all: Step[], elapsedMs: number, after: number): RunView {
  const s: MockState = { view: { runId, status: "queued", events: [], ...base } };
  const events: ActivityEvent[] = [];
  all
    .slice()
    .sort((a, b) => a.atMs - b.atMs)
    .filter((st) => st.atMs <= elapsedMs)
    .forEach((st, i) => {
      st.apply?.(s);
      events.push({
        runId, sequence: i + 1, timestamp: new Date(startEpochMs + st.atMs).toISOString().replace(/\.\d{3}Z$/, "Z"),
        actor: st.actor, type: st.type, summary: st.summary, ...(st.refs ? { refs: st.refs } : {}), ...(st.data !== undefined ? { data: st.data } : {}), dev: true,
      });
    });
  return { ...s.view, events: events.filter((e) => e.sequence > after) };
}
