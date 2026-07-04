# CPRS Mock EMR — Project Context

## What this is

A self-contained, read-only, browser-based simulation of the VA's VistA CPRS
electronic medical record, built for medical trainees to practice chart
navigation without needing real CPRS access. Five fictional inpatients
(Kowalski, Chen, Okafor, Brennan, Hayes) with full chart data across all tabs.

Primary goal: trainees build a "search pattern" — muscle memory for where
things live in the chart — not clinical decision-making practice. Secondary
goal: rough pre-rounding workflow rehearsal.

## Hosting

GitHub Pages serves this repo at a stable URL. WordPress embeds that URL via
an iframe in a Custom HTML block. The site is static (no backend) — any file
in this repo that's reachable from `index.html` is "live" once pushed to
`main`.

### Analytics

- **Cloudflare Web Analytics is wired in** via a single `<script defer>` snippet in `index.html`'s `<head>` (right before `</head>`), added because the user wanted a rough sense of real-world usage without a heavier third-party tool or any cookies/consent-banner obligation. Token is tied to the `mrgtran92.github.io` hostname, set up via the JS-snippet (not DNS-proxy) method since GitHub Pages' shared `github.io` domain can't be added as a Cloudflare-managed domain.
- **What it can and can't tell you**: this is pageview-only tracking (no event API on Cloudflare's free tier). Since the whole app is a single-page, JS-driven UI (tabs/dialogs never trigger a real navigation), the dashboard will show "the tool was opened N times" — it cannot show which tab, feature, or tutorial module got used. If per-feature usage data is ever wanted, that requires swapping to something with a real event model (e.g. GA4), accepting its cookie/consent tradeoffs.
- **"Unique visitors" are really "unique visiting sessions,"** not a precise headcount of distinct humans — Cloudflare dedupes via a rotating anonymous fingerprint (IP+UA+daily salt, no persistent cookie), which correctly collapses same-session reload spam (e.g. the repo owner reloading the page 10x while testing shows as 1 visit) but will generally count the same real person as a "new" visit again the next day.
- **Check usage** at `dash.cloudflare.com` → Analytics → Web analytics → the `mrgtran92.github.io` site entry, any time.

## File structure

```
index.html              — page skeleton, header/menu/tab HTML, <script src> tags. Rarely touched.
css/cprs.css            — all visual styling.
js/data.js              — the PTS object: all five patients' full chart data.
js/core.js              — menu system, patient selection dialog, tab switching, loadPatient, drag/resize helpers.
js/render-cover.js      — Cover Sheet tab
js/render-problems.js   — Problems tab
js/render-meds.js       — Meds tab
js/render-orders.js     — Orders tab
js/render-notes.js      — Notes tab
js/render-consults.js   — Consults tab
js/render-labs.js       — Labs tab
js/render-reports.js    — Reports tab
js/render-dcsum.js      — D/C Summ tab
js/render-surgery.js    — Surgery tab
js/popups.js            — Vitals Lite, Postings, Order Details, New Note, Encounter, Patient Inquiry, PACT/Primary Care, PDMP, JLV, VistA Imaging dialogs; showFloatWin/closeWin/centerFloatWin/makeDraggable/makeResizable helpers
js/personal-lists.js    — Tools > Options dialog, Personal Lists dialog, New Personal List dialog, and the Patient Selection dialog's Team/Personal picker + Save Settings default-list flow
js/tutorial.js          — Guided tour engine + DIALOG_TOUR_STEPS + CHART_TOUR_STEPS + 7 standalone sub-tutorial modules (personal-list, MAR, header, imaging, notes-tools, labs-views, reports-views) + TOUR_MODULES picker
```

Each tab's rendering logic is self-contained — "the Labs tab is wrong" only
requires opening `render-labs.js`. Patient data lives separately because
it's large and rarely needs touching alongside layout fixes. CSS is separate
because styling feedback is a different kind of edit than logic feedback.

---

## Completed work (this session)

### Bug fixes — Labs Worksheet date/time column + PDMP Results dialog positioning (`js/render-labs.js`, `js/popups.js`)
- **Labs Worksheet Date/Time column malformed for Okafor's DKA panel.** `labColToDateTime()` in `render-labs.js` matched a column header's `MM/DD` prefix but only stripped trailing `AM`/`PM`, so relative-offset labels in Okafor's `"DKA PANEL -- SERIAL BMP"` panel (`cols:["06/19 Adm","06/19 +6h","06/19 +12h","06/20","Ref"]`, in `data.js`) got spliced into the middle of the formatted string — e.g. `"06/19 Adm/2026 06:00"` instead of a readable date. First pass parsed the date and trailing label as separate pieces (`06/19/2026 06:00 (Adm)` etc.) — fixed the string-concatenation bug but looked confusing live, since all three rows showed the same `06:00` with only the parenthetical differing. Corrected further: `labColToDateTime()` now computes an actual offset time for `Adm`/`+Nh` labels (`Adm` = baseline 06:00, `+6h` = 12:00, `+12h` = 18:00), so the Worksheet now shows three genuinely distinct times (`06/19/2026 06:00`, `06/19/2026 12:00`, `06/19/2026 18:00`) instead of a label appended to an unchanged time. A full QC sweep across all 5 patients' `data.js` lab panels (against every parsing function in `render-labs.js`) turned up three more related gaps, all now fixed:
  - **Chen's `"ARTERIAL BLOOD GAS -- SERIAL"` panel** had columns already wrapped in parens (`"06/19 (RA)"`, `"06/20 (4L NC)"`) — `labColToDateTime()` was re-wrapping the already-parenthesized label in another set of parens, producing `((RA))`/`((4L NC))`. Fixed by stripping any existing surrounding parens off the label before deciding whether to re-wrap it.
  - **Kowalski's `BASIC METABOLIC PANEL`** columns `"06/19AM"`/`"06/19PM"` (no space before the AM/PM suffix) failed `labColToDateTime()`'s regex entirely (required `\s+` between date and label), silently dropping those two collection times from the Worksheet trend table with no visible indication. Fixed by loosening the regex to `\s*` (tolerates zero or more spaces).
  - **`getPanelDate()`'s Result/Reference-panel branch** (used by Most Recent/Lab Overview to pull a date out of a panel name like `"URINALYSIS (06/18)"`) required the parenthesized suffix to be a *bare* `MM/DD` — panel names with trailing text inside the same parens (Chen's `"ARTERIAL BLOOD GAS (06/19 RA)"`, Okafor's `"ABG (06/19 17:20)"`) failed to match, so those panels showed a blank date in Most Recent and a wrong hardcoded fallback date in Lab Overview. Fixed by loosening the regex to tolerate trailing text before the closing paren. Okafor's `"DIABETES WORKUP"` panel had no parenthesized date in its name at all (the other gap `getPanelDate()` couldn't infer around) — renamed to `"DIABETES WORKUP (06/19)"` in `data.js` to give it a real date signal, consistent with sibling panels.
  - Also skipped one panel-blank-row edge case (an unrelated panel like an ABG panel injecting an empty date row into a BMP-focused Worksheet trend table) — panels containing none of the user's selected tests are now excluded entirely from `slOK()`'s date-column iteration.
Confirmed via the full sweep that Brennan and Hayes's lab panels were already clean (no similar column/name-date parsing issues) — all fixes above are scoped to Kowalski (1 panel) and Chen/Okafor (their ABG-related panels).
- **PDMP Results dialog (`#pdmp-results-dlg`) opening at a stale/incorrect position, breaking `PDMP_TOUR_STEPS` step 4/5 card positioning.** Root cause: it's a single shared DOM element (not per-patient), and `openPdmpResultsPopup()` never reset its `left`/`top` on open — only `showFloatWin()`/`makeDraggable()` touched it, so a drag or resize during any prior session (on any patient) left stale inline positioning that persisted into the next patient's chart (reproduced on Okafor's chart, not on Brennan's, purely due to leftover state, not patient-specific logic). First attempted fix (calling `centerFloatWin()` to screen-center it) was wrong per user feedback/screenshots — the correct behavior is the dialog's original fixed position (`top:20px; left:60px`, matching its default inline style in `index.html`), not centered. Fixed by explicitly resetting `dlg.style.top`/`dlg.style.left` to those defaults at the start of every `openPdmpResultsPopup()` call, so drag/resize residue can never carry over between sessions or patients. No changes needed in `js/tutorial.js` — the tour card anchors off `#pdmp-pend-panel` inside the dialog, so it follows automatically.

### PDMP Query two-click flow + Results popup + pended note (`js/popups.js`, `index.html`, `css/cprs.css`, `js/tutorial.js`)
- **`hbtn-pdmp` is now a real two-click workflow**, matching real CPRS, replacing the old single-click "silently files a note" placeholder. `handlePdmpClick()` in `popups.js`: first click sets that patient's `pt._pdmpState` to `'querying'`, relabels the button to **Querying...**, then after ~1.2s flips to `'results'` and relabels to **PDMP Results**. A second click on `'results'` state opens the new `#pdmp-results-dlg` popup instead of filing anything directly.
- **State is per-patient** (`pt._pdmpState`, stored on each of the 5 patient objects, not global) — `updatePdmpButton()` is called from `loadPatient()` in `core.js` so the button always reflects whichever chart is currently open, and querying one patient doesn't affect another's button state. Confirmed functional identically for all 5 patients — nothing about the flow is hardcoded to a specific patient.
- **`#pdmp-results-dlg`** (new float-win in `index.html`, ~900x640, draggable/resizable) reproduces the real results screen from user-supplied screenshots: patient name/age/"Data as of" header, "Status of States Queried" bar, a no-PMP-data-found warning banner, and Demographics/Summary/Prescriptions sections (Summary's Narcotics/Buprenorphine sub-columns, Prescriptions table) — all populated from `currentPt` but showing zero counts, since no PDMP hits are modeled for any patient.
- **Pended-note panel** at the bottom of the results popup (`#pdmp-pend-panel`) — four radio-button summary statements (matching the screenshot exactly, e.g. "No prescription(s)...", "...do not raise significant safety concerns...", etc.) plus a free-text box. **Done and Create Note** files a note titled `STATE PRESCRIPTION DRUG MONITORING PROGRAM` (format matches the real note: LOCAL/STANDARD TITLE, DATE/ENTRY DATE, `AUTHOR: TRAN,GEORGE N` — the sim's established logged-in user — `STATUS: UNSIGNED`, PDMP Appriss Gateway boilerplate, then the selected radio statement + any free text) into that patient's Notes tab; guarded against re-filing if already filed. **Cancel Without Update** (and the dialog's own X) just closes without filing. The panel hides itself once a note has already been filed for that patient.
- **New standalone tour module** `PDMP_TOUR_STEPS` ("PDMP Query & Results" in the `TOUR_MODULES` picker, `startPdmpModule()`) — 6 steps walking the full two-click flow, reading the results screen, and filing the pended note. The existing `HEADER_TOUR_STEPS` PDMP step still highlights `#hbtn-pdmp` directly (per user correction — don't remove the highlight just because a module exists) but its text is now short and cross-references the new module for the full walkthrough, rather than describing the whole flow inline.
- **Bug fix — module now switches to the Notes tab.** Every step in `PDMP_TOUR_STEPS` now calls `goTab('notes')` in its `before()` hook (matching the existing pattern already used by `NOTES_TOOLS_TOUR_STEPS`), since the pended note it teaches only becomes visible/relevant there — triggering the module from another tab (e.g. Labs, Orders) now correctly jumps the trainee to Notes first instead of leaving them wherever they were.

### Remote Data: header dropdown + Reports tab Health Summary "Remote..." reports (`js/popups.js`, `js/render-reports.js`, `js/data.js`, `index.html`, `css/cprs.css`, `js/tutorial.js`)
- **`#hbtn-remote-data` now opens a real anchored accordion panel** (`#remote-data-panel`, positioned via CSS directly under the `.hbtn-stack` JLV/Remote Data buttons, not a floating dialog) instead of the old "not yet detailed" placeholder popup — `toggleRemoteDataPanel()` replaces the removed `openRemoteDataInfo()`/`remote-data-dlg`. Panel matches the user's screenshot: an **All Available Sites** select-all checkbox, a decorative non-interactive **Non-VA Data may be Available - Use JLV to Access** line (that's the JLV workflow, not this one), and one checkbox row per remote site with its **Last Seen** date. Closes on outside click (`_remoteDataOutsideClick()`, same pattern as the PACT popup).
- **All 5 patients now have a `remoteSites` array in `data.js`** (one fictional other-VA-facility site each, matching the screenshot's single-site example): Kowalski → Raymond G. Murphy Vamc (Albuquerque), Chen → VA Long Beach Healthcare System, Okafor → VA San Diego Healthcare System, Brennan → VA Palo Alto Health Care System, Hayes → VA Loma Linda Healthcare System — each with a station number and a plausible last-seen date before that patient's Jun 20,26 admission.
- **Checked-site state is per-patient** (`pt._remoteChecked`, an object keyed by site name), set via `setRemoteSiteChecked()`/`toggleAllRemoteSites()`, and persists across tab switches within that patient's chart.
- **Reports tab → Health Summary is now a populated tree** (previously an empty placeholder leaf) built from a real screenshot's item list — ~45 items total, matching real CPRS's dense Health Summary type list. Only the 7 **Remote**-prefixed items carry a `remote:` flag routing to `buildRemoteReport()`; every other item (Adhoc Report, Covid-19 Information, Bcma Med Log, the various Cers-* items, etc.) is decorative, showing the same "No matching documents found" placeholder as other unmodeled report types. **Starts collapsed by default** (`expand:false`) — a first pass shipped it `expand:true`, but per user correction it should match the collapsed-by-default convention used by Clinical Reports and every other collapsible tree node in this app.
- **Three Remote report types have real, distinct generated content** (per user's explicit choice to build a few different ones, not just one): **Remote Clinical Data (1y)** (`buildRemoteClinicalData()` — demographics/address/phone from `pt.inquiry`, allergies from `pt.allergies`, a vitals section that intentionally reads "Temporarily disabled / NOT IN USE" matching the real screenshot, active problems from `pt.problems`, and outpatient pharmacy from `pt.meds_home`), **Remote Labs Long View (12y)** (`buildRemoteLabsLongView()` — dumps every panel in `pt.labs`), and **Remote Meds/Labs/Orders (1y)** (`buildRemoteMedsLabsOrders()` — combines `pt.meds_home`, the first 5 `pt.orders`, and the most recent lab panel). The other 4 Remote-prefixed items (`Remote Clinical Data (4y)`, `Remote Clinical Reminders`, `Remote Demo/Vitals/Pce (1y)`, `Remote Outpatient Meds (6m)`, `Remote Text Reports (1y)`, `Remote Dis Summ/Surg/Prod (12y)`) show an honest "isn't modeled in this simulation" placeholder — all still real content per patient/site, not hardcoded to one patient.
- **Tab bar UI**: clicking any Remote report item builds a `Local | <site name>` tab row (`.remote-tabbar`/`.remote-tab`, matching the screenshot), one tab per site currently checked in the header's Remote Data panel, defaulting to the first checked site (or **Local** if none are checked — Local always shows a placeholder explaining that Local Health Summary fidelity isn't the point of this feature).
- **New standalone tour module** `REMOTE_DATA_TOUR_STEPS` ("Remote Data (Other VA Facilities)" in the `TOUR_MODULES` picker, `startRemoteDataModule()`) — 6 steps covering the Remote Data vs. JLV distinction, opening the dropdown, checking a site, navigating to Reports → Health Summary, and reading the tabbed report. The `HEADER_TOUR_STEPS` JLV/Remote Data step was split into two separate steps (one per button, each still highlighting its own button directly) so Remote Data gets its own short cross-reference to this new module without losing the existing JLV content.

### Templates: popup → inline accordion (`js/render-notes.js`, `js/tutorial.js`, `index.html`, `css/cprs.css`)
- **`/ Templates` button in the Notes tab no longer opens a floating popup** (`templates-dlg` removed from `index.html` and its dedicated CSS) — per user correction, real CPRS expands it as an inline accordion in place, not a separate dialog.
- The template tree markup now lives inline inside `.btn-area`, **between the Templates button and the Encounter button** (an earlier pass first put it above the Templates button, which was also wrong — corrected per user feedback to match real CPRS placement), toggled open/closed via `toggleTemplatesAccordion()` in `render-notes.js`. Caret glyph flips ▸/▾ on toggle; **the `/` before "Templates" was preserved** in the button label alongside the new caret (an earlier pass accidentally dropped it when adding the caret — restored per user correction: `▸ / Templates` / `▾ / Templates`).
- `js/tutorial.js`'s `NOTES_TOOLS_TOUR_STEPS` Templates step and `closeTeachingPopups()` updated accordingly — the tour step now expands the accordion and spotlights `#tpl-accordion` directly instead of opening/targeting the removed dialog; the cleanup helper now collapses the accordion (resets both its `display` and the button's caret) instead of calling `closeWin('templates-dlg')`.

### Pre-login screen (no patient selected)
- **`#pthdr` (patient header bar) is always visible**, including before any patient is selected — required so the **? Tour** button stays reachable from the Patient Selection screen. (An earlier pass hid it entirely to match real CPRS's blank-gray-background-behind-the-dialog look, but that broke tour-button access and was reverted per user instruction.)
- **`#tabbar` (chart tab bar) is hidden until a patient is loaded** (`display:none` by default in `index.html`, set to `flex` inside `loadPatient()` in `js/core.js`) — real CPRS shows a blank gray background behind the Patient Selection dialog, not the tab strip, before a chart is open.
- **Status bar disclaimer updated** to `READ ONLY -- EDUCATIONAL SIMULATION -- Created by George Tran, MD -- All patients, providers, and records shown are entirely fictional and do not represent real individuals or protected health information (PHI).` — expanded from the earlier short `NO PHI` version to spell out the fictional-data disclaimer in full and credit the author. The status-bar cell's CSS was loosened (`white-space:normal`, `overflow:visible`) so the longer text wraps instead of getting ellipsis-truncated.

### Personal patient lists (`js/personal-lists.js`, `js/popups.js`, `js/core.js`, `js/tutorial.js`)
Full working flow for the "build your own patient list" workflow that real CPRS requires (this mock's 5-patient roster isn't auto-assigned to a trainee — matches the existing dialog-tour wording change from an earlier session).
- **Tools → Options** (`openOptions()`) — tabbed floating dialog (General / Notifications / Order Checks / Lists/Teams / Notes / Reports / Graphs / Surrogates / Copy/Paste). Only **General** (decorative, non-functional buttons) and **Lists/Teams** (functional) have real content; the rest show "Not available in this simulation." Dialog **centers itself on screen every time it opens** (`centerFloatWin()`, new helper in `js/popups.js`).
- **Personal Lists** (`openPersonalLists()`) — search the 5 sim patients by name, create new lists via **New List...** (opens its own **New Personal List** popup, name + Myself-only/All-CPRS-users sharing radios), stage patients into "Patients to add," then **Add**/**Add All** them onto the selected list, **Remove**/**Remove All** to edit. **Delete List** button exists visually (matches real CPRS layout) but is intentionally inert per user instruction. **New List / Delete List buttons sit in their own centered column** between the "Patient" search box and the "Personal Lists" box, matching the real CPRS screenshot layout (not stacked under the Personal Lists box as originally built).
- **Patient Selection dialog → Team/Personal radio** — selecting it reveals a searchable list of personal lists (`#pt-team-picker`) **directly beneath the filter radio buttons in the left column, above the Notifications panel** — not swapped into the central "Patients" box (an earlier iteration got this placement wrong and was corrected against a user-supplied screenshot). Seeded with flavor list names (`Gt 2 North`, `Gt Day Mod`, `Gt Gmed Team 1-5`, etc., matching real CPRS screenshots) plus anything created via Personal Lists. **Clicking a list immediately populates the central "Patients" box** with the same 5 tutorial patients (real CPRS would show whoever was actually added) — the list picker itself stays visible/selectable, it does not get replaced or hidden after a pick (an earlier "← Back to Team List" link was removed — real CPRS doesn't have one, and the picker doesn't need it since it never disappears in the first place). Other filter radios (Providers/Specialties/Clinics/Wards/PCMM/All) show an honest "This filter type isn't modeled in this simulation" placeholder rather than pretending to work.
- **Save Settings button** — moved out of the dialog's OK/Cancel footer into its own `.pt-demo-col`, positioned directly beneath the patient-demographics box ("No patient selected" / patient info) and above the Notifications panel, matching the real CPRS screenshot. Clicking it (only does anything once a team/list is actually selected) opens a **separate, small confirm popup** ("Save Team = '‹name›' as your default patient list setting?" — Yes/No), centered on screen — deliberately distinct from the main dialog's OK/Cancel, which only open/cancel Patient Selection itself. **Yes** persists the choice to `localStorage` (`cprsDefaultPtListMode`/`cprsDefaultPtListName`); next `openPtDialog()` call auto-selects Team/Personal and jumps straight to that list's patients.
- **Bug fix — Team/Personal picker could stay visible after switching back to User List.** `openPtDialog()` previously reset the search box and patient list directly, bypassing `ptListModeChange()` entirely, so the team-picker's visibility and the radio's checked state could drift out of sync across dialog opens (e.g. leftover state from a tour step). Fixed by having `openPtDialog()` always force the User List radio checked and call `ptListModeChange('user')` first, before `applyDefaultPtListIfSet()` gets a chance to override it back to Team/Personal (only if a default was actually saved).

### Guided Tour — personal list module (`js/tutorial.js`)
- **7 new steps** added covering the full Tools → Options → Personal Lists → Patient Selection Team/Personal → Save Settings flow, extracted into their own reusable array `PERSONAL_LIST_TOUR_STEPS`. Each step's `before()` hook opens the exact popup/state needed (Tools dropdown, Options on Lists/Teams tab, Personal Lists dialog, Patient Selection with Team/Personal picker showing, a sample team selected) so the spotlight always lands correctly regardless of what step the user came from or skipped.
- `CHART_TOUR_STEPS` is now built via `[...].concat(PERSONAL_LIST_TOUR_STEPS, [...])` — the personal-list block is spliced in right after the "Chart Tabs" step and before "Cover Sheet," so there's a single source of truth for that content (no duplication between the inline placement and the standalone module below).
- **Standalone sub-tutorial module** — registered in `TOUR_MODULES` as "Building a Personal Patient List," reachable via the **▾** picker next to **? Tour**, so a returning trainee can jump straight to just this workflow without re-running the whole orientation tour (`startPersonalListModule()`, activates `PERSONAL_LIST_TOUR_STEPS` on its own).
- **Engine additions to support this:**
  - `step.before` — optional callback run before a step renders (after `step.tab` if present), used to open/close whichever popups a step needs. Existing steps that don't use it are unaffected.
  - `step.cardOffset: {dx, dy}` — optional manual nudge applied to the tour card's computed position, used on the "Building Your Personal Patient List" step (which spotlights the Tools dropdown near the top of the screen) to stop the card from landing in the top-left corner and obscuring the menu.
  - `step.highlightTarget` — optional separate element-getter for the *spotlight box*, distinct from `step.target` (which still anchors card positioning). Lets a step keep the already-tuned card position (anchored to the dropdown) while spotlighting a smaller/different element (the "Tools" menu label itself, not the whole dropdown).
  - `closeTeachingPopups()` — closes Options/Personal Lists/New List/Save-Settings-confirm and (if a chart is open) the Patient Selection dialog; called at the start of every personal-list step's `before()` and inside `endTour()`, so no leftover popup ever lingers into the next step or after the tour ends.

### Patient header popups (`js/popups.js`, `js/data.js`, `index.html`, `css/cprs.css`)
Full build-out of the clickable elements across `#pthdr`, each opening a real popup instead of being dead text — plus a matching sub-tutorial (see "Header buttons + VistA Imaging tour modules" below).
- **Patient Inquiry** (`openPatientInquiry()`) — clicking the name/DOB/SSN box (`#ph-name`) opens a monospace, cream-background popup (matches real CPRS's "Patient Inquiry" screen) showing address, phone, email, emergency contact, and service connection/era. Content is built from a new `inquiry` sub-object added to each of the 5 patients in `data.js` (address/phone/email/emergency contact vary per patient; boilerplate like county/eligibility text is intentionally shared across patients — user confirmed duplicating boilerplate is fine). SSN is derived from the existing MRN's last 4 digits (consistent with the app's existing last-initial+SSN-last-4 search convention) rather than storing a separate fake SSN. Footer is **Print**/**Close** only (no "Select New Patient" — removed per user instruction). Auto-closes on outside click.
- **Encounter / "Provider & Location for Current Activities"** — the ward/room/provider box (`#ph-visit`) now opens the exact same `openEncounter()` dialog as the Encounter button at the bottom of the Notes tab (no duplicated logic).
- **PACT / Primary Care** (`openPactInfo()`) — clicking the "No PACT assigned..." line (`#ph-pact`) opens a "Primary Care" popup matching the real CPRS screenshot: Inpatient Attending/Provider with phone/pager, then clinic/PACT team line, then Primary Care Provider, Care Manager, Administrative Associate, Clinical Pharmacist Practitioner, Social Worker, Surrogate Care Manager, and blank Clinical/Administrative POC lines. Built from a new `pact` sub-object per patient in `data.js` with made-up-but-plausible WLA VA clinic/team/staff data (some names reused from that patient's existing Notes-tab authors for internal consistency, e.g. Kowalski's resident `Torres,Samuel MD`). Deliberately discordant with the header text still saying "No PACT assigned" — that's intentional per user instruction; the point is teaching *where* to look, not internal label consistency.
- **PDMP Query** (`openPdmpQuery()`) — clicking it does **not** show a confirmation popup (matches real CPRS) — it silently files a **"STATE PRESCRIPTION DRUG MONITORING PROGRAM"** note into that patient's Notes tab (guarded against duplicate filing per session via a title check), and re-renders the Notes tab live if it's the currently active tab. (An earlier iteration showed a confirmation popup — removed per user instruction that real CPRS doesn't show one.)
- **JLV / Remote Data** — originally one header box with two lines of text; per user correction, real CPRS has these as **two separate thin stacked buttons** since Remote Data does something functionally distinct from JLV. Split into `#hbtn-jlv` and `#hbtn-remote-data` inside a new `.hbtn-stack` wrapper (`.hbtn-half` CSS class, same beveled look as `.hbtn` but half-height). `openJlvInfo()` (unchanged) opens the existing JLV explanatory popup (pulls in outside/non-VA records or records from a different VA facility, "Not available in this simulation"); `openRemoteDataInfo()` is a new function opening a placeholder `remote-data-dlg` popup ("Not yet detailed in this simulation") until the user supplies what Remote Data actually does — at that point its popup content and a dedicated Header Deep-Dive tour step should be added. The Header Deep-Dive tour step still targets `#hbtn-jlv` only, unchanged, per user instruction.
- **Flag button color fix** — was incorrectly using a solid-red `.hbtn-red` background class; real CPRS header buttons are plain gray with colored *text* only (matching how the JLV button already worked). Removed `.hbtn-red` entirely (now-unused) and switched Flag to inline `color:#cc0000` text on a plain `.hbtn`, consistent with JLV's blue-text treatment.
- **`#ph-name` background** — now pale yellow/beige (`#fdf6c8`, darker `#f5ecab` on hover) instead of the header's default gray, matching real CPRS's highlighted "active patient" name box. Exact shade is an approximation (no color-accurate reference screenshot was available) — flagged as a one-line tweak if it needs adjusting.
- **VistA Imaging Display** (`openVistaImaging()`, Tools → VistA Imaging Display) — a **decorative, non-interactive mockup** of the real multi-window VistA Imaging viewer: menu bar, toolbar icon row, patient bar, "Clinical All" filter tab, and an image-list table (Item/Site/Note Title/Procedure/Class/Type/Cap Dt columns). Deliberately simplified from the real app's 2-3 overlapping windows into one dialog — user confirmed pixel-perfect fidelity isn't the goal, just recognizing the workflow. The image list itself does **not** contain EKG rows (matches real behavior — EKGs live behind a dedicated toolbar button, not the default list); one toolbar icon (`#vi-btn-ekg`, red squiggle `〰`) represents that button. The list does contain an **ADVANCE DIRECTIVE** row (`#vi-ad-row`, `Class: ADVANCE DIR`) since scanned directives *do* show up there.

### Medication Administration Record (MAR) (`js/render-orders.js`)
- **Right-click any inpatient medication row → Details...** now shows a generated MAR instead of a plain order-entry summary, reusing the *same* Order Details popup (widened to 760px for meds, 520px otherwise) — no separate dialog, per user instruction ("it's all one thing").
- MAR content (allergies line, med name/sig, Schedule Type, then a stack of administration entries) is **generated programmatically from each med's existing `sig` string** (`buildMarRows()`/`buildMarText()` in `render-orders.js`) rather than hand-authored per patient — works automatically for every current and future inpatient med with no `data.js` changes needed:
  - **PRN detection**: any `sig` containing "PRN" → 2-4 irregularly-spaced administration entries.
  - **Interval detection**: parses `Q\d+H`, BID/TID/QID, DAILY, AT BEDTIME/QHS, AC+HS/WITH MEALS, or CONTINUOUS out of the sig text to space out 6 scheduled entries.
  - **Dose parsing**: pulled from `Give: 80MG...` etc.; meds with no fixed numeric dose (`PER SCALE`, `PER CHO RATIO`) correctly show "VARIABLE" instead of a fabricated number.
  - Deterministic per-med seeded pseudo-random (seeded off patient name + med name) so the same med shows the same history on every reload rather than reshuffling.
  - Verified by manual trace against real data (Kowalski's `FUROSEMIDE 80MG/ML INJ` → Continuous/80MG/q12h; Brennan's `ONDANSETRON 4MG/2ML INJ` → PRN/4MG) — all four parsing branches (interval, PRN, sliding-scale→VARIABLE, unit-only dose) confirmed correct.

### Surgery tab ↔ Notes cross-listing bug fix (`js/render-surgery.js`)
- **Surgery tab was a pure placeholder** ("No surgery cases found") even for patients (Brennan) with a real operative note already in their Notes tab — same class of bug as Consults notes not automatically surfacing elsewhere.
- Fixed by having `renderSurgery()` **derive** its "Operative Reports"/"All Surgery Cases" list from `pt.notes` at render time (`collectOperativeNotes()`, matches `/OPERATIVE/i` in the title) — same pattern already used for Inpatient Medications appearing in the Orders tab (derived, not duplicated in `data.js`). Clicking an entry shows the full note text in the right pane. Anesthesia Reports and Pathology categories still show an honest "No ... reports found" placeholder since no matching data exists yet.

### Postings popup + color cleanup (`js/popups.js`, `js/render-cover.js`, `css/cprs.css`, `js/data.js`)
- **Postings popup** now includes a short italic hint between the allergy table and the crisis-notes list, explaining that this is where to check for an Advance Directive or Life-Sustaining Treatment (LST) note, and that viewing the actual directive document uses a different route (the VistA Imaging sub-tutorial).
- **Postings data cleanup**: removed the generic "ALLERGIES" and "FALL RISK" flag entries from all 5 patients' `postings` arrays in `data.js` (redundant with the dedicated allergy table above them); added `"LIFE-SUSTAINING TREATMENT"` alongside Kowalski's existing `"ADVANCE DIRECTIVE DISCUSSION"` entry as a second example row.
- **Color cleanup**: Postings popup (allergy table + directives list) and Cover Sheet's Allergies/Adverse Reactions + Clinical Reminders sections are now plain black text — removed the red `ared`/`due` CSS classes (now fully unused, deleted) and the blue inline color on postings list items. Vitals' abnormal-red-value convention elsewhere is untouched (locked decision, unrelated to this cleanup).

### Guided Tour — MAR, Header Deep-Dive, and VistA Imaging modules (`js/tutorial.js`)
Three more standalone sub-tutorials, following the same pattern established by the personal-list module (own step array, registered in `TOUR_MODULES`, reachable via the **▾** picker, requires an open chart).
- **`MAR_TOUR_STEPS`** (5 steps, "Reviewing the MAR (Medication Administration Record)") — Orders tab → right-click a medication → the actual MAR popup opened live (`showOrderDetails(0)`) with Schedule Type / Administration Date / Units Ordered vs. GIVEN / Administered By called out → closing habit-to-build tip.
- **`HEADER_TOUR_STEPS`** (8 steps, "Patient Header Deep-Dive") — spotlights `#pthdr` itself first, then walks through Patient Inquiry, Encounter, PACT, Postings, PDMP Query, and JLV, each opened live via its real function.
- **`IMAGING_TOUR_STEPS`** (6 steps, "VistA Imaging Display (EKGs & Advance Directives)") — Tools menu → VistA Imaging Display → the image list overview → the EKG toolbar button → the Advance Directive row → closing tip, explicitly cross-referencing the Postings step from the Header Deep-Dive tour ("Postings tells you *whether* a directive is on file; VistA Imaging is where you'd actually open and read it").
- **Engine additions:**
  - `step.secondaryTarget` — optional second element-getter that draws a lightweight orange outline (`#tour-spotlight-2`, no dark backdrop) alongside the primary spotlight's full dark-backdrop treatment on `#tour-spotlight`. Used on the Header Deep-Dive steps so a step can spotlight *both* the popup that opened *and* the header button that opens it (previously the engine could only highlight one element at a time). `positionSpotlight()` was refactored to take a `spotlightId` param so both overlay elements share the same positioning logic; the window-resize handler was updated to reposition both.
  - `ensureChartOpenForTour()` — shared guard (previously duplicated inline in `startPersonalListModule()`) that closes the Patient Selection dialog and loads a default patient (Kowalski) if no chart is open yet, since these workflows require being inside a chart in real CPRS. Every `start*Module()` function for a chart-scoped module is now a two-line wrapper: call the guard, then `activateTourSteps()`.
  - `closeTeachingPopups()` — expanded piecemeal across several rounds of bug fixes as new popups were added, and separately fixed for a *systemic* gap: every module's final centered "closing tip" step (`center:true`, no `target`) had no `before` hook at all, so whatever popup the previous step opened just stayed on screen through the closing card. Fixed by adding `before: function(){ closeTeachingPopups(); }` to every closing step across `MAR_TOUR_STEPS`, `HEADER_TOUR_STEPS`, `IMAGING_TOUR_STEPS`, and `NOTES_TOOLS_TOUR_STEPS`. The cleanup list itself now closes: options/personal-lists/new-list/save-default-confirm/order-details/patient-inquiry/pact/jlv/vista-imaging/encounter/postings/templates/custom-view/**new-note** dialogs (`new-note-dlg` was also found missing and added after a user report).
  - `_findTreeItem(containerSelector, label)` — matches a left-tree row (`.ti`) by its visible label text (stripping any leading arrow glyph), since neither the Labs nor Reports tree renders stable per-row ids. Used by the Labs Views and Reports Views tour steps to spotlight a specific tree item.

### Notes tab — Templates, View menu / Custom View, and column fixes (`js/render-notes.js`, `js/core.js`, `index.html`, `css/cprs.css`)
- **Templates accordion** (originally a `showFloatWin('templates-dlg')` popup, later changed to an inline accordion per user correction — see "Templates: popup → inline accordion" below) — a decorative, non-interactive mockup matching the real CPRS tree: **My Templates** (collapsed) and **SHARED TEMPLATES** (expanded, showing the TESTING folder, a few named templates, and the rest of the shared folder list). No real expand/collapse or note-insertion — same "recognize the workflow, not full fidelity" precedent as VistA Imaging.
- **Context-sensitive View menu** (`buildViewMenu()` in `core.js`) — the top-bar **View** menu now swaps its content based on the active tab: on the Notes tab it shows the real Notes-specific menu (Chart Tab, Information, Signed Notes variants, **Custom View**, Search for Text, etc.); every other tab still shows the original tab-navigation list, cached on first read and restored via `_viewMenuDefaultHTML`. Only **Custom View** is wired; the rest are decorative `dd-gray` items matching the real menu's layout.
- **"List Selected Documents" popup** (`openCustomView()`/`applyCustomView()`/`clearCustomView()`) — a simplified version of the real dialog. Status list, Author, and Date range sections are shown but decorative/disabled (out of scope per user ask); the two fields called out as important are real and functional:
  - **Max Number to Return** — actually caps how many notes load into both the left tree and right-pane list (`_notesViewSettings.max`, module-level state in `render-notes.js`, defaults to 1000).
  - **Contains** — any note whose title contains the entered text (case-insensitive) gets **bolded** (`.nt-bold` CSS class) in both the tree and the list, without filtering anything else out — matches real CPRS behavior.
- **Meds/Orders column headers filled in** from user-supplied screenshots:
  - **Orders tab**: the placeholder single-letter `N`/`C`/`C`/`S`/`L` headers are now their real names — **Nurse / Clerk / Chart / Status / Location**. Status cells now render the full word (`active`/`pending`) instead of the abbreviated `ac`/`pe`.
  - **Meds tab**: Outpatient table's unlabeled `L`/`F` columns are now **Last Filled / Refills Remaining** — this also fixed a pre-existing data bug where the "last filled" date was being rendered under the *Expires* column instead of its own. Inpatient table's `L` column is now **Location**, populated with the patient's ward (previously always blank). Non-VA table already matched the real column set exactly.
- **Options dialog visual bug fixed** — the 9 tabs (General…Copy/Paste) overflowed past the dialog's right edge at the old 560px width. Widened `#options-dlg` to 700px to match the real dialog's proportions, and added `flex-wrap` to `.fw-tabs` as a defensive fallback so this class of overflow can't silently recur regardless of future dialog width changes.

### Guided Tour — Notes Tab Tools, Labs Views, and Reports Views modules (`js/tutorial.js`)
Three more standalone sub-tutorials, same pattern as the others (own step array, registered in `TOUR_MODULES`, `ensureChartOpenForTour()` guard, reachable via the **▾** picker).
- **`NOTES_TOOLS_TOUR_STEPS`** (8 steps, "Notes Tab Tools (Templates, Encounter, New Note)") — intro (auto-switches to the Notes tab on Step 1 via a `before` hook, fixed after a user report that it wasn't happening until Step 2) → where the three buttons live → Templates (opened live) → New Note (opened live, explains the note-title picker + Cosigner field, and that available titles are configured via **Tools → Options → Notes** tab — a judgment call favoring the real Options dialog's actual tab structure over the user's stated "Lists/Teams," flagged to the user for confirmation) → Encounter (opened live, cross-references the Header Deep-Dive module) → View → Custom View (menu spotlighted, `buildViewMenu()` + `.open` class forced) → the List Selected Documents popup itself (Max Number to Return + Contains called out, with a "try it" prompt suggesting the user type `Progress` and click OK) → closing habit-to-build tip.
- **`LABS_VIEWS_TOUR_STEPS`** (7 steps, "Labs Views (Most Recent, Overview, Worksheet)") — intro → Most Recent (snapshot view + Oldest/Previous/Next/Newest navigation between panels) → Lab Overview (per-specimen rows + click-to-expand bottom results pane) → Worksheet (trend-table concept, notes it opens Select Lab Tests first) → the Select Lab Tests popup itself → Microbiology (explains it aggregates culture data embedded in other panels) → closing tip recapping when to reach for each view and that abnormal values are flagged via H/L, not color.
- **`REPORTS_VIEWS_TOUR_STEPS`** (5 steps, "Reports Views (Imaging, Procedures, Pharmacy)") — intro (names the three areas with real data) → Imaging (local only) → Procedures (local only) → Clinical Reports → Pharmacy (explains it's for medication history; notes sub-items aren't populated with real data yet) → closing tip.
- **`TOUR_MODULES` now has 8 entries**: `main`, `personal-list`, `mar`, `header`, `imaging`, `notes-tools`, `labs-views`, `reports-views`.

### Guided Tour content editing pass (`js/tutorial.js`)
Once all 7 sub-tutorial modules existed, the user went step-by-step through the main `CHART_TOUR_STEPS` and several sub-tutorials trimming/correcting wording (content was previously placeholder-level per the "Pending" note below — this pass resolved that for the reviewed steps):
- **"Replaying This Tour" step split in two** — previously one step spotlighting only `#tour-btn` while the text also described the **▾** dropdown picker. Now: one step for `#tour-btn` alone ("Replaying This Tour"), then a new second step ("Focused Sub-Tutorials") that opens the picker live (`openTourPicker()`), spotlights `#tour-menu-btn` directly (`highlightTarget`) with the opened `#tour-picker-dlg` as a `secondaryTarget` outline, and describes it in one sentence rather than listing every module by name. This is why `CHART_TOUR_STEPS` grew from 17 to 18 steps.
- **"Chart Tabs" step** — removed the second paragraph listing the exact tab order (Cover Sheet → Problems → ... → Reports); kept only the one-sentence explanation that each tab is a different chart section.
- **"Patient Header" step** — Postings description now explicitly says it covers allergies, advance directives, **and LST (Life-Sustaining Treatment) notes** (previously only said "allergies and active directives"); the trailing "always check this before reviewing medications" clause was later removed entirely as unnecessary.
- **New closing step: "Go Explore"** — added as the very last step of `CHART_TOUR_STEPS` (after "Suggested Pre-Rounding Workflow"), a centered card encouraging the trainee to click around the chart freely once the guided part is done, and pointing back to the **▾** sub-tutorial picker for deeper dives later. This is why `CHART_TOUR_STEPS` grew again, from 18 to **19** steps.
- **"Notes Tab" step** — removed the "Habit to build" sentence about reading the most recent progress note before the H&P.
- **"Labs Tab" step** — added a middle paragraph explaining **Lab Overview** (previously only described Most Recent and Worksheet).
- **"Reports Tab" step** — reworded to frame imaging/pharmacy/procedures as *examples* of what's in Reports rather than implying that's the full contents; **Procedures (local only)** line now says "procedure reports for things such as endoscopies or echocardiograms."
- **"Suggested Pre-Rounding Workflow" step** — patient-header bullet now says to check Postings for "allergies, advance directives, and life-sustaining treatment (LST) notes," matching the Patient Header step's wording.
- **`PERSONAL_LIST_TOUR_STEPS` "Save Settings" step** — removed the trailing sentence explaining that the Yes/No confirm prompt is separate from the dialog's own OK/Cancel footer.
- **`MAR_TOUR_STEPS`** — step 3 ("Right-Click a Medication") dropped "— the same menu item used for any other order"; step 4 ("Reading the MAR") dropped "instead of a plain order summary"; step 5 ("Habit to Build") added **opioids** to the anticoagulants/insulin/antibiotics list of high-risk meds worth MAR-checking.
- **`HEADER_TOUR_STEPS`** — PDMP Query step corrected: real CPRS actually takes two clicks (query runs, button relabels to something like **Query Results**, second click opens a small prompts dialog, confirming files a *pended* note) rather than silently filing the note on one click as this simulation's `openPdmpQuery()` still does. User explicitly chose to leave the button's actual one-click behavior unchanged for now and only fix the tutorial text to describe the real flow (with a caveat that this sim simplifies it) — **flagged as a future to-do if the two-click behavior is ever worth building**.
- **`REPORTS_VIEWS_TOUR_STEPS`** — "Imaging (local only)" step no longer lists "echo" as an imaging example (echos live in Procedures, not Imaging — this was a factual error); "Procedures (local only)" step changed "completed/pending echocardiograms" to just "completed echocardiograms" since Procedures never shows pending studies.

### Labs tab — Most Recent, Lab Overview, and Worksheet rework (`js/render-labs.js`, `css/cprs.css`)
- **Default landing view is Most Recent** (moved off Worksheet's `sel` flag).
- **Anatomic Pathology group is now collapsible** — was previously always-expanded with no toggle; now starts collapsed with an arrow-click handler showing/hiding its children (Autopsy, Cytology, Electron Microscopy, Surgical Pathology).
- **Most Recent** gained real pagination: `renderMR(idx)` with **Oldest / Previous / Next / Newest** buttons that step through `pt.labs` panels one at a time (buttons disable at the ends), a "Specimen: X" label per panel, and the table is now built from real panel data via new helpers (`getPanelDate`, `getPanelValIdx`, `getPanelRefIdx`) instead of a single hardcoded date/value snapshot. Values are split into value+unit columns via the existing `splitValueUnit()`. Columns are resizable.
- **Lab Overview** restructured into a top table + bottom "Results" detail pane — clicking a row highlights it and populates a formatted plain-text result dump below, instead of the previous flat un-clickable table.
- **Worksheet** no longer builds a static per-panel dump on click — it now opens the **Select Lab Tests** dialog (`openSelectLabsDlg()`, existing `#select-labs-dlg` markup) where a trainee picks specific tests via group/filter pickers; confirming builds a transposed trend table (tests as columns, dates as rows) plus a bottom comment pane (`.ws-comment-pane`) showing per-cell comments on click.
- **Microbiology** is unchanged from the earlier data-driven rework (`collectMicroRows()`), still covered here since it's part of the same tour module.
- Note: Most Recent/Lab Overview's Specimen and Provider columns read `panel.specimen`/`panel.provider` with fallback defaults (`'SERUM'`/`'TORRES'`) — **no patient in `data.js` actually has these fields set yet**, so every panel currently displays the same fallback values regardless of patient. Flagged as a gap if per-panel specimen/provider accuracy becomes important later.

### Reports tab — collapsible tree + real Procedures data (`js/render-reports.js`)
- **Report tree is now truly collapsible/expandable at every level** — previously "Clinical Reports" auto-expanded with no way to collapse it back; `build()` now wraps each level's children in a toggleable `childWrap` div with `e.stopPropagation()` throughout so nested clicks don't bubble into parent toggles. **Clinical Reports now starts collapsed** (was always-expanded).
- **Imaging and Procedures tables** gained column-resize handles (`makeColumnsResizable`), matching the rest of the app's resizable-table convention.
- **Procedures** now reads from each patient's real `pt.procedures` array (previously it silently reused `pt.imaging`, showing radiology studies mislabeled as procedures) with a click-to-view bottom report pane, mirroring the Imaging tab's existing click pattern.

### Orders tab
- Added **WLA Outpatient Clinics Order Menu** and **WLA Primary Care Order Menu** entries under *** Outpatient Clinics *** in the left column
- Right-click on any order row shows a context menu (Details, Flag, Unflag, etc.)
- Clicking **Inpatient Wards Order Menu** opens a popup with multi-column menu layout
- Clicking **WLA Primary Care Order Menu** opens a separate popup with its own distinct content
- Order menu popups have a **Done** button only (no X close button), matching real CPRS
- Left-clicking an order row highlights it navy blue — does **not** auto-open Order Details
- Order Details popup only opens via right-click → Details
- **Inpatient Medications now appear in the Orders tab**, grouped under their own **"Inpatient Medications"** Service-column entry at the top of the list (derived at render time from `pt.meds_inpt`, not duplicated in `data.js`). Order Details for these rows reads from a render-time merged list (`_ordersView`) rather than indexing `pt.orders` directly.
- **All 9 columns are resizable** (Service, Order, Start/Stop, Provider, N, C, C, S, L). Note: N/C/C are pre-existing icon-flag placeholder columns with no data wired to them — not a bug, just unpopulated.

### Meds tab
- Removed the **HELD** medication status entirely (orange styling, `[HELD]` tag) — real CPRS doesn't show a held order as a distinct visual state on the active med profile. Medications that were HELD for a clinical reason (AKI, NPO, bleeding risk, new arrhythmia, etc.) were removed from `meds_inpt` for Kowalski, Chen, Brennan, and Hayes rather than shown as still-active; the clinical rationale remains fully documented in each patient's Notes/Problems. `DISCONTINUED` styling (gray, muted) is unchanged.
- **All three tables (Outpatient, Non-VA, Inpatient) are column-resizable.**
- Some column headers (Meds and Orders tabs) are currently unlabeled/placeholder and need real CPRS names — **pending screenshots from the user** before these can be filled in.

### Notes tab
- **New Note** button no longer bolded; text is centered
- Left column (note list + Templates/Encounter/New Note buttons) is **horizontally resizable** by dragging the divider
- Clicking a note replaces the list view with the full note text in the right pane (list header disappears)
- Date text is black (was red)
- **Subject column removed** — columns are now Date, Title, Author, Location
- All four columns are **resizable** by dragging column header edges

### Cover Sheet — Vitals
- Clicking any cell in the Vitals panel (not just the "Vitals" label) opens the Vitals popup
- Vitals popup has no I/O tab
- Vitals popup table is **transposed**: row labels are vital signs, column headers are date/time entries
- Popup is **resizable** by dragging the bottom-right handle
- Trend **chart** at the top of the popup renders the selected vital sign over the selected time period (canvas 2D line chart with blue fill, labeled value bubbles, red for abnormal)
- All text in the popup is black; **abnormal values only shown in red** (no blue, no bold)
- Popup contents contract/expand with window resize (ResizeObserver on chart canvas)
- Sub-header below the title bar shows patient name/MRN and date range

### Labs tab
- **Most Recent** is the default view (was Worksheet)
- Collection Date/Time column shows proper `MM/DD/YYYY HH:MM` format — fixed parsing of panel types that use "Value/Date/Ref" column structure vs. date-keyed columns
- Result/Status column shows actual values (was incorrectly showing dates for some panels)
- **Result/Status column now holds only the numeric value** — embedded units (e.g. `1840 pg/mL`, `9.1%`, `<0.012 ng/mL`) are split via `splitValueUnit()` in `render-labs.js` and moved into the Units column. Qualitative/compound results (culture growth text, flagged antibody titers, `SUSCEPTIBLE (MIC <4)`) are deliberately left whole — only clean `number [unit]` strings are split.
- **Lab Overview**: collection date correctly derived per panel type; click a row to populate the bottom results pane
- **Worksheet**: shows **Select Lab Tests** popup on first click; navigating away closes the popup; transposed table (dates as rows, test names as columns); **Date/Time and Specimen columns have a grey background** (`.ws-fixed-col`) to visually distinguish them from the test-value columns, matching real CPRS — this replaced a leftover hardcoded navy-blue background that had been fighting with row-selection highlighting
- All lab values plain black; abnormal indicated by H/L in Flag column only (no colored or bolded text)
- Anatomic Pathology accordion starts collapsed and toggles correctly
- **Microbiology view is now data-driven** (`collectMicroRows()` in `render-labs.js`) instead of a hardcoded "no results" state — it pulls in every row from any panel named "Microbiology" plus individual culture/sensitivity/Gram-stain rows embedded in other panels (e.g. a blood culture living inside an "Infectious Markers" panel), with a clickable detail pane
- **Column resizing** added to Most Recent, Lab Overview, and Worksheet tables

### Reports tab
- **Clinical Reports** accordion starts collapsed by default
- **Pharmacy** accordion starts collapsed by default
- **Procedures (local only)** now shows GI endoscopy data (EGD, Colonoscopy) instead of imaging studies
- Procedure report text loads in bottom pane when a row is clicked
- Procedure data added to Kowalski patient in `js/data.js`
- **Echocardiograms moved from Imaging to Procedures** — Kowalski's completed TTE and Hayes's pending/ordered TTE were miscategorized under Imaging; both now live in each patient's `procedures` array (Hayes didn't have a `procedures` array at all — added one). Chen/Okafor/Brennan's imaging arrays were checked and only contain genuine radiology studies.
- **Imaging and Procedures tables are column-resizable.**

### Problems tab
- **Column resizing** added (Stat, Description, Onset Date, Last Update columns).

### Menu system (`js/core.js`)
- **Fixed File → Select New Patient leaving the File dropdown visibly open behind the Patient Selection dialog.** Root cause: clicking a `.dd-item` bubbled the click up to its parent `.mi` element, whose own `onclick="toggleMenu(...)"` handler fired *after* the item's handler had already closed the menu, immediately reopening it. Fixed by stopping click propagation at the `.dropdown` container — this was a latent bug affecting every top-level menu (File, View, Action, etc.), not just File.

### Patient Selection dialog
- Dialog is **centered** on screen when it opens (JS-calculated, not CSS-hardcoded)
- **Search by last-initial + last-4-SSN** now works: typing e.g. `K8817` filters the list to the matching patient; free-text name search still works as before

### Guided Tour (`js/tutorial.js`)
- Full tour engine built: spotlight overlay, dark backdrop, floating card with Back/Next/Skip, step counter, keyboard-safe positioning
- **Two separate tour phases, plus a growing set of standalone sub-tutorial modules:**
  - `DIALOG_TOUR_STEPS` (7 steps) — auto-starts on page load while Patient Selection dialog is open; covers the patient list, SSN search, list filter radio buttons, zztest guidance, and notifications panel
  - `CHART_TOUR_STEPS` (19 steps) — runs inside an open chart; covers patient header, tab bar, the full personal-list-building workflow (`PERSONAL_LIST_TOUR_STEPS`, 7 steps, spliced in), Cover Sheet, Notes, Labs, Orders, Reports, a closing "Go Explore" free-roam prompt, and the pre-rounding workflow recap
  - `PERSONAL_LIST_TOUR_STEPS` (7 steps), `MAR_TOUR_STEPS` (5 steps), `HEADER_TOUR_STEPS` (8 steps), `IMAGING_TOUR_STEPS` (6 steps) — standalone-only, each runnable via the **▾** picker (see "Guided Tour — MAR, Header Deep-Dive, and VistA Imaging modules" above)
- Tour auto-continues into chart phase when user completes the dialog tour then selects a patient
- Skipping the dialog tour suppresses the auto-continue
- **? Tour** button in patient header replays the appropriate tour based on current state
- Tour step content is a plain JS array (`TOUR_STEPS`) — easy to edit without touching engine code

### Tour bug fixes (`js/tutorial.js`)
- **`startTour()` routing fix**: was checking `dlg.style.display !== 'none'` (always `true` since the dialog uses CSS class, not inline style). Changed to `dlg.classList.contains('show')` — now correctly routes to dialog tour vs. chart tour based on actual dialog visibility.
- **Chart tour auto-trigger fix**: `tourOnPatientLoad()` previously only fired when `_tourContinue` was set (only set when dialog tour completed naturally). Added `_chartTourShown` boolean flag so the chart tour also auto-fires on the very first patient load even when the user skipped the dialog tour.
- **Tour card no longer obscures the tab bar** on chart-tour steps 3–8 (any step whose target is `#tabbar` or one of the individual tab elements). `renderTourCard()`'s vertical clamp previously only checked `window.innerHeight`, letting the card's bottom edge slide down over `#tabbar`. Added a second clamp that reads `#tabbar`'s actual top position and never lets the card cross it.
- **Dialog tour wording updated** to stop implying patients are auto-assigned, since real CPRS requires manually selecting/adding patients to a personal list one at a time (setting up for a future step on building a personal list):
  - Step 2 ("Patient Selection Dialog") now reads *"It shows your currently selected patient list and any pending notifications."* — removed the old "your assigned patients appear automatically" sentence.
  - Step 4 ("Patient List Filters") now reads *"User List (the default) shows the patients you currently have within your selected list."*

### Column resizing bug fix (`css/cprs.css`)
- After adding column resizing to Problems, Meds, Orders, and the Labs/Reports tables, it didn't actually work — root cause was two missing CSS properties that the one table which *did* work (`notes-list-tbl`) already had:
  1. **`.col-resize-handle` is `position:absolute`**, which needs a positioned ancestor. Only `table.notes-list-tbl th` had `position:relative`; added it to `table.prob th`, `table.meds-tbl th`, `table.orders-tbl th`, and `table.labs-tbl th` — without it, handles rendered off in the page's top-right corner instead of on each column edge.
  2. **`table-layout:fixed`** — `notes-list-tbl` and `orders-tbl` already had it; added it to `table.meds-tbl` and `table.labs-tbl` too, since browser auto-layout mostly ignores explicit widths set during a drag.

### New patients (`js/data.js` + `js/core.js`)
- **Brennan, Daniel T** — MRN `0083-6420`, search key `B6420`, DOB Mar 14 1974, 52M, Ward 4-WEST RM 410, Attending PFEFFER,MICHAEL MD
  - Allergy: Penicillin (Moderate, Rash/Urticaria)
  - Clinical scenario: acute sigmoid diverticulitis with 3.8 cm pelvic abscess → emergent sigmoid colectomy + Hartmann's procedure (POD#3), Klebsiella pneumoniae bacteremia (cleared), T2DM (HbA1c 9.8%), AKI (resolved), NAFLD, HTN, HLD
  - Teaching points: pip-tazo appropriate despite PCN allergy (rash = low cross-reactivity), 14-day course stepping down to PO ciprofloxacin, ostomy teaching, glucose management post-op
  - Tabs populated: Notes (H&P, op note, 2 progress notes, 2 nursing notes, ID consult), Labs (CBC×3, BMP×3, hepatic panel, microbiology), Imaging (CT abdomen/pelvis), Consults (General Surgery, Infectious Disease), Orders, Vitals
- **Hayes, Patricia A** — MRN `0096-4471`, search key `H4471`, DOB Feb 04 1955, 71F, Ward 4-WEST RM 406, Attending ANAND,PRIYA MD
  - NKDA
  - Clinical scenario: syncope while driving → MVA → LLE fractures (nondisplaced distal fibula + 5th metatarsal base, NWB), new Mobitz II AV block (likely flecainide toxicity, flecainide HELD), paroxysmal AFib on rivaroxaban (continued), HLD (Chol 258H, TG 258H), HTN, pre-diabetes
  - Teaching points: flecainide toxicity causing high-degree AV block, syncope workup, NWB management, rate vs. rhythm control in AFib
  - Tabs populated: Notes (H&P, Cardiology consult, Ortho consult, 2 progress notes, 2 nursing notes), Labs (BMP×2, CBC×2, cardiac/coag panel, lipid panel, thyroid panel), Imaging (CT coronary angio, CXR portable, XR left ankle 3 views, Echo TTE ordered/pending), Consults (Cardiology, Orthopedic Surgery), Orders, Vitals (bradycardia HR 50–72, rhythm notated in qual field)

### Existing patient expansions (`js/data.js`)
- **Kowalski**: added Jun 18 22:00 vitals; extra progress note (Torres/Anand Jun 19), social work note (Robinson,Denise LCSW — discharge planning, HBPC referral), 2 nursing notes; hepatic/comprehensive panel (AST 44H, Albumin 3.1L), lipid panel (LDL 104H, HDL 32L, TG 260H); Echo TTE imaging (EF 30–35%, moderate MR, RVSP 42 mmHg); Echo TTE, PT eval, Social Work consult, cardiac diet orders
- **Chen**: added Jun 19 10:00 vitals; 2 nursing notes (McAllister); sputum culture (Strep pneumoniae, PCN susceptible), serial ABG panel (Jun 19 RA vs Jun 20 on 4L — pH improving 7.32→7.35, PaCO2 50), blood cultures updated to "No growth FINAL"; BiPAP at bedside, smoking cessation consult, diet consult orders
- **Okafor**: added Jun 19 11:00 vitals; Diabetes Education note (Santos,Maria RN — injection technique, CGM, CHO counting, hypoglycemia), nursing shift note (Diaz,Carlos RN); thyroid/autoimmune panel (TSH normal, Anti-TPO POSITIVE 142, Anti-TG POSITIVE 88, celiac screen negative), lipid panel (LDL 138H, TG 284H); FSBG QID, Diabetes Education consult, Social Work consult, Dexcom G7 CGM nursing orders

---

## Locked decisions (do not re-litigate without explicit discussion)

- **Patient switching is File → Select New Patient only.** No clickable header icon.
- **Patient Selection dialog auto-opens on page load**, before any patient is chosen, every time.
- **After selecting a patient, the chart opens to the Notes tab**, not Cover Sheet.
- **Header is flat gray (#c0c0c0), not blue.** Verified against real CPRS screenshots.
- **Tab order:** Cover Sheet, Problems, Meds, Orders, Notes, Consults, Surgery, D/C Summ, Labs, Reports. Surgery comes before D/C Summ.
- **Meds tab has no left pane** — full width, three stacked sections (Outpatient / Non-VA / Inpatient).
- **Patient Selection dialog radio list reads "User List"**, not a specific clinic name.
- **Patient Selection dialog is draggable and resizable.** Notifications panel grows to fill extra space.
- **CPRS uses very little color.** Default text is black. Blue only for clickable links (Postings, Recent Immunizations on Cover Sheet). Active Problems and NKA text are plain black.
- **Cover Sheet grid is fixed 3×3 layout** — no user-configurable panel resize/reorder.
- **No functional Orders entry** — read-only display only.
- **Orders tab: left-click highlights a row; right-click opens context menu.** Order Details only via right-click → Details.

---

## Known gaps / stubbed areas (not yet at full fidelity)

- **Labs:** Pending Orders, Graph, Selected Tests by Date, Blood Bank, Lab Orders (All), Cumulative are placeholder "no data" states
- **Labs:** Vitals popout period filters (TODAY / T-1 / etc.) are rendered but not wired to actually filter data
- **Consults tab:** placeholder only, no real data
- **Surgery tab:** now derives its "Operative Reports" list from any `pt.notes` entry matching `/OPERATIVE/i` (currently only Brennan has one) — Anesthesia Reports and Pathology categories are still pure placeholders since no matching data/pattern exists for those yet
- **D/C Summ tab:** placeholder only, no real data
- **Encounter dialog:** tab switching (Clinic / Hospital / New Visit) not functionally wired
- **New Note dialog:** no save functionality (by design — read-only tool)
- **Reports:** most accordion sub-items show "No matching documents found" — only Imaging, Procedures, and Blood Bank have real data

---

## Pending / known issues to fix

- **Labs date display:** some edge-case panels may still show malformed dates if their column structure doesn't match the two known patterns — needs real-world testing across all five patients
- ~~**Tutorial tour steps:** content is placeholder-level; needs a full pass to write the actual teaching points the educator wants to highlight.~~ **Mostly done.** See "Guided Tour content editing pass" above — the user went step-by-step through `CHART_TOUR_STEPS`, `PERSONAL_LIST_TOUR_STEPS`, `MAR_TOUR_STEPS`, `HEADER_TOUR_STEPS`, and `REPORTS_VIEWS_TOUR_STEPS` trimming/correcting wording. Other sub-tutorials (`IMAGING_TOUR_STEPS`, `NOTES_TOOLS_TOUR_STEPS`, `LABS_VIEWS_TOUR_STEPS`) haven't been through this same line-by-line review pass yet — worth doing if time allows.
- **Tour: Orders tab step** should explain the right-click behavior specifically
- **Tour: Cover Sheet step** should mention clicking vitals to open the popup
- **Tour: Notes step** should explain the left-column resizer and the click-to-expand note behavior
- ~~**Meds/Orders column headers.**~~ **Done.** Real CPRS names filled in from user screenshots — see "Notes tab — Templates, View menu / Custom View, and column fixes" above.
- ~~**Notes tab — filter by View menu.**~~ **Done.** `buildViewMenu()` + Custom View / List Selected Documents popup (Max Number to Return + Contains, both functional), taught in `NOTES_TOOLS_TOUR_STEPS`. See "Notes tab — Templates, View menu / Custom View, and column fixes" above.
- ~~**Labs tab — teach Most Recent vs. Lab Overview vs. Worksheet.**~~ **Done.** `LABS_VIEWS_TOUR_STEPS`, plus the underlying Most Recent/Overview/Worksheet rework. See "Labs tab — Most Recent, Lab Overview, and Worksheet rework" above.
- ~~**Reports tab — teach the important views.**~~ **Done.** `REPORTS_VIEWS_TOUR_STEPS`, plus a collapsible tree and real Procedures data. See "Reports tab — collapsible tree + real Procedures data" above.
- ~~**Orders tab — teach viewing the MAR via right-click.**~~ **Done.** Right-click any inpatient med → Details... now shows a generated MAR (reuses the Order Details popup, no separate dialog), and `MAR_TOUR_STEPS` teaches the workflow as a standalone module. See "Medication Administration Record (MAR)" and "Guided Tour — MAR, Header Deep-Dive, and VistA Imaging modules" above.
- ~~**Patient header name box — click-to-open demographics popup.**~~ **Done.** Clicking `#ph-name` opens **Patient Inquiry**. See "Patient header popups" above.
- ~~**Tools menu — teach building a personal patient list.**~~ **Done.** Full Options → Personal Lists → Team/Personal picker → Save Settings flow built and taught, both inline in `CHART_TOUR_STEPS` and as a standalone `TOUR_MODULES` entry. See "Personal patient lists" and "Guided Tour — personal list module" above.
- ~~**Notes tab — teach the New Note and Encounter popups.**~~ **Done.** Both taught in `NOTES_TOOLS_TOUR_STEPS`. See "Guided Tour — Notes Tab Tools, Labs Views, and Reports Views modules" above.
- ~~**Notes tab — teach the Templates button.**~~ **Done.** Decorative Templates tree built + taught in `NOTES_TOOLS_TOUR_STEPS`; now an inline accordion rather than a popup — see "Templates: popup → inline accordion" above.
- **Labs Most Recent / Lab Overview — Specimen and Provider columns not patient-specific.** These columns read `panel.specimen`/`panel.provider` but no patient in `data.js` has those fields set, so every panel shows the same fallback (`SERUM`/`TORRES`) regardless of patient or actual test. Not a blocker for teaching the workflow, but worth fixing if per-panel accuracy matters later.
- **Notes tab — New Note tour step references the Options "Notes" tab, not "Lists/Teams" as the user stated.** The user said note titles are configured via Tools → Options → **Lists/Teams**, but the real Options dialog (per their own screenshot) has a dedicated **Notes** tab, and Lists/Teams is what this app already built out for personal patient lists (unrelated). Went with **Notes** tab in the tour text as the better-supported claim — flagged to the user for confirmation, not yet resolved either way.
- **Tutorial restructuring into a module picker — infrastructure built, now has 7 sub-tutorial modules.** With the growing list of module candidates below, one long linear `CHART_TOUR_STEPS` was expected to get unwieldy. The picker shell is built in `js/tutorial.js` / `index.html` / `css/cprs.css`:
  - `TOUR_MODULES` registry array — each entry is `{id, label, run}`; now has 8 entries: `'main'` (routes to the existing dialog/chart tour via `startTour()`), `'personal-list'`, `'mar'`, `'header'`, `'imaging'`, `'notes-tools'`, `'labs-views'`, `'reports-views'` (each a thin `start*Module()` wrapper). Adding a future sub-tutorial is just one more object here — no picker-code changes needed. Chart-scoped modules (all but `'main'`) call the shared `ensureChartOpenForTour()` guard first.
  - **? Tour** button (`#tour-btn`) restores its original direct behavior: one click immediately relaunches whichever tour fits the current context (Patient Selection dialog vs. chart), exactly as before. A separate small **▾** button (`#tour-menu-btn`) next to it opens the sub-tutorial picker.
  - The picker itself (`#tour-picker-dlg`) is a real floating-window popup (draggable title bar, `Close`/`×`), not an anchored dropdown menu — and its CSS was overridden to look like the white, rounded `tour-card` (not the classic gray beveled `.float-win` look), so it aesthetically matches the rest of the tutorial UI. List items reuse `.ol-item` styling.
  - Within a module, **Skip**/**Finish** reopens this same picker window (not the old dropdown); an **X** in the tour card's top-right corner (`closeTourEntirely()`) always fully closes everything regardless of what's active.
  - **Pending, waiting on content buildout:** once real sub-tutorial modules exist, need to add a step to the **main** tour that highlights the **▾** button so users discover they can go there for more topics.
  - **Draft grouping (agreed direction, still needs screenshots to finalize content):**
    - **Main tour stays short/orientation-only:** dialog tour as-is (patient list, SSN search, filters, notifications), plus the base chart tour (patient header at a glance, tab bar, one line per tab) — **now including an early "build your patient list via Tools menu" step**, since that's foundational plumbing every first-time user needs (see the Tools-menu item above for why it must live in the chart tour, not the dialog tour).
    - **Deep-dive sub-modules (opt-in via the picker):** all 5 originally-planned modules are now done — ~~(1) Patient Header Deep-Dive~~ (`HEADER_TOUR_STEPS`, Flag button and camera/clock icon excluded — see Pending section), ~~(2) Notes Tab Tools~~ (`NOTES_TOOLS_TOUR_STEPS`, Templates/New Note/Encounter/View-menu Custom View), ~~(3) Labs Views~~ (`LABS_VIEWS_TOUR_STEPS`), ~~(4) Reports Views~~ (`REPORTS_VIEWS_TOUR_STEPS`), ~~(5) Orders — Viewing the MAR~~ (`MAR_TOUR_STEPS`) — plus a bonus **VistA Imaging Display** module (`IMAGING_TOUR_STEPS`) not originally in this list.
  - Still to be decided once screenshots arrive: exact step content within each module, and final boundaries if any module turns out to need splitting further.
- **Dialog tour — new "No Patients on Your List Yet?" step added.** Explains that a first-time user's User List may be empty (patients aren't auto-assigned) and, rather than opening a real patient's chart (a HIPAA violation), to search **zztest** to find a designated test patient — mirrors real CPRS, which has dozens of these. This app doesn't model an actual `zztest` patient in `js/data.js`/`js/core.js`'s patient list — user confirmed this is fine, since the step is just describing real-CPRS behavior generically, not something this mock's own 5-patient roster needs to back.
- **Dialog tour — Step 1 ("Welcome") now spotlights the `? Tour` button** instead of rendering as a centered box, so users see exactly where to click to replay the tour.
- ~~**Patient header — teach the JLV / Remote Data button.**~~ **Done.** `openJlvInfo()` explanatory popup + `HEADER_TOUR_STEPS` step. See "Patient header popups" above.
- ~~**Patient header — teach the PDMP Query button.**~~ **Done.** `openPdmpQuery()` silently files a "STATE PRESCRIPTION DRUG MONITORING PROGRAM" note + `HEADER_TOUR_STEPS` step. See "Patient header popups" above.
- **Patient header — Flag button interaction (color fixed, behavior not built).** Cosmetic bug fixed (was a solid-red button; real CPRS uses gray button + red text, matching JLV's blue-text pattern — see "Patient header popups" above). Still no click handler or tutorial step. Should show any clinical flags on the chart — examples given: cardiac device (pacemaker/defibrillator), behavioral disturbance or suicidality flag, research study enrollment. Not yet scoped — waiting on screenshots from the user.
- **Camera/clock icon button — explicitly deprioritized, not planned.** User clarified this is actually meant to be a **clock icon** that would trigger a "Clinical Reminders" popup in real CPRS, and confirmed **we don't need to build this feature**. No further action planned unless revisited.
- ~~**Patient header — PACT/`#ph-pact` and `#ph-visit`/Encounter interactions.**~~ **Done.** See "Patient header popups" above and the Header Deep-Dive tour module.
- **Patient header — remaining scope:** of the original full-bar inventory, only the **Flag** button (interaction, not just color) and the **camera/clock icon** (explicitly shelved, see above) are still open. `#ph-name`, `#ph-visit`, `#ph-pact`, `PDMP Query`, `JLV`, and `Postings` are all done.
- ~~**PDMP Query — button behavior doesn't match the real two-click flow.**~~ **Done.** `handlePdmpClick()` now implements the real click → Querying... → PDMP Results → results popup → pended note flow, plus a standalone `PDMP_TOUR_STEPS` module. See "PDMP Query two-click flow + Results popup + pended note" above.
- ~~**Remote Data button — placeholder only.**~~ **Done.** `toggleRemoteDataPanel()` opens a real site-checkbox accordion, wired into new "Remote..." Health Summary reports in the Reports tab, plus a standalone `REMOTE_DATA_TOUR_STEPS` module. See "Remote Data: header dropdown + Reports tab Health Summary" above.
- **"Rolling dates" idea — parked, not started.** Idea: have all chart dates/times shift relative to whenever the tool is opened, so it always looks like "a few days ago" instead of a fixed 2026 date. Scoped but explicitly deferred by the user; would require converting every timestamp in `js/data.js` to an admission-relative offset and computing real dates at render time — touches every tab, non-trivial, proposed as its own separate pass rather than folded into other work.

---

## Planned future phases (not started)

In order of prior agreement:
1. **Tab-by-tab fidelity pass** — in progress (Orders, Notes, Cover Sheet, Labs, Reports done; Problems and Meds partially done — column resizing and HELD-status cleanup complete, column header labels still pending; Consults, Surgery, D/C Summ still need review)
2. **Vitals popout refinement** — period filters (TODAY/T-1/etc.) need to actually slice the data
3. **Header / visit-selector improvements**
4. **Tutorial content pass** — write out the actual step-by-step teaching content for both tour phases
5. **Patient case repository** with phenotype switching (add more patients) — 5 patients now exist; framework ready for more
6. **Functional Orders** entry
7. **PCE / Encounter modal**
8. **AI patient generator**

---

## Working conventions

- One canonical file per component, overwritten in place — no versioned copies (e.g. no `cprs_v2.html`). Git history is version control.
- After any change, review the diff before accepting. Commit with a clear message describing what changed and why.
- Before pushing to `main`, open `index.html` locally to visually confirm — this is a UI-heavy project where visual regressions are easy to introduce silently.
- Tour step content lives in `js/tutorial.js` in the `DIALOG_TOUR_STEPS` and `CHART_TOUR_STEPS` arrays. Edit those arrays to change tour content; the engine below them does not need to be touched.
- **Don't use the in-app Preview tool (`preview_start`/browser preview) for this project.** It fails to launch reliably in this environment (a sandbox permission error unrelated to this codebase — its Python launcher can't call `os.getcwd()`). Skip straight to static/logical review of the diff instead of trying to spin up a live preview; the user will open `index.html` locally themselves to visually confirm changes.
- **Deployment is manual, not via `git push` from this local clone.** The user uploads files directly through GitHub's web UI (drag-and-drop), which is why this local repo's git history has diverged from `origin/main` (GitHub shows "Add files via upload" commits this local clone never made/fetched). **Never assume all locally-modified files need re-uploading** — run `git fetch origin -q && git diff --stat origin/main` first to see exactly which files actually differ from what's live; often most files already match because an earlier upload covered them, and only the newest edit needs re-uploading.
- **GitHub Pages deploys can fail for reasons outside this codebase** — a stuck-in-`queued` deploy that times out is a known symptom of a GitHub-side incident (check `githubstatus.com`); a Cloudflare dashboard action silently failing (e.g. a `401` on an internal API call, "Done" button reverting with no error) can similarly be a Cloudflare-side incident (check `cloudflarestatus.com`) rather than anything wrong with the setup. When something in this deploy/analytics pipeline breaks with no obvious local cause, check the relevant platform's status page before troubleshooting further.
