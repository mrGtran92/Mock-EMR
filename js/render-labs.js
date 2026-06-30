function renderLabs(pt){
  document.getElementById('left-pane').style.display='none';
  document.getElementById('right-pane').style.display='none';
  var mp=document.getElementById('main-panes');
  var outer=document.createElement('div'); outer.id='labs-outer';
  var left=document.createElement('div'); left.id='labs-left';
  var lh=document.createElement('div'); lh.className='labs-lp-hdr'; lh.textContent='Lab Results'; left.appendChild(lh);
  var ltree=document.createElement('div'); ltree.className='labs-tree';
  var items=[
    {label:'Most Recent',s:'most-recent'},{label:'Lab Overview (Collected Specimens)',s:'overview'},
    {label:'Pending Lab Orders',s:'pending'},{label:'Worksheet',s:'worksheet',sel:true},
    {label:'Graph',s:'graph'},{label:'All Tests by Date',s:'alltests'},
    {label:'Selected Tests by Date',s:'selected'},{label:'Microbiology',s:'micro'},
    {label:'Anatomic Pathology - All Reports',grp:['Autopsy','Cytology','Electron Microscopy','Surgical Pathology']},
    {label:'Blood Bank',s:'bloodbank'},{label:'Lab Orders (All)',s:'laborders'},{label:'Cumulative',s:'cumulative'},
  ];
  items.forEach(function(it){
    if(it.grp){
      var g=document.createElement('div'); g.className='ti'; g.style.fontStyle='italic';
      g.innerHTML='<span class="arrow">&#9660;</span>'+it.label; ltree.appendChild(g);
      it.grp.forEach(function(c){
        var ci=document.createElement('div'); ci.className='ti indent1'; ci.textContent=c;
        ci.onclick=function(){ ltree.querySelectorAll('.ti').forEach(function(x){x.classList.remove('sel');}); ci.classList.add('sel'); labsSection('anat'); };
        ltree.appendChild(ci);
      });
    } else {
      var d=document.createElement('div'); d.className='ti'+(it.sel?' sel':''); d.textContent=it.label;
      d.onclick=(function(sec){return function(){ ltree.querySelectorAll('.ti').forEach(function(x){x.classList.remove('sel');}); d.classList.add('sel'); labsSection(sec); };})(it.s);
      ltree.appendChild(d);
    }
  });
  left.appendChild(ltree);
  var ba=document.createElement('div'); ba.className='labs-btn-area';
  ba.innerHTML='<button class="btn" style="width:100%">Other Tests</button>'; left.appendChild(ba);
  outer.appendChild(left);
  var right=document.createElement('div'); right.id='labs-right'; outer.appendChild(right); mp.appendChild(outer);

  function labsSection(sec){
    right.innerHTML='';
    var toolbar=document.createElement('div'); toolbar.className='labs-toolbar';
    if(['worksheet','overview','micro','most-recent','selected','alltests'].indexOf(sec)>-1){
      toolbar.innerHTML='<label><input type="radio" name="ldr" checked> Date Range...</label><label><input type="radio" name="ldr"> Today</label><label><input type="radio" name="ldr"> 1 Week</label><label><input type="radio" name="ldr"> 1 Month</label><label><input type="radio" name="ldr"> 6 Months</label><label><input type="radio" name="ldr"> 1 Year</label><label><input type="radio" name="ldr"> 2 Years</label><label><input type="radio" name="ldr"> All Results</label>';
    }
    if(sec==='worksheet'){
      toolbar.innerHTML+='<span class="section-label">Table Format</span><label><input type="radio" name="ltf" checked> Horizontal</label><label><input type="radio" name="ltf"> Vertical</label><span class="section-label">Other</span><label><input type="radio" name="lof" checked> Comments</label><label><input type="radio" name="lof"> Graph</label><label><input type="checkbox" style="margin-left:8px"> Abnormal Results Only</label>';
    }
    if(toolbar.innerHTML) right.appendChild(toolbar);
    var hdr=document.createElement('div'); hdr.className='labs-hdr';
    var body=document.createElement('div'); body.style.cssText='flex:1;overflow-y:auto;background:#fffff0;padding:4px 6px';

    if(sec==='worksheet'){
      hdr.textContent='Worksheet [From: EARLIEST RESULT to Jun 29, 2026]'; right.appendChild(hdr);
      var html=''; body.style.fontFamily='Arial';
      pt.labs.forEach(function(p){
        html+='<div style="font-weight:bold;font-size:11px;background:#d8d8f0;border:1px solid #9090c0;padding:2px 6px;margin-top:6px;margin-bottom:2px">'+p.name+'</div>';
        html+='<table class="labs-tbl"><thead><tr><th style="width:120px">Test</th>';
        p.cols.forEach(function(c){html+='<th>'+c+'</th>';});
        html+='</tr></thead><tbody>';
        p.rows.forEach(function(r){
          html+='<tr><td style="font-weight:bold">'+r.t+'</td>';
          r.v.forEach(function(v,i){ var f=r.f[i]||''; html+='<td class="'+(f==='H'?'fH':f==='L'?'fL':'')+'">'+v+(f?' '+f:'')+'</td>'; });
          html+='</tr>';
        });
        html+='</tbody></table>';
      });
      html+='<div style="margin-top:8px;font-size:10px;color:#555">KEY: "L"=Low  "H"=High  "***"=Critical Value</div>';
      body.innerHTML=html; right.appendChild(body);
    } else if(sec==='most-recent'){
      hdr.textContent='Most Recent'; right.appendChild(hdr);
      var nav=document.createElement('div'); nav.className='labs-most-recent-nav';
      nav.innerHTML='<button class="btn">&lt;&lt; Oldest</button><button class="btn">&lt; Previous</button><button class="btn" disabled>Next &gt;</button><button class="btn" disabled>Newest &gt;&gt;</button><span style="margin-left:8px;font-size:11px;font-weight:bold">Specimen: SERUM</span>';
      right.appendChild(nav);
      var last=pt.labs[0];
      var t='<table class="labs-tbl"><thead><tr><th style="width:120px">Collection Date/Time</th><th>Test</th><th>Result/Status</th><th style="width:50px">Flag</th><th style="width:70px">Units</th><th>Ref Range</th></tr></thead><tbody>';
      if(last){ last.rows.forEach(function(r){ var f=r.f[r.f.length-1]||r.f[0]||''; var lastIdx=r.v.length-2;
        t+='<tr><td>06/20/2026 06:00</td><td>'+r.t+'</td><td class="'+(f==='H'?'fH':f==='L'?'fL':'')+'">'+r.v[lastIdx>=0?lastIdx:0]+'</td><td class="'+(f==='H'?'fH':f==='L'?'fL':'')+'">'+f+'</td><td></td><td>'+(r.v[r.v.length-1]||'')+'</td></tr>';
      });}
      t+='</tbody></table>';
      body.innerHTML=t; body.style.fontFamily='Arial'; right.appendChild(body);
    } else if(sec==='overview'){
      hdr.textContent='Lab Overview (Collected Specimens) [From: EARLIEST to Jun 29, 2026]'; right.appendChild(hdr);
      var t2='<div style="font-size:10px;color:#555;padding:2px 0 4px">A maximum of 1000 per site will be displayed regardless of the number available.</div>';
      t2+='<table class="labs-tbl"><thead><tr><th style="width:120px">Collection Date/Time</th><th>Test Name</th><th style="width:50px">Critical</th><th style="width:60px">Specimen</th><th style="width:70px">Provider</th><th style="width:75px">Status</th><th style="width:25px">[+]</th></tr></thead><tbody>';
      pt.labs.forEach(function(p){ t2+='<tr><td>06/20/2026 06:00</td><td>'+p.name+'</td><td></td><td>Serum</td><td>TORRES</td><td>COMPLETED</td><td style="color:#0000cc">[+]</td></tr>'; });
      t2+='</tbody></table>'; body.innerHTML=t2; body.style.fontFamily='Arial'; right.appendChild(body);
    } else if(sec==='micro'){
      hdr.textContent='Microbiology [From: EARLIEST RESULT to Jun 29, 2026]'; right.appendChild(hdr);
      var t3='<table class="labs-tbl"><thead><tr><th style="width:120px">Collection Date/Time</th><th>Microbiology Test Name</th><th style="width:90px">Collection Sample</th><th style="width:70px">Specimen</th><th style="width:75px">Accession #</th><th style="width:25px">[+]</th></tr></thead><tbody>';
      t3+='<tr><td colspan="6" style="color:#555;font-style:italic;padding:6px">No microbiology results found for this patient.</td></tr></tbody></table>';
      body.innerHTML=t3; body.style.fontFamily='Arial'; right.appendChild(body);
    } else if(sec==='bloodbank'){
      hdr.textContent='Blood Bank'; right.appendChild(hdr);
      body.style.fontFamily="'Courier New',monospace"; body.style.whiteSpace='pre-wrap';
      body.textContent='---- BLOOD BANK REPORT ----\n\nABO/RH: O POSITIVE\n\nANTIBODIES IDENTIFIED:\n   No antibody results on file.\n\nTRANSFUSION REQUIREMENTS:\n   No transfusion requirements.\n\nTRANSFUSION REACTIONS:\n   No transfusion reactions.\n\nAVAILABLE / ISSUED UNITS:\n   No available/issued units.\n\nCOMPONENT REQUESTS:\n   No component requests.';
      right.appendChild(body);
    } else if(sec==='anat'){
      hdr.textContent='Anatomic Pathology - All Reports'; right.appendChild(hdr);
      var t4='<table class="labs-tbl"><thead><tr><th style="width:130px">Collection Date</th><th>Specimen</th><th style="width:90px">Accession #</th><th style="width:25px">[+]</th></tr></thead><tbody>';
      t4+='<tr><td colspan="4" style="color:#555;font-style:italic;padding:6px">No anatomic pathology reports found.</td></tr></tbody></table>';
      body.innerHTML=t4; body.style.fontFamily='Arial'; right.appendChild(body);
    } else {
      hdr.textContent=sec.charAt(0).toUpperCase()+sec.slice(1); right.appendChild(hdr);
      body.textContent='No data available for this section.'; right.appendChild(body);
    }
  }
  window._labsSection=labsSection;
  labsSection('worksheet');
}

