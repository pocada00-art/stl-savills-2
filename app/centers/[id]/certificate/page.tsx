"use client";

import { useEffect, useMemo } from "react";
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
  loadState,
  reviewKey,
  reviewSummary,
  blankItem,
  type Period,
  type V1State,
  type V1Status,
} from "@/lib/v1-state";

import { loadCenterImage } from "@/lib/center-images";

const STATUSES: V1Status[] = [
  "APTO",
  "APTO CONDICIONADO",
  "NO APTO",
  "PENDIENTE",
  "SIN INFORMACIÓN",
];

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
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
  const raw = String(value ?? "").trim();

  if (!raw) return "—";

  if (/^\d+$/.test(raw)) {
    const number = Number(raw);
    return number >= 0 && number < 10 ? `0${number}` : raw;
  }

  return raw.toUpperCase();
}

function getResult(status?: string) {
  switch (status) {
    case "APTO":
      return "APTO";
    case "APTO CONDICIONADO":
      return "CONDICIONADO";
    case "NO APTO":
      return "NO APTO";
    case "PENDIENTE":
      return "PENDIENTE";
    case "SIN INFORMACIÓN":
      return "SIN INFORMACIÓN";
    default:
      return "SIN INFORMACIÓN";
  }
}

function getResultClasses(result: string) {
  switch (result) {
    case "APTO":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "CONDICIONADO":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "NO APTO":
      return "bg-red-100 text-red-800 border-red-200";
    case "PENDIENTE":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function getComplianceResult(score: number) {
  if (score > 90) {
    return {
      label: "APTO",
      classes: "bg-emerald-100 text-emerald-800 border-emerald-300",
    };
  }

  if (score >= 70 && score <= 90) {
    return {
      label: "CONDICIONADO",
      classes: "bg-amber-100 text-amber-800 border-amber-300",
    };
  }

  return {
    label: "NO APTO",
    classes: "bg-red-100 text-red-800 border-red-300",
  };
}

function calculateOverallStatus(
  rows: Array<{ item: { status?: V1Status } }>,
): V1Status {
  if (rows.length === 0) return "SIN INFORMACIÓN";

  const statuses = rows.map(
    ({ item }) => item.status || "SIN INFORMACIÓN",
  );

  if (statuses.some((status) => status === "NO APTO")) {
    return "NO APTO";
  }

  if (statuses.some((status) => status === "APTO CONDICIONADO")) {
    return "APTO CONDICIONADO";
  }

  if (statuses.some((status) => status === "SIN INFORMACIÓN")) {
    return "SIN INFORMACIÓN";
  }

  if (statuses.some((status) => status === "PENDIENTE")) {
    return "PENDIENTE";
  }

  return "APTO";
}

function getCount(
  counts: Record<string, number>,
  names: string[],
) {
  return names.reduce((total, name) => total + Number(counts[name] || 0), 0);
}

function getText(
  source: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const value = source[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return String(value);
    }
  }

  return "";
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="truncate text-[10px] font-medium text-slate-700">
        {value || "—"}
      </div>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 ${className}`}
    >
      <div className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-black text-slate-800">
        {value}
      </div>
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

  useEffect(() => {
    setState(loadState());
  }, []);

  const center = demo.centers.find((item) => item.id === id);

  const catalog = useMemo(() => {
    if (!center) return [];

    return center.country === "España"
      ? demo.esCatalog
      : demo.ptCatalog;
  }, [center]);

  if (!center) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Centro no encontrado.
        </div>
      </div>
    );
  }

  const overrides = state.centers[center.id] || {};

  const review = state.reviews[
    reviewKey(center.id, year, period)
  ];

  const active = catalog.filter(
    (item: any) =>
      state.activeItems[center.id]?.[item.id] !== false,
  );

  const summary = reviewSummary(
    review,
    active.map((item: any) => item.id),
  );

  const rows = active.map((x: any) => ({
    x,
    item: review?.items[x.id] || blankItem(),
  }));

  const complianceResult = getComplianceResult(
    Number(summary.score || 0),
  );

  const overallStatus = calculateOverallStatus(rows);

  const counts = summary.counts as Record<string, number>;

  const aptoCount = getCount(counts, ["APTO"]);
  const condicionadoCount = getCount(counts, [
    "APTO CONDICIONADO",
    "CONDICIONADO",
  ]);
  const noAptoCount = getCount(counts, ["NO APTO"]);
  const pendienteCount = getCount(counts, ["PENDIENTE"]);

  const sinInformacionCount = getCount(counts, [
    "SIN INFORMACIÓN",
    "SIN INFORMACION",
  ]);

  const confirmed = Boolean(review?.confirmed);

  const centerData = center as any;
  const overrideData = overrides as any;

  const address =
    getText(overrideData, ["address", "direccion"]) ||
    getText(centerData, ["address", "direccion"]);

  const city =
    getText(overrideData, ["city", "ciudad"]) ||
    getText(centerData, ["city", "ciudad"]);

  const province =
    getText(overrideData, ["province", "provincia"]) ||
    getText(centerData, ["province", "provincia"]);

  const country =
    getText(overrideData, ["country", "pais"]) ||
    getText(centerData, ["country", "pais"]) ||
    center.country;

  const stl =
    getText(overrideData, ["stl"]) ||
    getText(centerData, ["stl"]);

  const manager =
    getText(overrideData, [
      "managerName",
      "manager",
      "gestor",
      "responsibleManager",
    ]) ||
    getText(centerData, [
      "managerName",
      "manager",
      "gestor",
      "responsibleManager",
    ]);

  const managerPhone =
    getText(overrideData, [
      "managerPhone",
      "managerTel",
      "managerTelephone",
    ]) ||
    getText(centerData, [
      "managerPhone",
      "managerTel",
      "managerTelephone",
    ]);

  const managerEmail =
    getText(overrideData, [
      "managerEmail",
      "managerMail",
    ]) ||
    getText(centerData, [
      "managerEmail",
      "managerMail",
    ]);

  const technical =
    getText(overrideData, [
      "technicalResponsible",
      "technicalResponsibleName",
      "technical",
      "responsableTecnico",
    ]) ||
    getText(centerData, [
      "technicalResponsible",
      "technicalResponsibleName",
      "technical",
      "responsableTecnico",
    ]);

  const technicalPhone =
    getText(overrideData, [
      "technicalPhone",
      "technicalTel",
      "technicalTelephone",
    ]) ||
    getText(centerData, [
      "technicalPhone",
      "technicalTel",
      "technicalTelephone",
    ]);

  const technicalEmail =
    getText(overrideData, [
      "technicalEmail",
      "technicalMail",
    ]) ||
    getText(centerData, [
      "technicalEmail",
      "technicalMail",
    ]);

  const regulatoryFramework =
    getText(overrideData, [
      "regulatoryFramework",
      "normativeFramework",
      "normativeReference",
      "regulatoryReference",
      "marcoNormativo",
    ]) ||
    getText(centerData, [
      "regulatoryFramework",
      "normativeFramework",
      "regulatoryReference",
      "marcoNormativo",
    ]) ||
    "Marco normativo aplicable según instalación y actuación";

  const centerCode = formatCenterCode(
    overrideData.code ?? center.code,
  );

  const centerPhoto =
    overrideData.photoUrl ||
    overrideData.imageUrl ||
    centerData.photoUrl ||
    centerData.imageUrl ||
    "";

  const logoUrl =
    overrideData.logoUrl ||
    centerData.logoUrl ||
    "";

  const certificateNumber = `STL-${centerCode}-${period}-${year}`;

  const overdueCount = rows.filter(({ item }) => {
    if (!item.nextReview) return false;

    const next = new Date(item.nextReview);
    if (Number.isNaN(next.getTime())) return false;

    return next.getTime() < Date.now();
  }).length;

  const upcomingCount = rows.filter(({ item }) => {
    if (!item.nextReview) return false;

    const next = new Date(item.nextReview);
    if (Number.isNaN(next.getTime())) return false;

    const now = new Date();
    const limit = new Date();
    limit.setDate(now.getDate() + 90);

    return (
      next.getTime() >= now.getTime() &&
      next.getTime() <= limit.getTime()
    );
  }).length;

  const riskCount = rows.filter(({ item }) => {
    const text = `${item.status || ""} ${
      item.result || ""
    } ${item.comment || ""}`.toUpperCase();

    return (
      text.includes("RIESGO") ||
      text.includes("CRÍTICO") ||
      text.includes("CRITICO")
    );
  }).length;

  const documentationCount = rows.filter(({ item }) => {
    const text = `${item.status || ""} ${
      item.comment || ""
    }`.toUpperCase();

    return (
      text.includes("DOCUMENT") ||
      text.includes("CERTIFIC") ||
      text.includes("PENDIENTE DOCUMENT")
    );
  }).length;

  const incidentCount = rows.filter(({ item }) => {
    const text = `${item.status || ""} ${
      item.result || ""
    } ${item.comment || ""}`.toUpperCase();

    return (
      text.includes("INCIDENCIA") ||
      text.includes("INCUMPLIMIENTO")
    );
  }).length;

  const recommendations = useMemo(() => {
    const result: string[] = [];

    if (noAptoCount > 0) {
      result.push(`Resolver ${noAptoCount} elemento(s) NO APTO.`);
    }

    if (condicionadoCount > 0) {
      result.push(
        `Realizar seguimiento de ${condicionadoCount} elemento(s) condicionado(s).`,
      );
    }

    if (pendingCount > 0) {
      result.push(
        `Completar ${pendingCount} elemento(s) pendiente(s).`,
      );
    }

    if (sinInformacionCount > 0) {
      result.push(
        `Completar información de ${sinInformacionCount} elemento(s).`,
      );
    }

    if (overdueCount > 0) {
      result.push(
        `Regularizar ${overdueCount} inspección(es) vencida(s).`,
      );
    }

    if (upcomingCount > 0) {
      result.push(
        `Planificar ${upcomingCount} vencimiento(s) próximos.`,
      );
    }

    if (documentationCount > 0) {
      result.push("Completar documentación pendiente.");
    }

    if (riskCount > 0) {
      result.push("Realizar seguimiento de riesgos abiertos.");
    }

    if (result.length === 0) {
      result.push(
        "Mantener el programa de revisiones y seguimiento reglamentario.",
      );
    }

    return result.slice(0, 4);
  }, [
    noAptoCount,
    condicionadoCount,
    pendingCount,
    sinInformacionCount,
    overdueCount,
    upcomingCount,
    documentationCount,
    riskCount,
  ]);

  const participants =
    review?.participants || [];

  const managementParticipant = participants.find(
    (participant: any) =>
      String(participant.role || "").toUpperCase().includes("GESTOR") ||
      String(participant.role || "").toUpperCase().includes("MANAGEMENT"),
  );

  const technicalParticipant = participants.find(
    (participant: any) =>
      String(participant.role || "").toUpperCase().includes("TÉCNICO") ||
      String(participant.role || "").toUpperCase().includes("TECNICO") ||
      String(participant.role || "").toUpperCase().includes("TECHNICAL"),
  );

  const administratorParticipant = participants.find(
    (participant: any) =>
      String(participant.role || "")
        .toUpperCase()
        .includes("ADMIN"),
  );

  const participantSignatures = participants.filter(
    (participant: any) =>
      participant !== managementParticipant &&
      participant !== technicalParticipant &&
      participant !== administratorParticipant,
  );

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link
          href={`/centers/${center.id}`}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="mr-2 inline h-4 w-4" />
          Volver a ficha
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-[#002A54] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <Printer className="mr-2 inline h-4 w-4" />
          Imprimir / guardar PDF
        </button>
      </div>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft print:rounded-none print:border-0 print:shadow-none">
        {/* CABECERA */}
        <header className="border-b-2 border-[#002A54] px-5 py-4 print:px-4 print:py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-14 w-24 shrink-0 object-contain"
                />
              ) : (
                <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                  <ShieldCheck className="h-8 w-8 text-[#002A54]" />
                </div>
              )}

              <div className="min-w-0">
                <div className="text-[8px] font-black uppercase tracking-[0.18em] text-[#002A54]">
                  STL SAVILLS · CERTIFICADO DE REVISIÓN
                </div>

                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-md bg-[#002A54] px-2 py-0.5 text-sm font-black text-white">
                    {centerCode}
                  </span>

                  <h1 className="truncate text-xl font-black text-slate-900 print:text-lg">
                    {center.name}
                  </h1>
                </div>

                <div className="mt-1 text-[10px] text-slate-500">
                  {address || "Dirección no disponible"}
                  {city ? ` · ${city}` : ""}
                  {province ? ` · ${province}` : ""}
                  {country ? ` · ${country}` : ""}
                </div>

                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[9px] text-slate-600">
                  <span>
                    <b>STL:</b> {stl || "—"}
                  </span>
                  <span>
                    <b>Marco normativo:</b>{" "}
                    {regulatoryFramework}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              {centerPhoto ? (
                <img
                  src={centerPhoto}
                  alt={`Fotografía de ${center.name}`}
                  className="h-20 w-28 rounded-lg border border-slate-200 object-cover print:h-16 print:w-24"
                />
              ) : (
                <div className="flex h-20 w-28 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-center text-[8px] text-slate-400 print:h-16 print:w-24">
                  Fotografía<br />
                  del centro
                </div>
              )}

              <div
                className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-black uppercase ${
                  confirmed
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {confirmed ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <CircleAlert className="h-3 w-3" />
                )}
                {confirmed ? "VALIDADA" : "NO VALIDADA"}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
            <InfoLine
              label="Responsable gestión"
              value={
                manager
                  ? `${manager}${
                      managerPhone
                        ? ` · ${managerPhone}`
                        : ""
                    }`
                  : ""
              }
            />

            <InfoLine
              label="Contacto gestión"
              value={managerEmail}
            />

            <InfoLine
              label="Responsable técnico"
              value={
                technical
                  ? `${technical}${
                      technicalPhone
                        ? ` · ${technicalPhone}`
                        : ""
                    }`
                  : ""
              }
            />
          </div>
        </header>

        {/* RESUMEN DE CUMPLIMIENTO */}
        <section className="px-5 py-3 print:px-4 print:py-2">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900">
                Cumplimiento técnico-legal
              </h2>
              <div className="text-[9px] text-slate-500">
                Revisión {period} · {year}
              </div>
            </div>

            <div
              className={`rounded-lg border px-3 py-1.5 text-center ${complianceResult.classes}`}
            >
              <div className="text-[8px] font-bold uppercase">
                Resultado
              </div>
              <div className="text-sm font-black">
                {complianceResult.label}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2">
            <SummaryBox
              label="Revisión"
              value={`${period} ${year}`}
            />

            <SummaryBox
              label="Cumplimiento"
              value={`${summary.score}%`}
            />

            <SummaryBox
              label="Elementos"
              value={summary.total}
            />

            <SummaryBox
              label="Estado"
              value={overallStatus}
            />

            <SummaryBox
              label="Resultado"
              value={complianceResult.label}
              className={complianceResult.classes}
            />
          </div>

          <div className="mt-2 grid grid-cols-4 gap-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-center">
              <div className="text-sm font-black text-emerald-700">
                {aptoCount}
              </div>
              <div className="text-[8px] font-bold uppercase text-emerald-700">
                APTO
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-center">
              <div className="text-sm font-black text-amber-700">
                {condicionadoCount}
              </div>
              <div className="text-[8px] font-bold uppercase text-amber-700">
                APTO CONDICIONADO
              </div>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-center">
              <div className="text-sm font-black text-red-700">
                {noAptoCount}
              </div>
              <div className="text-[8px] font-bold uppercase text-red-700">
                NO APTO
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center">
              <div className="text-sm font-black text-slate-700">
                {pendienteCount}
              </div>
              <div className="text-[8px] font-bold uppercase text-slate-600">
                PENDIENTE
              </div>
            </div>
          </div>
        </section>

        {/* INSTALACIONES Y ACTUACIONES */}
        <section className="px-5 py-2 print:px-4 print:py-1">
          <div className="mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#002A54]" />
            <h2 className="text-sm font-black text-slate-900">
              Instalaciones y actuaciones
            </h2>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full table-fixed text-[8px] leading-tight">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-[7%] px-1.5 py-1.5 text-left font-black">
                    Código
                  </th>
                  <th className="w-[18%] px-1.5 py-1.5 text-left font-black">
                    Instalación
                  </th>
                  <th className="w-[18%] px-1.5 py-1.5 text-left font-black">
                    Actuación
                  </th>
                  <th className="w-[12%] px-1.5 py-1.5 text-left font-black">
                    Frecuencia
                  </th>
                  <th className="w-[13%] px-1.5 py-1.5 text-left font-black">
                    Estado
                  </th>
                  <th className="w-[11%] px-1.5 py-1.5 text-left font-black">
                    Resultado
                  </th>
                  <th className="w-[10%] px-1.5 py-1.5 text-left font-black">
                    Última
                  </th>
                  <th className="w-[11%] px-1.5 py-1.5 text-left font-black">
                    Próxima
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map(({ x, item }: any) => {
                  const result = getResult(item.status);

                  return (
                    <tr
                      key={x.id}
                      className="border-t border-slate-100"
                    >
                      <td className="px-1.5 py-1 font-mono font-bold">
                        {x.code || "—"}
                      </td>

                      <td className="truncate px-1.5 py-1">
                        {x.installation || "—"}
                      </td>

                      <td className="truncate px-1.5 py-1">
                        {x.action || "—"}
                      </td>

                      <td className="truncate px-1.5 py-1">
                        {x.frequency || "—"}
                      </td>

                      <td className="px-1.5 py-1">
                        <span className="font-semibold">
                          {item.status || "SIN INFORMACIÓN"}
                        </span>
                      </td>

                      <td className="px-1.5 py-1">
                        <span
                          className={`inline-flex rounded border px-1.5 py-0.5 text-[7px] font-black ${getResultClasses(
                            result,
                          )}`}
                        >
                          {result}
                        </span>
                      </td>

                      <td className="px-1.5 py-1">
                        {formatDate(item.date)}
                      </td>

                      <td className="px-1.5 py-1">
                        {formatDate(item.nextReview)}
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-4 text-center text-slate-400"
                    >
                      No existen elementos activos en esta revisión.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* RESUMEN FINAL */}
        <section className="px-5 py-3 print:px-4 print:py-2">
          <h2 className="mb-2 text-sm font-black text-slate-900">
            Resumen final
          </h2>

          <div className="grid grid-cols-5 gap-2">
            <SummaryBox
              label="Inspecciones vencidas"
              value={overdueCount}
            />

            <SummaryBox
              label="Riesgos abiertos"
              value={riskCount}
            />

            <SummaryBox
              label="Próximos vencimientos"
              value={upcomingCount}
            />

            <SummaryBox
              label="Documentación pendiente"
              value={documentationCount}
            />

            <SummaryBox
              label="Incidencias"
              value={incidentCount}
            />
          </div>

          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[8px] font-black uppercase tracking-wide text-slate-400">
              Recomendaciones resumen
            </div>

            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {recommendations.map((recommendation, index) => (
                <div
                  key={index}
                  className="text-[9px] text-slate-700"
                >
                  • {recommendation}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CONFIRMACIÓN Y FIRMAS */}
        <section className="grid grid-cols-[1fr_1.4fr] gap-4 border-t border-slate-200 px-5 py-3 print:px-4 print:py-2">
          <div>
            <h2 className="text-sm font-black text-slate-900">
              Confirmación
            </h2>

            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <InfoLine
                  label="Administrador"
                  value={review?.confirmedBy || "Pendiente"}
                />

                <InfoLine
                  label="Fecha"
                  value={formatDateTime(review?.confirmedAt)}
                />
              </div>

              <div className="mt-2 flex items-center gap-2">
                {confirmed ? (
                  <>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-50">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    </div>

                    <div>
                      <div className="text-[9px] font-black uppercase text-emerald-700">
                        Revisión validada
                      </div>
                      <div className="text-[8px] text-slate-500">
                        Certificación emitida para {period} {year}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-[9px] font-semibold text-amber-700">
                    La revisión todavía no ha sido validada.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-black text-slate-900">
              Firmas y participantes
            </h2>

            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="min-h-[58px] rounded-lg border border-slate-200 px-2 py-2">
                <div className="text-[8px] font-bold uppercase text-slate-400">
                  Responsable administrador
                </div>

                <div className="mt-2 border-t border-slate-300 pt-1 text-[8px]">
                  {administratorParticipant?.name ||
                    review?.confirmedBy ||
                    "Pendiente"}
                </div>
              </div>

              <div className="min-h-[58px] rounded-lg border border-slate-200 px-2 py-2">
                <div className="text-[8px] font-bold uppercase text-slate-400">
                  Responsable gestión
                </div>

                <div className="mt-2 border-t border-slate-300 pt-1 text-[8px]">
                  {managementParticipant?.name ||
                    manager ||
                    "—"}
                </div>
              </div>

              <div className="min-h-[58px] rounded-lg border border-slate-200 px-2 py-2">
                <div className="text-[8px] font-bold uppercase text-slate-400">
                  Responsable técnico
                </div>

                <div className="mt-2 border-t border-slate-300 pt-1 text-[8px]">
                  {technicalParticipant?.name ||
                    technical ||
                    "—"}
                </div>
              </div>
            </div>

            {participantSignatures.length > 0 && (
              <div className="mt-2">
                <div className="text-[8px] font-bold uppercase text-slate-400">
                  Participantes de la revisión
                </div>

                <div className="mt-1 flex flex-wrap gap-2">
                  {participantSignatures.map(
                    (participant: any, index: number) => (
                      <span
                        key={`${participant.name}-${index}`}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[8px] text-slate-700"
                      >
                        {participant.name}
                        {participant.role
                          ? ` · ${participant.role}`
                          : ""}
                        {participant.signed
                          ? " · Firmado"
                          : ""}
                      </span>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* PIE */}
        <footer className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-5 py-2 text-[7px] text-slate-400 print:px-4">
          <span>
            Certificado {certificateNumber}
          </span>

          <span className="text-right">
            Documento generado a partir de la revisión histórica del
            centro · STL SAVILLS
          </span>
        </footer>
      </article>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 7mm;
          }

          html,
          body {
            background: white !important;
          }

          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .no-print {
            display: none !important;
          }

          article {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
