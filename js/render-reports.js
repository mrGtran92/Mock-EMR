function renderReports(pt){
  document.getElementById('left-pane').style.display='none';
  document.getElementById('right-pane').style.display='none';
  var mp=document.getElementById('main-panes');
  var outer=document.createElement('div'); outer.id='reports-outer';
  var left=document.createElement('div'); left.id='reports-left';
  var lh=document.createElement('div'); lh.className='reports-lp-hdr'; lh.textContent='Available Reports'; left.appendChild(lh);
  var tree=document.createElement('div'); tree.className='reports-tree';
  var right=document.createElement('div'); right.id='reports-right';
  var rch=document.createElement('div'); rch.className='rep-content-hdr'; rch.textContent='Clinical Reports';
  var rcb=document.createElement('div'); rcb.style.cssText='flex:1;overflow:auto;background:#fffff0;padding:4px 6px';
  right.appendChild(rch); right.appendChild(rcb);
  var data=[
    {label:'Clinical Reports',expand:false,children:['Allergies','Patient Information','Visits / Admissions','Comp & Pen Exams','Dietetics','Discharge Summary','Laboratory','Medicine/CP','Orders','Outpatient Encounters / GAF',
      {label:'Pharmacy',expand:false,children:['All Medications','Active Outpatient','Outpatient RX Profile','Active IV','All IV','Unit Dose','Med Admin History (BCMA)','Med Admin Log (BCMA)','Herbal/OTC/Non-VA','Active Meds With Allergies']},
      'Problem List','Progress Notes','Radiology','Surgery Reports','Vital Signs','Anticoagulation Flowsheet']},
    {label:'Health Summary',expand:false,children:[
      'Adhoc Report','Covid-19 Information','Gulfvet Questionnaire','Medication Reconciliation','Medication Worksheet',
      {label:'Remote Clinical Data (1y)',remote:'clinical1y'},
      {label:'Remote Clinical Data (4y)',remote:'other'},
      {label:'Remote Clinical Reminders',remote:'other'},
      {label:'Remote Demo/Vitals/Pce (1y)',remote:'other'},
      {label:'Remote Labs Long View (12y)',remote:'labslong'},
      {label:'Remote Meds/Labs/Orders (1y)',remote:'medslabsorders'},
      {label:'Remote Outpatient Meds (6m)',remote:'other'},
      {label:'Remote Text Reports (1y)',remote:'other'},
      {label:'Remote Dis Summ/Surg/Prod (12y)',remote:'other'},
      'Vaccine/Immunization/Tb Tests','Admissions/Discharges (5 Yrs)','Aims/Gaf','Ambulatory Care',
      'Ambulatory/Inpatient Care','Ambulatory-Anemia/Heme','Ambulatory -Opioid Use Monitor',
      'Bcma Med History 7 Days','Bcma Med Log','Board And Care','Clinical Reminders Brief',
      'Clinical Reminder Summary','Mhv Reminders','Bronchoscopy','Cardiac Ambulatory Ecg Report',
      'Cardiac Cath Reports','Cardiac Echo','Cardiac Event Monitor Report','Cardiac Stress Testing',
      'Cardiac Tee','Cers-Clinic Visits','Cers-Cssrs/Csre','Cers-Suicide Safety Plan',
      'Cers-Clinical Reminders','Cers-Mhtp','Cers-Hud Vash Admission','Cers-Hud Vash Discharge',
      'Cers-Vash Stage Of Case Mgmt','Cers-Vash Roi','Clc Paramedic Hand Off Report',
      'Contingency Inpt','Contingency Opt','Inpt Rx Contingency',
    ]},{label:'HDR Reports',expand:false},
    {label:'Dept. of Defense Reports',expand:false},{label:'Imaging (local only)',img:true},
    {label:'Graphing (local only)'},{label:'Lab Status'},{label:'Blood Bank Report'},
    {label:'Anatomic Pathology',expand:false},{label:'Dietetics Profile'},
    {label:'Nutritional Assessment'},{label:'Vitals Cumulative'},{label:'Procedures (local only)',proc:true},
    {label:'Daily Order Summary'},{label:'Order Summary for a Date Range'},
    {label:'Chart Copy Summary'},{label:'Outpatient RX Profile'},
    {label:'Med Admin Log (BCMA)'},{label:'Med Admin History (BCMA)'},{label:'Event Capture',expand:false},
  ];
  function build(items,depth,parentContainer){
    items.forEach(function(it){
      if(typeof it==='string'){
        var d=document.createElement('div'); d.className='ti'+(depth>0?' indent'+depth:''); d.textContent=it;
        d.onclick=(function(lbl){return function(e){e.stopPropagation(); tree.querySelectorAll('.ti').forEach(function(x){x.classList.remove('sel');}); d.classList.add('sel'); rch.textContent=lbl; rcb.innerHTML='<div style="color:#555;font-style:italic;padding:4px">No matching documents found for this patient in this report.</div>'; };})(it);
        (parentContainer||tree).appendChild(d);
      } else {
        var has=it.children&&it.children.length;
        var open=it.expand===true;
        var d=document.createElement('div'); d.className='ti'+(depth>0?' indent'+depth:'');
        var arrow=has?(open?'&#9660; ':'&#9658; '):'';
        d.innerHTML='<span class="arrow">'+arrow+'</span>'+it.label;
        if(it.label==='Clinical Reports') d.classList.add('sel');
        (parentContainer||tree).appendChild(d);
        var childWrap=null;
        if(has){
          childWrap=document.createElement('div');
          childWrap.style.display=open?'':'none';
          (parentContainer||tree).appendChild(childWrap);
          build(it.children,depth+1,childWrap);
        }
        d.onclick=(function(item,childW,el){return function(e){
          e.stopPropagation();
          if(childW){
            var nowOpen=childW.style.display!=='none';
            childW.style.display=nowOpen?'none':'';
            el.querySelector('.arrow').innerHTML=nowOpen?'&#9658; ':'&#9660; ';
          }
          tree.querySelectorAll('.ti').forEach(function(x){x.classList.remove('sel');}); el.classList.add('sel');
          if(item.img){ rch.textContent='Imaging (local only) [From: Dec 26,1996 to Jun 29,2026]'; rcb.innerHTML=buildImaging(pt); }
          else if(item.proc){ rch.textContent='Procedures (local only)'; rcb.innerHTML=buildProcedures(pt); }
          else if(item.remote){ rch.textContent=item.label; rcb.innerHTML=buildRemoteReport(item,pt); }
          else { rch.textContent=item.label; rcb.innerHTML='<div style="color:#555;font-style:italic;padding:4px">No matching documents found for this patient in this report.</div>'; }
        };})(it,childWrap,d);
      }
    });
  }
  build(data,0,null);
  left.appendChild(tree); outer.appendChild(left); outer.appendChild(right); mp.appendChild(outer);
  rcb.innerHTML='<div style="color:#555;padding:4px;font-size:11px">Select a report from the list to view available documents.</div>';
}
function buildImaging(pt){
  var html='<table class="labs-tbl" id="img-list-tbl" style="margin-bottom:6px"><thead><tr>'
    +'<th style="width:130px">Procedure Date/Time<span class="col-resize-handle"></span></th>'
    +'<th>Procedure Name<span class="col-resize-handle"></span></th>'
    +'<th style="width:75px">Report Status<span class="col-resize-handle"></span></th>'
    +'<th style="width:70px">Exam Status<span class="col-resize-handle"></span></th>'
    +'<th style="width:55px">Case #<span class="col-resize-handle"></span></th>'
    +'<th style="width:25px">[+]</th>'
    +'</tr></thead><tbody>';
  pt.imaging.forEach(function(img,i){
    html+='<tr onclick="showImgReport('+i+')"><td>'+img.date+'</td><td>'+img.name+'</td><td>'+img.stat+'</td><td>'+img.examstat+'</td><td>'+img.cnum+'</td><td style="color:#0000cc">[+]</td></tr>';
  });
  html+='</tbody></table><div id="img-report-body" style="white-space:pre-wrap;font-family:\'Courier New\',monospace;font-size:11px;border-top:1px solid #aaa;padding-top:6px">'+(pt.imaging.length?pt.imaging[0].body:'No imaging found.')+'</div>';
  window._imgData=pt.imaging;
  setTimeout(function(){ var tbl=document.getElementById('img-list-tbl'); if(tbl) makeColumnsResizable(tbl); },0);
  return html;
}
window.showImgReport=function(i){ var el=document.getElementById('img-report-body'); if(el&&window._imgData) el.textContent=window._imgData[i].body; };
function buildProcedures(pt){
  var procs=pt.procedures||[];
  var html='<table class="labs-tbl" style="margin-bottom:0" id="proc-list-tbl"><thead><tr>'
    +'<th style="width:140px">Procedure Date/Time<span class="col-resize-handle"></span></th>'
    +'<th>Procedure Name<span class="col-resize-handle"></span></th>'
    +'<th style="width:90px">Report Status<span class="col-resize-handle"></span></th>'
    +'<th style="width:60px">Case #<span class="col-resize-handle"></span></th>'
    +'<th style="width:25px">[+]</th>'
    +'</tr></thead><tbody>';
  if(procs.length){
    procs.forEach(function(p,i){ html+='<tr class="proc-row" data-idx="'+i+'"><td>'+p.date+'</td><td>'+p.name+'</td><td>'+p.stat+'</td><td>'+p.cnum+'</td><td style="color:#0000cc">[+]</td></tr>'; });
  } else {
    html+='<tr><td colspan="5" style="color:#555;font-style:italic;padding:6px">No procedures found.</td></tr>';
  }
  html+='</tbody></table>';
  html+='<div id="proc-report-body" style="margin-top:0;border-top:2px solid #808080;white-space:pre-wrap;font-family:\'Courier New\',monospace;font-size:11px;padding:6px;background:#fffff0;min-height:80px">'+(procs.length?procs[0].body:'')+'</div>';
  window._procData=procs;
  setTimeout(function(){
    var tbl=document.getElementById('proc-list-tbl');
    if(!tbl) return;
    makeColumnsResizable(tbl);
    tbl.querySelectorAll('.proc-row').forEach(function(tr){
      tr.style.cursor='pointer';
      tr.onclick=function(){
        tbl.querySelectorAll('.proc-row').forEach(function(r){r.classList.remove('sel');});
        tr.classList.add('sel');
        var el=document.getElementById('proc-report-body');
        if(el&&window._procData) el.textContent=window._procData[parseInt(tr.dataset.idx)].body;
      };
    });
  },0);
  return html;
}

function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildRemoteReport(item, pt){
  var sites = (pt.remoteSites||[]).filter(function(s){ return pt._remoteChecked && pt._remoteChecked[s.name]; });
  var tabs = ['Local'].concat(sites.map(function(s){ return s.name; }));
  var activeTab = sites.length ? sites[0].name : 'Local';
  var html = '<div class="remote-tabbar" id="remote-tabbar">' + tabs.map(function(t){
    return '<div class="remote-tab'+(t===activeTab?' active':'')+'" data-tab="'+escapeHtml(t)+'">'+escapeHtml(t)+'</div>';
  }).join('') + '</div><div id="remote-tab-body"></div>';
  setTimeout(function(){
    renderRemoteTabBody(item, pt, activeTab);
    document.querySelectorAll('#remote-tabbar .remote-tab').forEach(function(tabEl){
      tabEl.onclick=function(){
        document.querySelectorAll('#remote-tabbar .remote-tab').forEach(function(x){ x.classList.remove('active'); });
        tabEl.classList.add('active');
        renderRemoteTabBody(item, pt, tabEl.getAttribute('data-tab'));
      };
    });
  },0);
  return html;
}

function renderRemoteTabBody(item, pt, tabName){
  var el=document.getElementById('remote-tab-body');
  if(!el) return;
  if(tabName==='Local'){
    el.innerHTML='<div style="color:#555;font-style:italic;padding:6px">Local Health Summary reports aren\'t modeled in this simulation — this workflow is about the Remote Data feature. Select a remote site tab above (checked in the Remote Data dropdown in the header) to see its data.</div>';
    return;
  }
  var site=(pt.remoteSites||[]).filter(function(s){ return s.name===tabName; })[0];
  var text;
  if(item.remote==='clinical1y') text=buildRemoteClinicalData(pt, site);
  else if(item.remote==='labslong') text=buildRemoteLabsLongView(pt, site);
  else if(item.remote==='medslabsorders') text=buildRemoteMedsLabsOrders(pt, site);
  else text='This remote report type isn\'t modeled in this simulation.';
  el.innerHTML='<div style="white-space:pre-wrap;font-family:\'Courier New\',monospace;font-size:11px;padding:6px">'+escapeHtml(text)+'</div>';
}

function buildRemoteClinicalData(pt, site){
  var lines=[];
  lines.push('********** CONFIDENTIAL Remote Clinical Data (1y) SUMMARY  pg. 1 **********');
  lines.push(pt.name+'     '+pt.mrn);
  lines.push('DOB: '+pt.dob);
  lines.push('');
  lines.push('--------------------- BDEM - Brief Demographics ---------------------');
  lines.push('');
  var addr = pt.inquiry ? (pt.inquiry.addr1+'   '+pt.inquiry.addr2) : '';
  var phone = pt.inquiry ? pt.inquiry.phone : '';
  lines.push('  Address: '+addr+'          Phone: '+phone);
  lines.push('  Age: '+pt.age+'                              Sex: '+pt.sex);
  lines.push('');
  lines.push('  Treating Facility                Type       Station     Last Seen');
  lines.push('  --------------------------------------------------------');
  lines.push('  '+site.name.toUpperCase()+'     VAMC       '+site.station+'         '+site.lastSeen);
  lines.push('');
  lines.push('  Source of Info: '+site.name.toUpperCase());
  lines.push('');
  lines.push('--------------------- BADR - Brief Adv React/All ---------------------');
  lines.push('');
  if(pt.allergies && pt.allergies.length){
    pt.allergies.forEach(function(a){ lines.push('  Allergy/Reaction: '+a.agent.toUpperCase()); });
  } else {
    lines.push('  No known allergies on file at this facility.');
  }
  lines.push('');
  lines.push('--------------------- VS - Vital Signs (max 1 year) ---------------------');
  lines.push('');
  lines.push('Temporarily disabled');
  lines.push('NOT IN USE');
  lines.push('');
  lines.push('--------------------- PLL - All Problems ---------------------');
  lines.push('');
  var probs=(pt.problems||[]).slice(0,3);
  lines.push('             '+probs.length+' Problems');
  lines.push('');
  lines.push('ST  PROBLEM                                    LAST MOD      PROVIDER');
  probs.forEach(function(p){ lines.push(p.s+'   '+p.d+'   '+p.upd+'   '+(pt.prov||'')); });
  lines.push('');
  lines.push('--------------------- RXOP - Outpatient Pharmacy (max 1 year) ---------------------');
  lines.push('');
  lines.push('Drug....................................    Last');
  lines.push('                Rx #        Stat       Qty      Issued    Filled    Rem');
  (pt.meds_home||[]).forEach(function(m){
    lines.push(m.n);
    lines.push('   '+m.stat.toUpperCase()+'          '+(m.ref||'0')+'          '+m.lf+'   '+m.lf+'   ('+(m.ref||'0')+')');
    lines.push('   SIG: '+m.sig+'.');
  });
  return lines.join('\n');
}

function buildRemoteLabsLongView(pt, site){
  var lines=[];
  lines.push('********** CONFIDENTIAL Remote Labs Long View (12y) **********');
  lines.push(pt.name+'     '+pt.mrn);
  lines.push('Source of Info: '+site.name.toUpperCase()+'   Station '+site.station);
  lines.push('');
  (pt.labs||[]).forEach(function(panel){
    lines.push('--- '+panel.name+' ---');
    lines.push(panel.cols.join('     '));
    panel.rows.forEach(function(r){
      lines.push(r.t+': '+r.v.join(' / '));
    });
    lines.push('');
  });
  return lines.join('\n');
}

function buildRemoteMedsLabsOrders(pt, site){
  var lines=[];
  lines.push('********** CONFIDENTIAL Remote Meds/Labs/Orders (1y) **********');
  lines.push(pt.name+'     '+pt.mrn);
  lines.push('Source of Info: '+site.name.toUpperCase()+'   Station '+site.station);
  lines.push('');
  lines.push('--- Medications ---');
  (pt.meds_home||[]).forEach(function(m){ lines.push(m.n+'   '+m.sig+'   ('+m.stat.toUpperCase()+')'); });
  lines.push('');
  lines.push('--- Recent Orders ---');
  (pt.orders||[]).slice(0,5).forEach(function(o){ lines.push('['+o.svc+'] '+o.ord.split('\n')[0]+'   '+o.start); });
  lines.push('');
  lines.push('--- Labs (most recent panel) ---');
  if(pt.labs && pt.labs.length){
    var panel=pt.labs[0];
    lines.push(panel.name+' ('+panel.cols[0]+')');
    panel.rows.forEach(function(r){ lines.push(r.t+': '+r.v[0]); });
  } else {
    lines.push('No labs on file.');
  }
  return lines.join('\n');
}

