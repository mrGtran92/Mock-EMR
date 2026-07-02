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
  if(days===null) return vitals;
  return vitals.slice(0,Math.min(days,vitals.length));
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
function vwIsAbnormal(v,key){
  if(key==='t') return v.t.indexOf('H')>-1||v.t.indexOf('L')>-1;
  if(key==='hr') return v.hr.indexOf('H')>-1||v.hr.indexOf('L')>-1;
  if(key==='rr') return v.rr.indexOf('H')>-1||v.rr.indexOf('L')>-1;
  if(key==='pox'||key==='bp') return v.spo2&&v.spo2.indexOf('L')>-1||v.bp.indexOf('H')>-1;
  return false;
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
  var abn=function(v){return v&&(v.indexOf('H')>-1||v.indexOf('L')>-1);};
  var rows=[
    {label:'Temp:',         val:function(v){return {t:v.t.replace(/ [HL]/,''),                              a:abn(v.t)     };}},
    {label:'Pulse:',        val:function(v){return {t:v.hr.replace(/ [HL]/,''),                             a:abn(v.hr)    };}},
    {label:'Resp:',         val:function(v){return {t:v.rr.replace(/ [HL]/,''),                             a:abn(v.rr)    };}},
    {label:'P Ox %:',       val:function(v){return {t:v.pox,                                                a:abn(v.spo2)  };}},
    {label:'B/P:',          val:function(v){return {t:v.bp.replace(/ [HL]/,''),                             a:abn(v.bp)    };}},
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
    '<div style="margin-top:6px;font-size:10px;color:#555">KEY: "L"=Abnormal Low &nbsp; "H"=Abnormal High</div>';
  document.getElementById('vw-pane').innerHTML=h;
}

function openPostings(){
  if(!currentPt) return;
  var pt=PTS[currentPt];
  var aTbl=document.getElementById('post-allergy-tbl');
  while(aTbl.rows.length>1) aTbl.deleteRow(1);
  if(pt.allergies.length){ pt.allergies.forEach(function(a){
    var tr=aTbl.insertRow(); tr.innerHTML='<td>'+a.agent+'</td><td>'+a.sev+'</td><td>'+a.signs+'</td>';
  });} else { var tr=aTbl.insertRow(); tr.innerHTML='<td colspan="3" style="font-weight:bold;padding:3px">No Known Allergies (NKA)</td>'; }
  document.getElementById('post-directives').innerHTML=pt.postings.map(function(p){return '<div style="padding:1px 4px;border-bottom:1px solid #eee;color:#000;cursor:pointer">'+p+'</div>';}).join('');
  showFloatWin('postings-dlg');
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
    'Primary Eligibility: NSC (VERIFIED)',
    'Means Test Signed?: YES',
    'Patient\'s status is MT COPAY EXEMPT based on primary means test',
    'Veteran is eligible and provision of hospital care is mandatory',
    '',
    'Status      : CURRENT INPATIENT — '+(pt.ward||''),
    'Attending   : '+(pt.prov||''),
  ];
  document.getElementById('pi-body').textContent=lines.join('\n');
  showFloatWin('patient-inquiry-dlg');
  makeResizable('patient-inquiry-dlg','pi-resize-handle');
  document.removeEventListener('click', _piOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _piOutsideClick); }, 0);
}
function _piOutsideClick(e){
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
  makeResizable('pact-dlg','pact-resize-handle');
  document.removeEventListener('click', _pactOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _pactOutsideClick); }, 0);
}
function _pactOutsideClick(e){
  var dlg = document.getElementById('pact-dlg');
  if(dlg && dlg.style.display!=='none' && !dlg.contains(e.target) && e.target.id!=='ph-pact' && !e.target.closest('#ph-pact')){
    closeWin('pact-dlg');
    document.removeEventListener('click', _pactOutsideClick);
  }
}

function openPdmpQuery(){
  if(!currentPt) return;
  var pt=PTS[currentPt];
  var pdmpTitle='STATE PRESCRIPTION DRUG MONITORING PROGRAM';
  var already=pt.notes.some(function(n){ return n.title===pdmpTitle; });
  if(!already){
    pt.notes.unshift({
      date:'Jun 20,26', title:pdmpTitle, loc:'Automated Query', auth:'SYSTEM (PDMP Interface)',
      body:'LOCAL TITLE: '+pdmpTitle+'\nDATE OF NOTE: JUN 20, 2026@09:15       STATUS: COMPLETED\nAUTHOR: SYSTEM (PDMP Interface)\n\nCalifornia CURES PDMP database queried prior to prescribing a\ncontrolled substance for '+pt.name+'.\n\nNo actionable controlled-substance dispensing history requiring\nprovider follow-up was identified in this simulation.\n\n[This is an automated placeholder note generated by the PDMP\nquery workflow -- in real CPRS, clicking PDMP Query doesn\'t show a\nconfirmation popup; it silently files a note like this documenting\nthat the check was performed.]'
    });
  }
  if(typeof currentTab!=='undefined' && currentTab==='notes' && typeof renderTab==='function') renderTab('notes');
}
function openJlvInfo(){
  if(!currentPt) return;
  showFloatWin('jlv-dlg');
}

function openRemoteDataInfo(){
  if(!currentPt) return;
  showFloatWin('remote-data-dlg');
}

function showFloatWin(id){ var el=document.getElementById(id); el.style.display=el.dataset.display||'block'; makeDraggable(id); }
function closeWin(id){ document.getElementById(id).style.display='none'; }
function centerFloatWin(id){
  var el = document.getElementById(id);
  el.style.left = Math.max(0, Math.round((window.innerWidth - el.offsetWidth) / 2)) + 'px';
  el.style.top  = Math.max(0, Math.round((window.innerHeight - el.offsetHeight) / 2)) + 'px';
}
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
      var dx=e.clientX-mx, dy=e.clientY-my; mx=e.clientX; my=e.clientY;
      var newLeft=win.offsetLeft+dx, newTop=win.offsetTop+dy;
      newTop=Math.max(0,Math.min(newTop,window.innerHeight-handle.offsetHeight));
      newLeft=Math.max(-win.offsetWidth+60,Math.min(newLeft,window.innerWidth-60));
      win.style.left=newLeft+'px'; win.style.top=newTop+'px';
    };
    document.onmouseup=function(){ document.onmousemove=null; document.onmouseup=null; };
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
