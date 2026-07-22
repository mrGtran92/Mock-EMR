var _ordersView = [];
// Real CPRS's order list view doesn't show the ordering indication/reason,
// or a [COMPLETED]/[PENDING]/etc. status tag, inline in the order-name
// column -- indication is only visible via right-click -> Details, and
// status belongs solely in the dedicated Status column. This strips both
// for the row display only; the full o.ord string (including both) is
// still used untouched by showOrderDetails() for the Details popup.
var _ORD_STATUS_TAG_RE=/\[(COMPLETED|PENDING|ACTIVE|DISCONTINUED|CANCELLED|DC)\]/;
// Real CPRS's Lab order lines show the test name followed by the specimen
// type/tube color and a lab accession number ("LB #123456") -- e.g.
// "BASIC METABOLIC PANEL BLOOD in MINT GREEN-PLAS PLASMA SP ONCE LB #896518".
// Rather than hand-author that full string per lab order in data.js, it's
// built here from the test name at render time (specimen/tube guessed from
// a keyword table, accession number deterministically generated so it's
// stable across reloads) -- same "generate it, don't hand-author it"
// convention already used for the MAR and Meds Change dosage ladders.
var _LAB_SPECIMEN_MAP=[
  {re:/BLOOD CULTURE/i, suffix:' BLOOD in AEROBIC/ANAEROBIC BOTTLES SP'},
  {re:/\bCBC\b|COMPLETE BLOOD COUNT/i, suffix:' BLOOD in LAVENDER-EDTA WHOLE BLD SP'},
  {re:/HEMOGLOBIN A1C|\bA1C\b/i, suffix:' BLOOD in LAVENDER-EDTA WHOLE BLD SP'},
  {re:/METABOLIC PANEL|LIPID PANEL|HEPATIC|COMPREHENSIVE/i, suffix:' BLOOD in MINT GREEN-PLAS PLASMA SP'},
  {re:/\bPT\b|\bINR\b|COAG/i, suffix:' BLOOD in LIGHT BLUE-CITRATE PLASMA SP'},
  {re:/TYPE\s*&\s*SCREEN|TYPE AND SCREEN|ANTIBODY SCREEN/i, suffix:' SP'},
  {re:/OCCULT BLOOD|\bFIT\b/i, suffix:' OC AUTO VIAL FECES SP'},
  {re:/^ABG\b|ARTERIAL BLOOD GAS/i, suffix:' BLOOD in GREEN-HEPARIN ARTERIAL SP'},
  {re:/GLUCOSE|FSBG/i, suffix:' BLOOD in GRAY-FLUORIDE SP'},
];
function _labSpecimenSuffix(name){
  for(var i=0;i<_LAB_SPECIMEN_MAP.length;i++){ if(_LAB_SPECIMEN_MAP[i].re.test(name)) return _LAB_SPECIMEN_MAP[i].suffix; }
  return ' BLOOD in GOLD-SST SERUM SP';
}
function _labAccession(seed){
  return String(100000+Math.floor(_marSeededRand(seed)()*900000));
}
function _labOrderDisplay(rawLine){
  var name=rawLine.replace(/\s*Collection:\s*\S+/i,'');
  // Most labs are one-time "Once" orders in real CPRS -- the frequency word
  // (Once/Daily/Q6H/etc.) isn't worth showing in the Order column at all,
  // so it's parsed out here just to cleanly trim it off the name, not to
  // display it.
  var fm=/\b(Q\d+H|DAILY|Once|QID|BID|TID)\b/i.exec(name);
  if(fm) name=name.slice(0,fm.index);
  name=name.replace(/\s{2,}/g,' ').trim();
  return name+_labSpecimenSuffix(name)+' LB #'+_labAccession(name);
}
// Lab and Life-Sustaining Treatment orders carry extra scheduling/narrative
// text in data.js (collection time, the LST confirmation clause) that real
// CPRS never shows in the Order column -- only in Details. This reformats/
// strips it at render time, scoped by svc so it never touches medication
// sig lines (which legitimately use words like DAILY/BID/Q6H as part of the
// dosing instructions a trainee needs to see).
function _ordListText(ord,svc){
  if(svc==='Life-Sustaining Treat'){
    return (ord.split('\n')[0]||'').replace(/^>>\s*/,'').replace(/\s*--.*$/,'').trim();
  }
  if(svc==='Lab'){
    return _labOrderDisplay(ord.split('\n')[0]||'');
  }
  return ord.split('\n').map(function(line){
    return line.replace(/\s*Indication:.*$/,'').replace(new RegExp('\\s*'+_ORD_STATUS_TAG_RE.source+'\\s*$'),'');
  }).filter(function(line){ return line.trim().length>0; }).join('\n');
}
// The order-name text is the only place today that carries the finer
// COMPLETED/PENDING/ACTIVE/DISCONTINUED distinction (o.stat is only ever
// "active" at the top level) -- pull it out for the Status column instead
// of dropping it, now that it's stripped from the name column above.
function _ordStatusText(o){
  var m=_ORD_STATUS_TAG_RE.exec(o.ord);
  if(m) return m[1].toLowerCase();
  return o.stat==='active' ? 'active' : 'pending';
}
// Provider is stored as "LASTNAME,First Middle MD" -- the Provider column
// should read "Lastname, First" (comma-space, credential suffix dropped),
// not just the last name before the first comma.
function _ordProviderText(prov){
  if(!prov) return '';
  var comma = prov.indexOf(',');
  if(comma===-1) return prov;
  var last = prov.slice(0,comma);
  var first = prov.slice(comma+1).replace(/\s+(MD|DO|RN|PA|NP|PharmD|LCSW)\.?\s*(\(.*\))?$/i,'').trim();
  return last+', '+first;
}
function buildInptMedOrders(pt){
  var start = (pt.orders[0] && pt.orders[0].start) || '';
  return pt.meds_inpt.map(function(m){
    var tag = m.stat==='DISCONTINUED' ? ' [DISCONTINUED]' : '';
    var ord = m.n+tag+'\n  '+m.sig+(m.ind?('\n  Indication: '+m.ind):'');
    return {svc:'Inpatient Medications', ord:ord, start:start, prov:pt.prov, stat:'active', loc:'1no', isMed:true, med:m};
  });
}
// Real CPRS's Orders tab sequences rows by Service in a fixed clinical
// priority order, not alphabetically -- this app only has some of these
// service categories represented in data.js today, but the ranking still
// needs every real-CPRS category listed so future services slot in
// correctly without needing this table touched again.
var _SVC_RANK_LIST=[
  'Life-Sustaining Treat','Life-Sustaining Treatment','A/D/T','Safety','Activity','Nursing',
  'Resp. Therapy','Diet','Infusion','Inpatient Medications','Medication','Lab','Radiology','Imaging',
  'Consult','Supplies',
];
function _svcRank(svc){
  var i=_SVC_RANK_LIST.indexOf(svc);
  return i===-1?999:i;
}
// Left-nav "View Orders" items that actually open something -- everything
// else in menuItems below renders greyed out (om-inert) via the same
// convention used for the popup menus' own inert leaf items. Add a label
// here the same day a menu item gets wired up, so this list never drifts
// out of sync with what's actually clickable.
var _OL_WIRED_LABELS=[
  'INPATIENT WARDS Order Menu','WLA Primary Care Order Menu',
  'Consults/Procedures Order Menu','Lab Test Quick Orders Menu',
  'Blood Bank Orders','Inpatient Medication Order Menu','Radiology/NucMed Order Menu',
  'WLA Outpatient Clinics Order Menu','Outpatient Meds/Supplies/IV Menu',
];
function renderOrders(pt){
  document.getElementById('left-pane').style.display='none';
  document.getElementById('right-pane').style.display='none';
  var mp=document.getElementById('main-panes');
  var outer=document.createElement('div'); outer.id='orders-outer';
  var left=document.createElement('div'); left.id='orders-left';
  var ll=document.createElement('div'); ll.id='orders-left-list';
  var menuItems=[
    {label:'Active Orders (incl. Pending & Recent Activity)',sel:true},
    {btn:'Write Delayed Orders'},
    {sep:'Write Orders'},{label:'Allergies'},
    {label:'Consults/Procedures Order Menu'},{sep:''},
    {label:'Lab Test Quick Orders Menu'},{label:'Blood Bank Orders'},{sep:''},
    {label:'Inpatient Medication Order Menu'},{label:'Outpatient Meds/Supplies/IV Menu'},
    {label:'Meds, Non-VA (Documentation)'},{sep:''},
    {label:'Radiology/NucMed Order Menu'},{sep:''},{label:'CODE STROKE Order Menu'},
    {sep:'*** INPATIENT UNITS ***'},{label:'INPATIENT WARDS Order Menu'},
    {label:'WLA CLC Order Menu'},{label:'SEP CLC Order Menu'},{label:'DOM Order Menu'},
    {sep:'*** OUTPATIENT CLINICS ***'},{label:'GLA PACT RN Order Menu'},
    {label:'AVC CBOC Order Menu'},{label:'BACC CBOC Order Menu'},{label:'ELA CBOC Order Menu'},
    {label:'LAACC CBOC Order Menu'},{label:'SACC CBOC Order Menu'},
    {label:'WLA Outpatient Clinics Order Menu'},{label:'WLA Primary Care Order Menu'},
    {sep:'*** EMERGENCY DEPARTMENT ***'},{label:'ED Order Menu'},{label:'ED RN Order Menu'},
    {sep:'*** OTHER ***'},{label:'F/U TICKLER (Reminder)'},{label:'GET WELL NETWORK'},
    {label:'Return To Clinic'},{label:'Non-VA Death Notification'},
  ];
  menuItems.forEach(function(item){
    var d=document.createElement('div');
    if(item.btn!==undefined){
      d.className='ol-btn-wrap';
      var inner=document.createElement('div'); inner.className='ol-btn'; inner.textContent=item.btn;
      d.appendChild(inner); ll.appendChild(d); return;
    }
    if(item.sep!==undefined){ d.className='ol-sep'; d.textContent=item.sep; }
    else { d.className='ol-item'+(item.sel?' sel':'')+(item.sel||_OL_WIRED_LABELS.indexOf(item.label)>-1?'':' om-inert'); d.textContent=item.label;
      d.onclick=function(){
        ll.querySelectorAll('.ol-item').forEach(function(x){x.classList.remove('sel');}); d.classList.add('sel');
        if(item.label==='INPATIENT WARDS Order Menu') openOrderMenu('INPATIENT WARDS Order Menu',inptWardsMenuCols);
        if(item.label==='WLA Primary Care Order Menu') openOrderMenu('WLA Primary Care Order Menu',primaryCareMenuCols);
        if(item.label==='Consults/Procedures Order Menu') openConsultsProcMenu();
        if(item.label==='Lab Test Quick Orders Menu') openOrderMenu('Lab Test Quick Orders Menu',labQuickOrdersMenuCols);
        if(item.label==='Blood Bank Orders') openBloodBankOrders();
        if(item.label==='Inpatient Medication Order Menu') openOrderMenu('Inpatient Medication Order Menu',inptMedOrderMenuCols);
        if(item.label==='Radiology/NucMed Order Menu') openOrderMenu('Radiology/NucMed Order Menu',radiologyMenuCols);
        if(item.label==='WLA Outpatient Clinics Order Menu') openOrderMenu('WLA Outpatient Clinics Order Menu',wlaOutpatientClinicsMenuCols);
        if(item.label==='Outpatient Meds/Supplies/IV Menu') openOrderMenu('Outpatient Meds/Supplies/IV Order Menu',outptMedsSuppliesMenuCols);
      }; }
    ll.appendChild(d);
  });
  left.appendChild(ll); outer.appendChild(left);
  var right=document.createElement('div'); right.id='orders-right';
  var hdrBar=document.createElement('div'); hdrBar.className='orders-hdr-bar';
  hdrBar.textContent='Active Orders (includes Pending & Recent Activity) - ALL SERVICES';
  right.appendChild(hdrBar);
  var tableWrap=document.createElement('div'); tableWrap.style.cssText='flex:1;overflow-y:auto;background:#fffff0';
  var html='<table class="orders-tbl" id="orders-tbl"><thead><tr>'
    +'<th style="width:115px">Service<span class="col-resize-handle"></span></th>'
    +'<th>Order<span class="col-resize-handle"></span></th>'
    +'<th style="width:120px">Start / Stop<span class="col-resize-handle"></span></th>'
    +'<th style="width:95px">Provider<span class="col-resize-handle"></span></th>'
    +'<th style="width:60px">Nurse<span class="col-resize-handle"></span></th>'
    +'<th style="width:60px">Clerk<span class="col-resize-handle"></span></th>'
    +'<th style="width:60px">Chart<span class="col-resize-handle"></span></th>'
    +'<th style="width:60px">Status<span class="col-resize-handle"></span></th>'
    +'<th style="width:90px">Location</th>'
    +'</tr></thead><tbody>';
  var lastSvc='';
  _ordersView = buildInptMedOrders(pt).concat(pt.orders);
  _ordersView.sort(function(a,b){ return _svcRank(a.svc)-_svcRank(b.svc); });
  _ordersView.forEach(function(o,i){
    var svcCell=o.svc!==lastSvc?'<td class="svc-cell">'+o.svc+'</td>':'<td></td>';
    lastSvc=o.svc;
    var statusText=_ordStatusText(o);
    var isPending=statusText==='pending';
    html+='<tr onclick="selectOrderRow(this)" oncontextmenu="return showOrderCtxMenu(event,'+i+')">'+svcCell+'<td style="white-space:pre-wrap'+(isPending?';color:#0000cc':'')+'">'+_ordListText(o.ord,o.svc)+'</td><td style="font-size:10px">'+o.start+'</td><td style="font-size:10px">'+_ordProviderText(o.prov)+'</td><td></td><td></td><td></td><td style="font-size:10px">'+statusText+'</td><td style="font-size:10px">'+(o.loc||'')+'</td></tr>';
  });
  html+='</tbody></table>';
  tableWrap.innerHTML=html; right.appendChild(tableWrap); outer.appendChild(right);
  mp.appendChild(outer);
  makeColumnsResizable(document.getElementById('orders-tbl'));
}
// Merged from two scrolled screenshots of the real "Internal Medicine and
// Geriatrics Inpatient Menu" popup (same reconciliation approach used for
// the Lab Test Quick Orders Menu) -- a few stray non-clinical placeholder
// entries visible only in the reference captures ("foleytest", a bare ":")
// were left out as noise, not real menu content.
var imGeriatricsMenuCols=[
  [
    {hdr:'GENERAL ORDERS'},
    {item:'How to admit from the ED to the ward'},{item:'How to directly admit to the ward'},
    {item:'GMED additional admission orders'},{item:'How to document code status'},
    {item:'Individual admit orders'},{item:'Other orders'},
    {hdr:'VITAL SIGN MEASUREMENTS'},
    {item:'Vital sign thresholds (Call H.O. if...)'},{item:'Strict I&O x 48H'},
    {item:'Orthostatics'},{item:'Bladder scan'},{item:'Post-void residual (PVR)'},{item:'Daily weights'},
    {hdr:'PATIENT SAFETY-RELATED ORDERS'},
    {item:'Aspiration precautions'},{item:'Elopement Risk Assessment'},
    {item:'Vital sign thresholds (Call H.O. if...)'},{item:'Sitter (Safety Attendant)'},
    {item:'Restraints'},{item:'Fall Precautions'},{item:'Delirium Precautions Order Menu'},
    {item:'Seizure Precautions'},{item:'Post Fall Care'},
    {item:'Goal O2 sat 88-92% (for patients with COPD)'},{item:'Goal O2 sat >=92%'},
    {hdr:'URINARY CATHETER ORDERS'},
    {item:'Place external urinary catheter'},{item:'Straight cath every shift'},
    {item:'Straight cath then bladder scan'},{item:'Insert/switch out Foley catheter'},
    {item:'Foley Catheter Continue'},{item:'Discontinue foley/voiding trial'},
    {hdr:'MISCELLANEOUS NURSING ORDERS'},
    {item:'Free Text Nursing Order'},{item:'Other Nursing Orders'},
    {hdr:'WOUND CARE ORDER'},
    {item:'Wound Text Order'},
    {hdr:'RESPIRATORY THERAPY ORDERS'},
    {item:'Goal O2 sat 88-92% (for patients with COPD)'},{item:'Goal O2 sat >=92%'},
    {item:'Incentive Spirometry'},{item:'CPAP Order'},{item:'Hand held nebulizer/metanebs'},
    {item:'Sputum induction'},{item:'Other respiratory therapy orders'},
    {hdr:'MED SURG TELEMETRY AND PULSE OX (3W & 5SD)'},
    {item:'Initiate cardiac monitoring and pulse oximetry'},{item:'Initiate cardiac monitoring only'},
    {item:'Initiate pulse oximetry only'},{item:'Off cardiac monitoring and/or pulse ox for shower'},
    {item:'Off cardiac monitoring and/or pulse ox for test/procedure'},
    {item:'Discontinue cardiac monitoring and pulse oximetry'},{item:'Discontinue cardiac monitoring only'},
    {item:'Discontinue pulse oximetry only'},
    {hdr:'PALLIATIVE CARE'},
    {item:'Hospice HUGS/ACH Comfort Care'},
    {item:'Subcutaneous Meds and Fluids for Palliation of Symptoms Order Menu'},
  ],
  [
    {hdr:'NUTRITION AND FOOD'},
    {item:'Diet/Tube Feed Orders'},{item:'SLP swallow evaluation (RN bedside swallow screening not yet available)'},
    {hdr:'MEDICATIONS'},
    {item:'Full Inpatient Medication Menu'},{item:'Outpatient Meds/Supplies/IV Order Menu'},{item:'PBM/Non-Formulary Consult'},
    {hdr:'RADIOLOGY'},
    {item:'How to upload outside imaging to system'},{item:'Full radiology menu'},
    {item:'Common X-ray studies'},{item:'Common Ultrasound studies'},{item:'Common CT studies'},{item:'Common MRI studies'},
    {hdr:'COMMON CARDIAC STUDIES'},
    {item:'EKG'},{item:'TTE'},{item:'TEE'},{item:'Ambulatory ECG/Holter/Event Monitoring'},
    {hdr:'LABORATORY'},
    {item:'Microbiology Test Order Screen'},{item:'LABORATORY...',fn:'openLabOrderDlg'},
    {hdr:'COMMON INPATIENT LABS'},
    {item:'Info about lab draws and how to add on labs'},
    {blank:true},
    {item:'AM BMP'},{item:'AM BMP/Mg'},{item:'AM Ca, Mg, Phos'},{item:'AM CBC w/ diff'},
    {item:'AM Hepatic Enzymes'},{item:'AM Direct Bilirubin'},{item:'AM aPTT, PT, INR'},{item:'AM HIV'},
    {blank:true},
    {item:'AM CBC + BMP'},{item:'AM CBC + BMP/Mg'},{item:'AM CBC + BMP + Hepatic Enzymes'},
    {item:'AM CBC + BMP + Hepatic Enzymes + Coags'},
    {blank:true},
    {item:'PM CBC w/ diff'},{item:'PM BMP/Mg'},
    {blank:true},
    {item:'Urinalysis'},{item:'UA and Urine Culture'},
    {blank:true},
    {item:'VBG'},{item:'ABG'},
    {blank:true},
    {item:'Rotational Thromboelastography (ROTEM)'},
    {hdr:'COMMON ANEMIA WORK-UP'},
    {item:'Reticulocyte count'},{item:'How to order a peripheral smear'},
    {item:'Iron, TIBC, Transferrin, Ferritin'},{item:'B12/Folate'},
    {hdr:'TRANSFUSION ORDERS'},
    {item:'Blood Bank Orders'},{item:'Post Transfusion Hgb/Hct'},
    {hdr:'GENERIC TEXT ORDER'},
    {item:'Generic (Nursing) Order'},
  ],
  [
    {hdr:'CODE 99/RAPID RESPONSE LAB ORDER SET'},
    {item:'Code 99/Rapid Response Labs (Ward Collect)'},{item:'Code 99/Rapid Response Labs + Troponin (Ward Collect)'},
    {hdr:'CONSULTS'},
    {item:'Common Inpatient Consults'},{item:'Common Outpatient WLA consults'},{item:'Full Consult Menu'},
    {hdr:'ORDER SETS/GUIDANCE MENUS'},
    {item:'Alcohol Withdrawal Protocol'},{item:'Cirrhosis Guidance Menu'},{item:'CODE STROKE Order Menu'},
    {item:'Delirium Precautions Order Menu'},{item:'Evaluation for HD Access'},
    {item:'Hyperkalemia Management Guidance'},{item:'ID Antibiotic Guidance'},
    {item:'Inpatient COPD Discharge Menu'},{item:'Inpatient Diabetes Management Guidance'},
    {item:'Labs/Studies to Setup Outpatient HD'},{item:'Opioid Use Disorder (OUD) Menu for Inpatient'},
    {item:'Oral Amoxicillin Challenge'},{item:'Osteoporosis/Fragility Fracture Orders'},
    {item:'Sepsis Order Menu'},{item:'TB Diagnostic Testing (with sputum induction)'},
    {item:'TB Diagnostic Testing (without sputum induction)'},
    {hdr:'PROCEDURE ORDER SETS'},
    {item:'Lumbar Puncture (non-IR)'},{item:'Lumbar Puncture (IR)'},
    {item:'Diagnostic Paracentesis (non-IR)'},{item:'Therapeutic Paracentesis (non-IR)'},
    {item:'Paracentesis (IR)'},{item:'NGT insertion (includes confirmatory KUB)'},{item:'Thoracentesis'},
    {hdr:'DISPOSITION-RELATED CONSULTS'},
    {item:'How to request Beneficiary Travel (BT)'},{item:'PT/OT evaluation'},{item:'Home Oxygen Evaluation'},
    {item:'Home health orders'},{item:'Prosthetics request'},{item:'PICC consult'},
    {item:'Outpatient IV antibiotics (OPAT)'},{item:'Grant & Per Diem (GPD)/CERS'},{item:'Domiciliary (DOM)'},
    {item:'Tiny Homes (CTRS)'},{item:'Board & Care/Assisted Living (B&C/ALF)'},{item:'Acute Rehab Unit (ARU)'},
    {item:'Community Nursing Home (CNH)'},{item:'Community Living Center (CLC)'},{item:'CLC Dementia Care (2N)'},
    {item:'Team 7 Consult'},
    {hdr:'DISCHARGE/TRANSFER'},
    {item:'How to convert from obs to inpatient'},{item:'How to discharge a patient'},
    {item:'Provider Update'},{item:'Discharge Patient order'},
  ],
];
function openIMGeriatricsMenu(){
  openOrderMenu('Internal Medicine and Geriatrics Inpatient Menu',imGeriatricsMenuCols);
}
var inptWardsMenuCols=[
  [
    {hdr:'INPATIENT WARD ORDER MENUS'},
    {item:'Internal Medicine and Geriatrics Inpatient Menu',fn:'openIMGeriatricsMenu'},{item:'Cardiology Inpatient Menu'},
    {item:'Neurology Inpatient Menu'},{item:'WLA CLC Order Menu'},{item:'SEP CLC Order Menu'},{item:'2E Rehab'},
    {hdr:'INPATIENT SURGERY'},
    {item:'Anesthesia Menu'},{item:'Surgery Inpatient Menu'},{item:'Surgery Preop Medication Menu'},
    {item:'Cardiac Surgery Order Menu'},{item:'General Surgery Adm/Preop/Postop Orders'},
    {item:'General Surgery Inpatient'},{item:'Gynecology Pre-Op Orders'},{item:'Gynecology Post-Op Orders'},
    {item:'Head & Neck Inpatient Order Menu'},{item:'Head & Neck SICU Admission Order Menu'},
    {item:'Neurosurgery Pre-Op Orders'},{item:'Neurosurgery Post-Op Orders'},{item:'Ophthalmology Inpatient Menu'},
    {item:'Ophthalmology Pre-Op Orders'},{item:'Ophthalmology Post-op Orders'},{item:'Oral & Maxillofacial Sugery'},
    {item:'Orthopedic Inpt Menu'},{item:'Orthopedic PostOp Orders'},{item:'Thoracic Surgery Post Op Orders'},
    {item:'Urology Inpatient Menu'},{item:'Vascular Surgery Inpatient Menu'},
    {hdr:'INPATIENT PSYCHIATRY'},
    {item:'PES Main Order Screen'},{item:'Inpt Psychiatry Main Order Screen (2South and 2West)'},
  ],
  [
    {hdr:'ICUS'},
    {item:'PCU Main Order Screen'},{item:'ICU Main Order Screen'},{item:'Tele-ICU Main Order Screen'},
    {hdr:'OTHERS'},
    {item:'DIALYSIS ORDERS'},{item:'Isolation Ordering Instructions'},{item:'PAIN CONSULTS WLA'},
    {item:'DOM Order Menu'},{item:'Go to OUTPATIENT Clinics Menu'},
    {hdr:'VERBAL/PROTOCOL ORDERS FOR NURSES'},
    {item:'Common Verbal Orders for ICU Nurses'},{item:'Common Verbal/Protocol Orders for Gmed Nurses'},
    {item:'Nursing High Risk Referrals'},{item:'ELOPEMENT RISK HARM ASSESSMENT'},
  ],
];
var primaryCareMenuCols=[
  [
    {hdr:'LABORATORY'},
    {item:'LABORATORY MAIN ORDER SCREEN'},{item:'Lab Quick Orders'},{item:'Microbiology Order Screen'},
    {sub:'Commonly Used Order Sets'},
    {item:'Annual non-DM HM (CBC/Chem/Hgb A1c/LFTs/Lipid)'},{item:'Annual T2DM HM (above + microalb/Cr)'},
    {item:'Calcium Panel (Ca, Alb, Phos, Mag)'},{item:'Chronic Diarrhea Panel'},{item:'CKD Bundle'},
    {item:'Hypogonadism Work-up *(fasting (Total T,SHBG,FSH/LH,albumin)'},{item:'ILD Work-Up'},
    {item:'Iron Panel (Fe*TIBC*Transferrin*Ferritin)'},{item:'Lung nodule labs (HIV, TB, Fungal Ab panel, Cocci, Cryptococcus)'},
    {item:'Memory Panel (TSH, RPR, B12/Folate)'},{item:'STI Panel (HIV/urine gonorrhea & chlamydia/RPR)'},
    {sub:'Routine Labs (NONFASTING is the standard)'},
    {item:'AFP'},{item:'ANA'},{item:'B12/Folate'},{item:'MMA'},{item:'Basic Metabolic Panel (Chem-7 + Ca)'},
    {item:'NT-ProBNP (WLA)'},{item:'CBC with Auto Diff'},{item:'COVID-19 Labs'},{item:'Comprehensive Metabolic Panel (CMP)'},
    {item:'CRP/ESR'},{item:'Cystatin C'},{item:'FIT'},{item:'H.pylori Ag, Stool'},{item:'Hepatitis C Ab Total'},
    {item:'Hepatitis A/B/C Panel'},{item:'Hgb A1c'},{item:'HIV Ab'},{item:'Lipid Panel'},{item:'Liver Function'},
    {item:'Pregnancy (urine)'},{item:'PSA'},{item:'PT/INR'},{item:'PTH'},{item:'Quantiferon TB Gold Panel'},
    {item:'Reticulocyte Count'},{item:'RPR'},{item:'SPEP/QIGS'},{item:'Testosterone, Total (Fasting prior to 9AM)'},
    {item:'TSH'},{item:'T4, Free'},{item:'UA w/ reflex to C&S'},{item:'Uric Acid'},{item:'Urinalysis only'},
    {item:'Urine Microalb/Creat'},{item:'Urine PCR Chlamydia/GC'},{item:'Urine Protein/Creatinine'},
    {item:'Urine Tox (incl Oxycodone/Methadone)'},
  ],
  [
    {hdr:'RETURN TO CLINIC'},
    {item:'_** RTC'},{item:'RTC with Pre-set Date'},
    {hdr:'PHARMACY ... for take home'},
    {item:'OUTPATIENT MEDICATION MAIN SCREEN'},
    {sub:'Medication Quick Orders'},
    {item:'Alcohol Use Disorder'},{item:'Allergy/Pulmonary'},{item:'Dermatology'},{item:'Diabetes/Endocrine'},
    {item:'GI'},{item:'Harm Reduction Main Menu'},{item:'HTN/Lipids/Cardiovascular'},
    {item:'Opioid Use Disorder (OUD) Menu'},{item:'Pain Meds'},{item:'Urology'},{item:'Weight Management Medications'},
    {item:'Outpatient Medication Quick Orders'},{item:'Same Day Care Quick Orders'},{item:'Bowel Preps'},
    {sub:'Protocols ... PBM'},
    {item:'Outpatient Medication Protocols (eg insulin algorithm)'},{item:'Outpatient Antibiotic/Antiviral Protocols'},
    {item:'Osteoporosis Ordering Guide'},{item:'Pharmacy Benefits Management'},{item:'PrEP Menu'},
    {sub:'Supplies'},
    {item:'Outpatient Supply Quick Orders'},{item:'Diabetes Outpatient Supply Items'},{item:'Urologic/Incontinence Supplies'},
    {hdr:'PROCEDURE ROOM'},
    {item:'MEDICATIONS GIVEN IN CLINIC'},{item:'NURSING ORDER (FREE TEXT)'},{item:'NURSING EAR LAVAGE ORDER'},
    {item:'EKG'},{item:'Foley Catheter'},{item:'Ketorolac (Toradol) 60mg IM'},{item:'Orthostatics'},{item:'Post Void Residual'},
    {hdr:'Vaccines'},
    {item:'* = ordering menu available if needed to order outside clinical reminder'},
    {item:'COVID-19 Vaccine* (use Clinical Reminder)'},{item:'Hepatitis A vaccine* (use Clinical Reminder)'},
    {item:'Hepatitis B vaccine* (use Clinical Reminder)'},{item:'Human Papillomavirus (HPV) vaccine* (use Clinical reminder)'},
    {item:'Influenza vaccine* (use Clinical Reminder)'},{item:'Measles/Mumps/Rubella (MMR) Vaccine (outpt pharmacy pick-up)'},
    {item:'Meningococcal vaccine (Menveo) (pick up)'},{item:'Pneumococcal vaccine* (use Clinical Reminder)'},
    {item:'RSV vaccine* (use Clinical Reminder)'},{item:'Tetanus* (Td and Tdap) (use Clinical Reminder)'},
    {item:'Zoster Vaccine (Shingrix)* (use Clinical Reminder)'},{item:'ID Travel Vaccine menu'},
  ],
  [
    {hdr:'IMAGING'},
    {item:'RADIOLOGY MAIN ORDER SCREEN'},
    {sub:'** XRAY'},
    {item:'Abdomen 3 View incl Chest'},{item:'CXR PA&Lat 2 views'},{item:'Chest Special (Decubs etc)'},
    {item:'FLUOROSCOPY (Esophagus/UGI/Ba Enema)'},{item:'Musculoskeletal (Lower Extremity)'},
    {item:'Musculoskeletal (Upper Extremity)'},{item:'Musculoskeletal (Spine/Skull)'},
    {sub:'** CT'},
    {item:'CT MAIN ORDER SCREEN'},{item:'CT Angio Pulmonary (for PE)'},{item:'CT Abdomen studies'},
    {item:'CT CHEST W/O CONTRAST'},{item:'CT Head w/o contrast'},{item:'CT KUB (for nephrolithiasis)'},
    {item:'CT Neck studies'},{item:'CT Pelvis studies'},{item:'CT Sinus'},{item:'CT Urogram (for hematuria/Bladder CA)'},
    {sub:'** MRI'},
    {item:'MRI MAIN ORDER SCREEN'},
    {sub:'** Ultrasound'},
    {item:'US MAIN ORDER SCREEN'},{item:'US AAI with Doppler (for PAD)'},{item:'US Aorta'},
    {item:'US Abdomen complete'},{item:'US Carotid b/l'},{item:'US Liver Follow Up'},
    {item:'US Lower extrem venous (for DVT)'},{item:'US Renal Study'},{item:'US Scrotum'},{item:'US Thyroid'},
    {sub:'** Mammogram'},
    {item:'MAMMOGRAM MAIN ORDER SCREEN'},{item:'Mammogram Screening'},
    {sub:'** Nuclear Medicine'},
    {item:'NUCLEAR MEDICINE MAIN ORDER SCREEN'},{item:'CITC Bone Densitometry Axial (DEXA)'},
    {item:'Coronary Calcium Score'},{item:'PET MAIN ORDER SCREEN'},{item:'PET Tumor Imaging (Eval and Staging)'},
  ],
  [
    {hdr:'CONSULTS'},
    {item:'CONSULT/PROCEDURE MAIN ORDER SCREEN'},{item:'E-Consults (Outpatient)'},{item:'Community Care'},
    {item:'Allergy/Immunology'},{item:'Anticoagulation Consults'},{item:'Audiology/Speech'},
    {item:'Cardiology Outpt Consults Main Screen'},{item:'Cardiology New Patient'},{item:'Cardiology Procedures'},
    {item:'Ziopatch/Holter/Event Monitor'},{item:'Echocardiogram'},{item:'Cardiology Stress Test Main Screen'},
    {item:'ETT'},{item:'Myocardial Perf w/Pharm'},{item:'Dementia/Universal'},{item:'Dental'},{item:'Dermatology'},
    {item:'Domiciliary'},{item:'EMG/NCS'},{item:'Endocrinology'},{item:'Diabetes Clinic'},
    {item:'Eye Ophthalmology'},{item:'Tele-Eye Screening WLA'},{item:'Gastrointestinal Consults Main Screen'},
    {item:'Routine GI'},{item:'Liver'},{item:'Bowel Preps'},{item:'Genetics Consult'},
    {item:'Hematology/Oncology'},{item:'Home Care Services'},{item:'Infectious Disease'},
    {item:'Integrative Health/Whole Health Outpt Consults'},{item:'Acupuncture Consults'},{item:'Massage Therapy'},
    {item:'Mental Health - PCMHI'},{item:'Suicide Prevention Coordinator E Consult GLA'},{item:'MOVE!'},
    {item:'Nephrology'},{item:'Neurology'},{item:'EEG'},{item:'Nutrition'},{item:'Palliative Care'},
    {item:'PM&R'},{item:'Outpatient General Rehab Clinic'},{item:'Pain clinic (Chronic)'},
    {item:'Interventional Pain Clinic'},{item:'Chiropractic Care'},{item:'Physical Therapy'},
    {item:'Occupational Therapy'},{item:'Podiatry'},{item:'Limb Preservation'},{item:'Prosthetics Request'},
    {item:'Pulmonary clinic'},{item:'PFTs'},
  ],
];
// Merged from two scrolled screenshots of the real "Lab Test Quick Orders
// Menu" popup -- duplicate sections that appeared in both captures
// (Microbiology, Blood Transfusion, etc.) were reconciled to appear once.
// A few stray non-clinical entries visible only in the reference screenshot
// (e.g. a leftover "cdi test" placeholder row) were left out as noise, not
// real menu content worth teaching against.
// Landing page only for now -- Radiology *GLA*/*SACC*, Nuclear Medicine,
// Interventional Procedures, and the Contrast Allergy quick order are left
// inert (hover only) pending further screenshots of their own submenus.
// Real screenshot's contact email was a live VA distribution mailbox
// (VhaglaImagingPacs@va.gov) -- fictionalized to a made-up address, same
// scrub convention already applied to every phone number in data.js.
var radiologyOrdersCols=[
  [
    {hdr:'By Body Area...'},
    {item:'ABDOMINAL (Imaging)...'},{item:'ABDOMINAL (Ultrasound)...'},{item:'ABDOMINAL (Special Procedures)...'},
    {item:'BREAST IMAGING & MAMMOGRAPHY...'},{item:'CHEST...'},{item:'HEAD & NECK...'},
    {item:'NEURO (GENERAL)...'},{item:'NEURO (ANGIO/CT/MRI/MRA)...'},
    {item:'MUSCULOSKELETAL (Lower Extremity)...'},{item:'MUSCULOSKELETAL (Upper Extremity)...'},
    {item:'MUSCULOSKELETAL (Spine/Skull)...'},{item:'VASCULAR...'},
    {blank:true},
    {hdr:'OR Procedures'},
    {item:'Operating Room Procedures...'},
    {hr:true},
    {item:'>> Radiology Information & Help... <<'},
    {item:'>> NUCLEAR MEDICINE MENUS <<'},
    {hr:true},
    {hdr:'NOTICES:'},
    {note:'&gt; STAT/URGENT EXAMS require that patient must be sent down<br>to radiology immediately and return to clinic for results after exam.'},
    {blank:true},
    {note:'&gt; If your PATIENT IS TRAVELING any distance by BUS include this<br>information in the History for scheduling purposes.'},
  ],
  [
    {hdr:'By Imaging Technique...'},
    {item:'INTERVENTIONAL/ANGIOGRAPHY'},{item:'CT SCAN...'},{item:'FLUOROSCOPY...'},{item:'MRI/MRA...'},
    {item:'PLAIN FILM (A thru F)...'},{item:'PLAIN FILM (H thru P)...'},{item:'PLAIN FILM (Q thru Z)...'},
    {item:'ULTRASOUND...'},
    {blank:true},
    {hdr:'Frequent Exams...'},
    {item:'CHEST SINGLE VIEW (PORTABLE)'},{item:'CHEST PA&LAT  2 VIEWS'},
    {blank:true},
    {hdr:'Community-Care Imaging Exams'},
    {item:'Request IMAGING to handle exams that will be performed<br>through upcoming Community-Care Consults'},
    {hr:true},
    {hdr:'OUTSIDE EXAMS - to be imported from disks for comparison purposes only'},
    {item:'&gt;&gt;Order OUTSIDE EXAMS on disk to be uploaded to GLA PACS'},
    {note:'NOTE:'},
    {note:'Backlog on OUTSIDE EXAMS loading to PACS is approx. 30 days.<br>If needed sooner email  GLARadImagingPACS@va.gov<br>specifying WHY images need expediting and WHEN they are needed.'},
    {blank:true},
    {note:'NOTE: Disks are not kept and cannot be returned.<br>&nbsp;&nbsp;&nbsp;&nbsp;Outside images submitted on disk without an order will be deleted<br>&nbsp;&nbsp;&nbsp;&nbsp;after thirty days.'},
    {hr:true},
    {hdr:'Request Copies of GLA Exams'},
    {item:'&gt;&gt;Order CD/DVD COPIES of GLA Imaging Exams...'},
  ],
];
function openRadiologyOrders(){
  openOrderMenu('RADIOLOGY ORDERS',radiologyOrdersCols);
}
var radiologyMenuCols=[
  [
    {item:'Not sure what imaging exam to order?'},
    {item:'Please consult the:  APPROPRIATENESS CRITERIA'},
    {blank:true},
    {item:'Radiology *GLA*',fn:'openRadiologyGLA'},
    {item:'Radiology *SACC*'},
    {blank:true},
    {item:'Nuclear Medicine'},
    {blank:true},
    {item:'Interventional Procedures'},
  ],
  [
    {hdr:'Contrast Allergy Pre-medication Orders'},
    {item:'Click here to order (prednisone/diphenhydramine)'},
  ],
];
var inptMedOrderMenuCols=[
  [
    {hdr:'CONSTIPATION MEDS'},
    {item:'Bowel Regimen'},
    {hdr:'ANTI-EMETIC MEDS'},
    {item:'Ondansetron sublingual'},{item:'Ondansetron IVP'},{item:'Metoclopramide IVP'},{item:'Promethazine tab'},
    {hdr:'NON-OPIOID PAIN MEDS'},
    {item:'Acetaminophen tab'},{item:'Acetaminophen IV (only if unable to tolerate PO)'},
    {item:'Diclofenac gel'},{item:'Ibuprofen tab'},{item:'Ketorolac IVP'},
    {item:'Lidocaine cream/ointment'},{item:'Capsaicin cream'},
    {hdr:'OPIOID PAIN MEDS'},
    {item:'Opioid Meds'},{item:'PCA Standard Physician Orders'},{item:'Bowel Regimen'},
    {hdr:'INSOMNIA MEDS'},
    {item:'Melatonin'},
    {hdr:'DYSPEPSIA MEDS'},
    {item:'Famotidine tab'},{item:'Omeprazole cap'},{item:'Maalox Plus ES susp'},
    {hdr:'COUGH MEDS'},
    {item:'Benzonatate cap'},{item:'Guaifenesin tab'},{item:'DM/Guaifenesin liquid'},
  ],
  [
    {hdr:'INSULIN ORDERS'},
    {item:'Click here for inpatient diabetes management guidance'},
    {item:'Blood glucose checks'},{item:'Glargine'},{item:'Aspart'},
    {item:'Aspart Insulin Sliding Scale + Blood Glucose Checks'},
    {item:'Regular Insulin Sliding Scale + Blood Glucose Checks'},
    {hdr:'NON-INSULIN DIABETES MEDICATIONS'},
    {item:'Blood glucose checks'},
    {sub:'Metformin'},
    {item:'Metformin'},{item:'Metformin SA'},
    {sub:'Sulfonylureas'},
    {item:'Glipizide'},{item:'Glyburide'},
    {sub:'Meglitinides'},
    {item:'Repaglinide (restrictions)'},
    {sub:'DPP4 Inhibitors'},
    {item:'Sitagliptin'},{item:'Alogliptin/Saxagliptin/Linagliptin'},
    {sub:'GLP-1 Agonists'},
    {item:'Click here'},
    {sub:'Thiazolidinediones'},
    {item:'Pioglitazone'},
    {sub:'SGLT2-Inhibitors'},
    {item:'Empagliflozin'},
    {sub:'Alpha-glucosidase Inhibitors'},
    {item:'Acarbose'},
  ],
  [
    {hdr:'ELECTROLYTE REPLETION'},
    {item:'Click here for guidance on electrolyte repletion'},
    {hdr:'IV FLUIDS'},
    {item:'Click here for IV fluid guidance'},
    {hdr:'ANTIBIOTICS'},
    {item:'Click here for antibiotic guidance'},
    {hdr:'IV HEPARIN PROTOCOLS'},
    {item:'Click here for IV heparin protocols'},
    {hdr:'IMMUNIZATIONS'},
    {item:'Pneumococcal PCV21 vaccine'},{item:'RSV'},
    {hdr:'MISCELLANEOUS'},
    {item:'Bowel Prep (Golytely)'},
    {item:'Magic Mouth Wash (Benadryl 5ml + Maalox ES 5ml + Lidocaine 5ml)'},
    {item:'IVIG Ordering Menu'},
    {hdr:'FOR PHARMACIST USE ONLY'},
    {item:'TPN Nursing Order Menu'},{item:'Bedside DC Nursing Order'},
    {hdr:'OTHER'},
    {item:'PBM CONSULT'},{item:'DOCUMENT NON-VA MEDS'},
    {item:'INPATIENT MEDS QUICK ORDERS'},{item:'ALL OTHER INPATIENT MEDS/SUPPLIES',fn:'openInptMedsFormulary'},
  ],
];
var labQuickOrdersMenuCols=[
  [
    {hdr:'COVID-19'},
    {item:'COVID-19 Labs'},
    {hdr:'Common Panels'},
    {item:'Basic Hep Monitor Panel (ALT/AlkPhos/TotBili/Albumin)'},
    {item:'Basic Metabolic Panel'},
    {item:'Calcium Panel (Ca, Alb, Phos, Mag)'},
    {item:'Diab Panel (Anion/Osmolar gap/A1c/Urine Prot & Microalb/Creat)'},
    {item:'Diabetes Panel *(BAK)*'},
    {item:'Lipid/Trig/LDL/Chol(calc) (Chol/HDL)'},
    {item:'Lipid (Non-fasting)'},
    {item:'Metab Panel (Alb/T.Bili/ALT/Ca/AlkPhos)'},
    {hdr:'CHEMISTRY'},
    {item:'Albumin (Serum)'},{item:'Alk Phosphatase'},{item:'ALT (SGPT)'},{item:'Amylase'},
    {item:'AST (SGOT)'},{item:'B12 Folate Panel'},{item:'Bilirubin, Total'},{item:'Bilirubin Direct'},
    {item:'BNP (Quest)'},{item:'NT-ProBNP (WLA)'},{item:'BUN'},{item:'Calcium'},{item:'Creatinine'},
    {item:'Ferritin *'},{item:'Glucose'},{item:'Glutamyl Transferase'},{item:'Hgb A1C *'},{item:'Hgb A1c (BAK)'},
  ],
  [
    {item:'Ketones'},{item:'LDH, Total'},{item:'Lipase'},{item:'Magnesium'},{item:'Phosphorus'},
    {item:'Pregnancy (Qual Serum HCG)'},{item:'Urine Pregnancy (Qual Urine HCG)'},
    {item:'PSA *'},{item:'Potassium'},{item:'Protein, Total'},{item:'PTH'},{item:'Sodium'},
    {item:'TSH 3'},{item:'Uric Acid'},{item:'Vit D total (replaces 25 Hydroxy)'},
    {hdr:'BLOOD TRANSFUSION'},
    {item:'Blood Bank Orders'},{item:'Post Transfusion Hgb/Hct'},
    {item:'OTHER Lab Tests...'},
    {hdr:'ANATOMIC PATHOLOGY'},
    {item:'Laboratory Molecular Pathology Consult'},
    {hdr:'BODY FLUIDS'},
    {item:'CSF Cell Count with Diff'},{item:'CSF Lactate Dehydrogenase'},{item:'CSF Glucose'},{item:'CSF Total Protein'},
    {hdr:'CYTOGENETICS'},
    {item:'Philadelphia Chromosomes'},
    {hdr:'>> * TEST PERFORMED AT WLA <<'},
  ],
  [
    {hdr:'HEMATOLOGY'},
    {item:'Activated PTT'},{item:'CBC w/o Diff'},{item:'CBC part Auto Diff'},
    {item:'Erythrocyte Sedimentation Rate (ESR)'},{item:'Prothrombin Time+INR'},{item:'Reticulocyte Count+CBC'},
    {item:'UA w/ Micro (spot)'},{item:'Microalbumin/creatinine ratio (spot)'},{item:'Protein/creatinine ratio (spot urine)'},
    {item:'CKD Panel'},{item:'Iron Group *'},
    {hdr:'Urine screen for:'},
    {item:'Amphetamines (Qual)'},{item:'Benzodiazepines (Qual)'},{item:'Cocaine (Qual)'},
    {item:'Methadone Clinic Drug Screen'},{item:'Methadone Clinic Drug Screen QODx60'},
    {item:'Buprenorphine Clinic Drug Screen'},{item:'Opiates (Quan)'},{item:'THC (Qual)'},
    {item:'Drugs of Abuse Screen: opiates/cocaine/amphetamines/benzo/THC'},
    {hdr:'MICROBIOLOGY'},
    {item:'Anaerobic culture'},{item:'Blood C&S'},{item:'Urine C&S (Outpatient)'},
    {item:'Urine C&S (Inpatient/CLC)'},{item:'UA and Urine C&S (Inpatient/CLC)'},
    {item:'FIT Screen'},{item:'FOBT X1 (Diagnostic)(SPOT)'},{item:'Vaginosis Panel'},{item:'TB Diagnostic Testing'},
    {item:'OTHER Microbiology...'},
    {hdr:'IMMUNOLOGY'},
    {item:'Hepatitis B Screening Panel'},{item:'Hepatitis C Ab Total *'},{item:'RPR/MHA.TP *'},
    {item:'Rheumatoid factor *'},{item:'HIV Antigen/Antibody Panel'},{item:'STI Order Menu'},
    {hdr:'THERAPEUTIC DRUG MONITORING'},
    {item:'Digoxin'},{item:'Phenytoin'},{item:'Theophylline'},{item:'Valproic Acid'},{item:'Lithium'},
    {item:'Amitriptyline/Nortriptyline Panel'},{item:'Tegretol'},
  ],
];
// A few stray non-clinical artifacts visible in the reference screenshot
// (bare "****", ".", "####", "%%%%", a lone backtick) were left out as
// noise, same call as the Lab Quick Orders and IM/Geriatrics menus.
// A trailing "***" artifact visible in the reference screenshot was left
// out as noise, same call as the other merged menus.
var outptMedsSuppliesMenuCols=[
  [
    {hdr:'OUTPATIENT MEDICATION AND SUPPLIES ORDERING MENU'},
    {blank:true},
    {item:'Outpatient Med Quick Orders -- Master List',fn:'openOutptMedQuickOrders'},
    {item:'Outpatient Pharmacy Supplies Quick Orders'},
    {item:'Outpatient Medication Protocols (eg insulin algorithm)'},
    {item:'Outpatient IVPB Quick Orders'},
    {item:'Outpatient IV Infusion Quick Orders'},
    {item:'Outpatient Anti-infectives Quick Orders'},
    {item:'Outpatient Antibiotic/Antiviral Protocols'},
    {item:'Outpatient Meds To Be Given In Clinic Quick Orders (IMO Menu)'},
    {item:'Outpatient Psych Medication Orders'},
    {item:'Outpatient Schedule II Medication Quick Orders'},
    {item:'Outpatient Colonoscopy/FlexSig Bowel Preps'},
    {item:'Outpatient Wound Care Supplies/Meds'},
    {item:'Outpatient Medication Menu for MMU'},
  ],
  [
    {item:'List of Medications Approved for CBOC'},
    {blank:true},
    {item:'GLA Pharmacy Benefits Management (request non-formulary drug)'},
    {blank:true},
    {item:'Drug Information Request (NON-URGENT)'},
    {blank:true},
    {item:'Restricted Medication List'},
    {blank:true},
    {hdr:'FREE TEXT SEARCH BOX'},
    {item:'Outpatient Medications/Supplies'},
  ],
];
// Merged from two scrolled screenshots of the real "Outpatient Med Quick
// Orders" master list into one true A-Z sequence (the two captures'
// column boundaries didn't line up cleanly with each other, so items were
// re-flowed into two columns split near the midpoint of the merged list
// rather than trying to preserve each screenshot's original column breaks).
var outptMedQuickOrdersCols=[
  [
    {hdr:'MEDICATION QUICK ORDERS'},
    {item:'Alcohol Use Disorder Meds'},{item:'Allergy/Pulmonary Meds'},
    {item:'Antibiotic/Antiviral Protocols'},{item:'Derm Meds'},{item:'Diabetes/Endocrine Meds'},
    {item:'GI Meds'},{item:'H. pylori Treatment'},{item:'HTN/Lipids/Cardiovascular Meds'},
    {item:'Pain Meds'},{item:'Psych Meds'},{item:'Rheumatology Meds'},{item:'Urology Meds'},
    {item:'Weight Management Meds'},
    {blank:true},
    {hdr:'A'},
    {item:'Acetaminophen 325mg 2 tabs po q6h prn #100'},{item:'Acetaminophen 500mg 2 tabs po q6h prn #100'},
    {item:'Actifed 1 tab qid prn #30'},{item:'Albuterol (CFC-F) inh 2 puffs qid prn #1'},
    {item:'Alcohol swabs'},{item:'Amitriptyline'},{item:'Amlodipine'},{item:'Amoxapine'},
    {item:'Artificial tears oph 1 gtt both eyes q6h prn #1'},{item:'Ascorbic acid'},
    {item:'Aspirin 81mg chew tab po qday #90'},{item:'Aspirin 325mg po qday #100'},
    {item:'Aspirin 325mg EC po qday #100'},{item:'Atenolol'},{item:'Atorvastatin'},
    {hdr:'C'},
    {item:'Cepacol Lozenge 1 tab q2h prn sore throat #18'},{item:'Cilostazol'},
    {item:'Clomipramine'},{item:'Clopidogrel'},{item:'Clotrimazole 1% cream'},
    {item:'Clotrimazole 10mg troche 5x/d #70'},{item:'Colchicine'},
    {hdr:'D'},
    {item:'Desipramine'},{item:'Diclofenac 1% gel'},{item:'Diclofenac EC'},{item:'Digoxin'},
    {item:'Diltiazem SA'},{item:'Docusate'},{item:'Donepezil'},{item:'Doxepin'},{item:'Dulaglutide'},
    {hdr:'E'},
    {item:'Ergocalciferol 1,250mcg (=50,000 units) qweek x8'},{item:'Empagliflozin'},
    {hdr:'F'},
    {item:'Ferrous sulfate tab'},{item:'Fexofenadine'},{item:'Fluoxetine'},
    {item:'Fluticasone nasal spray'},{item:'Folic Acid 1mg po qday #100'},{item:'Furosemide'},
    {hdr:'G'},
    {item:'Galantamine IR'},{item:'Galantamine SA'},{item:'Glipizide'},{item:'Glucose chew tab prn'},
    {item:'Glucose squeeze tube prn'},{item:'Glucose Test Strips Ordering Menu'},{item:'Guaifenesin products'},
    {hdr:'H'},
    {item:'H. pylori Treatment'},{item:'Hydrochlorothiazide'},{item:'Hydrocortisone 1% cream'},
    {hdr:'I'},
    {item:'Ibuprofen'},{item:'Imipramine'},{item:'Indomethacin'},{item:'Insulin Algorithm (New Start)'},
    {item:'Insulin Aspart FlexPen + needles + alcohol swabs'},
    {item:'Insulin Aspart 70/30 FlexPen + needles + alcohol swabs'},
    {item:'Insulin Glargine (Lantus) + syringes + alcohol swabs'},
    {item:'Insulin Glargine pen (Solostar) + needles + alcohol swabs'},
    {item:'Insulin Human Regular'},{item:'Insulin Human NPH'},{item:'Insulin Syringe Lo-Dose #100'},
    {item:'Insulin Syringe #100'},{item:'Ipratropium HFA inh'},{item:'Ipratropium nasal spray 2 sprays tid'},
    {item:'Isosorbide mononitrate'},
  ],
  [
    {hdr:'L'},
    {item:'Lacosamide'},{item:'Lancet Device'},{item:'Lancets Softclix'},{item:'Levothyroxine'},
    {item:'Lidocaine 5% patch'},{item:'Lidocaine cream/ointment'},{item:'Liraglutide'},
    {item:'Lisinopril'},{item:'Losartan'},{item:'Lovastatin'},
    {hdr:'M'},
    {item:'Maalox Plus ES 15ml q8h prn #2bot'},{item:'Maxzide (HCTZ/Triamterene) 25/37.5mg'},
    {item:'Maxzide (HCTZ/Triamterene) 50/75mg'},{item:'Memantine'},{item:'Metformin'},
    {item:'Metformin SA'},{item:'Methylprednisolone 4mg (DosePak dosing) x 6 days #1 pack (1 pack = 21 tabs)'},
    {item:'Metoprolol succinate (SA)'},{item:'Metoprolol tartrate'},{item:'Mometasone HFA inh'},
    {item:'Multivitamins/minerals 1 tab po qday #100'},
    {hdr:'N'},
    {item:'Naproxen 250mg po bid #60'},{item:'Niacin SA'},{item:'Nicotine patch'},{item:'Nifedipine SA'},
    {item:'Nitroglycerin 0.4mg sl q5min x3 #100'},{item:'Nitroglycerin patch 0.2mg/hr qday #30'},
    {item:'Nortriptyline'},
    {hdr:'O'},
    {item:'Oseltamivir'},{item:'Omeprazole 20mg Daily'},
    {hdr:'P'},
    {item:'Paroxetine'},{item:'Potassium chloride'},{item:'Prasterone vaginal insert (Intrarosa)'},
    {item:'Prazosin'},{item:'Pregabalin'},{item:'Provent'},{item:'Pseudoephedrine 60mg po q6h prn #30'},
    {item:'Psyllium oral powder 1 tsp bid #1170gm'},
    {hdr:'R'},
    {item:'Repaglinide'},{item:'Rivastigmine patch'},{item:'Rosuvastatin'},
    {hdr:'S'},
    {item:'Sacubitril/Valsartan (Entresto)'},{item:'Salsalate'},{item:'Semaglutide (Ozempic)'},
    {item:'Sildenafil'},{item:'Simvastatin'},{item:'Spironolactone'},
    {hdr:'T'},
    {item:'Tadalafil'},{item:'Tamsulosin 0.4mg po qday #90'},{item:'Terazosin'},
    {item:'Tobacco Cessation Treatment'},{item:'Tolterodine SA'},{item:'Trazodone'},
    {item:'Tricyclic Antidepressants (TCAs)'},
    {hdr:'V'},
    {item:'Valsartan'},{item:'Vardenafil'},{item:'Varenicline'},{item:'Verapamil SA'},{item:'Vitamin D'},
    {hdr:'W'},
    {item:'Weight Management Medications'},
  ],
];
function openOutptMedQuickOrders(){
  openOrderMenu('Outpatient Med Quick Orders',outptMedQuickOrdersCols);
}
var wlaOutpatientClinicsMenuCols=[
  [
    {hdr:'"QUICK LINKS" MENU'},
    {blank:true},
    {item:'Administrative Medicine'},{item:'Anesthesia Menu'},{item:'ATC'},
    {item:'Allergy Clinic -WLA'},{item:'Audiology Quick Orders'},{item:'Cardiology Clinic -WLA'},
    {item:'Cardiology Procedure Center WLA'},{item:'Cardiac Surgery Clinic'},
    {item:'Chronic Pain Clinic -WLA'},{item:'CPC Orders'},{item:'Dental Clinic -WLA'},
    {item:'Dermatology Clinic -WLA'},{item:'Diabetes Clinic -WLA'},{item:'Dialysis Order Screen'},
    {item:'DTU'},{item:'ED Order Menu'},{item:'Endocrinology Clinic -WLA'},
    {item:'General Surgery Adm/Preop/Postop Orders'},{item:'Genetics Clinic Menu'},{item:'GI Clinic -WLA'},
    {item:'HBPC'},{item:'Head and Neck Opt Clinic'},{item:'Hem/Oncology Clinic -WLA'},
    {item:'Infectious Disease Clinic WLA'},{item:'Infusion Center Nursing'},{item:'Interventional Radiology'},
    {blank:true},
    {item:'GLA-GENERIC OPT CLINIC ORDER SCREEN'},
  ],
  [
    {item:'Liver Transplant Referral Orders (May 2009)'},{item:'Listed Liver Transplant Orders'},
    {item:'Status/Post Liver Transplant Pt.'},{item:'Status/Post Liver Transplant Labs QWeek'},
    {item:'Liver Transplant Pittsburgh Labs'},{item:'Medicine Preop Clinic'},{item:'Mental Health Orders WLA'},
    {item:'Move Clinic'},{item:'Neurology Clnic -WLA'},{item:'Neurosurgery Clinic -WLA'},
    {item:'Ophthalmology Clinic -WLA'},{item:'Optometry Clinic WLA'},{item:'Orthopedic Clinic -WLA'},
    {item:'Pharmacist Clinic -WLA'},{item:'Plastic Surgery Clinic -WLA'},{item:'PM&RS Outpatient Clinic-WLA'},
    {item:'Podiatry Clinic -WLA'},{item:'Primary Care Clinics WLA'},{item:'Pulmonary/Sleep -WLA'},
    {item:'Radiation Therapy Orders'},{item:'Renal Clinic -WLA'},{item:'Rheumatology Clinic -WLA'},
    {item:'Therapeutic Phlebotomy (WLA)'},{item:'Thoracic Surgery Clinic'},{item:'Urology Clinic -WLA'},
    {item:'Vascular Surgery OPT Clinic (WLA)'},{item:'Vascular/GS Preop Orders'},{item:'Womens Health Clinic GLA'},
    {blank:true},
    {hdr:'Telehealth Consults'},
    {item:'Teledentistry (WLA)'},{item:'Tele-Eye Screening WLA'},{item:'Virtual Whole Health for Diabetes Care'},
    {blank:true},
    {hdr:'Telehealth IPAD and Education'},
    {item:'Digital Divide'},{item:'Video Device order **Social Work only**'},
    {item:'Virtual Health Resource Center (VHRC/VVC Test Call)'},{item:'VVC Test Call and Patient Education'},
  ],
];
var wlaConsultsProcCols=[
  [
    {item:'Addiction Medicine Consult'},{item:'Allergy/Immunology'},{item:'Anesthesia'},
    {item:'Anticoagulation Clinic'},{item:'Audiology & Speech Consults'},
    {item:'Beneficiary Travel/Special Mode Transportation'},{item:'Bio-ethics LST Consult Menu'},
    {item:'Bone Marrow Aspir./Bx'},{item:'Cancer Workshop/Tumor Board'},
    {item:'Cardiology Consults/Procedures'},{item:'Caregiver Support Program (CSP)'},
    {item:'Case Management (Care Management)'},{item:'CERS'},{item:'Chaplain Consults'},
    {item:'CLC Community Living Center (formerly NHCU)'},{item:'Community Care/Non VA Referral'},
    {item:'Community Nursing Home Placement'},{item:'Community Residential Care GEC Referral'},
    {item:'Compassionate Contact Corps (Voluntary Service)'},{item:'Contract Adult Day Healthcare Program'},
    {item:'Dementia/Universal Outpatient Consult'},{item:'Dental'},{item:'Dermatology'},
    {item:'Diabetes Clinic'},{item:'Diabetes Education'},{item:'Digital Divide'},{item:'Domiciliary'},
    {item:'Driver Training (PM&RS)'},{item:'E Consults (Outpatient)'},{item:'Endocrinology'},
    {item:'Eye Care'},{item:'Fine Needle Asp/Biopsy'},{item:'Fisher House/Patriot House Consults'},
    {item:'Genetic Consultation'},{item:'Gen Medicine (Inpt.)'},{item:'GI'},{item:'GRECC/Geriatrics'},
  ],
  [
    {item:'Health Coach'},{item:'Hematology/Oncology'},{item:'Home Based Primary Care (HBPC)'},
    {item:'Home Care Services'},{item:'Homeless PACT/Integrated Community Care'},
    {item:'Homeless Veteran Smart Phone Order'},{item:'Homemaker/Home Health Aide'},
    {item:'Home TeleHealth Care Coordination Screening'},{item:'HUD-VASH'},{item:'ID CONSULTS'},
    {item:'Infusion Center Orders'},{item:'Integrative Health/Whole Health Outpt Consults'},
    {item:'Interventional Radiology eConsults'},{item:'Interventional Psychiatry Consults'},
    {item:'L2 Low Acuity/Intensity Telehealth'},{item:'Medical Foster Home'},
    {item:'Memory & Neurobehavior'},{item:'Mental Health'},{item:'Military Exposure Registry Information'},
    {item:'MOVE! Weight Mgmt Program'},{item:'MY STORY'},{item:'Nephrology'},{item:'Neurology/Stroke'},
    {item:'Neuropsychiatry (inpatient only)'},{item:'Non VA/Community Care Referral Request'},
    {item:'Nutrition'},{item:'Ostomy Consult'},{item:'Palliative Care/Hospice'},{item:'PICC Line'},
    {item:'Pharmacy Benefits Mgt.'},{item:'PM&RS Pain Consults'},{item:'PM&RS Consults'},
    {item:'PAVE Foot Care Education and Screening'},
  ],
  [
    {item:'Podiatry'},{item:'Primary Care Consult'},{item:'Primary Care Mental Health Integration (PCMHI)'},
    {item:'Primary Care Nurse BP Check'},{item:'Primary Care Social Work Services'},
    {item:'Prosthetics Request'},{item:'Psychology Acute Rehabilitation Unit'},
    {item:'Psychology/Neuropsychology Assessment Lab'},{item:'Pulmonary/Home Oxygen/Sleep'},
    {item:'Radiation Oncology'},{item:'Relationship Health and Safety Consult (non-emergent)'},
    {item:'Rheumatology'},{item:'Sleep'},{item:'Social Work Medicine and Surgery'},
    {item:'Social Work PreTransplant Assessment'},{item:'Speech & Audiology'},
    {item:'Spinal Cord Injury/Disord'},{item:'Substance use Disorder(SUD)/Addiction Treatment Programs'},
    {item:'Suicide Prevention Coordinator E Consult GLA'},{item:'Surgery'},
    {item:'Telecare Tuck-in Consult (Replaced with Home Telehealth Consult)'},
    {item:'Tele-Eye Screening WLA'},{item:'Tobacco Use Treatment (TUT)'},
    {item:'Transfer Coordinator Consults'},{item:'Traveling Veteran Consult'},
    {item:'Video Device order **Social Work only**'},{item:'Virtual Health Resource Center (VHRC)'},
    {item:'Virtual Whole Health for Diabetes Care'},{item:'VVC Test Call and Patient Education'},
    {item:"Women's Health"},{item:'Wound Care/Stoma'},
    {blank:true},
    {item:'500  Nuclear Med Procedures'},{item:'600  Radiology Orders...'},{item:'999  Laboratory...'},
  ],
];
function openWlaConsultsProcedures(){
  openOrderMenu('WLA Consults/Procedures',wlaConsultsProcCols);
}
var consultsProcMenuCols=[
  [
    {n:1,t:'WLA Consults/Procedures/Radiology',fn:'openWlaConsultsProcedures'},
    {n:2,t:'SACC Consults/Procedures/Radiology'},
    {n:3,t:'Los Angeles ACC Consults/Procedures'},
    {n:4,t:'Antelope Valley CBOC Consults/Procedures'},
    {n:5,t:'Bakersfield CBOC Consults/Procedures'},
    {n:6,t:'East Los Angeles CBOC Consults/Procedures'},
    {n:7,t:'San Gabriel Valley CBOC Consults/Procedures'},
    {n:8,t:'San Luis Obispo CBOC Consults/Procedures'},
    {n:9,t:'Santa Barbara CBOC Consults/Procedures'},
    {n:10,t:'Santa Maria CBOC Consults'},
    {n:11,t:'Ventura CBOC Consults'},
    {blank:true},
    {plain:'Return To Clinic'},
  ],
  [
    {n:1,t:'Community Care/Non VA Referral'},
    {n:2,t:'Interfacility OUTPATIENT Consults/Traveling Veterans'},
    {n:3,t:'Transfer Coordinator Consults'},
    {n:4,t:'Telehealth Consults'},
    {n:5,t:'COMPACT Act Menu'},
  ],
];
// Real phone numbers scrubbed to the app's established fictional NANP
// exchange (310) 555-03XX, same convention used for the PACT/care-team
// numbers in data.js -- the reference screenshot's number is a real WLA
// VAMC extension.
// Clicking "Radiology *GLA*" navigates within the SAME order-menu-dlg
// (real CPRS behavior, matching its own ◁▷ history arrows) rather than
// opening a new popup -- so this just swaps the title/body content in
// place instead of calling showFloatWin again. The OK/wait/oral-contrast
// options are left inert (hover only) pending screenshots of where each
// one actually leads.
function openRadiologyGLA(){
  document.getElementById('om-title').textContent='WARNING - CONTRAST STUDIES';
  var body=document.getElementById('om-menu-body');
  body.className='bb-body';
  body.innerHTML=
    '<div class="bb-hdr">HELP/INFORMATION - WLA</div>'
    +'<div class="bb-item om-inert">RADIOLOGY INFORMATION HELP SCREEN</div>'
    +'<div class="bb-hdr">Not sure what imaging exam to order?</div>'
    +'<div class="bb-item om-inert">Please consult the:  APPROPRIATENESS CRITERIA</div>'
    +'<div class="bb-hr"></div>'
    +'<div class="bb-hdr">WARNING REGARDING ALL STUDIES REQUIRING CONTRAST:</div>'
    +'<div class="bb-note">A current CREATININE LAB RESULT is required and MANDATORY for<br>'
    +'&nbsp;&nbsp;&nbsp;&nbsp;any radiology exam involving the use of contrast agents.<br>'
    +'&nbsp;&nbsp;&nbsp;&nbsp;Current = 30 days or less.<br>'
    +'&nbsp;&nbsp;&nbsp;&nbsp;NO EXCEPTIONS!</div>'
    +'<div class="bb-item om-inert">&lt;&lt; CLICK HERE TO SEE SCR/BUN 30 DAYS &gt;&gt;</div>'
    +'<div class="bb-hr"></div>'
    +'<div class="bb-band">Now SELECT ONE to continue...</div>'
    +'<div class="bb-item" onclick="event.stopPropagation();openRadiologyOrders()"><b>OK</b>&nbsp;&nbsp;&nbsp;&lt;&lt; I understand both of the above and am now ready to order radiology exams &gt;&gt;</div>'
    +'<div class="bb-item om-inert"><b>wait</b>&nbsp;&nbsp;&lt;&lt; Contrast! Transfer me to order BUN/Creatinine labs first &gt;&gt;</div>'
    +'<div class="bb-hdr">Or order ORAL CONTRAST</div>'
    +'<div class="bb-item om-inert">&lt;&lt; Click to order for your inpatient &gt;&gt;</div>'
    +'<div class="bb-hr"></div>'
    +'<div class="bb-hdr">NOTICE REGARDING ALL STAT and URGENT EXAMS:</div>'
    +'<div class="bb-note">STAT / URGENT exams require that patient must be sent down to radiology<br>'
    +'&nbsp;&nbsp;&nbsp;&nbsp;immediately and return to clinic for results after exam.</div>';
}
function openBloodBankOrders(){
  document.getElementById('om-title').textContent='Blood Bank Orders';
  var body=document.getElementById('om-menu-body');
  body.className='bb-body';
  body.innerHTML=
    '<div class="bb-note"><b>Please call the blood bank at (310) 555-0135:</b></div>'
    +'<div class="bb-bullet">-  To initiate MASSIVE TRANSFUSION PROTOCOL</div>'
    +'<div class="bb-bullet">-  For emergency issues (uncrossmatched and immediate blood need<br>&nbsp;&nbsp;&nbsp;without type and screen)</div>'
    +'<div class="bb-bullet">-  Any other concerns</div>'
    +'<div class="bb-hdr">TYPE AND SCREEN (only needed if anticipating red blood cell transfusion)</div>'
    +'<div class="bb-item om-inert">Inpatient/Pre-Op</div>'
    +'<div class="bb-item om-inert">ED, OR, ICU, Infusion Center</div>'
    +'<div class="bb-item om-inert">Outpatient</div>'
    +'<div class="bb-hdr">BLOOD PRODUCT</div>'
    +'<div class="bb-item om-inert">Red Blood Cell &nbsp;&nbsp;** Includes type and screen order **</div>'
    +'<div class="bb-item om-inert">Platelet</div>'
    +'<div class="bb-item om-inert">Fresh Frozen Plasma</div>'
    +'<div class="bb-item om-inert">Cryoprecipitate</div>'
    +'<div class="bb-item om-inert">Multiple Blood Products &nbsp;&nbsp;** Includes type and screen order **</div>'
    +'<div class="bb-hdr">OTHER BLOOD ORDERS</div>'
    +'<div class="bb-item om-inert">Rotational Thromboelastography (ROTEM)</div>'
    +'<div class="bb-item om-inert">Aspirin Platelet Inhibition</div>'
    +'<div class="bb-item om-inert">P2Y12 Platelet Inhibition</div>'
    +'<div class="bb-item om-inert">DAT (Direct Antiglobulin Test)</div>'
    +'<div class="bb-item om-inert">Blood Bank Send Out</div>';
  showFloatWin('order-menu-dlg');
  document.removeEventListener('click', _orderMenuOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _orderMenuOutsideClick); }, 0);
}
function openConsultsProcMenu(){
  document.getElementById('om-title').textContent='Consults/Procedures Order Menu';
  var body=document.getElementById('om-menu-body');
  body.className='cm-num-cols';
  body.innerHTML=consultsProcMenuCols.map(function(col){
    var h='<div class="cm-num-col">';
    col.forEach(function(e){
      if(e.blank) h+='<div class="cm-num-blank"></div>';
      else if(e.plain) h+='<div class="cm-num-plain">'+e.plain+'</div>';
      else if(e.fn) h+='<div class="cm-num-item" onclick="event.stopPropagation();'+e.fn+'()"><span class="cm-num">'+e.n+'</span><span>'+e.t+'</span></div>';
      else h+='<div class="cm-num-item om-inert"><span class="cm-num">'+e.n+'</span><span>'+e.t+'</span></div>';
    });
    return h+'</div>';
  }).join('');
  showFloatWin('order-menu-dlg');
  document.removeEventListener('click', _orderMenuOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _orderMenuOutsideClick); }, 0);
}
// Mock alphabetized inpatient formulary for "ALL OTHER INPATIENT MEDS/
// SUPPLIES" -- real CPRS's equivalent list runs into the tens of thousands
// of national-formulary entries, so this is a representative sample
// (common inpatient meds/IV fluids/supplies) rather than an exhaustive
// reproduction, generated once here rather than hand-duplicated elsewhere.
var INPT_FORMULARY=[
  '1/2 NORMAL SALINE (SODIUM CHLORIDE 0.45% INJ)','5% DEXTROSE IN WATER (D5W) INJ',
  'ACETAMINOPHEN 325MG TAB','ACETAMINOPHEN 500MG TAB','ACETAMINOPHEN IV',
  'ACETAMINOPHEN/CODEINE 300MG/30MG TAB','ALBUMIN 5% INJ','ALBUTEROL NEB SOLN',
  'ALBUTEROL/IPRATROPIUM NEB SOLN','ALLOPURINOL TAB','ALTEPLASE INJ',
  'AMIODARONE INJ','AMIODARONE TAB','AMLODIPINE TAB','AMPICILLIN-SULBACTAM INJ',
  'APIXABAN TAB','ASPART INSULIN INJ','ASPIRIN 81MG TAB','ATORVASTATIN TAB',
  'AZITHROMYCIN INJ','AZITHROMYCIN TAB','BACITRACIN OINT','BUMETANIDE INJ',
  'BUMETANIDE TAB','CALCIUM CARBONATE TAB','CAPSAICIN CREAM','CEFAZOLIN INJ',
  'CEFEPIME INJ','CEFTRIAXONE INJ','CHLORHEXIDINE ORAL RINSE','CIPROFLOXACIN TAB',
  'CLOPIDOGREL TAB','DEXTROSE 50% INJ','DIAZEPAM TAB','DICLOFENAC GEL',
  'DIGOXIN INJ','DIGOXIN TAB','DILTIAZEM INJ','DILTIAZEM TAB',
  'DIPHENHYDRAMINE INJ','DOCUSATE SODIUM CAP','DOPAMINE INJ',
  'ENOXAPARIN INJ','EPINEPHRINE INJ','ERGOCALCIFEROL CAP','ERTAPENEM INJ',
  'ESOMEPRAZOLE INJ','FAMOTIDINE INJ','FAMOTIDINE TAB','FENTANYL INJ',
  'FERROUS SULFATE TAB','FLUCONAZOLE INJ','FLUCONAZOLE TAB','FUROSEMIDE INJ',
  'FUROSEMIDE TAB','GABAPENTIN CAP','GLARGINE INSULIN INJ','GLYBURIDE TAB',
  'GUAIFENESIN TAB','HEPARIN INJ (SC)','HEPARIN INJ (IV DRIP)','HYDRALAZINE INJ',
  'HYDROCHLOROTHIAZIDE TAB','HYDROMORPHONE INJ','HYDROXYZINE TAB','IBUPROFEN TAB',
  'INSULIN REGULAR IV DRIP','IPRATROPIUM NEB SOLN','KETOROLAC INJ',
  'LACTATED RINGERS INJ','LACTULOSE SOLN','LEVETIRACETAM INJ','LEVETIRACETAM TAB',
  'LEVOFLOXACIN INJ','LEVOTHYROXINE TAB','LIDOCAINE CREAM/OINTMENT',
  'LISINOPRIL TAB','LORAZEPAM INJ','LORAZEPAM TAB','MAALOX PLUS ES SUSP',
  'MAGNESIUM OXIDE TAB','MAGNESIUM SULFATE INJ','MELATONIN TAB',
  'METFORMIN TAB','METOCLOPRAMIDE INJ','METOPROLOL INJ','METOPROLOL TAB',
  'METRONIDAZOLE INJ','METRONIDAZOLE TAB','MIDAZOLAM INJ','MORPHINE INJ',
  'MUPIROCIN OINT','NALOXONE INJ','NICOTINE PATCH','NITROGLYCERIN INJ',
  'NITROGLYCERIN SL TAB','NORMAL SALINE (0.9% SODIUM CHLORIDE) INJ',
  'OMEPRAZOLE CAP','ONDANSETRON INJ','ONDANSETRON SL TAB','OXYCODONE TAB',
  'PANTOPRAZOLE INJ','PANTOPRAZOLE TAB','PIPERACILLIN-TAZOBACTAM INJ',
  'POLYETHYLENE GLYCOL (MIRALAX) PACKET','POTASSIUM CHLORIDE INJ',
  'POTASSIUM CHLORIDE TAB','PROMETHAZINE TAB','PROPOFOL INJ',
  'RIVAROXABAN TAB','ROSUVASTATIN TAB','SENNA TAB','SERTRALINE TAB',
  'SODIUM BICARBONATE INJ','SPIRONOLACTONE TAB','SUCRALFATE SUSP',
  'TAMSULOSIN CAP','TIOTROPIUM INHALER','TRAMADOL TAB','VANCOMYCIN INJ',
  'VITAMIN D3 (CHOLECALCIFEROL) TAB','WARFARIN TAB','ZOLPIDEM TAB',
].sort();
var _imfSelected=null;
function openInptMedsFormulary(){
  _imfSelected=null;
  document.getElementById('imf-search').value='';
  document.getElementById('imf-comment').value='';
  document.getElementById('imf-ok-btn').disabled=true;
  imfRenderList(INPT_FORMULARY);
  showFloatWin('inpt-meds-formulary-dlg');
  centerFloatWin('inpt-meds-formulary-dlg');
  document.getElementById('imf-search').focus();
}
function imfRenderList(list){
  var el=document.getElementById('imf-list');
  el.scrollTop=0;
  if(!list.length){ el.innerHTML='<div style="padding:6px;color:#555;font-style:italic">No matching medications/supplies found</div>'; return; }
  el.innerHTML=list.map(function(name){
    return '<div class="imf-item" onclick="imfSelect(this,\''+name.replace(/'/g,"\\'")+'\')">'+name+'</div>';
  }).join('');
}
function imfFilter(){
  // Matches real CPRS lookup fields: strict, in-sequence prefix match only
  // (typing "AB" keeps only names starting with "AB") -- not a substring
  // match against any position in the name.
  var q=document.getElementById('imf-search').value.replace(/\s+/g,' ').trim().toUpperCase();
  var filtered=q ? INPT_FORMULARY.filter(function(n){ return n.indexOf(q)===0; }) : INPT_FORMULARY;
  imfRenderList(filtered);
  _imfSelected=null;
  document.getElementById('imf-ok-btn').disabled=true;
}
function imfSelect(el,name){
  document.querySelectorAll('.imf-item').forEach(function(x){ x.classList.remove('sel'); });
  el.classList.add('sel');
  _imfSelected=name;
  document.getElementById('imf-ok-btn').disabled=false;
}
function imfAccept(){
  if(!_imfSelected) return;
  closeWin('inpt-meds-formulary-dlg');
  document.getElementById('os-body').innerHTML='Order signed: <b>'+_imfSelected+'</b><br><br><i>(Simulation — this order was not added to the patient\'s chart.)</i>';
  showFloatWin('order-signed-dlg');
  document.removeEventListener('click', _orderSignedOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _orderSignedOutsideClick); }, 0);
}
// Mock lab test dictionary for "Order a Lab Test" -- real VistA's LAB
// file runs into the tens of thousands of entries (including odd
// administrative ones like "!!!EMPLOYEE!!!"), so this is a representative
// sample rather than an exhaustive reproduction, same convention as
// INPT_FORMULARY above. A few entries keep the real dictionary's
// "MNEMONIC   <Full Name>" display style; most just use the plain name.
var LAB_TEST_CATALOG=[
  {list:'!!!EMPLOYEE!!!',name:'!!!EMPLOYEE!!!'},
  {list:'%CD55 Deficient RBC (UOM%)',name:'%CD55 Deficient RBC (UOM%)'},
  {list:'%A1C   <HEMOGLOBIN A1C PANEL>',name:'HEMOGLOBIN A1C PANEL'},
  {list:'%FREE PSA   <PSA, FREE & TOTAL>',name:'PSA, FREE & TOTAL'},
  {list:'(1-3)-B-D-GLUCAN <FUNGITELL 1-3 BETA-D-GLUCAN>',name:'FUNGITELL 1-3 BETA-D-GLUCAN'},
  {list:'1,25-DIHYDROXY VITAMIN D [SPL]',name:'1,25-DIHYDROXY VITAMIN D'},
  {list:'11-DEOXYCORTISOL',name:'11-DEOXYCORTISOL'},
  {list:'14-3-3 PROTEIN, CSF [QST]',name:'14-3-3 PROTEIN, CSF'},
  {list:'ABG   <ARTERIAL BLOOD GAS>',name:'ARTERIAL BLOOD GAS'},
  {list:'ALBUMIN',name:'ALBUMIN'},
  {list:'ALK PHOS',name:'ALK PHOS'},
  {list:'ALT (SGPT)',name:'ALT (SGPT)'},
  {list:'AST (SGOT)',name:'AST (SGOT)'},
  {list:'B12/FOLATE',name:'B12/FOLATE'},
  {list:'BASIC METABOLIC PANEL',name:'BASIC METABOLIC PANEL'},
  {list:'BILIRUBIN, TOTAL',name:'BILIRUBIN, TOTAL'},
  {list:'BLOOD CULTURE',name:'BLOOD CULTURE'},
  {list:'BLOOD SMEAR FOR PARASITES',name:'BLOOD SMEAR FOR PARASITES'},
  {list:'BLOOD TYPE   <ABO/Rh>',name:'ABO/Rh'},
  {list:'BLOOD TYPING   <ABO/Rh>',name:'ABO/Rh'},
  {list:'BLUE   <PLATELET CNT (BLUE TOP)>',name:'PLATELET CNT (BLUE TOP)'},
  {list:'BLUE MUSSEL IgE [QST]',name:'BLUE MUSSEL IgE'},
  {list:'BMP   <BASIC METABOLIC PANEL>',name:'BASIC METABOLIC PANEL'},
  {list:'BNP PRO NT   <N-TERMINAL PRO-BNP>',name:'N-TERMINAL PRO-BNP'},
  {list:'BNP.',name:'BNP'},
  {list:'BODY FLUID EXAM, CSF',name:'BODY FLUID EXAM, CSF'},
  {list:'BODY FLUID EXAM, OTHER',name:'BODY FLUID EXAM, OTHER'},
  {list:'BUN',name:'BUN'},
  {list:'CALCIUM',name:'CALCIUM'},
  {list:'CBC   <COMPLETE BLOOD COUNT>',name:'COMPLETE BLOOD COUNT'},
  {list:'CBC W/ DIFF',name:'CBC W/ DIFF'},
  {list:'COMPREHENSIVE METABOLIC PANEL',name:'COMPREHENSIVE METABOLIC PANEL'},
  {list:'CREATININE',name:'CREATININE'},
  {list:'ESR   <ERYTHROCYTE SEDIMENTATION RATE>',name:'ERYTHROCYTE SEDIMENTATION RATE'},
  {list:'FERRITIN',name:'FERRITIN'},
  {list:'GLUCOSE',name:'GLUCOSE'},
  {list:'HEMOGLOBIN A1C',name:'HEMOGLOBIN A1C'},
  {list:'HEPATIC FUNCTION PANEL',name:'HEPATIC FUNCTION PANEL'},
  {list:'LIPASE',name:'LIPASE'},
  {list:'LIPID PANEL',name:'LIPID PANEL'},
  {list:'MAGNESIUM',name:'MAGNESIUM'},
  {list:'OCCULT BLOOD, FECES',name:'OCCULT BLOOD, FECES'},
  {list:'PHOSPHORUS',name:'PHOSPHORUS'},
  {list:'POTASSIUM',name:'POTASSIUM'},
  {list:'PT/INR',name:'PT/INR'},
  {list:'PTT',name:'PTT'},
  {list:'SODIUM',name:'SODIUM'},
  {list:'TSH',name:'TSH'},
  {list:'TYPE AND SCREEN',name:'TYPE AND SCREEN'},
  {list:'URINALYSIS',name:'URINALYSIS'},
  {list:'VITAMIN D, 25-HYDROXY',name:'VITAMIN D, 25-HYDROXY'},
];
// Auto-fills Collect Sample/Specimen from the test name -- same keyword-
// category idea as _LAB_SPECIMEN_MAP above (Orders tab row display), but a
// separate, richer mapping since this dialog shows sample/specimen as two
// distinct fields rather than one combined display string.
var _LAB_SAMPLE_MAP=[
  {re:/BLOOD CULTURE/i, sample:'BLOOD in AEROBIC/ANAEROBIC BOTTLES', specimen:'BLOOD'},
  {re:/COMPLETE BLOOD COUNT|CBC/i, sample:'BLOOD in LAVENDER-EDTA', specimen:'WHOLE BLOOD'},
  {re:/HEMOGLOBIN A1C/i, sample:'BLOOD in LAVENDER-EDTA', specimen:'WHOLE BLOOD'},
  {re:/METABOLIC PANEL|LIPID PANEL|HEPATIC FUNCTION|COMPREHENSIVE/i, sample:'BLOOD in MINT GREEN-PLAS', specimen:'PLASMA'},
  {re:/PT\/INR|PTT|COAG/i, sample:'BLOOD in LIGHT BLUE-CITRATE', specimen:'PLASMA'},
  {re:/TYPE AND SCREEN|ABO\/Rh|BLOOD TYPE/i, sample:'BLOOD in PINK-EDTA', specimen:'WHOLE BLOOD'},
  {re:/OCCULT BLOOD/i, sample:'STOOL in OC AUTO VIAL', specimen:'FECES'},
  {re:/ARTERIAL BLOOD GAS/i, sample:'BLOOD in GREEN-HEPARIN', specimen:'ARTERIAL BLOOD'},
  {re:/GLUCOSE/i, sample:'BLOOD in GRAY-FLUORIDE', specimen:'PLASMA'},
  {re:/URINALYSIS/i, sample:'URINE in STERILE CONTAINER', specimen:'URINE'},
  {re:/CSF|BODY FLUID/i, sample:'STERILE TUBE', specimen:'BODY FLUID'},
];
function _labTestSample(name){
  for(var i=0;i<_LAB_SAMPLE_MAP.length;i++){ if(_LAB_SAMPLE_MAP[i].re.test(name)) return _LAB_SAMPLE_MAP[i]; }
  return {sample:'BLOOD in GOLD-SST', specimen:'SERUM'};
}
var _loSelected=null;
function openLabOrderDlg(){
  _loSelected=null;
  document.getElementById('lo-search').value='';
  document.getElementById('lo-test-name').textContent='';
  document.getElementById('lo-sample').innerHTML='';
  document.getElementById('lo-specimen').innerHTML='';
  document.getElementById('lo-urgency').value='ROUTINE';
  document.getElementById('lo-coll-type').value='Send Patient to Lab';
  document.getElementById('lo-coll-dt').value='TODAY';
  document.getElementById('lo-how-often').value='ONE TIME';
  document.getElementById('lo-how-long').value=''; document.getElementById('lo-how-long').disabled=true;
  document.getElementById('lo-comment').value='';
  document.getElementById('lo-accept-btn').disabled=true;
  loRenderList(LAB_TEST_CATALOG);
  showFloatWin('lab-order-dlg');
  centerFloatWin('lab-order-dlg');
  document.removeEventListener('click', _loOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _loOutsideClick); }, 0);
}
function _loOutsideClick(e){
  if(typeof _tourActive!=='undefined' && _tourActive) return;
  if(_floatWinDragging) return;
  var dlg = document.getElementById('lab-order-dlg');
  if(dlg && dlg.style.display!=='none' && !dlg.contains(e.target)){
    closeWin('lab-order-dlg');
    document.removeEventListener('click', _loOutsideClick);
  }
}
function loRenderList(list){
  var el=document.getElementById('lo-list');
  el.scrollTop=0;
  if(!list.length){ el.innerHTML='<div style="padding:6px;color:#555;font-style:italic">No matching lab tests found</div>'; return; }
  el.innerHTML=list.map(function(t,i){
    return '<div class="lo-item" onclick="loSelect(this,'+i+')">'+t.list+'</div>';
  }).join('');
}
function loFilter(){
  var q=document.getElementById('lo-search').value.replace(/\s+/g,' ').trim().toUpperCase();
  var filtered=q ? LAB_TEST_CATALOG.filter(function(t){ return t.list.toUpperCase().indexOf(q)===0; }) : LAB_TEST_CATALOG;
  loRenderList(filtered);
  _loSelected=null;
  document.getElementById('lo-accept-btn').disabled=true;
}
function loSelect(el,idx){
  document.querySelectorAll('.lo-item').forEach(function(x){ x.classList.remove('sel'); });
  el.classList.add('sel');
  // idx is an index into whatever list is currently rendered (post-filter),
  // not necessarily LAB_TEST_CATALOG itself -- re-derive the actual test
  // from the rendered row's text rather than trusting a stale catalog index.
  var label=el.textContent;
  var t=LAB_TEST_CATALOG.filter(function(x){ return x.list===label; })[0];
  if(!t) return;
  _loSelected=t;
  document.getElementById('lo-test-name').textContent=t.name;
  var s=_labTestSample(t.name);
  document.getElementById('lo-sample').innerHTML='<option>'+s.sample+'</option>';
  document.getElementById('lo-specimen').innerHTML='<option>'+s.specimen+'</option>';
  document.getElementById('lo-accept-btn').disabled=false;
}
function loHowOftenChanged(){
  var howOften=document.getElementById('lo-how-often').value;
  document.getElementById('lo-how-long').disabled=(howOften==='ONE TIME');
  if(howOften==='ONE TIME') document.getElementById('lo-how-long').value='';
}
function loAcceptOrder(){
  if(!_loSelected) return;
  closeWin('lab-order-dlg');
  var s=_labTestSample(_loSelected.name);
  var collType=document.getElementById('lo-coll-type').value;
  var collDt=document.getElementById('lo-coll-dt').value;
  var msg=_loSelected.name+' — '+s.sample+' SP<br>Collection Type: <b>'+collType+'</b> &nbsp; Collection Date/Time: '+collDt;
  document.getElementById('os-body').innerHTML='Order signed: <b>'+_loSelected.name+'</b><br><br>'+msg+'<br><br><i>(Simulation — this order was not added to the patient\'s chart.)</i>';
  showFloatWin('order-signed-dlg');
  document.removeEventListener('click', _orderSignedOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _orderSignedOutsideClick); }, 0);
}
function openOrderMenu(title,cols){
  document.getElementById('om-title').textContent=title;
  var body=document.getElementById('om-menu-body');
  body.className='iw-menu-cols';
  body.innerHTML=cols.map(function(col){
    var h='<div class="iw-col">';
    col.forEach(function(e){
      if(e.blank) h+='<div class="iw-blank"></div>';
      else if(e.hr) h+='<div class="iw-hr"></div>';
      else if(e.note) h+='<div class="iw-note">'+e.note+'</div>';
      else if(e.hdr) h+='<div class="iw-grp-hdr">'+e.hdr+'</div>';
      else if(e.sub) h+='<div class="iw-sub-hdr">'+e.sub+'</div>';
      else if(e.fn) h+='<div class="iw-item" onclick="event.stopPropagation();'+e.fn+'()">'+e.item+'</div>';
      else h+='<div class="iw-item om-inert">'+e.item+'</div>';
    });
    return h+'</div>';
  }).join('');
  showFloatWin('order-menu-dlg');
  document.removeEventListener('click', _orderMenuOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _orderMenuOutsideClick); }, 0);
}
function _orderMenuOutsideClick(e){
  if(typeof _tourActive!=='undefined' && _tourActive) return;
  if(_floatWinDragging) return;
  var dlg = document.getElementById('order-menu-dlg');
  var imf = document.getElementById('inpt-meds-formulary-dlg');
  if(imf && imf.style.display!=='none' && imf.contains(e.target)) return;
  if(dlg && dlg.style.display!=='none' && !dlg.contains(e.target)){
    closeWin('order-menu-dlg');
    document.removeEventListener('click', _orderMenuOutsideClick);
  }
}
var _newOrderLabel='';
function openNewOrderDialog(label){
  _newOrderLabel=label;
  document.getElementById('no-label').textContent=label;
  showFloatWin('new-order-dlg');
  document.removeEventListener('click', _newOrderOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _newOrderOutsideClick); }, 0);
}
function _newOrderOutsideClick(e){
  if(typeof _tourActive!=='undefined' && _tourActive) return;
  if(_floatWinDragging) return;
  var dlg = document.getElementById('new-order-dlg');
  if(dlg && dlg.style.display!=='none' && !dlg.contains(e.target)){
    closeWin('new-order-dlg');
    document.removeEventListener('click', _newOrderOutsideClick);
  }
}
function signNewOrder(){
  closeWin('new-order-dlg');
  document.getElementById('os-body').innerHTML='Order signed: <b>'+_newOrderLabel+'</b><br><br><i>(Simulation — this order was not added to the patient\'s chart.)</i>';
  showFloatWin('order-signed-dlg');
  document.removeEventListener('click', _orderSignedOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _orderSignedOutsideClick); }, 0);
  var _cp = currentPt && PTS[currentPt];
  if(_cp && _cp.orders){
    _cp.orders.forEach(function(o){
      if(o.notifId && o.stat==='pending' && _newOrderLabel && o.ord.indexOf(_newOrderLabel)>-1){
        o.stat='active';
        if(typeof _resolveNotification==='function') _resolveNotification(o.notifId);
      }
    });
  }
}
function _orderSignedOutsideClick(e){
  if(typeof _tourActive!=='undefined' && _tourActive) return;
  if(_floatWinDragging) return;
  var dlg = document.getElementById('order-signed-dlg');
  if(dlg && dlg.style.display!=='none' && !dlg.contains(e.target)){
    closeWin('order-signed-dlg');
    document.removeEventListener('click', _orderSignedOutsideClick);
  }
}
function selectOrderRow(tr){
  tr.closest('table').querySelectorAll('tr.sel').forEach(function(x){x.classList.remove('sel');});
  tr.classList.add('sel');
}
// Routes an Orders-tab row's "Change..." click to the same Change.../
// Outpatient Medications popup wired up on the Meds tab. Inpatient
// Medications rows (isMed, derived from pt.meds_inpt) map directly back to
// their source med object; other medication order rows (svc:"Medication",
// plain-text orders tied to an outpatient med, e.g. Kowalski's Acetaminophen
// or Torres's pended Lisinopril) are matched to a pt.meds_home entry by
// leading drug name since they aren't stored with a direct index reference.
function _openChangeFromOrdersTab(o){
  var pt=PTS[currentPt]; if(!pt) return;
  if(o.isMed){
    var idx=pt.meds_inpt.indexOf(o.med);
    if(idx>-1) openChangeOrder('inpt',idx);
    return;
  }
  if(o.svc!=='Medication') return;
  var firstLine=(o.ord||'').split('\n')[0];
  var m=/^([A-Z][A-Z\/\-]*)/.exec(firstLine.trim());
  var drugName=m?m[1]:null;
  if(!drugName) return;
  var idx2=(pt.meds_home||[]).findIndex(function(mh){ return mh.n.toUpperCase().indexOf(drugName)===0; });
  if(idx2>-1) openChangeOrder('outpt',idx2);
}
function showOrderCtxMenu(ev,idx){
  ev.preventDefault();
  closeCtxMenu();
  var o=_ordersView[idx];
  var items=[
    {label:'Details...',fn:function(){ showOrderDetails(idx); }},
    {label:'Results...'},{label:'Results History...'},{sep:true},
    {label:'Change...',fn:function(){ if(o) _openChangeFromOrdersTab(o); }},{label:'Change Release Event'},
    {label:'Copy to New Order...'},
    {label:'Discontinue Order'},{label:'Renew...'},{sep:true},
    {label:'Park',disabled:true},{label:'Unpark - Generates a request to Fill/Refill',disabled:true},{sep:true},
    {label:'Sign...'},{sep:true},
    {label:'Flag...'},{label:'Flag Comment...'},{label:'Unflag...'},{sep:true},
    {label:'Allow Multiple Assignment',disabled:true},
  ];
  var m=document.createElement('div'); m.className='ctx-menu'; m.id='order-ctx-menu';
  items.forEach(function(it){
    if(it.sep){ var s=document.createElement('div'); s.className='ctx-sep'; m.appendChild(s); return; }
    var d=document.createElement('div'); d.className='ctx-item'+(it.disabled?' disabled':''); d.textContent=it.label;
    if(!it.disabled) d.onclick=function(e){ e.stopPropagation(); closeCtxMenu(); if(it.fn) it.fn(); };
    m.appendChild(d);
  });
  document.body.appendChild(m);
  var x=ev.pageX, y=ev.pageY;
  var maxX=window.innerWidth-m.offsetWidth-4, maxY=window.innerHeight-m.offsetHeight-4;
  m.style.left=Math.min(x,maxX)+'px'; m.style.top=Math.min(y,maxY)+'px';
  setTimeout(function(){ document.addEventListener('click',closeCtxMenu,{once:true}); },0);
  return false;
}
function closeCtxMenu(){ var m=document.getElementById('order-ctx-menu'); if(m) m.remove(); }
function showOrderDetails(idx){
  var o=_ordersView[idx]; if(!o) return;
  var dlg=document.getElementById('order-details-dlg');
  if(o.isMed){
    document.getElementById('od-title').textContent='Medication Administration Record';
    document.getElementById('od-body').textContent=buildMarText(PTS[currentPt], o.med);
    dlg.style.width='760px';
  } else {
    document.getElementById('od-title').textContent='Order Details';
    document.getElementById('od-body').textContent=o.ord+'\n\n----------------------------------------\nActivity:\n  '+o.start+'  New Order ENTERED\n  Entered by: '+o.prov+'\n  Nature of Order: ELECTRONICALLY ENTERED\n\nCurrent Status: '+o.stat.toUpperCase()+'\nOrdering Location: '+(o.loc||'')+'\nStart Date/Time: '+o.start;
    dlg.style.width='520px';
  }
  showFloatWin('order-details-dlg');
  centerFloatWin('order-details-dlg');
  document.removeEventListener('click', _orderDetailsOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _orderDetailsOutsideClick); }, 0);
}
function _orderDetailsOutsideClick(e){
  if(typeof _tourActive!=='undefined' && _tourActive) return;
  if(_floatWinDragging) return;
  var dlg = document.getElementById('order-details-dlg');
  if(dlg && dlg.style.display!=='none' && !dlg.contains(e.target)){
    closeWin('order-details-dlg');
    document.removeEventListener('click', _orderDetailsOutsideClick);
  }
}

/* ---- MAR (Medication Administration Record) ----
   Generated programmatically from each med's sig string rather than
   hand-authored per patient, so every inpatient med automatically has
   a plausible administration history without touching data.js. */
function _marSeededRand(seed){
  var s=0;
  for(var i=0;i<seed.length;i++) s=(s*31+seed.charCodeAt(i))>>>0;
  return function(){ s=(s*1664525+1013904223)>>>0; return s/4294967296; };
}
function _marParseDose(sig){
  var m=/Give:\s*([\d.]+\s?(?:MG|G|MCG|UNITS?|ML))/i.exec(sig);
  return m ? m[1].toUpperCase() : 'VARIABLE';
}
function _marIntervalHours(sig){
  var m=/Q(\d+)H/i.exec(sig);
  if(m) return parseInt(m[1],10);
  if(/BID/i.test(sig)) return 12;
  if(/TID/i.test(sig)) return 8;
  if(/QID/i.test(sig)) return 6;
  if(/AC\s*\+\s*HS|WITH MEALS/i.test(sig)) return 6;
  if(/AT BEDTIME|QHS/i.test(sig)) return 24;
  if(/DAILY|QD\b/i.test(sig)) return 24;
  if(/CONTINUOUS/i.test(sig)) return 4;
  return 12;
}
function buildMarRows(pt, med, anchorDate){
  var isPRN=/PRN/i.test(med.sig);
  var dose=_marParseDose(med.sig);
  var rand=_marSeededRand(pt.name+'|'+med.n);
  var initialsPool=['PAS','ETT','ysk','AWM','MVG','sjpc','MR','jcw','tlh'];
  var rows=[];
  if(isPRN){
    var count=2+Math.floor(rand()*3); // 2-4 entries
    var hoursAgo=0;
    for(var i=0;i<count;i++){
      hoursAgo += 6 + Math.floor(rand()*36); // irregular spacing, 6-42h apart
      var d=new Date(anchorDate.getTime() - hoursAgo*3600000);
      rows.push({dt:d, dose:dose, by:initialsPool[Math.floor(rand()*initialsPool.length)], prn:true});
    }
  } else {
    var interval=_marIntervalHours(med.sig);
    var n=6;
    for(var j=0;j<n;j++){
      var d2=new Date(anchorDate.getTime() - j*interval*3600000);
      rows.push({dt:d2, dose:dose, by:initialsPool[Math.floor(rand()*initialsPool.length)], prn:false});
    }
  }
  return {rows:rows, isPRN:isPRN, interval: isPRN?null:_marIntervalHours(med.sig)};
}
function _marFmtDate(d){
  var months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  var hh=('0'+d.getHours()).slice(-2), mm=('0'+d.getMinutes()).slice(-2);
  return months[d.getMonth()]+' '+('0'+d.getDate()).slice(-2)+', '+d.getFullYear()+'@'+hh+':'+mm;
}
function buildMarText(pt, med){
  var anchor = new Date(2026, 5, 20, 9, 0); // fictional "now" — Jun 20, 2026 09:00, matches app's sim date
  if(pt.vitals && pt.vitals.length){
    var m=/(\d{2})\/(\d{2}) (\d{2}):(\d{2})/.exec(pt.vitals[0].dt);
    if(m) anchor=new Date(2026, parseInt(m[1],10)-1, parseInt(m[2],10), parseInt(m[3],10), parseInt(m[4],10));
  }
  var built=buildMarRows(pt, med, anchor);
  var allergyList=(pt.allergies&&pt.allergies.length) ? pt.allergies.map(function(a){return a.agent;}).join(', ') : 'None';
  var lines=[
    'Allergies: '+allergyList+'    Remote Allergies: None',
    '====================================================================',
    '',
    med.n,
    '  '+med.sig+(med.ind?('  ('+med.ind+')'):''),
    '  Schedule Type: '+(built.isPRN?'PRN':'Continuous'+(built.interval?(' (every '+built.interval+'h)'):'')),
    '',
    '--------------------------------------------------------------------',
  ];
  built.rows.forEach(function(r){
    lines.push('  Administration Date: '+_marFmtDate(r.dt));
    lines.push('    Status: Given            Schedule Type: '+(r.prn?'PRN':'Continuous'));
    lines.push('    Units Ordered: '+r.dose+'       Units GIVEN: '+r.dose);
    if(r.prn) lines.push('    PRN Reason: '+(med.ind||'Per protocol'));
    lines.push('    Administered By: '+r.by);
    lines.push('');
  });
  if(!built.rows.length) lines.push('  No administrations recorded in the displayed period.');
  return lines.join('\n');
}

