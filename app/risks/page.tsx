"use client";
import { useMemo, useState } from "react";
import { demo } from "@/lib/data";
import { Card, SectionTitle, Badge, SortHeader } from "@/components/ui";
import { ShieldAlert } from "lucide-react";

const risks=Array.from({length:14},(_,i)=>{const c=demo.centers[(i*3)%demo.centers.length]; return {id:i+1,center:c.name,country:c.country,installation:(demo.esCatalog[i%demo.esCatalog.length] as any).installation,gravity:i%7===0?"Crítica":i%3===0?"Alta":i%2===0?"Media":"Baja",status:i%4===0?"Abierta":i%4===1?"En curso":"Pendiente de tercero",target:`2026-${String((i%9)+8).padStart(2,"0")}-15`};});
export default function Risks(){
 const [sort,setSort]=useState({key:"center" as keyof typeof risks[number],dir:"asc" as "asc"|"desc"});
 const rows=useMemo(()=>[...risks].sort((a,b)=>String(a[sort.key]).localeCompare(String(b[sort.key]),"es",{numeric:true})*(sort.dir==="asc"?1:-1)),[sort]);
 const toggle=(key:any)=>setSort(s=>({key,dir:s.key===key&&s.dir==="asc"?"desc":"asc"}));
 const th=(k:any,l:string)=><th><SortHeader label={l} onClick={()=>toggle(k)}/></th>;
 return <div className="space-y-6"><SectionTitle title="Dashboard de riesgo" subtitle="Riesgo técnico-legal más allá del cumplimiento simple"/><div className="grid gap-4 md:grid-cols-4">{["Crítica","Alta","Media","Baja"].map(g=><Card key={g} className="p-5"><div className="flex items-center gap-2"><ShieldAlert className="h-5 w-5"/><span className="font-semibold">{g}</span></div><div className="mt-3 text-3xl font-black">{risks.filter(r=>r.gravity===g).length}</div><div className="text-xs text-slate-400">riesgos identificados</div></Card>)}</div><Card className="p-6"><SectionTitle title="Riesgos abiertos"/><div className="table-wrap"><table className="table"><thead><tr>{th("center","Centro")}{th("country","País")}{th("installation","Instalación")}{th("gravity","Gravedad")}{th("status","Estado")}{th("target","Fecha objetivo")}</tr></thead><tbody>{rows.map(r=><tr key={r.id}><td className="font-semibold">{r.center}</td><td>{r.country}</td><td>{r.installation}</td><td><Badge tone={r.gravity==="Crítica"?"danger":r.gravity==="Alta"?"warning":"info"}>{r.gravity}</Badge></td><td>{r.status}</td><td>{r.target}</td></tr>)}</tbody></table></div></Card></div>
}
