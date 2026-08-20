"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, ArrowUpDown } from "lucide-react";
import { demo } from "@/lib/data";
import { Card, SectionTitle, Badge, Select, Button } from "@/components/ui";

type SortKey = "name"|"code"|"shortCode"|"country"|"property"|"manager"|"stl"|"status";
export default function Centers(){
 const [q,setQ]=useState(""); const [country,setCountry]=useState("Todos");
 const [sort,setSort]=useState<{key:SortKey;dir:"asc"|"desc"}>({key:"name",dir:"asc"});
 const list=useMemo(()=>{
   const arr=demo.centers.filter(c=>(country==="Todos"||c.country===country)&&`${c.name} ${c.code} ${c.shortCode||""}`.toLowerCase().includes(q.toLowerCase()));
   return [...arr].sort((a:any,b:any)=>String(a[sort.key]??"").localeCompare(String(b[sort.key]??""),"es",{numeric:true})*(sort.dir==="asc"?1:-1));
 },[q,country,sort]);
 function toggle(key:SortKey){setSort(s=>({key,dir:s.key===key&&s.dir==="asc"?"desc":"asc"}))}
 const th=(key:SortKey,label:string)=><th><button className="inline-flex items-center gap-1" onClick={()=>toggle(key)}>{label}<ArrowUpDown className="h-3 w-3 text-slate-400"/></button></th>;
 return <div className="space-y-6">
  <SectionTitle title="Gestión de centros comerciales" subtitle={`${list.length} centros · datos reales iniciales`} action={<Button><Plus className="mr-2 inline h-4 w-4"/>Nuevo centro</Button>}/>
  <Card className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por centro, código o abreviatura..." className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"/></div><Select value={country} onChange={setCountry}><option>Todos</option><option>España</option><option>Portugal</option></Select></div></Card>
  <div className="table-wrap"><table className="table"><thead><tr>{th("name","Centro")}{th("shortCode","Código")}{th("code","Nº")}{th("country","País")}{th("property","Propiedad")}{th("manager","Responsable")}{th("stl","STL")}{th("status","Estado")}</tr></thead>
  <tbody>{list.map(c=><tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={()=>window.location.href=`/centers/${encodeURIComponent(c.id)}`}>
    <td><Link href={`/centers/${encodeURIComponent(c.id)}`} className="block"><div className="font-bold">{c.name}</div><div className="text-xs text-slate-400">{c.shortCode||"—"}</div></Link></td>
    <td className="font-mono text-xs">{c.shortCode||"—"}</td><td className="font-mono text-xs">{c.code}</td><td>{c.country}</td><td>{c.property||"—"}</td><td>{c.manager||"Sin asignar"}</td>
    <td><Badge tone={c.country==="España"?"info":"warning"}>{c.stl}</Badge></td><td><Badge tone="success">{c.status}</Badge></td>
  </tr>)}</tbody></table></div>
 </div>
}
