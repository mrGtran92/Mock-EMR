
var currentPt = null;
var currentTab = 'cover';
var selectedPtId = null;

function toggleMenu(name){
  var wasOpen = document.getElementById('menu-'+name).classList.contains('open');
  closeAllMenus();
  if(!wasOpen) document.getElementById('menu-'+name).classList.add('open');
}
function closeAllMenus(){
  document.querySelectorAll('.mi').forEach(function(m){m.classList.remove('open');});
}
var _viewMenuDefaultHTML = null;
function buildViewMenu(){
  var dd = document.getElementById('dd-view');
  if(_viewMenuDefaultHTML===null) _viewMenuDefaultHTML = dd.innerHTML;
  if(currentTab==='notes' && currentPt){
    dd.innerHTML =
        '<div class="dd-item dd-gray">Chart Tab &#9658;</div>'
      + '<div class="dd-item dd-gray">Information &#9658;</div>'
      + '<div class="dd-sep"></div>'
      + '<div class="dd-item dd-gray">Signed Notes (All)</div>'
      + '<div class="dd-item dd-gray">Signed Notes by Author</div>'
      + '<div class="dd-item dd-gray">Signed Notes by Date Range</div>'
      + '<div class="dd-item dd-gray">Uncosigned Notes</div>'
      + '<div class="dd-item dd-gray">Unsigned Notes</div>'
      + '<div class="dd-item" onclick="openCustomView();closeAllMenus()">Custom View</div>'
      + '<div class="dd-item dd-gray">Search for Text (Within Current View)</div>'
      + '<div class="dd-sep"></div>'
      + '<div class="dd-item dd-gray">Save as Default View</div>'
      + '<div class="dd-item dd-gray">Return to Default View</div>'
      + '<div class="dd-sep"></div>'
      + '<div class="dd-item dd-gray">Details</div>'
      + '<div class="dd-item dd-gray">Icon Legend</div>';
  } else {
    dd.innerHTML = _viewMenuDefaultHTML;
  }
}
document.addEventListener('click',function(e){ if(!e.target.closest('.mi')) closeAllMenus(); });
document.querySelectorAll('.dropdown').forEach(function(d){
  d.addEventListener('click',function(e){ e.stopPropagation(); });
});

function openPtDialog(){
  closeAllMenus();
  var userRadio = document.getElementById('pl-user');
  if(userRadio) userRadio.checked = true;
  if(typeof ptListModeChange==='function') ptListModeChange('user');
  else {
    selectedPtId=null;
    document.getElementById('pt-demo').innerHTML='<i style="color:#888">No patient selected</i>';
    document.getElementById('pt-search').value='';
    fillPtList('');
  }
  var dlg=document.getElementById('pt-dlg');
  dlg.classList.add('show');
  dlg.style.left=Math.max(0,Math.round((window.innerWidth-dlg.offsetWidth)/2))+'px';
  dlg.style.top=Math.max(0,Math.round((window.innerHeight-dlg.offsetHeight)/2))+'px';
  makeDraggable('pt-dlg');
  makeResizable('pt-dlg','pt-resize-handle');
  if(typeof applyDefaultPtListIfSet==='function') applyDefaultPtListIfSet();
}
function closePtDialog(){ document.getElementById('pt-dlg').classList.remove('show'); }
function fillPtList(filter){
  var lb=document.getElementById('pt-lb'); lb.innerHTML='';
  var keys=['kowalski','chen','okafor','brennan','hayes'];
  var labels={
    kowalski:'Kowalski,Harold J          0042-8817    03/14/1952',
    chen:    'Chen,Margaret L            0059-2241    09/02/1967',
    okafor:  'Okafor,Emmanuel C          0071-5530    02/27/1981',
    brennan: 'Brennan,Daniel T           0083-6420    03/14/1974',
    hayes:   'Hayes,Patricia A           0096-4471    02/04/1955'
  };
  // last-initial + last-4-SSN search, e.g. "K8817"
  var ssnMatch = filter && /^([A-Za-z])(\d{4})$/.exec(filter.trim());
  keys.forEach(function(k){
    if(filter){
      if(ssnMatch){
        var initial=ssnMatch[1].toUpperCase(), last4=ssnMatch[2];
        var nameInitial=k.charAt(0).toUpperCase();
        var mrnLast4=PTS[k].mrn.replace(/\D/g,'').slice(-4);
        if(nameInitial!==initial || mrnLast4!==last4) return;
      } else {
        if(labels[k].toLowerCase().indexOf(filter.toLowerCase())===-1) return;
      }
    }
    var d=document.createElement('div');
    d.className='pt-opt'; d.textContent=labels[k];
    d.onclick=function(){
      document.querySelectorAll('.pt-opt').forEach(function(x){x.classList.remove('selected');});
      d.classList.add('selected'); selectedPtId=k;
      var pt=PTS[k];
      document.getElementById('pt-demo').innerHTML='<b>'+pt.name+'</b><br>DOB: '+pt.dob+'&nbsp;&nbsp;Age: '+pt.age+'<br>MRN: '+pt.mrn+'<br>Sex: '+pt.sex;
    };
    d.ondblclick=function(){ confirmPtSelect(); };
    lb.appendChild(d);
  });
}
function confirmPtSelect(){
  if(!selectedPtId){ closePtDialog(); return; }
  closePtDialog(); loadPatient(selectedPtId);
}
function loadPatient(id){
  var pt=PTS[id]; currentPt=id;
  document.getElementById('h-name').textContent=pt.name+' ('+(pt.sex==='MALE'?'M':'F')+')';
  document.getElementById('h-meta').textContent=pt.mrn+'  '+pt.dob+' ('+pt.age+')';
  document.getElementById('h-visit1').textContent=pt.workload;
  document.getElementById('h-visit2').textContent='Provider: '+pt.prov;
  document.getElementById('h-pact').textContent='No PACT assigned at this VA location (Click for more)';
  document.getElementById('h-cwad').textContent=pt.cwad||'';
  var banner=document.getElementById('banner');
  if(pt.banner){ banner.style.display='block'; banner.textContent=pt.banner; }
  else banner.style.display='none';
  document.getElementById('sb1').textContent=pt.name+' | '+pt.ward;
  document.getElementById('no-pt-screen').style.display='none';
  document.getElementById('main-panes').style.display='flex';
  document.getElementById('tabbar').style.display='flex';
  goTab('notes');
  if(typeof tourOnPatientLoad==='function') tourOnPatientLoad();
}

function openEncounter(){
  if(!currentPt) return;
  var pt=PTS[currentPt];
  var tbl=document.getElementById('enc-visit-tbl'); tbl.innerHTML='';
  if(pt.appointments){ pt.appointments.forEach(function(a){
    var tr=document.createElement('tr');
    tr.innerHTML='<td>'+a.loc+'</td><td>'+a.dt+'</td><td>'+a.action+'</td>';
    tbl.appendChild(tr);
  });}
  showFloatWin('encounter-dlg');
}

function goTab(tab){
  currentTab=tab;
  document.querySelectorAll('.ctab').forEach(function(t){t.classList.remove('active');});
  var el=document.getElementById('tab-'+tab); if(el) el.classList.add('active');
  if(!currentPt) return;
  renderTab(tab);
}
function renderTab(tab){
  var pt=PTS[currentPt];
  var mp=document.getElementById('main-panes');
  ['notes-outer','consults-outer','orders-outer','labs-outer','reports-outer','dcsum-outer'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.parentNode.removeChild(el);
  });
  var lp=document.getElementById('left-pane'), rp=document.getElementById('right-pane');
  lp.style.display='flex'; rp.style.display='flex'; lp.style.width='185px';
  var lpList=document.getElementById('lp-list'), rpHdr=document.getElementById('rp-hdr'), rpBody=document.getElementById('rp-body');
  lpList.innerHTML=''; rpHdr.textContent=''; rpBody.innerHTML='';
  rpBody.className='rp-body'; rpBody.style.padding='4px 6px'; rpBody.style.overflow='auto';
  document.getElementById('rp-hdr').style.display='none';
  document.getElementById('lp-btns').style.display='none';
  document.getElementById('lp-btns').innerHTML='';
  if(tab==='cover') renderCover(pt);
  else if(tab==='problems') renderProblems(pt);
  else if(tab==='meds') renderMeds(pt);
  else if(tab==='orders') renderOrders(pt);
  else if(tab==='notes') renderNotes(pt);
  else if(tab==='consults') renderConsults(pt);
  else if(tab==='labs') renderLabs(pt);
  else if(tab==='reports') renderReports(pt);
  else if(tab==='dcsum') renderDCsum(pt);
  else if(tab==='surgery') renderSurgery(pt);
}

