function renderCover(pt){
  document.getElementById('lp-title').textContent='Cover Sheet';
  document.getElementById('left-pane').style.display='none';
  document.getElementById('rp-hdr').style.display='none';
  var aHtml = pt.allergies.length
    ? '<table class="cs-tbl"><tr><th>Agent</th><th>Severity</th><th>Signs/Symptoms</th></tr>'+pt.allergies.map(function(a){return '<tr><td class="ared">'+a.agent+'</td><td>'+a.sev+'</td><td>'+a.signs+'</td></tr>';}).join('')+'</table>'
    : '<div style="padding:3px">No Known Allergies (NKA)</div>';
  var probHtml = pt.problems.slice(0,10).map(function(p){return '<div class="cs-row"><span>'+p.d.replace(/ \(SCT.*?\)/,'')+'</span></div>';}).join('');
  var medActive = pt.meds_inpt.filter(function(m){return m.stat==='active';});
  var medSrc = medActive.length?medActive:pt.meds_home;
  var medHtml = medSrc.slice(0,8).map(function(m){return '<div class="cs-row"><span class="cs-lbl" style="font-size:10px">'+m.n.split(' ').slice(0,3).join(' ')+'</span><span class="cs-val">active</span></div>';}).join('');
  var postHtml = pt.postings.map(function(p){return '<div class="cs-row"><span class="posting-link">'+p+'</span></div>';}).join('');
  var v=pt.vitals[0];
  var vf=function(val){return val.indexOf('H')>-1?'fH':val.indexOf('L')>-1?'fL':'';};
  var vitHtml='<table class="cs-tbl" style="font-size:10px"><tr><th>Vital</th><th>Value</th><th>Date Taken</th><th>Quals</th></tr>'+
    '<tr><td>T</td><td class="'+vf(v.t)+'">'+v.t+'</td><td>'+v.dt+'</td><td>'+(v.qual||'')+'</td></tr>'+
    '<tr><td>P</td><td class="'+vf(v.hr)+'">'+v.hr+'</td><td>'+v.dt+'</td><td></td></tr>'+
    '<tr><td>R</td><td class="'+vf(v.rr)+'">'+v.rr+'</td><td>'+v.dt+'</td><td></td></tr>'+
    '<tr><td>BP</td><td class="'+vf(v.bp)+'">'+v.bp+'</td><td>'+v.dt+'</td><td>'+(v.qual||'')+'</td></tr>'+
    (v.ht?'<tr><td>HT</td><td>'+v.ht+'</td><td>'+v.dt+'</td><td></td></tr>':'')+
    '<tr><td>WT</td><td>'+(v.wt!='--'?v.wt+' kg':'--')+'</td><td>'+v.dt+'</td><td></td></tr>'+
    '<tr><td>PN</td><td>'+(v.pn||'0')+'</td><td>'+v.dt+'</td><td></td></tr>'+
    '<tr><td>POX</td><td class="'+vf(v.spo2)+'">'+v.pox+'</td><td>'+v.dt+'</td><td></td></tr></table>';
  var immHtml = pt.immunizations.map(function(im){return '<div class="cs-row"><span class="alink" style="font-size:10px;min-width:0;flex:1">'+im.name+'</span><span class="cs-date">'+im.dt+'</span></div>';}).join('');
  var apptHtml='<table class="cs-tbl"><tr><th>Date/Time</th><th>Location</th><th>Action</th></tr>'+pt.appointments.map(function(a){return '<tr><td>'+a.dt+'</td><td>'+a.loc+'</td><td>'+a.action+'</td></tr>';}).join('')+'</table>';
  var remHtml='<table class="cs-tbl"><tr><th>Reminder</th><th>Due Date</th></tr><tr><td>Outpt. Med Reconciliation</td><td class="due">DUE NOW</td></tr><tr><td>Influenza Immunization</td><td>DUE</td></tr></table>';
  var whHtml='<div style="padding:3px;font-size:11px">'+(pt.sex==='FEMALE'?'See Women\'s Health package.':'Not Applicable')+'</div>';
  var cells=[
    {title:'Active Problems',body:probHtml},
    {title:'Allergies / Adverse Reactions',body:aHtml},
    {title:'Postings',body:postHtml,onclick:'openPostings()'},
    {title:'Active Medications',body:medHtml},
    {title:'Clinical Reminders',body:remHtml},
    {title:"Women's Health",body:whHtml},
    {title:'Recent Immunizations',body:immHtml},
    {title:'Vitals',body:vitHtml,onclick:'openVitalsWin()'},
    {title:'Appointments/Visits/Admissions',body:apptHtml},
  ];
  var html='<div class="cs-grid">';
  cells.forEach(function(c){
    var hdrClass='cs-hdr'+(c.onclick?' clickable':'');
    var hdrClick=c.onclick?' onclick="'+c.onclick+'"':'';
    html+='<div class="cs-cell"><div class="'+hdrClass+'"'+hdrClick+'><span>&#8722; '+c.title+'</span><span class="cs-icon">&#8661;</span></div><div class="cs-body">'+c.body+'</div></div>';
  });
  html+='</div>';
  var rpBody=document.getElementById('rp-body');
  rpBody.innerHTML=html; rpBody.className='rp-body grid';
  rpBody.style.padding='0'; rpBody.style.overflow='hidden';
}

