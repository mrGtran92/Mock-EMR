var CONSULT_CURRENT_USER='TRAN,GEORGE N';

function _consultSortKey(dateStr){
  var m=dateStr.match(/^(\w+)\s+(\d+),(\d+)$/);
  if(!m) return 0;
  var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var mi=months.indexOf(m[1]);
  return (parseInt(m[3],10))*10000 + (mi+1)*100 + parseInt(m[2],10);
}

function buildConsultDetailText(pt,c){
  var ucid='691_'+c.num;
  var inpt = !!(pt.ward);
  var lines=[];
  lines.push('Current Pat. Status:  '+(inpt?'Inpatient':'Outpatient'));
  lines.push('UCID:                 '+ucid);
  lines.push('Primary Eligibility:  '+((pt.serviceConnection&&pt.serviceConnection.pct>0)?'SC (VERIFIED)':'NSC (VERIFIED)'));
  lines.push('Patient Type:         '+((pt.serviceConnection&&pt.serviceConnection.pct>0)?'SC VETERAN':'NSC VETERAN'));
  lines.push('OEF/OIF:              '+((pt.inquiry&&pt.inquiry.combatVet==='ELIGIBLE')?'YES':'NO'));
  lines.push('');
  lines.push('Order Information');
  lines.push('  To Service:            '+c.service);
  lines.push('  From Service:          '+c.fromService);
  lines.push('  Requesting Provider:   '+c.reqProvider);
  lines.push('  Service is to be rendered on an '+(inpt?'INPATIENT':'OUTPATIENT')+' basis');
  lines.push('  Place:                 Consultant\'s choice');
  lines.push('  Urgency:               '+c.urgency);
  lines.push('  Clinically Ind. Date:  '+c.clinInd);
  lines.push('  DST ID:');
  lines.push('  Orderable Item:        '+c.orderable);
  lines.push('  Consult:               Consult Request');
  lines.push('  Provisional Diagnosis: '+c.diagnosis);
  lines.push('  Reason For Request:');
  lines.push('  '+c.reason);
  lines.push('');
  lines.push('Inter-facility Information');
  lines.push('This is not an inter-facility consult request.');
  lines.push('');
  lines.push('Status:      '+c.statusWord);
  lines.push('Last Action: '+c.lastAction);
  lines.push('');
  lines.push('Facility');
  lines.push('  Activity                     Date/Time/Zone      Responsible Person      Entered By');
  (c.activity||[]).forEach(function(a){
    lines.push('  '+a.action+'   '+a.date+'   '+a.resp+'   '+a.enteredBy);
  });
  if(c.statusNote){
    lines.push('');
    lines.push('  '+c.statusNote);
  }
  lines.push('');
  lines.push('Note: TIME ZONE is local if not indicated');
  lines.push('');
  lines.push('No local TIU results or Medicine results available for this consult');
  lines.push('========================================================================');
  return lines.join('\n');
}

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
  var sorted=(pt.consults||[]).slice().sort(function(a,b){ return _consultSortKey(b.date)-_consultSortKey(a.date); });
  var ba=document.createElement('div'); ba.className='btn-area';
  ba.innerHTML='<button class="btn" id="cons-edit-resubmit-btn" style="width:100%;display:none" onclick="openConsultEditResubmit()">Edit/Resubmit</button><button class="btn" style="width:100%">New Consult</button><button class="btn" style="width:100%">New Procedure</button>';
  sorted.forEach(function(c,i){
    var d=document.createElement('div'); d.className='ct-item indent1'+(i===0?' sel':'');
    d.innerHTML='<span style="font-size:9px">&#128196;</span><span>'+c.date+' ('+c.stat+') '+c.title+' Cons Consult #: '+c.num+'</span>';
    d.onclick=(function(cc){return function(){ tree.querySelectorAll('.ct-item').forEach(function(x){x.classList.remove('sel');}); d.classList.add('sel'); load(cc); };})(c);
    tree.appendChild(d);
  });
  left.appendChild(tree);
  left.appendChild(ba);
  var rel=document.createElement('div'); rel.style.cssText='border-top:1px solid #808080;flex-shrink:0';
  rel.innerHTML='<div style="background:#d4d0c8;padding:1px 4px;font-size:11px;font-weight:bold;border-bottom:1px solid #aaa">Related</div><div style="padding:2px 4px;font-size:11px;color:#555;font-style:italic;background:#fff">No related documents found</div>';
  left.appendChild(rel); outer.appendChild(left);
  var right=document.createElement('div'); right.id='consults-right';
  var rh=document.createElement('div'); rh.className='rp-hdr';
  var rb=document.createElement('div'); rb.className='rp-body'; rb.style.flex='1';
  right.appendChild(rh); right.appendChild(rb); outer.appendChild(right); mp.appendChild(outer);
  var _consultSel=null;
  function load(c){
    _consultSel=c;
    rh.textContent=c.date+'  ('+c.stat+')  '+c.title+'  Cons #: '+c.num;
    rb.textContent = c.stat==='c' ? c.body : buildConsultDetailText(pt,c);
    var editBtn=document.getElementById('cons-edit-resubmit-btn');
    editBtn.style.display = (c.stat==='x' && c.cancelledBy===CONSULT_CURRENT_USER) ? 'block' : 'none';
  }
  window._consultEditResubmitTarget = function(){ return _consultSel; };
  if(sorted.length) load(sorted[0]);
  else { rh.textContent='No consults'; rb.textContent='No consults found for this patient.'; }
}

function openConsultEditResubmit(){
  var c = window._consultEditResubmitTarget && window._consultEditResubmitTarget();
  if(!c) return;
  document.getElementById('cons-er-body').innerHTML =
    '<p><b>Edit/Resubmit:</b> '+c.title+' (Cons #: '+c.num+')</p>'
    + '<p>This button is only visible because you (<b>'+CONSULT_CURRENT_USER+'</b>) were the one who cancelled this consult. If a different user had cancelled it, this option would not appear.</p>'
    + '<p style="color:#888;font-style:italic">Editing and resubmitting a cancelled consult is not implemented in this simulation.</p>';
  showFloatWin('cons-edit-resubmit-dlg');
  centerFloatWin('cons-edit-resubmit-dlg');
}
