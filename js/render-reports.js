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
    {label:'Clinical Reports',expand:true,children:['Allergies','Patient Information','Visits / Admissions','Comp & Pen Exams','Dietetics','Discharge Summary','Laboratory','Medicine/CP','Orders','Outpatient Encounters / GAF',
      {label:'Pharmacy',expand:false,children:['All Medications','Active Outpatient','Outpatient RX Profile','Active IV','All IV','Unit Dose','Med Admin History (BCMA)','Med Admin Log (BCMA)','Herbal/OTC/Non-VA','Active Meds With Allergies']},
      'Problem List','Progress Notes','Radiology','Surgery Reports','Vital Signs','Anticoagulation Flowsheet']},
    {label:'Health Summary',expand:false},{label:'HDR Reports',expand:false},
    {label:'Dept. of Defense Reports',expand:false},{label:'Imaging (local only)',img:true},
    {label:'Graphing (local only)'},{label:'Lab Status'},{label:'Blood Bank Report'},
    {label:'Anatomic Pathology',expand:false},{label:'Dietetics Profile'},
    {label:'Nutritional Assessment'},{label:'Vitals Cumulative'},{label:'Procedures (local only)',proc:true},
    {label:'Daily Order Summary'},{label:'Order Summary for a Date Range'},
    {label:'Chart Copy Summary'},{label:'Outpatient RX Profile'},
    {label:'Med Admin Log (BCMA)'},{label:'Med Admin History (BCMA)'},{label:'Event Capture',expand:false},
  ];
  function build(items,depth){
    items.forEach(function(it){
      if(typeof it==='string'){
        var d=document.createElement('div'); d.className='ti'+(depth>0?' indent'+depth:''); d.textContent=it;
        d.onclick=(function(lbl){return function(){ tree.querySelectorAll('.ti').forEach(function(x){x.classList.remove('sel');}); d.classList.add('sel'); rch.textContent=lbl; rcb.innerHTML='<div style="color:#555;font-style:italic;padding:4px">No matching documents found for this patient in this report.</div>'; };})(it);
        tree.appendChild(d);
      } else {
        var has=it.children&&it.children.length;
        var d=document.createElement('div'); d.className='ti'+(depth>0?' indent'+depth:'');
        var arrow=has?(it.expand?'&#9660; ':'&#9658; '):'';
        d.innerHTML='<span class="arrow">'+arrow+'</span>'+it.label;
        if(it.label==='Clinical Reports') d.classList.add('sel');
        d.onclick=(function(item){return function(){
          tree.querySelectorAll('.ti').forEach(function(x){x.classList.remove('sel');}); d.classList.add('sel');
          if(item.img){ rch.textContent='Imaging (local only) [From: Dec 26,1996 to Jun 29,2026]'; rcb.innerHTML=buildImaging(pt); }
          else if(item.proc){ rch.textContent='Procedures (local only)'; rcb.innerHTML=buildProcedures(pt); }
          else { rch.textContent=item.label; rcb.innerHTML='<div style="color:#555;font-style:italic;padding:4px">No matching documents found for this patient in this report.</div>'; }
        };})(it);
        tree.appendChild(d);
        if(has && it.expand!==false) build(it.children,depth+1);
      }
    });
  }
  build(data,0);
  left.appendChild(tree); outer.appendChild(left); outer.appendChild(right); mp.appendChild(outer);
  rcb.innerHTML='<div style="color:#555;padding:4px;font-size:11px">Select a report from the list to view available documents.</div>';
}
function buildImaging(pt){
  var html='<table class="labs-tbl" style="margin-bottom:6px"><thead><tr><th style="width:130px">Procedure Date/Time</th><th>Procedure Name</th><th style="width:75px">Report Status</th><th style="width:70px">Exam Status</th><th style="width:55px">Case #</th><th style="width:25px">[+]</th></tr></thead><tbody>';
  pt.imaging.forEach(function(img,i){
    html+='<tr onclick="showImgReport('+i+')"><td>'+img.date+'</td><td>'+img.name+'</td><td>'+img.stat+'</td><td>'+img.examstat+'</td><td>'+img.cnum+'</td><td style="color:#0000cc">[+]</td></tr>';
  });
  html+='</tbody></table><div id="img-report-body" style="white-space:pre-wrap;font-family:\'Courier New\',monospace;font-size:11px;border-top:1px solid #aaa;padding-top:6px">'+(pt.imaging.length?pt.imaging[0].body:'No imaging found.')+'</div>';
  window._imgData=pt.imaging; return html;
}
window.showImgReport=function(i){ var el=document.getElementById('img-report-body'); if(el&&window._imgData) el.textContent=window._imgData[i].body; };
function buildProcedures(pt){
  var html='<table class="labs-tbl" style="margin-bottom:6px"><thead><tr><th style="width:130px">Procedure Date/Time</th><th>Procedure Name</th><th style="width:90px">Report Status</th><th style="width:25px">[+]</th></tr></thead><tbody>';
  if(pt.imaging.length) pt.imaging.forEach(function(img){ html+='<tr><td>'+img.date+'</td><td>'+img.name+'</td><td>'+img.stat+'</td><td style="color:#0000cc">[+]</td></tr>'; });
  else html+='<tr><td colspan="4" style="color:#555;font-style:italic;padding:6px">No procedures found.</td></tr>';
  html+='</tbody></table>'; return html;
}

