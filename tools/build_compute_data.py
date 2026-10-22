"""Generate assets/js/archegon-compute.js from the recalculated workbook's Sell-Compute tab (PUBLIC PROXY inputs)."""
import sys,json,openpyxl
wb=openpyxl.load_workbook(sys.argv[1],data_only=True); S=wb['Sell-Compute']
inp={}; src={}
for r in range(5,40):
    k=S.cell(r,1).value
    if not k or S.cell(r,3).value is None: continue
    if k=='Case': break
    inp[k]=S.cell(r,3).value; src[k]={'label':S.cell(r,2).value,'source':S.cell(r,6).value,'url':S.cell(r,7).value,'date':S.cell(r,8).value,'status':S.cell(r,5).value}
CR=wb['Compute-Revenue']; RC=wb['Route-Compare']; C=wb['Control']
D={'inp':inp,'src':src,'fx':wb['Rates']['D4'].value,'horizon':wb['Rates']['D71'].value,'remoteDisc':wb['Rates']['D83'].value,
   'nz':{'infra':RC['C6'].value,'cashOpex':CR['B24'].value+C['B15'].value*12},
   'au':{'infra':RC['B6'].value,'cashOpex':CR['B23'].value+C['B15'].value*12}}
CN=wb['Connectivity']; rows={}
for r in range(30,95):
    a=CN.cell(r,1).value
    if isinstance(a,str) and a[:3] in ('1. ','1b.','2a.','2b.','3. ','3b.','4. ','4b.','4c.','4d.','4e.','NZ:'): rows[a[:3]]=r
key={'1. ':'today','1b.':'todi','2a.':'bt','2b.':'bi','3. ':'cg','3b.':'cgi','4. ':'fb','4b.':'fi','4c.':'fl','4d.':'fh','4e.':'fy','NZ:':'nz'}
conn={}
for k,r in rows.items():
    conn[key[k]]={'label':CN.cell(r,1).value,'need':CN.cell(r,2).value,'deliv':CN.cell(r,3).value,'units':CN.cell(r,4).value,'capex':CN.cell(r,5).value,'opex':CN.cell(r,6).value,'ok':CN.cell(r,7).value=='yes','note':CN.cell(r,8).value}
csrc={}
for r in range(17,46):
    k=CN.cell(r,1).value
    if k and CN.cell(r,3).value is not None and k!='Option': csrc[k]={'v':CN.cell(r,3).value,'label':CN.cell(r,2).value,'status':CN.cell(r,5).value,'source':CN.cell(r,6).value,'url':CN.cell(r,7).value,'date':CN.cell(r,8).value}
D['conn']=conn; D['connSrc']=csrc; D['connDefault']=['today','bt','cg','fb'][int(CN['C4'].value)-1]; D['workDefault']='train' if CN['C10'].value==1 else 'inf'; D['infPair']={'today':'todi','bt':'bi','cg':'cgi','fb':'fi','fy':'fi'}
DC=wb['Decline']; HRs=wb['Headroom']; AR=wb['AU-Route']; Ctl=wb['Control']; Rt=wb['Rates']
D['th']={'T0':DC['C15'].value,'Td':DC['C16'].value,'cp':Rt['D66'].value,'e0':DC['C23'].value,'g0':DC['C24'].value,'pw':DC['C25'].value,'np':DC['C19'].value,'plant':DC['C20'].value,'cf':DC['C21'].value,'mod':DC['C22'].value,'dflt':DC['C4'].value or 0,
 'wells':{'base':HRs['C7'].value,'low':HRs['C8'].value,'high':HRs['C9'].value,'hab':HRs['C10'].value},'w':HRs['C11'].value,'stim':HRs['C12'].value,'mob':HRs['C13'].value,'cont':HRs['C14'].value,'hall':AR['B31'].value*(1+Ctl['B13'].value)}
js='/* Generated from archegon-model-v3.xlsx Sell-Compute tab. PUBLIC PROXY inputs; see src for URLs. */\n(function(g){\nvar C='+json.dumps(D)+''';
function irr(cf){var s=0;for(var i=0;i<cf.length;i++)s+=cf[i];if(s<0)return null;function npv(r){var v=0;for(var i=0;i<cf.length;i++)v+=cf[i]/Math.pow(1+r,i);return v}
 var lo=-0.99,hi=1;if(npv(lo)*npv(hi)>0)return null;for(var k=0;k<200;k++){var m=(lo+hi)/2;if(npv(lo)*npv(m)<=0)hi=m;else lo=m}return (lo+hi)/2}
function sell(itMw,infra,cashOpex,o){o=o||{};var I=C.inp,fx=C.fx;
 var price=o.price!=null?o.price:I.p_base,util=o.util!=null?o.util:I.u_base,decay=o.decay!=null?o.decay:I.decay;
 if(o.remote)price=price*(1-C.remoteDisc);var ck=o.conn||C.connDefault,wk=o.work||C.workDefault;if(wk==='inf'&&C.infPair[ck])ck=(ck==='fy'?'fy':C.infPair[ck]);var cn=C.conn[ck]||{capex:0,opex:0,need:1,deliv:1};var cap=1;if(o.noConn)cn={capex:0,opex:0};
 var r={servers:Math.floor(itMw*1000/I.srv_kw+1e-9)};r.gpus=r.servers*I.gpu_per_srv;
 r.gpuCapex=r.servers*I.srv_usd*(1+I.net_share)/fx;var cn0=cn;if(o.noConn)cn={capex:0,opex:0};r.conn=cn;{var nd=cn0.need;if(wk==='inf'&&ck==='fy')nd=r.gpus/100*C.connSrc.bw_inf100.v;cap=Math.min(1,cn0.deliv/nd);if(!o.noConn&&wk==='inf'&&ck==='fy')cn={capex:cn.capex,opex:cn.opex-12*C.connSrc.dtcs.v*C.connSrc.bw_train.v+12*C.connSrc.dtcs.v*nd};}r.cap=cap;r.total=infra+cn.capex+r.gpuCapex;cashOpex=cashOpex+cn.opex;r.gpuHours=r.gpus*8760*util*cap;r.rev=r.gpuHours*price/fx;
 r.maint=I.maint_share*r.gpuCapex;r.staff=r.gpus>0?Math.max(I.fte_512,r.gpus/512*I.fte_512)*I.eng_usd/fx:0;r.other=cashOpex;
 r.ebitda=r.rev-r.maint-r.staff-cashOpex;r.margin=r.rev>0?r.ebitda/r.rev:0;r.yield=r.total>0?r.ebitda/r.total:0;r.payback=r.ebitda>0?r.total/r.ebitda:null;
 var T=C.th,L=I.life,H=C.horizon,au=!!o.au,d=o.thermal!=null?o.thermal:(au?T.dflt:0),hr=au?o.headroom:null,W=o.wellCost?(T.wells[o.wellCost]||o.wellCost):T.w,DBL=2*(W+T.stim)*(1+T.cont),MOB=T.mob*(1+T.cont);
 function ex(t){return T.cp*(t-T.Td-(T.Td+273.15)*Math.log((t+273.15)/(T.Td+273.15)))}
 function capA(age){return ex(T.T0-d*age)/T.e0*T.g0-T.pw}
 function lit(c){return Math.max(0,Math.min(4,Math.floor(Math.min(T.plant,c)*T.cf/T.mod+1e-9)))}
 var cf=[-r.total],F=1,k=0,mk=[],nn=[0,0];r.extraCapex=0;r.extraDoublets=0;
 if(hr==='a'){var c24=capA(H-1);k=c24<=0?null:Math.max(0,Math.ceil(T.plant/c24-1e-9)-T.np);r.feasible=k!==null;if(k){cf[0]-=k*DBL;r.extraCapex=k*DBL;r.extraDoublets=k}k=k||0}
 if(hr==='c'){var N=lit(T.np*Math.max(0,capA(H-1)));F=N/4;r.modules=N;cf[0]+=(1-F)*(r.gpuCapex+T.hall);r.extraCapex=-(1-F)*(r.gpuCapex+T.hall)}
 if(hr==='b'){for(var t=2;t<=H;t++){var pre=T.np*capA(t-1);for(var s=2;s<t;s++)pre+=nn[s]*capA(t-s);var n=(pre<T.plant-1e-9&&capA(0)>0)?Math.ceil((T.plant-pre)/capA(0)):0;nn[t]=n;if(n>0){mk[t-1]=n*DBL+MOB;r.extraCapex+=n*DBL+MOB;r.extraDoublets+=n}}if(mk[0])cf[0]-=mk[0]}
 r.lit=[];
 for(var t=1;t<=H;t++){var lf=1;
  if(au&&hr!=='c'){var cp=(T.np+(hr==='a'?k:0))*capA(t-1);if(hr==='b'){cp=T.np*capA(t-1);for(var s=2;s<=t;s++)cp+=(nn[s]||0)*capA(t-s)}lf=lit(cp)/4}
  if(hr==='c')lf=F;r.lit.push(lf*4);
  var rf=(t%L===0&&t<H)?r.gpuCapex:0,rv=r.rev*Math.pow(1+decay,(t-1)%L);
  cf.push((rv-r.maint-r.staff)*lf-cashOpex-rf*lf-(mk[t]||0))}
 r.cf=cf;r.net=cf.reduce(function(a,b){return a+b},0);r.irr=irr(cf);r.price=price;r.util=util;r.decay=decay;r.thermal=d;r.headroom=hr||null;return r}
g.ArchegonCompute={C:C,sell:sell,irr:irr};
})(typeof window!=='undefined'?window:globalThis);
'''
open('assets/js/archegon-compute.js','w').write(js); print('ok',len(js))
