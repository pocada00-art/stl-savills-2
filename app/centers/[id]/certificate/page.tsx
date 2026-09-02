"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  FileText,
  Printer,
  ShieldCheck,
} from "lucide-react";

import { demo } from "@/lib/data";
import {
  blankItem,
  loadState,
  resolveCenter,
  reviewKey,
  reviewSummary,
  type Period,
  type V1State,
  type V1Status,
} from "@/lib/v1-state";
import { loadCenterImage } from "@/lib/image-storage";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-ES");
}

function formatDateTime(value?: string | null) {
  if (!value) return "Pendiente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-ES");
}

function formatCenterCode(value: unknown) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return "—";
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const [integerPart, decimalPart] = raw.split(".");
    return decimalPart === undefined
      ? integerPart.padStart(2, "0")
      : `${integerPart.padStart(2, "0")}.${decimalPart}`;
  }
  return raw.toUpperCase();
}

function textValue(source: any, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return fallback;
}

function calculateNextReview(date: string, frequency: string) {
  if (!date || !frequency || frequency.trim().toLowerCase() === "inicial") return "";
  const value = frequency.trim().toLowerCase();
  let months = 0;
  if (value.includes("bimensual")) months = 2;
  else if (value.includes("mensual")) months = 1;
  else if (value.includes("trimestral")) months = 3;
  else if (value.includes("cuatrimestral")) months = 4;
  else if (value.includes("semestral")) months = 6;
  else if (value.includes("bienal")) months = 24;
  else if (value.includes("anual")) months = 12;
  else {
    const match = value.match(/^(\d+(?:[.,]\d+)?)\s*(mes|meses|año|años)?$/);
    if (match) {
      const amount = Number(match[1].replace(",", "."));
      if (!Number.isFinite(amount) || amount <= 0) return "";
      months = match[2]?.startsWith("año") ? Math.round(amount * 12) : Math.round(amount);
    }
  }
  if (!months) return "";
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const targetIndex = monthIndex + months;
  const targetYear = year + Math.floor(targetIndex / 12);
  const targetMonth = ((targetIndex % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(day, lastDay);
  const result = new Date(targetYear, targetMonth, targetDay);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, "0")}-${String(result.getDate()).padStart(2, "0")}`;
}

function resultFromStatus(status?: V1Status) {
  switch (status) {
    case "APTO":
      return "APTO";
    case "APTO CONDICIONADO":
      return "CONDICIONADO";
    case "NO APTO":
      return "NO APTO";
    case "PENDIENTE":
      return "PENDIENTE";
    default:
      return "SIN INFORMACIÓN";
  }
}

function resultClasses(result: string) {
  switch (result) {
    case "APTO":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "CONDICIONADO":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "NO APTO":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function complianceResult(score: number) {
  if (score > 90) {
    return {
      label: "APTO",
      classes: "border-emerald-300 bg-emerald-100 text-emerald-800",
    };
  }

  if (score >= 70 && score <= 90) {
    return {
      label: "CONDICIONADO",
      classes: "border-amber-300 bg-amber-100 text-amber-800",
    };
  }

  return {
    label: "NO APTO",
    classes: "border-red-300 bg-red-100 text-red-800",
  };
}

function overallStatus(rows: Array<{ item: { status?: V1Status } }>): V1Status {
  if (!rows.length) return "SIN INFORMACIÓN";
  if (rows.some(row => row.item.status === "NO APTO")) return "NO APTO";
  if (rows.some(row => row.item.status === "APTO CONDICIONADO")) return "APTO CONDICIONADO";
  if (rows.some(row => row.item.status === "SIN INFORMACIÓN")) return "SIN INFORMACIÓN";
  if (rows.some(row => row.item.status === "PENDIENTE")) return "PENDIENTE";
  return "APTO";
}

function InfoLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[7px] font-black uppercase tracking-wide text-slate-400">{label}</div>
      <div className="truncate text-[9px] font-medium text-slate-700">{value || "—"}</div>
    </div>
  );
}

function SummaryBox({ label, value, className = "" }: { label: string; value: string | number; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 ${className}`}>
      <div className="text-[7px] font-black uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-xs font-black text-slate-800">{value}</div>
    </div>
  );
}

export default function CertificatePage() {
  const params = useParams();
  const search = useSearchParams();
  const id = String(params.id);
  const year = Number(search.get("year") || 2026);
  const period = (search.get("period") || "S2") as Period;

  const [state, setState] = useState<V1State>({
    role: "ADMIN",
    centers: {},
    activeItems: {},
    reviews: {},
  });
  const [resolvedPhoto, setResolvedPhoto] = useState<string | null>(null);
  const [resolvedLogo, setResolvedLogo] = useState<string | null>(null);

  useEffect(() => {
    setState(loadState());
  }, []);

  const demoCenter = demo.centers.find(center => center.id === id) || null;
  const persistedCenter = state.centers[id] || null;
  const rawCenter = demoCenter || persistedCenter;
  const center = rawCenter ? resolveCenter(rawCenter as any, state) : null;

  const catalog = useMemo(() => {
    if (!center) return [];
    return center.country === "España" ? demo.esCatalog : demo.ptCatalog;
  }, [center]);

  const overrides: any = center ? state.centers[center.id] || {} : {};
  const review = center ? state.reviews[reviewKey(center.id, year, period)] : undefined;

  const active = catalog.filter(
    (item: any) => state.activeItems[center!.id]?.[item.id] !== false,
  );

  const rows = active.map((x: any) => ({
    x,
    item: review?.items?.[x.id] || blankItem(),
  }));

  const summary = reviewSummary(
    review,
    active.map((item: any) => item.id),
  );

  const score = Number(summary.score || 0);
  const result = complianceResult(score);
  const status = overallStatus(rows);
  const confirmed = Boolean(review?.confirmed);

  const counts = summary.counts as Record<string, number>;
  const aptoCount = Number(counts["APTO"] || 0);
  const condicionadoCount = Number(counts["APTO CONDICIONADO"] || 0);
  const noAptoCount = Number(counts["NO APTO"] || 0);
  const pendienteCount = Number(counts["PENDIENTE"] || 0);

  const address = textValue(center, ["address", "direccion"]);
  const city = textValue(center, ["city", "ciudad"]);
  const province = textValue(center, ["province", "provincia"]);
  const country = textValue(center, ["country", "pais"], center?.country || "");
  const stl = textValue(center, ["stl"]);
  const manager = textValue(center, ["manager", "managerName", "gestor"]);
  const managerPhone = textValue(center, ["managerPhone", "managerTel", "managerTelephone"]);
  const managerEmail = textValue(center, ["managerEmail", "managerMail"]);
  const technical = textValue(center, ["technicalResponsible", "technicalResponsibleName", "technical", "responsableTecnico"]);
  const technicalPhone = textValue(center, ["technicalPhone", "technicalTel", "technicalTelephone"]);
  const technicalEmail = textValue(center, ["technicalEmail", "technicalMail"]);
  const regulatoryFramework = textValue(
    center,
    ["regulatoryFramework", "normativeFramework", "regulatoryReference", "marcoNormativo"],
    "Marco normativo aplicable según instalación y actuación",
  );

  const photoSource = textValue(center, ["imageUrl", "photoUrl"]);
  const logoSource = textValue(center, ["logoUrl"]);

  useEffect(() => {
    let cancelled = false;

    async function resolve(source: string, setter: (value: string | null) => void) {
      if (!source) {
        setter(null);
        return;
      }
      if (!source.startsWith("indexeddb://")) {
        setter(source);
        return;
      }
      try {
        const loaded = await loadCenterImage(source);
        if (!cancelled) setter(loaded || null);
      } catch {
        if (!cancelled) setter(null);
      }
    }

    void resolve(photoSource, setResolvedPhoto);
    void resolve(logoSource, setResolvedLogo);

    return () => {
      cancelled = true;
    };
  }, [photoSource, logoSource]);

  const overdueCount = rows.filter(({ x, item }) => {
    const nextReview = calculateNextReview(item.date, String(x.frequency || ""));
    if (!nextReview) return false;
    const date = new Date(`${nextReview}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
  }).length;

  const upcomingCount = rows.filter(({ x, item }) => {
    const nextReview = calculateNextReview(item.date, String(x.frequency || ""));
    if (!nextReview) return false;
    const date = new Date(`${nextReview}T00:00:00`);
    if (Number.isNaN(date.getTime())) return false;
    const limit = new Date();
    limit.setDate(limit.getDate() + 90);
    return date >= new Date() && date <= limit;
  }).length;

  const riskCount = rows.filter(({ item }) =>
    /RIESGO|CRÍTICO|CRITICO/i.test(`${item.status || ""} ${item.comment || ""}`),
  ).length;

  const documentationCount = rows.filter(({ item }) =>
    /DOCUMENT|CERTIFIC/i.test(`${item.status || ""} ${item.comment || ""}`),
  ).length;

  const incidentCount = rows.filter(({ item }) =>
    /INCIDENCIA|INCUMPLIMIENTO/i.test(`${item.status || ""} ${item.comment || ""}`),
  ).length;

  const recommendations = [
    ...(noAptoCount ? [`Resolver ${noAptoCount} elemento(s) NO APTO.`] : []),
    ...(condicionadoCount ? [`Realizar seguimiento de ${condicionadoCount} elemento(s) condicionado(s).`] : []),
    ...(pendienteCount ? [`Completar ${pendienteCount} elemento(s) PENDIENTE.`] : []),
    ...(overdueCount ? [`Regularizar ${overdueCount} inspección(es) vencida(s).`] : []),
    ...(documentationCount ? ["Completar documentación pendiente."] : []),
    ...(riskCount ? ["Realizar seguimiento de riesgos abiertos."] : []),
  ].slice(0, 4);

  if (!recommendations.length) {
    recommendations.push("Mantener el programa de revisiones y seguimiento reglamentario.");
  }

  const participants: any[] = review?.participants || [];
  const administrator = participants.find(p => /ADMIN/i.test(String(p.role || "")));
  const management = participants.find(p => /GESTOR|MANAGEMENT/i.test(String(p.role || "")));
  const technicalParticipant = participants.find(p => /TÉCNICO|TECNICO|TECHNICAL/i.test(String(p.role || "")));
  const otherParticipants = participants.filter(
    p => p !== administrator && p !== management && p !== technicalParticipant,
  );

  const centerCode = formatCenterCode(center?.code);
  const certificateNumber = `STL-${centerCode}-${period}-${year}`;

  if (!center) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Centro no encontrado.</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link href={`/centers/${center.id}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <ArrowLeft className="mr-2 inline h-4 w-4" />
          Volver a ficha
        </Link>
        <button type="button" onClick={() => window.print()} className="rounded-xl bg-[#002A54] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          <Printer className="mr-2 inline h-4 w-4" />
          Imprimir / guardar PDF
        </button>
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft print:rounded-none print:border-0 print:shadow-none">
        <header className="border-b-2 border-[#002A54] px-5 py-3 print:px-4 print:py-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              {resolvedLogo ? (
                <img src={resolvedLogo} alt="Logo" className="h-14 w-24 shrink-0 object-contain" />
              ) : (
                <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                  <ShieldCheck className="h-7 w-7 text-[#002A54]" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-[8px] font-black uppercase tracking-[.18em] text-[#002A54]">STL SAVILLS · CERTIFICADO DE REVISIÓN</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-md bg-[#002A54] px-2 py-0.5 text-sm font-black text-white">{centerCode}</span>
                  <h1 className="truncate text-xl font-black text-slate-900 print:text-lg">{center.name}</h1>
                </div>
                <div className="mt-1 text-[9px] text-slate-500">
                  {address || "Dirección no disponible"}{city ? ` · ${city}` : ""}{province ? ` · ${province}` : ""}{country ? ` · ${country}` : ""}
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-5 gap-y-0.5 text-[8px] text-slate-600">
                  <span><b>STL:</b> {stl || "—"}</span>
                  <span><b>Marco normativo:</b> {regulatoryFramework}</span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {resolvedPhoto ? (
                <img src={resolvedPhoto} alt={`Fotografía de ${center.name}`} className="h-16 w-24 rounded-lg border border-slate-200 object-cover" />
              ) : (
                <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-center text-[7px] text-slate-400">Fotografía<br />del centro</div>
              )}
              <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[7px] font-black uppercase ${confirmed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                {confirmed ? <CheckCircle2 className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
                {confirmed ? "VALIDADA" : "NO VALIDADA"}
              </div>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-3 border-t border-slate-100 pt-2">
            <InfoLine label="Responsable gestión" value={manager ? `${manager}${managerPhone ? ` · ${managerPhone}` : ""}` : ""} />
            <InfoLine label="Contacto gestión" value={managerEmail} />
            <InfoLine label="Responsable técnico" value={technical ? `${technical}${technicalPhone ? ` · ${technicalPhone}` : ""}` : technicalEmail} />
          </div>
        </header>

        <section className="px-5 py-2 print:px-4 print:py-1.5">
          <div className="mb-1.5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900">Cumplimiento técnico-legal</h2>
              <div className="text-[8px] text-slate-500">Revisión {period} · {year}</div>
            </div>
            <div className={`rounded-lg border px-3 py-1 text-center ${result.classes}`}>
              <div className="text-[7px] font-black uppercase">Resultado</div>
              <div className="text-sm font-black">{result.label}</div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2">
            <SummaryBox label="Revisión" value={`${period} ${year}`} />
            <SummaryBox label="Cumplimiento" value={`${score}%`} />
            <SummaryBox label="Elementos" value={summary.total} />
            <SummaryBox label="ESTADO" value={status} />
            <SummaryBox label="RESULTADO" value={result.label} className={result.classes} />
          </div>

          <div className="mt-1.5 grid grid-cols-4 gap-2">
            <SummaryBox label="APTO" value={aptoCount} />
            <SummaryBox label="APTO CONDICIONADO" value={condicionadoCount} />
            <SummaryBox label="NO APTO" value={noAptoCount} />
            <SummaryBox label="PENDIENTE" value={pendienteCount} />
          </div>
        </section>

        <section className="px-5 py-1.5 print:px-4 print:py-1">
          <div className="mb-1 flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-[#002A54]" />
            <h2 className="text-sm font-black text-slate-900">Instalaciones y actuaciones</h2>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full table-fixed text-[7px] leading-tight">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-[7%] px-1 py-1 text-left">Código</th>
                  <th className="w-[17%] px-1 py-1 text-left">Instalación</th>
                  <th className="w-[18%] px-1 py-1 text-left">Actuación</th>
                  <th className="w-[11%] px-1 py-1 text-left">Frecuencia</th>
                  <th className="w-[13%] px-1 py-1 text-left">ESTADO</th>
                  <th className="w-[12%] px-1 py-1 text-left">RESULTADO</th>
                  <th className="w-[11%] px-1 py-1 text-left">Revisión</th>
                  <th className="w-[11%] px-1 py-1 text-left">Próxima</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ x, item }: any) => {
                  const rowResult = resultFromStatus(item.status);
                  return (
                    <tr key={x.id} className="border-t border-slate-100">
                      <td className="px-1 py-0.5 font-mono font-bold">{x.code || "—"}</td>
                      <td className="truncate px-1 py-0.5">{x.installation || "—"}</td>
                      <td className="truncate px-1 py-0.5">{x.action || "—"}</td>
                      <td className="truncate px-1 py-0.5">{x.frequency || "—"}</td>
                      <td className="px-1 py-0.5">{item.status || "SIN INFORMACIÓN"}</td>
                      <td className="px-1 py-0.5"><span className={`inline-flex rounded border px-1 py-0.5 text-[6px] font-black ${resultClasses(rowResult)}`}>{rowResult}</span></td>
                      <td className="px-1 py-0.5">{formatDate(item.date)}</td>
                      <td className="px-1 py-0.5">{formatDate(calculateNextReview(item.date, String(x.frequency || "")))}</td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan={8} className="px-2 py-3 text-center text-slate-400">No existen elementos activos.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="px-5 py-2 print:px-4 print:py-1.5">
          <h2 className="mb-1.5 text-sm font-black text-slate-900">Resumen final</h2>
          <div className="grid grid-cols-5 gap-2">
            <SummaryBox label="Inspecciones vencidas" value={overdueCount} />
            <SummaryBox label="Riesgos abiertos" value={riskCount} />
            <SummaryBox label="Próximos vencimientos" value={upcomingCount} />
            <SummaryBox label="Documentación pendiente" value={documentationCount} />
            <SummaryBox label="Incidencias" value={incidentCount} />
          </div>
          <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <div className="text-[7px] font-black uppercase tracking-wide text-slate-400">Recomendaciones resumen</div>
            <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[8px] text-slate-700">
              {recommendations.map((item, index) => <span key={index}>• {item}</span>)}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-[1fr_1.5fr] gap-4 border-t border-slate-200 px-5 py-2 print:px-4 print:py-1.5">
          <div>
            <h2 className="text-sm font-black text-slate-900">Confirmación</h2>
            <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="grid grid-cols-2 gap-2">
                <InfoLine label="Administrador" value={review?.confirmedBy || "Pendiente"} />
                <InfoLine label="Fecha" value={formatDateTime(review?.confirmedAt)} />
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${confirmed ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-white"}`}>
                  <CheckCircle2 className={`h-4 w-4 ${confirmed ? "text-emerald-600" : "text-slate-300"}`} />
                </div>
                <div className="text-[8px] font-black uppercase text-slate-600">{confirmed ? "Revisión validada" : "Revisión no validada"}</div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-black text-slate-900">Firmas</h2>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              <div className="min-h-[48px] rounded-lg border border-slate-200 px-2 py-1.5">
                <div className="text-[7px] font-bold uppercase text-slate-400">Responsable administrador</div>
                <div className="mt-2 border-t border-slate-300 pt-0.5 text-[8px]">{administrator?.name || review?.confirmedBy || "Pendiente"}</div>
              </div>
              <div className="min-h-[48px] rounded-lg border border-slate-200 px-2 py-1.5">
                <div className="text-[7px] font-bold uppercase text-slate-400">Responsable gestión</div>
                <div className="mt-2 border-t border-slate-300 pt-0.5 text-[8px]">{management?.name || manager || "—"}</div>
              </div>
              <div className="min-h-[48px] rounded-lg border border-slate-200 px-2 py-1.5">
                <div className="text-[7px] font-bold uppercase text-slate-400">Responsable técnico</div>
                <div className="mt-2 border-t border-slate-300 pt-0.5 text-[8px]">{technicalParticipant?.name || technical || "—"}</div>
              </div>
            </div>
            {otherParticipants.length > 0 && (
              <div className="mt-1">
                <div className="text-[7px] font-bold uppercase text-slate-400">Participantes de la revisión</div>
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  {otherParticipants.map((participant, index) => (
                    <span key={`${participant.name}-${index}`} className="rounded border border-slate-200 px-1.5 py-0.5 text-[7px] text-slate-700">
                      {participant.name}{participant.role ? ` · ${participant.role}` : ""}{participant.signed ? " · Firmado" : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-1.5 text-[6.5px] text-slate-400 print:px-4">
          <span>Certificado {certificateNumber}</span>
          <span>Documento generado desde la revisión histórica del centro · STL SAVILLS</span>
        </footer>
      </article>

      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 6mm; }
          html, body { background: white !important; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
          article { width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
