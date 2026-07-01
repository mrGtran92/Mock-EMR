function collectOperativeNotes(pt){
  return (pt.notes||[]).filter(function(n){ return /OPERATIVE/i.test(n.title); });
}
function renderSurgery(pt){
  var opNotes = collectOperativeNotes(pt);
  var lp=document.getElementById('lp-list');
  lp.innerHTML='<div class="ti sel" data-cat="all">All Surgery Cases</div><div class="ti" data-cat="op">Operative Reports</div><div class="ti" data-cat="anes">Anesthesia Reports</div><div class="ti" data-cat="path">Pathology</div>';
  var itemsWrap=document.createElement('div'); itemsWrap.id='surgery-items';
  lp.appendChild(itemsWrap);
  var rpHdr=document.getElementById('rp-hdr'); rpHdr.style.display='block';
  var rpBody=document.getElementById('rp-body');

  function showList(cat){
    lp.querySelectorAll('.ti[data-cat]').forEach(function(x){ x.classList.toggle('sel', x.dataset.cat===cat); });
    itemsWrap.innerHTML='';
    var list = (cat==='all'||cat==='op') ? opNotes : [];
    if(!list.length){
      rpHdr.textContent='Surgery -- '+pt.name;
      rpBody.textContent = cat==='anes' ? 'No anesthesia reports found for this patient.'
        : cat==='path' ? 'No pathology reports found for this patient.'
        : 'No surgery cases found for this patient.';
      return;
    }
    list.forEach(function(n,i){
      var d=document.createElement('div'); d.className='ti indent1'+(i===0?' sel':'');
      d.innerHTML='<span style="font-size:9px">&#128196;</span><span>'+n.date+' '+n.title+'</span>';
      d.onclick=function(){ itemsWrap.querySelectorAll('.ti').forEach(function(x){x.classList.remove('sel');}); d.classList.add('sel'); load(n); };
      itemsWrap.appendChild(d);
    });
    load(list[0]);
  }
  function load(n){
    rpHdr.textContent=n.date+'  '+n.title+'  ('+n.loc+')  --  '+n.auth;
    rpBody.textContent=n.body;
  }
  lp.querySelectorAll('.ti[data-cat]').forEach(function(x){
    x.onclick=function(){ showList(x.dataset.cat); };
  });
  showList('all');
}
