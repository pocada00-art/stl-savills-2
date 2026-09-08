"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  UploadCloud,
  XCircle,
} from "lucide-react";

import { demo } from "@/lib/data";
import {
  blankItem,
  loadState,
  reviewKey,
  saveState,
  type ItemReview,
  type Period,
  type ReviewState,
  type V1State,
  type V1Status,
} from "@/lib/v1-state";
import { buildElementCodes } from "@/lib/element-codes";

type ImportRow = {
  excelRow: number;
  ordinal: number;
  catalogItemId: string;
  category: string;
  installation: string;
  action: string;
  actionCode: string;
  equipmentId: string;
  company: string;
  inspectionDate: string;
  status: V1Status;
  selected: string[];
  multiple: boolean;
};

type ParsedImport = {
  centerName: string;
  centerCode: string;
  centerId: string;
  country: "España" | "Portugal";
  year: number;
  period: Period;
  reviewDate: string;
  rows: ImportRow[];
  excluded: number;
  multiple: number;
  unmatched: number;
  warnings: string[];
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalize(value: unknown): string {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function asBoolean(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const v = normalize(value);
  return v === "true" || v === "si" || v === "sí" || v === "x" || v === "✓";
}

function excelDateToISO(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = XLSX.SSF.parse_date_code(value);
    if (date?.y && date?.m && date?.d) {
      return `${date.y}-${String(date.m).padStart(2, "0")}-${String(
        date.d
      ).padStart(2, "0")}`;
    }
  }

  const raw = text(value);
  if (!raw) return "";

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const es = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (es) {
    return `${es[3]}-${es[2].padStart(2, "0")}-${es[1].padStart(2, "0")}`;
  }

  return "";
}

function worstStatus(selected: string[]): V1Status {
  if (selected.includes("NO APTO")) return "NO APTO";
  if (selected.includes("APTO CONDICIONADO")) return "APTO CONDICIONADO";
  return "APTO";
}

function detectHeaderDate(rows: any[][]): string {
  for (const row of rows.slice(0, 10)) {
    for (let c = 0; c < row.length - 1; c += 1) {
      if (normalize(row[c]) === "fecha") {
        const date = excelDateToISO(row[c + 1]);
        if (date) return date;
      }
    }
  }
  return "";
}

function detectCenter(rows: any[][]) {
  let name = "";
  let code = "";

  for (const row of rows.slice(0, 10)) {
    for (let c = 0; c < row.length - 1; c += 1) {
      const label = normalize(row[c]);
      if (label === "centro") name = text(row[c + 1]);
    }
  }

  const yearRow = rows[6] || [];
  const possibleYear = Number(yearRow[7]);
  const year =
    Number.isInteger(possibleYear) && possibleYear >= 2000
      ? possibleYear
      : 2026;

  const center = demo.centers.find(
    (c: any) =>
      normalize(c.name) === normalize(name) ||
      normalize(c.shortCode) === normalize(name)
  );

  if (center) {
    code = text((center as any).code);
  }

  return {
    name,
    code,
    center: center as any,
    year,
  };
}

function parseWorkbook(
  wb: XLSX.WorkBook
): ParsedImport {
  const sheetName = wb.SheetNames.includes("FICHA")
    ? "FICHA"
    : wb.SheetNames[0];

  if (!sheetName) {
    throw new Error("El archivo no contiene ninguna hoja.");
  }

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  }) as any[][];

  const detected = detectCenter(rows);
  if (!detected.center) {
    throw new Error(
      `No se ha podido identificar el centro "${detected.name || "desconocido"}" en la base de centros.`
    );
  }

  const period =
    rows[6] && normalize(rows[6][6]).includes("revision")
      ? "S1"
      : (() => {
          const reviewText = rows[6]?.[5];
          return normalize(reviewText).includes("s1") ? "S1" : "S2";
        })();

  const country =
    (detected.center as any).country === "Portugal"
      ? "Portugal"
      : "España";

  const catalog =
    country === "España" ? demo.esCatalog : demo.ptCatalog;

  const catalogItems = buildElementCodes(catalog as any[]);

  /*
   * La FICHA corporativa contiene una línea por actuación.
   * En el STL utilizado para la importación, las filas 11-94
   * corresponden al catálogo de 84 actuaciones.
   *
   * Se utiliza primero el ordinal de la fila, que evita
   * ambigüedades cuando instalación/actuación se repiten.
   */
  const firstDataRow = 11;
  const lastDataRow = Math.min(94, rows.length);

  const reviewDate = detectHeaderDate(rows);
  const parsedRows: ImportRow[] = [];
  const warnings: string[] = [];

  let excluded = 0;
  let multiple = 0;
  let unmatched = 0;

  for (let excelRow = firstDataRow; excelRow <= lastDataRow; excelRow += 1) {
    const row = rows[excelRow - 1] || [];
    const ordinal = Number(row[0]);

    if (!Number.isInteger(ordinal) || ordinal <= 0) continue;

    const catalogItem =
      catalogItems[ordinal - 1] as any | undefined;

    if (!catalogItem) {
      unmatched += 1;
      warnings.push(
        `Fila ${excelRow}: no existe una actuación equivalente en el catálogo para el ordinal ${ordinal}.`
      );
      continue;
    }

    const selected: string[] = [];
    if (asBoolean(row[12])) selected.push("APTO");
    if (asBoolean(row[13])) selected.push("APTO CONDICIONADO");
    if (asBoolean(row[14])) selected.push("NO APTO");

    /*
     * REGLA IMPORTACIÓN:
     * - Sin M/N/O: el elemento no existe en el centro y NO se
     *   incorpora a esta revisión.
     * - Una marca: se utiliza esa marca.
     * - Varias marcas: se utiliza la más desfavorable.
     */
    if (selected.length === 0) {
      excluded += 1;
      continue;
    }

    const isMultiple = selected.length > 1;
    if (isMultiple) {
      multiple += 1;
      warnings.push(
        `Fila ${excelRow} (${catalogItem.action}): hay ${selected.length} estados marcados (${selected.join(
          ", "
        )}). Se importará "${worstStatus(selected)}" por aplicación de la regla de peor estado.`
      );
    }

    parsedRows.push({
      excelRow,
      ordinal,
      catalogItemId: String(catalogItem.id),
      category: text(catalogItem.category),
      installation: text(catalogItem.installation),
      action: text(catalogItem.action),
      actionCode: text(
        catalogItem.actionCode ??
          catalogItem.baseCode ??
          catalogItem.code
      ),
      equipmentId: text(row[7]),
      company: text(row[8]),
      inspectionDate: reviewDate || excelDateToISO(row[9]),
      status: worstStatus(selected),
      selected,
      multiple: isMultiple,
    });
  }

  if (!reviewDate) {
    warnings.push(
      "No se ha podido detectar la fecha general de revisión de la cabecera. Se utilizará la fecha 'Ult. Rev.' de cada fila cuando exista."
    );
  }

  if (catalogItems.length !== 84) {
    warnings.push(
      `El catálogo español utilizado contiene ${catalogItems.length} actuaciones; el fichero corporativo contiene hasta 84 filas. Se ha importado únicamente lo que ha podido emparejarse.`
    );
  }

  return {
    centerName: text((detected.center as any).name),
    centerCode: text((detected.center as any).code),
    centerId: String((detected.center as any).id),
    country,
    year: detected.year,
    period,
    reviewDate,
    rows: parsedRows,
    excluded,
    multiple,
    unmatched,
    warnings,
  };
}

function statusClasses(status: V1Status) {
  if (status === "APTO") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "APTO CONDICIONADO")
    return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const summary = useMemo(() => {
    if (!parsed) return null;

    const counts = {
      APTO: parsed.rows.filter(r => r.status === "APTO").length,
      "APTO CONDICIONADO": parsed.rows.filter(
        r => r.status === "APTO CONDICIONADO"
      ).length,
      "NO APTO": parsed.rows.filter(r => r.status === "NO APTO").length,
    };

    const points =
      counts.APTO * 3 +
      counts["APTO CONDICIONADO"] * 2 +
      counts["NO APTO"];

    const max = parsed.rows.length * 3;
    const score = max ? Math.round((points / max) * 100) : 0;

    return { counts, points, max, score };
  }, [parsed]);

  async function handleFile(nextFile: File) {
    setFile(nextFile);
    setParsed(null);
    setMessage("");
    setError("");
    setBusy(true);

    try {
      const buffer = await nextFile.arrayBuffer();
      const wb = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
      });

      setParsed(parseWorkbook(wb));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se ha podido analizar el archivo Excel."
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmImport() {
    if (!parsed || !summary) return;

    setError("");
    setMessage("");

    const state = loadState();
    const key = reviewKey(
      parsed.centerId,
      parsed.year,
      parsed.period
    );

    /*
     * La importación es histórica:
     * nunca modifica activeItems, customItems ni ninguna otra
     * revisión. Solo crea/reemplaza la revisión exacta del
     * centro + año + periodo del archivo.
     */
    const existing = state.reviews[key];

    const items: Record<string, ItemReview> = {};

    for (const row of parsed.rows) {
      const current =
        existing?.items?.[row.catalogItemId] ?? blankItem();

      items[row.catalogItemId] = {
        ...current,
        status: row.status,
        date: row.inspectionDate,
        equipmentId: row.equipmentId,
        company: row.company,
        apto: row.status === "APTO",
        condicionado: row.status === "APTO CONDICIONADO",
        noApto: row.status === "NO APTO",
        confirmed: false,
        confirmedAt: undefined,
        confirmedBy: undefined,
      };
    }

    const review: ReviewState = {
      ...(existing || {}),
      year: parsed.year,
      period: parsed.period,
      /*
       * Universo histórico de esta revisión.
       * Las filas sin M/N/O quedan deliberadamente fuera.
       */
      itemIds: parsed.rows.map(row => row.catalogItemId),
      confirmed: false,
      confirmedAt: undefined,
      confirmedBy: undefined,
      items,
      participants: existing?.participants || [],
    };

    const nextState: V1State = {
      ...state,
      reviews: {
        ...state.reviews,
        [key]: review,
      },
    };

    saveState(nextState);
    setMessage(
      `Importación realizada correctamente: ${parsed.centerName} · ${parsed.period} ${parsed.year}. Se han incorporado ${parsed.rows.length} elementos a esta revisión histórica.`
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[#002A54]">
          Importación STL / Excel
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Importación de revisiones históricas desde la FICHA corporativa STL.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center hover:border-slate-400">
          <UploadCloud className="h-10 w-10 text-[#002A54]" />
          <div className="mt-3 font-bold">
            Selecciona un archivo Excel
          </div>
          <div className="mt-1 text-sm text-slate-500">
            XLSX / XLS · se analiza localmente en el navegador
          </div>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => {
              const selected = e.target.files?.[0];
              if (selected) void handleFile(selected);
              e.currentTarget.value = "";
            }}
          />
        </label>

        {file && (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-4">
            <FileSpreadsheet className="h-5 w-5 text-[#002A54]" />
            <div className="font-semibold">{file.name}</div>
            {busy ? (
              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                Analizando...
              </span>
            ) : parsed ? (
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                Analizado
              </span>
            ) : null}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {parsed && summary && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-800">
                  Vista previa de importación
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {parsed.centerName} · centro {parsed.centerCode} ·{" "}
                  {parsed.period} {parsed.year}
                </p>
              </div>
              <div className="rounded-xl border border-[#002A54]/10 bg-[#002A54]/5 px-4 py-2 text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Cumplimiento calculado
                </div>
                <div className="text-2xl font-black text-[#002A54]">
                  {summary.score}%
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Importados</div>
                <div className="mt-1 text-xl font-black">{parsed.rows.length}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">No existentes</div>
                <div className="mt-1 text-xl font-black">{parsed.excluded}</div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <div className="text-xs text-emerald-700">APTO</div>
                <div className="mt-1 text-xl font-black text-emerald-700">
                  {summary.counts.APTO}
                </div>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <div className="text-xs text-amber-700">CONDICIONADO</div>
                <div className="mt-1 text-xl font-black text-amber-700">
                  {summary.counts["APTO CONDICIONADO"]}
                </div>
              </div>
              <div className="rounded-xl bg-red-50 p-3">
                <div className="text-xs text-red-700">NO APTO</div>
                <div className="mt-1 text-xl font-black text-red-700">
                  {summary.counts["NO APTO"]}
                </div>
              </div>
              <div className="rounded-xl bg-orange-50 p-3">
                <div className="text-xs text-orange-700">
                  Múltiples marcas
                </div>
                <div className="mt-1 text-xl font-black text-orange-700">
                  {parsed.multiple}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <h2 className="font-black text-slate-800">
                Elementos que se importarán
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Las filas sin APTO / CONDICIONADO / NO APTO no se incorporan a
                esta revisión porque se consideran elementos inexistentes.
              </p>
            </div>

            <div className="max-h-[560px] overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 bg-[#002A54] text-left text-white">
                  <tr>
                    <th className="px-3 py-2">Fila</th>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Instalación</th>
                    <th className="px-3 py-2">Actuación</th>
                    <th className="px-3 py-2">ID equipo</th>
                    <th className="px-3 py-2">Empresa</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.map(row => (
                    <tr
                      key={`${row.excelRow}-${row.catalogItemId}`}
                      className="border-b border-slate-100"
                    >
                      <td className="px-3 py-2">{row.excelRow}</td>
                      <td className="px-3 py-2 font-mono">{row.actionCode}</td>
                      <td className="px-3 py-2">{row.installation}</td>
                      <td className="px-3 py-2">{row.action}</td>
                      <td className="px-3 py-2">{row.equipmentId || "—"}</td>
                      <td className="px-3 py-2">{row.company || "—"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full border px-2 py-1 font-bold ${statusClasses(
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                        {row.multiple && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-orange-700">
                            <AlertTriangle className="h-3 w-3" />
                            Múltiples marcas → peor estado
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {parsed.warnings.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2 font-black text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                Avisos de importación
              </div>
              <ul className="mt-3 space-y-1 text-xs text-amber-800">
                {parsed.warnings.map((warning, index) => (
                  <li key={`${index}-${warning}`}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start gap-2 text-xs text-slate-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              <div>
                <div className="font-bold">
                  La importación solo afecta a {parsed.centerName} ·{" "}
                  {parsed.period} {parsed.year}.
                </div>
                <div>
                  No modifica S2 ni ninguna revisión anterior y no cambia el
                  inventario actual del centro.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={confirmImport}
              disabled={busy || parsed.rows.length === 0}
              className="rounded-xl bg-[#002A54] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirmar importación
            </button>
          </div>

          {message && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {message}
            </div>
          )}
        </>
      )}
    </div>
  );
}
