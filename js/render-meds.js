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
  if(pt.meds_home.length){ pt.meds_home.forEach(function(m){
    html+='<tr><td></td><td><span class="med-name">'+m.n+'</span><span class="med-sig">'+m.sig+'</span></td><td></td><td>'+m.stat+'</td><td>'+m.lf+'</td><td>'+(m.ref||'')+'</td></tr>';
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
  pt.meds_inpt.forEach(function(m){
    var isDisc=m.stat==='DISCONTINUED';
    var rowStyle=isDisc?' style="background:#f6f6f6"':'';
    var nameStyle=isDisc?' style="color:#888"':'';
    var tag=isDisc?' [DISCONTINUED]':'';
    html+='<tr'+rowStyle+'><td></td><td><span class="med-name"'+nameStyle+'>'+m.n+tag+'</span><span class="med-sig">'+m.sig+'</span><span class="med-ind">Indication: '+m.ind+'</span></td><td>'+(m.stop||'')+'</td><td>'+m.stat+'</td><td>'+(pt.ward||'')+'</td></tr>';
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
