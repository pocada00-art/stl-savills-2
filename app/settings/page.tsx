"use client";

import { Card, SectionTitle, Badge, Button, Select } from "@/components/ui";
import { Shield, Database, Mail, Users, History, Bell, Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { demo } from "@/lib/data";
import { loadState, saveState, type V1Role } from "@/lib/v1-state";

export default function Settings(){
 const [state,setState]=useState(loadState()); const [msg,setMsg]=useState(""); useEffect(()=>setState(loadState()),[]);
 const role=state.role as V1Role;
 function setRole(v:V1Role){const next={...state,role:v};saveState(next);setState(next);setMsg("Perfil demo actualizado");}
 return <div className="space-y-6">
  <SectionTitle title="Administración" subtitle="Usuarios, asignaciones, reglas de alertas, STL y trazabilidad"/>
  <div className="grid gap-4 md:grid-cols-3">
   <Card className="p-6"><Users className="h-5 w-5 text-[#002A54]"/><h3 className="mt-4 font-bold">Roles</h3><p className="mt-1 text-sm text-slate-500">ADMIN, GESTOR y LECTURA. Un usuario puede tener varios centros asignados.</p><div className="mt-4"><Badge tone="success">3 roles</Badge></div></Card>
   <Card className="p-6"><Building2 className="h-5 w-5 text-[#002A54]"/><h3 className="mt-4 font-bold">Centros</h3><p className="mt-1 text-sm text-slate-500">{demo.centers.length} centros reales iniciales. Los resueltos conservan histórico.</p><div className="mt-4"><Badge tone="info">{demo.centers.length} iniciales</Badge></div></Card>
   <Card className="p-6"><Bell className="h-5 w-5 text-[#002A54]"/><h3 className="mt-4 font-bold">Alertas</h3><p className="mt-1 text-sm text-slate-500">90/60/30, vencimiento, post-vencimiento, incumplimiento, documentos, riesgos y STL.</p><div className="mt-4"><Badge tone="success">Configurado</Badge></div></Card>
   <Card className="p-6"><Shield className="h-5 w-5 text-[#002A54]"/><h3 className="mt-4 font-bold">Seguridad</h3><p className="mt-1 text-sm text-slate-500">La V1 deja preparado el modelo de permisos; la autenticación corporativa se conecta en producción.</p></Card>
   <Card className="p-6"><Database className="h-5 w-5 text-[#002A54]"/><h3 className="mt-4 font-bold">PostgreSQL / Prisma</h3><p className="mt-1 text-sm text-slate-500">Modelo V1 preparado para Supabase y Prisma.</p><Badge tone="warning">Pendiente conexión</Badge></Card>
   <Card className="p-6"><Mail className="h-5 w-5 text-[#002A54]"/><h3 className="mt-4 font-bold">Email</h3><p className="mt-1 text-sm text-slate-500">Resend preparado para la fase productiva.</p><Badge tone="warning">Pendiente conexión</Badge></Card>
  </div>
  <Card className="p-6"><SectionTitle title="Modo de prueba de permisos" subtitle="Úsalo para comprobar Gestor / Administrador / Lectura antes de conectar SSO"/>
   <div className="flex flex-wrap items-center gap-3"><Select value={role} onChange={v=>setRole(v as V1Role)}><option value="ADMIN">Administrador</option><option value="GESTOR">Gestor</option><option value="LECTURA">Lectura</option></Select>{msg&&<Badge tone="success">{msg}</Badge>}</div>
  </Card>
  <Card className="p-6"><SectionTitle title="Asignaciones de ejemplo"/><div className="table-wrap"><table className="table"><thead><tr><th>Usuario</th><th>Rol</th><th>Centros</th></tr></thead><tbody><tr><td className="font-semibold">Administrador Demo</td><td><Badge tone="danger">ADMIN</Badge></td><td>Todos</td></tr><tr><td className="font-semibold">Gestor Demo</td><td><Badge tone="info">GESTOR</Badge></td><td>Varios centros asignados</td></tr><tr><td className="font-semibold">Lectura Demo</td><td><Badge>LECTURA</Badge></td><td>Varios centros asignados</td></tr></tbody></table></div></Card>
  <Card className="p-6"><SectionTitle title="Auditoría" subtitle="La base de datos V1 registra cambios, confirmaciones, certificados y modificaciones administrativas."/><div className="flex items-center gap-3 text-sm text-slate-600"><History className="h-5 w-5"/>Trazabilidad preparada en AuditLog.</div></Card>
 </div>
}
