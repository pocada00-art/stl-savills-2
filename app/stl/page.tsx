"use client";

import { useMemo, useState } from "react";
import { demo } from "@/lib/data";
import { Card, SectionTitle, Badge, Button, Select } from "@/components/ui";
import { GitCompareArrows, History, Plus, ShieldCheck, Search } from "lucide-react";

export default function STL(){
 const [country,setCountry]=useState("España"); const [q,setQ]=useState(""); const catalog=country==="España"?demo.esCatalog:demo.ptCatalog;
 const list=useMemo(()=>catalog.filter((x:any)=>`${x.code} ${x.category} ${x.installation} ${x.action}`.toLowerCase().includes(q.toLowerCase())),[catalog,q]);
 return <div className="space-y-6">
  <SectionTitle title="STL España / Portugal" subtitle="Versión activa, instalaciones reguladas y matriz normativa" action={<Button><Plus className="mr-2 inline h-4 w-4"/>Nueva versión</Button>}/>
  <div className="grid gap-4 md:grid-cols-2"><Card className="p-6"><div className="flex items-center justify-between"><Badge tone="success">Versión activa</Badge><ShieldCheck className="h-5 w-5 text-[#002A54]"/></div><h3 className="mt-5 text-xl font-black">{country==="España"?"STL_ES_2026_V1":"STL_PT_2026_V1"}</h3><p className="mt-1 text-sm text-slate-500">{country} · catálogo {catalog.length} elementos</p></Card><Card className="p-6"><div className="flex items-center justify-between"><Badge tone="warning">Histórico</Badge><History className="h-5 w-5"/></div><h3 className="mt-5 text-xl font-black">Ver versiones anteriores</h3><p className="mt-1 text-sm text-slate-500">Las versiones futuras no sustituyen el histórico ya aplicado a los centros.</p></Card></div>
  <Card className="p-6"><div className="flex flex-wrap gap-3"><Select value={country} onChange={setCountry}><option>España</option><option>Portugal</option></Select><div className="relative flex-1 min-w-[250px]"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar instalación, código o actuación..." className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"/></div></div></Card>
  <Card className="p-6"><SectionTitle title={`Instalaciones reguladas · ${country}`} subtitle={`${list.length} elementos de la versión activa`}/><div className="table-wrap"><table className="table"><thead><tr><th>Código</th><th>Categoría</th><th>Instalación</th><th>Actuación</th><th>Frecuencia</th><th>Normativa</th></tr></thead><tbody>{list.map((x:any)=><tr key={x.id}><td className="font-mono text-xs">{x.code}</td><td>{x.category}</td><td className="font-semibold">{x.installation}</td><td>{x.action}</td><td><Badge>{x.frequency}</Badge></td><td className="text-xs text-slate-500">{x.normativeReference||x.descriptionPt||"—"}</td></tr>)}</tbody></table></div></Card>
  <Card className="p-6"><SectionTitle title="Matriz normativa"/><div className="table-wrap"><table className="table"><thead><tr><th>País</th><th>Base</th><th>Referencia</th><th>Estado</th></tr></thead><tbody>{[["España","Reglamentos técnicos","RITE / REBT / RIPCI / RD 487/2022","Activa"],["Portugal","Regulamentos / NP","SCIE / DL / Portarias / NP","Activa"]].map(r=><tr key={r[0]}><td className="font-semibold">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td><Badge tone="success">{r[3]}</Badge></td></tr>)}</tbody></table></div></Card>
 </div>
}
