# SPEC §5. Calculations

Part of the FairTrip Lane B specification. Index: `harness/SPEC.md`.

All functions are pure (no I/O). Distances are rounded with `Math.round` **only where stated**.

### 5.1 Geo (`geo.ts`) — use this code exactly

```ts
export interface LatLng { lat: number; lng: number }
const EARTH_RADIUS_M = 6371008.8;
const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Unrounded great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const sLat = Math.sin(rad(b.lat - a.lat) / 2);
  const sLng = Math.sin(rad(b.lng - a.lng) / 2);
  const h = sLat * sLat + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * sLng * sLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
/** Distance rounded to whole metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  return Math.round(haversineMeters(a, b));
}
/** Sum of unrounded segment lengths, rounded once at the end. */
export function pathLengthMeters(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];
    if (previous === undefined || current === undefined) continue;
    total += haversineMeters(previous, current);
  }
  return Math.round(total);
}
/** Converts a [lat, lng] tuple from the fixture files. */
export function toLatLng(point: [number, number]): LatLng {
  return {lat: point[0], lng: point[1]};
}
```

### 5.2 Money (`money.ts`)

```ts
/** Integer division rounding halves up. Both arguments must be non-negative safe integers; d > 0. */
export function divHalfUp(n: number, d: number): number {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || n < 0 || d <= 0) throw new Error(`divHalfUp: invalid arguments ${n}, ${d}`);
  const r = n % d;
  const q = (n - r) / d;
  return 2 * r >= d ? q + 1 : q;
}
/** 198 → "S$1.98", 0 → "S$0.00", -300 → "-S$3.00". */
export function formatSgd(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}S$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
```

Test vectors: `divHalfUp(1000*75*150, 100000) = 113`, `divHalfUp(2000*75*100, 100000) = 150`, `divHalfUp(75*100, 100000) = 0`, `divHalfUp(2642*75*100, 100000) = 198`, `divHalfUp(2642*75*150, 100000) = 297`, `divHalfUp(79560, 100) = 796`; throws for `(-1, 5)`, `(1.5, 5)`, `(5, 0)`.

### 5.3 Time (`time.ts`)

`toEpochSeconds(iso: string): number` returns `Date.parse(iso) / 1000` and throws if the result is `NaN`. `secondsBetween(a, b)` returns `toEpochSeconds(b) - toEpochSeconds(a)`.

### 5.4 Route metrics (`route.ts`)

`routeMetrics(fixture, params): RouteMetrics | null`. Returns `null` unless `dispute.category === 'route_deviation'`, `gps.status === 'available'` and `gps.referenceRoute !== null`.

| Field | Rule |
|---|---|
| `referenceMeters` | `pathLengthMeters(referenceRoute.points.map(toLatLng))` |
| `actualMeters` | `pathLengthMeters(driverTrace)` (pings in file order) |
| `excessMeters` | `Math.max(0, actualMeters - referenceMeters)` |
| `excessPct` | `Math.round((excessMeters * 1000) / referenceMeters) / 10` |
| `thresholdMeters` | `Math.max(params.minExcessMeters, divHalfUp(referenceMeters * params.minExcessPercent, 100))` |
| `exceedsThreshold` | `excessMeters > thresholdMeters` (strict) |
| `referenceDurationSec` | `referenceRoute.estDurationSec` |
| `actualDurationSec` | `secondsBetween(trip.startedAt, trip.endedAt)`; if either is null use the first and last ping |
| `extraDurationSec` | `Math.max(0, actualDurationSec - referenceDurationSec)` |
| `unexpectedStops` | §5.5 |
| `pingCount` | `driverTrace.length` |
| `referenceRouteSource` | `referenceRoute.source` |

### 5.5 Unexpected stops

Constants (heuristics, not policy): radius 30 m, minimum 120 s, exclusion 150 m.

```
stops = []; i = 0
while i < pings.length:
  j = i
  while j + 1 < pings.length and distanceMeters(pings[j+1], pings[i]) <= 30: j = j + 1
  duration = secondsBetween(pings[i].ts, pings[j].ts)
  if j > i and duration >= 120
     and distanceMeters(pings[i], trip.pickup) > 150
     and (trip.dropoff is null or distanceMeters(pings[i], trip.dropoff) > 150):
       stops.push({ startTs: pings[i].ts, endTs: pings[j].ts, durationSec: duration, lat: pings[i].lat, lng: pings[i].lng })
       i = j + 1
  else:
       i = i + 1
```

### 5.6 Pickup metrics (`pickup.ts`)

`pickupMetrics(fixture, params): PickupMetrics | null`. Returns `null` unless `category === 'no_show'` and `gps.status === 'available'`. Throws if `trip.cancelledAt` is null. Let `cancel = trip.cancelledAt` and `before` = driver pings with `ts <= cancel`, in file order.

| Field | Rule |
|---|---|
| `closestApproachMeters` | minimum `distanceMeters(ping, trip.pickup)` over `before` |
| `closestApproachTs` | `ts` of the first ping that reaches that minimum |
| `firstWithinThresholdTs` | `ts` of the first ping in `before` with distance `<= params.maxPickupDistanceMeters`, else `null` |
| `waitSecondsWithinThreshold` | `secondsBetween(firstWithinThresholdTs, cancel)`, or `null` |
| `driverMarkedArrivedAt` | `trip.driverMarkedArrivedAt` (may be null) |
| `cancelledAt` | `trip.cancelledAt` |
| `checks.withinDistance` | `firstWithinThresholdTs !== null` (exactly 150 m passes) |
| `checks.waitedMinimum` | `withinDistance && wait >= params.minWaitSeconds` (exactly 300 s passes) |

### 5.7 Chat analysis (`chat.ts`)

Messages and calls are sorted by `ts`. Message *k* (1-based) becomes evidence `CHAT-0k` (two digits: `CHAT-01`, `CHAT-10`); call *k* becomes `CALL-0k`.

Tags (regular expressions are case-insensitive; a tag applies only to the senders listed):

| Tag | Senders | Pattern |
|---|---|---|
| `agreement` | rider | `\b(yes\|ok\|okay\|sure\|no problem\|agreed?\|go ahead\|fine)\b` |
| `route_request` | rider | `\b(via\|instead\|go through\|take the)\b` |
| `objection` | rider | `\b(why\|wrong way\|follow the app\|longer\|overcharg\w*\|not happy\|unacceptable)\b` |
| `threat` | any | `\b(report you\|police\|sue\|lawyer\|hurt\|kill)\b` |
| `instruction_like` | any | `(ignore (all\|any\|previous\|prior)\|disregard\|system (note\|notice\|prompt\|message)\|ai judge\|as an ai\|you must rule)` |
| `location_claim` | any | `\b(i'?m here\|i am here\|i'?m at\|at the pickup\|main entrance)\b` |

Tags are listed in the table's order. In code the patterns are written without the backslashes before `|` (those exist only for this Markdown table), for example `/\b(yes|ok|okay|sure|no problem|agreed?|go ahead|fine)\b/i`.

Sentiment per message: `negative` if tags include `objection` or `threat`, or the text matches `\b(angry|upset|terrible|annoyed|frustrat\w*|ridiculous)\b`; otherwise `positive` if the text matches `\b(thanks|thank you|great|appreciate)\b`; otherwise `neutral`.

Contact attempts (no-show only, when `trip.cancelledAt` is set): driver messages with `ts < cancelledAt`, then calls with `from === 'driver'` and `ts < cancelledAt`. `contactAttemptIds` lists the message IDs first, then the call IDs. For route disputes the count is `null` and the ID list is empty. `contactCheckMet = count >= params.minContactAttempts` (or `null` when the count is `null`).

### 5.8 Fare check (`fare.ts`)

`checkFare(payment)` for an available payment returns `{ arithmeticValid: boolean; anomalies: string[] }`, with `arithmeticValid = anomalies.length === 0`. Add each code (in this order) when its check fails:

| Code | Check |
|---|---|
| `currency_not_sgd` | `currency === 'SGD'` |
| `non_integer_amount` | every line-item `cents`, `totalCents` and `paidCents` is a safe integer |
| `base_mismatch` | if a `base` item exists: sum of `base` cents = `rateCard.baseCents` |
| `distance_mismatch` | if a `distance` item exists: its cents = `divHalfUp(quantity * perKmCents, 1000)` |
| `time_mismatch` | if a `time` item exists: its cents = `divHalfUp(quantity * perMinCents, 60)` |
| `surge_mismatch` | if `surgeMultiplierX100 > 100`: a `surge` item exists with cents = `divHalfUp((base + distance + time) * (X100 − 100), 100)` (missing items count 0); if `= 100`: surge cents sum to 0 |
| `promo_positive` | every `promo` item has cents `<= 0` |
| `negative_item` | every non-promo item has cents `>= 0` |
| `no_show_fee_mismatch` | if a `no_show_fee` item exists: sum = `rateCard.noShowFeeCents` |
| `total_mismatch` | sum of all line items = `totalCents` |
| `paid_mismatch` | `paidCents === totalCents` |

When a `distance` or `time` item has no `quantity`, or a value is not a safe integer, record the matching anomaly instead of calling `divHalfUp` (which would throw).

### 5.9 Remedy basis (`remedy.ts`)

`remedyBasis(fixture, route, fare)` returns `null` when the payment is unavailable; otherwise exactly three entries in this order. Each entry is `{ remedyId, eligibleCents: number | null, formula: string, unavailableReason: string | null }`.

1. `keep_charge`: `eligibleCents 0`, formula `"0 (charge unchanged)"`, reason `null`.
2. `refund_route_excess`: the first failing condition gives `eligibleCents null` with this reason:
   category is not `route_deviation` → `"not applicable to category"`; `route` is null → `"GPS route metrics unavailable"`; fare invalid → `"fare arithmetic invalid"`; `!route.exceedsThreshold` → `"detour not material under RD-1"`; no `distance` item → `"no distance line item"`. Otherwise, with `x = surgeMultiplierX100`, `per = rateCard.perKmCents`, `dc` = sum of distance cents:
   `eligibleCents = Math.min(divHalfUp(route.excessMeters * per * x, 100000), divHalfUp(dc * x, 100), paidCents)`.
3. `refund_no_show_fee`: category is not `no_show` → `"not applicable to category"`; fare invalid → `"fare arithmetic invalid"`; no-show fee items sum to 0 → `"no no-show fee charged"`; otherwise `eligibleCents = Math.min(feeSum, paidCents)`.

Formula text is free-form (for display), for example `min(divHalfUp(2642 x 75 x 100, 100000) = 198, divHalfUp(795 x 100, 100) = 795, paid 1473) = 198`.
