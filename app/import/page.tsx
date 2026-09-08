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
  comment: string;
};

type ParsedImport = {
  centerName: string;
  centerCode: string;
  centerId: string;
  country: "España" | "Portugal";
  year: number;
  reviewText: string;
  period: Period;
  reviewDate: string;
  rows: ImportRow[];
  excluded: number;
  multiple: number;
  unmatched: number;
  warnings: string[];
};

/*
 * ============================================================
 * COLUMNAS FIJAS DEL EXCEL CORPORATIVO
 * ============================================================
 *
 * Excel      Índice JS
 *
 * D          3     INSTALACIÓN
 * E          4     ACTUACIÓN
 * G          6     ID
 * H          7     EMPRESA
 * N          13    Nº
 * O          14    ESTADO
 * R          17    COMENTARIO
 *
 * Es fundamental NO modificar estos índices salvo que cambie
 * la plantilla corporativa.
 */

const EXCEL_COLUMNS = {
  INSTALLATION: 3,
  ACTION: 4,
  EQUIPMENT_ID: 6,
  COMPANY: 7,
  ORDINAL: 13,
  STATUS: 14,
  COMMENT: 17,
} as const;

/*
 * La tabla comienza en la fila 12 del Excel.
 *
 * Importante:
 * No se establece una última fila fija. El importador recorre
 * todas las filas existentes de la hoja.
 */
const FIRST_DATA_ROW = 12;

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
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(
      2,
      "0"
    )}`;
  }

  const es = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);

  if (es) {
    return `${es[3]}-${es[2].padStart(2, "0")}-${es[1].padStart(
      2,
      "0"
    )}`;
  }

  return "";
}

/**
 * Convierte exclusivamente el valor de la columna O (ESTADO)
 * al estado utilizado por la aplicación.
 *
 * NO se consultan las columnas M ni N.
 */
function statusFromExcel(value: unknown): V1Status | null {
  const status = normalize(value);

  if (status === "favorable") {
    return "APTO";
  }

  if (status === "desfavorable") {
    return "NO APTO";
  }

  if (status === "condicionado") {
    return "APTO CONDICIONADO";
  }

  if (status === "pte." || status === "pte") {
    return "PENDIENTE";
  }

  return null;
}

/**
 * Convierte el Nº de Excel en un número válido.
 */
function excelOrdinal(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  const raw = text(value);

  if (!raw) return 0;

  const match = raw.match(/\d+/);

  if (!match) return 0;

  return Number(match[0]);
}

function detectHeaderDate(rows: any[][]): string {
  for (const row of rows.slice(0, 11)) {
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

  for (const row of rows.slice(0, 11)) {
    for (let c = 0; c < row.length - 1; c += 1) {
      const label = normalize(row[c]);

      if (label === "centro") {
        name = text(row[c + 1]);
      }
    }
  }

  let reviewText = "";
  let year = 0;

  for (const row of rows.slice(0, 11)) {
    for (let c = 0; c < row.length; c += 1) {
      const label = normalize(row[c]);

      if (label === "tipo") {
        for (
          let j = c + 1;
          j < Math.min(row.length, c + 4);
          j += 1
        ) {
          const value = text(row[j]);

          if (normalize(value).includes("revision")) {
            reviewText = value;
            break;
          }
        }
      }

      const raw = text(row[c]);

      const match = raw.match(/(?:^|\D)(20\d{2})(?:$|\D)/);

      if (match && !year) {
        year = Number(match[1]);
      }
    }
  }

  if (!year) {
    throw new Error(
      "No se ha podido identificar el año de la revisión en el documento Excel. La importación se ha detenido para evitar archivarla en un año incorrecto."
    );
  }

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
    reviewText,
  };
}

function parseWorkbook(wb: XLSX.WorkBook): ParsedImport {
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
      `No se ha podido identificar el centro "${
        detected.name || "desconocido"
      }" en la base de centros.`
    );
  }

  const normalizedReviewText = normalize(detected.reviewText);

  let period: Period;

  if (normalizedReviewText.includes("s1")) {
    period = "S1";
  } else if (normalizedReviewText.includes("s2")) {
    period = "S2";
  } else {
    throw new Error(
      "No se ha podido identificar si la revisión del documento es S1 o S2. La importación se ha detenido para evitar archivarla en un periodo incorrecto."
    );
  }

  const country =
    (detected.center as any).country === "Portugal"
      ? "Portugal"
      : "España";

  const catalog =
    country === "España" ? demo.esCatalog : demo.ptCatalog;

  const catalogItems = buildElementCodes(catalog as any[]);

  /*
   * ============================================================
   * MAPA DEL CATÁLOGO POR Nº REAL
   * ============================================================
   *
   * No utilizamos:
   *
   *     catalogItems[ordinal - 1]
   *
   * porque eso presupone que la posición del array coincide
   * siempre con el Nº del Excel.
   *
   * Buscamos el Nº real del elemento dentro del catálogo.
   */

  const catalogByOrdinal = new Map<number, any>();

  for (let index = 0; index < catalogItems.length; index += 1) {
    const item = catalogItems[index] as any;

    const possibleValues = [
      item?.ordinal,
      item?.number,
      item?.numero,
      item?.n,
      item?.nr,
      item?.no,
    ];

    let ordinal = 0;

    for (const value of possibleValues) {
      const candidate = excelOrdinal(value);

      if (candidate > 0) {
        ordinal = candidate;
        break;
      }
    }

    /*
     * Si el catálogo no tiene un campo Nº, utilizamos la posición
     * como último recurso, pero solamente para construir el mapa.
     */
    if (!ordinal) {
      ordinal = index + 1;
    }

    if (ordinal > 0 && !catalogByOrdinal.has(ordinal)) {
      catalogByOrdinal.set(ordinal, item);
    }
  }

  const reviewDate = detectHeaderDate(rows);

  const parsedRows: ImportRow[] = [];
  const warnings: string[] = [];

  let excluded = 0;
  let unmatched = 0;

  /*
   * Recorremos TODAS las filas existentes desde la fila 12.
   *
   * No utilizamos una última fila fija.
   */
  for (
    let excelRow = FIRST_DATA_ROW;
    excelRow <= rows.length;
    excelRow += 1
  ) {
    const row = rows[excelRow - 1] || [];

    /*
     * ----------------------------------------------------------
     * EL Nº DEL ELEMENTO ESTÁ EN LA COLUMNA N
     * ----------------------------------------------------------
     */
    const ordinal = excelOrdinal(
      row[EXCEL_COLUMNS.ORDINAL]
    );

    /*
     * Si no existe Nº, no es una fila de elemento válida.
     */
    if (!ordinal) {
      continue;
    }

    /*
     * ----------------------------------------------------------
     * EL ESTADO SE LEE EXCLUSIVAMENTE DE LA COLUMNA O
     * ----------------------------------------------------------
     */
    const rawStatus = text(row[EXCEL_COLUMNS.STATUS]);

    const status = statusFromExcel(
      row[EXCEL_COLUMNS.STATUS]
    );

    /*
     * Los estados "-" o vacíos no se importan.
     *
     * Pero tampoco provocamos un error: simplemente dejamos
     * constancia de que la fila no tenía un estado importable.
     */
    if (!status) {
      excluded += 1;

      if (rawStatus) {
        warnings.push(
          `Fila ${excelRow}, elemento ${ordinal}: el valor de ESTADO "${rawStatus}" no es un estado importable.`
        );
      }

      continue;
    }

    /*
     * ----------------------------------------------------------
     * BUSCAMOS LA ACTUACIÓN POR SU Nº
     * ----------------------------------------------------------
     */
    const catalogItem = catalogByOrdinal.get(ordinal);

    if (!catalogItem) {
      unmatched += 1;

      warnings.push(
        `Fila ${excelRow}, elemento ${ordinal}: tiene el estado "${rawStatus}", pero no existe una actuación con ese Nº en el catálogo. El elemento no se ha descartado silenciosamente.`
      );

      continue;
    }

    /*
     * ----------------------------------------------------------
     * DATOS DE LA MISMA FILA
     * ----------------------------------------------------------
     *
     * Estos valores NO se obtienen del catálogo.
     *
     * Se leen directamente de la misma fila del Excel.
     */
    const installation = text(
      row[EXCEL_COLUMNS.INSTALLATION]
    );

    const action = text(row[EXCEL_COLUMNS.ACTION]);

    const equipmentId = text(
      row[EXCEL_COLUMNS.EQUIPMENT_ID]
    );

    const company = text(row[EXCEL_COLUMNS.COMPANY]);

    const comment = text(row[EXCEL_COLUMNS.COMMENT]);

    /*
     * La fecha general de la revisión se mantiene como fecha
     * principal. Como respaldo, se intenta utilizar la fecha
     * correspondiente a la fila.
     *
     * La fecha de la fila se mantiene en la posición que ya
     * utilizaba el importador anterior.
     */
    const inspectionDate =
      reviewDate || excelDateToISO(row[9]);

    /*
     * Cada fila tiene ahora UN ÚNICO estado, procedente de O.
     */
    parsedRows.push({
      excelRow,
      ordinal,
      catalogItemId: String(catalogItem.id),
      category: text(catalogItem.category),
      installation,
      action,
      actionCode: text(
        catalogItem.actionCode ??
          catalogItem.baseCode ??
          catalogItem.code
      ),
      equipmentId,
      company,
      inspectionDate,
      status,
      selected: [status],
      multiple: false,
      comment,
    });
  }

  if (!reviewDate) {
    warnings.push(
      "No se ha podido detectar la fecha general de revisión de la cabecera. Se utilizará la fecha de la fila cuando exista."
    );
  }

  if (catalogItems.length !== 84) {
    warnings.push(
      `El catálogo utilizado contiene ${catalogItems.length} actuaciones.`
    );
  }

  return {
    centerName: text((detected.center as any).name),
    centerCode: text((detected.center as any).code),
    centerId: String((detected.center as any).id),
    country,
    year: detected.year,
    reviewText: detected.reviewText,
    period,
    reviewDate,
    rows: parsedRows,
    excluded,
    multiple: 0,
    unmatched,
    warnings,
  };
}

function statusClasses(status: V1Status) {
  if (status === "APTO") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "APTO CONDICIONADO") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "NO APTO") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "PENDIENTE") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(
    null
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const summary = useMemo(() => {
    if (!parsed) return null;

    const counts = {
      APTO: parsed.rows.filter(
        (r) => r.status === "APTO"
      ).length,

      "APTO CONDICIONADO": parsed.rows.filter(
        (r) => r.status === "APTO CONDICIONADO"
      ).length,

      "NO APTO": parsed.rows.filter(
        (r) => r.status === "NO APTO"
      ).length,

      PENDIENTE: parsed.rows.filter(
        (r) => r.status === "PENDIENTE"
      ).length,
    };

    /*
     * Puntuación:
     *
     * APTO                 = 3 puntos
     * APTO CONDICIONADO    = 2 puntos
     * NO APTO              = 1 punto
     * PENDIENTE            = 0 puntos
     *
     * Todos los elementos importados participan en el
     * denominador.
     */
    const points =
      counts.APTO * 3 +
      counts["APTO CONDICIONADO"] * 2 +
      counts["NO APTO"];

    const max = parsed.rows.length * 3;

    const score = max
      ? Math.round((points / max) * 100)
      : 0;

    return {
      counts,
      points,
      max,
      score,
    };
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

      const result = parseWorkbook(wb);

      setParsed(result);
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

    const existing = state.reviews[key];

    const items: Record<string, ItemReview> = {};

    for (const row of parsed.rows) {
      const current =
        existing?.items?.[row.catalogItemId] ??
        blankItem();

      items[row.catalogItemId] = {
        ...current,

        status: row.status,

        date: row.inspectionDate,

        equipmentId: row.equipmentId,

        company: row.company,

        apto: row.status === "APTO",

        condicionado:
          row.status === "APTO CONDICIONADO",

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

      itemIds: parsed.rows.map(
        (row) => row.catalogItemId
      ),

      confirmed: false,

      confirmedAt: undefined,

      confirmedBy: undefined,

      items,

      participants:
        existing?.participants || [],
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
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-slate-100 p-3">
            <FileSpreadsheet className="h-6 w-6 text-slate-700" />
          </div>

          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Importación STL / Excel
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Importa una revisión histórica desde la plantilla
              corporativa Excel.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-medium">
            Estructura utilizada por el importador
          </p>

          <p className="mt-1">
            El importador utiliza las columnas fijas de la
            plantilla: D = Instalación, E = Actuación, G =
            ID, H = Empresa, N = Nº, O = Estado y R =
            Comentario.
          </p>

          <p className="mt-2">
            El estado se obtiene exclusivamente de la columna
            O. Las filas con FAVORABLE, DESFAVORABLE,
            CONDICIONADO o PTE. se importan.
          </p>
        </div>

        <label
          htmlFor="excel-upload"
          className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-slate-400 hover:bg-slate-100"
        >
          <UploadCloud className="h-10 w-10 text-slate-500" />

          <span className="mt-3 text-sm font-semibold text-slate-800">
            Seleccionar archivo Excel
          </span>

          <span className="mt-1 text-xs text-slate-500">
            Selecciona el archivo STL corporativo .xlsx
          </span>

          <input
            id="excel-upload"
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const selectedFile =
                event.target.files?.[0];

              if (selectedFile) {
                void handleFile(selectedFile);
              }
            }}
          />
        </label>

        {file && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <FileSpreadsheet className="h-5 w-5 text-slate-600" />

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {file.name}
              </p>

              <p className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
        )}

        {busy && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            Analizando el archivo Excel...
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <p className="font-semibold">
                No se ha podido realizar la importación
              </p>

              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}
      </div>

      {parsed && summary && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Vista previa de la importación
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  {parsed.centerName} · {parsed.period}{" "}
                  {parsed.year}
                </p>
              </div>

              <div className="rounded-xl bg-slate-900 px-4 py-3 text-right text-white">
                <div className="text-xs uppercase tracking-wide text-slate-300">
                  Resultado
                </div>

                <div className="text-2xl font-bold">
                  {summary.score}%
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-medium text-slate-500">
                  Importados
                </div>

                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {parsed.rows.length}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-xs font-medium text-emerald-700">
                  APTO
                </div>

                <div className="mt-1 text-2xl font-bold text-emerald-800">
                  {summary.counts.APTO}
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-xs font-medium text-amber-700">
                  CONDICIONADO
                </div>

                <div className="mt-1 text-2xl font-bold text-amber-800">
                  {summary.counts["APTO CONDICIONADO"]}
                </div>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="text-xs font-medium text-red-700">
                  NO APTO
                </div>

                <div className="mt-1 text-2xl font-bold text-red-800">
                  {summary.counts["NO APTO"]}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-medium text-slate-600">
                  PENDIENTE
                </div>

                <div className="mt-1 text-2xl font-bold text-slate-800">
                  {summary.counts.PENDIENTE}
                </div>
              </div>

              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <div className="text-xs font-medium text-orange-700">
                  No emparejados
                </div>

                <div className="mt-1 text-2xl font-bold text-orange-800">
                  {parsed.unmatched}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <strong>Regla de puntuación:</strong>{" "}
              APTO = 3, APTO CONDICIONADO = 2, NO APTO = 1 y
              PENDIENTE = 0. Todos los elementos importados
              participan en el cálculo.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Elementos detectados
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Cada valor mostrado procede de la misma fila del
                Excel.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Fila</th>
                    <th className="px-4 py-3">Nº</th>
                    <th className="px-4 py-3">Instalación</th>
                    <th className="px-4 py-3">Actuación</th>
                    <th className="px-4 py-3">ID equipo</th>
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Comentario</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {parsed.rows.map((row) => (
                    <tr
                      key={`${row.excelRow}-${row.ordinal}-${row.catalogItemId}`}
                      className="hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                        {row.excelRow}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                        {row.ordinal}
                      </td>

                      <td className="min-w-[220px] px-4 py-3 text-slate-800">
                        {row.installation || "—"}
                      </td>

                      <td className="min-w-[220px] px-4 py-3 text-slate-800">
                        {row.action || "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {row.equipmentId || "—"}
                      </td>

                      <td className="min-w-[150px] px-4 py-3 text-slate-700">
                        {row.company || "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>

                      <td className="min-w-[250px] px-4 py-3 text-slate-600">
                        {row.comment || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(parsed.excluded > 0 ||
            parsed.unmatched > 0 ||
            parsed.warnings.length > 0) && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                <div className="min-w-0">
                  <h2 className="font-semibold text-amber-900">
                    Observaciones de la importación
                  </h2>

                  <p className="mt-1 text-sm text-amber-800">
                    Las filas sin un estado válido en la columna
                    O no se incorporan. Los elementos con estado
                    válido pero sin correspondencia en el catálogo
                    aparecen aquí.
                  </p>

                  <div className="mt-4 space-y-2 text-sm text-amber-900">
                    {parsed.excluded > 0 && (
                      <p>
                        <strong>
                          Filas sin estado importable:
                        </strong>{" "}
                        {parsed.excluded}
                      </p>
                    )}

                    {parsed.unmatched > 0 && (
                      <p>
                        <strong>
                          Elementos con Nº no encontrado:
                        </strong>{" "}
                        {parsed.unmatched}
                      </p>
                    )}

                    {parsed.warnings.map((warning, index) => (
                      <p
                        key={`${warning}-${index}`}
                        className="rounded-lg bg-white/60 p-2"
                      >
                        {warning}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-900">
                Confirmar importación
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Se guardarán {parsed.rows.length} elementos en
                la revisión histórica {parsed.period}{" "}
                {parsed.year}.
              </p>
            </div>

            <button
              type="button"
              onClick={confirmImport}
              disabled={parsed.rows.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-5 w-5" />
              Confirmar importación
            </button>
          </div>
        </>
      )}

      {message && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />

          <div>
            <p className="font-semibold">
              Importación completada
            </p>

            <p className="mt-1">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
