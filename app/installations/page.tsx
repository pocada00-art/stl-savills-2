"use client";
import { useMemo, useState } from "react";
import { demo } from "@/lib/data";
import { Card, SectionTitle, Badge, Select, SortHeader } from "@/components/ui";
import { Search } from "lucide-react";

export default function Installations(){
 const [q,setQ]=useState(""); const [country,setCountry]=useState("Todos"); const [sort,setSort]=useState({key:"installation",dir:"asc" as "asc"|"desc"});
 const list=useMemo(()=>[...demo.esCatalog,...demo.ptCatalog].filter(x=>(country==="Todos"||x.country===country)&&`${x.code} ${x.installation} ${x.action} ${x.category}`.toLowerCase().includes(q.toLowerCase())).sort((a:any,b:any)=>String(a[sort.key]??"").localeCompare(String(b[sort.key]??""),"es",{numeric:true})*(sort.dir==="asc"?1:-1)),[q,country,sort]); const toggle=(key:string)=>setSort(s=>({key,dir:s.key===key&&s.dir==="asc"?"desc":"asc"}));
 return <div className="space-y-6"><SectionTitle title="Instalaciones reguladas" subtitle={`${list.length} actuaciones del catálogo corporativo cargado`}/>
 <Card className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar instalación, código, actuación..." className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"/></div><Select value={country} onChange={setCountry}><option>Todos</option><option>España</option><option>Portugal</option></Select></div></Card>
 <div className="table-wrap"><table className="table"><thead><tr><th><SortHeader label="País" onClick={()=>toggle("country")}/></th><th><SortHeader label="Código" onClick={()=>toggle("code")}/></th><th><SortHeader label="Categoría" onClick={()=>toggle("category")}/></th><th><SortHeader label="Instalación" onClick={()=>toggle("installation")}/></th><th><SortHeader label="Actuación" onClick={()=>toggle("action")}/></th><th><SortHeader label="Frecuencia" onClick={()=>toggle("frequency")}/></th></tr></thead><tbody>{list.map((x:any)=><tr key={x.id}><td><Badge tone={x.country==="España"?"info":"warning"}>{x.country}</Badge></td><td className="font-mono text-xs">{x.code}</td><td>{x.category}</td><td className="font-semibold">{x.installation}</td><td>{x.action}</td><td><Badge>{x.frequency}</Badge></td></tr>)}</tbody></table></div>
 </div>
}
