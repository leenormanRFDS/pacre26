# Validation — RFDS Port Augusta V5

Completed 13 October 2026.

- Inspected every archive image individually; 9 photographs plus 1 RGBA cutout. Original photo hashes match the ZIP entries byte-for-byte.
- V4 GLB remains byte-identical: SHA-256 `f72be11b046e4c97220a4c60c423c2f3c2441296e58724a3fd2e0fc3cd56bbea`.
- Both authored browser scripts pass syntax checks.
- Local HTTP preview returned successfully and rendered in the Codex browser.
- Desktop captures at 1440 × 900 cover the hero, Health/Education/Training model and photography states, closed-roof payoff, community and partners.
- Mobile captures at 390 × 844 cover hero, Health model/photography and the longest community copy. Measured active community panel fits above the motion controls.
- Chapter navigation reaches Health; Pause motion changes to Resume motion and its pressed state becomes true.
- Roof and upper-level offsets read exactly `0.000` at the Together beat’s closed hold (phase 0.65), before the real exterior photo fades in.
- Initial-load fade, first-frame timing, model framing and premature final-chapter exit problems discovered during browser QA were corrected. No further errors were observed in the inspected final pages; the browser log retains the earlier, corrected first-frame error.
- Colours and exact hero text are preserved. Approved services, intended audiences, timing and both $1m funders are retained. Unsupported literal floor allocations and old V4 image descriptions are removed.

Limits: Museo webfonts are not supplied/embedded; fallback typography is visible on devices without local Museo. The model is schematic and not surveyed architecture. The OS reduced-motion path and WebGL-failure fallback are implemented, but browser environment emulation of those conditions was not available for this QA. No physical-device or full screen-reader certification is claimed. No supplied classroom/training photography exists. Project-specific contact details remain absent.

## Logo update — 13 October 2026

The supplied RFDS SA & NT colour PDF contains the full logo. A transparent 1969 × 876 PNG rendered from that PDF replaces the header text mark. Checked visually at desktop 1440 × 900 and mobile 390 × 844, preserving its proportions and colours. Only the header logo, its responsive sizing and supporting update records changed.
