# SPEC §7. Golden values (computed from the data files; tests must match exactly)

Part of the FairTrip Lane B specification. Index: `harness/SPEC.md`.

Reference route (all route fixtures): `referenceMeters 7956`, `thresholdMeters 796`, `estDurationSec 716`.

| Fixture | actualMeters | excessMeters | excessPct | exceeds | actualDurationSec | extraDurationSec | stops | pingCount |
|---|---|---|---|---|---|---|---|---|
| R1 | 10598 | 2642 | 33.2 | true | 1134 | 418 | 1 × 180 s, start 2026-10-02T11:13:58Z, end 11:16:58Z, at 1.315, 103.885 | 22 |
| R1S | 10598 | 2642 | 33.2 | true | 1134 | 418 | 1 × 180 s, start 2026-10-02T12:28:58Z | 22 |
| R2 | 9505 | 1549 | 19.5 | true | 855 | 139 | 0 | 18 |
| R3 | 9678 | 1722 | 21.6 | true | 870 | 154 | 0 | 18 |

| Fixture | closestApproachMeters | closestApproachTs | firstWithinThresholdTs | wait (s) | withinDistance | waitedMinimum | contact attempts |
|---|---|---|---|---|---|---|---|
| N1 | 414 | 2026-10-03T08:01:58Z | null | null | false | false | 1 (CHAT-01) |
| N2 | 31 | 2026-10-03T09:02:44Z | 2026-10-03T09:02:44Z | 430 | true | true | 3 (CHAT-01, CHAT-03, CALL-01) |
| N2H | 31 | 2026-10-03T09:42:44Z | 2026-10-03T09:42:44Z | 430 | true | true | 3 (CHAT-01, CHAT-03, CALL-01) |
| N3 | 24 | 2026-10-03T10:22:44Z | 2026-10-03T10:22:44Z | 210 | true | false | 1 (CHAT-01) |
| X2 | 31 | 2026-10-03T11:02:44Z | 2026-10-03T11:02:44Z | 430 | true | true | 3 (CHAT-01, CHAT-03, CALL-01) |
| X3 | 31 | 2026-10-03T11:42:44Z | 2026-10-03T11:42:44Z | 430 | true | true | 3 (CHAT-01, CHAT-03, CALL-01) |

| Fixture | Line items (cents) | Total | Valid | refund_route_excess | refund_no_show_fee |
|---|---|---|---|---|---|
| R1 | base 300, distance 795, time 378 | 1473 | yes | 198 | null (not applicable to category) |
| R1S | base 300, distance 795, time 378, surge 737, promo −300 | 1910 | yes | 297 | null |
| R2 | base 300, distance 713, time 285 | 1298 | yes | 116 | null |
| R3 | base 300, distance 726, time 290 | 1316 | yes | 129 | null |
| X1 | base 300, distance 930, time 420 | 1650 | yes | null (GPS route metrics unavailable) | null |
| N1, N2, N2H, N3, X2 | no_show_fee 500 | 500 | yes | null (not applicable to category) | 500 |
| X3 | payment unavailable | — | — | no PAY-REMEDY record | — |

Chat tags (messages without tags are omitted): R1 and R1S `CHAT-01 objection`, `CHAT-03 objection`; R2 `CHAT-01 route_request`, `CHAT-03 agreement`; R3 `CHAT-02 agreement`; X1 `CHAT-01 objection`; N1 `CHAT-01 location_claim`, `CHAT-02 location_claim`; N2, N2H and X3 `CHAT-01 location_claim`, `CHAT-02 agreement`, `CHAT-03 location_claim`; X2 as N2 plus `CHAT-04 instruction_like`; N3 `CHAT-01 location_claim`.

Sentiment counts `{positive, neutral, negative}`: R1, R1S `{0,2,2}`; R2 `{0,4,0}`; R3 `{0,2,0}`; X1 `{0,1,1}`; N1, N2, N2H, X3 `{0,3,0}`; N3 `{0,2,0}`; X2 `{0,4,0}`.
