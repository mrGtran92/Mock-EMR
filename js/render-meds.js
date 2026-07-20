// Real CPRS computes Expires as one calendar year from the date the Rx was
// originally ordered -- NOT from Last Filled (a med can be refilled many
// times without ever resetting its expiration). This app didn't track an
// order date at all before now; every meds_home entry got a new ordDate
// field so Expires can be computed here instead of always rendering blank.
function _medExpires(ordDate){
  var m=/^(\d{2}\/\d{2}\/)(\d{4})$/.exec(ordDate||'');
  return m ? (m[1]+(parseInt(m[2],10)+1)) : '';
}
function renderMeds(pt){
  document.getElementById('left-pane').style.display='none';
  document.getElementById('rp-hdr').style.display='none';
  var rpBody=document.getElementById('rp-body');
  rpBody.className='rp-body grid';
  rpBody.style.padding='0'; rpBody.style.overflow='hidden';
  rpBody.style.display='flex'; rpBody.style.flexDirection='column';
  var html='<div class="meds-sort-bar">Sort by Status/Exp. Date (Clinic Orders first on Inpt)</div>';

  html+='<div id="meds-outpt-sec" class="meds-sec-flex">';
  html+='<div class="meds-sec-hdr">Outpatient Medications <span class="meds-range">Date Range: Apr 01, 2026 - Jun 29, 2026</span></div>';
  html+='<table class="meds-tbl" id="meds-home-tbl"><thead><tr>'
    +'<th style="width:60px">Action</th>'
    +'<th>Outpatient Medications<span class="col-resize-handle"></span></th>'
    +'<th style="width:90px">Expires<span class="col-resize-handle"></span></th>'
    +'<th style="width:80px">Status<span class="col-resize-handle"></span></th>'
    +'<th style="width:90px">Last Filled<span class="col-resize-handle"></span></th>'
    +'<th style="width:110px">Refills Remaining</th>'
    +'</tr></thead><tbody>';
  if(pt.meds_home.length){ pt.meds_home.forEach(function(m,i){
    html+='<tr onclick="selectMedsRow(this)" oncontextmenu="return showMedsCtxMenu(event,\'outpt\','+i+')"><td></td><td><span class="med-name">'+m.n+'</span><span class="med-sig">'+m.sig+'</span></td><td>'+_medExpires(m.ordDate)+'</td><td>'+m.stat+'</td><td>'+m.lf+'</td><td>'+(m.ref||'')+'</td></tr>';
  });} else html+='<tr><td></td><td colspan="5" style="color:#555;font-style:italic;padding:4px 6px">No Active Outpatient Medications Found</td></tr>';
  html+='</tbody></table>';
  html+='</div>';

  html+='<div id="meds-bar-nonva" class="meds-vresizer" title="Drag to resize"></div>';
  html+='<div id="meds-nonva-sec" class="meds-sec-resizable">';
  html+='<div class="meds-sec-hdr">Non-VA Medications <span class="meds-range">Date Range: Apr 01, 2026 - Jun 29, 2026</span></div>';
  html+='<table class="meds-tbl" id="meds-nonva-tbl"><thead><tr>'
    +'<th style="width:60px">Action</th>'
    +'<th>Non-VA Medications (Documentation)<span class="col-resize-handle"></span></th>'
    +'<th style="width:90px">Start Date<span class="col-resize-handle"></span></th>'
    +'<th style="width:80px">Status</th>'
    +'</tr></thead><tbody>';
  html+='<tr><td></td><td colspan="3" style="color:#555;font-style:italic;padding:4px 6px">No Non-VA Medications Found</td></tr></tbody></table>';
  html+='</div>';

  html+='<div id="meds-bar-inpt" class="meds-vresizer" title="Drag to resize"></div>';
  html+='<div id="meds-inpt-sec" class="meds-sec-resizable">';
  html+='<div class="meds-sec-hdr">Inpatient Medications <span class="meds-range">Date Range: Apr 01, 2026 - Jun 29, 2026</span></div>';
  html+='<table class="meds-tbl" id="meds-inpt-tbl"><thead><tr>'
    +'<th style="width:60px">Action</th>'
    +'<th>Inpatient Medications<span class="col-resize-handle"></span></th>'
    +'<th style="width:90px">Stop Date<span class="col-resize-handle"></span></th>'
    +'<th style="width:90px">Status<span class="col-resize-handle"></span></th>'
    +'<th style="width:90px">Location</th>'
    +'</tr></thead><tbody>';
  pt.meds_inpt.forEach(function(m,i){
    var isDisc=m.stat==='DISCONTINUED';
    var rowStyle=isDisc?' style="background:#f6f6f6"':'';
    var nameStyle=isDisc?' style="color:#888"':'';
    var tag=isDisc?' [DISCONTINUED]':'';
    html+='<tr'+rowStyle+' onclick="selectMedsRow(this)" oncontextmenu="return showMedsCtxMenu(event,\'inpt\','+i+')"><td></td><td><span class="med-name"'+nameStyle+'>'+m.n+tag+'</span><span class="med-sig">'+m.sig+'</span><span class="med-ind">Indication: '+m.ind+'</span></td><td>'+(m.stop||'')+'</td><td>'+m.stat+'</td><td>'+(pt.ward||'')+'</td></tr>';
  });
  html+='</tbody></table>';
  html+='</div>';

  rpBody.innerHTML=html;
  ['meds-home-tbl','meds-nonva-tbl','meds-inpt-tbl'].forEach(function(id){
    var tbl=document.getElementById(id); if(tbl) makeColumnsResizable(tbl);
  });
  // Each bar only ever affects its two immediate neighbors -- the section
  // directly below it (grows/shrinks by the drag) and the section directly
  // above it (complements that change). Outpatient is the exception: it's
  // flex:1 with no explicit height, so it silently self-adjusts whenever
  // Non-VA's bar changes Non-VA's height -- no shrinkEl needed for that bar.
  // The Inpatient bar's "above" neighbor is Non-VA (not Outpatient), so
  // dragging it trades space with Non-VA directly, the same way the Non-VA
  // bar trades space with Outpatient -- neither bar ever reaches past its
  // immediate neighbor.
  makeMedsSectionResizable(document.getElementById('meds-bar-nonva'), document.getElementById('meds-nonva-sec'), null);
  makeMedsSectionResizable(document.getElementById('meds-bar-inpt'), document.getElementById('meds-inpt-sec'), document.getElementById('meds-nonva-sec'));
}

// Full-width horizontal drag bar (matches real CPRS, not a corner resize
// handle), sitting directly above growEl. Dragging it up grows growEl (and
// shrinks shrinkEl by the same amount, if given); dragging it down does the
// reverse. Pass shrinkEl:null when the section above is the flexible
// Outpatient panel, which self-adjusts without needing an explicit height.
function makeMedsSectionResizable(barEl, growEl, shrinkEl){
  if(!barEl || !growEl) return;
  barEl.onmousedown=function(e){
    e.preventDefault();
    var startY=e.clientY, startGrowH=growEl.offsetHeight, startShrinkH=shrinkEl?shrinkEl.offsetHeight:0;
    var minH=44, maxH=Math.round(window.innerHeight*0.7);
    document.onmousemove=function(e){
      var newGrowH=Math.max(minH,Math.min(maxH,startGrowH-(e.clientY-startY)));
      if(shrinkEl){
        var newShrinkH=startShrinkH-(newGrowH-startGrowH);
        if(newShrinkH<minH){ newGrowH=startGrowH+(startShrinkH-minH); newShrinkH=minH; }
        shrinkEl.style.height=newShrinkH+'px';
      }
      growEl.style.height=newGrowH+'px';
    };
    document.onmouseup=function(){ document.onmousemove=null; document.onmouseup=null; };
  };
}

/* ---- Right-click context menu on Meds tab rows ----
   Same menu shape regardless of section (Outpatient/Non-VA/Inpatient), per
   real CPRS. Only "Renew..." is wired for now -- Change/Refill/etc. will
   follow in later passes once their own workflows are specced. Details.../
   Administration History.../Discontinue Order.../Document Non-VA Meds/New
   Medication... render normally (not greyed) but are no-ops, matching the
   existing convention on the Orders tab's context menu (showOrderCtxMenu)
   where only permission-gated items like Park/Unpark are visually
   disabled. */
function selectMedsRow(tr){
  document.querySelectorAll('table.meds-tbl tr.sel').forEach(function(x){x.classList.remove('sel');});
  tr.classList.add('sel');
}
function showMedsCtxMenu(ev,section,idx){
  ev.preventDefault();
  closeMedsCtxMenu();
  var tr=ev.currentTarget || ev.target.closest('tr');
  if(tr) selectMedsRow(tr);
  var items=[
    {label:'Details...'},
    {label:'Administration History...'},{sep:true},
    {label:'Change...',fn:function(){ openChangeOrder(section,idx); }},
    {label:'Discontinue Order...'},
    {label:'Refill...'},
    {label:'Renew...',fn:function(){ openRenewOrders(section,idx); }},{sep:true},
    {label:'Document Non-VA Meds'},{sep:true},
    {label:'New Medication...'},{sep:true},
    {label:'Park',disabled:true},
    {label:'Unpark - Generates a request to Fill/Refill',disabled:true},
  ];
  var m=document.createElement('div'); m.className='ctx-menu'; m.id='meds-ctx-menu';
  items.forEach(function(it){
    if(it.sep){ var s=document.createElement('div'); s.className='ctx-sep'; m.appendChild(s); return; }
    var d=document.createElement('div'); d.className='ctx-item'+(it.disabled?' disabled':''); d.textContent=it.label;
    if(!it.disabled) d.onclick=function(e){ e.stopPropagation(); closeMedsCtxMenu(); if(it.fn) it.fn(); };
    m.appendChild(d);
  });
  document.body.appendChild(m);
  var x=ev.pageX, y=ev.pageY;
  var maxX=window.innerWidth-m.offsetWidth-4, maxY=window.innerHeight-m.offsetHeight-4;
  m.style.left=Math.min(x,maxX)+'px'; m.style.top=Math.min(y,maxY)+'px';
  setTimeout(function(){ document.addEventListener('click',_medsCtxOutsideClick,{once:true}); },0);
  return false;
}
function closeMedsCtxMenu(){ var m=document.getElementById('meds-ctx-menu'); if(m) m.remove(); }
// Separate from closeMedsCtxMenu() itself (which tour code also calls
// directly to force-close the menu between steps) -- this guard only
// applies to the passive outside-click listener, same pattern used
// elsewhere in the app (_piOutsideClick, _pactOutsideClick, etc.) so a
// tour step's own card/backdrop clicks don't blow away a menu the tour
// just spotlighted.
function _medsCtxOutsideClick(){
  if(typeof _tourActive!=='undefined' && _tourActive) return;
  closeMedsCtxMenu();
}

/* ---- Renew Orders / Change Refills for Outpatient Medication ----
   Neither pt.meds_home nor pt.meds_inpt entries in data.js carry explicit
   qty/days-supply/refill-count/pick-up fields yet -- _medRenewDefaults()
   fills in plausible values (and reads real ones once data.js adds them,
   e.g. m.qty/m.days/m.pickup) so this works today without a data.js pass.
   Working state (_renewState) only lives in memory while the dialog
   sequence is open, matching the app's decorative-but-state-aware
   simulated-order convention (see openNewOrderDialog/signNewOrder in
   render-orders.js) -- nothing is written back to pt.meds_home/meds_inpt,
   and it resets on reload. */
var _renewState=null;
function _medRenewDefaults(m){
  var refills=parseInt(m.ref,10);
  return {
    qty: m.qty || 30,
    days: m.days || 90,
    refills: isNaN(refills) ? 0 : refills,
    ind: m.ind || '',
    pickup: m.pickup || 'Mail',
  };
}
function _pickupLabel(pickup){
  if(pickup==='Window') return 'At Window';
  if(pickup==='Park') return 'Park';
  return 'by Mail';
}
function openRenewOrders(section,idx){
  var pt=PTS[currentPt];
  var m = section==='outpt' ? pt.meds_home[idx] : pt.meds_inpt[idx];
  if(!m) return;
  var d=_medRenewDefaults(m);
  _renewState={section:section, idx:idx, med:m, qty:d.qty, days:d.days, refills:d.refills, ind:d.ind, pickup:d.pickup};
  renderRenewBox();
  showFloatWin('renew-orders-dlg');
  centerFloatWin('renew-orders-dlg');
}
function renderRenewBox(){
  var s=_renewState; if(!s) return;
  var html = s.med.n+'<br>'+s.med.sig+'<br>Quantity: '+s.qty+' Refills: '+s.refills;
  if(s.ind) html += '<br>Indication: '+s.ind+' (deliver '+_pickupLabel(s.pickup)+')';
  document.getElementById('ro-box').innerHTML=html;
}
function signRenewOrder(){
  var s=_renewState; if(!s) return;
  closeWin('renew-orders-dlg');
  showFloatWin('meds-sim-notice-dlg');
  centerFloatWin('meds-sim-notice-dlg');
  _renewState=null;
}
function openChangeRefills(){
  var s=_renewState; if(!s) return;
  document.getElementById('cr-summary').textContent = s.med.n+'\n'+s.med.sig+(s.ind?('\nIndication: '+s.ind):'');
  document.getElementById('cr-days').value=s.days;
  document.getElementById('cr-qty').value=s.qty;
  document.getElementById('cr-refills').value=s.refills;
  document.getElementById('cr-pickup').value=s.pickup;
  showFloatWin('change-refills-dlg');
  centerFloatWin('change-refills-dlg');
}
function applyChangeRefills(){
  var s=_renewState; if(!s) return;
  s.days = document.getElementById('cr-days').value || s.days;
  s.qty = document.getElementById('cr-qty').value || s.qty;
  s.refills = document.getElementById('cr-refills').value || s.refills;
  s.pickup = document.getElementById('cr-pickup').value;
  renderRenewBox();
  closeWin('change-refills-dlg');
}

/* ---- Change... / Outpatient Medications order-entry dialog ----
   This is the same "order a medication from scratch" popup that the
   future Orders-tab build-out will reuse (per plan, function names are
   kept generic -- openChangeOrder, not openChangeRx -- so that hookup
   doesn't require renaming). Dosage/price/tier options and the schedule
   list are generated algorithmically rather than hand-authored per drug,
   same convention as buildMarRows() in render-orders.js -- real per-drug
   formulary accuracy isn't the point, teaching the interaction pattern
   (schedule -> auto Qty calc, PRN suppressing that calc) is. Confirmed
   with the user: the Schedule list itself is one fixed master list that
   never changes based on PRN -- only the Qty auto-calc behavior does. */
var SCHEDULE_LIST=[
  '5XD-WHILE AWAKE','6XD-WHILE AWAKE','8XD-WHILE AWAKE','ACTID','BID','BID (DIURETIC)','BID AC',
  'CONTINUOUS VIA PUMP','NOW','ON-CALL','ONCE',
  'Q10DAYS','Q10MIN PRN','Q12H','Q12WEEKS','Q13WEEKS','Q15DAYS','Q15MIN PRN','Q18H',
  'Q1H','Q1MIN','Q24H','Q2H','Q2MIN PRN','Q2MONTHS','Q2WEEKS',
  'Q3H','Q3MIN','Q3MONTHS','Q3WEEKS',
  'Q48H','Q4H','Q4WEEKS',
  'Q5DAYS','Q5MIN','Q5MIN PRN','Q5WEEKS',
  'Q6H','Q6MIN PRN','Q6MONTHS','Q6WEEKS',
  'Q72H','Q8H','Q8WEEKS','Q9WEEKS',
  'QAM (INSULIN)','QAM','QDAY','QDAY AC','QHS','QHS (INSULIN)','QID',
  'QMONTH','QNOON','QOD (EVERY OTHER DAY)','QPM','QPM (INSULIN)','QWEEK',
  'SLIDING SCALE','TID','TID AC','TID AC&HS','TID AC&HS (INSULIN)','TIW','UD',
];
var _SCHED_DOSES_PER_DAY={
  'QDAY':1,'QAM':1,'QPM':1,'QHS':1,'QAM (INSULIN)':1,'QHS (INSULIN)':1,'QPM (INSULIN)':1,
  'BID':2,'BID (DIURETIC)':2,'BID AC':2,'TID':3,'TID AC':3,'TID AC&HS':4,'TID AC&HS (INSULIN)':4,'QID':4,
  'Q4H':6,'Q6H':4,'Q8H':3,'Q12H':2,'Q3H':8,'Q2H':12,'Q1H':24,'Q24H':1,'Q48H':0.5,'Q72H':1/3,
  'QWEEK':1/7,'QOD (EVERY OTHER DAY)':0.5,'TIW':3/7,'QDAY AC':1,'QNOON':1,'QMONTH':1/30,
  'ONCE':0,'NOW':0,'ON-CALL':0,'SLIDING SCALE':0,'CONTINUOUS VIA PUMP':0,
};
var _SCHED_HUMAN={
  'QDAY':'EVERY DAY','QAM':'EVERY MORNING','QPM':'EVERY EVENING','QHS':'AT BEDTIME',
  'QAM (INSULIN)':'EVERY MORNING','QHS (INSULIN)':'AT BEDTIME','QPM (INSULIN)':'EVERY EVENING',
  'BID':'TWICE A DAY','BID (DIURETIC)':'TWICE A DAY (MORNING AND EVENING)','BID AC':'TWICE A DAY BEFORE MEALS',
  'TID':'THREE TIMES A DAY','TID AC':'THREE TIMES A DAY BEFORE MEALS',
  'TID AC&HS':'THREE TIMES A DAY BEFORE MEALS AND AT BEDTIME','TID AC&HS (INSULIN)':'THREE TIMES A DAY BEFORE MEALS AND AT BEDTIME',
  'QID':'FOUR TIMES A DAY','Q4H':'EVERY 4 HOURS','Q6H':'EVERY 6 HOURS','Q8H':'EVERY 8 HOURS','Q12H':'EVERY 12 HOURS',
  'Q24H':'EVERY 24 HOURS','Q48H':'EVERY 48 HOURS','Q72H':'EVERY 72 HOURS',
  'QWEEK':'EVERY WEEK','QOD (EVERY OTHER DAY)':'EVERY OTHER DAY','TIW':'THREE TIMES A WEEK',
  'QDAY AC':'EVERY DAY BEFORE MEALS','QNOON':'AT NOON','QMONTH':'EVERY MONTH',
  'ONCE':'ONCE','NOW':'NOW','ON-CALL':'ON-CALL','SLIDING SCALE':'PER SLIDING SCALE','UD':'AS DIRECTED',
  'CONTINUOUS VIA PUMP':'CONTINUOUSLY VIA PUMP',
};
function _scheduleDosesPerDay(code){ var v=_SCHED_DOSES_PER_DAY[code]; return v===undefined?1:v; }
function _scheduleHuman(code){ return _SCHED_HUMAN[code] || ('PER SCHEDULE ('+code+')'); }
function _guessScheduleFromSig(sig){
  var s=(sig||'').toUpperCase();
  if(/Q4H/.test(s)) return 'Q4H';
  if(/Q6H/.test(s)) return 'Q6H';
  if(/Q8H/.test(s)) return 'Q8H';
  if(/Q12H/.test(s)) return 'Q12H';
  if(/QID/.test(s)) return 'QID';
  if(/TID/.test(s)) return 'TID';
  if(/BID/.test(s)) return 'BID';
  if(/AT BEDTIME|QHS/.test(s)) return 'QHS';
  if(/EVERY OTHER DAY/.test(s)) return 'QOD (EVERY OTHER DAY)';
  if(/WEEKLY|EVERY WEEK/.test(s)) return 'QWEEK';
  return 'QDAY';
}
function _medRouteOptions(sig){
  var s=(sig||'').toUpperCase();
  if(/INJECT|\bSC\b|SUBQ/.test(s)) return ['SC'];
  if(/\bIV\b/.test(s)) return ['IV'];
  if(/\bIM\b/.test(s)) return ['IM'];
  if(/INHAL/.test(s)) return ['INHALATION'];
  if(/TOPICAL|APPLY/.test(s)) return ['TOPICAL'];
  return ['ORAL'];
}
// Tablets only actually exist in specific manufactured strengths -- a
// "1000MG" dosage option doesn't mean a 1000MG tablet exists, it means two
// 500MG tablets. _tabletBreakdown() maps a chosen total dose back onto real
// tablet strengths so the preview sig can say "TAKE 2 TABLETS" instead of
// implying a single tablet of that size. Acetaminophen gets a curated real
// strength list (250/500/650MG, matching actual OTC Tylenol); other drugs
// fall back to treating their own named strength as the only real tablet
// size, so any ladder multiple of it is expressed the same way.
var _DOSE_OVERRIDES=[
  {re:/ACETAMINOPHEN/, strengths:[250,500,650], ladder:[250,500,650,1000]},
];
function _tabletBreakdown(v,strengths){
  if(!strengths || !strengths.length) return {count:1,unit:v};
  if(strengths.indexOf(v)!==-1) return {count:1,unit:v};
  for(var i=strengths.length-1;i>=0;i--){
    var s=strengths[i];
    if(s>0 && v%s===0){ var n=v/s; if(n>=1 && n<=4) return {count:n,unit:s}; }
  }
  return {count:1,unit:v};
}
function _medDosageOptions(m){
  var match=/([\d.]+)\s*(MG|MCG|G|ML|UNITS?)\b/i.exec(m.n);
  var val=match?parseFloat(match[1]):null;
  var unit=match?match[2].toUpperCase():'MG';
  var override=_DOSE_OVERRIDES.filter(function(o){ return o.re.test(m.n); })[0];
  var ladder, tabletStrengths;
  if(override){
    ladder=override.ladder; tabletStrengths=override.strengths;
  } else if(val==null){
    ladder=[0]; tabletStrengths=[];
  } else {
    ladder=[0.5,1,2].map(function(mult){
      var v=val*mult;
      return v>=1 ? Math.round(v*100)/100 : Math.round(v*1000)/1000;
    });
    ladder=Array.from(new Set(ladder)).sort(function(a,b){return a-b;});
    tabletStrengths=[val];
  }
  var rand=_marSeededRand(m.n);
  return ladder.map(function(v){
    var price='$'+(0.01+rand()*2).toFixed(3);
    var tier='Tier '+(1+Math.floor(rand()*3));
    var tb=_tabletBreakdown(v,tabletStrengths);
    var headerLabel=(val==null?'(dose not specified)':(tb.unit+unit));
    // The Dosage list itself just shows the plain total-dose value (e.g.
    // "1000MG"), matching real CPRS -- the real-tablet breakdown (e.g.
    // "TAKE 2 TABLETS" of the 500MG strength) only surfaces afterward, in
    // the order header/sig preview built by buildChangeOrderPreview().
    var listLabel = v+unit;
    return {label:listLabel, headerLabel:headerLabel, value:v, unit:unit, price:price, tier:tier,
      current:(val!=null && v===val), tabletCount:tb.count, tabletUnit:tb.unit};
  });
}
// Ordered most-specific-first; each entry is a real clinical indication for
// that drug/class, not a generic "FOR <drug name>" guess. Covers every
// medication currently in data.js (meds_home/meds_inpt across all
// patients) plus a few extras seen in reference screenshots. Anything
// unmapped intentionally falls through to a blank Indication (just "Other
// (See Comments)") rather than fabricating a guess, per the user's
// explicit instruction.
var _IND_MAP=[
  {re:/CALCIUM/,opts:['FOR CALCIUM REPLACEMENT','FOR INDIGESTION']},
  {re:/EMPAGLIFLOZIN|JARDIANCE|METFORMIN|GLIPIZIDE|\bINSULIN\b/,opts:['FOR DIABETES']},
  {re:/METOPROLOL|CARVEDILOL/,opts:['FOR BLOOD PRESSURE','FOR THE HEART']},
  {re:/LISINOPRIL|AMLODIPINE|LOSARTAN|\bVALSARTAN\b|SACUBITRIL/,opts:['FOR BLOOD PRESSURE']},
  {re:/ATORVASTATIN|ROSUVASTATIN|SIMVASTATIN|ALIROCUMAB/,opts:['FOR CHOLESTEROL']},
  {re:/BUMETANIDE|FUROSEMIDE|SPIRONOLACTONE/,opts:['FOR FLUID RETENTION (WATER PILL)']},
  {re:/NAPROXEN|DICLOFENAC/,opts:['FOR PAIN','FOR INFLAMMATION']},
  {re:/ACETAMINOPHEN/,opts:['FOR PAIN','FOR FEVER']},
  {re:/MORPHINE/,opts:['FOR PAIN']},
  {re:/CYCLOBENZAPRINE/,opts:['FOR MUSCLE SPASM']},
  {re:/DARBEPOETIN/,opts:['FOR ANEMIA']},
  {re:/ALBUTEROL\/IPRATROPIUM|ALBUTEROL|TIOTROPIUM|SPIRIVA|FLUTICASONE\/SALMETEROL|ADVAIR/,opts:['FOR SHORTNESS OF BREATH']},
  {re:/ALENDRONATE/,opts:['FOR OSTEOPOROSIS']},
  {re:/ALLOPURINOL/,opts:['FOR GOUT']},
  {re:/ASPIRIN/,opts:['FOR HEART ATTACK/STROKE PREVENTION']},
  {re:/AZITHROMYCIN|CEFTRIAXONE|PIPERACILLIN/,opts:['FOR INFECTION']},
  {re:/DEXTROSE/,opts:['FOR LOW BLOOD SUGAR']},
  {re:/DOCUSATE|\bSENNA\b/,opts:['FOR CONSTIPATION']},
  {re:/ENOXAPARIN|HEPARIN|RIVAROXABAN/,opts:['FOR BLOOD CLOT PREVENTION']},
  {re:/FLECAINIDE/,opts:['FOR IRREGULAR HEARTBEAT']},
  {re:/METHYLPREDNISOLONE/,opts:['FOR INFLAMMATION']},
  {re:/OMEPRAZOLE|PANTOPRAZOLE/,opts:['FOR ACID REFLUX']},
  {re:/ONDANSETRON/,opts:['FOR NAUSEA']},
  {re:/SERTRALINE/,opts:['FOR DEPRESSION/ANXIETY']},
];
function _medIndicationOptions(name){
  var n=name.toUpperCase();
  for(var i=0;i<_IND_MAP.length;i++){ if(_IND_MAP[i].re.test(n)) return _IND_MAP[i].opts.concat(['OTHER (SEE COMMENTS)']); }
  return ['OTHER (SEE COMMENTS)'];
}
function _medInfoNote(name){
  var n=name.toUpperCase();
  if(/CHEWABLE/.test(n)) return 'CHEWABLE TABLET; MAIL OUT ONLY';
  if(/\bSA\b|EXTENDED RELEASE|\bXR\b/.test(n)) return '[EXTENDED RELEASE]';
  return '';
}
function _medComboNote(name){
  if(/EMPAGLIFLOZIN/i.test(name)) return 'If on metformin too, use combo Synjardy or Synjardy XR';
  return '';
}

var _changeState=null;
function openChangeOrder(section,idx){
  var pt=PTS[currentPt];
  var m = section==='outpt' ? pt.meds_home[idx] : pt.meds_inpt[idx];
  if(!m) return;
  var d=_medRenewDefaults(m);
  var doseOpts=_medDosageOptions(m);
  var routeOpts=_medRouteOptions(m.sig);
  var current=doseOpts.filter(function(o){return o.current;})[0] || doseOpts[Math.floor(doseOpts.length/2)];
  _changeState={
    section:section, idx:idx, med:m,
    doseOpts:doseOpts, routeOpts:routeOpts,
    dose:current, route:routeOpts[0], schedule:_guessScheduleFromSig(m.sig),
    prn:/PRN/i.test(m.sig), indication:d.ind||'', comments:'',
    days:d.days, qty:d.qty, refills:d.refills, pickup:d.pickup,
    patientInstrChecked:!!d.ind, patientInstr:d.ind||'',
  };
  renderChangeOrderDialog();
  showFloatWin('change-order-dlg');
  centerFloatWin('change-order-dlg');
}
function _coDosageListHtml(){
  return _changeState.doseOpts.map(function(o,i){
    var sel=_changeState.dose===o?' sel':'';
    return '<div class="co-opt'+sel+'" onclick="selectChangeDose('+i+')"><span>'+o.label+'</span><span>'+o.price+'</span><span>'+o.tier+'</span></div>';
  }).join('');
}
function _coRouteListHtml(){
  return _changeState.routeOpts.map(function(r,i){
    var sel=_changeState.route===r?' sel':'';
    return '<div class="co-opt'+sel+'" onclick="selectChangeRoute('+i+')"><span>'+r+'</span></div>';
  }).join('');
}
function _coScheduleListHtml(){
  return SCHEDULE_LIST.map(function(code){
    var sel=_changeState.schedule===code?' sel':'';
    return '<div class="co-opt'+sel+'" onclick="selectChangeSchedule(\''+code.replace(/'/g,"\\'")+'\')"><span>'+code+'</span></div>';
  }).join('');
}
function renderChangeOrderDialog(){
  var s=_changeState; if(!s) return;
  document.getElementById('co-name-input').value=s.med.n;
  var combo=_medComboNote(s.med.n);
  var comboEl=document.getElementById('co-combo-note');
  comboEl.textContent=combo; comboEl.style.display=combo?'block':'none';
  document.getElementById('co-dosage-list').innerHTML=_coDosageListHtml();
  document.getElementById('co-route-list').innerHTML=_coRouteListHtml();
  document.getElementById('co-schedule-list').innerHTML=_coScheduleListHtml();
  document.getElementById('co-prn-check').checked=s.prn;
  var indSel=document.getElementById('co-indication-sel');
  indSel.innerHTML='<option value=""></option>'+_medIndicationOptions(s.med.n).map(function(o){
    return '<option'+(o===s.indication?' selected':'')+'>'+o+'</option>';
  }).join('');
  if(!s.indication) indSel.value='';
  document.getElementById('co-comments').value=s.comments||'';
  document.getElementById('co-days').value=s.days;
  document.getElementById('co-refills').value=s.refills;
  document.querySelectorAll('input[name="co-pickup"]').forEach(function(r){ r.checked=(r.value===s.pickup); });
  document.getElementById('co-instr-check').checked=s.patientInstrChecked;
  document.getElementById('co-instr-text').value=s.patientInstr||'';
  var note=_medInfoNote(s.med.n);
  document.getElementById('co-info-note').innerHTML = note ? '<span>&#9432;</span><span>'+note+'</span>' : '';
  recomputeChangeQty();
  refreshChangePreview();
}
function selectChangeDose(i){ _changeState.dose=_changeState.doseOpts[i]; renderChangeOrderDialog(); }
function selectChangeRoute(i){ _changeState.route=_changeState.routeOpts[i]; renderChangeOrderDialog(); }
function selectChangeSchedule(code){ _changeState.schedule=code; renderChangeOrderDialog(); }
function coPrnToggle(){
  _changeState.prn=document.getElementById('co-prn-check').checked;
  if(_changeState.prn) _changeState.qty='';
  renderChangeOrderDialog();
}
function coDaysChanged(){ _changeState.days=document.getElementById('co-days').value; recomputeChangeQty(); refreshChangePreview(); }
function coQtyManual(){ _changeState.qty=document.getElementById('co-qty').value; refreshChangePreview(); }
function coFieldChanged(){
  var s=_changeState; if(!s) return;
  s.indication=document.getElementById('co-indication-sel').value;
  s.comments=document.getElementById('co-comments').value;
  s.refills=document.getElementById('co-refills').value;
  var pr=document.querySelector('input[name="co-pickup"]:checked'); s.pickup=pr?pr.value:'Mail';
  s.patientInstrChecked=document.getElementById('co-instr-check').checked;
  s.patientInstr=document.getElementById('co-instr-text').value;
  refreshChangePreview();
}
// Per the user's explicit workflow rule: when PRN is unchecked, Quantity
// auto-calculates from Days Supply x the selected schedule's doses/day.
// When PRN is checked, Quantity is left for manual entry instead.
function recomputeChangeQty(){
  var s=_changeState; if(!s) return;
  if(!s.prn){
    var perDay=_scheduleDosesPerDay(s.schedule);
    var days=parseFloat(s.days)||0;
    s.qty=Math.round(perDay*days);
  }
  document.getElementById('co-qty').value=s.qty;
  document.getElementById('co-qty').readOnly=!s.prn;
}
function refreshChangePreview(){ document.getElementById('co-preview').textContent=buildChangeOrderPreview(_changeState); }
function buildChangeOrderPreview(s){
  if(!s) return '';
  var isChew=/CHEWABLE/i.test(s.med.n);
  var formWord=isChew?'TABLET':(/CAP\b/i.test(s.med.n)?'CAPSULE':'TABLET');
  var verb=isChew?'CHEW':'TAKE';
  var routeText=s.route==='ORAL' ? 'BY MOUTH' : s.route;
  var freq=_scheduleHuman(s.schedule);
  var baseName=s.med.n.replace(/\s*[\d.]+\s*(MG|MCG|G|ML|UNITS?)\b.*$/i,'').trim();
  var tabletCount=s.dose?s.dose.tabletCount:1;
  var countWord=tabletCount>1 ? String(tabletCount) : 'ONE';
  var formWordPlural=formWord+(tabletCount>1?'S':'');
  var line1=baseName+' TAB,'+s.route+' '+(s.dose?s.dose.headerLabel:'');
  var line2=verb+' '+countWord+' '+formWordPlural+' '+routeText+' '+freq+(s.prn?' AS NEEDED':'')+(s.patientInstrChecked && s.patientInstr ? ' '+s.patientInstr : '');
  var lines=[line1,line2,'Quantity: '+(s.qty||0)+' Refills: '+(s.refills||0)];
  if(s.indication) lines.push('Indication: '+s.indication);
  return lines.join('\n');
}
function acceptChangeOrder(){
  var s=_changeState; if(!s) return;
  closeWin('change-order-dlg');
  showFloatWin('meds-sim-notice-dlg');
  centerFloatWin('meds-sim-notice-dlg');
  _changeState=null;
}
