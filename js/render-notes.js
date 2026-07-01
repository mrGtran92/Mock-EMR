var _notesViewSettings = {max:1000, contains:''};
function renderNotes(pt){
  document.getElementById('left-pane').style.display='none';
  document.getElementById('right-pane').style.display='none';
  var mp=document.getElementById('main-panes');
  var maxReturn = _notesViewSettings.max || 1000;
  var containsFilter = (_notesViewSettings.contains||'').toLowerCase();
  var viewNotes = pt.notes.slice(0, maxReturn);
  var outer=document.createElement('div'); outer.id='notes-outer';
  var left=document.createElement('div'); left.id='notes-left';
  var th=document.createElement('div'); th.className='tree-hdr';
  th.textContent='Last '+maxReturn+' Signed Notes (Total: '+(pt.notes.length*7+33)+')';
  left.appendChild(th);
  var tree=document.createElement('div'); tree.className='tree-body';
  var grouped={};
  viewNotes.forEach(function(n){ if(!grouped[n.date]) grouped[n.date]=[]; grouped[n.date].push(n); });
  Object.keys(grouped).forEach(function(dk){
    var g=document.createElement('div'); g.className='nt-grp';
    g.innerHTML='<span style="font-size:10px">&#9660;</span><span>'+dk+'</span>';
    tree.appendChild(g);
    grouped[dk].forEach(function(n){
      var isMatch = containsFilter && n.title.toLowerCase().indexOf(containsFilter)>-1;
      var d=document.createElement('div'); d.className='nt-item indent1'+(isMatch?' nt-bold':'');
      d.innerHTML='<span style="font-size:9px;flex-shrink:0">&#128196;</span><span style="font-size:10px;overflow:hidden;text-overflow:ellipsis">'+dk+' '+n.title+', '+n.loc+', '+n.auth+'</span>';
      d.onclick=(function(note){return function(){ tree.querySelectorAll('.nt-item').forEach(function(x){x.classList.remove('sel');}); d.classList.add('sel'); loadNote(note); };})(n);
      tree.appendChild(d);
    });
  });
  left.appendChild(tree);
  var ba=document.createElement('div'); ba.className='btn-area';
  ba.innerHTML='<button class="btn" style="width:100%;text-align:center" onclick="showFloatWin(\'templates-dlg\')">/ Templates</button><button class="btn" style="width:100%;text-align:center" onclick="openEncounter()">Encounter</button><button class="btn" style="width:100%;text-align:center" onclick="showFloatWin(\'new-note-dlg\')">New Note</button>';
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
    detailBody.textContent=n.body;
  }

  renderList();
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
