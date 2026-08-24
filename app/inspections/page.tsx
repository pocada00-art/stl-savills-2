"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  SectionTitle,
  Badge,
  Select,
  Button,
} from "@/components/ui";
import {
  Search,
  LayoutGrid,
  List,
  ArrowUpDown,
  Printer,
} from "lucide-react";
import { demo } from "@/lib/data";
import {
  loadState,
  reviewKey,
  reviewSummary,
  blankItem,
  type Period,
} from "@/lib/v1-state";

type CenterReviewRow = {
  c: any;
  active: any[];
  review: any;
  summary: ReturnType<typeof reviewSummary>;
};

/**
 * Formato compacto de fecha:
 * 15/01/2026 -> 01/26
 */
function formatShortDate(value: unknown): string {
  if (!value) return "";

  const raw = String(value).trim();

  if (!raw) return "";

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${month}/${year}`;
}

/**
 * Obtiene la última revisión ya existente en los datos.
 *
 * No calcula ninguna fecha.
 */
function getLastReviewDate(center: any, item: any): string {
  const possibleValues = [
    item?.lastReviewDate,
    item?.ultimaRevision,
    item?.lastReview,
    center?.lastReviewDate,
    center?.ultimaRevision,
    center?.lastReview,
  ];

  const value = possibleValues.find(
    (v) =>
      v !== undefined &&
      v !== null &&
      String(v).trim() !== ""
  );

  return value ? String(value) : "";
}

/**
 * Obtiene la próxima revisión YA CALCULADA en los datos.
 *
 * IMPORTANTE:
 * No se calcula aquí.
 * No se utiliza secondReviewDate.
 */
function getNextReviewDate(center: any, item: any): string {
  const possibleValues = [
    item?.nextReviewDate,
    item?.proximaRevision,
    item?.nextReview,
    center?.nextReviewDate,
    center?.proximaRevision,
    center?.nextReview,
  ];

  const value = possibleValues.find(
    (v) =>
      v !== undefined &&
      v !== null &&
      String(v).trim() !== ""
  );

  return value ? String(value) : "";
}

/**
 * Reduce visualmente algunos nombres largos del catálogo.
 *
 * El dato original NO se modifica.
 */
function getShortInstallationName(item: any): string {
  const installation = String(
    item?.installation || ""
  ).trim();

  if (!installation) return "";

  let result = installation;

  result = result.replace(
    /^ascensores?\s+y\s+montacargas?,?\s*/i,
    "Asc. y mont. "
  );

  result = result.replace(
    /^ascensores?\s+montacargas?,?\s*/i,
    "Asc. y mont. "
  );

  result = result.replace(
    /^aparatos\s+elevadores?,?\s*/i,
    ""
  );

  return result.trim();
}

function getItemId(item: any): string {
  return String(item?.id ?? "");
}

export default function Inspections() {
  const [country, setCountry] = useState("España");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>("S2");
  const [year, setYear] = useState(2026);
  const [mode, setMode] = useState<
    "summary" | "matrix"
  >("summary");

  /*
   * Estas opciones solamente existen en la MATRIZ.
   */
  const [showLast, setShowLast] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const [state, setState] = useState(loadState());

  useEffect(() => {
    setState(loadState());
  }, []);

  const centers = demo.centers.filter(
    (c: any) =>
      c.country === country &&
      c.status === "Activo"
  );

  const catalog =
    country === "España"
      ? demo.esCatalog
      : demo.ptCatalog;

  const rows = useMemo<CenterReviewRow[]>(() => {
    return centers
      .filter((c: any) =>
        `${c.name} ${c.code} ${
          c.shortCode || ""
        }`
          .toLowerCase()
          .includes(q.toLowerCase())
      )
      .map((c: any) => {
        const active = catalog.filter(
          (x: any) =>
            state.activeItems[c.id]?.[x.id] !== false
        );

        const review =
          state.reviews[
            reviewKey(c.id, year, period)
          ];

        const summary = reviewSummary(
          review,
          active.map((x: any) => x.id)
        );

        return {
          c,
          active,
          review,
          summary,
        };
      });
  }, [
    centers,
    catalog,
    q,
    state,
    year,
    period,
  ]);

  const shortItems = catalog;

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Plan de inspecciones"
        subtitle="Resumen y matriz de cumplimiento por centro y elemento"
      />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar centro..."
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
            />
          </div>

          <Select
            value={country}
            onChange={setCountry}
          >
            <option>España</option>
            <option>Portugal</option>
          </Select>

          <Select
            value={String(year)}
            onChange={(v) => setYear(Number(v))}
          >
            <option>2026</option>
            <option>2027</option>
            <option>2028</option>
          </Select>

          <Select
            value={period}
            onChange={(v) =>
              setPeriod(v as Period)
            }
          >
            <option value="S1">S1</option>
            <option value="S2">S2</option>
          </Select>

          <Button
            variant={
              mode === "summary"
                ? "primary"
                : "secondary"
            }
            onClick={() => setMode("summary")}
          >
            <List className="mr-2 inline h-4 w-4" />
            Resumen
          </Button>

          <Button
            variant={
              mode === "matrix"
                ? "primary"
                : "secondary"
            }
            onClick={() => setMode("matrix")}
          >
            <LayoutGrid className="mr-2 inline h-4 w-4" />
            Matriz
          </Button>

          <Button
            variant="secondary"
            onClick={handlePrint}
          >
            <Printer className="mr-2 inline h-4 w-4" />
            Imprimir
          </Button>
        </div>

        {mode === "matrix" && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
            <label className="cursor-pointer">
              <input
                type="checkbox"
                checked={showLast}
                onChange={(e) =>
                  setShowLast(e.target.checked)
                }
                className="mr-1"
              />
              Última revisión
            </label>

            <label className="cursor-pointer">
              <input
                type="checkbox"
                checked={showNext}
                onChange={(e) =>
                  setShowNext(e.target.checked)
                }
                className="mr-1"
              />
              Próxima revisión
            </label>
          </div>
        )}
      </Card>

      {mode === "summary" ? (
        <Card className="p-6">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Centro</th>
                  <th>Estado</th>
                  <th>Cumplimiento</th>
                  <th>APTO</th>
                  <th>COND.</th>
                  <th>NO APTO</th>
                  <th>PEND.</th>
                  <th>Confirmación</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.c.id}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td>
                      <Link
                        href={`/centers/${r.c.id}`}
                        className="font-bold"
                      >
                        {r.c.name}
                      </Link>

                      <div className="text-xs text-slate-400">
                        {r.c.code}
                      </div>
                    </td>

                    <td>
                      <Badge
                        tone={
                          r.review?.confirmed
                            ? "success"
                            : "warning"
                        }
                      >
                        {r.review?.confirmed
                          ? "CONFIRMADA"
                          : "EN CURSO"}
                      </Badge>
                    </td>

                    <td className="text-lg font-black">
                      {r.summary.score}%
                    </td>

                    <td>
                      {r.summary.counts["APTO"]}
                    </td>

                    <td>
                      {
                        r.summary.counts[
                          "APTO CONDICIONADO"
                        ]
                      }
                    </td>

                    <td>
                      {r.summary.counts["NO APTO"]}
                    </td>

                    <td>
                      {r.summary.counts["PENDIENTE"] +
                        r.summary.counts[
                          "SIN INFORMACIÓN"
                        ]}
                    </td>

                    <td>
                      {r.summary.pendingConfirmation ===
                      0 ? (
                        <Badge tone="success">
                          Completa
                        </Badge>
                      ) : (
                        <Badge tone="warning">
                          {
                            r.summary
                              .pendingConfirmation
                          }{" "}
                          pendientes
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
            <ArrowUpDown className="h-4 w-4" />
            Matriz horizontal. Pulsa una celda para
            abrir la ficha del centro.
          </div>

          <div className="overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-max border-collapse text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th
                    className="sticky left-0 z-10 w-8 min-w-8 max-w-8 bg-slate-50 px-0 py-2 text-center align-bottom"
                    style={{
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                      whiteSpace: "nowrap",
                      verticalAlign: "bottom",
                    }}
                  >
                    CENTROS
                  </th>

                  {shortItems.map((x: any) => (
                    <th
                      key={x.id}
                      className="min-w-20 max-w-20 px-1 py-2 text-center align-bottom"
                    >
                      <div
                        className="flex min-h-[130px] items-end justify-center"
                        style={{
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                        }}
                      >
                        <span className="font-bold">
                          {x.code}
                        </span>

                        <span className="mt-2 font-normal text-slate-400">
                          {getShortInstallationName(
                            x
                          )}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.c.id}
                    className="border-t border-slate-100"
                  >
                    <td className="sticky left-0 z-10 w-8 min-w-8 max-w-8 bg-white px-0 py-2 text-center align-bottom">
                      <div
                        className="flex min-h-[130px] items-end justify-center"
                        style={{
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                        }}
                      >
                        <Link
                          href={`/centers/${r.c.id}`}
                          className="whitespace-nowrap font-bold"
                          title={r.c.name}
                        >
                          {r.c.name}
                        </Link>
                      </div>
                    </td>

                    {shortItems.map((x: any) => {
                      const itemId = getItemId(x);

                      const item =
                        r.review?.items[itemId] ||
                        blankItem();

                      const active =
                        state.activeItems[
                          r.c.id
                        ]?.[itemId] !== false;

                      /*
                       * Las fechas se extraen de los datos
                       * existentes. No se calculan aquí.
                       */
                      const lastReviewDate =
                        getLastReviewDate(
                          r.c,
                          x
                        );

                      const nextReviewDate =
                        getNextReviewDate(
                          r.c,
                          x
                        );

                      return (
                        <td
                          key={itemId}
                          className="min-w-20 max-w-20 px-1 py-2 text-center align-bottom"
                        >
                          {!active ? (
                            <div className="flex min-h-[130px] flex-col items-center justify-end">
                              <span className="text-slate-300">
                                —
                              </span>
                            </div>
                          ) : (
                            <div className="flex min-h-[130px] flex-col items-center justify-end">
                              <Link
                                href={`/centers/${r.c.id}`}
                                className="inline-flex"
                              >
                                <span
                                  className={
                                    "inline-flex rounded-full px-2 py-1 font-bold " +
                                    (item.status ===
                                    "APTO"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : item.status ===
                                        "APTO CONDICIONADO"
                                      ? "bg-amber-100 text-amber-700"
                                      : item.status ===
                                        "NO APTO"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-slate-100 text-slate-500")
                                  }
                                >
                                  {item.status ===
                                  "APTO"
                                    ? "A"
                                    : item.status ===
                                      "APTO CONDICIONADO"
                                    ? "C"
                                    : item.status ===
                                      "NO APTO"
                                    ? "N"
                                    : "P"}
                                </span>
                              </Link>

                              {showLast &&
                                lastReviewDate && (
                                  <div className="mt-1 text-[9px] leading-none text-slate-400">
                                    {formatShortDate(
                                      lastReviewDate
                                    )}
                                  </div>
                                )}

                              {showNext &&
                                nextReviewDate && (
                                  <div className="mt-0.5 text-[9px] font-semibold leading-none text-slate-500">
                                    {formatShortDate(
                                      nextReviewDate
                                    )}
                                  </div>
                                )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            La matriz contiene el catálogo completo
            del país seleccionado. Desplázate
            horizontalmente para consultar todos los
            elementos.
          </p>
        </Card>
      )}
    </div>
  );
}
