function openVitalsWin(){
  if(!currentPt) return;
  var pt=PTS[currentPt];
  document.getElementById('vw-ptname').textContent=pt.name+'  '+pt.mrn+'  ('+pt.age+')';
  vwTab('vitals', document.querySelector('#vitals-win .fw-tab'));
  showFloatWin('vitals-win');
}
function vwSetPeriod(el){
  document.querySelectorAll('.vt-period').forEach(function(x){x.classList.remove('sel');});
  if(el) el.classList.add('sel');
  vwTab('vitals', document.querySelector('#vitals-win .fw-tab.active'));
}
function vwTab(tab,el){
  if(!currentPt) return;
  var pt=PTS[currentPt];
  document.querySelectorAll('#vitals-win .fw-tab').forEach(function(t){t.classList.remove('active');});
  if(el) el.classList.add('active');
  var pane=document.getElementById('vw-pane');
  var fH=function(v){return v.indexOf('H')>-1;}, fL=function(v){return v.indexOf('L')>-1;};
  if(tab==='vitals'){
    var h='<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#d4d0c8"><th style="padding:2px 4px;border:1px solid #aaa;text-align:left">Date/Time</th><th style="padding:2px 4px;border:1px solid #aaa">Temp&deg;C</th><th style="padding:2px 4px;border:1px solid #aaa">Pulse</th><th style="padding:2px 4px;border:1px solid #aaa">Resp</th><th style="padding:2px 4px;border:1px solid #aaa">PO2%</th><th style="padding:2px 4px;border:1px solid #aaa">B/P</th><th style="padding:2px 4px;border:1px solid #aaa">Wt(lb)</th><th style="padding:2px 4px;border:1px solid #aaa">Ht(in)</th><th style="padding:2px 4px;border:1px solid #aaa">Pain</th></tr></thead><tbody>';
    pt.vitals.forEach(function(v){
      h+='<tr><td style="padding:1px 4px;border-bottom:1px solid #eee;white-space:nowrap">'+v.dt+'</td>'+
      '<td style="padding:1px 4px;border-bottom:1px solid #eee;text-align:center'+(fH(v.t)?';color:#cc0000;font-weight:bold':fL(v.t)?';color:#0000cc;font-weight:bold':'')+'">'+v.t.replace(/ [HL]/,'')+'</td>'+
      '<td style="padding:1px 4px;border-bottom:1px solid #eee;text-align:center'+(fH(v.hr)?';color:#cc0000;font-weight:bold':'')+'">'+v.hr.replace(/ [HL]/,'')+'</td>'+
      '<td style="padding:1px 4px;border-bottom:1px solid #eee;text-align:center'+(fH(v.rr)?';color:#cc0000;font-weight:bold':'')+'">'+v.rr.replace(/ [HL]/,'')+'</td>'+
      '<td style="padding:1px 4px;border-bottom:1px solid #eee;text-align:center'+(fL(v.spo2)?';color:#0000cc;font-weight:bold':'')+'">'+v.pox+'</td>'+
      '<td style="padding:1px 4px;border-bottom:1px solid #eee;text-align:center'+(fH(v.bp)?';color:#cc0000;font-weight:bold':'')+'">'+v.bp.replace(/ [HL]/,'')+'</td>'+
      '<td style="padding:1px 4px;border-bottom:1px solid #eee;text-align:center">'+(v.wt!=='--'?(parseFloat(v.wt)*2.20462).toFixed(0):'--')+'</td>'+
      '<td style="padding:1px 4px;border-bottom:1px solid #eee;text-align:center">'+(v.ht?v.ht.replace(' in',''):'')+'</td>'+
      '<td style="padding:1px 4px;border-bottom:1px solid #eee;text-align:center">'+(v.pn||'0')+'</td></tr>';
    });
    h+='</tbody></table><div style="margin-top:6px;font-size:10px;color:#555">KEY: "L"=Abnormal Low  "H"=Abnormal High</div>';
    pane.innerHTML=h;
  } else {
    var h2='<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#d4d0c8"><th style="padding:2px 4px;border:1px solid #aaa;text-align:left">Date</th><th style="padding:2px 4px;border:1px solid #aaa">PO (mL)</th><th style="padding:2px 4px;border:1px solid #aaa">IV (mL)</th><th style="padding:2px 4px;border:1px solid #aaa">UOP (mL)</th><th style="padding:2px 4px;border:1px solid #aaa">Net Balance</th></tr></thead><tbody>';
    pt.io.forEach(function(r){
      var cls=r.net.indexOf('H')>-1?'color:#cc0000;font-weight:bold':r.net.indexOf('L')>-1?'color:#0000cc;font-weight:bold':'';
      h2+='<tr><td style="padding:1px 4px;border-bottom:1px solid #eee">'+r.dt+'</td><td style="padding:1px 4px;text-align:center;border-bottom:1px solid #eee">'+r.po+'</td><td style="padding:1px 4px;text-align:center;border-bottom:1px solid #eee">'+r.iv+'</td><td style="padding:1px 4px;text-align:center;border-bottom:1px solid #eee">'+r.uo+'</td><td style="padding:1px 4px;text-align:center;border-bottom:1px solid #eee;'+cls+'">'+r.net+'</td></tr>';
    });
    h2+='</tbody></table>'; pane.innerHTML=h2;
  }
}

function openPostings(){
  if(!currentPt) return;
  var pt=PTS[currentPt];
  var aTbl=document.getElementById('post-allergy-tbl');
  while(aTbl.rows.length>1) aTbl.deleteRow(1);
  if(pt.allergies.length){ pt.allergies.forEach(function(a){
    var tr=aTbl.insertRow(); tr.innerHTML='<td class="ared">'+a.agent+'</td><td>'+a.sev+'</td><td>'+a.signs+'</td>';
  });} else { var tr=aTbl.insertRow(); tr.innerHTML='<td colspan="3" style="color:green;font-weight:bold;padding:3px">No Known Allergies (NKA)</td>'; }
  document.getElementById('post-directives').innerHTML=pt.postings.map(function(p){return '<div style="padding:1px 4px;border-bottom:1px solid #eee;color:#0000cc;cursor:pointer">'+p+'</div>';}).join('');
  showFloatWin('postings-dlg');
}

function showFloatWin(id){ document.getElementById(id).style.display='block'; makeDraggable(id); }
function closeWin(id){ document.getElementById(id).style.display='none'; }
function makeDraggable(winId){
  var win=document.getElementById(winId);
  var handle=win.querySelector('.fw-title, .dlg-title');
  if(!handle||handle._drag) return;
  handle._drag=true;
  var mx,my;
  handle.onmousedown=function(e){
    if(e.target.classList.contains('wb')) return;
    e.preventDefault(); mx=e.clientX; my=e.clientY;
    document.onmousemove=function(e){
      var dx=e.clientX-mx, dy=e.clientY-my; mx=e.clientX; my=e.clientY;
      win.style.left=(win.offsetLeft+dx)+'px'; win.style.top=(win.offsetTop+dy)+'px';
    };
    document.onmouseup=function(){ document.onmousemove=null; document.onmouseup=null; };
  };
}
function makeResizable(winId,handleId){
  var win=document.getElementById(winId);
  var handle=document.getElementById(handleId);
  if(!handle||handle._resize) return;
  handle._resize=true;
  var mx,my,startW,startH;
  handle.onmousedown=function(e){
    e.preventDefault(); e.stopPropagation();
    mx=e.clientX; my=e.clientY;
    startW=win.offsetWidth; startH=win.offsetHeight;
    document.onmousemove=function(e){
      var dx=e.clientX-mx, dy=e.clientY-my;
      var minW=parseInt(getComputedStyle(win).minWidth)||300;
      var minH=parseInt(getComputedStyle(win).minHeight)||200;
      win.style.width=Math.max(minW,startW+dx)+'px';
      win.style.height=Math.max(minH,startH+dy)+'px';
    };
    document.onmouseup=function(){ document.onmousemove=null; document.onmouseup=null; };
  };
}
