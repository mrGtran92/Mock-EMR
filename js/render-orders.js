var _ordersView = [];
// Real CPRS's order list view doesn't show the ordering indication/reason,
// or a [COMPLETED]/[PENDING]/etc. status tag, inline in the order-name
// column -- indication is only visible via right-click -> Details, and
// status belongs solely in the dedicated Status column. This strips both
// for the row display only; the full o.ord string (including both) is
// still used untouched by showOrderDetails() for the Details popup.
var _ORD_STATUS_TAG_RE=/\[(COMPLETED|PENDING|ACTIVE|DISCONTINUED|CANCELLED|DC)\]/;
function _ordListText(ord){
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
function renderOrders(pt){
  document.getElementById('left-pane').style.display='none';
  document.getElementById('right-pane').style.display='none';
  var mp=document.getElementById('main-panes');
  var outer=document.createElement('div'); outer.id='orders-outer';
  var left=document.createElement('div'); left.id='orders-left';
  var ll=document.createElement('div'); ll.id='orders-left-list';
  var menuItems=[
    {label:'Active Orders (incl. Pending & Recent Activity)',sel:true},
    {sep:'Write Delayed Orders'},{label:'Write Orders'},{label:'Allergies'},
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
    if(item.sep!==undefined){ d.className='ol-sep'; d.textContent=item.sep; }
    else { d.className='ol-item'+(item.sel?' sel':''); d.textContent=item.label;
      d.onclick=function(){
        ll.querySelectorAll('.ol-item').forEach(function(x){x.classList.remove('sel');}); d.classList.add('sel');
        if(item.label==='INPATIENT WARDS Order Menu') openOrderMenu('INPATIENT WARDS Order Menu',inptWardsMenuCols);
        if(item.label==='WLA Primary Care Order Menu') openOrderMenu('WLA Primary Care Order Menu',primaryCareMenuCols);
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
  _ordersView.forEach(function(o,i){
    var svcCell=o.svc!==lastSvc?'<td class="svc-cell">'+o.svc+'</td>':'<td></td>';
    lastSvc=o.svc;
    var statusText=_ordStatusText(o);
    var isPending=statusText==='pending';
    html+='<tr onclick="selectOrderRow(this)" oncontextmenu="return showOrderCtxMenu(event,'+i+')">'+svcCell+'<td style="white-space:pre-wrap'+(isPending?';color:#0000cc':'')+'">'+_ordListText(o.ord)+'</td><td style="font-size:10px">'+o.start+'</td><td style="font-size:10px">'+_ordProviderText(o.prov)+'</td><td></td><td></td><td></td><td style="font-size:10px">'+statusText+'</td><td style="font-size:10px">'+(o.loc||'')+'</td></tr>';
  });
  html+='</tbody></table>';
  tableWrap.innerHTML=html; right.appendChild(tableWrap); outer.appendChild(right);
  mp.appendChild(outer);
  makeColumnsResizable(document.getElementById('orders-tbl'));
}
var inptWardsMenuCols=[
  [
    {hdr:'INPATIENT WARD ORDER MENUS'},
    {item:'Internal Medicine and Geriatrics Inpatient Menu'},{item:'Cardiology Inpatient Menu'},
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
function openOrderMenu(title,cols){
  document.getElementById('om-title').textContent=title;
  var body=document.getElementById('om-menu-body');
  body.innerHTML=cols.map(function(col){
    var h='<div class="iw-col">';
    col.forEach(function(e){
      if(e.hdr) h+='<div class="iw-grp-hdr">'+e.hdr+'</div>';
      else if(e.sub) h+='<div class="iw-sub-hdr">'+e.sub+'</div>';
      else h+='<div class="iw-item" onclick="closeWin(\'order-menu-dlg\'); openNewOrderDialog(\''+e.item.replace(/'/g,"\\'")+'\')">'+e.item+'</div>';
    });
    return h+'</div>';
  }).join('');
  showFloatWin('order-menu-dlg');
}
var _newOrderLabel='';
function openNewOrderDialog(label){
  _newOrderLabel=label;
  document.getElementById('no-label').textContent=label;
  showFloatWin('new-order-dlg');
}
function signNewOrder(){
  closeWin('new-order-dlg');
  document.getElementById('os-body').innerHTML='Order signed: <b>'+_newOrderLabel+'</b><br><br><i>(Simulation — this order was not added to the patient\'s chart.)</i>';
  showFloatWin('order-signed-dlg');
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
function selectOrderRow(tr){
  tr.closest('table').querySelectorAll('tr.sel').forEach(function(x){x.classList.remove('sel');});
  tr.classList.add('sel');
}
function showOrderCtxMenu(ev,idx){
  ev.preventDefault();
  closeCtxMenu();
  var o=_ordersView[idx];
  var items=[
    {label:'Details...',fn:function(){ showOrderDetails(idx); }},
    {label:'Results...'},{label:'Results History...'},{sep:true},
    {label:'Change...'},{label:'Change Release Event'},
    {label:'Copy to New Order...',fn:function(){ if(o) openNewOrderDialog(o.isMed?o.med.n:o.ord.split('\n')[0]); }},
    {label:'Discontinue Order'},{label:'Renew...'},{sep:true},
    {label:'Park',disabled:true},{label:'Unpark - Generates a request to Fill/Refill',disabled:true},{sep:true},
    {label:'Sign...',fn:function(){ if(o){ _newOrderLabel=o.isMed?o.med.n:o.ord.split('\n')[0]; signNewOrder(); } }},{sep:true},
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

