"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Printer, ArrowLeft, CheckCircle2 } from "lucide-react";
import { demo } from "@/lib/data";
import { loadState, reviewKey, reviewSummary, blankItem, type Period, type V1State } from "@/lib/v1-state";

export default function CertificatePage(){
 const params=useParams(); const search=useSearchParams(); const id=String(params.id);
 const center=demo.centers.find(c=>c.id===id); const year=Number(search.get("year")||2026); const period=(search.get("period")||"S2") as Period;
 const [state,setState]=useState<V1State>({role:"ADMIN",centers:{},activeItems:{},reviews:{}});
 useEffect(()=>setState(loadState()),[]);
 if(!center) return <div>Centro no encontrado</div>;
 const catalog=center.country==="España"?demo.esCatalog:demo.ptCatalog;
 const active=catalog.filter((x:any)=>(state.activeItems[center.id]?.[x.id]!==false));
 const review=state.reviews[reviewKey(center.id,year,period)];
 const summary=reviewSummary(review,active.map((x:any)=>x.id));
 const overrides=state.centers[center.id]||{};
 const rows=active.map((x:any)=>({x,item:review?.items[x.id]||blankItem()}));
 const certificateNumber=`STL-${center.code}-${period}-${year}`;
 return <div className="mx-auto max-w-5xl space-y-6">
  <div className="no-print flex items-center justify-between"><Link href={`/centers/${center.id}`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><ArrowLeft className="mr-2 inline h-4 w-4"/>Volver a ficha</Link><button onClick={()=>window.print()} className="rounded-xl bg-[#002A54] px-4 py-2 text-sm font-semibold text-white"><Printer className="mr-2 inline h-4 w-4"/>Imprimir / guardar PDF</button></div>
  <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-soft print:shadow-none print:border-0">
    <header className="border-b-2 border-[#002A54] pb-6">
      <div className="flex items-start justify-between gap-6">
        <div><div className="text-xs font-bold uppercase tracking-[.2em] text-[#002A54]">STL SAVILLS · CERTIFICADO DE REVISIÓN</div><h1 className="mt-2 text-3xl font-black">{center.name}</h1><p className="mt-2 text-sm text-slate-500">{center.country} · {center.stl} · Código {center.code}</p></div>
        {overrides.logoUrl?<img src={overrides.logoUrl} alt="Logo" className="h-16 w-28 object-contain"/>:<div className="text-right text-xs text-slate-400">STL SAVILLS</div>}
      </div>
    </header>
    <section className="mt-6 grid gap-4 md:grid-cols-4">
      <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-400">Revisión</div><div className="mt-1 text-lg font-black">{period} {year}</div></div>
      <div className="rounded-xl bg-emerald-50 p-4"><div className="text-xs text-emerald-700">Cumplimiento</div><div className="mt-1 text-2xl font-black text-emerald-700">{summary.score}%</div></div>
      <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-400">Elementos</div><div className="mt-1 text-lg font-black">{summary.total}</div></div>
      <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-400">Estado</div><div className="mt-1 font-black">{review?.confirmed?"CONFIRMADA":"NO CONFIRMADA"}</div></div>
    </section>
    <section className="mt-6"><h2 className="text-lg font-bold">Resumen de resultados</h2><div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">{Object.entries(summary.counts).map(([k,v])=><div key={k} className="rounded-xl border border-slate-200 p-3 text-center"><div className="text-xl font-black">{v}</div><div className="text-xs text-slate-500">{k}</div></div>)}</div></section>
    <section className="mt-8"><h2 className="text-lg font-bold">Elementos inspeccionados</h2><div className="mt-3 overflow-hidden rounded-xl border border-slate-200"><table className="w-full text-xs"><thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left">Código</th><th className="px-3 py-2 text-left">Instalación</th><th className="px-3 py-2 text-left">Actuación</th><th className="px-3 py-2 text-left">Estado</th><th className="px-3 py-2 text-left">Fecha</th><th className="px-3 py-2 text-left">Empresa</th></tr></thead><tbody>{rows.map(({x,item}:any)=><tr key={x.id} className="border-t border-slate-100"><td className="px-3 py-2 font-mono">{x.code}</td><td className="px-3 py-2">{x.installation}</td><td className="px-3 py-2">{x.action}</td><td className="px-3 py-2 font-semibold">{item.status}</td><td className="px-3 py-2">{item.date||"—"}</td><td className="px-3 py-2">{item.company||"—"}</td></tr>)}</tbody></table></div></section>
    <section className="mt-8 grid gap-6 md:grid-cols-2"><div><h2 className="text-lg font-bold">Confirmación</h2><div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm"><div>Administrador: <b>{review?.confirmedBy||"Pendiente"}</b></div><div className="mt-1">Fecha: <b>{review?.confirmedAt?new Date(review.confirmedAt).toLocaleString("es-ES"):"Pendiente"}</b></div><div className="mt-3 flex items-center gap-2">{review?.confirmed?<><CheckCircle2 className="h-5 w-5 text-emerald-600"/>Revisión confirmada</>: "Revisión aún no confirmada"}</div></div></div><div><h2 className="text-lg font-bold">Firmas de participantes</h2><div className="mt-3 space-y-2">{(review?.participants||[{name:"Gestor Demo",role:"GESTOR",signed:false},{name:"Administrador Demo",role:"ADMINISTRADOR",signed:false}]).map((p,i)=><div key={i} className="flex justify-between border-b border-slate-200 pb-2 text-sm"><span>{p.name} · {p.role}</span><span>{p.signed?"Firmado":"Pendiente"}</span></div>)}</div></div></section>
    <footer className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-400">Certificado {certificateNumber} · Documento generado desde la revisión histórica del centro. Para exportar a PDF utilice Imprimir → Guardar como PDF.</footer>
  </article>
 </div>
}
