# FairTrip submission demo

- Video: `fairtrip-demo.mp4` (7,363,027 bytes; re-encoded on 16 October 2026 with H.264 CRF 18, same frames, audio unchanged).
- Duration: 7 minutes 39 seconds; 1280 × 720; MP4 with audio.
- Edited UI walkthrough with synthesized English narration and burned-in captions.
- Companion files: `fairtrip-demo.srt` and `fairtrip-demo-transcript.txt`.

## Provenance

- Route deviation R1: live run `f3086388-2333-41a9-85a3-05022f81b0a0`, rider favoured, recommended refund S$1.98.
- No-show N2: live run `5b2b72f6-8b8f-4ca3-ba93-6e34f5286ce2`, driver favoured, charge upheld.
- History variation N2H: live attempt and automatic re-run failed; UI displayed no decision and no payment amount. Captured re-run: `085e5ca4-d6ec-4b42-9ed2-e043cb78dc28`.
- Escalation and missing-GPS examples use the app's clearly labelled saved case reviews. The video explicitly discloses this.
- Measured metrics come from `submission/metrics/scorecard.md`, dated 13 October 2026.
- CodeBuddy development captures come from `docs/evidence/`. On 16 October 2026 a personal first name and a Windows home path were masked with solid boxes in four of those captures and in the two places they appear in the video's CodeBuddy chapter (about 6:02–6:14 and 6:28–6:39); nothing else in the captures or the video was altered.
- Synthetic dispute data and demonstration policy throughout. No payments executed.

## Verification

- Decoded eight frames from the exported video and inspected their layout.
- Confirmed one 1280 × 720 video track, one non-silent audio track, and duration within 5–8 minutes.
- Confirmed the MP4 opens in QuickTime.
- Re-encode quality against the original export (ffmpeg PSNR): 56.3 dB average over 1:30–1:50 (UI walkthrough) and 48.3 dB average over 6:00–6:40 (the chapter with the masked boxes).

## Chapters

- 00:00 — FairTrip
- 00:40 — Four agents. One visible hearing.
- 01:26 — Route deviation
- 02:09 — Evidence you can inspect
- 02:51 — No-show charge
- 03:35 — Human oversight
- 04:19 — Safe failure
- 05:05 — Measured prototype results
- 05:54 — Built with CodeBuddy
- 06:49 — Next steps
