"use client";
import { Card, SectionTitle, Badge, Button, SortHeader } from "@/components/ui";
import { FileText, UploadCloud, Search } from "lucide-react";
import { useMemo, useState } from "react";

const docs=[
 ["Informe OCA","MALAGA OCIO","PDF","2026-07-18","Vigente"],
 ["Certificado ascensores","OASIZ","PDF","2026-06-21","Vigente"],
 ["Acta PCI","LA DEHESA","PDF","2026-05-09","Pendiente revisión"],
 ["Plan mantenimiento","RIOSUL","PDF","2026-04-12","Caducado"],
 ["Analítica Legionella","LOURE SHOPPING","PDF","2026-07-30","Vigente"],
 ["Certificado energético","8ª AVENIDA","PDF","2026-03-18","Próximo vencimiento"],
];
export default function Documents(){
 const [q,setQ]=useState(""); const [sort,setSort]=useState({i:0,d:"asc" as "asc"|"desc"});
 const list=useMemo(()=>docs.filter(d=>d.join(" ").toLowerCase().includes(q.toLowerCase())).sort((a,b)=>String(a[sort.i]).localeCompare(String(b[sort.i]),"es",{numeric:true})*(sort.d==="asc"?1:-1)),[q,sort]);
 const toggle=(i:number)=>setSort(s=>({i,d:s.i===i&&s.d==="asc"?"desc":"asc"}));
 return <div className="space-y-6"><SectionTitle title="Gestión documental" subtitle="Biblioteca privada del centro, instalación y actuación" action={<Button><UploadCloud className="mr-2 inline h-4 w-4"/>Subir documento</Button>}/><Card className="p-4"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar documento..." className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"/></div></Card><div className="table-wrap"><table className="table"><thead><tr><th><SortHeader label="Documento" onClick={()=>toggle(0)}/></th><th><SortHeader label="Centro" onClick={()=>toggle(1)}/></th><th><SortHeader label="Formato" onClick={()=>toggle(2)}/></th><th><SortHeader label="Fecha" onClick={()=>toggle(3)}/></th><th><SortHeader label="Estado" onClick={()=>toggle(4)}/></th></tr></thead><tbody>{list.map((d,i)=><tr key={i}><td className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4 text-slate-400"/>{d[0]}</td><td>{d[1]}</td><td>{d[2]}</td><td>{d[3]}</td><td><Badge tone={d[4]==="Vigente"?"success":d[4]==="Caducado"?"danger":"warning"}>{d[4]}</Badge></td></tr>)}</tbody></table></div></div>
}
