
var currentPt = null;
var currentTab = 'cover';
var selectedPtId = null;

// Shared Service Connection helpers -- used by the Patient Selection
// dialog's demographics panel and the Patient Inquiry (facesheet) popup.
function _scSummary(pt){
  var sc = pt.serviceConnection;
  if(!sc || !sc.pct) return 'Not Service Connected';
  return sc.pct+'% Service Connected';
}
function _scBlockLines(pt){
  var sc = pt.serviceConnection;
  var lines = ['Service Connection/Rated Disabilities:', ''];
  if(sc && sc.pct){
    lines.push('        SC Percent: '+sc.pct+'%');
    var dis = (sc.disabilities||[]).map(function(d){ return d.name+' ('+d.pct+'%-SC)'; });
    lines.push('Rated Disabilities: '+(dis[0]||'NONE STATED'));
    dis.slice(1).forEach(function(d){ lines.push('                    '+d); });
  } else {
    lines.push('  Service Connected: NO');
    lines.push('Rated Disabilities: NONE STATED');
  }
  return lines;
}

// Patient header PACT line -- "WEST LA VAMC: <team> / PCP <lastname,first>",
// plus a second "(Inpatient) Attending / (Inpatient) Provider" line only
// when the patient is currently admitted (inferred from having active
// inpatient meds -- the app has no separate inpatient/outpatient flag).
// The Inpatient Provider is the resident/intern (pact.invProvider), which
// intentionally differs from the Inpatient Attending (pt.prov).
function _stripCredential(name){
  return (name||'').replace(/\s*\(.*\)\s*$/,'').replace(/\s+(MD|DO|PA|NP)\.?$/i,'').toUpperCase();
}
function _pactHeaderText(pt){
  var pact = pt.pact||{};
  var isInpatient = !!(pt.meds_inpt && pt.meds_inpt.length>0);
  var line1 = 'WEST LA VAMC: '+(pact.team||'')+' / PCP '+_stripCredential(pact.pcp);
  var line2 = '';
  if(isInpatient){
    line2 = '(Inpatient) Attending: '+_stripCredential(pt.prov)+' - (Inpatient) Provider: '+_stripCredential(pact.invProvider);
  }
  return {line1:line1, line2:line2};
}

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
  var keys=['kowalski','chen','okafor','brennan','hayes','torres'];
  var labels={
    kowalski:'Kowalski,Harold J          0042-8817    03/14/1952',
    chen:    'Chen,Margaret L            0059-2241    09/02/1967',
    okafor:  'Okafor,Emmanuel C          0071-5530    02/27/1981',
    brennan: 'Brennan,Daniel T           0083-6420    03/14/1974',
    hayes:   'Hayes,Patricia A           0096-4471    02/04/1955',
    torres:  'Torres,Elena M             0104-3392    08/22/1967'
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
      document.getElementById('pt-demo').innerHTML='<b>'+pt.name+'</b><br>DOB: '+pt.dob+'&nbsp;&nbsp;Age: '+pt.age+'<br>MRN: '+pt.mrn+'<br>Sex: '+pt.sex+'<br>Service: '+_scSummary(pt);
    };
    d.ondblclick=function(){ confirmPtSelect(); };
    lb.appendChild(d);
  });
}
function confirmPtSelect(){
  if(!selectedPtId){ closePtDialog(); return; }
  closePtDialog(); loadPatient(selectedPtId);
}
// Every floating dialog in the app (.float-win) plus the anchored Remote
// Data panel, closed unconditionally. Called whenever a new patient chart
// loads so a popup left open on the previous patient (Options, VistA
// Imaging, PDMP Results, etc.) can't linger into the newly-opened chart.
function closeAllFloatWins(){
  document.querySelectorAll('.float-win').forEach(function(el){ el.style.display='none'; });
  if(typeof closeRemoteDataPanel==='function') closeRemoteDataPanel();
}
function loadPatient(id){
  closeAllFloatWins();
  var pt=PTS[id]; currentPt=id;
  document.getElementById('h-name').textContent=pt.name+' ('+(pt.sex==='MALE'?'M':'F')+')';
  document.getElementById('h-meta').textContent=pt.mrn+'  '+pt.dob+' ('+pt.age+')';
  document.getElementById('h-visit1').textContent=pt.workload;
  document.getElementById('h-visit2').textContent='Provider: '+pt.prov;
  var pactLines=_pactHeaderText(pt);
  document.getElementById('h-pact1').textContent=pactLines.line1;
  document.getElementById('h-pact2').textContent=pactLines.line2||' ';
  if(typeof updatePdmpButton==='function') updatePdmpButton();
  if(typeof updateFlagButton==='function') updateFlagButton();
  document.getElementById('h-cwad').textContent=pt.cwad||'';
  var banner=document.getElementById('banner');
  if(pt.banner){ banner.style.display='block'; banner.textContent=pt.banner; }
  else banner.style.display='none';
  document.getElementById('sb1').textContent=pt.name+' | '+pt.ward;
  document.getElementById('no-pt-screen').style.display='none';
  document.getElementById('main-panes').style.display='flex';
  document.getElementById('tabbar').style.display='flex';
  if(typeof updateRemindersBadge==='function') updateRemindersBadge();
  goTab('notes');
  if(typeof tourOnPatientLoad==='function') tourOnPatientLoad();
}

var _encSelectedDx=null, _encCommonDx=['Diabetes Mellitus Type 2, E11.9','Essential Hypertension, I10','Hyperlipidemia, E78.5','Z00.00 Routine Health Exam'];
function openEncounter(){
  if(!currentPt) return;
  var pt=PTS[currentPt];
  var tbl=document.getElementById('enc-visit-tbl'); tbl.innerHTML='';
  if(pt.appointments){ pt.appointments.forEach(function(a){
    var tr=document.createElement('tr');
    tr.innerHTML='<td>'+a.loc+'</td><td>'+a.dt+'</td><td>'+a.action+'</td>';
    tbl.appendChild(tr);
  });}
  encTabSwitch('clinic');
  _encSelectedDx=null;
  var dxList=document.getElementById('enc-dx-list'); dxList.innerHTML='';
  var dxOptions=(pt.problems||[]).map(function(p){ return p.d; }).concat(_encCommonDx);
  dxOptions.forEach(function(dx){
    var d=document.createElement('div');
    d.className='enc-dx-item'; d.textContent=dx;
    d.onclick=function(){
      dxList.querySelectorAll('.enc-dx-item').forEach(function(x){x.classList.remove('sel');});
      d.classList.add('sel'); _encSelectedDx=dx;
    };
    dxList.appendChild(d);
  });
  showFloatWin('encounter-dlg');
  centerFloatWin('encounter-dlg');
  document.removeEventListener('click', _encOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _encOutsideClick); }, 0);
}
function _encOutsideClick(e){
  if(typeof _tourActive!=='undefined' && _tourActive) return;
  var dlg = document.getElementById('encounter-dlg');
  if(dlg && dlg.style.display!=='none' && !dlg.contains(e.target) && !e.target.closest('#ph-visit')){
    closeWin('encounter-dlg');
    document.removeEventListener('click', _encOutsideClick);
  }
}
function encProvSelect(el){
  document.querySelectorAll('#enc-prov-list .enc-prov-opt').forEach(function(x){x.classList.remove('sel');});
  el.classList.add('sel');
}
function encTabSwitch(name){
  document.querySelectorAll('#encounter-dlg .enc-vtab').forEach(function(t){
    t.classList.toggle('active', t.dataset.encTab===name);
  });
  document.querySelectorAll('#encounter-dlg .enc-panel').forEach(function(p){
    p.classList.toggle('active', p.id==='enc-tab-'+name);
  });
}
function saveNewVisitEncounter(){
  var visitType=document.getElementById('enc-visit-type').value;
  var provEl=document.querySelector('#enc-prov-list .enc-prov-opt.sel');
  var prov=provEl?provEl.textContent:'';
  var dx=_encSelectedDx||'(no diagnosis selected)';
  document.getElementById('ecd-body').innerHTML='Encounter coded:<br><br><b>Diagnosis:</b> '+dx+'<br><b>Visit Type:</b> '+visitType+'<br><b>Provider:</b> '+prov+'<br><br><i>(Simulation — not added to the patient\'s appointment history.)</i>';
  showFloatWin('encounter-coded-dlg');
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

