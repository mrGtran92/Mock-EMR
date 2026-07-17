/* =========================================================
   Clinical Reminders
   "Available Reminders" browse dialog opened from the header
   clock icon — a tree of category folders (Due / Applicable /
   Not Applicable / Other Categories) on the left and a Due
   Date / Last Occurred / Priority table on the right, matching
   real CPRS. Only the Due folder has real content in this sim.
   Processing a reminder (Done/Refused/Not Indicated) is not
   yet wired into this view — pending further guidance on the
   real workflow.
   ========================================================= */
var _remSelectedIdx = null; // null = "Due" folder row itself selected

function updateRemindersBadge(){
  // Intentionally a no-op: the header clock icon shows no due-count badge,
  // matching real CPRS (the icon itself carries no number).
}

function openReminders(){
  if(!currentPt) return;
  _remSelectedIdx = null;
  remRenderDialog();
  showFloatWin('reminders-dlg');
  centerFloatWin('reminders-dlg');
  document.removeEventListener('click', _remOutsideClick);
  setTimeout(function(){ document.addEventListener('click', _remOutsideClick); }, 0);
}
function _remOutsideClick(e){
  if(typeof _tourActive!=='undefined' && _tourActive) return;
  var dlg = document.getElementById('reminders-dlg');
  if(dlg && dlg.style.display!=='none' && !dlg.contains(e.target) && !e.target.closest('#hbtn-reminders')){
    closeWin('reminders-dlg');
    document.removeEventListener('click', _remOutsideClick);
  }
}

function remRenderDialog(){
  var pt = PTS[currentPt];
  var due = (pt && pt.reminders) ? pt.reminders.filter(function(r){ return r.status==='due'; }) : [];
  var body = document.getElementById('rem-body');
  if(!body) return;

  var treeRows = '<div class="rem-tree-row'+(_remSelectedIdx===null?' selected':'')+'" onclick="remSelectRow(null)">'
    + '<span class="rem-caret">&#9662;</span><span class="rem-folder-icon">&#128193;</span><span>Due</span></div>';
  due.forEach(function(r,i){
    treeRows += '<div class="rem-tree-row rem-item-row'+(_remSelectedIdx===i?' selected':'')+'" onclick="remSelectRow('+i+')">'
      + '<span class="rem-item-icon">&#127942;</span><span>'+r.title+'</span></div>';
  });
  treeRows += ['Applicable','Not Applicable','Other Categories'].map(function(label){
    return '<div class="rem-tree-row"><span class="rem-caret">&#9656;</span><span class="rem-folder-icon">&#128193;</span><span>'+label+'</span></div>';
  }).join('');

  var tableRows = '<div class="rem-table-row'+(_remSelectedIdx===null?' selected':'')+'" onclick="remSelectRow(null)">'
    + '<span class="rem-col-due"></span><span class="rem-col-last"></span><span class="rem-col-pri"></span></div>';
  due.forEach(function(r,i){
    tableRows += '<div class="rem-table-row'+(_remSelectedIdx===i?' selected':'')+'" onclick="remSelectRow('+i+')">'
      + '<span class="rem-col-due">'+(r.due||'')+'</span><span class="rem-col-last">'+(r.lastOccurred||'')+'</span><span class="rem-col-pri">'+(r.priority||'')+'</span></div>';
  });
  // Applicable / Not Applicable / Other Categories stay collapsed with no
  // items in this simulation, so no matching table rows are appended for
  // them -- keeps the tree and table rows aligned one-to-one.

  body.innerHTML =
      '<div class="rem-menubar"><span>View</span><span>Action</span></div>'
    + '<div class="rem-colhdr"><span class="rem-col-tree">Available Reminders</span><span class="rem-col-due">Due Date</span><span class="rem-col-last">Last Occurred...</span><span class="rem-col-pri">Priority</span></div>'
    + '<div class="rem-split"><div class="rem-tree">'+treeRows+'</div><div class="rem-table">'+tableRows+'</div></div>';
}

function remSelectRow(idx){
  _remSelectedIdx = idx;
  remRenderDialog();
}
