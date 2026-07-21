var _notesViewSettings = {max:1000, contains:''};
// Persists for the session once toggled on via View > Unsigned Notes --
// reorganizes the tree into "All unsigned notes for <user>" / "All signed
// notes" groups, matching real CPRS. Separate from the one-time "Alerted
// Note" section below, which only appears immediately after arriving via a
// Notifications double-click and disappears on the next render (tab switch).
var _notesUnsignedViewActive = false;
function renderNotes(pt){
  document.getElementById('left-pane').style.display='none';
  document.getElementById('right-pane').style.display='none';
  var mp=document.getElementById('main-panes');
  var maxReturn = _notesViewSettings.max || 1000;
  var containsFilter = (_notesViewSettings.contains||'').toLowerCase();
  var viewNotes = pt.notes.slice(0, maxReturn);

  var alertedNote = null;
  if(typeof _notifAlertedNote!=='undefined' && _notifAlertedNote && _notifAlertedNote.ptKey===currentPt){
    (pt.notes||[]).forEach(function(nt){ if(nt.notifId===_notifAlertedNote.noteId) alertedNote=nt; });
    _notifAlertedNote=null; // one-time -- gone on the next render of this tab
  }

  var outer=document.createElement('div'); outer.id='notes-outer';
  var left=document.createElement('div'); left.id='notes-left';
  var th=document.createElement('div'); th.className='tree-hdr';
  th.textContent='Last '+maxReturn+' Signed Notes (Total: '+(pt.notes.length*7+33)+')';
  left.appendChild(th);
  var tree=document.createElement('div'); tree.className='tree-body';

  function appendNoteRow(n){
    var isMatch = containsFilter && n.title.toLowerCase().indexOf(containsFilter)>-1;
    var d=document.createElement('div'); d.className='nt-item'+(isMatch?' nt-bold':'');
    d.innerHTML='<span style="font-size:9px;flex-shrink:0">&#128196;</span><span style="font-size:10px;overflow:hidden;text-overflow:ellipsis">'+n.date+' '+n.title+', '+n.loc+', '+n.auth+'</span>';
    d.onclick=(function(note){return function(){ tree.querySelectorAll('.nt-item').forEach(function(x){x.classList.remove('sel');}); d.classList.add('sel'); loadNote(note); };})(n);
    if(n.needsSign) d.oncontextmenu=(function(note){return function(ev){ return showNoteCtxMenu(ev,pt,note); };})(n);
    tree.appendChild(d);
    return d;
  }

  var alertedRow=null;
  if(_notesUnsignedViewActive){
    var grpHdr=document.createElement('div'); grpHdr.className='nt-grp';
    grpHdr.textContent='All unsigned notes for '+NOTIF_CURRENT_USER;
    tree.appendChild(grpHdr);
    var unsigned=(pt.notes||[]).filter(function(nt){ return nt.needsSign; });
    if(unsigned.length) unsigned.forEach(function(n){ appendNoteRow(n); });
    else { var e=document.createElement('div'); e.style.cssText='padding:3px 6px;font-size:11px;color:#555;font-style:italic'; e.textContent='No unsigned notes.'; tree.appendChild(e); }
    var grpHdr2=document.createElement('div'); grpHdr2.className='nt-grp';
    grpHdr2.textContent='All signed notes';
    tree.appendChild(grpHdr2);
    viewNotes.filter(function(nt){ return !nt.needsSign; }).forEach(function(n){ appendNoteRow(n); });
  } else {
    if(alertedNote){
      var aHdr=document.createElement('div'); aHdr.className='nt-grp';
      aHdr.textContent='Alerted Note';
      tree.appendChild(aHdr);
      alertedRow=appendNoteRow(alertedNote);
    }
    viewNotes.forEach(function(n){ appendNoteRow(n); });
  }
  left.appendChild(tree);
  var ba=document.createElement('div'); ba.className='btn-area';
  ba.innerHTML='<button class="btn" id="tpl-toggle-btn" style="width:100%;text-align:center" onclick="toggleTemplatesAccordion()">&#9656; / Templates</button>'+
    '<div id="tpl-accordion" style="display:none">'+
      '<div class="tpl-row lvl0"><span class="tpl-caret">&#9656;</span><span class="tpl-icon">&#128193;</span>My Templates</div>'+
      '<div class="tpl-row lvl0"><span class="tpl-caret">&#9662;</span><span class="tpl-icon">&#128193;</span>SHARED TEMPLATES</div>'+
      '<div class="tpl-row lvl1"><span class="tpl-caret">&#9656;</span><span class="tpl-icon">&#128193;</span>TESTING</div>'+
      '<div class="tpl-row lvl1"><span class="tpl-caret"></span><span class="tpl-icon">&#128209;</span>Active INPATIENT Medications</div>'+
      '<div class="tpl-row lvl1"><span class="tpl-caret"></span><span class="tpl-icon">&#128209;</span>Active OUTPT\\Pending\\Expired meds</div>'+
      '<div class="tpl-row lvl1"><span class="tpl-caret"></span><span class="tpl-icon">&#128209;</span>Active OUTPT\\Pending\\Expired meds w/supplies</div>'+
      '<div class="tpl-row lvl1"><span class="tpl-caret">&#9656;</span><span class="tpl-icon">&#128193;</span>Administrative Medicine</div>'+
      '<div class="tpl-row lvl1"><span class="tpl-caret"></span><span class="tpl-icon">&#128209;</span>ADMINISTRATIVE SIGNATURE</div>'+
      '<div class="tpl-row lvl1"><span class="tpl-caret">&#9656;</span><span class="tpl-icon">&#128193;</span>Age-Friendly 4Ms</div>'+
      '<div class="tpl-row lvl1"><span class="tpl-caret">&#9656;</span><span class="tpl-icon">&#128193;</span>Allergy/Immunology</div>'+
      '<div class="tpl-row lvl1"><span class="tpl-caret">&#9656;</span><span class="tpl-icon">&#128193;</span>Ambulatory Surgery</div>'+
      '<div class="tpl-row lvl1"><span class="tpl-caret">&#9656;</span><span class="tpl-icon">&#128193;</span>Anesthesia</div>'+
      '<div class="tpl-row lvl1"><span class="tpl-caret">&#9656;</span><span class="tpl-icon">&#128193;</span>Attending Addenda</div>'+
      '<div class="tpl-row lvl1"><span class="tpl-caret">&#9656;</span><span class="tpl-icon">&#128193;</span>AUDIOLOGY</div>'+
      '<div class="tpl-row lvl1"><span class="tpl-caret">&#9656;</span><span class="tpl-icon">&#128193;</span>BACC</div>'+
    '</div>'+
    '<button class="btn" style="width:100%;text-align:center" onclick="openEncounter()">Encounter</button><button class="btn" style="width:100%;text-align:center" onclick="showFloatWin(\'new-note-dlg\')">New Note</button>';
  left.appendChild(ba); outer.appendChild(left);
  var resizer=document.createElement('div'); resizer.id='notes-left-resizer';
  outer.appendChild(resizer);
  var right=document.createElement('div'); right.id='notes-right';
  var listHdr=document.createElement('div'); listHdr.id='notes-list-hdr'; listHdr.textContent='Notes';
  var listPane=document.createElement('div'); listPane.id='notes-list-pane';
  var detailBody=document.createElement('div'); detailBody.id='notes-detail-body'; detailBody.style.display='none';
  right.appendChild(listHdr); right.appendChild(listPane); right.appendChild(detailBody);
  outer.appendChild(right); mp.appendChild(outer);

  makePaneResizable(left,resizer);

  function renderList(){
    listHdr.style.display=''; listPane.style.display=''; detailBody.style.display='none';
    var allNotes=viewNotes;
    var lh='<table class="notes-list-tbl" id="notes-list-table"><thead><tr>'+
      '<th style="width:75px">Date<span class="col-resize-handle"></span></th>'+
      '<th style="width:260px">Title<span class="col-resize-handle"></span></th>'+
      '<th style="width:160px">Author<span class="col-resize-handle"></span></th>'+
      '<th>Location</th></tr></thead><tbody>';
    allNotes.forEach(function(n){
      var isMatch = containsFilter && n.title.toLowerCase().indexOf(containsFilter)>-1;
      lh+='<tr'+(isMatch?' class="nt-bold"':'')+'><td>'+n.date+'</td><td>'+n.title+'</td><td>'+n.auth+'</td><td>'+n.loc+'</td></tr>';
    });
    lh+='</tbody></table>'; listPane.innerHTML=lh;
    var tbl=document.getElementById('notes-list-table');
    Array.prototype.forEach.call(tbl.querySelectorAll('tbody tr'),function(tr,i){
      tr.onclick=function(){
        var n=allNotes[i];
        tree.querySelectorAll('.nt-item').forEach(function(x){x.classList.remove('sel');});
        var match=Array.prototype.filter.call(tree.querySelectorAll('.nt-item'),function(x){return x.textContent.indexOf(n.title)>-1;})[0];
        if(match) match.classList.add('sel');
        loadNote(n);
      };
    });
    makeColumnsResizable(tbl);
  }

  function loadNote(n){
    listHdr.style.display='none'; listPane.style.display='none';
    detailBody.style.display='block';
    detailBody.innerHTML='';
    var body=document.createElement('div');
    body.textContent=n.body;
    detailBody.appendChild(body);
  }

  if(alertedNote && alertedRow){
    alertedRow.classList.add('sel');
    loadNote(alertedNote);
  } else {
    renderList();
  }
}
// Right-click on an unsigned note's tree row -- "Sign Note..." is the only
// real action here, matching the app's existing right-click convention
// (Orders/Meds context menus) rather than a banner/button inside the note.
function showNoteCtxMenu(ev,pt,note){
  ev.preventDefault();
  closeNoteCtxMenu();
  var m=document.createElement('div'); m.className='ctx-menu'; m.id='note-ctx-menu';
  var item=document.createElement('div'); item.className='ctx-item'; item.textContent='Sign Note...';
  item.onclick=function(e){ e.stopPropagation(); closeNoteCtxMenu(); signNoteAndProcess(pt,note); };
  m.appendChild(item);
  document.body.appendChild(m);
  var x=ev.pageX, y=ev.pageY;
  var maxX=window.innerWidth-160, maxY=window.innerHeight-40;
  m.style.left=Math.min(x,maxX)+'px'; m.style.top=Math.min(y,maxY)+'px';
  setTimeout(function(){ document.addEventListener('click',closeNoteCtxMenu,{once:true}); },0);
  return false;
}
function closeNoteCtxMenu(){ var m=document.getElementById('note-ctx-menu'); if(m) m.remove(); }
function signNoteAndProcess(pt,note){
  note.needsSign=false;
  note.body = note.body.replace('STATUS: UNSIGNED','STATUS: COMPLETED')
    .replace('/es/ '+note.auth, '/es/ '+note.auth+'\nSigned: '+_notifNowStr());
  if(note.notifId && typeof _resolveNotification==='function') _resolveNotification(note.notifId);
  renderNotes(pt);
}
function makePaneResizable(paneEl,handleEl){
  var mx,startW;
  handleEl.onmousedown=function(e){
    e.preventDefault(); mx=e.clientX; startW=paneEl.offsetWidth;
    document.onmousemove=function(e){
      var dx=e.clientX-mx;
      var w=Math.max(220,Math.min(800,startW+dx));
      paneEl.style.width=w+'px';
    };
    document.onmouseup=function(){ document.onmousemove=null; document.onmouseup=null; };
  };
}
function makeColumnsResizable(tbl){
  var ths=tbl.querySelectorAll('thead th');
  Array.prototype.forEach.call(ths,function(th){
    var handle=th.querySelector('.col-resize-handle');
    if(!handle) return;
    handle.onmousedown=function(e){
      e.preventDefault(); e.stopPropagation();
      var mx=e.clientX, startW=th.offsetWidth;
      document.onmousemove=function(e){
        var dx=e.clientX-mx;
        th.style.width=Math.max(30,startW+dx)+'px';
      };
      document.onmouseup=function(){ document.onmousemove=null; document.onmouseup=null; };
    };
  });
}

function toggleTemplatesAccordion(){
  var acc=document.getElementById('tpl-accordion');
  var btn=document.getElementById('tpl-toggle-btn');
  if(!acc||!btn) return;
  var open = acc.style.display!=='none';
  acc.style.display = open ? 'none' : 'block';
  btn.innerHTML = (open?'&#9656;':'&#9662;')+' / Templates';
}

function viewUnsignedNotes(){
  if(!currentPt) return;
  _notesUnsignedViewActive=true;
  renderNotes(PTS[currentPt]);
}
function openCustomView(){
  if(!currentPt) return;
  document.getElementById('cv-max-return').value = _notesViewSettings.max;
  document.getElementById('cv-contains').value = _notesViewSettings.contains;
  showFloatWin('custom-view-dlg');
}
function applyCustomView(){
  var maxVal = parseInt(document.getElementById('cv-max-return').value, 10);
  _notesViewSettings.max = (maxVal>0) ? maxVal : 1000;
  _notesViewSettings.contains = document.getElementById('cv-contains').value.trim();
  closeWin('custom-view-dlg');
  if(currentTab==='notes') renderTab('notes');
}
function clearCustomView(){
  document.getElementById('cv-max-return').value = 1000;
  document.getElementById('cv-contains').value = '';
}
