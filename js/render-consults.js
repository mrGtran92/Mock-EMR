function renderConsults(pt){
  document.getElementById('left-pane').style.display='none';
  document.getElementById('right-pane').style.display='none';
  var mp=document.getElementById('main-panes');
  var outer=document.createElement('div'); outer.id='consults-outer';
  var left=document.createElement('div'); left.id='consults-left';
  var th=document.createElement('div'); th.className='tree-hdr'; th.textContent='Consults'; left.appendChild(th);
  var tree=document.createElement('div'); tree.className='tree-body';
  var grp=document.createElement('div'); grp.className='ct-grp';
  grp.innerHTML='<span style="font-size:10px">&#9660;</span><span>All consults</span>'; tree.appendChild(grp);
  pt.consults.forEach(function(c,i){
    var d=document.createElement('div'); d.className='ct-item indent1'+(i===0?' sel':'');
    d.innerHTML='<span style="font-size:9px">&#128196;</span><span>'+c.date+' ('+c.stat+') '+c.title+'</span>';
    d.onclick=(function(cc){return function(){ tree.querySelectorAll('.ct-item').forEach(function(x){x.classList.remove('sel');}); d.classList.add('sel'); load(cc); };})(c);
    tree.appendChild(d);
  });
  left.appendChild(tree);
  var ba=document.createElement('div'); ba.className='btn-area';
  ba.innerHTML='<button class="btn" style="width:100%">New Consult</button><button class="btn" style="width:100%">New Procedure</button>';
  left.appendChild(ba);
  var rel=document.createElement('div'); rel.style.cssText='border-top:1px solid #808080;flex-shrink:0';
  rel.innerHTML='<div style="background:#d4d0c8;padding:1px 4px;font-size:11px;font-weight:bold;border-bottom:1px solid #aaa">Related</div><div style="padding:2px 4px;font-size:11px;color:#555;font-style:italic;background:#fff">No related documents found</div>';
  left.appendChild(rel); outer.appendChild(left);
  var right=document.createElement('div'); right.id='consults-right';
  var rh=document.createElement('div'); rh.className='rp-hdr';
  var rb=document.createElement('div'); rb.className='rp-body'; rb.style.flex='1';
  right.appendChild(rh); right.appendChild(rb); outer.appendChild(right); mp.appendChild(outer);
  function load(c){ rh.textContent=c.date+'  ('+c.stat+')  '+c.title+'  Cons #: '+c.num; rb.textContent=c.body; }
  if(pt.consults.length) load(pt.consults[0]);
  else { rh.textContent='No consults'; rb.textContent='No consults found for this patient.'; }
}

