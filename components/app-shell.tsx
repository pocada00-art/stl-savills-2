"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  LayoutDashboard, Building2, ClipboardCheck, FileText, Globe2, Upload,
  Settings, Bell, Menu, X, ChevronRight, ShieldAlert
} from "lucide-react";
import { loadState, saveState, V1Role } from "@/lib/v1-state";

const nav = [
  {href:"/", label:"Inicio", icon:LayoutDashboard},
  {href:"/centers", label:"Centros comerciales", icon:Building2},
  {href:"/inspections", label:"Plan de inspecciones", icon:ClipboardCheck},
  {href:"/documents", label:"Gestión documental", icon:FileText},
  {href:"/stl", label:"STL España / Portugal", icon:Globe2},
  {href:"/alerts", label:"Alertas y notificaciones", icon:Bell},
  {href:"/import", label:"Importación Excel", icon:Upload},
  {href:"/settings", label:"Administración", icon:Settings},
];

export function AppShell({children}:{children:React.ReactNode}) {
 const pathname=usePathname();
 const [open,setOpen]=useState(false);
 const [role,setRole]=useState<V1Role>("ADMIN");

 useEffect(()=>{ setRole(loadState().role); },[]);
 function changeRole(v: V1Role) {
   const state=loadState(); state.role=v; saveState(state); setRole(v);
   window.dispatchEvent(new Event("stl-role-change"));
 }
 return <div className="min-h-screen">
  <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#002A54] text-white transition-transform lg:translate-x-0 ${open?"translate-x-0":"-translate-x-full"}`}>
   <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
     <Link href="/" onClick={()=>setOpen(false)} className="flex items-center gap-3">
       <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg bg-[#FFCC00]"><Image src="/savills-logo.jpg" alt="Savills" width={44} height={44}/></div>
       <div><div className="text-lg font-black tracking-tight">STL SAVILLS</div><div className="text-[10px] uppercase tracking-[.2em] text-white/60">Technical Legal</div></div>
     </Link>
     <button className="lg:hidden" onClick={()=>setOpen(false)}><X/></button>
   </div>
   <div className="p-4">
    <div className="mb-4 rounded-xl bg-white/10 p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/50">Centro activo</div>
      <div className="mt-1 font-semibold">Todos los centros</div>
      <div className="mt-2 text-xs text-white/60">España · Portugal · STL 2026</div>
    </div>
    <nav className="space-y-1">{nav.filter(n=>n.href!=="/settings"||role==="ADMIN").map(n=>{const I=n.icon; const active=pathname===n.href || (n.href!=="/"&&pathname.startsWith(n.href)); return <Link key={n.href} href={n.href} onClick={()=>setOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active?"bg-[#FFCC00] font-bold text-[#002A54]":"text-white/75 hover:bg-white/10 hover:text-white"}`}><I className="h-4 w-4"/>{n.label}</Link>})}</nav>
   </div>
   <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4">
     <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-bold">SA</div><div className="min-w-0"><div className="truncate text-sm font-semibold">Usuario demo</div><div className="truncate text-xs text-white/50">{role}</div></div></div>
   </div>
  </aside>
  {open && <div className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={()=>setOpen(false)}/>}
  <main className="lg:pl-72">
   <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur lg:px-8">
    <button className="lg:hidden" onClick={()=>setOpen(true)}><Menu className="h-5 w-5"/></button>
    <div className="hidden items-center gap-2 text-sm text-slate-400 md:flex"><span>STL SAVILLS</span><ChevronRight className="h-4 w-4"/><span className="font-medium text-slate-700">{pathname==="/"?"Centro de operaciones":nav.find(x=>pathname===x.href||pathname.startsWith(x.href+"/"))?.label||"Módulo"}</span></div>
    <div className="ml-auto flex items-center gap-2">
      <Link href="/alerts" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" title="Alertas"><Bell className="h-5 w-5"/></Link>
      <select value={role} onChange={e=>changeRole(e.target.value as V1Role)} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold">
        <option value="ADMIN">Administrador</option><option value="GESTOR">Gestor</option><option value="LECTURA">Lectura</option>
      </select>
      <div className="hidden rounded-xl border border-slate-200 px-3 py-2 text-xs md:block">ES · España</div>
      <div className="h-9 w-9 rounded-full bg-slate-900 text-center text-xs font-bold leading-9 text-white">{role==="ADMIN"?"AD":role==="GESTOR"?"GE":"LE"}</div>
    </div>
   </header>
   <div className="p-4 lg:p-8">{children}</div>
  </main>
 </div>
}
