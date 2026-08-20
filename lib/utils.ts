import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export const statusTone: Record<string, string> = {
  "FAV.": "bg-emerald-100 text-emerald-700",
  "Favorable": "bg-emerald-100 text-emerald-700",
  "COND.": "bg-amber-100 text-amber-700",
  "Condicionado": "bg-amber-100 text-amber-700",
  "DESFAV.": "bg-red-100 text-red-700",
  "NO APTO": "bg-red-100 text-red-700",
  "Desfavorable": "bg-red-100 text-red-700",
  "PTE.": "bg-slate-100 text-slate-600",
  "PENDIENTE": "bg-slate-100 text-slate-600",
  "Pendiente": "bg-slate-100 text-slate-600",
  "-": "bg-slate-50 text-slate-400",
  "Sin información": "bg-slate-50 text-slate-400",
  "SIN INFORMACIÓN": "bg-slate-50 text-slate-400",
};

export function statusLabel(s: string | null | undefined) {
  if (!s) return "Sin información";
  return ({ "FAV.":"Favorable", "COND.":"Condicionado", "DESFAV.":"Desfavorable", "PTE.":"Pendiente", "-":"Sin información" } as Record<string,string>)[s] ?? s;
}

export function scoreForStatus(s: string | null | undefined) {
  if (s === "FAV." || s === "Favorable" || s === "APTO") return 3;
  if (s === "COND." || s === "Condicionado" || s === "APTO CONDICIONADO") return 2;
  if (s === "DESFAV." || s === "Desfavorable" || s === "NO APTO") return 1;
  return 0;
}
