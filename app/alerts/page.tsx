"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, SectionTitle, Badge, Button, Select } from "@/components/ui";
import { Bell, CheckCircle2, Settings2 } from "lucide-react";
import { demo } from "@/lib/data";
import { loadState, saveState, reviewKey, reviewSummary, type V1State } from "@/lib/v1-state";

type Alert = {id:string;type:string;center:string;country:string;stl:string;installation:string;reason:string;state:"OPEN"|"READ"|"RESOLVED";date:string};

export default function Alerts(){
 const [state,setState]=useState<V1State>({role:"ADMIN",centers:{},activeItems:{},reviews:{}}); useEffect(()=>setState(loadState()),[]); const [tab,setTab]=useState<"alerts"|"rules">("alerts"); const [filter,setFilter]=useState("Todas");
 const alerts=useMemo<Alert[]>(()=>{
   const generated:Alert[]=[];
   demo.centers.filter(c=>c.status==="Activo").forEach((c,ci)=>{
     const catalog=c.country==="España"?demo.esCatalog:demo.ptCatalog;
     const review=state.reviews[reviewKey(c.id,2026,"S2")];
     const sum=reviewSummary(review,catalog.filter((x:any)=>state.activeItems[c.id]?.[x.id]!==false).map((x:any)=>x.id));
     if(sum.pendingConfirmation>0) generated.push({id:`review-${c.id}`,type:"REVISIÓN PENDIENTE",center:c.name,country:c.country,stl:c.stl,installation:"Auditoría S2",reason:`${sum.pendingConfirmation} elementos pendientes de confirmar`,state:"OPEN",date:new Date().toISOString()});
     const item=catalog[ci%catalog.length] as any;
     generated.push({id:`due-${c.id}`,type:"30 DÍAS",center:c.name,country:c.country,stl:c.stl,installation:item.installation,reason:"Actuación próxima a vencimiento",state:"OPEN",date:new Date().toISOString()});
     if(ci%5===0) generated.push({id:`risk-${c.id}`,type:"RIESGO CRÍTICO",center:c.name,country:c.country,stl:c.stl,installation:item.installation,reason:"Riesgo técnico-legal crítico pendiente",state:"OPEN",date:new Date().toISOString()});
     if(ci%4===0) generated.push({id:`doc-${c.id}`,type:"DOCUMENTO PENDIENTE",center:c.name,country:c.country,stl:c.stl,installation:item.installation,reason:"Documento requerido pendiente de carga/revisión",state:"OPEN",date:new Date().toISOString()});
   });
   return generated;
 },[state]);
 const visible=filter==="Todas"?alerts:alerts.filter(a=>a.type===filter);
 function markRead(id:string){const next={...state} as any; next.readAlerts={...next.readAlerts,[id]:true}; saveState(next); setState(next);}
 const types=Array.from(new Set(alerts.map(a=>a.type)));
 return <div className="space-y-6">
  <SectionTitle title="Sistema de alertas y notificaciones" subtitle="Vencimientos, incumplimientos, documentos, riesgos y revisiones"/>
  <div className="grid gap-4 md:grid-cols-4">{[["Abiertas",alerts.length,"danger"],["30 días",alerts.filter(a=>a.type==="30 DÍAS").length,"warning"],["Riesgo crítico",alerts.filter(a=>a.type==="RIESGO CRÍTICO").length,"danger"],["Revisión pendiente",alerts.filter(a=>a.type==="REVISIÓN PENDIENTE").length,"info"]].map(([t,v,tone]:any)=><Card key={t} className="p-5"><Badge tone={tone}>{t}</Badge><div className="mt-3 text-2xl font-black">{v}</div><div className="text-xs text-slate-400">alertas</div></Card>)}</div>
  <div className="flex gap-2"><Button variant={tab==="alerts"?"primary":"secondary"} onClick={()=>setTab("alerts")}><Bell className="mr-2 inline h-4 w-4"/>Alertas</Button><Button variant={tab==="rules"?"primary":"secondary"} onClick={()=>setTab("rules")}><Settings2 className="mr-2 inline h-4 w-4"/>Reglas</Button></div>
  {tab==="alerts"?<Card className="p-6"><div className="mb-4 flex flex-wrap gap-2"><Select value={filter} onChange={setFilter}><option>Todas</option>{types.map(t=><option key={t}>{t}</option>)}</Select></div><div className="table-wrap"><table className="table"><thead><tr><th>Tipo</th><th>Centro</th><th>País</th><th>STL</th><th>Instalación</th><th>Motivo</th><th>Estado</th><th>Generación</th><th></th></tr></thead><tbody>{visible.map(a=><tr key={a.id}><td><Badge tone={a.type.includes("CRÍTICO")?"danger":a.type.includes("30")||a.type.includes("PENDIENTE")?"warning":"info"}>{a.type}</Badge></td><td className="font-semibold">{a.center}</td><td>{a.country}</td><td>{a.stl}</td><td>{a.installation}</td><td className="max-w-xs text-xs">{a.reason}</td><td>{(state as any).readAlerts?.[a.id]?<Badge>LEÍDA</Badge>:<Badge tone="danger">ABIERTA</Badge>}</td><td>{new Date(a.date).toLocaleDateString("es-ES")}</td><td><Button variant="secondary" onClick={()=>markRead(a.id)}><CheckCircle2 className="mr-1 inline h-3 w-3"/>Leer</Button></td></tr>)}</tbody></table></div></Card>
  :<Card className="p-6"><SectionTitle title="Reglas configurables" subtitle="País, STL, centro, instalación, actuación, responsable y riesgo"/><div className="table-wrap"><table className="table"><thead><tr><th>Regla</th><th>Ámbito</th><th>Avisos</th><th>Canal</th><th>Destinatarios</th><th>Estado</th></tr></thead><tbody>{[
   ["Vencimientos estándar","Todos los países / STL / centros","90 · 60 · 30 · vencimiento · post","Email + app","Gestor + Administrador",true],
   ["Incumplimientos","Todos","Inmediato","Email + app","Gestor + Administrador",true],
   ["Riesgo crítico","Todos · riesgo CRÍTICO","Inmediato","Email + app","Administrador",true],
   ["Documentación pendiente","Todos","30 · vencimiento","App","Gestor",true],
   ["STL desactualizado","Por país y versión","Inmediato","Email + app","Administrador",true],
  ].map(r=><tr key={r[0] as string}><td className="font-semibold">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td>{r[4]}</td><td><Badge tone={r[5]?"success":"default"}>{r[5]?"Activa":"Inactiva"}</Badge></td></tr>)}</tbody></table></div><div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">La persistencia de reglas y el envío real por email se conectarán a PostgreSQL/Resend cuando se configure el entorno productivo. La V1 deja definido el modelo y el flujo de configuración.</div></Card>}
 </div>
}
