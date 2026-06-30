# CPRS Mock EMR — Project Context

## What this is

A self-contained, read-only, browser-based simulation of the VA's VistA CPRS
electronic medical record, built for medical trainees to practice chart
navigation without needing real CPRS access. Three fictional inpatients
(Kowalski, Chen, Okafor) with full chart data across all tabs.

Primary goal: trainees build a "search pattern" — muscle memory for where
things live in the chart — not clinical decision-making practice. Secondary
goal: rough pre-rounding workflow rehearsal.

## Hosting

GitHub Pages serves this repo at a stable URL. WordPress embeds that URL via
an iframe in a Custom HTML block. The site is static (no backend) — any file
in this repo that's reachable from `index.html` is "live" once pushed to
`main`.

## File structure

```
index.html         — page skeleton, header/menu/tab HTML, <script src> tags. Rarely touched.
css/cprs.css        — all visual styling.
js/data.js           — the PTS object: all three patients' full chart data.
js/core.js           — menu system, patient selection dialog, tab switching, loadPatient, drag/resize helpers.
js/render-cover.js   — Cover Sheet tab
js/render-problems.js
js/render-meds.js
js/render-orders.js
js/render-notes.js
js/render-consults.js
js/render-labs.js
js/render-reports.js
js/render-dcsum.js
js/render-surgery.js
js/popups.js         — Vitals Lite, Postings, Order Details, New Note, Encounter dialogs
```

Each tab's rendering logic is self-contained — "the Labs tab is wrong" only
requires opening `render-labs.js`. Patient data lives separately because
it's large and rarely needs touching alongside layout fixes. CSS is separate
because styling feedback is a different kind of edit than logic feedback.

## Locked decisions (do not re-litigate without explicit discussion)

- **Patient switching is File → Select New Patient only.** No clickable
  header icon.
- **Patient Selection dialog auto-opens on page load**, before any patient
  is chosen, every time (not just first load).
- **After selecting a patient, the chart opens to the Notes tab**, not Cover
  Sheet.
- **Header is flat gray (#c0c0c0), not blue.** Verified against real CPRS
  screenshots.
- **Tab order:** Cover Sheet, Problems, Meds, Orders, Notes, Consults,
  Surgery, D/C Summ, Labs, Reports. Surgery comes before D/C Summ — matches
  real CPRS, not assumption.
- **Meds tab has no left pane** — full width, three stacked sections
  (Outpatient / Non-VA / Inpatient).
- **Patient Selection dialog radio list reads "User List"**, not a specific
  clinic name.
- **Patient Selection dialog is draggable (by title bar) and resizable**
  (bottom-right corner handle). When resized, the notifications panel
  (Pending/Processed) must grow to fill the extra space — it should not
  leave dead gray space.
- **CPRS uses very little color.** Default text is black. Blue is reserved
  for clickable links — specifically Postings and Recent Immunizations
  entries on the Cover Sheet. Active Problems and "No Known Allergies" text
  should be plain black, not colored or link-styled.
- **Cover Sheet grid is a fixed 3x3 layout** — the real CPRS
  user-configurable panel resize/reorder/collapse behavior is intentionally
  NOT implemented here. Don't add it unless explicitly asked.
- **No functional Orders entry** — read-only display only, by design.
- **Orders tab right-click context menu is not wired** — clicking a row
  opens the Order Details popup directly instead.

## Known gaps / stubbed areas (not yet built to full fidelity)

- Labs sub-sections beyond Worksheet, Most Recent, and Overview (Pending
  Orders, Graph, Selected Tests, Microbiology, Blood Bank, Anatomic
  Pathology, Lab Orders, Cumulative) are placeholder "no data" states.
- Vitals popout period filters (TODAY/T-1/etc.) are built but not
  functionally wired to filter the data.
- Encounter dialog tab switching (Clinic/Hospital/New Visit) is not
  functionally wired.
- New Note dialog has no save functionality (by design — read-only tool).

## Planned future phases (not started)

In order of prior agreement: (1) tab-by-tab fidelity pass — in progress,
(2) vitals popout refinement, (3) header/visit-selector improvements,
(4) tutorial/guided-mode toggle vs. free-roam, (5) patient case repository
with phenotype switching, (6) functional Orders, (7) PCE/Encounter modal,
(8) AI patient generator.

## Working conventions

- One canonical file per component, overwritten in place — never create
  versioned copies (e.g. no `cprs_v2.html` alongside `cprs.html`). Git
  history is the version control; the working tree should only ever contain
  the current version.
- After any change, the diff Claude Code shows should be reviewed before
  accepting. Once accepted, changes should be committed with a clear message
  describing what changed and why.
- Before pushing to `main`, prefer opening `index.html` locally (or via a
  local server) to visually confirm the change, since this is a UI-heavy
  project where visual regressions are easy to introduce silently.
- See `CPRS_Fidelity_Tracker.md` (if present in repo) for per-tab fidelity
  review status. Update it when a tab's status changes.
