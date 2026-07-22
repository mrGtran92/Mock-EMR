var _vwResizeObs=null;
function openVitalsWin(){
  if(!currentPt) return;
  var pt=PTS[currentPt];
  document.getElementById('vw-ptname').textContent=pt.name+'  '+pt.mrn+'  ('+pt.age+')';
  var p2=document.getElementById('vw-ptname2');
  if(p2) p2.textContent=pt.name+'  '+pt.mrn+'  ('+pt.age+')';
  var dr=document.getElementById('vw-daterange');
  var vitals=pt.vitals;
  if(dr&&vitals.length) dr.textContent='From - To: '+(vitals[vitals.length-1].dt||'')+'  –  '+(vitals[0].dt||'');
  vwRedraw();
  showFloatWin('vitals-win');
  centerFloatWin('vitals-win');
  makeResizable('vitals-win','vw-resize-handle');
  if(!_vwResizeObs && window.ResizeObserver){
    _vwResizeObs=new ResizeObserver(function(){ vwDrawChart(); });
    _vwResizeObs.observe(document.getElementById('vw-chart-wrap'));
  }
}
function vwSetPeriod(el){
  document.querySelectorAll('.vt-period').forEach(function(x){x.classList.remove('sel');});
  if(el) el.classList.add('sel');
  vwRedraw();
}
function vwVitalChanged(){ vwRedraw(); }
function vwRedraw(){
  if(!currentPt) return;
  var filtered=vwFilteredVitals();
  renderVitalsTable(filtered);
  vwDrawChart();
}
function vwFilteredVitals(){
  if(!currentPt) return [];
  var vitals=PTS[currentPt].vitals;
  var sel=document.querySelector('.vt-period.sel');
  var label=sel?sel.textContent:'All Results';
  var days=null;
  if(label==='TODAY') days=1;
  else if(label==='T-1') days=1;
  else if(label==='T-2') days=2;
  else if(label==='T-3') days=3;
  else if(label==='T-4') days=4;
  else if(label==='T-5') days=5;
  else if(label==='T-6') days=6;
  else if(label==='T-7') days=7;
  else if(label==='T-15') days=15;
  else if(label==='T-30') days=30;
  else if(label==='Six Months') days=180;
  else if(label==='One Year') days=365;
  else if(label==='Two Years') days=730;
  // pt.vitals is stored newest-first, but the table/chart both display
  // oldest on the left and newest on the right (real CPRS convention) --
  // reverse to chronological order after taking the N most recent entries.
  var recent=days===null?vitals:vitals.slice(0,Math.min(days,vitals.length));
  return recent.slice().reverse();
}
function vwGetNumeric(v,key){
  if(key==='t') return parseFloat(v.t);
  if(key==='hr') return parseFloat(v.hr);
  if(key==='rr') return parseFloat(v.rr);
  if(key==='pox') return parseFloat(v.pox);
  if(key==='bp') return parseFloat(v.bp.split('/')[0]);
  if(key==='wt') return v.wt==='--'?NaN:(parseFloat(v.wt)*2.20462);
  if(key==='pn') return parseFloat(v.pn)||0;
  return NaN;
}
// Single source of truth for vital-sign abnormal flagging, computed from
// the actual numeric value against fixed reference ranges rather than a
// manually-authored " H"/" L" suffix in the data -- the old convention let
// the same value (e.g. Temp 37.1, SpO2 94) show flagged in one entry and
// unflagged in another purely from inconsistent hand-authoring. Also fixes
// a pre-existing bug where the old pox/bp check shared one expression, so
// an abnormal BP could incorrectly flag the P Ox cell red (and vice versa).
// P Ox is deliberately excluded from VITAL_RANGES -- per user correction,
// real CPRS never flags pulse ox red regardless of how low it reads, so it
// always renders in plain black text.
var VITAL_RANGES = {t:{lo:36.0,hi:38.0}, hr:{lo:60,hi:100}, rr:{lo:12,hi:20}};
function vwIsAbnormal(v,key){
  if(key==='pox') return false;
  if(key==='bp'){
    var parts=(v.bp||'').split('/');
    var sys=parseFloat(parts[0]), dia=parseFloat(parts[1]);
    return (!isNaN(sys)&&(sys>140||sys<90)) || (!isNaN(dia)&&(dia>90||dia<60));
  }
  var range=VITAL_RANGES[key];
  if(!range) return false;
  var n=parseFloat(key==='pox'?v.pox:v[key]);
  if(isNaN(n)) return false;
  return (range.hi!==null && n>range.hi) || n<range.lo;
}
function vwDrawChart(){
  var wrap=document.getElementById('vw-chart-wrap');
  var canvas=document.getElementById('vw-chart');
  if(!wrap||!canvas||!currentPt) return;
  var W=wrap.clientWidth, H=wrap.clientHeight;
  canvas.width=W; canvas.height=H;
  var ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#fffff0'; ctx.fillRect(0,0,W,H);
  var vitals=vwFilteredVitals();
  var key=document.getElementById('vw-vital-sel')?document.getElementById('vw-vital-sel').value:'hr';
  var label=document.getElementById('vw-vital-sel')?document.getElementById('vw-vital-sel').options[document.getElementById('vw-vital-sel').selectedIndex].text:'Pulse';
  var showValues=document.getElementById('vw-chk-values')&&document.getElementById('vw-chk-values').checked;
  if(!vitals.length){ ctx.fillStyle='#888'; ctx.font='11px Arial'; ctx.fillText('No data',W/2-20,H/2); return; }
  var pts=vitals.map(function(v){return {y:vwGetNumeric(v,key),dt:v.dt,abn:vwIsAbnormal(v,key)};}).filter(function(p){return !isNaN(p.y);});
  if(!pts.length) return;
  var pad={l:48,r:20,t:24,b:36};
  var cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
  var vals=pts.map(function(p){return p.y;});
  var minV=Math.min.apply(null,vals), maxV=Math.max.apply(null,vals);
  var range=maxV-minV||1;
  minV=minV-range*0.15; maxV=maxV+range*0.15;
  var toX=function(i){return pad.l+cW*(pts.length===1?0.5:i/(pts.length-1));};
  var toY=function(v){return pad.t+cH*(1-(v-minV)/(maxV-minV));};
  // grid
  ctx.strokeStyle='#d0d0c0'; ctx.lineWidth=1;
  var gridN=4;
  for(var g=0;g<=gridN;g++){
    var gy=pad.t+cH*g/gridN;
    ctx.beginPath(); ctx.moveTo(pad.l,gy); ctx.lineTo(pad.l+cW,gy); ctx.stroke();
    var gv=(maxV-(maxV-minV)*g/gridN).toFixed(1);
    ctx.fillStyle='#555'; ctx.font='9px Arial'; ctx.textAlign='right';
    ctx.fillText(gv,pad.l-4,gy+3);
  }
  // fill under line
  if(pts.length>1){
    ctx.beginPath(); ctx.moveTo(toX(0),toY(pts[0].y));
    for(var i=1;i<pts.length;i++) ctx.lineTo(toX(i),toY(pts[i].y));
    ctx.lineTo(toX(pts.length-1),pad.t+cH); ctx.lineTo(toX(0),pad.t+cH); ctx.closePath();
    ctx.fillStyle='rgba(100,160,255,0.18)'; ctx.fill();
  }
  // line
  ctx.strokeStyle='#1a60c0'; ctx.lineWidth=1.5; ctx.beginPath();
  pts.forEach(function(p,i){ if(i===0) ctx.moveTo(toX(i),toY(p.y)); else ctx.lineTo(toX(i),toY(p.y)); });
  ctx.stroke();
  // points + labels
  pts.forEach(function(p,i){
    var x=toX(i), y=toY(p.y);
    ctx.fillStyle=p.abn?'#cc0000':'#1a60c0';
    ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
    if(showValues){
      var lbl=p.y.toFixed(key==='wt'?0:1);
      ctx.font='bold 9px Arial'; ctx.textAlign='center';
      var bw=ctx.measureText(lbl).width+6, bh=13;
      var bx=x-bw/2, by=y-bh-4;
      ctx.fillStyle=p.abn?'#ffeaea':'#e0ecff';
      ctx.strokeStyle=p.abn?'#cc0000':'#5588cc'; ctx.lineWidth=0.8;
      ctx.fillRect(bx,by,bw,bh); ctx.strokeRect(bx,by,bw,bh);
      ctx.fillStyle=p.abn?'#cc0000':'#000';
      ctx.fillText(lbl,x,by+bh-3);
    }
    // x-axis label
    if(H>80){
      ctx.fillStyle='#555'; ctx.font='8px Arial'; ctx.textAlign='center';
      ctx.fillText(p.dt,x,H-4);
    }
  });
  // legend
  ctx.fillStyle='#1a60c0'; ctx.fillRect(pad.l,4,10,10);
  ctx.fillStyle='#000'; ctx.font='10px Arial'; ctx.textAlign='left';
  ctx.fillText('● '+label,pad.l+14,13);
}
function renderVitalsTable(vitals){
  var rows=[
    {label:'Temp:',         val:function(v){return {t:v.t,                                                  a:vwIsAbnormal(v,'t')  };}},
    {label:'Pulse:',        val:function(v){return {t:v.hr,                                                 a:vwIsAbnormal(v,'hr') };}},
    {label:'Resp:',         val:function(v){return {t:v.rr,                                                 a:vwIsAbnormal(v,'rr') };}},
    {label:'P Ox %:',       val:function(v){return {t:v.pox,                                                a:vwIsAbnormal(v,'pox')};}},
    {label:'B/P:',          val:function(v){return {t:v.bp,                                                 a:vwIsAbnormal(v,'bp') };}},
    {label:'Wt (lbs):',     val:function(v){return {t:v.wt!=='--'?(parseFloat(v.wt)*2.20462).toFixed(0):'--',a:false      };}},
    {label:'Ht (in):',      val:function(v){return {t:v.ht?v.ht.replace(' in',''):'',                      a:false        };}},
    {label:'BMI:',          val:function(v){return {t:'',a:false};}},
    {label:'C/G:',          val:function(v){return {t:'',a:false};}},
    {label:'CVP (cmH2O):',  val:function(v){return {t:'',a:false};}},
    {label:'In 24hr (ml):', val:function(v){return {t:'',a:false};}},
    {label:'Out 24hr (ml):',val:function(v){return {t:'',a:false};}},
    {label:'Pain:',         val:function(v){return {t:v.pn||'0',a:false};}},
    {label:'Location:',     val:function(v){return {t:'',a:false};}},
    {label:'Entered By:',   val:function(v){return {t:'',a:false};}},
  ];
  var th='<td style="background:#d4d0c8;padding:1px 6px;border:1px solid #aaa;white-space:nowrap;font-size:11px;min-width:90px"></td>';
  vitals.forEach(function(v){
    th+='<td style="background:#d4d0c8;padding:1px 6px;border:1px solid #aaa;white-space:nowrap;font-size:10px;text-align:center">'+v.dt+'</td>';
  });
  var body='';
  rows.forEach(function(row,ri){
    var rowBg=ri%2===0?'#fffff0':'#f5f5e8';
    var rowHtml='<tr><td style="background:#d4d0c8;padding:1px 6px;border:1px solid #aaa;white-space:nowrap;font-size:11px">'+row.label+'</td>';
    vitals.forEach(function(v){
      var cell=row.val(v);
      var color=cell.a?';color:#cc0000':'';
      rowHtml+='<td style="background:'+rowBg+';padding:1px 8px;border:1px solid #eee;text-align:center;font-size:11px'+color+'">'+cell.t+'</td>';
    });
    body+=rowHtml+'</tr>';
  });
  var h='<table style="border-collapse:collapse;font-size:11px"><thead><tr>'+th+'</tr></thead><tbody>'+body+'</tbody></table>'+
    '<div style="margin-top:6px;font-size:10px;color:#555">KEY: <span style="color:#cc0000">Red</span> = Outside Normal Range</div>';
  document.getElementById('vw-pane').innerHTML=h;
}

// Converts a full posting timestamp ("Mar 12, 2025@10:20") into the short
// two-digit-year, no-time form the classic Postings popup shows ("Mar 12,25").
function _postDateShort(dt){
  var m = dt.match(/^(\w{3}) (\d{2}), (\d{4})/);
  return m ? m[1]+' '+m[2]+','+m[3].slice(2) : dt;
}

function openPostings(){
  if(!currentPt) return;
  var pt=PTS[currentPt];
  var aTbl=document.getElementById('post-allergy-tbl');
  while(aTbl.rows.length>1) aTbl.deleteRow(1);
  if(pt.allergies.length){ pt.allergies.forEach(function(a){
    var tr=aTbl.insertRow(); tr.innerHTML='<td>'+a.agent+'</td><td>'+a.sev+'</td><td>'+a.signs+'</td>';
  });} else { var tr=aTbl.insertRow(); tr.innerHTML='<td colspan="3" style="font-weight:bold;padding:3px">No Known Allergies (NKA)</td>'; }
  document.getElementById('post-directives').innerHTML=pt.postings.map(function(p){
    return '<div style="display:flex;justify-content:space-between;gap:10px;padding:1px 4px;border-bottom:1px solid #eee;color:#000;cursor:pointer"><span>'+p.type+'</span><span>'+_postDateShort(p.dt)+'</span></div>';
  }).join('');
  showFloatWin('postings-dlg');
  centerFloatWin('postings-dlg');
  document.removeEventListener('click', _postOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _postOutsideClick); }, 0);
}
function _postOutsideClick(e){
  if(typeof _tourActive!=='undefined' && _tourActive) return;
  var dlg = document.getElementById('postings-dlg');
  if(dlg && dlg.style.display!=='none' && !dlg.contains(e.target) && !e.target.closest('#hbtn-postings')){
    closeWin('postings-dlg');
    document.removeEventListener('click', _postOutsideClick);
  }
}

function openPatientInquiry(){
  if(!currentPt) return;
  var pt=PTS[currentPt];
  var inq=pt.inquiry||{};
  var ssn='000-00-'+pt.mrn.replace(/\D/g,'').slice(-4);
  var lines=[
    pt.name+';  SSN: '+ssn+'  DOB: '+pt.dob.toUpperCase(),
    '====================================================================',
    '',
    'Address:',
    '    '+(inq.addr1||''),
    '    '+(inq.addr2||''),
    '    UNITED STATES',
    '    County: LOS ANGELES (037)',
    '',
    '    Phone: '+(inq.phone||'NOT APPLICABLE'),
    '    Cell:  '+(inq.phone||'NOT APPLICABLE'),
    '    E-mail: '+(inq.email||'NOT APPLICABLE'),
    '',
    'Emergency Contact:',
    '    Name: '+(inq.emerName||'NOT ON FILE')+'   Relationship: '+(inq.emerRel||''),
    '    Phone: '+(inq.emerPhone||'NOT APPLICABLE'),
    '',
    '    POS: '+(inq.era||'UNKNOWN'),
    '    Combat Vet Status: '+(inq.combatVet||'NOT ELIGIBLE'),
    '    Race: DECLINED TO ANSWER',
    '    Ethnicity: DECLINED TO ANSWER',
    '',
    'Primary Eligibility: '+((pt.serviceConnection&&pt.serviceConnection.pct)?'SC':'NSC')+' (VERIFIED)',
    'Means Test Signed?: YES',
    'Patient\'s status is MT COPAY EXEMPT based on primary means test',
    'Veteran is eligible and provision of hospital care is mandatory',
    '',
  ].concat(_scBlockLines(pt)).concat([
    '',
    'Status      : CURRENT INPATIENT — '+(pt.ward||''),
    'Attending   : '+(pt.prov||''),
  ]);
  document.getElementById('pi-body').textContent=lines.join('\n');
  showFloatWin('patient-inquiry-dlg');
  centerFloatWin('patient-inquiry-dlg');
  makeResizable('patient-inquiry-dlg','pi-resize-handle');
  document.removeEventListener('click', _piOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _piOutsideClick); }, 0);
}
function _piOutsideClick(e){
  if(typeof _tourActive!=='undefined' && _tourActive) return;
  var dlg = document.getElementById('patient-inquiry-dlg');
  if(dlg && dlg.style.display!=='none' && !dlg.contains(e.target) && e.target.id!=='ph-name' && !e.target.closest('#ph-name')){
    closeWin('patient-inquiry-dlg');
    document.removeEventListener('click', _piOutsideClick);
  }
}

function openVistaImaging(){
  if(!currentPt) return;
  var pt=PTS[currentPt];
  document.getElementById('vi-ptname').textContent=pt.name;
  document.getElementById('vi-ptname2').textContent=pt.name;
  document.getElementById('vi-ptmeta').textContent='DOB: '+pt.dob+'   '+pt.mrn+'   12 of 12 Images match Filter';
  var rows=[
    {icon:'&#128444;', site:'WLA', title:'CHEST X-RAY PA/LAT', proc:'CON/PROC', cls:'IMAGE', type:'CLIN', dt:'06/18/26'},
    {icon:'&#128444;', site:'WLA', title:'CT ABDOMEN/PELVIS', proc:'CON/PROC', cls:'IMAGE', type:'CLIN', dt:'06/16/26'},
    {icon:'&#9989;',   site:'WLA', title:'ADVANCE DIRECTIVE', proc:'CLIN/ADMIN', cls:'ADVANCE DIR', type:'CLIN/ADMIN', dt:'03/12/25', id:'vi-ad-row'},
    {icon:'&#128203;', site:'WLA', title:'CONSENT -- BLOOD TRANSFUSION', proc:'CONSENT', cls:'NONE', type:'CLIN', dt:'06/16/26'},
    {icon:'&#128444;', site:'ALB', title:'ECHOCARDIOGRAM TTE', proc:'CON/PROC', cls:'IMAGE', type:'CLIN', dt:'06/19/26'},
    {icon:'&#128203;', site:'WLA', title:'CONSULT NOTE SCAN', proc:'CONSULT', cls:'CONSULT', type:'CLIN', dt:'06/17/26'},
  ];
  document.getElementById('vi-tbody').innerHTML = rows.map(function(r){
    return '<tr'+(r.id?(' id="'+r.id+'"'):'')+'><td>'+r.icon+'</td>'
      +'<td>'+r.site+'</td><td>'+r.title+'</td><td>'+r.proc+'</td><td>'+r.cls+'</td><td>'+r.type+'</td><td>'+r.dt+'</td></tr>';
  }).join('');
  showFloatWin('vista-imaging-dlg');
}

function openPactInfo(){
  if(!currentPt) return;
  var pt=PTS[currentPt];
  var pact=pt.pact||{};
  var lines=[
    ' Inpatient Attending: '+pt.prov+'   || PHONE:'+(pact.attPhone||'')+'   || PAGER:'+(pact.attPager||''),
    ' Inpatient Provider: '+(pact.invProvider||'')+'   || PHONE:'+(pact.invProviderPhone||'')+'   || PAGER:'+(pact.invProviderPager||''),
    '',
    'LOCAL - '+(pact.clinicName||'')+' ('+(pact.clinicCode||'')+')',
    'PACT: '+(pact.team||'')+' (Focus: Primary Care Only)',
    'Primary Care Provider: '+(pact.pcp||'')+'   || PHONE:'+(pact.pcpPhone||''),
    'Care Manager: '+(pact.careManager||'')+'   || PHONE:'+(pact.careManagerPhone||''),
    'Administrative Associate: '+(pact.adminAssoc||'')+'   || PHONE:'+(pact.adminAssocPhone||''),
    'Clinical Pharmacist Practitioner: '+(pact.pharmacist||'')+'   || PHONE:'+(pact.pharmacistPhone||''),
    'Social Worker: '+(pact.socialWorker||'')+(pact.socialWorker?('   || PHONE:'+(pact.socialWorkerPhone||'')):''),
    'Surrogate Care Manager: '+(pact.surrogateCM||'')+(pact.surrogateCM?('   || PHONE:'+(pact.surrogateCMPhone||'')):''),
    'Clinical POC: ',
    'Administrative POC: ',
  ];
  document.getElementById('pact-body').textContent=lines.join('\n');
  showFloatWin('pact-dlg');
  centerFloatWin('pact-dlg');
  makeResizable('pact-dlg','pact-resize-handle');
  document.removeEventListener('click', _pactOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _pactOutsideClick); }, 0);
}
function _pactOutsideClick(e){
  if(typeof _tourActive!=='undefined' && _tourActive) return;
  var dlg = document.getElementById('pact-dlg');
  if(dlg && dlg.style.display!=='none' && !dlg.contains(e.target) && e.target.id!=='ph-pact' && !e.target.closest('#ph-pact')){
    closeWin('pact-dlg');
    document.removeEventListener('click', _pactOutsideClick);
  }
}

var PDMP_NOTE_TITLE='STATE PRESCRIPTION DRUG MONITORING PROGRAM';

function updatePdmpButton(){
  if(!currentPt) return;
  var pt=PTS[currentPt];
  var l1=document.getElementById('hbtn-pdmp-l1'), l2=document.getElementById('hbtn-pdmp-l2');
  if(!l1||!l2) return;
  if(pt._pdmpState==='querying'){ l1.textContent='Querying'; l2.textContent='...'; }
  else if(pt._pdmpState==='results'){ l1.textContent='PDMP'; l2.textContent='Results'; }
  else { l1.textContent='PDMP'; l2.textContent='Query'; }
}

function handlePdmpClick(){
  if(!currentPt) return;
  var pt=PTS[currentPt];
  if(pt._pdmpState==='results'){ openPdmpResultsPopup(); return; }
  if(pt._pdmpState==='querying') return;
  pt._pdmpState='querying';
  updatePdmpButton();
  setTimeout(function(){
    if(currentPt && PTS[currentPt]===pt){
      pt._pdmpState='results';
      updatePdmpButton();
    }
  }, 1200);
}

function openPdmpResultsPopup(){
  if(!currentPt) return;
  var pt=PTS[currentPt];
  var body=document.getElementById('pdmp-body');
  body.innerHTML=
    '<div style="display:flex;justify-content:space-between;align-items:baseline">'+
      '<div><div style="font-size:15px;font-weight:bold">'+pt.name.toUpperCase()+'</div>'+
      '<div>Age: '+pt.age+'</div></div>'+
      '<div>Data as of: 06/20/2026</div>'+
    '</div>'+
    '<div class="pdmp-sect-hdr">Status of States Queried <a href="#" style="float:right;font-weight:normal;color:#0000cc" onclick="return false">View Details</a></div>'+
    '<div class="pdmp-warn-banner"><span>&#9888;</span><div>The search did not find PMP data for '+pt.name.toUpperCase()+' ('+pt.dob+') in the state where your query was initiated (CA). If you believe a patient record should exist in the CA PMP, please search the CA PMP website where you may be allowed to enter different search criteria.</div></div>'+
    '<div class="pdmp-sect-hdr">Demographics</div>'+
    '<div class="pdmp-cols"><div><b>Report Criteria</b><br>First Name: '+pt.name.split(',')[1]+'<br>Last Name: '+pt.name.split(',')[0]+'<br>DOB: '+pt.dob+'</div></div>'+
    '<div class="pdmp-sect-hdr">Summary</div>'+
    '<div class="pdmp-cols">'+
      '<div><b>Summary</b><br>Total Prescriptions: 0<br>Total Prescribers: 0<br>Total Pharmacies: 0</div>'+
      '<div><b>Narcotics</b><br>Current Qty: 0<br>Current MME/day: 0.00<br>30 Day Avg MME/day: 0.00</div>'+
      '<div><b>Buprenorphine</b><br>Current Qty: 0<br>Current mg/day: 0.00<br>30 Day Avg mg/day: 0.00</div>'+
    '</div>'+
    '<div class="pdmp-sect-hdr">Prescriptions</div>'+
    '<div>Total Prescriptions: 0</div>'+
    '<table class="pdmp-tbl"><tr><th>Fill Date</th><th>Drug</th><th>Qty</th><th>Days</th><th>Prescriber</th><th>Pharmacy</th></tr></table>';

  document.getElementById('pdmp-last-query').textContent='Last prior PDMP query was completed on 1/9/2026.';
  var already=pt.notes.some(function(n){ return n.title===PDMP_NOTE_TITLE; });
  document.getElementById('pdmp-pend-options').innerHTML=
    '<label><input type="radio" name="pdmp-opt" value="none" checked> No prescription(s) for controlled substances outside the VA were found in the last 90 days.</label>'+
    '<label><input type="radio" name="pdmp-opt" value="noconcern"> Prescription(s) filled outside the VA in the last 90 days are noted. However, they do not raise significant safety concerns and do not influence the treatment plan at this time.</label>'+
    '<label><input type="radio" name="pdmp-opt" value="discuss"> Prescription(s) filled outside the VA in the last 90 days are noted. Safety concerns will be discussed with the patient and documented as part of ongoing treatment planning.</label>'+
    '<label><input type="radio" name="pdmp-opt" value="addressed"> Prescription(s) filled outside the VA are noted and will be addressed as follows:</label>';
  document.getElementById('pdmp-pend-text').value='';
  document.getElementById('pdmp-pend-panel').style.display = already ? 'none' : 'block';

  showFloatWin('pdmp-results-dlg');
  centerFloatWin('pdmp-results-dlg');
  makeResizable('pdmp-results-dlg','pdmp-resize-handle');
}

function cancelPdmpWithoutUpdate(){
  closeWin('pdmp-results-dlg');
}

function doneCreatePdmpNote(){
  if(!currentPt) return;
  var pt=PTS[currentPt];
  var already=pt.notes.some(function(n){ return n.title===PDMP_NOTE_TITLE; });
  if(!already){
    var opt=document.querySelector('input[name="pdmp-opt"]:checked');
    var optText=opt ? opt.parentElement.textContent.trim() : 'No prescription(s) for controlled substances outside the VA were found in the last 90 days.';
    var freeText=document.getElementById('pdmp-pend-text').value.trim();
    pt.notes.unshift({
      date:'Jun 20,26', title:PDMP_NOTE_TITLE, loc:'1NO WORKLOAD', auth:'TRAN,GEORGE N',
      body:'LOCAL TITLE: '+PDMP_NOTE_TITLE+'\nSTANDARD TITLE: ACCOUNTING OF DISCLOSURES NOTE\nDATE OF NOTE: JUN 20, 2026@09:23:31       ENTRY DATE: JUN 20, 2026@09:23:31\n     AUTHOR: TRAN,GEORGE N          EXP COSIGNER:\n     URGENCY:                       STATUS: UNSIGNED\n\nThis PDMP query was submitted by Tran,George N MD.\n\nThe clinical justification for this PDMP query is to review controlled\nsubstances prescribed outside of the VA, and any additional information\nthat may become available, as an important component of standard clinical\ncare, and in accordance with VHA policy.\n\nPatient information was shared with the PDMP Appriss Gateway.\n\n'+optText+(freeText?('\n\n'+freeText):'')
    });
  }
  closeWin('pdmp-results-dlg');
  if(typeof currentTab!=='undefined' && currentTab==='notes' && typeof renderTab==='function') renderTab('notes');
}
function updateFlagButton(){
  var btn=document.getElementById('hbtn-flag');
  if(!btn) return;
  var pt=currentPt && PTS[currentPt];
  var has = pt && pt.flags && (((pt.flags.cat1||[]).length) + ((pt.flags.cat2||[]).length) > 0);
  btn.classList.toggle('hbtn-disabled', !has);
  var span=btn.querySelector('span');
  if(span) span.style.color = has ? '#cc0000' : '#888';
}

var _flagsPt=null, _flagsSel=null;
function openPatientFlags(){
  if(!currentPt) return;
  var pt=PTS[currentPt];
  var cat1=(pt.flags&&pt.flags.cat1)||[], cat2=(pt.flags&&pt.flags.cat2)||[];
  if(cat1.length+cat2.length===0) return;
  _flagsPt=pt;
  _flagsSel = cat1.length ? {c:'cat1',i:0} : {c:'cat2',i:0};
  renderFlagsDialog();
  showFloatWin('patient-flags-dlg');
  centerFloatWin('patient-flags-dlg');
  makeResizable('patient-flags-dlg','flags-resize-handle');
}
function renderFlagsDialog(){
  var pt=_flagsPt;
  var cat1=(pt.flags&&pt.flags.cat1)||[], cat2=(pt.flags&&pt.flags.cat2)||[];
  var body=document.getElementById('flags-body');
  var html='';
  html+='<div class="flags-sect-label'+(cat1.length?' flags-cat1-active':'')+'">Category I Flags'+(cat1.length?(': '+cat1.length+' Item(s)'):'')+'</div>';
  html+='<div class="flags-cat1-box'+(cat1.length?' flags-cat1-active':'')+'">';
  cat1.forEach(function(f,i){
    var sel=(_flagsSel.c==='cat1'&&_flagsSel.i===i);
    html+='<div class="flags-cat1-row'+(sel?' sel':'')+'" onclick="selectPatientFlag(\'cat1\','+i+')">'+f.name+'</div>';
  });
  html+='</div>';
  html+='<div class="flags-sect-label">Category II Flags'+(cat2.length?(': '+cat2.length+' Item(s)'):'')+'</div>';
  html+='<div class="flags-cat2-box">';
  cat2.forEach(function(f,i){
    var sel=(_flagsSel.c==='cat2'&&_flagsSel.i===i);
    html+='<div class="flags-cat2-row'+(sel?' sel':'')+'" onclick="selectPatientFlag(\'cat2\','+i+')">'+f.name+'</div>';
  });
  html+='</div>';
  var f = (_flagsSel.c==='cat1'?cat1:cat2)[_flagsSel.i];
  html+='<div class="flags-detail-pane" id="flags-detail-pane"></div>';
  html+='<div class="flags-notes-wrap"><table class="flags-notes-tbl"><thead><tr><th>Date</th><th>Action</th><th>Author</th></tr></thead><tbody id="flags-notes-tbody"></tbody></table></div>';
  body.innerHTML=html;
  document.getElementById('flags-detail-pane').textContent=flagDetailText(f);
  var ntbody=document.getElementById('flags-notes-tbody');
  (f.notes||[]).forEach(function(n){
    var tr=document.createElement('tr');
    tr.innerHTML='<td>'+n.date+'</td><td>'+n.action+'</td><td>'+n.author+'</td>';
    ntbody.appendChild(tr);
  });
}
function flagDetailText(f){
  var lines=[];
  lines.push('Flag Name:            '+f.name);
  lines.push('');
  lines.push('Assignment Narrative:');
  lines.push(f.narrative);
  lines.push('');
  lines.push('Flag Type:             '+f.flagType);
  lines.push('Flag Category:         '+f.category);
  lines.push('Assignment Status:     '+f.status);
  lines.push('Initial Assigned Date: '+f.assignedDate);
  lines.push('Approved by:           '+f.approvedBy);
  lines.push('Next Review Date:      '+f.nextReview);
  lines.push('Owner Site:            '+f.ownerSite);
  if(f.originatingSite) lines.push('Originating Site:      '+f.originatingSite);
  lines.push('');
  lines.push('History of Actions Taken:');
  lines.push('Date               Action          Site ID   Site Name');
  (f.actions||[]).forEach(function(a){
    lines.push(a.date+'   '+a.action+'   '+a.site+'   '+a.siteName);
  });
  return lines.join('\n');
}
function selectPatientFlag(cat,idx){
  _flagsSel={c:cat,i:idx};
  renderFlagsDialog();
}

function openJlvInfo(){
  if(!currentPt) return;
  showFloatWin('jlv-dlg');
  centerFloatWin('jlv-dlg');
  document.removeEventListener('click', _jlvOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _jlvOutsideClick); }, 0);
}
function _jlvOutsideClick(e){
  if(typeof _tourActive!=='undefined' && _tourActive) return;
  var dlg = document.getElementById('jlv-dlg');
  if(dlg && dlg.style.display!=='none' && !dlg.contains(e.target) && !e.target.closest('#hbtn-jlv')){
    closeWin('jlv-dlg');
    document.removeEventListener('click', _jlvOutsideClick);
  }
}

function toggleRemoteDataPanel(){
  if(!currentPt) return;
  var panel=document.getElementById('remote-data-panel');
  var isOpen=panel.style.display==='block';
  if(isOpen){ closeRemoteDataPanel(); return; }
  renderRemoteDataPanel();
  panel.style.display='block';
  document.removeEventListener('click', _remoteDataOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _remoteDataOutsideClick); }, 0);
}
function closeRemoteDataPanel(){
  var panel=document.getElementById('remote-data-panel');
  panel.style.display='none';
  document.removeEventListener('click', _remoteDataOutsideClick);
}
function _remoteDataOutsideClick(e){
  if(typeof _tourActive!=='undefined' && _tourActive) return;
  var panel=document.getElementById('remote-data-panel');
  if(panel && panel.style.display!=='none' && !panel.contains(e.target) && !e.target.closest('#hbtn-remote-data')){
    closeRemoteDataPanel();
  }
}
function renderRemoteDataPanel(){
  var pt=PTS[currentPt];
  pt._remoteChecked = pt._remoteChecked || {};
  var sites = pt.remoteSites||[];
  var box=document.getElementById('rdp-sites');
  box.innerHTML='';
  sites.forEach(function(s){
    var row=document.createElement('label'); row.className='rdp-site-row';
    var checked = !!pt._remoteChecked[s.name];
    row.innerHTML='<span><input type="checkbox" '+(checked?'checked':'')+' onchange="setRemoteSiteChecked(\''+s.name.replace(/'/g,"\\'")+'\', this.checked)"> '+s.name+'</span><span class="rdp-site-date">'+s.lastSeen+'</span>';
    box.appendChild(row);
  });
  var allBox=document.getElementById('rdp-all');
  allBox.checked = sites.length>0 && sites.every(function(s){ return pt._remoteChecked[s.name]; });
}
function setRemoteSiteChecked(name, checked){
  var pt=PTS[currentPt];
  pt._remoteChecked = pt._remoteChecked || {};
  pt._remoteChecked[name] = checked;
  renderRemoteDataPanel();
}
function toggleAllRemoteSites(box){
  var pt=PTS[currentPt];
  pt._remoteChecked = pt._remoteChecked || {};
  (pt.remoteSites||[]).forEach(function(s){ pt._remoteChecked[s.name]=box.checked; });
  renderRemoteDataPanel();
}

function showFloatWin(id){ var el=document.getElementById(id); el.style.display=el.dataset.display||'block'; makeDraggable(id); }
function closeWin(id){ document.getElementById(id).style.display='none'; }
function centerFloatWin(id){
  var el = document.getElementById(id);
  // .float-win dialogs are absolutely positioned, and their nearest
  // positioned ancestor is #content (position:relative), not the
  // viewport -- #content sits below the title bar/menu bar/patient
  // header stack and is shorter than window.innerHeight, so centering
  // must be measured against it, not the window.
  var parent = el.offsetParent;
  var pw = parent ? parent.clientWidth : window.innerWidth;
  var ph = parent ? parent.clientHeight : window.innerHeight;
  el.style.left = Math.max(0, Math.round((pw - el.offsetWidth) / 2)) + 'px';
  el.style.top  = Math.max(0, Math.round((ph - el.offsetHeight) / 2)) + 'px';
}
// Set true for the duration of a drag (plus one extra tick after mouseup),
// so "click outside to close" handlers can ignore the spurious click event
// the browser fires wherever the mouse happens to release -- otherwise
// dragging a dialog and letting go over some unrelated element (the yellow
// banner, another panel, anywhere outside the dialog) reads as a genuine
// outside click and closes the dialog mid-drag.
var _floatWinDragging=false;
function makeDraggable(winId){
  var win=document.getElementById(winId);
  var handle=win.querySelector('.fw-title, .dlg-title');
  if(!handle||handle._drag) return;
  handle._drag=true;
  var mx,my;
  handle.onmousedown=function(e){
    if(e.target.classList.contains('wb')) return;
    e.preventDefault(); mx=e.clientX; my=e.clientY;
    document.onmousemove=function(e){
      _floatWinDragging=true;
      var dx=e.clientX-mx, dy=e.clientY-my; mx=e.clientX; my=e.clientY;
      var newLeft=win.offsetLeft+dx, newTop=win.offsetTop+dy;
      newTop=Math.max(0,Math.min(newTop,window.innerHeight-handle.offsetHeight));
      newLeft=Math.max(-win.offsetWidth+60,Math.min(newLeft,window.innerWidth-60));
      win.style.left=newLeft+'px'; win.style.top=newTop+'px';
    };
    document.onmouseup=function(){
      document.onmousemove=null; document.onmouseup=null;
      if(_floatWinDragging) setTimeout(function(){ _floatWinDragging=false; },0);
    };
  };
}
function makeResizable(winId,handleId){
  var win=document.getElementById(winId);
  var handle=document.getElementById(handleId);
  if(!handle||handle._resize) return;
  handle._resize=true;
  var mx,my,startW,startH;
  handle.onmousedown=function(e){
    e.preventDefault(); e.stopPropagation();
    mx=e.clientX; my=e.clientY;
    startW=win.offsetWidth; startH=win.offsetHeight;
    document.onmousemove=function(e){
      var dx=e.clientX-mx, dy=e.clientY-my;
      var minW=parseInt(getComputedStyle(win).minWidth)||300;
      var minH=parseInt(getComputedStyle(win).minHeight)||200;
      win.style.width=Math.max(minW,startW+dx)+'px';
      win.style.height=Math.max(minH,startH+dy)+'px';
    };
    document.onmouseup=function(){ document.onmousemove=null; document.onmouseup=null; };
  };
}
