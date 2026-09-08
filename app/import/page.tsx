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
 * CONFIGURACIÓN FIJA DEL EXCEL CORPORATIVO
 * ============================================================
 *
 * CABECERA
 *
 * E2 = Nombre del centro
 * E7 = Revisión
 * G7 = Año de revisión
 *
 * TABLA DE ELEMENTOS
 *
 * D = Instalación
 * E = Actuación
 * G = ID
 * H = Empresa
 * O = ESTADO
 * R = Comentario
 *
 * IMPORTANTE:
 *
 * La columna N NO se utiliza en ningún punto del importador.
 *
 * La decisión de importar una fila depende EXCLUSIVAMENTE
 * del estado existente en la columna O.
 */

const EXCEL_COLUMNS = {
  INSTALLATION: 3, // D
  ACTION: 4, // E
  EQUIPMENT_ID: 6, // G
  COMPANY: 7, // H
  STATUS: 14, // O
  COMMENT: 17, // R
} as const;

const FIRST_DATA_ROW = 12;
const LAST_DATA_ROW = 200;

/*
 * Celdas exactas de la cabecera.
 *
 * Índices JavaScript:
 *
 * E = 4
 * G = 6
 */
const HEADER_CELLS = {
  CENTER_NAME: {
    row: 2,
    column: 4,
  },
  REVIEW: {
    row: 7,
    column: 4,
  },
  YEAR: {
    row: 7,
    column: 6,
  },
} as const;

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

/**
 * Normaliza un ID para poder compararlo de forma segura
 * entre Excel y catálogo.
 *
 * Se conserva el valor completo y solamente se eliminan
 * espacios exteriores.
 */
function normalizeId(value: unknown): string {
  return text(value).toLowerCase();
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
 * Convierte exclusivamente el valor de la columna O
 * (ESTADO) al estado utilizado por la aplicación.
 *
 * La columna N NO participa.
 */
function statusFromExcel(value: unknown): V1Status | null {
  const status = normalize(value);

  if (!status) {
    return null;
  }

  /*
   * Estados que pueden venir directamente de la plantilla.
   */
  if (
    status === "favorable" ||
    status === "apto"
  ) {
    return "APTO";
  }

  if (
    status === "desfavorable" ||
    status === "no apto" ||
    status === "noapto"
  ) {
    return "NO APTO";
  }

  if (
    status === "condicionado" ||
    status === "apto condicionado" ||
    status === "apto condicionado."
  ) {
    return "APTO CONDICIONADO";
  }

  if (
    status === "pte." ||
    status === "pte" ||
    status === "pendiente"
  ) {
    return "PENDIENTE";
  }

  return null;
}

/**
 * Obtiene una fecha general de revisión si existe alguna
 * celda identificada como Fecha en la cabecera.
 *
 * La fecha no participa en la identificación del elemento.
 */
function detectHeaderDate(rows: any[][]): string {
  for (const row of rows.slice(0, FIRST_DATA_ROW - 1)) {
    for (let c = 0; c < row.length - 1; c += 1) {
      if (normalize(row[c]) === "fecha") {
        const date = excelDateToISO(row[c + 1]);

        if (date) {
          return date;
        }
      }
    }
  }

  return "";
}

/**
 * Lee la cabecera utilizando las celdas FIJAS de la plantilla:
 *
 * E2 = Centro
 * E7 = Revisión
 * G7 = Año
 */
function detectCenter(rows: any[][]) {
  const centerName = text(
    rows[HEADER_CELLS.CENTER_NAME.row - 1]?.[
      HEADER_CELLS.CENTER_NAME.column
    ]
  );

  const reviewText = text(
    rows[HEADER_CELLS.REVIEW.row - 1]?.[
      HEADER_CELLS.REVIEW.column
    ]
  );

  const rawYear =
    rows[HEADER_CELLS.YEAR.row - 1]?.[
      HEADER_CELLS.YEAR.column
    ];

  let year = 0;

  if (
    typeof rawYear === "number" &&
    Number.isFinite(rawYear)
  ) {
    year = Math.trunc(rawYear);
  } else {
    const yearText = text(rawYear);
    const match = yearText.match(/20\d{2}/);

    if (match) {
      year = Number(match[0]);
    }
  }

  if (!centerName) {
    throw new Error(
      "No se ha encontrado el nombre del centro en la celda E2 del documento Excel."
    );
  }

  if (!reviewText) {
    throw new Error(
      "No se ha encontrado la revisión en la celda E7 del documento Excel."
    );
  }

  if (!year) {
    throw new Error(
      "No se ha podido identificar el año de la revisión en la celda G7 del documento Excel. La importación se ha detenido para evitar archivarla en un año incorrecto."
    );
  }

  const center = demo.centers.find(
    (c: any) =>
      normalize(c.name) === normalize(centerName) ||
      normalize(c.shortCode) === normalize(centerName) ||
      normalize(c.code) === normalize(centerName)
  );

  if (!center) {
    throw new Error(
      `No se ha podido identificar el centro "${centerName}" en la base de centros.`
    );
  }

  return {
    name: centerName,
    code: text((center as any).code),
    center: center as any,
    year,
    reviewText,
  };
}

/**
 * Construye un mapa del catálogo utilizando EXCLUSIVAMENTE
 * el ID real del elemento.
 *
 * NO se utiliza el Nº de Excel.
 * NO se utiliza la columna N.
 */
function buildCatalogById(catalogItems: any[]) {
  const catalogById = new Map<string, any>();

  for (const item of catalogItems) {
    const possibleIds = [
      item?.id,
      item?.ID,
      item?.elementId,
      item?.elementID,
      item?.itemId,
    ];

    for (const value of possibleIds) {
      const id = normalizeId(value);

      if (id) {
        catalogById.set(id, item);
        break;
      }
    }
  }

  return catalogById;
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

  const normalizedReviewText = normalize(
    detected.reviewText
  );

  let period: Period;

  if (
    normalizedReviewText.includes("s1") ||
    normalizedReviewText.includes("semestre 1") ||
    normalizedReviewText.includes("1 semestre")
  ) {
    period = "S1";
  } else if (
    normalizedReviewText.includes("s2") ||
    normalizedReviewText.includes("semestre 2") ||
    normalizedReviewText.includes("2 semestre")
  ) {
    period = "S2";
  } else {
    throw new Error(
      `No se ha podido identificar si la revisión "${detected.reviewText}" corresponde a S1 o S2. La importación se ha detenido para evitar archivarla en un periodo incorrecto.`
    );
  }

  const country =
    (detected.center as any).country === "Portugal"
      ? "Portugal"
      : "España";

  const catalog =
    country === "España"
      ? demo.esCatalog
      : demo.ptCatalog;

  const catalogItems = buildElementCodes(
    catalog as any[]
  );

  /*
   * ==========================================================
   * MAPA DEL CATÁLOGO POR ID
   * ==========================================================
   *
   * El ID de la columna G es ahora la referencia principal.
   *
   * Ejemplo:
   *
   * Excel G = "123"
   *
   * se busca contra:
   *
   * catalogItem.id === "123"
   *
   * La columna N no interviene.
   */
  const catalogById = buildCatalogById(
    catalogItems as any[]
  );

  const reviewDate = detectHeaderDate(rows);

  const parsedRows: ImportRow[] = [];
  const warnings: string[] = [];

  let excluded = 0;
  let unmatched = 0;

  /*
   * ==========================================================
   * PROCESAMIENTO DE LA TABLA
   * ==========================================================
   *
   * ÚNICAMENTE A12:T200
   *
   * Para cada fila:
   *
   * 1. Leer O (ESTADO)
   * 2. Si O está vacío -> ignorar fila completa
   * 3. Si O tiene estado válido -> leer D/E/G/H/R
   */
  for (
    let excelRow = FIRST_DATA_ROW;
    excelRow <= LAST_DATA_ROW;
    excelRow += 1
  ) {
    const row = rows[excelRow - 1] || [];

    /*
     * --------------------------------------------------------
     * PASO 1: ESTADO DE LA COLUMNA O
     * --------------------------------------------------------
     *
     * ESTA ES LA CONDICIÓN QUE DECIDE SI LA FILA SE IMPORTA.
     */
    const rawStatus = text(
      row[EXCEL_COLUMNS.STATUS]
    );

    /*
     * Si O está completamente vacía, NO se importa nada
     * de esta fila.
     *
     * Tampoco se genera warning porque es una fila sin
     * elemento que importar.
     */
    if (!rawStatus) {
      continue;
    }

    /*
     * --------------------------------------------------------
     * PASO 2: COMPROBAR QUE O CONTIENE UN ESTADO CONOCIDO
     * --------------------------------------------------------
     */
    const status = statusFromExcel(rawStatus);

    if (!status) {
      excluded += 1;

      warnings.push(
        `Fila ${excelRow}: el valor de ESTADO de la columna O "${rawStatus}" no es un estado reconocido. La fila no se ha importado.`
      );

      continue;
    }

    /*
     * --------------------------------------------------------
     * PASO 3: LEER EL ID DE LA COLUMNA G
     * --------------------------------------------------------
     *
     * G es el identificador del elemento.
     *
     * La columna N NO SE CONSULTA.
     */
    const equipmentId = text(
      row[EXCEL_COLUMNS.EQUIPMENT_ID]
    );

    if (!equipmentId) {
      unmatched += 1;

      warnings.push(
        `Fila ${excelRow}: tiene un estado válido "${rawStatus}" en O, pero la columna G (ID) está vacía. La fila no se ha podido asociar a un elemento del catálogo.`
      );

      continue;
    }

    /*
     * --------------------------------------------------------
     * PASO 4: BUSCAR EL ELEMENTO POR ID
     * --------------------------------------------------------
     */
    const catalogItem = catalogById.get(
      normalizeId(equipmentId)
    );

    if (!catalogItem) {
      unmatched += 1;

      warnings.push(
        `Fila ${excelRow}: tiene el ID "${equipmentId}" y el estado "${rawStatus}", pero no existe un elemento con ese ID en el catálogo. La fila no se ha importado.`
      );

      continue;
    }

    /*
     * --------------------------------------------------------
     * PASO 5: LEER LOS DATOS DE LA MISMA FILA
     * --------------------------------------------------------
     *
     * D = Instalación
     * E = Actuación
     * G = ID
     * H = Empresa
     * O = Estado
     * R = Comentario
     */
    const installation = text(
      row[EXCEL_COLUMNS.INSTALLATION]
    );

    const action = text(
      row[EXCEL_COLUMNS.ACTION]
    );

    const company = text(
      row[EXCEL_COLUMNS.COMPANY]
    );

    const comment = text(
      row[EXCEL_COLUMNS.COMMENT]
    );

    /*
     * La fecha general se mantiene como fecha principal.
     *
     * Si no existe, se intenta localizar una fecha en la
     * misma fila como respaldo.
     */
    const inspectionDate =
      reviewDate || excelDateToISO(row[9]);

    /*
     * --------------------------------------------------------
     * PASO 6: CREAR LA FILA IMPORTADA
     * --------------------------------------------------------
     */
    parsedRows.push({
      excelRow,

      /*
       * Se mantiene ordinal por compatibilidad con la interfaz
       * existente, pero YA NO procede de la columna N.
       *
       * Se utiliza el ordinal del propio catálogo si existe.
       */
      ordinal: Number(
        catalogItem?.ordinal ??
          catalogItem?.number ??
          catalogItem?.numero ??
          0
      ),

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
      "No se ha podido detectar una fecha general de revisión en la cabecera. Se utilizará la fecha de la fila cuando exista."
    );
  }

  if (catalogItems.length !== 84) {
    warnings.push(
      `El catálogo utilizado contiene ${catalogItems.length} actuaciones.`
    );
  }

  return {
    centerName: text(
      (detected.center as any).name
    ),

    centerCode: text(
      (detected.center as any).code
    ),

    centerId: String(
      (detected.center as any).id
    ),

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
  const [file, setFile] = useState<File | null>(
    null
  );

  const [parsed, setParsed] =
    useState<ParsedImport | null>(null);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const summary = useMemo(() => {
    if (!parsed) return null;

    const counts = {
      APTO: parsed.rows.filter(
        (r) => r.status === "APTO"
      ).length,

      "APTO CONDICIONADO": parsed.rows.filter(
        (r) =>
          r.status ===
          "APTO CONDICIONADO"
      ).length,

      "NO APTO": parsed.rows.filter(
        (r) => r.status === "NO APTO"
      ).length,

      PENDIENTE: parsed.rows.filter(
        (r) => r.status === "PENDIENTE"
      ).length,
    };

    const points =
      counts.APTO * 3 +
      counts["APTO CONDICIONADO"] * 2 +
      counts["NO APTO"];

    const max =
      parsed.rows.length * 3;

    const score = max
      ? Math.round(
          (points / max) * 100
        )
      : 0;

    return {
      counts,
      points,
      max,
      score,
    };
  }, [parsed]);

  async function handleFile(
    nextFile: File
  ) {
    setFile(nextFile);
    setParsed(null);
    setMessage("");
    setError("");
    setBusy(true);

    try {
      const buffer =
        await nextFile.arrayBuffer();

      const wb = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
      });

      const result =
        parseWorkbook(wb);

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

    const existing =
      state.reviews[key];

    const items: Record<
      string,
      ItemReview
    > = {};

    for (const row of parsed.rows) {
      const current =
        existing?.items?.[
          row.catalogItemId
        ] ?? blankItem();

      items[row.catalogItemId] = {
        ...current,

        status: row.status,

        date: row.inspectionDate,

        equipmentId:
          row.equipmentId,

        company:
          row.company,

        apto:
          row.status === "APTO",

        condicionado:
          row.status ===
          "APTO CONDICIONADO",

        noApto:
          row.status === "NO APTO",

        confirmed: false,

        confirmedAt:
          undefined,

        confirmedBy:
          undefined,
      };
    }

    const review: ReviewState = {
      ...(existing || {}),

      year: parsed.year,

      period: parsed.period,

      itemIds: parsed.rows.map(
        (row) =>
          row.catalogItemId
      ),

      confirmed: false,

      confirmedAt:
        undefined,

      confirmedBy:
        undefined,

      items,

      participants:
        existing?.participants ||
        [],
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
            Cabecera: E2 = Nombre del centro, E7 = Revisión y
            G7 = Año de revisión.
          </p>

          <p className="mt-2">
            Tabla: D = Instalación, E = Actuación, G = ID,
            H = Empresa, O = Estado y R = Comentario.
          </p>

          <p className="mt-2 font-semibold">
            La columna O (ESTADO) determina si una fila se
            importa. Si O está vacía, la fila se ignora
            completamente. La columna N no se utiliza.
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
                void handleFile(
                  selectedFile
                );
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
                {(file.size / 1024).toFixed(
                  1
                )}{" "}
                KB
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

              <p className="mt-1">
                {error}
              </p>
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
                  {parsed.centerName} ·{" "}
                  {parsed.period}{" "}
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
                  {
                    summary.counts[
                      "APTO CONDICIONADO"
                    ]
                  }
                </div>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="text-xs font-medium text-red-700">
                  NO APTO
                </div>

                <div className="mt-1 text-2xl font-bold text-red-800">
                  {
                    summary.counts[
                      "NO APTO"
                    ]
                  }
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-medium text-slate-600">
                  PENDIENTE
                </div>

                <div className="mt-1 text-2xl font-bold text-slate-800">
                  {
                    summary.counts[
                      "PENDIENTE"
                    ]
                  }
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
              <strong>
                Regla de importación:
              </strong>{" "}
              únicamente se importan filas cuyo estado en la
              columna O sea reconocido. Las filas con O vacía
              se ignoran completamente. La identificación del
              elemento se realiza mediante el ID de la columna G.
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
                    <th className="px-4 py-3">
                      Fila
                    </th>

                    <th className="px-4 py-3">
                      ID
                    </th>

                    <th className="px-4 py-3">
                      Instalación
                    </th>

                    <th className="px-4 py-3">
                      Actuación
                    </th>

                    <th className="px-4 py-3">
                      Empresa
                    </th>

                    <th className="px-4 py-3">
                      Estado
                    </th>

                    <th className="px-4 py-3">
                      Comentario
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {parsed.rows.map(
                    (row) => (
                      <tr
                        key={`${row.excelRow}-${row.catalogItemId}`}
                        className="hover:bg-slate-50"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                          {row.excelRow}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                          {row.equipmentId ||
                            "—"}
                        </td>

                        <td className="min-w-[220px] px-4 py-3 text-slate-800">
                          {row.installation ||
                            "—"}
                        </td>

                        <td className="min-w-[220px] px-4 py-3 text-slate-800">
                          {row.action ||
                            "—"}
                        </td>

                        <td className="min-w-[150px] px-4 py-3 text-slate-700">
                          {row.company ||
                            "—"}
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
                          {row.comment ||
                            "—"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {(parsed.excluded > 0 ||
            parsed.unmatched > 0 ||
            parsed.warnings.length >
              0) && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

                <div className="min-w-0">
                  <h2 className="font-semibold text-amber-900">
                    Observaciones de la importación
                  </h2>

                  <p className="mt-1 text-sm text-amber-800">
                    Las filas con O vacía se ignoran
                    silenciosamente. Las filas con un estado no
                    reconocido o sin correspondencia mediante el
                    ID de G aparecen aquí.
                  </p>

                  <div className="mt-4 space-y-2 text-sm text-amber-900">
                    {parsed.excluded >
                      0 && (
                      <p>
                        <strong>
                          Filas con estado no reconocido:
                        </strong>{" "}
                        {
                          parsed.excluded
                        }
                      </p>
                    )}

                    {parsed.unmatched >
                      0 && (
                      <p>
                        <strong>
                          Elementos sin correspondencia por ID:
                        </strong>{" "}
                        {
                          parsed.unmatched
                        }
                      </p>
                    )}

                    {parsed.warnings.map(
                      (
                        warning,
                        index
                      ) => (
                        <p
                          key={`${warning}-${index}`}
                          className="rounded-lg bg-white/60 p-2"
                        >
                          {warning}
                        </p>
                      )
                    )}
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
                Se guardarán{" "}
                {parsed.rows.length}{" "}
                elementos en la revisión histórica{" "}
                {parsed.period}{" "}
                {parsed.year}.
              </p>
            </div>

            <button
              type="button"
              onClick={
                confirmImport
              }
              disabled={
                parsed.rows.length ===
                0
              }
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

            <p className="mt-1">
              {message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
