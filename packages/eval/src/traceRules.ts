// Single mapping of actor and event-type names used by the traceComplete check.
// Update here (only) when Lane A finalises its event contract.
export const TRACE_RULES = {
  actors: {
    riderAdvocate: "rider_advocate",
    driverAdvocate: "driver_advocate",
  },
  types: {
    toolRequested: "tool_requested",
    toolResult: "tool_result",
    caseSubmitted: "case_submitted",
    handoffToJudge: "handoff_to_judge",
    terminal: ["run_completed", "run_incomplete", "run_failed"],
  },
} as const;
