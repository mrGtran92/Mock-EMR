function renderMeds(pt){
  document.getElementById('left-pane').style.display='none';
  document.getElementById('rp-hdr').style.display='none';
  var rpBody=document.getElementById('rp-body');
  rpBody.className='rp-body grid'; rpBody.style.padding='0'; rpBody.style.overflow='auto';
  var html='<div class="meds-sort-bar">Sort by Status/Exp. Date (Clinic Orders first on Inpt)</div>';
  html+='<div class="meds-sec-hdr">Outpatient Medications <span class="meds-range">Date Range: Apr 01, 2026 - Jun 29, 2026</span></div>';
  html+='<table class="meds-tbl"><thead><tr><th style="width:60px">Action</th><th>Outpatient Medications</th><th style="width:90px">Expires</th><th style="width:80px">Status</th><th style="width:20px">L</th><th style="width:20px">F</th></tr></thead><tbody>';
  if(pt.meds_home.length){ pt.meds_home.forEach(function(m){
    html+='<tr><td></td><td><span class="med-name">'+m.n+'</span><span class="med-sig">'+m.sig+'</span></td><td>'+m.lf+'</td><td>'+m.stat+'</td><td></td><td>'+(m.ref||'')+'</td></tr>';
  });} else html+='<tr><td></td><td colspan="5" style="color:#555;font-style:italic;padding:4px 6px">No Active Outpatient Medications Found</td></tr>';
  html+='</tbody></table>';
  html+='<div class="meds-sec-hdr">Non-VA Medications <span class="meds-range">Date Range: Apr 01, 2026 - Jun 29, 2026</span></div>';
  html+='<table class="meds-tbl"><thead><tr><th style="width:60px">Action</th><th>Non-VA Medications (Documentation)</th><th style="width:90px">Start Date</th><th style="width:80px">Status</th></tr></thead><tbody>';
  html+='<tr><td></td><td colspan="3" style="color:#555;font-style:italic;padding:4px 6px">No Non-VA Medications Found</td></tr></tbody></table>';
  html+='<div class="meds-sec-hdr">Inpatient Medications <span class="meds-range">Date Range: Apr 01, 2026 - Jun 29, 2026</span></div>';
  html+='<table class="meds-tbl"><thead><tr><th style="width:60px">Action</th><th>Inpatient Medications</th><th style="width:90px">Stop Date</th><th style="width:90px">Status</th><th style="width:20px">L</th></tr></thead><tbody>';
  pt.meds_inpt.forEach(function(m){
    var isHeld=m.stat==='HELD', isDisc=m.stat==='DISCONTINUED';
    var rowStyle=isHeld?' style="background:#fffaf0"':isDisc?' style="background:#f6f6f6"':'';
    var nameStyle=isHeld?' style="color:#c06000"':isDisc?' style="color:#888"':'';
    var tag=isHeld?' [HELD]':isDisc?' [DISCONTINUED]':'';
    html+='<tr'+rowStyle+'><td></td><td><span class="med-name"'+nameStyle+'>'+m.n+tag+'</span><span class="med-sig">'+m.sig+'</span><span class="med-ind">Indication: '+m.ind+'</span></td><td>'+(m.stop||'')+'</td><td>'+m.stat+'</td><td></td></tr>';
  });
  html+='</tbody></table>';
  rpBody.innerHTML=html;
}

