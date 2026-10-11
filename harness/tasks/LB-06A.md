# LB-06A — Formula functions: no hand calculations

**Goal:** every money and threshold formula lives in a named `calculate…` function, all code calls those functions, and the audit proves results are computed from the inputs, not worked out by the model or hardcoded.
**Requires:** LB-06 · **Who:** agent · **SPEC:** §5 code-only rule, §5.10, §5.4, §5.8, §5.9 · **Screenshot moment:** optional

## Files

Create: `packages/evidence/src/formulas.ts`, `packages/evidence/test/formulas.test.ts`
Modify: `packages/evidence/src/route.ts`, `packages/evidence/src/fare.ts`, `packages/evidence/src/remedy.ts`, `packages/evidence/src/index.ts`, any other file in `packages/evidence/src/` that the audit flags, test files in `packages/evidence/test/` only to replace hand-calculated expectations with spec values, `harness/STATUS.md`

## Rules for this task

- Do not calculate any number yourself. If you need a value, run `npm run build` and `node harness/audit/show-fixture.mjs <FIXTURE_ID>`.
- Do not change any value that comes from `harness/spec/05-calculations.md` or `harness/spec/07-golden-values.md`.
- Do not change behaviour: after this task every result is the same as before; only where the arithmetic lives changes.

## Steps

1. In `harness/STATUS.md`, add this row directly below the LB-06 row:
```
| LB-06A | Formula functions, no hand calculations | LB-06 | IN PROGRESS | | |
```
2. Create `src/formulas.ts` by copying the code block in SPEC §5.10 exactly. Add `export * from './formulas.js';` to `src/index.ts`.
3. Create `test/formulas.test.ts` with one `expect(...).toBe(...)` per call in the §5.10 test-vector table, copying each number from the table. Check: `npx vitest run packages/evidence/test/formulas.test.ts` passes.
4. `src/route.ts`: import from `./formulas.js`. `thresholdMetersFor(referenceMeters, params)` must return `calculateMaterialityThresholdMeters(referenceMeters, params.minExcessMeters, params.minExcessPercent)`, and `excessPct` must be `calculateExcessPercent(excessMeters, referenceMeters)`. Delete the inline versions of those two formulas.
5. `src/fare.ts`: the expected distance, time and surge cents must come from `calculateDistanceChargeCents(quantity, rateCard.perKmCents)`, `calculateTimeChargeCents(quantity, rateCard.perMinCents)` and `calculateSurgeChargeCents(base + distance + time, surgeMultiplierX100)`. Keep the existing guards that record an anomaly instead of calling a formula when an input is missing or not a non-negative safe integer.
6. `src/remedy.ts`: the route refund must be `Math.min(calculateRouteExcessRefundCents(route.excessMeters, perKmCents, x), calculateSurgedDistanceCapCents(distanceCents, x), paidCents)`. Build the `formula` display text from the same function results; never type a number into it.
7. Remove anything hardcoded: run `npm run build` and `node harness/audit/check-golden.mjs`. For every FAIL in "No hand-calculated or fixture-specific values", delete the literal from `src/` and compute the value from the input data instead.
8. Tests: if a test expectation was not copied from the spec (for example a number you worked out), replace it with the matching value from SPEC §7, §5.2 or §5.10. If the spec has no value for it, delete that assertion instead of inventing one.
9. Set LB-06A to `DONE` in `harness/STATUS.md`.

## Verify

- `npm run typecheck` → no errors
- `npm test` → all pass
- `npm run build`, then `node harness/audit/check-golden.mjs` → `RESULT: OK`. All of these groups must show only PASS: LB-02 to LB-06, "LB-06A Named formula functions", "Results follow the inputs", "No hand-calculated or fixture-specific values" (including the three "calls the formula functions" lines). Groups for later tasks may show SKIP.

## Acceptance

- [ ] `formulas.ts` matches SPEC §5.10 exactly and its tests pass
- [ ] `route.ts`, `fare.ts` and `remedy.ts` call the formula functions; no inline copies of those formulas remain
- [ ] `packages/evidence/src/` contains no golden numbers, fixture IDs or fixture timestamps
- [ ] Changed-input checks pass (a new rate, fee, route or cancel time changes the results correctly)
- [ ] No spec value was changed

## Stop if

- After the refactor a golden-number check fails. Undo your last edit, compare with SPEC §5.10, and report the failing line if it persists.

## Commit

`LB-06A: route all formulas through named calculation functions`
