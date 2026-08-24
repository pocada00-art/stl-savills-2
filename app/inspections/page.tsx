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

/**
 * Abreviaturas para los nombres de los elementos de la matriz.
 *
 * Se intenta mantener un texto corto y fácilmente identificable,
 * ya que los nombres aparecen en vertical en las cabeceras.
 */
function getShortItemName(item: any): string {
  const name = String(item.installation || "").trim();

  const normalized = name.toLowerCase();

  if (
    normalized.includes("ascensores") ||
    normalized.includes("montacargas") ||
    normalized.includes("aparatos elevadores")
  ) {
    return "Asc. y mont.";
  }

  if (normalized.includes("puertas automáticas")) {
    return "Puertas aut.";
  }

  if (normalized.includes("puertas")) {
    return "Puertas";
  }

  if (normalized.includes("escaleras mecánicas")) {
    return "Esc. mec.";
  }

  if (normalized.includes("pasillos móviles")) {
    return "Pas. móviles";
  }

  if (normalized.includes("protección contra incendios")) {
    return "PCI";
  }

  if (normalized.includes("electricidad")) {
    return "Electricidad";
  }

  if (normalized.includes("climatización")) {
    return "Climatización";
  }

  if (normalized.includes("fontanería")) {
    return "Fontanería";
  }

  if (normalized.includes("saneamiento")) {
    return "Saneamiento";
  }

  if (normalized.includes("grupo electrógeno")) {
    return "Grupo electr.";
  }

  if (normalized.includes("instalación solar")) {
    return "Solar";
  }

  if (normalized.includes("pararrayos")) {
    return "Pararrayos";
  }

  if (normalized.includes("gas")) {
    return "Gas";
  }

  if (normalized.includes("calderas")) {
    return "Calderas";
  }

  if (normalized.includes("ascensor")) {
    return "Ascensor";
  }

  return name;
}

export default function Inspections() {
  const [country, setCountry] = useState("España");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>("S2");
  const [year, setYear] = useState(2026);
  const [mode, setMode] = useState<"summary" | "matrix">("summary");

  /**
   * Estas opciones pertenecen exclusivamente a la vista Matriz.
   */
  const [showLast, setShowLast] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const [state, setState] = useState(loadState());

  useEffect(() => {
    setState(loadState());
  }, []);

  const centers = demo.centers.filter(
    (c) =>
      c.country === country &&
      c.status === "Activo"
  );

  const catalog =
    country === "España"
      ? demo.esCatalog
      : demo.ptCatalog;

  const rows = useMemo(
    () =>
      centers
        .filter((c) =>
          `${c.name} ${c.code} ${c.shortCode || ""}`
            .toLowerCase()
            .includes(q.toLowerCase())
        )
        .map((c) => {
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
        }),
    [
      centers,
      catalog,
      q,
      state,
      year,
      period,
    ]
  );

  /**
   * El catálogo completo se utiliza en la matriz.
   */
  const shortItems = catalog;

  /**
   * Imprime la página actual.
   */
  const handlePrint = () => {
    window.print();
  };

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
            <label>
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

            <label>
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
                      {
                        r.summary.counts[
                          "NO APTO"
                        ]
                      }
                    </td>

                    <td>
                      {
                        r.summary.counts[
                          "PENDIENTE"
                        ] +
                          r.summary.counts[
                            "SIN INFORMACIÓN"
                          ]
                      }
                    </td>

                    <td>
                      {r.summary
                        .pendingConfirmation === 0 ? (
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

            <span>
              Matriz horizontal. Pulsa una celda para
              abrir la ficha del centro.
            </span>
          </div>

          <div className="overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-max text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="sticky left-0 z-10 min-w-52 bg-slate-50 px-3 py-3 text-left">
                    Centro
                  </th>

                  {shortItems.map((x: any) => (
                    <th
                      key={x.id}
                      className="min-w-20 px-2 py-3 align-bottom"
                    >
                      <div
                        className="flex h-36 items-end justify-start"
                        title={x.installation}
                      >
                        <span
                          className="whitespace-nowrap text-left"
                          style={{
                            writingMode:
                              "vertical-rl",
                            transform:
                              "rotate(180deg)",
                            textAlign: "left",
                          }}
                        >
                          {getShortItemName(x)}
                        </span>
                      </div>

                      <div className="mt-2 text-left font-normal text-slate-400">
                        {x.code}
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
                    <td className="sticky left-0 z-10 bg-white px-3 py-3">
                      <Link
                        href={`/centers/${r.c.id}`}
                        className="font-bold"
                      >
                        {r.c.name}
                      </Link>

                      <div className="text-xs text-slate-400">
                        {r.summary.score}%
                      </div>
                    </td>

                    {shortItems.map((x: any) => {
                      const item =
                        r.review?.items[x.id] ||
                        blankItem();

                      const active =
                        state.activeItems[
                          r.c.id
                        ]?.[x.id] !== false;

                      return (
                        <td
                          key={x.id}
                          className="px-2 py-2 text-center"
                        >
                          {!active ? (
                            <span className="text-slate-300">
                              —
                            </span>
                          ) : (
                            <span
                              className={`inline-flex rounded-full px-2 py-1 font-bold ${
                                item.status ===
                                "APTO"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : item.status ===
                                    "APTO CONDICIONADO"
                                  ? "bg-amber-100 text-amber-700"
                                  : item.status ===
                                    "NO APTO"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
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
