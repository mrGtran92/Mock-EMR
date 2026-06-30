function renderNotes(pt){
  document.getElementById('left-pane').style.display='none';
  document.getElementById('right-pane').style.display='none';
  var mp=document.getElementById('main-panes');
  var outer=document.createElement('div'); outer.id='notes-outer';
  var left=document.createElement('div'); left.id='notes-left';
  var th=document.createElement('div'); th.className='tree-hdr';
  th.textContent='Last 1000 Signed Notes (Total: '+(pt.notes.length*7+33)+')';
  left.appendChild(th);
  var tree=document.createElement('div'); tree.className='tree-body';
  var grouped={};
  pt.notes.forEach(function(n){ if(!grouped[n.date]) grouped[n.date]=[]; grouped[n.date].push(n); });
  var first=true;
  Object.keys(grouped).forEach(function(dk){
    var g=document.createElement('div'); g.className='nt-grp';
    g.innerHTML='<span style="font-size:10px">&#9660;</span><span>'+dk+'</span>';
    tree.appendChild(g);
    grouped[dk].forEach(function(n){
      var d=document.createElement('div'); d.className='nt-item indent1'+(first?' sel':'');
      d.innerHTML='<span style="font-size:9px;flex-shrink:0">&#128196;</span><span style="font-size:10px;overflow:hidden;text-overflow:ellipsis">'+dk+' '+n.title+', '+n.loc+', '+n.auth+'</span>';
      d.onclick=(function(note){return function(){ tree.querySelectorAll('.nt-item').forEach(function(x){x.classList.remove('sel');}); d.classList.add('sel'); loadNote(note); };})(n);
      tree.appendChild(d); first=false;
    });
  });
  left.appendChild(tree);
  var ba=document.createElement('div'); ba.className='btn-area';
  ba.innerHTML='<button class="btn" style="width:100%;text-align:left">/ Templates</button><button class="btn" style="width:100%;text-align:left" onclick="openEncounter()">Encounter</button><button class="btn" style="width:100%;text-align:left;font-weight:bold" onclick="showFloatWin(\'new-note-dlg\')">New Note</button>';
  left.appendChild(ba); outer.appendChild(left);
  var right=document.createElement('div'); right.id='notes-right';
  var listHdr=document.createElement('div'); listHdr.id='notes-list-hdr';
  var listPane=document.createElement('div'); listPane.id='notes-list-pane';
  var detailBody=document.createElement('div'); detailBody.id='notes-detail-body';
  right.appendChild(listHdr); right.appendChild(listPane); right.appendChild(detailBody);
  outer.appendChild(right); mp.appendChild(outer);
  function loadNote(n){
    listHdr.textContent='Visit: '+n.date+'  '+n.title+', '+n.loc+', '+n.auth;
    var lh='<table class="notes-list-tbl"><thead><tr><th style="width:55px">Date</th><th>Title</th><th style="width:70px">Subject</th><th style="width:130px">Author</th><th style="width:110px">Location</th></tr></thead><tbody>';
    (grouped[n.date]||[]).forEach(function(x){
      lh+='<tr class="'+(x===n?'sel':'')+'"><td style="color:#cc0000;font-weight:bold">'+x.date+'</td><td>'+x.title+'</td><td></td><td>'+x.auth+'</td><td>'+x.loc+'</td></tr>';
    });
    lh+='</tbody></table>'; listPane.innerHTML=lh;
    detailBody.textContent=n.body;
  }
  if(pt.notes.length) loadNote(pt.notes[0]);
}

