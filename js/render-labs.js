function renderLabs(pt){
  document.getElementById('left-pane').style.display='none';
  document.getElementById('right-pane').style.display='none';
  var mp=document.getElementById('main-panes');
  var outer=document.createElement('div'); outer.id='labs-outer';
  var left=document.createElement('div'); left.id='labs-left';
  var lh=document.createElement('div'); lh.className='labs-lp-hdr'; lh.textContent='Lab Results'; left.appendChild(lh);
  var ltree=document.createElement('div'); ltree.className='labs-tree';
  var items=[
    {label:'Most Recent',s:'most-recent',sel:true},{label:'Lab Overview (Collected Specimens)',s:'overview'},
    {label:'Pending Lab Orders',s:'pending'},{label:'Worksheet',s:'worksheet'},
    {label:'Graph',s:'graph'},{label:'All Tests by Date',s:'alltests'},
    {label:'Selected Tests by Date',s:'selected'},{label:'Microbiology',s:'micro'},
    {label:'Anatomic Pathology - All Reports',grp:['Autopsy','Cytology','Electron Microscopy','Surgical Pathology']},
    {label:'Blood Bank',s:'bloodbank'},{label:'Lab Orders (All)',s:'laborders'},{label:'Cumulative',s:'cumulative'},
  ];
  items.forEach(function(it){
    if(it.grp){
      var grpOpen=false;
      var g=document.createElement('div'); g.className='ti'; g.style.fontStyle='italic';
      g.innerHTML='<span class="arrow">&#9658;</span>'+it.label; ltree.appendChild(g);
      var children=[];
      it.grp.forEach(function(c){
        var ci=document.createElement('div'); ci.className='ti indent1'; ci.textContent=c; ci.style.display='none';
        ci.onclick=function(){ ltree.querySelectorAll('.ti').forEach(function(x){x.classList.remove('sel');}); ci.classList.add('sel'); labsSection('anat'); };
        ltree.appendChild(ci); children.push(ci);
      });
      g.onclick=function(){
        grpOpen=!grpOpen;
        g.querySelector('.arrow').innerHTML=grpOpen?'&#9660;':'&#9658;';
        children.forEach(function(ci){ci.style.display=grpOpen?'':'none';});
      };
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
    if(sec!=='worksheet') closeWin('select-labs-dlg');
    var toolbar=document.createElement('div'); toolbar.className='labs-toolbar';
    if(['worksheet','overview','micro','most-recent','selected','alltests'].indexOf(sec)>-1){
      toolbar.innerHTML='<label><input type="radio" name="ldr" checked> Date Range...</label><label><input type="radio" name="ldr"> Today</label><label><input type="radio" name="ldr"> 1 Week</label><label><input type="radio" name="ldr"> 1 Month</label><label><input type="radio" name="ldr"> 6 Months</label><label><input type="radio" name="ldr"> 1 Year</label><label><input type="radio" name="ldr"> 2 Years</label><label><input type="radio" name="ldr"> All Results</label>';
    }
    if(toolbar.innerHTML) right.appendChild(toolbar);
    var hdr=document.createElement('div'); hdr.className='labs-hdr';
    var body=document.createElement('div'); body.style.cssText='flex:1;overflow-y:auto;background:#fffff0;padding:4px 6px';

    if(sec==='worksheet'){
      var toolbar2=document.createElement('div'); toolbar2.className='labs-toolbar2';
      toolbar2.innerHTML='<div class="tbar2-group"><span class="tbar2-lbl">Table Format</span><label><input type="radio" name="ltf" checked> Horizontal</label><label><input type="radio" name="ltf"> Vertical</label></div><div class="tbar2-group"><span class="tbar2-lbl">Other Formats</span><label><input type="radio" name="lof" checked> Comments</label><label><input type="radio" name="lof"> Graph</label></div><div class="tbar2-group"><label><input type="checkbox"> Zoom</label><label><input type="checkbox"> 3D</label><label><input type="checkbox"> Values</label></div><div class="tbar2-group"><label><input type="checkbox"> Abnormal Results Only</label></div>';
      right.appendChild(toolbar2);
      hdr.textContent='Worksheet'; right.appendChild(hdr);
      body.style.cssText='flex:1;overflow:auto;background:#fffff0;font-family:Arial;font-size:11px';
      right.appendChild(body);
      var commentPane=document.createElement('div'); commentPane.className='ws-comment-pane'; right.appendChild(commentPane);
      openSelectLabsDlg(pt, body, hdr, commentPane);
      return;
    } else if(sec==='most-recent'){
      hdr.textContent='Most Recent'; right.appendChild(hdr);
      // Sort a copy chronologically (oldest->newest) rather than trusting pt.labs'
      // authoring order in data.js, so Oldest/Previous/Next/Newest always behave
      // correctly regardless of how a given patient's panels happen to be listed.
      var mrPanels=pt.labs.slice().sort(function(a,b){ return (getPanelDate(a)||'')<(getPanelDate(b)||'')?-1:1; });
      var mrIdx=mrPanels.length-1;
      var nav=document.createElement('div'); nav.className='labs-most-recent-nav';
      function renderMR(idx){
        nav.innerHTML='';
        var oldest=document.createElement('button'); oldest.className='btn'; oldest.textContent='<< Oldest'; oldest.onclick=function(){renderMR(0);};
        var prev=document.createElement('button'); prev.className='btn'; prev.textContent='< Previous'; if(idx===0) prev.disabled=true; prev.onclick=function(){if(idx>0)renderMR(idx-1);};
        var next=document.createElement('button'); next.className='btn'; next.textContent='Next >'; if(idx>=mrPanels.length-1) next.disabled=true; next.onclick=function(){if(idx<mrPanels.length-1)renderMR(idx+1);};
        var newest=document.createElement('button'); newest.className='btn'; newest.textContent='Newest >>'; newest.onclick=function(){renderMR(mrPanels.length-1);};
        [oldest,prev,next,newest].forEach(function(b){nav.appendChild(b);});
        var specimenLbl=document.createElement('span'); specimenLbl.style.cssText='margin-left:8px;font-size:11px;font-weight:bold';
        var panel=mrPanels[idx];
        specimenLbl.textContent='Specimen: '+(panel.specimen||'SERUM'); nav.appendChild(specimenLbl);
        var t='<div style="font-size:11px;font-weight:bold;padding:2px 4px;background:#e8e8e8">Specimen: '+(panel.specimen||'SERUM')+'</div>';
        t+='<table class="labs-tbl" id="mr-tbl"><thead><tr>'
          +'<th style="width:140px">Collection Date/Time<span class="col-resize-handle"></span></th>'
          +'<th>Test<span class="col-resize-handle"></span></th>'
          +'<th>Result / Status<span class="col-resize-handle"></span></th>'
          +'<th style="width:50px">Flag<span class="col-resize-handle"></span></th>'
          +'<th style="width:70px">Units<span class="col-resize-handle"></span></th>'
          +'<th>Ref Range<span class="col-resize-handle"></span></th>'
          +'</tr></thead><tbody>';
        var dt=getPanelDate(panel)||'';
        var vi=getPanelValIdx(panel);
        var ri2=getPanelRefIdx(panel);
        panel.rows.forEach(function(r,ri){
          var raw=r.v[vi]||''; var flag=r.f&&r.f[vi]||'';
          var ref=r.v[ri2]||'';
          var pv=splitValueUnit(raw);
          t+='<tr>'+(ri===0?'<td rowspan="'+panel.rows.length+'" style="vertical-align:top;padding:2px 4px;font-size:11px;border-right:1px solid #aaa;white-space:nowrap">'+dt+'</td>':'')+'<td>'+r.t+'</td><td>'+pv.val+'</td><td>'+flag+'</td><td>'+pv.unit+'</td><td>'+ref+'</td></tr>';
        });
        t+='</tbody></table>';
        body.innerHTML=t; body.style.fontFamily='Arial';
        setTimeout(function(){ var tbl=document.getElementById('mr-tbl'); if(tbl) makeColumnsResizable(tbl); },0);
      }
      right.appendChild(nav); right.appendChild(body);
      renderMR(mrIdx);
    } else if(sec==='overview'){
      hdr.textContent='Lab Overview (Collected Specimens) [From: EARLIEST to Jun 29, 2026]'; right.appendChild(hdr);
      var ovTop=document.createElement('div'); ovTop.style.cssText='flex:1;overflow-y:auto;background:#fffff0;font-family:Arial';
      var ovBot=document.createElement('div'); ovBot.style.cssText='height:240px;overflow-y:auto;border-top:2px solid #808080;background:#fffff0;padding:4px 8px;font-family:"Courier New",monospace;font-size:11px;white-space:pre-wrap;flex-shrink:0';
      ovBot.textContent='Results';
      var t2='<div style="font-size:10px;color:#555;padding:2px 4px">A maximum of 1000 per site will be displayed regardless of the number available within the specified date range.</div>';
      t2+='<table class="labs-tbl" id="labs-ov-tbl"><thead><tr>'
        +'<th style="width:140px">Collection Date/Time<span class="col-resize-handle"></span></th>'
        +'<th>Test Name<span class="col-resize-handle"></span></th>'
        +'<th style="width:50px">Critical<span class="col-resize-handle"></span></th>'
        +'<th style="width:70px">Specimen<span class="col-resize-handle"></span></th>'
        +'<th style="width:80px">Provider<span class="col-resize-handle"></span></th>'
        +'<th style="width:75px">Status<span class="col-resize-handle"></span></th>'
        +'<th style="width:25px">[+]</th>'
        +'</tr></thead><tbody>';
      pt.labs.forEach(function(p,pi){
        var dt=getPanelDate(p)||'06/20/2026 06:00';
        t2+='<tr class="labs-ov-row" data-idx="'+pi+'"><td>'+dt+'</td><td>'+p.name+'</td><td></td><td>'+(p.specimen||'SERUM')+'</td><td>'+(p.provider||'TORRES')+'</td><td>COMPLETED</td><td style="color:#0000cc">[+]</td></tr>';
      });
      t2+='</tbody></table>'; ovTop.innerHTML=t2;
      right.appendChild(ovTop); right.appendChild(ovBot);
      var ovTbl=ovTop.querySelector('#labs-ov-tbl');
      if(ovTbl) makeColumnsResizable(ovTbl);
      ovTop.querySelectorAll('.labs-ov-row').forEach(function(tr){
        tr.style.cursor='pointer';
        tr.onclick=function(){
          ovTop.querySelectorAll('.labs-ov-row').forEach(function(r){r.classList.remove('sel');});
          tr.classList.add('sel');
          var panel=pt.labs[parseInt(tr.dataset.idx)];
          var dt=getPanelDate(panel)||'06/20/2026 06:00';
          var txt='Results\n'+panel.name+'\n\nCollection time: '+dt+'\n\n';
          txt+='  Test Name                      Result      Units       Range\n';
          txt+='  ----------                     ------      -----       -----\n';
          panel.rows.forEach(function(r){
            var vi2=getPanelValIdx(panel); var ri3=getPanelRefIdx(panel);
            var val=r.v[vi2]||''; var flag=r.f&&r.f[vi2]||''; var ref=r.v[ri3]||'';
            txt+='  '+(r.t+(flag?' '+flag:'')).padEnd(35)+(val).padEnd(12)+'            '+ref+'\n';
          });
          ovBot.textContent=txt;
        };
      });
      return;
    } else if(sec==='micro'){
      hdr.textContent='Microbiology [From: EARLIEST RESULT to Jun 29, 2026]'; right.appendChild(hdr);
      var microRows=collectMicroRows(pt);
      var t3='<table class="labs-tbl" id="micro-tbl"><thead><tr><th style="width:120px">Collection Date/Time</th><th>Microbiology Test Name</th><th style="width:90px">Collection Sample</th><th style="width:70px">Specimen</th><th style="width:75px">Accession #</th><th style="width:25px">[+]</th></tr></thead><tbody>';
      if(microRows.length){
        microRows.forEach(function(m,i){
          t3+='<tr class="micro-row" data-idx="'+i+'"><td>'+m.dt+'</td><td>'+m.test+'</td><td></td><td>'+m.specimen+'</td><td></td><td style="color:#0000cc">[+]</td></tr>';
        });
      } else {
        t3+='<tr><td colspan="6" style="color:#555;font-style:italic;padding:6px">No microbiology results found for this patient.</td></tr>';
      }
      t3+='</tbody></table>';
      body.innerHTML=t3; body.style.fontFamily='Arial'; right.appendChild(body);
      if(microRows.length){
        var microDetail=document.createElement('div'); microDetail.id='micro-detail';
        microDetail.style.cssText='border-top:1px solid #aaa;margin-top:4px;padding:6px;font-family:\'Courier New\',monospace;font-size:11px;white-space:pre-wrap;background:#fffff0';
        microDetail.textContent='Select a result above to view details.';
        right.appendChild(microDetail);
        setTimeout(function(){
          var tbl=document.getElementById('micro-tbl'); if(tbl) makeColumnsResizable(tbl);
          body.querySelectorAll('.micro-row').forEach(function(tr){
            tr.onclick=function(){
              body.querySelectorAll('.micro-row').forEach(function(r){r.classList.remove('sel');});
              tr.classList.add('sel');
              var m=microRows[parseInt(tr.dataset.idx)];
              microDetail.textContent=m.test+'\nCollected: '+m.dt+'\n\nResult: '+m.val+(m.flag?' '+m.flag:'')+'\nReference: '+m.ref;
            };
          });
        },0);
      }
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
  labsSection('most-recent');
}

function specimenFromTest(t){
  if(/blood/i.test(t)) return 'Blood';
  if(/sputum/i.test(t)) return 'Sputum';
  if(/wound|abscess/i.test(t)) return 'Wound';
  if(/urine/i.test(t)) return 'Urine';
  return '';
}
function collectMicroRows(pt){
  var out=[];
  (pt.labs||[]).forEach(function(panel){
    var isMicroPanel=/microbiology/i.test(panel.name);
    var dateIdx=panel.cols.indexOf('Date');
    panel.rows.forEach(function(r){
      var isCultureRow=/culture|\bcx\b|sensitivity|gram stain|c&s/i.test(r.t);
      if(!isMicroPanel && !isCultureRow) return;
      var rawDate=dateIdx>-1?r.v[dateIdx]:'';
      var dt=rawDate?(labColToDateTime(rawDate)||rawDate+'/2026 06:00'):(getPanelDate(panel)||'');
      out.push({dt:dt,test:r.t,val:r.v[0]||'',flag:(r.f&&r.f[0])||'',ref:r.v[panel.cols.length-1]||'',specimen:panel.specimen||specimenFromTest(r.t)});
    });
  });
  out.sort(function(a,b){ return a.dt<b.dt?1:-1; });
  return out;
}
function splitValueUnit(raw){
  if(!raw) return {val:raw||'',unit:''};
  var m=raw.match(/^([<>]?-?\d[\d,.]*)\s*(%|[A-Za-z]+(?:\/[A-Za-z0-9]+)?)(\s*\*+)?$/);
  if(!m) return {val:raw,unit:''};
  return {val:m[1]+(m[3]||''),unit:m[2]};
}
function labColToDateTime(col){
  if(!col) return '';
  var m=col.match(/^(\d{2}\/\d{2})(?:\s*(.*))?$/);
  if(!m) return null; // not a date column
  var datePart=m[1], label=(m[2]||'').trim().replace(/^\((.*)\)$/,'$1');
  var offsetH=0;
  var offM=label.match(/^\+(\d+)h$/i);
  if(offM) offsetH=parseInt(offM[1],10);
  else if(/^Adm$/i.test(label)) offsetH=0;
  var isAmPm=/^(AM|PM)$/i.test(label);
  var pm=/^PM$/i.test(label);
  var baseHour=pm?18:6;
  var hour=(baseHour+offsetH)%24;
  var time=(hour<10?'0':'')+hour+':00';
  var suffix=(isAmPm||offM||/^Adm$/i.test(label))?'':(label?' ('+label+')':'');
  return datePart+'/2026 '+time+suffix;
}
function getPanelDate(panel){
  if(!panel||!panel.cols||!panel.cols.length) return '';
  if(/^\d/.test(panel.cols[0])){
    // date-column panel: second-to-last col is most recent date
    return labColToDateTime(panel.cols[panel.cols.length-2])||'';
  }
  // Value/Date panel: date stored as value in each row
  var di=panel.cols.indexOf('Date');
  if(di>-1&&panel.rows&&panel.rows.length){
    var d=panel.rows[0].v[di]||'';
    return d?labColToDateTime(d)||d+'/2026 06:00':'';
  }
  // Result/Reference panel: extract date from panel name e.g. "URINALYSIS (06/18)"
  // or "ABG (06/19 17:20)" / "ARTERIAL BLOOD GAS (06/19 RA)" — tolerate trailing
  // text inside the parens after the date.
  var m=panel.name.match(/\((\d{2}\/\d{2})[^)]*\)/);
  return m?m[1]+'/2026 06:00':'';
}
function getPanelValIdx(panel){
  // index into r.v[] for the current/latest value
  if(/^\d/.test(panel.cols[0])) return panel.cols.length-2;
  return 0; // Value/Result panels: col 0 is the value
}
function getPanelRefIdx(panel){
  return panel.cols.length-1; // ref range is always last col
}
var _slTarget={body:null,hdr:null,comment:null,pt:null};
var _slAllTests=['Sodium','Potassium','BUN','CO2','Creatinine','Glucose','eGFR','WBC','HGB','HCT','PLT','MCV','ALT','AST','Alkaline Phos','Total Bili','Albumin','Total Protein','Calcium','Magnesium','Phosphorus','Chloride','Uric Acid','LDH','Lipase','Troponin I','BNP','HgbA1c','TSH','Free T4','PSA','INR','PTT','D-Dimer','Ferritin','Iron','TIBC','Folate','B12','Urine Protein','Urine Creatinine','Microalbumin'];

function openSelectLabsDlg(pt,body,hdr,commentPane){
  _slTarget={body:body,hdr:hdr,comment:commentPane,pt:pt};
  var grpSel=document.getElementById('sl-group-list');
  grpSel.innerHTML='';
  pt.labs.forEach(function(p,i){
    var opt=document.createElement('option'); opt.value=i;
    opt.textContent=(i+1)+') '+p.rows.slice(0,6).map(function(r){return r.t;}).join(', ');
    grpSel.appendChild(opt);
  });
  var testList=document.getElementById('sl-test-list');
  testList.innerHTML=''; document.getElementById('sl-test-search').value='';
  _slAllTests.forEach(function(t){
    var opt=document.createElement('option'); opt.textContent=t; testList.appendChild(opt);
  });
  document.getElementById('sl-display-list').innerHTML='';
  showFloatWin('select-labs-dlg');
  makeDraggable('select-labs-dlg');
}
function slGroupSelected(){
  var grpSel=document.getElementById('sl-group-list');
  var idx=parseInt(grpSel.value);
  if(isNaN(idx)||!_slTarget.pt) return;
  var panel=_slTarget.pt.labs[idx];
  var dispList=document.getElementById('sl-display-list');
  dispList.innerHTML='';
  panel.rows.forEach(function(r){
    var opt=document.createElement('option'); opt.textContent=r.t; dispList.appendChild(opt);
  });
}
function slFilterTests(){
  var q=document.getElementById('sl-test-search').value.toLowerCase();
  var testList=document.getElementById('sl-test-list');
  testList.innerHTML='';
  _slAllTests.filter(function(t){return t.toLowerCase().indexOf(q)>-1;}).forEach(function(t){
    var opt=document.createElement('option'); opt.textContent=t; testList.appendChild(opt);
  });
}
function slAddTest(){
  var testList=document.getElementById('sl-test-list');
  var dispList=document.getElementById('sl-display-list');
  Array.prototype.forEach.call(testList.selectedOptions,function(o){
    var already=Array.prototype.some.call(dispList.options,function(x){return x.textContent===o.textContent;});
    if(!already){var opt=document.createElement('option'); opt.textContent=o.textContent; dispList.appendChild(opt);}
  });
}
function slRemoveAll(){ document.getElementById('sl-display-list').innerHTML=''; }
function slRemoveOne(){
  var dispList=document.getElementById('sl-display-list');
  Array.prototype.slice.call(dispList.selectedOptions).forEach(function(o){o.remove();});
}
function slMoveUp(){
  var dispList=document.getElementById('sl-display-list');
  var opts=Array.prototype.slice.call(dispList.options);
  opts.forEach(function(o,i){if(o.selected&&i>0){dispList.insertBefore(o,opts[i-1]);}});
}
function slMoveDown(){
  var dispList=document.getElementById('sl-display-list');
  var opts=Array.prototype.slice.call(dispList.options);
  for(var i=opts.length-2;i>=0;i--){if(opts[i].selected)dispList.insertBefore(opts[i+1],opts[i]);}
}
function slOK(){
  closeWin('select-labs-dlg');
  var dispList=document.getElementById('sl-display-list');
  var selectedTests=Array.prototype.map.call(dispList.options,function(o){return o.textContent;});
  if(!selectedTests.length||!_slTarget.pt) return;
  var pt=_slTarget.pt;
  var body=_slTarget.body;
  var hdr=_slTarget.hdr;
  var commentPane=_slTarget.comment;
  // find panels that contain any of the selected tests
  var allRows={};
  selectedTests.forEach(function(t){allRows[t]=null;});
  var dateMap={};
  var allDates=[];
  pt.labs.forEach(function(panel){
    // Skip panels that don't contain any of the selected tests at all,
    // so unrelated panels (e.g. an ABG panel when BMP tests are selected)
    // don't inject empty date rows into the trend table.
    var panelHasSelected=panel.rows.some(function(r){return selectedTests.indexOf(r.t)>-1;});
    if(!panelHasSelected) return;
    // Only iterate over true date columns (those matching MM/DD pattern)
    panel.cols.forEach(function(rawDt,di){
      var dt=labColToDateTime(rawDt);
      if(!dt) return; // skip non-date columns like "Ref","Value","Result","Date","Reference"
      if(!dateMap[dt]){dateMap[dt]={dt:dt,vals:{},flags:{},specimen:panel.specimen||'Serum **'};allDates.push(dt);}
      panel.rows.forEach(function(r){
        if(selectedTests.indexOf(r.t)>-1){
          dateMap[dt].vals[r.t]=r.v[di]||'';
          dateMap[dt].flags[r.t]=r.f&&r.f[di]||'';
        }
      });
    });
  });
  hdr.textContent='Worksheet [From: Dec 26,1996 to Jun 29,2026]';
  var h='<table class="labs-tbl" id="ws-tbl" style="font-size:11px"><thead><tr>';
  h+='<th style="width:110px">Date/Time<span class="col-resize-handle"></span></th><th style="width:80px">Specimen<span class="col-resize-handle"></span></th>';
  selectedTests.forEach(function(t){h+='<th>'+t+'<span class="col-resize-handle"></span></th>';});
  h+='</tr></thead><tbody>';
  allDates.forEach(function(dt){
    var row=dateMap[dt];
    h+='<tr><td class="ws-fixed-col" style="white-space:nowrap">'+dt+'</td>';
    h+='<td class="ws-fixed-col">'+row.specimen+'</td>';
    selectedTests.forEach(function(t){
      var val=row.vals[t]||''; var flag=row.flags[t]||'';
      var display=val+(flag?' '+flag:'');
      h+='<td>'+display+'</td>';
    });
    h+='</tr>';
  });
  h+='</tbody></table>';
  body.innerHTML=h;
  var wsTbl=document.getElementById('ws-tbl'); if(wsTbl) makeColumnsResizable(wsTbl);
  commentPane.textContent='KEY: "L"=Abnormal Low  "H"=Abnormal High  "***"=Critical Value';
  // wire row click to show comment
  var rows=body.querySelectorAll('tbody tr');
  rows.forEach(function(tr,i){
    tr.onclick=function(){
      body.querySelectorAll('tbody tr').forEach(function(r){r.classList.remove('sel');});
      tr.classList.add('sel');
      var dt=allDates[i];
      commentPane.textContent=dt+' ** Comments:\n(No comments for this collection time)';
    };
  });
}

