"use client";

import { useMemo, useState } from "react";
import { demo } from "@/lib/data";
import { loadState, V1Country } from "@/lib/v1-state";
import { Card, SectionTitle, Badge, Button, Select } from "@/components/ui";
import {
  History,
  Plus,
  ShieldCheck,
  Search,
  ChevronRight,
} from "lucide-react";

export default function STL() {
  const state = loadState();
  const role = state.role;
  const userCountry = state.country;

  const initialCountry: V1Country =
    role === "ADMIN"
      ? "España"
      : userCountry || "España";

  const [country, setCountry] =
    useState<V1Country>(initialCountry);

  const [q, setQ] = useState("");

  const effectiveCountry: V1Country =
    role === "ADMIN"
      ? country
      : userCountry || country;

  const catalog =
    effectiveCountry === "España"
      ? demo.esCatalog
      : demo.ptCatalog;

  const list = useMemo(
    () =>
      catalog.filter((x: any) =>
        `${x.code} ${x.category} ${x.installation} ${x.action}`
          .toLowerCase()
          .includes(q.toLowerCase())
      ),
    [catalog, q]
  );

  const version =
    effectiveCountry === "España"
      ? "STL_ES_2026_V1"
      : "STL_PT_2026_V1";

  return (
    <div className="space-y-6">
      <SectionTitle
        title="STL España / Portugal"
        subtitle="Matriz normativa, versiones activas e instalaciones reguladas"
        action={
          role === "ADMIN" ? (
            <Button>
              <Plus className="mr-2 inline h-4 w-4" />
              Nueva versión
            </Button>
          ) : undefined
        }
      />

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            Matriz normativa
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <button
              type="button"
              disabled={role !== "ADMIN"}
              onClick={() => setCountry("España")}
              className={`flex flex-1 items-center justify-between rounded-xl border-2 px-5 py-4 text-left transition ${
                effectiveCountry === "España"
                  ? "border-[#002A54] bg-[#002A54] text-white"
                  : "border-slate-200 bg-white hover:border-slate-300"
              } ${
                role !== "ADMIN" && effectiveCountry !== "España"
                  ? "cursor-not-allowed opacity-50"
                  : ""
              }`}
            >
              <div>
                <div className="text-xs font-bold uppercase tracking-wider opacity-60">
                  País
                </div>
                <div className="mt-1 text-lg font-black">
                  España
                </div>
              </div>

              {effectiveCountry === "España" && (
                <ChevronRight className="h-5 w-5" />
              )}
            </button>

            <button
              type="button"
              disabled={role !== "ADMIN"}
              onClick={() => setCountry("Portugal")}
              className={`flex flex-1 items-center justify-between rounded-xl border-2 px-5 py-4 text-left transition ${
                effectiveCountry === "Portugal"
                  ? "border-[#002A54] bg-[#002A54] text-white"
                  : "border-slate-200 bg-white hover:border-slate-300"
              } ${
                role !== "ADMIN" && effectiveCountry !== "Portugal"
                  ? "cursor-not-allowed opacity-50"
                  : ""
              }`}
            >
              <div>
                <div className="text-xs font-bold uppercase tracking-wider opacity-60">
                  País
                </div>
                <div className="mt-1 text-lg font-black">
                  Portugal
                </div>
              </div>

              {effectiveCountry === "Portugal" && (
                <ChevronRight className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                País seleccionado
              </div>
              <div className="mt-1 text-2xl font-black text-[#002A54]">
                {effectiveCountry}
              </div>
            </div>

            <Badge tone="success">
              Matriz activa
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-400">
                Base normativa
              </div>
              <div className="mt-1 font-bold">
                {effectiveCountry === "España"
                  ? "Reglamentos técnicos"
                  : "Regulamentos / NP"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-400">
                Referencias principales
              </div>
              <div className="mt-1 font-bold">
                {effectiveCountry === "España"
                  ? "RITE / REBT / RIPCI / RD 487/2022"
                  : "SCIE / DL / Portarias / NP"}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <Badge tone="success">
              Versión activa
            </Badge>

            <ShieldCheck className="h-5 w-5 text-[#002A54]" />
          </div>

          <h3 className="mt-5 text-xl font-black">
            {version}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {effectiveCountry} · catálogo {catalog.length} elementos
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <Badge tone="warning">
              Histórico
            </Badge>

            <History className="h-5 w-5" />
          </div>

          <h3 className="mt-5 text-xl font-black">
            Ver versiones anteriores
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Las versiones futuras no sustituyen el histórico ya aplicado a los centros.
          </p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border border-[#002A54] bg-[#002A54] px-4 py-2 text-sm font-bold text-white">
            {effectiveCountry}
          </div>

          <div className="relative min-w-[250px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar instalación, código o actuación..."
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle
          title={`Instalaciones reguladas · ${effectiveCountry}`}
          subtitle={`${list.length} elementos de la versión activa`}
        />

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Categoría</th>
                <th>Instalación</th>
                <th>Actuación</th>
                <th>Frecuencia</th>
                <th>Normativa</th>
              </tr>
            </thead>

            <tbody>
              {list.map((x: any) => (
                <tr key={x.id}>
                  <td className="font-mono text-xs">
                    {x.code}
                  </td>

                  <td>{x.category}</td>

                  <td className="font-semibold">
                    {x.installation}
                  </td>

                  <td>{x.action}</td>

                  <td>
                    <Badge>
                      {x.frequency}
                    </Badge>
                  </td>

                  <td className="text-xs text-slate-500">
                    {x.normativeReference ||
                      x.descriptionPt ||
                      "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
