function renderOrders(pt){
  document.getElementById('left-pane').style.display='none';
  document.getElementById('right-pane').style.display='none';
  var mp=document.getElementById('main-panes');
  var outer=document.createElement('div'); outer.id='orders-outer';
  var left=document.createElement('div'); left.id='orders-left';
  var ll=document.createElement('div'); ll.id='orders-left-list';
  var menuItems=[
    {label:'Active Orders (incl. Pending & Recent Activity)',sel:true},
    {sep:'Write Delayed Orders'},{label:'Write Orders'},{label:'Allergies'},
    {label:'Consults/Procedures Order Menu'},{sep:''},
    {label:'Lab Test Quick Orders Menu'},{label:'Blood Bank Orders'},{sep:''},
    {label:'Inpatient Medication Order Menu'},{label:'Outpatient Meds/Supplies/IV Menu'},
    {label:'Meds, Non-VA (Documentation)'},{sep:''},
    {label:'Radiology/NucMed Order Menu'},{sep:''},{label:'CODE STROKE Order Menu'},
    {sep:'*** INPATIENT UNITS ***'},{label:'INPATIENT WARDS Order Menu'},
    {label:'WLA CLC Order Menu'},{label:'SEP CLC Order Menu'},{label:'DOM Order Menu'},
    {sep:'*** OUTPATIENT CLINICS ***'},{label:'GLA PACT RN Order Menu'},
    {label:'AVC CBOC Order Menu'},{label:'BACC CBOC Order Menu'},{label:'ELA CBOC Order Menu'},
    {label:'LAACC CBOC Order Menu'},{label:'SACC CBOC Order Menu'},
    {sep:'*** EMERGENCY DEPARTMENT ***'},{label:'ED Order Menu'},{label:'ED RN Order Menu'},
    {sep:'*** OTHER ***'},{label:'F/U TICKLER (Reminder)'},{label:'GET WELL NETWORK'},
    {label:'Return To Clinic'},{label:'Non-VA Death Notification'},
  ];
  menuItems.forEach(function(item){
    var d=document.createElement('div');
    if(item.sep!==undefined){ d.className='ol-sep'; d.textContent=item.sep; }
    else { d.className='ol-item'+(item.sel?' sel':''); d.textContent=item.label;
      d.onclick=function(){ ll.querySelectorAll('.ol-item').forEach(function(x){x.classList.remove('sel');}); d.classList.add('sel'); }; }
    ll.appendChild(d);
  });
  left.appendChild(ll); outer.appendChild(left);
  var right=document.createElement('div'); right.id='orders-right';
  var hdrBar=document.createElement('div'); hdrBar.className='orders-hdr-bar';
  hdrBar.textContent='Active Orders (includes Pending & Recent Activity) - ALL SERVICES';
  right.appendChild(hdrBar);
  var tableWrap=document.createElement('div'); tableWrap.style.cssText='flex:1;overflow-y:auto;background:#fffff0';
  var html='<table class="orders-tbl"><thead><tr><th style="width:115px">Service</th><th>Order</th><th style="width:120px">Start / Stop</th><th style="width:95px">Provider</th><th style="width:18px">N</th><th style="width:18px">C</th><th style="width:18px">C</th><th style="width:34px">S</th><th style="width:40px">L</th></tr></thead><tbody>';
  var lastSvc='';
  pt.orders.forEach(function(o,i){
    var svcCell=o.svc!==lastSvc?'<td class="svc-cell">'+o.svc+'</td>':'<td></td>';
    lastSvc=o.svc;
    var isPending=o.stat==='pending';
    html+='<tr onclick="showOrderDetails('+i+',\''+currentPt+'\')">'+svcCell+'<td style="white-space:pre-wrap'+(isPending?';color:#0000cc':'')+'">'+o.ord+'</td><td style="font-size:10px">'+o.start+'</td><td style="font-size:10px">'+o.prov.split(',')[0]+'</td><td></td><td></td><td></td><td style="font-size:10px">'+(o.stat==='active'?'ac':'pe')+'</td><td style="font-size:10px">'+(o.loc||'')+'</td></tr>';
  });
  html+='</tbody></table>';
  tableWrap.innerHTML=html; right.appendChild(tableWrap); outer.appendChild(right);
  mp.appendChild(outer);
}
function showOrderDetails(idx,ptId){
  var o=PTS[ptId].orders[idx]; if(!o) return;
  document.getElementById('od-title').textContent='Order Details';
  document.getElementById('od-body').textContent=o.ord+'\n\n----------------------------------------\nActivity:\n  '+o.start+'  New Order ENTERED\n  Entered by: '+o.prov+'\n  Nature of Order: ELECTRONICALLY ENTERED\n\nCurrent Status: '+o.stat.toUpperCase()+'\nOrdering Location: '+(o.loc||'')+'\nStart Date/Time: '+o.start;
  showFloatWin('order-details-dlg');
}

