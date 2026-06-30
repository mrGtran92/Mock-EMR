function renderSurgery(pt){
  document.getElementById('lp-title').textContent='Surgery';
  document.getElementById('lp-list').innerHTML='<div class="ti sel">All Surgery Cases</div><div class="ti">Operative Reports</div><div class="ti">Anesthesia Reports</div><div class="ti">Pathology</div>';
  var rpHdr=document.getElementById('rp-hdr'); rpHdr.style.display='block'; rpHdr.textContent='Surgery -- '+pt.name;
  document.getElementById('rp-body').textContent='No surgery cases found for this patient.';
}

