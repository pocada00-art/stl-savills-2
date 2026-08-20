"use client";

import { useMemo, useState, useEffect } from "react";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { AlertTriangle, Building2, CalendarClock, CheckCircle2, FileWarning, Globe2, ArrowUpRight, Bell } from "lucide-react";
import Link from "next/link";
import { demo } from "@/lib/data";
import { Card, SectionTitle, Badge, Select } from "@/components/ui";
import { loadState, reviewKey, reviewSummary } from "@/lib/v1-state";

export default function Home(){
 const [country,setCountry]=useState("Todos"); const [state,setState]=useState(loadState()); useEffect(()=>setState(loadState()),[]);
 const filtered=country==="Todos"?demo.centers:demo.centers.filter(c=>c.country===country);
 const active=filtered.filter(c=>c.status==="Activo");
 const rows=active.map(c=>{const cat=c.country==="España"?demo.esCatalog:demo.ptCatalog;const ids=cat.filter((x:any)=>state.activeItems[c.id]?.[x.id]!==false).map((x:any)=>x.id);return {c,summary:reviewSummary(state.reviews[reviewKey(c.id,2026,"S2")],ids)}}); 
 const compliance=rows.length?Math.round(rows.reduce((a,r)=>a+r.summary.score,0)/rows.length):0;
 const pending=rows.reduce((a,r)=>a+r.summary.pendingConfirmation,0);
 const noApt=rows.reduce((a,r)=>a+r.summary.counts["NO APTO"],0);
 const docs=19;
 const chart=rows.slice().sort((a,b)=>b.summary.score-a.summary.score).map(r=>({shortCode:r.c.shortCode||r.c.code,score:r.summary.score}));
 const line=[{m:"S1 26",v:Math.max(0,compliance-5)},{m:"S2 26",v:compliance}];
 return <div className="space-y-8">
  <div className="rounded-3xl bg-[#002A54] p-6 text-white lg:p-8"><div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><div className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#FFCC00]">Centro de operaciones</div><h1 className="text-3xl font-black tracking-tight lg:text-4xl">STL SAVILLS</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">Gestión, seguimiento y control técnico-legal de centros comerciales. V1 basada en los datos reales de España y Portugal.</p></div><Select value={country} onChange={setCountry}><option>Todos</option><option>España</option><option>Portugal</option></Select></div></div>
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[
   ["Centros gestionados",active.length,"activos",Building2,"/centers"],["Cumplimiento legal",`${compliance}%`,"S2 2026",CheckCircle2,"/inspections"],["Pendientes de confirmar",pending,"elementos",Bell,"/alerts"],["NO APTO",noApt,"elementos",AlertTriangle,"/inspections"],["Documentos pendientes",docs,"seguimiento",FileWarning,"/documents"],["STL activos",country==="Todos"?2:1,"por país",Globe2,"/stl"]
  ].map(([t,v,sub,I,href]:any)=><Link href={href} key={t} className="group"><div className="kpi h-full transition group-hover:-translate-y-0.5 group-hover:shadow-lg"><div className="flex items-start justify-between"><div className="rounded-xl bg-slate-100 p-3"><I className="h-5 w-5 text-[#002A54]"/></div><ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-slate-700"/></div><div className="mt-5 text-3xl font-black">{v}</div><div className="mt-1 font-semibold text-slate-700">{t}</div><div className="mt-1 text-xs text-slate-400">{sub}</div></div></Link>)}</div>
  <div className="grid gap-6 xl:grid-cols-3"><Card className="p-6 xl:col-span-2"><SectionTitle title="Evolución del cumplimiento" subtitle="Histórico de revisiones confirmado"/><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={line}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="m"/><YAxis domain={[0,100]}/><Tooltip/><Line type="monotone" dataKey="v" stroke="#002A54" strokeWidth={3}/></LineChart></ResponsiveContainer></div></Card><Card className="p-6"><SectionTitle title="Alertas" subtitle="Prioridades operativas"/><div className="space-y-3"><div className="rounded-xl bg-red-50 p-4"><b>{noApt}</b> NO APTO</div><div className="rounded-xl bg-amber-50 p-4"><b>{pending}</b> pendientes de confirmar</div><div className="rounded-xl bg-slate-50 p-4"><b>{docs}</b> documentos pendientes</div></div><Link href="/alerts" className="mt-4 inline-block text-sm font-bold underline">Ver sistema de alertas</Link></Card></div>
  <div className="grid gap-6 xl:grid-cols-2"><Card className="p-6"><SectionTitle title="Cumplimiento por centro" subtitle="S2 2026 · todos los centros activos"/><div className="h-80"><ResponsiveContainer><BarChart data={chart} layout="vertical" margin={{left:20,right:10}}><CartesianGrid horizontal={false}/><XAxis type="number" domain={[0,100]}/><YAxis type="category" dataKey="shortCode" width={55}/><Tooltip/><Bar dataKey="score" fill="#002A54" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer></div></Card><Card className="p-6"><SectionTitle title="Accesos rápidos"/><div className="grid grid-cols-2 gap-3">{[["/centers","Centros"],["/inspections","Plan"],["/alerts","Alertas"],["/stl","STL ES / PT"],["/documents","Documentación"],["/settings","Administración"]].map(([href,label])=><Link key={href} href={href} className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-sm font-semibold hover:border-slate-400 hover:bg-slate-50">{label}<ArrowUpRight className="h-4 w-4 text-slate-400"/></Link>)}</div></Card></div>
 </div>
}
