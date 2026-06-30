function renderProblems(pt){
  document.getElementById('lp-title').textContent='View options';
  document.getElementById('left-pane').style.width='145px';
  var lpList=document.getElementById('lp-list');
  ['Active','Inactive','Both active and inactive','Removed'].forEach(function(lbl,i){
    var d=document.createElement('div');
    d.className='ti'+(i===0?' sel':''); d.textContent=lbl;
    d.onclick=function(){ lpList.querySelectorAll('.ti').forEach(function(x){x.classList.remove('sel');}); d.classList.add('sel'); };
    lpList.appendChild(d);
  });
  var btns=document.getElementById('lp-btns');
  btns.style.display='flex';
  btns.innerHTML='<button class="btn" style="width:100%">New Problem</button>';
  var rpHdr=document.getElementById('rp-hdr');
  rpHdr.style.display='block';
  rpHdr.textContent='Active Problems ('+pt.problems.length+' of '+pt.problems.length+')';
  var rpBody=document.getElementById('rp-body');
  rpBody.className='rp-body grid'; rpBody.style.padding='0'; rpBody.style.overflow='auto';
  var html='<table class="prob" style="table-layout:fixed"><thead><tr><th style="width:22px">Stat...</th><th>Description</th><th style="width:80px">Onset Date</th><th style="width:80px">Last Upda...</th><th style="width:110px">Location</th></tr></thead><tbody>';
  pt.problems.forEach(function(p){
    html+='<tr><td>'+p.s+'</td><td>'+p.d+(p.n?'<br><span style="padding-left:12px;color:#666;font-size:10px">'+p.n+'</span>':'')+'</td><td>'+(p.onset||'')+'</td><td>'+(p.upd||'')+'</td><td>'+(p.loc||'')+'</td></tr>';
  });
  html+='</tbody></table>';
  rpBody.innerHTML=html;
}

