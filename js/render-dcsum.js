function renderDCsum(pt){
  document.getElementById('left-pane').style.display='none';
  document.getElementById('right-pane').style.display='none';
  var mp=document.getElementById('main-panes');
  var outer=document.createElement('div'); outer.id='dcsum-outer';
  var left=document.createElement('div'); left.id='dcsum-left';
  var th=document.createElement('div'); th.className='tree-hdr'; th.textContent='All Signed Summaries'; left.appendChild(th);
  var tree=document.createElement('div'); tree.className='tree-body';
  var g=document.createElement('div'); g.className='ct-grp';
  g.innerHTML='<span style="font-size:10px">&#9660;</span><span>All signed summaries</span>'; tree.appendChild(g);
  var sums=pt.dcsum||[];
  var right=document.createElement('div'); right.id='dcsum-right';
  var rh=document.createElement('div'); rh.className='rp-hdr';
  var rb=document.createElement('div'); rb.className='rp-body'; rb.style.flex='1';
  if(sums.length){
    sums.forEach(function(s,i){
      var d=document.createElement('div'); d.className='ct-item indent1'+(i===0?' sel':'');
      d.innerHTML='<span style="font-size:9px">&#128196;</span><span>'+s.date+'  Discharge Summary, '+s.ward+', '+s.provider+'  ('+s.stat+'), Adm: '+s.adm+', Dis: '+s.dis+'</span>';
      d.onclick=(function(ss){return function(){ tree.querySelectorAll('.ct-item').forEach(function(x){x.classList.remove('sel');}); d.classList.add('sel'); load(ss); };})(s);
      tree.appendChild(d);
    });
  }
  left.appendChild(tree);
  var ba=document.createElement('div'); ba.className='btn-area';
  ba.innerHTML='<button class="btn" style="width:100%;font-weight:bold">New Summary</button>'; left.appendChild(ba);
  outer.appendChild(left);
  function load(s){
    rh.textContent=s.date+'  Discharge Summary, '+s.ward+', '+s.provider+'  ('+s.stat+'), Adm: '+s.adm+', Dis: '+s.dis;
    rb.textContent=s.body;
  }
  right.appendChild(rh); right.appendChild(rb); outer.appendChild(right); mp.appendChild(outer);
  if(sums.length) load(sums[0]);
}
