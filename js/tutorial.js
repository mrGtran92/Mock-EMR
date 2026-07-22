/* =========================================================
   CPRS Tutorial / Guided Tour
   =========================================================
   Two step arrays:
     DIALOG_TOUR_STEPS — runs while the Patient Selection
                         dialog is open (auto-starts on load)
     CHART_TOUR_STEPS  — runs inside an open patient chart
                         (triggered by the ? Tour button)

   startTour() routes to the right array based on state.

   Each step shape:
   {
     title:  string,
     html:   string (inner HTML for the body text),
     center: true        — centered modal, no spotlight
     tab:    'notes'     — call goTab() before spotlighting
     target: function()  — returns DOM element to spotlight
   }
   ========================================================= */

var _tourIndex        = 0;
var _tourActive       = false;
var _tourSteps        = [];      // set by startTour()
var _tourFirstLoad    = true;    // auto-fires dialog tour on page load
var _tourContinue     = false;   // true when dialog tour finished naturally → auto-start chart tour
var _chartTourShown   = false;   // auto-fires chart tour on first patient load (even if dialog tour was skipped)
var _activeModuleId   = 'main';  // which TOUR_MODULES entry is running — 'main' never returns to the picker on Skip/Finish

/* ---------------------------------------------------------
   TOUR MODULE PICKER
   Registry of tours reachable from the "? Tour" button.
   Add future sub-tutorials here — the picker UI and engine
   below don't need to change when new modules are added.
   --------------------------------------------------------- */
// Grouped by where the content lives in the chart, in the same order as
// the chart's own tab bar (Cover Sheet, Meds, Orders, Notes, Consults,
// Labs, Reports -- see CLAUDE.md's locked tab order), with a "Getting
// Started" group first and a "Header & Tools" group for content that isn't
// scoped to one specific tab. The picker renders a header divider whenever
// `group` changes from the previous entry, so entries within a group must
// stay adjacent -- reorder here (not in the picker code) if that changes.
var TOUR_MODULES = [
  {id:'main', group:'Getting Started', label:'Guided Orientation Tour', run:function(){ startTour(); }},
  {id:'personal-list', group:'Getting Started', label:'Building a Personal Patient List', run:function(){ startPersonalListModule(); }},
  {id:'notifications', group:'Getting Started', label:'Processing Notifications', run:function(){ startNotificationsModule(); }},
  {id:'header', group:'Header & Tools', label:'Patient Header Deep-Dive', run:function(){ startHeaderModule(); }},
  {id:'pdmp', group:'Header & Tools', label:'PDMP Query & Results', run:function(){ startPdmpModule(); }},
  {id:'remote-data', group:'Header & Tools', label:'Remote Data (Other VA Facilities)', run:function(){ startRemoteDataModule(); }},
  {id:'imaging', group:'Header & Tools', label:'VistA Imaging Display (EKGs & Advance Directives)', run:function(){ startImagingModule(); }},
  {id:'cover-sheet', group:'Cover Sheet', label:'Reminders, Immunizations & Appointments', run:function(){ startCoverSheetModule(); }},
  {id:'meds-order', group:'Meds Tab', label:'Changing an Active Medication', run:function(){ startMedsOrderModule(); }},
  {id:'meds-renew', group:'Meds Tab', label:'Expiration & Renewing a Medication', run:function(){ startMedsRenewModule(); }},
  {id:'discharge-meds', group:'Meds Tab', label:'Ordering Outpatient Meds at Discharge', run:function(){ startDischargeMedsModule(); }},
  {id:'mar', group:'Orders Tab', label:'Reviewing the MAR (Medication Administration Record)', run:function(){ startMarModule(); }},
  {id:'order-menus-nav', group:'Orders Tab', label:'Navigating the Order Menus', run:function(){ startOrderMenusNavModule(); }},
  {id:'lab-order', group:'Orders Tab', label:'Ordering or Adding On a Lab Test', run:function(){ startLabOrderModule(); }},
  {id:'notes-tools', group:'Notes Tab', label:'Notes Tab Tools (Templates, Encounter, New Note)', run:function(){ startNotesToolsModule(); }},
  {id:'consults', group:'Consults Tab', label:'Understanding Consult Statuses', run:function(){ startConsultsModule(); }},
  {id:'labs-views', group:'Labs Tab', label:'Labs Views (Most Recent, Overview, Worksheet)', run:function(){ startLabsViewsModule(); }},
  {id:'reports-views', group:'Reports Tab', label:'Reports Views (Imaging, Procedures, Pharmacy)', run:function(){ startReportsViewsModule(); }},
  // 'order-entry', 'encounter-coding', and 'clinical-reminders' are hidden from the
  // picker (not deleted) -- their content isn't finished yet and this app is about
  // to go live. Their step arrays and start*Module() functions below are untouched;
  // just re-add the entries here once each module is actually ready.
];

// Finds a Cover Sheet grid cell (#rp-body .cs-cell) by its header title text
// — cells have no stable id, so tour steps match on the header span's text
// the same way _findTreeItem matches left-tree rows.
function _findCsCell(title){
  var hdrs = document.querySelectorAll('#rp-body .cs-hdr span:first-child');
  for(var i=0;i<hdrs.length;i++){
    var text = hdrs[i].textContent.replace(/^[^\w]+/, '').trim();
    if(text === title) return hdrs[i].closest('.cs-cell');
  }
  return null;
}

// Finds a left-tree item (.ti) in a labs/reports panel by its visible label
// text — neither tree renders stable per-row ids, so tour steps match on
// textContent instead of a selector.
function _findTreeItem(containerSelector, label){
  var container = document.querySelector(containerSelector);
  if(!container) return null;
  var items = container.querySelectorAll('.ti');
  for(var i=0;i<items.length;i++){
    // Group rows prefix an arrow glyph (▸/▾) before the label — strip any
    // leading non-word characters so both leaf and group rows match cleanly.
    var text = items[i].textContent.replace(/^[^\w(]+/, '').trim();
    if(text === label) return items[i];
  }
  return null;
}

// Matches a left-column order-menu item (#orders-left-list .ol-item) by
// its visible label text, same rationale as _findTreeItem above.
function _findOrderMenuItem(label){
  var items = document.querySelectorAll('#orders-left-list .ol-item');
  for(var i=0;i<items.length;i++){ if(items[i].textContent.trim()===label) return items[i]; }
  return null;
}

// Matches a leaf row inside an open order-menu-dlg popup (.iw-item) by its
// visible label text -- these are built fresh into #om-menu-body on every
// openOrderMenu() call with no stable ids, same rationale as
// _findOrderMenuItem above for the left-nav list itself.
function _findMenuBodyItem(label){
  var items = document.querySelectorAll('#om-menu-body .iw-item');
  for(var i=0;i<items.length;i++){ if(items[i].textContent.trim()===label) return items[i]; }
  return null;
}

// Matches a Consults tab left-tree row (#consults-left .ct-item) by its
// visible label text -- rows use their own .ct-item class rather than the
// .ti class _findTreeItem expects, same rationale as the helpers above.
function _findConsultItem(label){
  var items = document.querySelectorAll('#consults-left .ct-item');
  for(var i=0;i<items.length;i++){
    var text = items[i].textContent.replace(/^[^\w(]+/, '').trim();
    if(text === label) return items[i];
  }
  return null;
}

// goTab() always fully re-renders the target tab (renderMeds() rebuilds
// the whole Meds tab DOM from scratch), which resets the Outpatient/Non-VA/
// Inpatient sections' scroll position back to 0 -- calling it on every
// single step's before() (even when already on the Meds tab) was causing a
// visible "scroll back to top, then back down to the row" jump on every
// step transition, and left the background list looking reset to the top
// once a later step's target was a dialog rather than the row itself. Only
// call goTab when the Meds tab isn't already active.
function _goMedsTab(){ if(currentTab!=='meds') goTab('meds'); }

// Matches a Meds tab row (#meds-home-tbl/#meds-inpt-tbl tbody tr) by a
// substring of its .med-name text -- these tables have no stable per-row
// ids either, same rationale as _findTreeItem above.
function _findMedsRow(tableId, nameSubstring){
  var rows = document.querySelectorAll('#'+tableId+' tbody tr');
  for(var i=0;i<rows.length;i++){
    var nameEl = rows[i].querySelector('.med-name');
    if(nameEl && nameEl.textContent.indexOf(nameSubstring)!==-1) return rows[i];
  }
  return null;
}

// The header <tr>'s own getBoundingClientRect() doesn't reliably reflect
// where its cells actually render once they're individually position:sticky
// (table row layout + sticky descendants is a known rough edge) -- this
// returns a plain object with just a getBoundingClientRect() method (all
// positionSpotlight/_spotlightRect actually call), computed as the real
// union of the header's <th> cells instead, so the spotlight lines up with
// where the sticky header row visually is.
function _findMedsHeaderRow(tableId){
  var ths = document.querySelectorAll('#'+tableId+' thead th');
  if(!ths.length) return null;
  return {
    getBoundingClientRect: function(){
      var left=Infinity, top=Infinity, right=-Infinity, bottom=-Infinity;
      ths.forEach(function(th){
        var r = th.getBoundingClientRect();
        left = Math.min(left, r.left); top = Math.min(top, r.top);
        right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom);
      });
      return {left:left, top:top, right:right, bottom:bottom, width:right-left, height:bottom-top};
    }
  };
}

/* ---------------------------------------------------------
   DIALOG TOUR STEPS
   Walks through the Patient Selection dialog before any
   patient is opened.
   --------------------------------------------------------- */
var DIALOG_TOUR_STEPS = [
  {
    target: function(){ return document.getElementById('tour-btn'); },
    title: 'Welcome to the CPRS Simulator',
    html: '<p>This quick tour will walk you through the Patient Selection screen and explain how to find and open a patient chart.</p>'
        + '<p>Use <b>Next</b> to step through, or <b>Skip tour</b> to close it. You can replay this tour any time using the <b>? Tour</b> button, highlighted here.</p>'
  },
  {
    target: function(){ return document.getElementById('pt-dlg'); },
    title: 'Patient Selection Dialog',
    html: '<p>Every time you open CPRS, this dialog appears first. It shows your currently selected patient list and any pending notifications.</p>'
  },
  {
    target: function(){ return document.getElementById('pt-search-wrap'); },
    title: 'Finding a Patient',
    html: '<p>To search for a specific patient, type their <b>last initial followed by the last 4 digits of their SSN</b> (for example, <b>K8817</b>) into the search box above the patient list.</p>'
        + '<p>This filters the list to matching patients. Keep in mind that multiple patients may share the same last initial and last 4 SSN digits, so you may still see more than one result — confirm by checking the full name and date of birth shown on the right.</p>'
  },
  {
    target: function(){ return document.querySelector('.pt-list-box'); },
    title: 'Patient List Filters',
    html: '<p>These radio buttons on the left control <b>which list</b> is displayed in the patient panel.</p>'
        + '<p><b>User List</b> (the default) shows the patients you currently have within your selected list. The other options let you browse by Provider, Team, Clinic, Ward, and more — useful when covering for a colleague or looking up a patient not on your own list.</p>'
  },
  {
    center: true,
    title: 'No Patients on Your List Yet?',
    html: '<p>If this is your first time in CPRS, your <b>User List</b> may be completely empty — patients are <b>not</b> assigned to you automatically. You build your personal list yourself, from inside a patient\'s chart, which we\'ll cover later.</p>'
        + '<p>In the meantime, never open a real patient\'s chart you\'re not directly involved in caring for — that\'s a HIPAA violation. Instead, type <b>zztest</b> into the search box to find one of the designated test patients (real CPRS systems have dozens of these) and open that chart to keep exploring.</p>'
  },
  {
    target: function(){ return document.querySelector('.pt-dlg-notif'); },
    title: 'Notifications Panel',
    html: '<p>The bottom panel shows <b>alerts that need your attention</b>. These include:</p>'
        + '<ul style="margin:4px 0 0 16px;padding:0;font-size:11px">'
        + '<li style="margin-bottom:3px">Notes you\'ve written that are unsigned or need a co-signature</li>'
        + '<li style="margin-bottom:3px">New lab results that have resulted for your patients</li>'
        + '<li style="margin-bottom:3px">Critical values requiring immediate acknowledgment</li>'
        + '<li style="margin-bottom:3px">Patient admissions, discharges, and deaths</li>'
        + '<li style="margin-bottom:3px">Order changes and pharmacy alerts</li>'
        + '</ul>'
        + '<p style="margin-top:6px">Click any notification row and use the buttons below to <b>Process</b> it (opens the relevant note or result), <b>Defer</b> it, or <b>Forward</b> it to another provider.</p>'
  },
  {
    center: true,
    title: 'Ready to Open a Chart',
    html: '<p>That covers the Patient Selection screen. To continue:</p>'
        + '<ol style="margin:6px 0 0 18px;padding:0;font-size:11px">'
        + '<li style="margin-bottom:4px">Click a patient name in the list to select them</li>'
        + '<li style="margin-bottom:4px">Click <b>OK</b> to open their chart</li>'
        + '<li style="margin-bottom:4px">Then click the <b>? Tour</b> button in the top-right of the screen to take a walkthrough of the chart itself</li>'
        + '</ol>'
  }
];

/* ---------------------------------------------------------
   PERSONAL LIST TOUR STEPS
   Reusable block covering Tools > Options > Personal Lists and
   the Patient Selection Team/Personal picker + Save Settings.
   Spliced into CHART_TOUR_STEPS below, and also reachable on
   its own as a TOUR_MODULES entry so returning users don't have
   to sit through the full chart tour again.
   --------------------------------------------------------- */
var PERSONAL_LIST_TOUR_STEPS = [
  {
    before: function(){ closeTeachingPopups(); closeAllMenus(); document.getElementById('menu-tools').classList.add('open'); },
    target: function(){ return document.getElementById('dd-tools'); },
    highlightTarget: function(){ return document.getElementById('menu-tools'); },
    cardOffset: {dx: 40, dy: 60},
    title: 'Building Your Personal Patient List',
    html: '<p>Real CPRS doesn\'t hand you a patient list automatically — you build one yourself so it\'s there every time you log in.</p>'
        + '<p>Open the <b>Tools</b> menu (works from any tab) and look near the bottom for <b>Options...</b></p>'
  },
  {
    before: function(){ closeTeachingPopups(); openOptions(); optTab('lists'); },
    target: function(){ return document.getElementById('opt-personal-lists-btn'); },
    title: 'Options → Lists/Teams',
    html: '<p>The <b>Options</b> window has a tab for every kind of personal setting. Click the <b>Lists/Teams</b> tab (already selected here) to reach <b>Personal Lists and Teams</b>.</p>'
        + '<p>Click <b>Personal Lists...</b> to open the list editor.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); openPersonalLists(); },
    target: function(){ return document.getElementById('personal-lists-dlg'); },
    title: 'Personal Lists',
    html: '<p>If you already have lists, they\'re shown under <b>Personal Lists</b> on the right — click one to see (and edit) who\'s on it.</p>'
        + '<p>First time? Click <b>New List...</b>, give it a name, and click OK. Leave sharing set to <b>Myself only</b> — that\'s the normal choice; only pick "All CPRS users" if you\'re deliberately sharing the list with a team.</p>'
        + '<p>Then: search for a patient under <b>Patient:</b> (last-initial + last-4-SSN works, e.g. <code>K8817</code>), click their name to stage it under <b>Patients to add</b>, highlight it there and click <b>Add</b> (or <b>Add All</b> for several at once) to move it into <b>Patients on personal list</b>. Click <b>OK</b> when you\'re done.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); openPtDialog(); },
    target: function(){ return document.querySelector('.pt-list-box'); },
    title: 'Patient Selection: Team/Personal',
    html: '<p>Now make that list the one you see every time you log in. From <b>File → Select New Patient</b>, look at the <b>Patient List</b> filters on the left.</p>'
        + '<p>Select <b>Team/Personal</b> — the default is <b>User List</b>, which is empty until you\'ve built a list of your own.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); openPtDialog(); ptListModeChange('team'); },
    target: function(){ return document.getElementById('pt-team-picker'); },
    title: 'Pick Your List',
    html: '<p>The list of your personal lists appears right below the filter radio buttons — type into the search box to filter by name, then click a list to open it.</p>'
        + '<p>As soon as you click one, its patients automatically appear in the <b>Patients</b> box in the middle of the dialog. This mock always shows the same 5 tutorial patients once a list is selected — in the real system, you\'d see whoever you actually added.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); openPtDialog(); ptListModeChange('team'); ptSelectTeam(0); },
    target: function(){ return document.getElementById('pt-save-settings-btn'); },
    title: 'Save Settings',
    html: '<p><b>Save Settings</b> sits just below the patient info panel on the right, above the Notifications section. Click it, then confirm <b>Yes</b> on the prompt that appears, and this dialog will open straight to that list every time you log in from now on — no more re-selecting Team/Personal each time.</p>'
        + '<p><b>No</b> (or closing that prompt) just uses the list for this session without changing your default.</p>'
  }
];

/* ---------------------------------------------------------
   MAR TOUR STEPS
   Standalone sub-tutorial (not spliced into the main chart tour —
   this is a deep-dive, opt-in only via the picker) covering how to
   review a medication's administration history.
   --------------------------------------------------------- */
var MAR_TOUR_STEPS = [
  {
    center: true,
    title: 'Reviewing the MAR',
    html: '<p>The <b>MAR</b> (Medication Administration Record) shows exactly when a medication was actually given — not just what was ordered. It answers questions like "did the patient actually get their last dose of antibiotics?" or "was this a scheduled med or given PRN?"</p>'
  },
  {
    tab: 'orders',
    before: function(){ closeTeachingPopups(); },
    target: function(){ return document.getElementById('tab-orders'); },
    title: 'Start in the Orders Tab',
    html: '<p>All active orders live here, including inpatient medications — grouped under their own <b>Inpatient Medications</b> heading at the top of the list.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('orders'); },
    target: function(){ return document.querySelector('#orders-tbl tbody tr'); },
    title: 'Right-Click a Medication',
    html: '<p><b>Right-click</b> any row under <b>Inpatient Medications</b> to open its context menu, then choose <b>Details...</b>.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('orders'); if(typeof showOrderDetails==='function') showOrderDetails(0); },
    target: function(){ return document.getElementById('order-details-dlg'); },
    title: 'Reading the MAR',
    html: '<p>For a medication order, <b>Details...</b> opens its MAR. Two things matter most:</p>'
        + '<p><b>Schedule Type</b> — <b>Continuous</b> means it\'s given on a fixed schedule (e.g. every 12 hours); <b>PRN</b> means it was only given as-needed, so gaps between doses are expected and not a missed dose.</p>'
        + '<p>Each entry also shows the exact <b>Administration Date</b>, plus <b>Units Ordered</b> vs. <b>Units GIVEN</b> — worth double-checking on high-risk meds like insulin or anticoagulants, and <b>Administered By</b> for who gave it.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Habit to Build',
    html: '<p>Before assuming a scheduled med was given on time — or that a PRN med wasn\'t needed overnight — pull up its MAR. This is especially worth checking for anticoagulants, insulin, opioids, and antibiotics with narrow dosing windows.</p>'
        + '<p>Click <b>Finish</b> to close. The <b>▾</b> picker next to <b>? Tour</b> brings you straight back here any time.</p>'
  }
];

/* ---------------------------------------------------------
   ORDER MENUS NAV TOUR STEPS
   Standalone sub-tutorial covering the Orders tab's left-nav
   "View Orders" list -- a map of order menus organized by
   inpatient vs. outpatient setting, not a walkthrough of any
   one menu's full contents. Runs against Kowalski (inpatient)
   since every menu (inpatient and outpatient) lives in the
   same left-nav list regardless of which patient is open.
   --------------------------------------------------------- */
var ORDER_MENUS_NAV_TOUR_STEPS = [
  {
    center: true,
    tab: 'orders',
    before: function(){ closeTeachingPopups(); },
    title: 'The Order Menus: A Map, Not a Catalog',
    html: '<p>The left column of the Orders tab is a fast-access map to the order menus you\'ll actually reach for — organized by <b>setting</b> (inpatient vs. outpatient), not alphabetically or by specialty.</p>'
        + '<p>The big category menus you\'ll see (Wards, Primary Care) are curated to <b>high-yield, frequently-ordered items</b> for that setting — they\'re deliberately <b>not exhaustive</b>. If something specific isn\'t listed, that\'s expected, not a gap in this simulation.</p>'
  },
  {
    tab: 'orders',
    before: function(){ closeTeachingPopups(); goTab('orders'); },
    target: function(){ return document.getElementById('orders-left-list'); },
    title: 'The "View Orders" Column',
    html: '<p>Everything on the left is either a menu that opens a popup, or a stray item that isn\'t wired up in this simulation — those unwired entries render in <b>grey</b> so you can tell at a glance what\'s worth clicking. This tour only stops at the ones worth knowing.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('orders'); var el=_findOrderMenuItem('Consults/Procedures Order Menu'); if(el) el.click(); },
    target: function(){ return document.getElementById('order-menu-dlg'); },
    title: 'Consults/Procedures Order Menu',
    html: '<p>This is where any consult or scheduled procedure gets ordered. Notice the numbered list splits by <b>site</b> — <b>WLA</b> vs. <b>SACC</b> — since those are two different physical facilities with their own consult queues. You\'ll see this same site-based split again in Radiology.</p>'
        + '<p>Clicking <b>1  WLA Consults/Procedures/Radiology</b> drills into WLA\'s actual specialty list — this is one of the deepest menus in the app, since it\'s genuinely a long list in real CPRS too.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('orders'); var el=_findOrderMenuItem('Lab Test Quick Orders Menu'); if(el) el.click(); },
    target: function(){ return document.getElementById('order-menu-dlg'); },
    title: 'Lab Test Quick Orders Menu',
    html: '<p>Labs organized by category — Common Panels, Chemistry, Hematology, Microbiology, Immunology, and more. Since almost every patient needs labs, this menu is reachable from the left column regardless of whether you\'re on an inpatient or outpatient case.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('orders'); var el=_findOrderMenuItem('Blood Bank Orders'); if(el) el.click(); },
    target: function(){ return document.getElementById('order-menu-dlg'); },
    title: 'Blood Bank Orders',
    html: '<p>This is where you order <b>Type & Screens</b>, <b>blood products</b> (RBC, platelets, FFP, cryoprecipitate), and other hematologic tests like a DAT or ROTEM.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('orders'); var el=_findOrderMenuItem('Inpatient Medication Order Menu'); if(el) el.click(); },
    target: function(){ return document.getElementById('order-menu-dlg'); },
    title: 'Inpatient Medication Order Menu',
    html: '<p>Grouped by <b>symptom/drug class</b> rather than alphabetically — Constipation Meds, Anti-Emetic Meds, Insulin Orders, Non-Insulin Diabetes Medications broken out by drug class, and so on. This is the high-yield version, not the full formulary.</p>'
        + '<p>For anything not covered by those categories, <b>ALL OTHER INPATIENT MEDS/SUPPLIES</b> at the bottom opens a searchable, alphabetized formulary list — the actual full catalog, as a fallback.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('orders'); var el=_findOrderMenuItem('Outpatient Meds/Supplies/IV Menu'); if(el) el.click(); },
    target: function(){ return document.getElementById('order-menu-dlg'); },
    title: 'Outpatient Meds/Supplies/IV Menu',
    html: '<p>The outpatient counterpart to the Inpatient Medication menu — quick orders for take-home prescriptions and supplies, plus its own <b>Master List</b>.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('orders'); var el=_findOrderMenuItem('INPATIENT WARDS Order Menu'); if(el) el.click(); },
    target: function(){ return document.getElementById('order-menu-dlg'); },
    title: 'Inpatient Side: Wards Order Menu',
    html: '<p><b>INPATIENT WARDS Order Menu</b> is the entry point for admitted patients — pick your service (Internal Medicine and Geriatrics, Cardiology, Surgery, ICU, etc.) to get that service\'s own curated order set: admission orders, vital sign parameters, nursing orders, common labs, procedure order sets, and disposition/discharge consults, all bundled by what a team on that service actually orders day to day.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('orders'); var el=_findOrderMenuItem('WLA Primary Care Order Menu'); if(el) el.click(); },
    target: function(){ return document.getElementById('order-menu-dlg'); },
    title: 'Outpatient Side: Primary Care Order Menu',
    html: '<p>The outpatient mirror of the Wards menu — labs, outpatient medications, imaging, and consult referrals, curated around what a primary care visit actually generates. Same principle as Wards: high-yield, not exhaustive.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('orders'); var el=_findOrderMenuItem('WLA Outpatient Clinics Order Menu'); if(el) el.click(); },
    target: function(){ return document.getElementById('order-menu-dlg'); },
    title: 'WLA Outpatient Clinics Order Menu',
    html: '<p>Beyond Primary Care, this menu is helpful for accessing orders tailored to specific <b>subspecialty clinics</b> — Cardiology, Dermatology, Endocrinology, and dozens more, each with their own quick links.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Multiple Doors, Same Room',
    html: '<p>One more thing worth knowing: many order types are reachable more than one way. <b>Radiology</b> shows up in its own dedicated menu, inside the Consults/Procedures numbered list, <i>and</i> inside the Wards menu\'s own Radiology section. <b>Labs</b> show up both in the dedicated Lab Quick Orders menu and inside the Wards menu\'s Common Inpatient Labs section.</p>'
        + '<p>That\'s not a bug in this simulation — real CPRS is genuinely built this way. There\'s rarely exactly one correct path to an order; if you can\'t find something where you expected it, try the setting-specific menu (Wards/Primary Care) instead of the dedicated one, or vice versa.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Habit to Build',
    html: '<p>Before hunting through a menu, ask two questions: <b>inpatient or outpatient?</b> and <b>is this a common enough order that the setting-specific menu (Wards/Primary Care) would have it, or do I need the dedicated menu (Labs, Meds, Radiology, Consults)?</b> That narrows it down fast, even the first time you use real CPRS.</p>'
        + '<p>Click <b>Finish</b> to close. The <b>▾</b> picker next to <b>? Tour</b> brings you straight back here any time.</p>'
  }
];

/* ---------------------------------------------------------
   LAB ORDER / COLLECTION TYPE TOUR STEPS
   Standalone sub-tutorial covering the "Order a Lab Test"
   dialog reached via Inpatient Wards Order Menu -> Internal
   Medicine and Geriatrics Inpatient Menu -> LABORATORY... --
   focused on Collection Type, since that's the one field on
   this dialog with real clinical meaning behind it.
   --------------------------------------------------------- */
var LAB_ORDER_TOUR_STEPS = [
  {
    center: true,
    tab: 'orders',
    before: function(){ closeTeachingPopups(); },
    title: 'Placing a Lab Order',
    html: '<p>This module walks through how to actually place a lab order — and, like other order menus, there are several different places you could start from. This tour picks one specific path: the <b>inpatient</b> context, via the Wards menu.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('orders'); var el=_findOrderMenuItem('INPATIENT WARDS Order Menu'); if(el) el.click(); },
    target: function(){ return document.getElementById('order-menu-dlg'); },
    title: 'Start at Inpatient Wards Order Menu',
    html: '<p>From the left column, open <b>INPATIENT WARDS Order Menu</b>, then click <b>Internal Medicine and Geriatrics Inpatient Menu</b> — the service-specific order set for a general medicine ward team.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('orders'); openIMGeriatricsMenu(); },
    target: function(){ return document.getElementById('order-menu-dlg'); },
    highlightTarget: function(){ return _findMenuBodyItem('LABORATORY...'); },
    title: 'The LABORATORY Section',
    html: '<p>Under <b>LABORATORY</b>, the <b>AM BMP</b>/<b>AM CBC w/ diff</b>/etc. rows just below are quick shortcuts for the most common daily labs. <b>LABORATORY...</b> is different — it opens the full lab-ordering dialog, for anything not covered by those shortcuts.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('orders'); openIMGeriatricsMenu(); openLabOrderDlg(); },
    target: function(){ return document.getElementById('lab-order-dlg'); },
    highlightTarget: function(){ return document.getElementById('lo-search'); },
    title: 'Searching for a Test',
    html: '<p>Type into <b>Available Lab Tests</b> and the list filters as you go. Selecting a test fills in its <b>Collect Sample</b> and <b>Specimen</b> automatically.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('orders'); openIMGeriatricsMenu(); openLabOrderDlg(); document.getElementById('lo-coll-type').size=4; },
    target: function(){ return document.getElementById('lo-coll-type').closest('.cr-field'); },
    title: 'The Four Collection Types',
    html: '<p><b>Lab Collect</b> — the preferred choice for routine AM labs. A phlebotomist collects on their normal 0500–0700 rounds; if you order after that window closes, it just rolls to the <i>next</i> 0500–0700 window rather than being collected right away.</p>'
        + '<p><b>Ward Collect</b> — used any time a phlebotomist isn\'t the one drawing it: an MD, ED/HD/ICU nurse, a med-surg nurse (for most draws), or during a rapid response/code. A med-surg nurse specifically <b>cannot</b> draw VBGs, blood cultures, or a type/screen from a PICC line — those need an MD.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('orders'); openIMGeriatricsMenu(); openLabOrderDlg(); document.getElementById('lo-coll-type').size=4; },
    target: function(){ return document.getElementById('lo-coll-type').closest('.cr-field'); },
    title: 'Send Patient to Lab / Immediate Collect',
    html: '<p><b>Send Patient to Lab</b> — for outpatients walking to the lab themselves; this order type <b>never expires</b>, since there\'s no fixed collection window to miss.</p>'
        + '<p><b>Immediate Collect</b> — Lab is obtained at a specified time (phlebotomist must return the sample to the lab immediately). Only order this if you need a lab drawn outside of the 0500 and 0700 window.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Adding On to an Already-Drawn Sample',
    html: '<p>If a specimen is already at the lab and you need one more test from that <b>same tube</b>, you don\'t need a fresh draw — this is called <b>adding on</b> a lab, and it saves the patient another stick:</p>'
        + '<ol><li>Find the <b>tube color</b> the new test needs (Tools → Lab Test Info in real CPRS).</li>'
        + '<li>Open the Lab results tab and find an already-resulted test that used the <b>same</b> tube color.</li>'
        + '<li>Write down that result\'s <b>Accession Number</b>.</li>'
        + '<li>Place an order for the test you want added on.</li>'
        + '<li>Call the lab and give them the accession number so they can add it on.</li></ol>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Habit to Build',
    html: '<p>Default to <b>Lab Collect</b> for routine AM labs and <b>Send Patient to Lab</b> for outpatients — reach for <b>Ward Collect</b> or <b>Immediate Collect</b> only when the situation actually calls for it, since both add real work for nursing or phlebotomy outside their normal rounds.</p>'
        + '<p>Click <b>Finish</b> to close. The <b>▾</b> picker next to <b>? Tour</b> brings you straight back here any time.</p>'
  }
];

/* ---------------------------------------------------------
   NOTIFICATIONS TOUR STEPS
   Standalone sub-tutorial covering the Notifications area at
   the bottom of the Patient Selection dialog -- unlike every
   other module, this one runs against the dialog, not a chart.
   --------------------------------------------------------- */
var NOTIFICATIONS_TOUR_STEPS = [
  {
    center: true,
    title: 'Notifications: Check This Often',
    html: '<p>The <b>Notifications</b> box at the bottom of the Patient Selection screen is where alerts about your patients show up — new lab results, imaging results, completed consults, a patient being admitted or discharged, even a death notification. Checking it regularly is one of the most important habits in real CPRS.</p>'
  },
  {
    before: function(){ ensureDialogOpenForTour(); notifSwitchTab('pending'); },
    target: function(){ return document.querySelector('.pt-dlg-notif'); },
    title: 'The Notifications Panel',
    html: '<p>This box always shows notifications across <b>all</b> of your patients at once, not just whichever one you have open — it\'s a worklist, not a per-patient log.</p>'
  },
  {
    before: function(){ notifSwitchTab('pending'); },
    target: function(){ return document.getElementById('notif-tab-pending'); },
    title: 'Pending Tab (Default)',
    html: '<p>This box always opens on the <b>Pending</b> tab — anything here hasn\'t been dealt with yet. Message types vary widely: <i>Labs resulted</i>, <i>Completed Consult</i>, <i>Imaging Results</i>, <i>Admitted on...</i>, <i>Discharged on...</i>, <i>Order requires electronic signature</i>, and more.</p>'
  },
  {
    before: function(){ notifSwitchTab('pending'); },
    // The notifications table spans nearly the full dialog width, so the
    // engine's normal "beside/below the target" placement has nowhere good
    // to put the card without covering it. Pin the card to the far left
    // edge of the screen instead -- clear of the (centered) dialog
    // entirely -- while highlightTarget still spotlights the real row.
    target: function(){ return document.getElementById('notif-tab-pending'); },
    highlightTarget: function(){ return document.querySelector('#notif-tbl tr[data-idx="0"]') || document.getElementById('notif-tbl'); },
    cardLeft: 20,
    title: 'Double-Click to Act',
    html: '<p><b>Double-clicking</b> a notification (or selecting it and clicking <b>Process</b>) does one of three things, depending on the type:</p>'
        + '<p>1. <b>Results-type alerts</b> (labs, imaging, completed consults) — jumps you straight into that patient\'s chart, to the specific result, and moves the alert to <b>Processed</b>.</p>'
        + '<p>2. <b>Admitted/Discharged alerts</b> — just disappears from Pending. There\'s nothing to review, so it doesn\'t take you anywhere.</p>'
        + '<p>3. <b>Unsigned/uncosigned notes and orders needing a signature</b> — takes you to the chart, but stays in Pending no matter how many times you view it. The only way to clear it is to actually sign the note or order.</p>'
  },
  {
    before: function(){ notifSwitchTab('pending'); },
    // Same reasoning as the step above -- .notif-btn-row spans the full
    // dialog width, so pin the card to the far left edge of the screen and
    // let highlightTarget spotlight the actual button row.
    target: function(){ return document.getElementById('notif-tab-pending'); },
    highlightTarget: function(){ return document.querySelector('.notif-btn-row'); },
    cardLeft: 20,
    title: 'The Button Row',
    html: '<p><b>Process</b> is the one that\'s fully wired up in this simulation — it does whichever behavior above fits that notification. <b>Process Info</b> and <b>Process All</b> are laid out to match real CPRS but aren\'t functional here yet.</p>'
        + '<p><b>Forward</b> lets you send a notification on to another provider — useful if it\'s really someone else\'s patient, or to loop in a colleague. Pick one or more names, optionally add a comment, and click OK.</p>'
  },
  {
    before: function(){ notifSwitchTab('processed'); },
    target: function(){ return document.getElementById('notif-tab-processed'); },
    title: 'The Processed Tab',
    html: '<p>Once a notification is processed, it moves here — along with <b>when</b> it was processed and <b>by whom</b>. Note that the "never clears" (medications nearing expiration) and "stays until signed" alerts you just read about will <i>not</i> show up here even after you\'ve viewed them, since they aren\'t truly resolved yet.</p>'
  },
  {
    center: true,
    before: function(){ notifSwitchTab('pending'); },
    title: 'Habit to Build',
    html: '<p>Get in the habit of opening Patient Selection and scanning Pending regularly throughout your shift — not just at logon. A critical lab or an admission notification sitting unread is a real patient-safety gap in actual CPRS.</p>'
        + '<p>Click <b>Finish</b> to close. The <b>▾</b> picker next to <b>? Tour</b> brings you straight back here any time.</p>'
  }
];

/* ---------------------------------------------------------
   HEADER BUTTONS TOUR STEPS
   Standalone sub-tutorial covering the clickable elements
   across the patient header bar (#pthdr).
   --------------------------------------------------------- */
var HEADER_TOUR_STEPS = [
  {
    before: function(){ closeTeachingPopups(); },
    target: function(){ return document.getElementById('pthdr'); },
    title: 'Patient Header Deep-Dive',
    html: '<p>The patient header bar has several clickable spots beyond the tabs below it — each opens a different quick-reference popup. This tour walks through each one.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); openPatientInquiry(); },
    target: function(){ return document.getElementById('patient-inquiry-dlg'); },
    secondaryTarget: function(){ return document.getElementById('ph-name'); },
    title: 'Patient Inquiry',
    html: '<p>Click the <b>name/DOB/SSN box</b> on the left (outlined in orange) to open <b>Patient Inquiry</b> — address, phone, email, emergency contact, and service connection all in one place.</p>'
        + '<p>Scroll down to the <b>Service Connection/Rated Disabilities</b> block — it lists the veteran\'s SC Percent and each rated disability. A <b>50% or higher</b> combined rating means all visit copayments and medication copays are covered, and above <b>70%</b> also covers the cost of any CLC (Community Living Center) or contracted CNH (Community Nursing Home) stay.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); openEncounter(); },
    target: function(){ return document.getElementById('encounter-dlg'); },
    secondaryTarget: function(){ return document.getElementById('ph-visit'); },
    title: 'Encounter: Provider & Location',
    html: '<p>Click the <b>ward/room/provider box</b> (outlined in orange) to open <b>Provider & Location for Current Activities</b> — the same dialog as the <b>Encounter</b> button at the bottom of the Notes tab.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); openPactInfo(); },
    target: function(){ return document.getElementById('pact-dlg'); },
    secondaryTarget: function(){ return document.getElementById('ph-pact'); },
    title: 'PACT / Primary Care',
    html: '<p>Click the <b>PACT line</b> (outlined in orange — shows the PCP, and for an admitted patient, the inpatient Attending and Provider) to see the rest of their care team — Care Manager, Pharmacist, Social Worker, and clinic contact info.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); openPostings(); },
    target: function(){ return document.getElementById('postings-dlg'); },
    secondaryTarget: function(){ return document.getElementById('hbtn-postings'); },
    title: 'Postings',
    html: '<p><b>Postings</b> (button outlined in orange) is where allergies and any Advance Directive / Life-Sustaining Treatment (LST) notes on file get flagged — worth checking on every new patient. In real CPRS this button is often called <b>CWAD</b> — <b>C</b>risis Notes, <b>W</b>arnings, <b>A</b>dverse Reactions/Allergies, and <b>D</b>irectives, the four categories of critical flags it surfaces.</p>'
        + '<p>Viewing the actual directive document uses a different route — that\'s its own short tutorial (see the <b>VistA Imaging Display</b> module in this picker).</p>'
  },
  {
    before: function(){ closeTeachingPopups(); },
    target: function(){ return document.getElementById('hbtn-pdmp'); },
    title: 'PDMP Query',
    html: '<p><b>PDMP Query</b> runs a check against the state Prescription Drug Monitoring Program — important before prescribing controlled substances like opioids.</p>'
        + '<p>It\'s a two-click flow: the button relabels to <b>PDMP Results</b> once the query finishes, and clicking it again opens the full results and a pended note prompt. See the <b>PDMP Query & Results</b> module in this picker for the full walkthrough.</p>'
  },
  {
    before: function(){
      closeTeachingPopups();
      var pt=currentPt && PTS[currentPt];
      var hasFlags = pt && pt.flags && (((pt.flags.cat1||[]).length)+((pt.flags.cat2||[]).length) > 0);
      if(!hasFlags){ _flagTourOrigPt=currentPt; loadPatient('kowalski'); }
      openPatientFlags();
      // Anchor the dialog in the corner (instead of its default centered
      // position) so the tour card, which renders beside its target,
      // lands in open space next to it rather than on top of it.
      var flagsDlg=document.getElementById('patient-flags-dlg');
      flagsDlg.style.top='20px'; flagsDlg.style.left='20px';
    },
    target: function(){ return document.getElementById('patient-flags-dlg'); },
    secondaryTarget: function(){ return document.getElementById('hbtn-flag'); },
    title: 'Patient Record Flags',
    html: '<p>The <b>Flag</b> button (outlined in orange) is greyed out when a patient has no flags on file — it only opens when there\'s something to show.</p>'
        + '<p><b>Category I</b> flags are national, high-acuity flags (shown with a yellow banner, e.g. High Risk for Suicide). <b>Category II</b> flags are local/facility-specific (e.g. a device implant or an infection-control alert). If a patient has more than one, click a flag in either list to load its details — narrative, status, and history — into the pane below.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); },
    target: function(){ return document.getElementById('hbtn-jlv'); },
    title: 'JLV',
    html: '<p><b>JLV</b> (Joint Legacy Viewer) opens a browser window pulling in outside records — non-VA community care, or records from a different VA facility than the one currently shown.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); },
    target: function(){ return document.getElementById('hbtn-remote-data'); },
    title: 'Remote Data',
    html: '<p><b>Remote Data</b> is a separate button from JLV — clicking it drops down a list of other VA facilities the patient has records at. Checking a site there makes its data available to pull up over in the Reports tab.</p>'
        + '<p>See the <b>Remote Data</b> module in this picker for the full walkthrough.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'That\'s the Header',
    html: '<p>Between Patient Inquiry, Encounter, PACT, Postings, PDMP, and JLV, the header bar alone answers most of the "who is this patient and who\'s taking care of them" questions before you even open a tab.</p>'
        + '<p>Click <b>Finish</b> to close. The <b>▾</b> picker next to <b>? Tour</b> brings you straight back here any time.</p>'
  }
];

/* ---------------------------------------------------------
   VISTA IMAGING DISPLAY TOUR STEPS
   Standalone sub-tutorial covering how to reach VistA Imaging
   from the Tools menu — where EKG tracings and scanned Advance
   Directive documents live. The popup itself is a decorative
   mockup (buttons aren't wired) — this just teaches the workflow.
   --------------------------------------------------------- */
var IMAGING_TOUR_STEPS = [
  {
    center: true,
    title: 'Finding EKGs & Scanned Documents',
    html: '<p><b>VistA Imaging Display</b> is a separate viewer (opens in its own window in real CPRS) for anything that\'s captured as a scanned image or tracing — EKGs, consent forms, and scanned Advance Directive documents included.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); closeAllMenus(); document.getElementById('menu-tools').classList.add('open'); },
    target: function(){ return document.getElementById('dd-vista-imaging'); },
    highlightTarget: function(){ return document.getElementById('menu-tools'); },
    cardOffset: {dx: 40, dy: 60},
    title: 'Tools → VistA Imaging Display',
    html: '<p>Open the <b>Tools</b> menu and select <b>VistA Imaging Display</b> — near the top of the menu, above the separator.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); openVistaImaging(); },
    target: function(){ return document.getElementById('vista-imaging-dlg'); },
    title: 'The Image List',
    html: '<p>This opens a list of every scanned image or tracing on file for the patient — site, note title, procedure, class, and capture date, similar to the Orders or Labs list.</p>'
        + '<p>This mockup isn\'t click-through-functional — the goal is just to recognize the window and know when to reach for it.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); openVistaImaging(); },
    target: function(){ return document.getElementById('vi-btn-ekg'); },
    title: 'Finding an EKG',
    html: '<p>EKG tracings aren\'t in this default image list — click the small red squiggle icon in the <b>toolbar</b> above the list to pull up EKG tracings specifically, including a prior 12-lead to compare against a current one.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); openVistaImaging(); },
    target: function(){ return document.getElementById('vi-ad-row'); },
    title: 'Finding the Advance Directive',
    html: '<p>This is also where a scanned <b>Advance Directive</b> document lives (<b>Class: ADVANCE DIR</b>) — this is the "different route" referenced in the Postings step of the Header Deep-Dive tour.</p>'
        + '<p>Postings tells you <i>whether</i> a directive is on file; VistA Imaging is where you\'d actually open and read it.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Habit to Build',
    html: '<p>If a patient has a directive flagged in Postings, this is where you can find the Advance Directive(s).</p>'
        + '<p>Click <b>Finish</b> to close. The <b>▾</b> picker next to <b>? Tour</b> brings you straight back here any time.</p>'
  }
];

/* ---------------------------------------------------------
   PDMP QUERY & RESULTS TOUR STEPS
   Standalone sub-tutorial covering the two-click PDMP Query →
   PDMP Results flow and the pended note it can file.
   --------------------------------------------------------- */
var PDMP_TOUR_STEPS = [
  {
    center: true,
    before: function(){ closeTeachingPopups(); goTab('notes'); if(currentPt) PTS[currentPt]._pdmpState='none'; if(typeof updatePdmpButton==='function') updatePdmpButton(); },
    title: 'The State Prescription Drug Monitoring Program',
    html: '<p>Before prescribing a controlled substance, check whether the patient has been filling controlled-substance prescriptions <b>outside the VA</b> — the state PDMP is the tool for that.</p>'
        + '<p>In real CPRS this is a two-click flow. Let\'s walk through it.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('notes'); if(currentPt) PTS[currentPt]._pdmpState='none'; if(typeof updatePdmpButton==='function') updatePdmpButton(); },
    target: function(){ return document.getElementById('hbtn-pdmp'); },
    title: 'Click PDMP Query',
    html: '<p>Clicking <b>PDMP Query</b> submits the request to the state PDMP gateway. The button briefly shows <b>Querying...</b> while it runs.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('notes'); if(currentPt) PTS[currentPt]._pdmpState='results'; if(typeof updatePdmpButton==='function') updatePdmpButton(); },
    target: function(){ return document.getElementById('hbtn-pdmp'); },
    title: 'Click PDMP Results',
    html: '<p>Once the query finishes, the same button relabels to <b>PDMP Results</b>. Click it again to open the full results.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('notes'); if(currentPt){ PTS[currentPt]._pdmpState='results'; } if(typeof openPdmpResultsPopup==='function') openPdmpResultsPopup(); },
    target: function(){ return document.getElementById('pdmp-results-dlg'); },
    title: 'Reading the Results',
    html: '<p>The results screen shows demographics, a <b>Summary</b> of prescription/prescriber counts (including narcotics and buprenorphine specifically), and a <b>Prescriptions</b> table of individual fills — all zero in this simulation, since no PDMP hits are modeled for any of the five patients.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('notes'); if(currentPt){ PTS[currentPt]._pdmpState='results'; } if(typeof openPdmpResultsPopup==='function') openPdmpResultsPopup(); },
    target: function(){ return document.getElementById('pdmp-pend-panel'); },
    title: 'Filing the Pended Note',
    html: '<p>The panel at the bottom prompts you to pick a summary statement (or write your own) describing what the query found and whether it changes the plan.</p>'
        + '<p><b>Done and Create Note</b> files a pended <b>STATE PRESCRIPTION DRUG MONITORING PROGRAM</b> note in the Notes tab using that statement. <b>Cancel Without Update</b> closes without filing anything.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); goTab('notes'); },
    title: 'Habit to Build',
    html: '<p>Query the PDMP before prescribing new or refilled opioids, benzodiazepines, or other controlled substances — and note what it did or didn\'t show, even if there\'s nothing concerning to report.</p>'
        + '<p>Click <b>Finish</b> to close. The <b>▾</b> picker next to <b>? Tour</b> brings you straight back here any time.</p>'
  }
];

/* ---------------------------------------------------------
   REMOTE DATA TOUR STEPS
   Standalone sub-tutorial covering the Remote Data dropdown
   in the header and the matching Health Summary "Remote..."
   report items in the Reports tab.
   --------------------------------------------------------- */
var REMOTE_DATA_TOUR_STEPS = [
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Remote Data vs. JLV',
    html: '<p><b>Remote Data</b> is a distinct feature from JLV. JLV opens a separate viewer for outside records; <b>Remote Data</b> pulls records from a patient\'s <b>other VA facilities</b> directly into CPRS\'s own Reports tab.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); if(typeof toggleRemoteDataPanel==='function') toggleRemoteDataPanel(); },
    target: function(){ return document.getElementById('remote-data-panel'); },
    secondaryTarget: function(){ return document.getElementById('hbtn-remote-data'); },
    title: 'Click Remote Data',
    html: '<p>Clicking the <b>Remote Data</b> button (outlined in orange) drops down a small panel listing any other VA facility the patient has records at, each with a <b>Last Seen</b> date.</p>'
  },
  {
    before: function(){
      closeTeachingPopups();
      if(currentPt){
        var pt=PTS[currentPt];
        if(pt.remoteSites && pt.remoteSites.length){ setRemoteSiteChecked(pt.remoteSites[0].name, true); }
      }
      if(typeof toggleRemoteDataPanel==='function') toggleRemoteDataPanel();
    },
    target: function(){ return document.getElementById('rdp-sites'); },
    title: 'Check a Site',
    html: '<p>Checking a site\'s box (like this one, now checked) makes that facility\'s data available to pull up in the Reports tab. Check as many sites as apply — <b>All Available Sites</b> selects them all at once.</p>'
        + '<p>The <b>Non-VA Data may be Available</b> line is informational only — that\'s the JLV workflow, not Remote Data.</p>'
  },
  {
    before: function(){
      closeTeachingPopups();
      if(currentPt){
        var pt=PTS[currentPt];
        if(pt.remoteSites && pt.remoteSites.length){ setRemoteSiteChecked(pt.remoteSites[0].name, true); }
      }
      goTab('reports');
      var hs=_findTreeItem('#reports-left','Health Summary');
      if(hs) hs.click();
    },
    target: function(){ return document.getElementById('reports-left'); },
    title: 'Reports → Health Summary',
    html: '<p>Over in the Reports tab, expand <b>Health Summary</b> in the left tree. Most of its items are Health Summary types this simulation doesn\'t model — but the ones prefixed <b>Remote</b> are what we just enabled.</p>'
  },
  {
    before: function(){
      closeTeachingPopups();
      if(currentPt){
        var pt=PTS[currentPt];
        if(pt.remoteSites && pt.remoteSites.length){ setRemoteSiteChecked(pt.remoteSites[0].name, true); }
      }
      goTab('reports');
      var el=_findTreeItem('#reports-left','Remote Clinical Data (1y)');
      if(el) el.click();
    },
    target: function(){ return document.getElementById('remote-tabbar'); },
    title: 'Reading the Remote Report',
    html: '<p>The right pane opens with a <b>Local</b> tab plus one tab per site you checked. Click a site\'s tab to see a formatted summary pulled from that facility — demographics, allergies, active problems, and outpatient pharmacy in this report type.</p>'
        + '<p><b>Remote Labs Long View</b> and <b>Remote Meds/Labs/Orders</b> are built out with their own real content too; the rest of the Remote-prefixed items show an honest "not modeled" placeholder.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Habit to Build',
    html: '<p>If a patient mentions care at another VA — or you notice orders/meds that don\'t match what\'s in this chart — check Remote Data before assuming the record is incomplete.</p>'
        + '<p>Click <b>Finish</b> to close. The <b>▾</b> picker next to <b>? Tour</b> brings you straight back here any time.</p>'
  }
];

/* ---------------------------------------------------------
   NOTES TOOLS TOUR STEPS
   Standalone sub-tutorial covering the three buttons at the
   bottom of the Notes tab's left column: Templates, Encounter,
   and New Note.
   --------------------------------------------------------- */
var NOTES_TOOLS_TOUR_STEPS = [
  {
    center: true,
    before: function(){ closeTeachingPopups(); goTab('notes'); },
    title: 'Notes Tab Tools',
    html: '<p>Below the note list in the Notes tab are three buttons — <b>/ Templates</b>, <b>Encounter</b>, and <b>New Note</b> — that handle writing a new note. There\'s also a way to sort/filter the note list itself via the <b>View</b> menu. This tour covers all of it.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('notes'); },
    target: function(){ return document.querySelector('#notes-outer .btn-area'); },
    title: 'Where These Live',
    html: '<p>All three buttons sit at the bottom of the note list column, always visible regardless of which note you\'re currently viewing.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('notes'); var acc=document.getElementById('tpl-accordion'); if(acc && acc.style.display==='none') toggleTemplatesAccordion(); },
    target: function(){ return document.getElementById('tpl-accordion'); },
    title: '/ Templates',
    html: '<p><b>Templates</b> expands into a tree of boilerplate text you can insert into a note — either something you built yourself (<b>My Templates</b>) or one of CPRS\'s built-in <b>Shared Templates</b>, organized by specialty/service folder.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('notes'); showFloatWin('new-note-dlg'); },
    target: function(){ return document.getElementById('new-note-dlg'); },
    title: 'New Note',
    html: '<p><b>New Note</b> is where you pick the <b>note title</b> (e.g. Internal Medicine Progress Note, History and Physical) from the list, confirm the date/time and author, and assign a <b>Cosigner</b> if one is required (e.g. a resident\'s note needing attending sign-off).</p>'
        + '<p>The list of note titles available here is configurable per user via <b>Tools → Options → Notes</b> tab — worth knowing if a title you expect to see is missing.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('notes'); openEncounter(); },
    target: function(){ return document.getElementById('encounter-dlg'); },
    title: 'Encounter',
    html: '<p><b>Encounter</b> opens the same <b>Provider & Location for Current Activities</b> dialog as the ward/room box in the patient header — see the <b>Patient Header Deep-Dive</b> module for the full walkthrough.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('notes'); closeAllMenus(); buildViewMenu(); document.getElementById('menu-view').classList.add('open'); },
    target: function(){ return document.getElementById('dd-view'); },
    highlightTarget: function(){ return document.getElementById('menu-view'); },
    cardOffset: {dx: 30, dy: 40},
    title: 'Sorting the Note List: View → Custom View',
    html: '<p>The <b>View</b> menu changes based on which tab you\'re on — while in Notes, it has note-specific options. <b>Custom View</b> is the one worth knowing.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('notes'); openCustomView(); },
    target: function(){ return document.getElementById('custom-view-dlg'); },
    title: 'List Selected Documents',
    html: '<p>Two fields matter most here: <b>Max Number to Return</b> (top right) caps how many notes load — useful for a patient with a very long chart. <b>Contains</b> (bottom right) lets you type part or all of a note title, and any matching notes get <b>bolded</b> in the list so they stand out without filtering everything else out.</p>'
        + '<p>Try it: type <code>Progress</code> into Contains and click <b>OK</b> to see matching notes bold in the list behind this popup.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Habit to Build',
    html: '<p>Reach for <b>Templates</b> to save typing on a routine note type, and always double-check the <b>Cosigner</b> field in New Note if you\'re a trainee — a note without a required cosigner won\'t count as complete. Use <b>Custom View\'s Contains</b> field to quickly spot a specific note type in a long chart.</p>'
        + '<p>Click <b>Finish</b> to close. The <b>▾</b> picker next to <b>? Tour</b> brings you straight back here any time.</p>'
  }
];

/* ---------------------------------------------------------
   LABS VIEWS TOUR STEPS
   Standalone sub-tutorial covering when to reach for each of
   the three main Labs left-panel views.
   --------------------------------------------------------- */
var LABS_VIEWS_TOUR_STEPS = [
  {
    center: true,
    before: function(){ closeTeachingPopups(); goTab('labs'); if(typeof window._labsSection==='function') window._labsSection('most-recent'); },
    title: 'Three Ways to Look at Labs',
    html: '<p>The Labs tab has several views in the left panel, but three cover almost everything you need day to day: <b>Most Recent</b>, <b>Lab Overview</b>, and <b>Worksheet</b>. Each answers a different question.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('labs'); if(typeof window._labsSection==='function') window._labsSection('most-recent'); },
    target: function(){ return _findTreeItem('#labs-left', 'Most Recent'); },
    title: 'Most Recent — "What are today\'s numbers?"',
    html: '<p><b>Most Recent</b> (the tab\'s default view) shows only the latest collected panel of each type — one clean snapshot of current values. Use the <b>&lt;&lt; Oldest / &lt; Previous / Next &gt; / Newest &gt;&gt;</b> buttons above the table to step back through prior collections one panel at a time.</p>'
        + '<p>This is the fastest view for "what does the patient\'s chemistry look like right now" before rounds.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('labs'); if(typeof window._labsSection==='function') window._labsSection('overview'); },
    target: function(){ return _findTreeItem('#labs-left', 'Lab Overview (Collected Specimens)'); },
    title: 'Lab Overview — "What\'s been collected, and when?"',
    html: '<p><b>Lab Overview</b> lists every individual specimen collected in the date range, one row per test per collection — useful for confirming a specific test actually resulted, or for scanning everything drawn on a particular day.</p>'
        + '<p>Click any row to load its full result in the pane at the bottom.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('labs'); if(typeof window._labsSection==='function') window._labsSection('worksheet'); },
    target: function(){ return _findTreeItem('#labs-left', 'Worksheet'); },
    title: 'Worksheet — "How is this trending over time?"',
    html: '<p><b>Worksheet</b> builds a custom trend table: dates as columns, the tests you pick as rows. Use it when you want to see a value change over several days at a glance — a creatinine trending down after an AKI, or a WBC count over the course of a treated infection.</p>'
        + '<p>Selecting it opens a <b>Select Lab Tests</b> popup first — pick the panel(s)/test(s) you want, then confirm to build the table.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('labs'); if(typeof window._labsSection==='function') window._labsSection('worksheet'); },
    target: function(){ return document.getElementById('select-labs-dlg'); },
    title: 'Select Lab Tests',
    html: '<p>Check off the specific tests you want trended, then confirm — the Worksheet table behind this popup fills in with one column per collection date for just those tests, instead of every panel ever drawn.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('labs'); if(typeof window._labsSection==='function') window._labsSection('micro'); },
    target: function(){ return _findTreeItem('#labs-left', 'Microbiology'); },
    title: 'Microbiology',
    html: '<p><b>Microbiology</b> pulls together culture, sensitivity, and Gram stain results from anywhere in the chart — including ones embedded inside another panel (e.g. a blood culture reported alongside a CBC/infectious workup) — into one dedicated list. Click a row for the full detail, including susceptibility results.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Habit to Build',
    html: '<p>Reach for <b>Most Recent</b> for a quick daily check, <b>Lab Overview</b> when you need to confirm exactly what was drawn and when, and <b>Worksheet</b> whenever you\'re presenting a trend (e.g. "creatinine has been improving daily since Tuesday"). Remember: abnormal values are flagged with <b>H</b>/<b>L</b> in the Flag column, not by color — the result itself is always plain black text.</p>'
        + '<p>Click <b>Finish</b> to close. The <b>▾</b> picker next to <b>? Tour</b> brings you straight back here any time.</p>'
  }
];

/* ---------------------------------------------------------
   REPORTS VIEWS TOUR STEPS
   Standalone sub-tutorial covering the Reports tab's views
   that actually have real data behind them in this simulation:
   Imaging, Procedures, and the Pharmacy accordion.
   --------------------------------------------------------- */
var REPORTS_VIEWS_TOUR_STEPS = [
  {
    center: true,
    before: function(){ closeTeachingPopups(); goTab('reports'); },
    title: 'Reports Tab: Where the Real Data Lives',
    html: '<p>The Reports tab\'s left panel lists many report types, but most show a placeholder "No matching documents found" in this simulation. Three areas actually have real content: <b>Imaging</b>, <b>Procedures</b>, and the <b>Pharmacy</b> section under Clinical Reports. This tour covers all three.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('reports'); var el=_findTreeItem('#reports-left','Imaging (local only)'); if(el) el.click(); },
    target: function(){ return _findTreeItem('#reports-left', 'Imaging (local only)'); },
    title: 'Imaging (local only)',
    html: '<p><b>Imaging (local only)</b> lists radiology studies performed at this facility — CT, X-ray, and similar studies — with the full read/impression loading in the pane below when you click a row.</p>'
        + '<p>This is the go-to spot for reading a radiologist\'s official interpretation of a study, as opposed to a clinician\'s note that just mentions the result in passing.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('reports'); var el=_findTreeItem('#reports-left','Procedures (local only)'); if(el) el.click(); },
    target: function(){ return _findTreeItem('#reports-left', 'Procedures (local only)'); },
    title: 'Procedures (local only)',
    html: '<p><b>Procedures (local only)</b> holds GI and similar procedure reports — EGD, colonoscopy, and completed echocardiograms. Click a row to load the full procedure note, including findings and any biopsies taken.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('reports'); var cr=_findTreeItem('#reports-left','Clinical Reports'); if(cr) cr.click(); },
    target: function(){ return _findTreeItem('#reports-left', 'Pharmacy'); },
    title: 'Clinical Reports → Pharmacy',
    html: '<p>Expand <b>Clinical Reports</b> on the left, then look for <b>Pharmacy</b> partway down the list. This is where a patient\'s <b>historical medication record</b> lives — active and prior outpatient prescriptions, IV/unit-dose administration history, and med admin logs — separate from the current active-orders view in the Meds and Orders tabs.</p>'
        + '<p>This mock doesn\'t have real data wired into these sub-items yet, but knowing this is the right place to look is the important part.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Habit to Build',
    html: '<p>Use <b>Imaging</b> for the radiologist\'s official read, <b>Procedures</b> for GI/echo reports, and remember <b>Pharmacy</b> under Clinical Reports as the place to check a patient\'s medication history rather than just their currently active list.</p>'
        + '<p>Click <b>Finish</b> to close. The <b>▾</b> picker next to <b>? Tour</b> brings you straight back here any time.</p>'
  }
];

/* ---------------------------------------------------------
   COVER SHEET TOUR STEPS
   Standalone sub-tutorial covering three Cover Sheet panels
   that are easy to skim past: Clinical Reminders, Recent
   Immunizations, and Appointments/Visits/Admissions.
   --------------------------------------------------------- */
var COVER_SHEET_TOUR_STEPS = [
  {
    center: true,
    before: function(){ closeTeachingPopups(); goTab('cover'); },
    title: 'Cover Sheet: Reminders, Immunizations & Appointments',
    html: '<p>Three panels on the Cover Sheet — <b>Clinical Reminders</b>, <b>Recent Immunizations</b>, and <b>Appointments/Visits/Admissions</b> — are particularly relevant in the outpatient setting, though they\'re still technically relevant inpatient too. This tour walks through each.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('cover'); },
    target: function(){ return _findCsCell('Clinical Reminders'); },
    title: 'Clinical Reminders',
    html: '<p>This panel lists a patient\'s <b>outstanding preventive-care items</b> — screenings, immunizations, and other health-maintenance actions that are due. A due date of <b>DUE NOW</b> means it\'s overdue; an actual date means it\'s an upcoming due window worth being aware of.</p>'
        + '<p>The same list is also reachable from the <b>alarm clock icon</b> in the patient header — clicking it opens the full Available Reminders browser.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('cover'); },
    target: function(){ return _findCsCell('Recent Immunizations'); },
    title: 'Recent Immunizations',
    html: '<p>This panel is a quick-reference <b>immunization history</b> — what the patient has already received and when, most recent first. This is a good place to quickly reference what vaccines have been administered.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('cover'); },
    target: function(){ return _findCsCell('Appointments/Visits/Admissions'); },
    title: 'Appointments/Visits/Admissions',
    html: '<p>This panel is a timeline of the patient\'s <b>recent and upcoming encounters</b> — clinic visits, inpatient admissions, and specialty consults — each with a <b>Date/Time</b>, <b>Location</b>, and an <b>Action Req</b> column.</p>'
        + '<p><b>Action Req</b> tells you the status of that encounter: <b>Checked Out</b> (completed visit), <b>Inpatient Appointment</b> (a consult or study tied to the current admission), <b>Admitted</b>, or <b>Non-Count</b> (an administrative/workload entry that doesn\'t represent real patient contact). You may also see <b>Cancelled by Patient</b> (the patient cancelled that scheduled appointment) or <b>Cancelled by Clinic</b> (the clinic cancelled it — the reason usually isn\'t listed here). This is a fast way to see everything that\'s happened around a stay without opening Notes or Consults individually.</p>'
  }
];

/* ---------------------------------------------------------
   CONSULTS TAB TOUR STEPS
   Standalone sub-tutorial teaching the Consults tab's status-code
   nomenclature -- (p)/(a)/(s)/(pr)/(c)/(x)/(dc). Runs entirely on
   Kowalski's chart, which carries one example of every status.
   --------------------------------------------------------- */
var CONSULTS_TOUR_STEPS = [
  {
    center: true,
    before: function(){ closeTeachingPopups(); goTab('consults'); },
    title: 'Reading the Consults Tab',
    html: '<p>The <b>All consults</b> tree on the left lists every consult ordered for this patient, newest first. The letters in parentheses next to each date are a <b>status code</b> — that nomenclature is the whole point of this module, since it tells you at a glance whether a consult has a note to read yet.</p>'
        + '<p>Clicking any row loads its detail into the pane on the right — either the full signed note (for a completed consult) or an Order Information summary (for everything else).</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('consults'); var el=_findConsultItem('Jun 20,26 (p) PHYSICAL THERAPY CONSULT Cons Consult #: 9705115'); if(el) el.click(); },
    target: function(){ return _findConsultItem('Jun 20,26 (p) PHYSICAL THERAPY CONSULT Cons Consult #: 9705115'); },
    title: '(p) — Pending',
    html: '<p><b>(p) Pending</b> means the consult has been ordered but hasn\'t been received or processed by the receiving service yet. No note exists yet — the detail pane shows the order information (requesting provider, reason for request, etc.) instead of a note.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('consults'); var el=_findConsultItem('Jun 19,26 (a) SOCIAL WORK CONSULT Cons Consult #: 9705116'); if(el) el.click(); },
    target: function(){ return _findConsultItem('Jun 19,26 (a) SOCIAL WORK CONSULT Cons Consult #: 9705116'); },
    title: '(a) — Active',
    html: '<p><b>(a) Active</b> means the consult has been received by the service and is being worked on — one step further along than pending, but still no note yet.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('consults'); var el=_findConsultItem('Jul 03,26 (s) CARDIOLOGY OUTPT F/U CONSULT Cons Consult #: 9705117'); if(el) el.click(); },
    target: function(){ return _findConsultItem('Jul 03,26 (s) CARDIOLOGY OUTPT F/U CONSULT Cons Consult #: 9705117'); },
    title: '(s) — Scheduled',
    html: '<p><b>(s) Scheduled</b> means a specific appointment date/time has been set for this consult — you\'ll see that reflected in the Facility activity log at the bottom of the detail pane. That same scheduled appointment should also show up on the <b>Cover Sheet</b>, in the Appointments/Visits/Admissions panel.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('consults'); var el=_findConsultItem('Jun 19,26 (pr) CARDIOLOGY ECHO REVIEW CONSULT Cons Consult #: 9705118'); if(el) el.click(); },
    target: function(){ return _findConsultItem('Jun 19,26 (pr) CARDIOLOGY ECHO REVIEW CONSULT Cons Consult #: 9705118'); },
    title: '(pr) — Partial Results',
    html: '<p><b>(pr) Partial Results</b> means a note exists but it\'s incomplete or still awaiting cosignature — close to done, but not yet a finished, signed consult.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('consults'); var el=_findConsultItem('Jun 19,26 (c) NEPHROLOGY CONSULT Cons Consult #: 9705111'); if(el) el.click(); },
    target: function(){ return _findConsultItem('Jun 19,26 (c) NEPHROLOGY CONSULT Cons Consult #: 9705111'); },
    title: '(c) — Completed',
    html: '<p><b>(c) Completed</b> is the one you\'ll reach for most — the consult has a finished, signed note attached. You can read it right here in the detail pane, or find the same note over in the <b>Notes</b> tab.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('consults'); var el=_findConsultItem('Jun 19,26 (x) NUTRITION CONSULT Cons Consult #: 9705119'); if(el) el.click(); },
    target: function(){ return _findConsultItem('Jun 19,26 (x) NUTRITION CONSULT Cons Consult #: 9705119'); },
    title: '(x) — Cancelled',
    html: '<p><b>(x) Cancelled</b> means the consult was called off after being placed.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('consults'); var el=_findConsultItem('Jun 19,26 (x) NUTRITION CONSULT Cons Consult #: 9705119'); if(el) el.click(); },
    target: function(){ return document.getElementById('cons-edit-resubmit-btn'); },
    title: 'Edit/Resubmit',
    html: '<p>Notice the new <b>Edit/Resubmit</b> button above New Consult/New Procedure — it only appears because <b>you</b> (the logged-in provider) were the one who cancelled this particular consult. If someone else had cancelled it, that button wouldn\'t be there at all.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('consults'); var el=_findConsultItem('Jun 18,26 (dc) PODIATRY CONSULT Cons Consult #: 9705120'); if(el) el.click(); },
    target: function(){ return _findConsultItem('Jun 18,26 (dc) PODIATRY CONSULT Cons Consult #: 9705120'); },
    title: '(dc) — Discontinued',
    html: '<p><b>(dc) Discontinued</b> is a separate outcome from cancelled, and can happen for a few different reasons — a consult can be discontinued after failed scheduling attempts, or automatically after sitting pending too long, among other reasons. Seeing <b>(dc)</b> alone doesn\'t tell you exactly which of those applies, but you can usually find the specific discontinuation reason entered as part of the activity log, like the one here — <b>Failed mandated scheduling attempts</b>.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'The Full Set',
    html: '<p>To recap all seven: <b>(p)</b> pending, <b>(a)</b> active, <b>(s)</b> scheduled, <b>(pr)</b> partial results, <b>(c)</b> completed, <b>(x)</b> cancelled, <b>(dc)</b> discontinued. Once these are second nature, a glance at the Consults tree tells you exactly what still needs following up on.</p>'
  }
];

/* ---------------------------------------------------------
   ORDER ENTRY TOUR STEPS
   Standalone sub-tutorial covering placing an order via the
   Orders tab's order menus. Runs against the outpatient case
   (Torres) since the Primary Care order menu is the relevant
   entry point. This whole workflow is simulated — no order
   is actually added to the patient's chart.
   --------------------------------------------------------- */
var ORDER_ENTRY_TOUR_STEPS = [
  {
    center: true,
    title: 'Placing Orders (Simulated)',
    html: '<p>Real CPRS orders are placed through <b>order menus</b> — cascading lists of quick orders organized by service and clinic. This tour walks through navigating one and "signing" an order.</p>'
        + '<p>This is a <b>simulation</b>: nothing you sign here is actually added to the patient\'s chart. The point is building comfort with the navigation, not the clinical content.</p>'
  },
  {
    tab: 'orders',
    before: function(){ closeTeachingPopups(); goTab('orders'); },
    target: function(){ return document.getElementById('tab-orders'); },
    title: 'Start in the Orders Tab',
    html: '<p>The left column lists order menus grouped by setting — look for <b>WLA Primary Care Order Menu</b> under the outpatient clinics section.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); goTab('orders'); },
    target: function(){ return _findOrderMenuItem('WLA Primary Care Order Menu'); },
    title: 'Open a Primary Care Order Menu',
    html: '<p>Click <b>WLA Primary Care Order Menu</b> to open its cascading list of quick orders — labs, meds, consults, and referrals, organized in columns.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); goTab('orders'); },
    title: 'Pick an Order and Sign It',
    html: '<p>Clicking any leaf item (not a bold group heading) opens a <b>New Order</b> dialog summarizing what you picked. Clicking <b>Sign</b> shows a confirmation — that\'s the whole simulated flow.</p>'
        + '<p>The right-click context menu on an existing order row also has working <b>Sign...</b> and <b>Copy to New Order...</b> items that go through the same flow.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Habit to Build',
    html: '<p>Knowing where a given order type lives in the menu tree — and that quick orders are pre-built templates, not free text — is most of what makes real order entry fast.</p>'
        + '<p>Click <b>Finish</b> to close. The <b>▾</b> picker next to <b>? Tour</b> brings you straight back here any time.</p>'
  }
];

/* ---------------------------------------------------------
   ENCOUNTER CODING TOUR STEPS
   Standalone sub-tutorial covering the Encounter dialog's
   New Visit tab — diagnosis, visit type, and provider
   selection. Runs against the outpatient case (Torres).
   --------------------------------------------------------- */
var ENCOUNTER_CODING_TOUR_STEPS = [
  {
    center: true,
    title: 'Coding an Outpatient Encounter',
    html: '<p>Every outpatient visit needs to be <b>coded</b> — tied to a diagnosis and a visit type — before it can be closed out. This tour walks through the <b>Encounter</b> dialog\'s <b>New Visit</b> tab.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); openEncounter(); },
    target: function(){ return document.getElementById('encounter-dlg'); },
    title: 'The Encounter Dialog',
    html: '<p>Open this from the header\'s provider/location box or the Notes tab\'s <b>Encounter</b> button. It has three tabs: <b>Clinic Appointments</b>, <b>Hospital Admissions</b>, and <b>New Visit</b>.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); openEncounter(); encTabSwitch('newvisit'); },
    target: function(){ return document.getElementById('enc-tab-newvisit'); },
    title: 'New Visit: Diagnosis, Visit Type, Provider',
    html: '<p>Pick a <b>Diagnosis</b> from the patient\'s active problem list (or the short common-diagnosis list below it), choose a <b>Visit Type</b>, and confirm the <b>Provider</b> at the top of the dialog.</p>'
        + '<p>The <b>E/M Level</b> and <b>CPT Code</b> fields are shown for context but are fixed in this simulation — real coding software would let you adjust these based on visit complexity.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Habit to Build',
    html: '<p>Coding the encounter before you close it out is what generates the visit\'s billing and lets the diagnosis flow into the patient\'s problem list and future reminders logic.</p>'
        + '<p>Click <b>Finish</b> to close. The <b>▾</b> picker next to <b>? Tour</b> brings you straight back here any time.</p>'
  }
];

/* ---------------------------------------------------------
   CLINICAL REMINDERS TOUR STEPS
   Standalone sub-tutorial covering the Reminders workflow —
   a dedicated entry point (not tied to opening an encounter)
   listing due preventive-care items to process one at a time.
   --------------------------------------------------------- */
var CLINICAL_REMINDERS_TOUR_STEPS = [
  {
    center: true,
    title: 'Clinical Reminders',
    html: '<p><b>Clinical Reminders</b> surface due preventive-care items — mammograms, foot exams, immunizations — independent of any specific visit. You open them from their own dedicated button, not from coding an encounter.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); if(typeof openReminders==='function') openReminders(); },
    target: function(){ return document.getElementById('reminders-dlg'); },
    title: 'The Reminders List',
    html: '<p>Each row is one due reminder for this patient. Click a row to open it and see the detail.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); if(typeof openReminders==='function') openReminders(); },
    title: 'Processing One at a Time',
    html: '<p>Within a reminder\'s detail view, mark it <b>Done</b>, <b>Refused</b>, or <b>Not Indicated</b> — whichever fits. Unlike orders and encounters, this really does update the reminder\'s status (it just resets on page reload, like everything else in this simulation).</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Habit to Build',
    html: '<p>Checking Reminders is core outpatient hygiene — it\'s how preventive care gets done at scale instead of relying on memory during a busy visit.</p>'
        + '<p>Click <b>Finish</b> to close. The <b>▾</b> picker next to <b>? Tour</b> brings you straight back here any time.</p>'
  }
];

/* ---------------------------------------------------------
   MEDS TAB: ORDERING A MEDICATION (Change...)
   Standalone sub-tutorial walking the "Change..." order-entry
   dialog end-to-end using the Acetaminophen (Tylenol) entry
   every patient now carries, per the user's own teaching notes.
   --------------------------------------------------------- */
// Shared by the Dosage/Route/Schedule, PRN, and Indication/Pick Up steps --
// closeTeachingPopups() (called from every step's before()) closes
// change-order-dlg along with everything else, so each of those steps has
// to reopen it fresh rather than assuming it's still open from a prior step.
function _medsOrderTourOpenDialog(){
  closeTeachingPopups(); _goMedsTab();
  if(typeof openChangeOrder!=='function') return;
  var row=_findMedsRow('meds-home-tbl','ACETAMINOPHEN');
  var idx=row ? Array.prototype.indexOf.call(document.querySelectorAll('#meds-home-tbl tbody tr'), row) : -1;
  if(idx>-1) openChangeOrder('outpt', idx);
  // change-order-dlg is wide enough to fill most of the viewport at its
  // default centered-ish position, leaving the tour card nowhere to render
  // without overlapping it -- pin it to the top-left corner for this
  // module's steps only, same technique used by the Header Deep-Dive
  // Flag step, so the card has room on the right instead.
  var dlg=document.getElementById('change-order-dlg');
  if(dlg){ dlg.style.top='20px'; dlg.style.left='20px'; }
}
var MEDS_ORDER_TOUR_STEPS = [
  {
    center: true,
    tab: 'meds',
    before: function(){ closeTeachingPopups(); },
    title: 'Changing an Active Medication',
    html: '<p>This walks through the <b>Change...</b> order-entry dialog. We\'ll use <b>acetaminophen</b> as the example since every patient in this simulation has this prescription.</p>'
  },
  {
    tab: 'meds',
    before: function(){ closeTeachingPopups(); _goMedsTab(); },
    target: function(){ return document.getElementById('meds-outpt-sec'); },
    title: 'Outpatient Medications',
    html: '<p>Find the medication you wish to change. <b>Right-click</b> it to open its context menu.</p>'
  },
  {
    before: function(){
      closeTeachingPopups(); _goMedsTab();
      var row=_findMedsRow('meds-home-tbl','ACETAMINOPHEN');
      if(row && typeof showMedsCtxMenu==='function'){
        // On patients with a long enough Outpatient Medications list (e.g.
        // Kowalski), the Acetaminophen row can be scrolled out of view --
        // getBoundingClientRect() on a clipped-but-still-in-the-DOM row
        // returns coordinates way outside the visible area, which is what
        // sent the context menu "floating in nowhere". Scroll it into view
        // first so the rect (and therefore the menu's position) is real.
        row.scrollIntoView({block:'center'});
        var idx=Array.prototype.indexOf.call(document.querySelectorAll('#meds-home-tbl tbody tr'), row);
        var rect=row.getBoundingClientRect();
        showMedsCtxMenu({preventDefault:function(){}, currentTarget:row, target:row, pageX:rect.left+60, pageY:rect.top+8}, 'outpt', idx);
      }
    },
    target: function(){ return document.getElementById('meds-ctx-menu'); },
    highlightTarget: function(){
      var menu=document.getElementById('meds-ctx-menu'); if(!menu) return null;
      var items=menu.querySelectorAll('.ctx-item');
      for(var i=0;i<items.length;i++){ if(items[i].textContent.trim()==='Change...') return items[i]; }
      return menu;
    },
    title: 'Change...',
    html: '<p>Choose <b>Change...</b> from the context menu — it\'s a similar order-entry dialog to the one you\'d use when ordering a brand-new medication via the Orders tab.</p>'
  },
  {
    before: function(){ _medsOrderTourOpenDialog(); },
    target: function(){ return document.getElementById('change-order-dlg'); },
    title: 'Dosage, Route, and Schedule',
    html: '<p>Three columns drive the actual order: <b>Dosage</b> (strength, with price/tier), <b>Route</b> lets you select the route of administration, such as Oral, Intravenous, IV Piggyback, IV Push, Subcutaneous, or Intramuscular, and <b>Schedule</b> — the long list on the right.</p>'
        + '<p>Pick the strength and schedule that match what you actually want the patient taking — pay careful attention to make sure the correct dose, route, and schedule are selected.</p>'
  },
  {
    before: function(){ _medsOrderTourOpenDialog(); },
    target: function(){ return document.getElementById('co-prn-label'); },
    cardOffset: {dx: 280, dy: 0},
    title: 'PRN Changes How Quantity Works',
    html: '<p>The <b>PRN</b> checkbox allows you to toggle whether a medication is as-needed or scheduled.</p>'
        + '<p>With PRN <b>checked</b>, Quantity is <i>not</i> auto-filled — as-needed medications don\'t have a predictable daily dose count, so that number has to be entered by hand.</p>'
  },
  {
    before: function(){ _medsOrderTourOpenDialog(); },
    target: function(){ return document.getElementById('co-qty-refill-group'); },
    title: 'Days Supply, Quantity, and Refills',
    html: '<p>This is where you set the <b>Days Supply</b>, <b>Quantity</b>, and <b>Refills</b> for the order.</p>'
        + '<p>With PRN unchecked, <b>Quantity</b> here auto-calculates from Days Supply and the selected schedule (e.g. BID x 90 days = 180 tablets). Try checking and unchecking PRN now and watch this Quantity box change.</p>'
  },
  {
    before: function(){ _medsOrderTourOpenDialog(); },
    target: function(){ return document.getElementById('co-ind-comments-row'); },
    title: 'Indication and Comments',
    html: '<p><b>Indication</b> documents why the medication is being ordered — pick the closest match. You can use Comments for more specific details.</p>'
  },
  {
    before: function(){ _medsOrderTourOpenDialog(); },
    target: function(){ return document.getElementById('co-pickup-group'); },
    title: 'Pick Up',
    html: '<p><b>Pick Up</b> matters operationally: <b>Mail</b> ships automatically to the patient\'s listed mailing address; <b>At Window</b> means the patient collects it in person; <b>Park</b> means nothing gets filled or mailed at all until the patient actively requests it (a phone call, an in-person visit, or a MyHealtheVet refill request).</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Wrap-Up',
    html: '<p>Click <b>Finish</b> to close. The <b>▾</b> picker next to <b>? Tour</b> brings you straight back here any time.</p>'
  }
];

/* ---------------------------------------------------------
   MEDS TAB: EXPIRATION & RENEWING A MEDICATION
   Standalone sub-tutorial covering Expires/Status/Last Filled
   and the Renew... workflow, using the same Acetaminophen entry
   -- deliberately dated so it's close to expiring despite still
   having refills left, to teach that expiration trumps refills.
   --------------------------------------------------------- */
var MEDS_RENEW_TOUR_STEPS = [
  {
    center: true,
    tab: 'meds',
    before: function(){ closeTeachingPopups(); },
    title: 'Expiration & Renewing a Medication',
    html: '<p>Outpatient prescriptions expire <b>one calendar year</b> from when they were originally ordered — not from when they were last filled, and not when refills run out. This tour uses the same <b>Acetaminophen</b> entry, deliberately set up so it\'s close to expiring even though it still has refills remaining.</p>'
  },
  {
    tab: 'meds',
    before: function(){ closeTeachingPopups(); _goMedsTab(); },
    target: function(){ return _findMedsRow('meds-home-tbl','ACETAMINOPHEN'); },
    secondaryTarget: function(){ return _findMedsHeaderRow('meds-home-tbl'); },
    title: 'Expires, Status, Last Filled, Refills Remaining',
    html: '<p>Four columns matter together, not in isolation: <b>Expires</b>, <b>Status</b>, <b>Last Filled</b>, and <b>Refills Remaining</b>.</p>'
        + '<p>Look at <b>ACETAMINOPHEN 500MG TAB</b> — notice its <b>Last Filled</b> date looks fairly recent, and it still shows refills remaining, but its <b>Expires</b> date is coming up soon regardless. Refills don\'t reset or extend the expiration date; only a new order does.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); _goMedsTab(); },
    target: function(){ return _findMedsRow('meds-home-tbl','ACETAMINOPHEN'); },
    title: 'Read the Whole Order',
    html: '<p>Before renewing anything, read the full order line, not just the drug name — the strength on the label (e.g. 500MG tablets) doesn\'t always match the instructions (e.g. "take 1-2 tablets"). The <b>Quantity</b> dispensed should stay consistent with what the sig actually asks the patient to take.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); _goMedsTab(); if(typeof openRenewOrders==='function'){ var row=_findMedsRow('meds-home-tbl','ACETAMINOPHEN'); var idx=row?Array.prototype.indexOf.call(document.querySelectorAll('#meds-home-tbl tbody tr'), row):-1; if(idx>-1) openRenewOrders('outpt', idx); } },
    target: function(){ return document.getElementById('renew-orders-dlg'); },
    title: 'Renew...',
    html: '<p>Right-click the medication and choose <b>Renew...</b>. This summarizes the current order — drug, sig, quantity, and refills — and lets you carry it forward before it actually lapses.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); _goMedsTab(); if(typeof openRenewOrders==='function'){ var row=_findMedsRow('meds-home-tbl','ACETAMINOPHEN'); var idx=row?Array.prototype.indexOf.call(document.querySelectorAll('#meds-home-tbl tbody tr'), row):-1; if(idx>-1){ openRenewOrders('outpt', idx); if(typeof openChangeRefills==='function') openChangeRefills(); } } },
    target: function(){ return document.getElementById('change-refills-dlg'); },
    title: 'Change Days Supply/Quantity/Refills/Pick Up...',
    html: '<p>Clicking the <b>Change Days Supply/Quantity/Refills/Pick Up...</b> button in the bottom-left of the Renew Orders popup opens this second dialog.</p>'
        + '<p>From here you can adjust the <b>Days Supply</b>, <b>Quantity</b>, <b>Refills</b>, and <b>Pick Up</b> method before finalizing the renewal — the same three Pick Up options as ordering a new medication (Mail / At Window / Park).</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Habit to Build',
    html: '<p>Part of reviewing any medication list is checking that nothing is about to lapse — a med with plenty of refills left can still expire, and a patient who thinks they\'re covered can show up to an empty pharmacy queue. Make Expires a routine check, not just Refills Remaining.</p>'
        + '<p>Click <b>Finish</b> to close. The <b>▾</b> picker next to <b>? Tour</b> brings you straight back here any time.</p>'
  }
];

/* ---------------------------------------------------------
   DISCHARGE MEDS TOUR STEPS
   Standalone sub-tutorial covering ordering outpatient meds at
   discharge -- transferring an Inpatient Medication to an
   outpatient prescription via Action > Transfer to Outpatient,
   plus reconciling existing outpatient meds the same way.
   --------------------------------------------------------- */
var DISCHARGE_MEDS_TOUR_STEPS = [
  {
    center: true,
    tab: 'meds',
    before: function(){ closeTeachingPopups(); },
    title: 'Ordering Outpatient Meds at Discharge',
    html: '<p>This module walks through turning an active <b>Inpatient Medication</b> into an outpatient prescription for discharge, and reconciling the patient\'s existing outpatient meds at the same time.</p>'
  },
  {
    // Expand the Inpatient Medications section so Carvedilol (and enough
    // surrounding rows for context) is actually visible, rather than
    // whatever height a previous drag of the resizer bar left it at.
    before: function(){ closeTeachingPopups(); _goMedsTab(); var sec=document.getElementById('meds-inpt-sec'); if(sec) sec.style.height='420px'; },
    target: function(){ return _findMedsRow('meds-inpt-tbl','CARVEDILOL'); },
    // The Inpatient Medications table spans nearly the full window width,
    // so the engine's default "beside/below the target" card placement has
    // nowhere to go without covering the very row being described -- pin
    // the card to a fixed spot low and to the right, clear of the table's
    // name column, same fix used for other wide-row targets elsewhere.
    cardTop: 460, cardLeft: 640,
    title: 'Select the Medication',
    html: '<p>Under <b>Inpatient Medications</b>, click the row for the medication you want the patient to go home on — here, <b>Carvedilol</b>.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); _goMedsTab(); var row=_findMedsRow('meds-inpt-tbl','CARVEDILOL'); if(row) selectMedsRow(row,'inpt',Array.prototype.indexOf.call(document.querySelectorAll('#meds-inpt-tbl tbody tr'), row)); },
    target: function(){ return document.getElementById('menu-action'); },
    title: 'Open the Action Menu',
    html: '<p>With the row selected, open <b>Action</b> in the top menu bar.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); _goMedsTab(); var row=_findMedsRow('meds-inpt-tbl','CARVEDILOL'); if(row) selectMedsRow(row,'inpt',Array.prototype.indexOf.call(document.querySelectorAll('#meds-inpt-tbl tbody tr'), row)); buildActionMenu(); toggleMenu('action'); },
    target: function(){ return document.getElementById('dd-action'); },
    title: 'Transfer to Outpatient...',
    html: '<p>Click <b>Transfer to Outpatient...</b>.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); _goMedsTab(); var row=_findMedsRow('meds-inpt-tbl','CARVEDILOL'); var idx=row?Array.prototype.indexOf.call(document.querySelectorAll('#meds-inpt-tbl tbody tr'), row):-1; if(idx>-1) openTransferToOutpatient(idx); },
    target: function(){ return document.getElementById('change-order-dlg'); },
    title: 'The Outpatient Medications Dialog',
    html: '<p>This is the same Outpatient Medications order-entry dialog used when ordering a new medication or clicking <b>Change...</b> on an outpatient med. Set the <b>Dosage</b>, <b>Route</b>, <b>Schedule</b>, and <b>Days Supply/Quantity/Refills/Pick Up</b>, then click <b>Accept Order</b>.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); _goMedsTab(); },
    title: 'It\'s Now an Outpatient Medication',
    html: '<p>Once signed, the medication moves to the <b>Outpatient Medications</b> section — it\'s what the patient actually leaves with. The original Inpatient Medications row is untouched, since that reflects what was given during the stay.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Reconciling Existing Outpatient Meds',
    html: '<p>The same Action menu works on rows already in <b>Outpatient Medications</b> — use <b>Change...</b> if a dose changed during the stay, or <b>Renew...</b> if refills are running low, so discharge reflects what the patient should actually be taking, not just what they were on before admission.</p>'
        + '<p>Click <b>Finish</b> to close. The <b>▾</b> picker next to <b>? Tour</b> brings you straight back here any time.</p>'
  }
];

/* ---------------------------------------------------------
   CHART TOUR STEPS
   Walks through the chart once a patient is open.
   --------------------------------------------------------- */
var CHART_TOUR_STEPS = [
  {
    center: true,
    title: 'Chart Orientation Tour',
    html: '<p>This tour walks you through the main sections of a CPRS patient chart — the same layout you\'ll use on every rotation at a VA.</p>'
        + '<p>Use <b>Next</b> to step through each section, or <b>Skip tour</b> to close it.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); },
    target: function(){ return document.getElementById('tour-btn'); },
    title: 'Replaying This Tour',
    html: '<p>The <b>? Tour</b> button always replays this orientation tour for whatever screen you\'re on — the Patient Selection dialog or an open chart.</p>'
  },
  {
    before: function(){ closeAllMenus(); openTourPicker(); },
    target: function(){ return document.getElementById('tour-btn'); },
    highlightTarget: function(){ return document.getElementById('tour-menu-btn'); },
    secondaryTarget: function(){ return document.getElementById('tour-picker-dlg'); },
    title: 'Focused Sub-Tutorials',
    html: '<p>The <b>&#9662;</b> dropdown next to it opens a picker with focused sub-tutorials you can jump to directly — deeper dives into specific tabs and tools, instead of sitting through the whole orientation again.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); },
    target: function(){ return document.getElementById('pthdr'); },
    title: 'Patient Header',
    html: '<p>This bar is always visible and shows the current patient\'s name, MRN, date of birth, age, ward, attending provider, and visit info.</p>'
        + '<p>The <b>Postings</b> button on the right opens a summary of allergies, advance directives, and LST (Life-Sustaining Treatment) notes.</p>'
  },
  {
    target: function(){ return document.getElementById('tabbar'); },
    title: 'Chart Tabs',
    html: '<p>All CPRS navigation happens through these tabs. Each tab is a different section of the patient chart.</p>'
  }
].concat(PERSONAL_LIST_TOUR_STEPS, [
  {
    tab: 'cover',
    before: function(){ closeTeachingPopups(); },
    target: function(){ return document.getElementById('tab-cover'); },
    title: 'Cover Sheet',
    html: '<p>The Cover Sheet is a quick-glance summary of the patient\'s current status — active problems, medications, allergies, and recent vitals all on one screen.</p>'
        + '<p>Most experienced clinicians start here to get oriented before diving into individual tabs.</p>'
  },
  {
    tab: 'notes',
    target: function(){ return document.getElementById('tab-notes'); },
    title: 'Notes Tab',
    html: '<p>The Notes tab contains all clinical documentation — admission H&Ps, daily progress notes, procedure notes, and nursing notes.</p>'
        + '<p>The left column lists all notes by date, title, author, and location. Click any note to open the full text in the right pane.</p>'
  },
  {
    tab: 'labs',
    target: function(){ return document.getElementById('tab-labs'); },
    title: 'Labs Tab',
    html: '<p>Lab results are organized into several views using the left panel. <b>Most Recent</b> (the default) shows the latest collection for each panel.</p>'
        + '<p><b>Lab Overview</b> lists every individual specimen collected in the date range, one row per test per collection — useful for confirming exactly what was drawn and when.</p>'
        + '<p><b>Worksheet</b> lets you select specific tests and build a custom trending table with dates as rows and tests as columns.</p>'
  },
  {
    tab: 'orders',
    target: function(){ return document.getElementById('tab-orders'); },
    title: 'Orders Tab',
    html: '<p>All active and recently completed orders are listed here, grouped by type in the left column (e.g. Inpatient Medications, Lab, Imaging).</p>'
        + '<p><b>Right-click</b> any order row to see available actions, including viewing the full order details.</p>'
  },
  {
    tab: 'reports',
    target: function(){ return document.getElementById('tab-reports'); },
    title: 'Reports Tab',
    html: '<p>The Reports tab contains many structured report views not found in Notes — for example, imaging reads, pharmacy profiles, and procedure reports.</p>'
  },
  {
    center: true,
    title: 'Suggested Pre-Rounding Workflow',
    html: '<p>A practical order to move through the chart before rounds:</p>'
        + '<ol class="tour-workflow-list">'
        + '<li><b>Patient header</b> — confirm you have the right patient; check Postings for allergies, advance directives, and life-sustaining treatment (LST) notes.</li>'
        + '<li><b>Cover Sheet</b> — get oriented: active problems, recent vitals, medication list at a glance.</li>'
        + '<li><b>Notes</b> — read the most recent progress note to know yesterday\'s plan before forming today\'s.</li>'
        + '<li><b>Labs</b> — trend the relevant panels; note any new abnormalities since the last note.</li>'
        + '<li><b>Orders</b> — confirm what\'s active, what\'s held, and what\'s still pending.</li>'
        + '<li><b>Reports</b> — check for any new imaging reads or procedure results.</li>'
        + '</ol>'
        + '<p>Click <b>Finish</b> to close the tour. The <b>? Tour</b> button replays it any time.</p>'
  },
  {
    center: true,
    before: function(){ closeTeachingPopups(); },
    title: 'Go Explore',
    html: '<p>That\'s the guided part — from here, feel free to just click around the chart on your own. Try opening notes, right-clicking orders, poking at the header buttons, whatever looks interesting.</p>'
        + '<p>If you want a deeper dive into any one area later, the <b>&#9662;</b> picker next to <b>? Tour</b> has focused sub-tutorials you can jump back into any time.</p>'
  }
]);

/* ---------------------------------------------------------
   ENGINE
   --------------------------------------------------------- */
function activateTourSteps(steps, moduleId){
  _tourSteps = steps;
  _activeModuleId = moduleId || 'main';
  _tourActive = true;
  document.getElementById('tour-clickblock').style.display = 'block';
  document.getElementById('tour-spotlight').style.display = 'block';
  showTourStep(0);
}

function startTour(){
  var dlg = document.getElementById('pt-dlg');
  var dlgVisible = dlg && dlg.classList.contains('show');
  var steps;

  if(dlgVisible){
    steps = DIALOG_TOUR_STEPS;
  } else if(currentPt){
    steps = CHART_TOUR_STEPS;
  } else {
    // no patient and dialog is closed — re-open dialog
    openPtDialog();
    steps = DIALOG_TOUR_STEPS;
  }
  activateTourSteps(steps, 'main');
}

// Standalone "just this part" module reachable from the ▾ picker —
// the same PERSONAL_LIST_TOUR_STEPS block that's spliced into the
// main chart tour, run on its own so returning users can skip
// straight to it without the full orientation tour.
// Real CPRS only lets you build a personal list from inside a chart
// (Tools menu isn't reachable from the bare Patient Selection screen)
// — if no chart is open yet, load one first so the module's popups
// don't end up fighting with the still-open Patient Selection dialog.
// Shared guard for any chart-scoped sub-tutorial: real CPRS can't do
// these workflows from the bare Patient Selection screen, so if no
// chart is open yet, close that dialog and load a default patient
// first — and suppress the main chart tour's own auto-trigger so it
// doesn't fire on top of the module the user actually asked for.
function ensureChartOpenForTour(){
  if(currentPt) return;
  if(typeof closePtDialog==='function') closePtDialog();
  _tourContinue   = false;
  _chartTourShown = true;
  loadPatient('kowalski');
}

// Same guard, but defaults to the outpatient case (Torres) rather than
// Kowalski — used by modules that teach outpatient-only workflows (order
// entry, encounter coding, clinical reminders) where an inpatient chart
// wouldn't make sense as the backdrop.
function ensureOutpatientChartOpenForTour(){
  if(currentPt) return;
  if(typeof closePtDialog==='function') closePtDialog();
  _tourContinue   = false;
  _chartTourShown = true;
  loadPatient('torres');
}

// Notifications is the one module that lives in the Patient Selection
// dialog rather than inside a chart — the opposite guard from
// ensureChartOpenForTour(): just make sure the dialog itself is open,
// leaving whatever chart (if any) is open behind it alone.
function ensureDialogOpenForTour(){
  var dlg = document.getElementById('pt-dlg');
  if(!dlg || !dlg.classList.contains('show')){
    if(typeof openPtDialog==='function') openPtDialog();
  }
}
function startNotificationsModule(){
  ensureDialogOpenForTour();
  activateTourSteps(NOTIFICATIONS_TOUR_STEPS, 'notifications');
}

function startPersonalListModule(){
  ensureChartOpenForTour();
  activateTourSteps(PERSONAL_LIST_TOUR_STEPS, 'personal-list');
}

function startMarModule(){
  ensureChartOpenForTour();
  activateTourSteps(MAR_TOUR_STEPS, 'mar');
}

function startOrderMenusNavModule(){
  ensureChartOpenForTour();
  activateTourSteps(ORDER_MENUS_NAV_TOUR_STEPS, 'order-menus-nav');
}

function startLabOrderModule(){
  ensureChartOpenForTour();
  activateTourSteps(LAB_ORDER_TOUR_STEPS, 'lab-order');
}

function startHeaderModule(){
  ensureChartOpenForTour();
  activateTourSteps(HEADER_TOUR_STEPS, 'header');
}

function startImagingModule(){
  ensureChartOpenForTour();
  activateTourSteps(IMAGING_TOUR_STEPS, 'imaging');
}

function startNotesToolsModule(){
  ensureChartOpenForTour();
  activateTourSteps(NOTES_TOOLS_TOUR_STEPS, 'notes-tools');
}

function startLabsViewsModule(){
  ensureChartOpenForTour();
  activateTourSteps(LABS_VIEWS_TOUR_STEPS, 'labs-views');
}

function startReportsViewsModule(){
  ensureChartOpenForTour();
  activateTourSteps(REPORTS_VIEWS_TOUR_STEPS, 'reports-views');
}

function startPdmpModule(){
  ensureChartOpenForTour();
  activateTourSteps(PDMP_TOUR_STEPS, 'pdmp');
}

function startRemoteDataModule(){
  ensureChartOpenForTour();
  activateTourSteps(REMOTE_DATA_TOUR_STEPS, 'remote-data');
}

function startOrderEntryModule(){
  ensureOutpatientChartOpenForTour();
  activateTourSteps(ORDER_ENTRY_TOUR_STEPS, 'order-entry');
}

function startEncounterCodingModule(){
  ensureOutpatientChartOpenForTour();
  activateTourSteps(ENCOUNTER_CODING_TOUR_STEPS, 'encounter-coding');
}

function startClinicalRemindersModule(){
  ensureOutpatientChartOpenForTour();
  activateTourSteps(CLINICAL_REMINDERS_TOUR_STEPS, 'clinical-reminders');
}

function startCoverSheetModule(){
  ensureChartOpenForTour();
  activateTourSteps(COVER_SHEET_TOUR_STEPS, 'cover-sheet');
}

function startMedsOrderModule(){
  ensureChartOpenForTour();
  activateTourSteps(MEDS_ORDER_TOUR_STEPS, 'meds-order');
}

function startMedsRenewModule(){
  ensureChartOpenForTour();
  activateTourSteps(MEDS_RENEW_TOUR_STEPS, 'meds-renew');
}

// This module walks through a specific medication (Kowalski's Carvedilol),
// so like the Consults module it force-switches to Kowalski regardless of
// what's currently open, rather than only loading a default when no chart
// is open yet -- same _*TourOrigPt save/restore pattern used there, so a
// trainee who started this tour from a different patient's chart ends up
// back where they started instead of stuck on Kowalski.
var _dischargeMedsTourOrigPt = null;
function startDischargeMedsModule(){
  if(typeof closePtDialog==='function') closePtDialog();
  _tourContinue   = false;
  _chartTourShown = true;
  if(currentPt && currentPt!=='kowalski') _dischargeMedsTourOrigPt = currentPt;
  if(currentPt!=='kowalski') loadPatient('kowalski');
  activateTourSteps(DISCHARGE_MEDS_TOUR_STEPS, 'discharge-meds');
}

// Every step in CONSULTS_TOUR_STEPS targets specific consults that only
// exist on Kowalski's chart (the one patient with all 7 status codes
// represented) -- so unlike ensureChartOpenForTour(), this always forces
// Kowalski rather than only loading a default when no chart is open yet.
// Restored by endTour() once the module is left (Skip/Finish/X), so a
// trainee who launched this module from a different patient's chart ends
// up back where they started instead of stuck on Kowalski.
var _consultsTourOrigPt = null;
function startConsultsModule(){
  if(typeof closePtDialog==='function') closePtDialog();
  _tourContinue   = false;
  _chartTourShown = true;
  if(currentPt && currentPt!=='kowalski') _consultsTourOrigPt = currentPt;
  if(currentPt!=='kowalski') loadPatient('kowalski');
  activateTourSteps(CONSULTS_TOUR_STEPS, 'consults');
}

function endTour(){
  _tourActive = false;
  document.getElementById('tour-clickblock').style.display = 'none';
  document.getElementById('tour-dim').style.display = 'none';
  document.getElementById('tour-spotlight').style.display = 'none';
  document.getElementById('tour-spotlight-2').style.display = 'none';
  document.getElementById('tour-card').style.display = 'none';
  closeTeachingPopups();
  if(_activeModuleId==='consults' && _consultsTourOrigPt){
    loadPatient(_consultsTourOrigPt);
    _consultsTourOrigPt = null;
  }
  if(_activeModuleId==='discharge-meds' && _dischargeMedsTourOrigPt){
    loadPatient(_dischargeMedsTourOrigPt);
    _dischargeMedsTourOrigPt = null;
  }
  // Sub-tutorials return to the picker on Skip/Finish; the main tour just closes.
  if(_activeModuleId !== 'main') openTourPicker();
}

// Set by the Header Deep-Dive Flag step when it has to switch to a
// patient who actually has flags on file — restored by the next step's
// closeTeachingPopups() call (or by endTour(), which also calls it).
var _flagTourOrigPt=null;
// Closes any popups opened mid-tour (Options / Personal Lists / New List /
// Save Settings confirm / Patient Selection) so leftover dialogs never
// obscure a later step or linger after the tour ends.
function closeTeachingPopups(){
  if(_flagTourOrigPt){ loadPatient(_flagTourOrigPt); _flagTourOrigPt=null; }
  if(typeof closeAllMenus==='function') closeAllMenus();
  if(typeof closeWin==='function'){
    closeWin('options-dlg');
    closeWin('personal-lists-dlg');
    closeWin('new-list-dlg');
    closeWin('save-default-confirm-dlg');
    closeWin('order-details-dlg');
    closeWin('patient-inquiry-dlg');
    closeWin('pact-dlg');
    closeWin('jlv-dlg');
    if(typeof closeRemoteDataPanel==='function') closeRemoteDataPanel();
    closeWin('vista-imaging-dlg');
    closeWin('encounter-dlg');
    closeWin('postings-dlg');
    var tplAcc=document.getElementById('tpl-accordion'); if(tplAcc) tplAcc.style.display='none';
    var tplBtn=document.getElementById('tpl-toggle-btn'); if(tplBtn) tplBtn.innerHTML='&#9656; Templates';
    closeWin('custom-view-dlg');
    closeWin('new-note-dlg');
    closeWin('select-labs-dlg');
    closeWin('pdmp-results-dlg');
    closeWin('patient-flags-dlg');
    closeWin('cons-edit-resubmit-dlg');
    closeWin('order-menu-dlg');
    closeWin('inpt-meds-formulary-dlg');
    closeWin('lab-order-dlg');
    var _loCt=document.getElementById('lo-coll-type'); if(_loCt) _loCt.size=1;
    closeWin('new-order-dlg');
    closeWin('order-signed-dlg');
    closeWin('encounter-coded-dlg');
    closeWin('reminders-dlg');
    closeWin('forward-alert-dlg');
    closeWin('tour-picker-dlg');
    closeWin('renew-orders-dlg');
    closeWin('change-refills-dlg');
    closeWin('change-order-dlg');
    closeWin('meds-sim-notice-dlg');
    if(typeof closeMedsCtxMenu==='function') closeMedsCtxMenu();
  }
  if(typeof closePtDialog==='function' && currentPt) closePtDialog();
}

function closeTourEntirely(){
  _activeModuleId = 'main';
  endTour();
  closeTourPicker();
}

function openTourPicker(){
  var list = document.getElementById('tpk-list');
  list.innerHTML = '';
  var lastGroup = null;
  TOUR_MODULES.forEach(function(mod){
    if(mod.group && mod.group !== lastGroup){
      var hdr = document.createElement('div');
      hdr.className = 'tpk-group-hdr';
      hdr.textContent = mod.group;
      list.appendChild(hdr);
      lastGroup = mod.group;
    }
    var item = document.createElement('div');
    item.className = 'ol-item';
    item.textContent = mod.label;
    item.onclick = function(){ closeTourPicker(); mod.run(); };
    list.appendChild(item);
  });
  showFloatWin('tour-picker-dlg');
  var dlg = document.getElementById('tour-picker-dlg');
  dlg.style.left = Math.max(0, Math.round((window.innerWidth  - dlg.offsetWidth)  / 2)) + 'px';
  dlg.style.top  = Math.max(0, Math.round((window.innerHeight - dlg.offsetHeight) / 2)) + 'px';
  document.removeEventListener('click', _tourPickerOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _tourPickerOutsideClick); }, 0);
}

function _tourPickerOutsideClick(e){
  if(_tourActive) return;
  var dlg = document.getElementById('tour-picker-dlg');
  if(dlg && !dlg.contains(e.target) && e.target.id !== 'tour-menu-btn') closeTourPicker();
}

function closeTourPicker(){
  closeWin('tour-picker-dlg');
  document.removeEventListener('click', _tourPickerOutsideClick);
}

function showTourStep(idx){
  if(idx < 0) idx = 0;
  if(idx >= _tourSteps.length){
    // If the dialog tour just finished naturally, queue the chart tour for when a patient loads
    if(_tourSteps === DIALOG_TOUR_STEPS) _tourContinue = true;
    endTour();
    return;
  }
  _tourIndex = idx;
  var step = _tourSteps[idx];

  // goTab() fully re-renders the target tab even if it's already active,
  // which (for tabs like Meds that scroll internally) resets scroll
  // position back to 0 on every single step -- only switch tabs when
  // actually changing tabs.
  if(step.tab && step.tab!==currentTab){ goTab(step.tab); }
  if(step.before){ step.before(); }

  if(step.center){
    document.getElementById('tour-dim').style.display = 'none';
    document.getElementById('tour-spotlight').style.display = 'none';
    document.getElementById('tour-spotlight-2').style.display = 'none';
    renderTourCard(step, null);
  } else {
    requestAnimationFrame(function(){
      var el = step.target ? step.target() : null;
      if(!el){ showTourStep(idx + 1); return; }
      var highlightEl = step.highlightTarget ? step.highlightTarget() : el;
      var secondaryEl = step.secondaryTarget ? step.secondaryTarget() : null;
      el.scrollIntoView({block:'nearest', behavior:'smooth'});
      setTimeout(function(){
        document.getElementById('tour-spotlight').style.display = 'block';
        var r1 = positionSpotlight('tour-spotlight', highlightEl || el);
        var sp2 = document.getElementById('tour-spotlight-2');
        var rects = [r1];
        if(secondaryEl){ sp2.style.display = 'block'; rects.push(positionSpotlight('tour-spotlight-2', secondaryEl)); }
        else { sp2.style.display = 'none'; }
        _updateTourDim(rects);
        renderTourCard(step, el);
      }, 180);
    });
  }
}

// Shared rect math for both the ring outline (#tour-spotlight/-2) and the
// dim layer's clip-path hole for the same element -- keeps the two in sync.
function _spotlightRect(el){
  var r = el.getBoundingClientRect();
  var pad = 5;
  return {x: r.left - pad, y: r.top - pad, w: r.width + pad*2, h: r.height + pad*2};
}
// Cuts one hole per rect out of #tour-dim using an evenodd clip-path (outer
// full-viewport rect + one sub-path per hole) so any number of simultaneous
// targets can be genuinely bright at once, not just outlined.
function _updateTourDim(rects){
  var dim = document.getElementById('tour-dim');
  if(!rects || !rects.length){ dim.style.display = 'none'; return; }
  dim.style.display = 'block';
  var vw = window.innerWidth, vh = window.innerHeight;
  var path = 'M0,0H'+vw+'V'+vh+'H0Z';
  rects.forEach(function(r){
    var x = Math.max(0, r.x), y = Math.max(0, r.y);
    path += ' M'+x+','+y+'H'+(x+r.w)+'V'+(y+r.h)+'H'+x+'Z';
  });
  var cp = "path(evenodd, '"+path+"')";
  dim.style.clipPath = cp;
  dim.style.webkitClipPath = cp;
}
function positionSpotlight(spotlightId, el){
  var rect = _spotlightRect(el);
  var sp   = document.getElementById(spotlightId);
  sp.style.left   = rect.x + 'px';
  sp.style.top    = rect.y + 'px';
  sp.style.width  = rect.w + 'px';
  sp.style.height = rect.h + 'px';
  return rect;
}

function renderTourCard(step, anchorEl){
  var card    = document.getElementById('tour-card');
  var total   = _tourSteps.length;
  card.className = 'tour-card' + (step.center ? ' tour-card-center' : '');
  card.style.display = 'block';

  var backBtn   = _tourIndex > 0 ? '<button class="tour-back" id="tBtn-back">Back</button>' : '';
  var nextLabel = _tourIndex === total - 1 ? 'Finish' : 'Next';

  card.innerHTML =
    '<button class="tour-close-x" id="tBtn-close" title="Close tutorial">&times;</button>'
  + '<div class="tour-progress">Step ' + (_tourIndex + 1) + ' of ' + total + '</div>'
  + '<div class="tour-title">' + step.title + '</div>'
  + '<div class="tour-body">' + step.html + '</div>'
  + '<div class="tour-footer">'
  +   '<button class="tour-skip" id="tBtn-skip">Skip tour</button>'
  +   '<div class="tour-actions">'
  +     backBtn
  +     '<button class="tour-next" id="tBtn-next">' + nextLabel + '</button>'
  +   '</div>'
  + '</div>';

  document.getElementById('tBtn-close').onclick = closeTourEntirely;
  document.getElementById('tBtn-skip').onclick = endTour;
  document.getElementById('tBtn-next').onclick = function(){ showTourStep(_tourIndex + 1); };
  var back = document.getElementById('tBtn-back');
  if(back) back.onclick = function(){ showTourStep(_tourIndex - 1); };

  if(step.center){
    card.style.left      = '50%';
    card.style.top       = '50%';
    card.style.transform = 'translate(-50%, -50%)';
  } else {
    card.style.transform = 'none';
    var r      = anchorEl.getBoundingClientRect();
    var cardW  = 290;
    var left   = r.right + 14;
    var top    = r.top;
    if(left + cardW > window.innerWidth - 10){
      left = Math.max(10, r.left);
      top  = r.bottom + 12;
    }
    if(step.cardOffset){ left += step.cardOffset.dx||0; top += step.cardOffset.dy||0; }
    // Absolute override -- bypasses the anchor-relative math above entirely,
    // for steps whose target is too wide/tall for "beside/below it" to ever
    // land somewhere sensible (e.g. a full-width table or button row).
    if(step.cardLeft !== undefined) left = step.cardLeft;
    if(step.cardTop  !== undefined) top  = step.cardTop;
    card.style.left = left + 'px';
    card.style.top  = top  + 'px';
    requestAnimationFrame(function(){
      var cardH = card.offsetHeight;
      var maxBottom = window.innerHeight - 10;
      var tabbarEl  = document.getElementById('tabbar');
      if(tabbarEl && tabbarEl.offsetParent !== null){
        var tr = tabbarEl.getBoundingClientRect();
        if(tr.top < maxBottom) maxBottom = tr.top - 10;
      }
      if(top  + cardH > maxBottom) top  = Math.max(10, maxBottom - cardH);
      if(left + cardW > window.innerWidth  - 10) left = Math.max(10, window.innerWidth  - cardW - 10);
      card.style.top  = top  + 'px';
      card.style.left = left + 'px';
    });
  }
}

window.addEventListener('resize', function(){
  if(!_tourActive) return;
  var step = _tourSteps[_tourIndex];
  if(!step.center && step.target){
    var el = step.target();
    if(el){
      var highlightEl = step.highlightTarget ? step.highlightTarget() : el;
      var secondaryEl = step.secondaryTarget ? step.secondaryTarget() : null;
      var rects = [positionSpotlight('tour-spotlight', highlightEl || el)];
      if(secondaryEl) rects.push(positionSpotlight('tour-spotlight-2', secondaryEl));
      _updateTourDim(rects);
      renderTourCard(step, el);
    }
  }
});

// Called from the init script after openPtDialog() on page load
function tourOnPageLoad(){
  if(!_tourFirstLoad) return;
  _tourFirstLoad = false;
  setTimeout(startTour, 400);
}

// Called from core.js loadPatient() each time a patient is opened
function tourOnPatientLoad(){
  var shouldStart = _tourContinue || !_chartTourShown;
  _tourContinue   = false;
  _chartTourShown = true;
  if(!shouldStart) return;
  setTimeout(function(){
    activateTourSteps(CHART_TOUR_STEPS, 'main');
  }, 500);
}
