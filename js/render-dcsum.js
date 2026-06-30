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
  var it=document.createElement('div'); it.style.cssText='padding:6px;font-size:11px;color:#555;font-style:italic';
  it.textContent='No discharge summaries on file. Patient currently admitted.'; tree.appendChild(it);
  left.appendChild(tree);
  var ba=document.createElement('div'); ba.className='btn-area';
  ba.innerHTML='<button class="btn" style="width:100%;font-weight:bold">New Summary</button>'; left.appendChild(ba);
  outer.appendChild(left);
  var right=document.createElement('div'); right.id='dcsum-right';
  var rh=document.createElement('div'); rh.className='rp-hdr';
  var rb=document.createElement('div'); rb.className='rp-body'; rb.style.flex='1';
  rb.textContent='No discharge summaries found for this admission.\n\nPatient is currently admitted. The discharge summary will be available at the time of discharge.';
  right.appendChild(rh); right.appendChild(rb); outer.appendChild(right); mp.appendChild(outer);
}

