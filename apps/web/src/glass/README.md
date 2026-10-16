# FairTrip hearing room (glass)

This interface is the main web UI. The original interface remains available as
**Classic** at `/classic.html`; no existing application source, dependency, or
environment setting is changed by this edition.

## Try it

From the repository root, start the normal web development server:

```sh
npm run dev:web
```

Open **http://127.0.0.1:5173/**. The original interface remains at `/classic.html`
(the toolbar's **Classic view** link goes there).

- **Explore cases** opens the scenario selector in the **Case** segment. All 20
  included synthetic scenarios are available without the API or a model key; every
  one is a validated live recording captured from the server's replay mode
  (`npm run capture:demo-scenarios`). Each scenario shows its
  example label. Hearings automatically begin at the first event when opened or
  selected. **View case review** restarts the saved events, evidence,
  cases, and final result in order. **Pause review** pauses this sequence; **Continue review**
  continues it. The replay timing is accelerated; Hearing Lines presents
  milestones in fixed stages. It does not make new model requests or
  evaluate edited claims. During playback, the main action shows a spinner and
  **Viewing case review…**; the scenario selector remains available. Hearing Lines has a
  smoothly animated SVG **Case review progress** bar based on the revealed event count.
  These actions view saved examples; they do not start another review or appeal.
- **Live hearing** uses the preview's concise presentation with the existing fixture,
  polling, and citation helpers. **Review my case** starts a new review and
  shows **Reviewing your case…** while processing. Claim editing remains available under
  **Edit claim**. Start `npm run dev`
  separately to use this mode. Changing away from Live hearing stops watching the run;
  it does not cancel a backend workflow already started. The live progress bar is
  labelled **Review stages** and advances only on observed milestones, without
  implying an elapsed-time estimate. A successful final decision reaches 100%;
  missing evidence or a failed review stays partial with an attention message.
  If the connected API runs in replay mode, its source and action are labelled as
  recorded case reviews and claim editing is hidden. A completed Judge
  recommendation awaiting human review is labelled **Human review**, with a proposed
  amount rather than a final payment, the escalation reasons, and — when the Judge
  diverged from the policy rules — both outcomes side by side. In connected mode the
  verdict offers **Confirm ruling**, **Override…**, and **Apply policy verdict** when
  the deterministic verdict names a different remedy; offline it notes that reviewer
  actions need a connected hearing. After review, the verdict and final checkpoint
  use the human decision; the original Judge findings remain labelled separately.
  Recorded playback can reach 100% even when that recording needs human review;
  the status describes playback completion and the unavailable decision clearly.
  Runs retried by the API after a failed first attempt show a re-run note above the
  verdict; earlier runs on the same server sit in a collapsed **Earlier runs on
  this server** disclosure at the bottom of the hearing board and resume an
  earlier run, and `?run=<id>` deep links open the same run directly.
- The moon/sun button switches the theme. Interactive motion is part of the default
  interface; there is no application motion preference or 3D opt-in label.
  The CSS and pointer handlers silently honor the operating system's reduced
  motion setting. Theme and mode selections last for this browser session only
  and reset on page reload.

## Check and build

```sh
npm run verify:web
cd apps/web
../../node_modules/.bin/vite build --config vite.glass.config.ts
```

The separate preview build is written to `apps/web/dist/glass-preview/`, which is
already covered by the repository's `dist/` ignore rule. The normal build remains
independent. A built Live API mode still requires a same-origin `/api` proxy; the
recorded mode is self-contained.

That build also generates `dist/glass-preview/preview.html`: a single-file offline
preview with inline React/CSS/data. Open it locally and refresh after rebuilding.
Live hearing is disabled in this offline file; scenario selection, replay, key points,
citations, theme switching, and interactive checkpoints remain available.

## Open Design source

Used the installed **Open Design 0.24.1** Glassmorphism package under:

```text
/Applications/Open Design.app/Contents/Resources/open-design/design-systems/glassmorphism/
```

Read `USAGE.md`, `DESIGN.md`, `components.manifest.json`, and the reference
`components.html`. `opendesign-tokens.css` is copied unchanged from that package's
`tokens.css`. `glass.css` adapts its frosted surfaces, border and elevation system,
primary actions, and motion guidance to a pink theme inspired by the user's
requested #DE3163. Deeper rose actions preserve readable white button text;
blush surfaces and distinct rose/plum agent colors retain clear labels. This
requested color is not represented as a verified official Ryde specification. Dark
theme variants and no-blur fallbacks are defined locally. This is based on the
curated bundled design system, not an upstream brand specification. The desktop
interface timed out during automation; this preview uses the installed local
design resources directly.

The recorded JSON holds all 20 synthetic fixtures, replayed through the server's
replay mode so each run carries its risk assessment, policy verdict, escalation
decision, and precedents exactly as a live run produced them. It contains
synthetic evidence and a demonstration policy; it does not contain configuration
or model credentials. Confidence remains model-assessed. Escalated runs without a
human decision stay pending review — that is the honest offline state. The
recordings and calculations were not rewritten for this design.

The liquid edition adds a draggable four-layer glass sculpture. Drag with a mouse
or pen to rotate it, or focus it and use the arrow keys; Home resets its pose.
Rider / Driver / Risk / Judge buttons explain each of the four agent perspectives. Touch devices retain
normal page scrolling and can use those buttons. Every main section, the toolbar,
footer, claim cards, evidence cards, policy cards, and gauges share dimensional
glass rims and stacked shadows even at rest. Hovering those surfaces moves their
reflected light and adds a small perspective tilt. These effects are a
CSS/SVG simulation of liquid glass, not a physically based renderer.

The header uses centered controls with balanced side columns; the hero uses equal
columns. Three raised action tiles jump to Case, Hearing Lines, and Verdict.
Claims, verdict and policy use matching grids, shared gutters, and shorter gaps.
Desktop hearing panels stretch to match their row and expand with their content,
without fixed minimum heights. Pending verdicts do not reserve an empty second column.
Evidence headings span the full grid, and an odd final record fills the row.
Small screens stack the same content instead of keeping empty desktop columns.

The default view shows short key points rather than long statements. Long source
statements are explicitly labeled excerpts, with full readable text available in
disclosures. Source identifiers and remedy codes are replaced by descriptive
labels for presentation only. Default role panels show up to three arguments/findings and
three citations per point; the rest remain expandable and clickable. Evidence
bullets read the server-computed facts directly. No underlying evidence, decision,
or calculation is rewritten. Raw JSON, trace exports, and technical IDs are not
presented in the user interface. Evidence category filters and expandable cards
provide progressive detail; readable source links reveal filtered evidence.

The order is **Case → Verdict → Hearing Lines → Cases and findings → Evidence →
Policy**. The verdict has a separate heading, status badge, large final decision,
and recorded amount, accompanied by a dimensional decision/review seal.
Pending, failed, incomplete, and stub-example states do not
render a final monetary verdict. Confidence on scripted scenarios is explicitly
illustrative, rather than a model measurement.

Hearing Lines has four fixed stages — evidence reviewed, case ready, judge review,
and decision — over three agent tracks, plus a fourth **Risk Analyst** track when
the run produced a risk assessment. Raised markers appear only when the
corresponding recorded events exist: advocate evidence and case points, an
**Assessment ready** risk point, a **Precedents checked** point just before the
review column, the Judge review, and the decision. Future routes are absent from
the DOM: advocate paths require evidence and a completed case, handoffs (including
the risk lane's) require that case and `judge.started`, and the final path requires
a terminal event.
Reached paths draw with normalized SVG strokes in process order. Hover/focus shows concise
key points; click/tap pins them, and Escape dismisses them. The full activity log
— every event with actor, elapsed time, summary, and citation chips — is available
under a collapsed **Show full activity log** disclosure below the checkpoints. Keyboard and horizontal scrolling
are supported on narrow screens. The four-agent 3D panel is visible at the top
right on desktop, with selectable explanations and a draggable glass sculpture.
A **Risk analyst** panel sits below the hearing columns whenever the run carries
an assessment — context only; it never decides the outcome — and the Judge column
lists the policy verdict and the precedents considered.

Motion uses React state, CSS opacity/transform transitions, and normalized SVG
strokes. The pointer light and
tilt update once per animation frame without rerendering the hearing data.
Remotion was not required for these interactive effects; no package was installed.

## Readability and loading

Primary copy is 18px, with supporting labels generally at least 14px and larger
section headings. Small-screen action tiles become compact stacked rows so
larger labels do not overflow; the timeline scrolls horizontally on narrow screens.

The preview continues to use system fonts and inline SVG assets without external
font or media downloads. The redundant `demo-run.json` import was removed, while
the original file remains available. `demo-data.ts` validates the catalogue at
startup and validates each selected recording once before caching it; all recordings
remain bundled for the offline file. No contract checks or source evidence are removed.
Unused trace-export code is no longer imported. Soft radial gradients replace the
large animated Gaussian-blur layers; prism highlights no longer use turbulence or
displacement filters, and narrow screens use lighter panel blur. Pointer tilt and
progress animations remain enabled. Bundle measurements describe payload size,
not a guaranteed browser load time or a production Lighthouse result.

## Typography and symbols

The preview uses native `system-ui` type, a restrained heading/body hierarchy,
and consistent optical sizing. It follows the principles in Apple's official
[font guidance](https://developer.apple.com/documentation/technologyoverviews/fonts)
and uses its [iPhone page](https://www.apple.com/iphone/) as a hierarchy reference.
No Apple font files are downloaded or bundled.

The original 24px SVG family in `HearingSymbol.tsx` uses familiar transport and
review metaphors, consistent rounded strokes, and a quiet tint. The system
approach was informed by Uber's published
[design platform article](https://medium.com/uber-design/uber-design-platform-1ebff86c89e7).
No competitor symbol paths, logos, or illustration assets are copied. The same
family appears in navigation, action tiles, agent cards, checkpoints, and evidence.

## Files

- `../../index.html`: the main entry — this interface.
- `../../classic.html`: the original interface, kept as Classic.
- `../../vite.config.ts`: multi-page build for both entries.
- `../../vite.glass.config.ts`: independent single-file offline preview build.
- `main.tsx`: React mount and isolated stylesheet imports.
- `GlassPreview.tsx`: toolbar, ambient layers, theme, prism, and source switch.
- `RecordedHearing.tsx`: offline recording replay using existing hearing components.
- `demo-scenarios.json`: validated recorded runs for all 20 fixtures.
- `demo-data.ts`: validated catalogue and cached recording access.
- `LiveHearing.tsx`: connected workflow using the same concise presentation.
- `HearingPresentation.tsx`: scenario selector, distinct verdict, review actions, compact evidence/policy.
- `KeyPoints.tsx`: source-based bullet excerpts and compact advocate/Judge panels.
- `RiskSummary.tsx`: compact context-only Risk Analyst panel.
- `review-actions.ts`: which reviewer actions a run is eligible for.
- `LiquidHearingLines.tsx`: raised interactive hearing checkpoints and source summaries.
- `hearing-progress.ts`: playback percentages and observed live review milestones.
- `hearing-progress.test.ts`: progress bounds, pause, retries, and terminal-state checks.
- `hearing-lines.test.ts`: risk lane, precedent checkpoint, and ordering.
- `verdict.test.ts`: final decisions, pending human review, and reviewer overrides.
- `review-actions.test.ts`: reviewer-action eligibility per run state.
- `HearingSymbol.tsx`: original shared SVG symbol family.
- `demo-run.json`: validated synthetic R1 recording.
- `opendesign-tokens.css`: copied Open Design tokens.
- `glass.css`: scoped glassmorphism theme and responsive motion styles.
- `../../../../scripts/capture-demo-scenarios.ts`: regenerates `demo-scenarios.json` from the replay API.

These files are the main interface; the Classic UI in `../components` and `../App.tsx`
remains independent and does not import them.
