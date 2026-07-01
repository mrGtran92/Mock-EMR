function renderMeds(pt){
  document.getElementById('left-pane').style.display='none';
  document.getElementById('rp-hdr').style.display='none';
  var rpBody=document.getElementById('rp-body');
  rpBody.className='rp-body grid'; rpBody.style.padding='0'; rpBody.style.overflow='auto';
  var html='<div class="meds-sort-bar">Sort by Status/Exp. Date (Clinic Orders first on Inpt)</div>';
  html+='<div class="meds-sec-hdr">Outpatient Medications <span class="meds-range">Date Range: Apr 01, 2026 - Jun 29, 2026</span></div>';
  html+='<table class="meds-tbl" id="meds-home-tbl"><thead><tr>'
    +'<th style="width:60px">Action</th>'
    +'<th>Outpatient Medications<span class="col-resize-handle"></span></th>'
    +'<th style="width:90px">Expires<span class="col-resize-handle"></span></th>'
    +'<th style="width:80px">Status<span class="col-resize-handle"></span></th>'
    +'<th style="width:90px">Last Filled<span class="col-resize-handle"></span></th>'
    +'<th style="width:110px">Refills Remaining</th>'
    +'</tr></thead><tbody>';
  if(pt.meds_home.length){ pt.meds_home.forEach(function(m){
    html+='<tr><td></td><td><span class="med-name">'+m.n+'</span><span class="med-sig">'+m.sig+'</span></td><td></td><td>'+m.stat+'</td><td>'+m.lf+'</td><td>'+(m.ref||'')+'</td></tr>';
  });} else html+='<tr><td></td><td colspan="5" style="color:#555;font-style:italic;padding:4px 6px">No Active Outpatient Medications Found</td></tr>';
  html+='</tbody></table>';
  html+='<div class="meds-sec-hdr">Non-VA Medications <span class="meds-range">Date Range: Apr 01, 2026 - Jun 29, 2026</span></div>';
  html+='<table class="meds-tbl" id="meds-nonva-tbl"><thead><tr>'
    +'<th style="width:60px">Action</th>'
    +'<th>Non-VA Medications (Documentation)<span class="col-resize-handle"></span></th>'
    +'<th style="width:90px">Start Date<span class="col-resize-handle"></span></th>'
    +'<th style="width:80px">Status</th>'
    +'</tr></thead><tbody>';
  html+='<tr><td></td><td colspan="3" style="color:#555;font-style:italic;padding:4px 6px">No Non-VA Medications Found</td></tr></tbody></table>';
  html+='<div class="meds-sec-hdr">Inpatient Medications <span class="meds-range">Date Range: Apr 01, 2026 - Jun 29, 2026</span></div>';
  html+='<table class="meds-tbl" id="meds-inpt-tbl"><thead><tr>'
    +'<th style="width:60px">Action</th>'
    +'<th>Inpatient Medications<span class="col-resize-handle"></span></th>'
    +'<th style="width:90px">Stop Date<span class="col-resize-handle"></span></th>'
    +'<th style="width:90px">Status<span class="col-resize-handle"></span></th>'
    +'<th style="width:90px">Location</th>'
    +'</tr></thead><tbody>';
  pt.meds_inpt.forEach(function(m){
    var isDisc=m.stat==='DISCONTINUED';
    var rowStyle=isDisc?' style="background:#f6f6f6"':'';
    var nameStyle=isDisc?' style="color:#888"':'';
    var tag=isDisc?' [DISCONTINUED]':'';
    html+='<tr'+rowStyle+'><td></td><td><span class="med-name"'+nameStyle+'>'+m.n+tag+'</span><span class="med-sig">'+m.sig+'</span><span class="med-ind">Indication: '+m.ind+'</span></td><td>'+(m.stop||'')+'</td><td>'+m.stat+'</td><td>'+(pt.ward||'')+'</td></tr>';
  });
  html+='</tbody></table>';
  rpBody.innerHTML=html;
  ['meds-home-tbl','meds-nonva-tbl','meds-inpt-tbl'].forEach(function(id){
    var tbl=document.getElementById(id); if(tbl) makeColumnsResizable(tbl);
  });
}

