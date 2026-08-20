"use client";
import { cn } from "@/lib/utils";
import { ChevronDown, ArrowUpDown } from "lucide-react";

export function Card({ className="", children }: {className?:string; children:React.ReactNode}) {
  return <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-soft", className)}>{children}</div>;
}
export function SectionTitle({title, subtitle, action}:{title:string;subtitle?:string;action?:React.ReactNode}) {
  return <div className="mb-5 flex items-end justify-between gap-4"><div><h2 className="text-lg font-bold text-slate-900">{title}</h2>{subtitle&&<p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>{action}</div>;
}
export function Badge({children,tone="default"}:{children:React.ReactNode;tone?:string}) {
  const tones:any={default:"bg-slate-100 text-slate-600",success:"bg-emerald-100 text-emerald-700",warning:"bg-amber-100 text-amber-700",danger:"bg-red-100 text-red-700",info:"bg-blue-100 text-blue-700"};
  return <span className={cn("badge",tones[tone]||tones.default)}>{children}</span>;
}
export function Select({value,onChange,children}:{value?:string;onChange?:(v:string)=>void;children:React.ReactNode}) {
  return <div className="relative"><select value={value} onChange={e=>onChange?.(e.target.value)} className="appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-9 text-sm outline-none focus:border-slate-400">{children}</select><ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400"/></div>
}
export function Button({children,onClick,variant="primary",type="button"}:{children:React.ReactNode;onClick?:()=>void;variant?:"primary"|"secondary"|"danger";type?:"button"|"submit"}) {
 const c={primary:"bg-slate-900 text-white hover:bg-slate-800",secondary:"border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",danger:"bg-red-600 text-white hover:bg-red-700"}[variant];
 return <button type={type} onClick={onClick} className={cn("rounded-xl px-4 py-2 text-sm font-semibold transition",c)}>{children}</button>;
}

export function SortHeader({label,onClick}:{label:string;onClick:()=>void}) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 font-semibold hover:text-slate-900">{label}<ArrowUpDown className="h-3 w-3 text-slate-400"/></button>;
}
