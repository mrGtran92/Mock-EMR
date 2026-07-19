/* Tools > Options > Lists/Teams > Personal Lists, and the
   Patient Selection dialog's Team/Personal picker + default-list
   Save Settings flow. */

// Just the name -- real CPRS's Personal Lists patient search box doesn't
// show DOB/SSN inline next to each row. Instead, highlighting a patient
// shows their SSN in the label above the search box (see plSsnFor()).
var PT_LABELS = {
  kowalski:'Kowalski,Harold J',
  chen:    'Chen,Margaret L',
  okafor:  'Okafor,Emmanuel C',
  brennan: 'Brennan,Daniel T',
  hayes:   'Hayes,Patricia A',
  torres:  'Torres,Elena M'
};
var PT_KEYS = ['kowalski','chen','okafor','brennan','hayes','torres'];
// Same "000-00-<last 4 of MRN>" convention already used for Patient Inquiry.
function plSsnFor(key){
  var pt = PTS[key];
  return '000-00-'+pt.mrn.replace(/\D/g,'').slice(-4);
}

var PERSONAL_LISTS = [
  {name:'Gt 2 North', patients:[]},
  {name:'Gt Day Mod', patients:[]},
  {name:'Gt Gmed Team 1', patients:[]},
  {name:'Gt Gmed Team 2', patients:[]},
  {name:'Gt Gmed Team 4', patients:[]},
  {name:'Gt Gmed Team 5', patients:[]},
  {name:'Gt Gopro', patients:[]},
  {name:'Gt Hugs', patients:[]},
  {name:'Gt Ips', patients:[]},
  {name:'Gt Med Consult', patients:[]},
  {name:'Gt Nar', patients:[]},
  {name:'Gt Palliative Care Consults', patients:[]},
  {name:'Gt Palliative Clinic', patients:[]},
  {name:'Gt Team 7', patients:[]}
];

/* ---------------- Options dialog ---------------- */
function openOptions(){
  closeAllMenus();
  optTab('general');
  showFloatWin('options-dlg');
  centerFloatWin('options-dlg');
}
function optTab(name){
  document.querySelectorAll('#options-dlg .fw-tab').forEach(function(t){
    t.classList.toggle('active', t.dataset.optTab===name);
  });
  document.querySelectorAll('#options-dlg .opt-panel').forEach(function(p){
    p.classList.toggle('active', p.id==='opt-panel-'+name);
  });
}

/* ---------------- Personal Lists dialog ---------------- */
var plSelectedListIdx = null;
var plStaged = [];

function openPersonalLists(){
  plSelectedListIdx = null;
  plStaged = [];
  document.getElementById('pl-patient-search').value = '';
  document.getElementById('pl-patient-ssn').textContent = '';
  plFilterPatients('');
  plRenderLists();
  plRenderStaged();
  plRenderOnList();
  showFloatWin('personal-lists-dlg');
  centerFloatWin('personal-lists-dlg');
}
function plFilterPatients(filter){
  var lb = document.getElementById('pl-patient-lb');
  lb.innerHTML = '';
  filter = (filter||'').toLowerCase();
  PT_KEYS.forEach(function(k){
    if(filter && PT_LABELS[k].toLowerCase().indexOf(filter)===-1) return;
    var d = document.createElement('div');
    d.className = 'pl-list-item';
    d.textContent = PT_LABELS[k];
    d.onclick = function(){
      lb.querySelectorAll('.pl-list-item').forEach(function(x){x.classList.remove('selected');});
      d.classList.add('selected');
      document.getElementById('pl-patient-ssn').textContent = 'SSN: '+plSsnFor(k);
      plStagePatient(k);
    };
    lb.appendChild(d);
  });
}
function plStagePatient(key){
  if(plSelectedListIdx===null) return;
  var list = PERSONAL_LISTS[plSelectedListIdx];
  if(plStaged.indexOf(key)>-1 || list.patients.indexOf(key)>-1) return;
  plStaged.push(key);
  plRenderStaged();
}
function plRenderLists(){
  var lb = document.getElementById('pl-lists-lb');
  lb.innerHTML = '';
  PERSONAL_LISTS.forEach(function(l,idx){
    var d = document.createElement('div');
    d.className = 'pl-list-item' + (idx===plSelectedListIdx ? ' selected' : '');
    d.textContent = l.name;
    d.onclick = function(){ plSelectList(idx); };
    lb.appendChild(d);
  });
}
function plSelectList(idx){
  plSelectedListIdx = idx;
  plStaged = [];
  plRenderLists();
  plRenderStaged();
  plRenderOnList();
}
function plRenderStaged(){
  var lb = document.getElementById('pl-staged-lb');
  lb.innerHTML = '';
  plStaged.forEach(function(k){
    var d = document.createElement('div');
    d.className = 'pl-list-item';
    d.textContent = PT_LABELS[k];
    d.dataset.key = k;
    d.onclick = function(){ d.classList.toggle('selected'); };
    lb.appendChild(d);
  });
}
function plRenderOnList(){
  var lb = document.getElementById('pl-onlist-lb');
  lb.innerHTML = '';
  if(plSelectedListIdx===null) return;
  var list = PERSONAL_LISTS[plSelectedListIdx];
  if(!list.patients.length){
    lb.innerHTML = '<div style="color:#888;font-style:italic;padding:2px 4px">No Patients Found.</div>';
    return;
  }
  list.patients.forEach(function(k){
    var d = document.createElement('div');
    d.className = 'pl-list-item';
    d.textContent = PT_LABELS[k];
    d.dataset.key = k;
    d.onclick = function(){ d.classList.toggle('selected'); };
    lb.appendChild(d);
  });
}
function plAddSelected(){
  if(plSelectedListIdx===null) return;
  var list = PERSONAL_LISTS[plSelectedListIdx];
  // Clicking a patient in the search box only stages it -- it doesn't also
  // mark it .selected, so requiring an explicit highlight before Add works
  // means a single staged patient (the common case) needs two clicks to add
  // instead of one. Fall back to acting on every staged patient when none
  // are explicitly highlighted; an explicit highlight still narrows it down.
  var selEls = document.querySelectorAll('#pl-staged-lb .selected');
  var keys = selEls.length ? Array.prototype.map.call(selEls, function(el){ return el.dataset.key; }) : plStaged.slice();
  keys.forEach(function(k){
    if(list.patients.indexOf(k)===-1) list.patients.push(k);
    plStaged = plStaged.filter(function(x){ return x!==k; });
  });
  plRenderStaged();
  plRenderOnList();
}
function plAddAll(){
  if(plSelectedListIdx===null) return;
  var list = PERSONAL_LISTS[plSelectedListIdx];
  plStaged.forEach(function(k){
    if(list.patients.indexOf(k)===-1) list.patients.push(k);
  });
  plStaged = [];
  plRenderStaged();
  plRenderOnList();
}
function plRemoveSelected(){
  if(plSelectedListIdx===null) return;
  var list = PERSONAL_LISTS[plSelectedListIdx];
  var selEls = document.querySelectorAll('#pl-onlist-lb .selected');
  // Same one-click convenience as plAddSelected: if nothing's explicitly
  // highlighted and there's only one patient on the list, remove it outright
  // rather than silently no-op'ing; an explicit highlight still narrows it
  // down when there's more than one patient to choose from.
  var toRemove = selEls.length ? Array.prototype.map.call(selEls, function(el){ return el.dataset.key; })
    : (list.patients.length===1 ? list.patients.slice() : []);
  list.patients = list.patients.filter(function(k){ return toRemove.indexOf(k)===-1; });
  plRenderOnList();
}
function plRemoveAll(){
  if(plSelectedListIdx===null) return;
  PERSONAL_LISTS[plSelectedListIdx].patients = [];
  plRenderOnList();
}
function plSaveChanges(){
  plRenderOnList();
}

/* ---------------- New Personal List dialog ---------------- */
function openNewListDlg(){
  document.getElementById('nl-name-input').value = '';
  showFloatWin('new-list-dlg');
}
function confirmNewList(){
  var name = document.getElementById('nl-name-input').value.trim();
  if(!name){ closeWin('new-list-dlg'); return; }
  var existingIdx = PERSONAL_LISTS.findIndex(function(l){ return l.name.toLowerCase()===name.toLowerCase(); });
  var idx = existingIdx>-1 ? existingIdx : (PERSONAL_LISTS.push({name:name, patients:[]})-1);
  closeWin('new-list-dlg');
  plSelectList(idx);
}

/* ---------------- Patient Selection: Team/Personal picker ---------------- */
var ptSelectedTeamName = null;
var ptSelectedTeamIdx = null;

function ptListModeChange(mode){
  var teamPicker = document.getElementById('pt-team-picker');
  var patientPicker = document.getElementById('pt-patient-picker');
  var unavailable = document.getElementById('pt-mode-unavailable');
  teamPicker.style.display = 'none';
  patientPicker.style.display = 'block';
  unavailable.style.display = 'none';
  selectedPtId = null;
  ptSelectedTeamName = null;
  ptSelectedTeamIdx = null;
  document.getElementById('pt-demo').innerHTML = '<i style="color:#888">No patient selected</i>';
  document.getElementById('pt-patient-picker-label').textContent = 'Patients';
  document.getElementById('pt-search').value = '';
  document.getElementById('pt-lb').innerHTML = '';
  if(mode==='user'){
    fillPtList('');
  } else if(mode==='team'){
    teamPicker.style.display = 'block';
    document.getElementById('pt-team-search').value = '';
    ptRenderTeams('');
  } else {
    patientPicker.style.display = 'none';
    unavailable.style.display = 'block';
  }
}
function ptFilterTeams(filter){ ptRenderTeams(filter); }
function ptRenderTeams(filter){
  var lb = document.getElementById('pt-team-lb');
  lb.innerHTML = '';
  filter = (filter||'').toLowerCase();
  PERSONAL_LISTS.forEach(function(l,idx){
    if(filter && l.name.toLowerCase().indexOf(filter)===-1) return;
    var d = document.createElement('div');
    d.className = 'pt-team-opt' + (idx===ptSelectedTeamIdx ? ' selected' : '');
    d.textContent = l.name;
    d.onclick = function(){ ptSelectTeam(idx); };
    lb.appendChild(d);
  });
}
function ptSelectTeam(idx){
  ptSelectedTeamIdx = idx;
  ptSelectedTeamName = PERSONAL_LISTS[idx].name;
  ptRenderTeams(document.getElementById('pt-team-search') ? document.getElementById('pt-team-search').value : '');
  document.getElementById('pt-patient-picker-label').textContent = 'Patients (' + ptSelectedTeamName + ')';
  document.getElementById('pt-search').value = '';
  fillPtList('');
}

/* ---------------- Save Settings (default patient list) ---------------- */
function saveDefaultPtList(){
  var teamMode = document.getElementById('pl-team') ? document.getElementById('pl-team').checked : false;
  if(!teamMode || !ptSelectedTeamName) return;
  document.getElementById('sdc-body').textContent =
    "Save Team = '" + ptSelectedTeamName + "' as your default patient list setting?";
  showFloatWin('save-default-confirm-dlg');
  centerFloatWin('save-default-confirm-dlg');
}
function confirmSaveDefaultList(yes){
  closeWin('save-default-confirm-dlg');
  if(yes && ptSelectedTeamName){
    localStorage.setItem('cprsDefaultPtListMode', 'team');
    localStorage.setItem('cprsDefaultPtListName', ptSelectedTeamName);
  }
}
function applyDefaultPtListIfSet(){
  var mode = localStorage.getItem('cprsDefaultPtListMode');
  var name = localStorage.getItem('cprsDefaultPtListName');
  if(mode!=='team' || !name) return;
  var idx = PERSONAL_LISTS.findIndex(function(l){ return l.name===name; });
  if(idx===-1) return;
  document.getElementById('pl-team').checked = true;
  ptListModeChange('team');
  ptSelectTeam(idx);
}
