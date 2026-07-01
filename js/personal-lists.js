/* Tools > Options > Lists/Teams > Personal Lists, and the
   Patient Selection dialog's Team/Personal picker + default-list
   Save Settings flow. */

var PT_LABELS = {
  kowalski:'Kowalski,Harold J          0042-8817    03/14/1952',
  chen:    'Chen,Margaret L            0059-2241    09/02/1967',
  okafor:  'Okafor,Emmanuel C          0071-5530    02/27/1981',
  brennan: 'Brennan,Daniel T           0083-6420    03/14/1974',
  hayes:   'Hayes,Patricia A           0096-4471    02/04/1955'
};
var PT_KEYS = ['kowalski','chen','okafor','brennan','hayes'];

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
  plFilterPatients('');
  plRenderLists();
  plRenderStaged();
  plRenderOnList();
  showFloatWin('personal-lists-dlg');
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
    d.onclick = function(){ plStagePatient(k); };
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
  var sel = document.querySelectorAll('#pl-staged-lb .selected');
  sel.forEach(function(el){
    var k = el.dataset.key;
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
  var sel = document.querySelectorAll('#pl-onlist-lb .selected');
  var toRemove = Array.prototype.map.call(sel, function(el){ return el.dataset.key; });
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
