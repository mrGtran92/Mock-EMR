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
var TOUR_MODULES = [
  {id:'main', label:'Guided Orientation Tour (Patient Selection or Chart)', run:function(){ startTour(); }},
  {id:'personal-list', label:'Building a Personal Patient List', run:function(){ startPersonalListModule(); }},
  {id:'mar', label:'Reviewing the MAR (Medication Administration Record)', run:function(){ startMarModule(); }},
  {id:'header', label:'Patient Header Deep-Dive', run:function(){ startHeaderModule(); }},
  {id:'imaging', label:'VistA Imaging Display (EKGs & Advance Directives)', run:function(){ startImagingModule(); }},
  {id:'notes-tools', label:'Notes Tab Tools (Templates, Encounter, New Note)', run:function(){ startNotesToolsModule(); }},
  {id:'labs-views', label:'Labs Views (Most Recent, Overview, Worksheet)', run:function(){ startLabsViewsModule(); }},
  {id:'reports-views', label:'Reports Views (Imaging, Procedures, Pharmacy)', run:function(){ startReportsViewsModule(); }},
  {id:'pdmp', label:'PDMP Query & Results', run:function(){ startPdmpModule(); }},
  {id:'remote-data', label:'Remote Data (Other VA Facilities)', run:function(){ startRemoteDataModule(); }},
];

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
    html: '<p>Click the <b>PACT line</b> (outlined in orange — "No PACT assigned..." / focus text) to see a patient\'s <b>Primary Care Provider</b> and the rest of their care team — Care Manager, Pharmacist, Social Worker, and clinic contact info.</p>'
  },
  {
    before: function(){ closeTeachingPopups(); openPostings(); },
    target: function(){ return document.getElementById('postings-dlg'); },
    secondaryTarget: function(){ return document.getElementById('hbtn-postings'); },
    title: 'Postings',
    html: '<p><b>Postings</b> (button outlined in orange) is where allergies and any Advance Directive / Life-Sustaining Treatment (LST) notes on file get flagged — worth checking on every new patient.</p>'
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
    html: '<p>The Cover Sheet is a quick-glance summary of the patient\'s current status — active problems, medications, allergies, recent vitals, and recent lab results all on one screen.</p>'
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
        + '<p>Abnormal values are indicated by H or L in the Flag column — the value itself is always displayed in plain black text.</p>'
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
        + '<p>Expand the accordion menus on the left to navigate. <b>Procedures (local only)</b> is where procedure reports for things such as endoscopies or echocardiograms live.</p>'
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

function startPersonalListModule(){
  ensureChartOpenForTour();
  activateTourSteps(PERSONAL_LIST_TOUR_STEPS, 'personal-list');
}

function startMarModule(){
  ensureChartOpenForTour();
  activateTourSteps(MAR_TOUR_STEPS, 'mar');
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

function endTour(){
  _tourActive = false;
  document.getElementById('tour-clickblock').style.display = 'none';
  document.getElementById('tour-spotlight').style.display = 'none';
  document.getElementById('tour-spotlight-2').style.display = 'none';
  document.getElementById('tour-card').style.display = 'none';
  closeTeachingPopups();
  // Sub-tutorials return to the picker on Skip/Finish; the main tour just closes.
  if(_activeModuleId !== 'main') openTourPicker();
}

// Closes any popups opened mid-tour (Options / Personal Lists / New List /
// Save Settings confirm / Patient Selection) so leftover dialogs never
// obscure a later step or linger after the tour ends.
function closeTeachingPopups(){
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
    closeWin('tour-picker-dlg');
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
  TOUR_MODULES.forEach(function(mod){
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

  if(step.tab){ goTab(step.tab); }
  if(step.before){ step.before(); }

  if(step.center){
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
        positionSpotlight('tour-spotlight', highlightEl || el);
        var sp2 = document.getElementById('tour-spotlight-2');
        if(secondaryEl){ sp2.style.display = 'block'; positionSpotlight('tour-spotlight-2', secondaryEl); }
        else { sp2.style.display = 'none'; }
        renderTourCard(step, el);
      }, 180);
    });
  }
}

function positionSpotlight(spotlightId, el){
  var r   = el.getBoundingClientRect();
  var pad = 5;
  var sp  = document.getElementById(spotlightId);
  sp.style.left   = (r.left   - pad) + 'px';
  sp.style.top    = (r.top    - pad) + 'px';
  sp.style.width  = (r.width  + pad * 2) + 'px';
  sp.style.height = (r.height + pad * 2) + 'px';
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
      positionSpotlight('tour-spotlight', highlightEl || el);
      var secondaryEl = step.secondaryTarget ? step.secondaryTarget() : null;
      if(secondaryEl) positionSpotlight('tour-spotlight-2', secondaryEl);
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
