/* Archegon v3 engine: mirrors archegon-model-v3.xlsx (Funding-Tiers, Power-Economics, Firm-Power, Flow-Basis).
   Constants come from archegon-data.js (generated from the workbook). Nothing is hard-coded here. */
(function(g){
var M=g.ARCHEGON_MODEL;
function unit(o){
  o=o||{}; var fx=M.fx, u={};
  u.mode=o.mode||'COLO';
  u.p = (typeof o.mwe==='number') ? o.mwe : M.mwe[o.prod||'BASE'];
  u.well = (typeof o.well==='number') ? o.well : M.wellCost[o.cost||'BASE'];
  u.pue = o.pue||M.pue; u.cf=o.cf||M.cf; u.cont=(o.cont!=null?o.cont:M.cont);
  u.injPerProd = o.triplet?2:1;
  u.plantKw = M.plantUsdKw/fx;                                   // A$/kW NET
  u.dcMw = (M.dcShellUsdMw+M.liquidUsdMw)/fx*M.remote;           // A$/MW IT
  u.itMw = u.mode==='BAREMETAL' ? M.itFitUsdMw/fx : 0;
  u.capexPerMwIt = u.plantKw*1000*u.pue/u.cf + u.dcMw + u.itMw;
  var colo = (o.coloUsd||M.coloUsdKwMo);
  u.revMw = u.mode==='COLO' ? colo*12*1000/fx : (u.mode==='ANCHOR' ? M.anchorUsdMwYr/fx : 0);   // v3: ANCHOR bug fixed
  u.omMw = M.omUsdKwYr*1000*u.pue/u.cf/fx + M.dcOpexUsdMwYr/fx;
  u.fixed = M.teamMo*12 + M.wellReplAudYr;
  u.runway = M.teamMo*M.runwayMo;
  u.wellsPer = 1+u.injPerProd;
  if (u.revMw-u.omMw>0){ u.beIt=u.fixed/(u.revMw-u.omMw); u.beProd=Math.ceil(+(u.beIt*u.pue/u.cf/u.p).toFixed(6));
    u.breakEven=(u.wellsPer*u.beProd*u.well+M.rigMob+M.unpriced+u.capexPerMwIt*u.beIt)*(1+u.cont)+u.runway; } else {u.beIt=null;u.breakEven=null;}
  var p1=Math.ceil(+(M.moduleMw*u.pue/u.cf/u.p).toFixed(6));
  u.firstModule=(u.wellsPer*p1*u.well+M.rigMob+M.unpriced+u.capexPerMwIt*M.moduleMw)*(1+u.cont)+u.runway;
  u.reservoirTest=(2*u.well+M.rigMob)*(1+u.cont)+u.runway;
  u.appraisalWell=(u.well+M.rigMob)*(1+u.cont)+u.runway;
  return u;
}
function tier(F,o){
  var u=unit(o), t={F:F,u:u}, B=Math.max(0,(F-u.runway)/(1+u.cont)), best=null;
  for (var n=1;n<=10;n++){
    var cap=n*u.p*u.cf/u.pue, left=(B-u.wellsPer*n*u.well-M.rigMob-M.unpriced)/u.capexPerMwIt;
    var it=Math.max(0,Math.floor(Math.min(cap,left)/M.moduleMw+1e-9)*M.moduleMw);
    if(it<=0) continue;
    var com=(u.wellsPer*n*u.well+M.rigMob+M.unpriced+u.capexPerMwIt*it)*(1+u.cont)+u.runway;
    var con=it*(u.revMw-u.omMw)-u.fixed, ratio=con/com;
    if(!best||ratio>best.ratio+1e-12) best={n:n,it:it,com:com,con:con,ratio:ratio};
  }
  t.prod=best?best.n:0; t.it=best?best.it:0; t.modules=Math.round(t.it/M.moduleMw);
  t.wells=t.prod*u.wellsPer; t.netNameplate=t.it*u.pue/u.cf; t.avgFence=t.netNameplate*u.cf; t.wellCap=t.prod*u.p;
  t.firm=Math.min(t.netNameplate,Math.max(0,(t.prod-1)*u.p)); t.firmIt=Math.floor(t.firm/u.pue/M.moduleMw+1e-9)*M.moduleMw;
  t.racks=Math.floor(t.it*1000/M.rackKw+1e-9);
  t.uof={wells:t.prod?u.wellsPer*t.prod*u.well+M.rigMob:0, plant:t.netNameplate*1000*u.plantKw, dc:t.it*u.dcMw, it:t.it*u.itMw};
  var capex=t.uof.wells+t.uof.plant+t.uof.dc+t.uof.it; t.uof.cont=capex*u.cont; t.uof.runway=t.prod?u.runway:0;
  t.committed=capex+t.uof.cont+t.uof.runway; t.undrawn=F-t.committed;
  t.rev=t.it*u.revMw; t.opex=t.prod?t.it*u.omMw+u.fixed:0; t.contrib=t.rev-t.opex; t.ratio=t.committed>0?t.contrib/t.committed:0;
  t.mwh=t.avgFence*8760;
  if(!t.prod){ t.status=F>=u.reservoirTest?'test':(F>=u.appraisalWell?'appraisal':'none'); }
  else t.status=t.contrib<0?'neg':(t.it<M.refIt?'small':'ref');
  return t;
}
function crf(r,n){return r/(1-Math.pow(1+r,-n));}
function reference(o){ // the reference build at IT target, as AU-Route / Power-Economics / Firm-Power
  var u=unit(o), it=(o&&o.it)||M.refIt, r={u:u,it:it};
  r.netNameplate=it*u.pue/u.cf; r.avg=r.netNameplate*u.cf; r.mwh=r.avg*8760;
  r.prod=Math.ceil(+(r.netNameplate/u.p).toFixed(6))+((o&&o.n1)?1:0);
  r.wells=r.prod*u.wellsPer;
  r.wellsCost=r.wells*u.well+M.rigMob; r.plant=r.netNameplate*1000*u.plantKw; r.dc=it*u.dcMw+it*u.itMw;
  r.gen=(r.wellsCost+r.plant)*(1+u.cont); r.raise=(r.wellsCost+r.plant+r.dc+M.unpriced)*(1+u.cont)+u.runway;
  r.om=M.omUsdKwYr*1000*r.netNameplate/M.fx;
  r.rev=it*u.revMw; r.opex=r.om+it*M.dcOpexUsdMwYr/M.fx+u.fixed; r.contrib=r.rev-r.opex; r.ratio=r.contrib/r.raise;
  var w=(o&&o.wacc)||M.wacc; r.lcoe=(r.gen*crf(w,M.life)+r.om)/r.mwh; r.powerShare=(r.gen*crf(w,M.life)+r.om)/r.rev;
  r.firm=Math.min(r.netNameplate,(r.prod-1)*u.p); r.firmIt=r.firm/u.pue; r.firmModules=Math.floor(r.firmIt/M.moduleMw+1e-9);
  return r;
}
function exergy(T){var T0=M.t0;return M.cp*((T-T0)-(T0+273.15)*Math.log((T+273.15)/(T0+273.15)));}
function flowFor(mwe,T){var e=exergy(T);return {lo:mwe*1000/(e*M.utilHi*(1-M.parEia)), hi:mwe*1000/(e*M.utilLo*(1-M.parEgs))};}
g.ArchegonEngine={M:M,unit:unit,tier:tier,reference:reference,flowFor:flowFor,exergy:exergy};
})(typeof window!=='undefined'?window:globalThis);
