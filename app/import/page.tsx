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
  code: string;
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
 * C = Código del elemento
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
 * REGLA DE IDENTIFICACIÓN:
 *
 *   1. O (ESTADO) determina si la fila se procesa.
 *   2. D (INSTALACION) es la primera referencia contra
 *      el catálogo.
 *   3. E (ACTUACION) es la segunda referencia contra
 *      el catálogo.
 *   4. C es el código que se importa y se muestra.
 *   5. G es el ID que se importa como dato.
 *
 * Cuando existen varias filas con el mismo:
 *
 *   C + D + E
 *
 * se consideran unidades diferentes del mismo elemento.
 *
 * Ejemplo:
 *
 *   1.1 + Ascens. + Montac. OCA
 *   1.1 + Ascens. + Montac. OCA
 *   1.1 + Ascens. + Montac. OCA
 *
 * se convierten en:
 *
 *   1.1.1
 *   1.1.2
 *   1.1.3
 *
 * manteniendo todos los datos correspondientes a cada fila.
 */

const EXCEL_COLUMNS = {
  CODE: 2, // C
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
 * E = índice 4
 * G = índice 6
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

/**
 * Normalización utilizada únicamente para comparar textos.
 *
 * Los valores originales del Excel NO se modifican.
 */
function normalize(value: unknown): string {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Obtiene un valor textual de un elemento del catálogo
 * probando diferentes nombres de propiedad.
 */
function catalogText(
  item: any,
  properties: string[]
): string {
  for (const property of properties) {
    const value = text(item?.[property]);

    if (value) {
      return value;
    }
  }

  return "";
}

/**
 * Convierte el valor de la columna O (ESTADO)
 * al estado utilizado por la aplicación.
 *
 * La columna N NO participa.
 */
function statusFromExcel(
  value: unknown
): V1Status | null {
  const status = normalize(value);

  if (!status) {
    return null;
  }

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
 * Lee la cabecera utilizando las celdas FIJAS:
 *
 * E2 = Nombre del centro
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
 * Busca todos los elementos del catálogo que coinciden con:
 *
 *   Excel D -> catálogo INSTALACION
 *   Excel E -> catálogo ACTUACION
 *
 * IMPORTANTE:
 *
 * No se utiliza G (ID).
 * No se utiliza N.
 * No se utiliza C para localizar el catálogo.
 *
 * El resultado conserva el orden del catálogo para poder
 * asignar las unidades duplicadas una a una.
 */
function findCatalogItems(
  catalogItems: any[],
  installation: string,
  action: string
): any[] {
  const normalizedInstallation =
    normalize(installation);

  const normalizedAction =
    normalize(action);

  if (
    !normalizedInstallation ||
    !normalizedAction
  ) {
    return [];
  }

  return catalogItems.filter(
    (item) => {
      const catalogInstallation =
        catalogText(item, [
          "installation",
          "instalacion",
          "INSTALACION",
          "install",
        ]);

      const catalogAction =
        catalogText(item, [
          "action",
          "actuacion",
          "ACTUACION",
          "actuation",
        ]);

      return (
        normalize(
          catalogInstallation
        ) === normalizedInstallation &&
        normalize(
          catalogAction
        ) === normalizedAction
      );
    }
  );
}

/**
 * Devuelve el ordinal interno del catálogo si existe.
 *
 * Nunca procede de la columna N del Excel.
 */
function getCatalogOrdinal(
  catalogItem: any
): number {
  const possibleValues = [
    catalogItem?.ordinal,
    catalogItem?.number,
    catalogItem?.numero,
  ];

  for (const value of possibleValues) {
    const number = Number(value);

    if (
      Number.isFinite(number) &&
      number > 0
    ) {
      return Math.trunc(number);
    }
  }

  return 0;
}

/**
 * Obtiene el código de actuación del catálogo.
 */
function getCatalogActionCode(
  catalogItem: any
): string {
  return catalogText(catalogItem, [
    "actionCode",
    "baseCode",
    "code",
  ]);
}

/**
 * Obtiene la categoría del catálogo.
 */
function getCatalogCategory(
  catalogItem: any
): string {
  return catalogText(catalogItem, [
    "category",
    "categoria",
    "CATEGORY",
  ]);
}

/**
 * Crea la clave utilizada para detectar unidades repetidas.
 *
 * La comparación se hace con:
 *
 *   C + D + E
 *
 * y no con G ni N.
 */
function duplicateGroupKey(
  code: string,
  installation: string,
  action: string
): string {
  return [
    normalize(code),
    normalize(installation),
    normalize(action),
  ].join("|");
}

/**
 * Genera el código de unidad.
 *
 * Si solamente existe una unidad:
 *
 *   1.1
 *
 * Si existen varias:
 *
 *   1.1.1
 *   1.1.2
 *   1.1.3
 *
 * Se añade el sufijo únicamente cuando hay más de una
 * fila con el mismo C + D + E.
 */
function buildUnitCode(
  baseCode: string,
  totalUnits: number,
  unitIndex: number
): string {
  const cleanCode =
    text(baseCode);

  if (
    totalUnits <= 1
  ) {
    return cleanCode;
  }

  return `${cleanCode}.${unitIndex}`;
}

function parseWorkbook(
  wb: XLSX.WorkBook
): ParsedImport {
  const sheetName =
    wb.SheetNames.includes("FICHA")
      ? "FICHA"
      : wb.SheetNames[0];

  if (!sheetName) {
    throw new Error(
      "El archivo no contiene ninguna hoja."
    );
  }

  const ws = wb.Sheets[sheetName];

  const rows =
    XLSX.utils.sheet_to_json(
      ws,
      {
        header: 1,
        defval: null,
        raw: true,
      }
    ) as any[][];

  const detected =
    detectCenter(rows);

  const normalizedReviewText =
    normalize(
      detected.reviewText
    );

  let period: Period;

  if (
    /\bs1\b/.test(
      normalizedReviewText
    ) ||
    normalizedReviewText.includes(
      "semestre 1"
    ) ||
    normalizedReviewText.includes(
      "1 semestre"
    )
  ) {
    period = "S1";
  } else if (
    /\bs2\b/.test(
      normalizedReviewText
    ) ||
    normalizedReviewText.includes(
      "semestre 2"
    ) ||
    normalizedReviewText.includes(
      "2 semestre"
    )
  ) {
    period = "S2";
  } else {
    throw new Error(
      `No se ha podido identificar si la revisión "${detected.reviewText}" corresponde a S1 o S2. La importación se ha detenido para evitar archivarla en un periodo incorrecto.`
    );
  }

  const country =
    (detected.center as any).country ===
    "Portugal"
      ? "Portugal"
      : "España";

  const catalog =
    country === "España"
      ? demo.esCatalog
      : demo.ptCatalog;

  const catalogItems =
    buildElementCodes(
      catalog as any[]
    ) as any[];

  const parsedRows: ImportRow[] =
    [];

  const warnings: string[] =
    [];

  let excluded = 0;
  let unmatched = 0;
  let multiple = 0;

  /*
   * ==========================================================
   * PRIMER PASO:
   *
   * Leemos las filas válidas y las agrupamos por:
   *
   * C + D + E
   *
   * antes de asignarlas al catálogo.
   *
   * Esto permite detectar correctamente las unidades repetidas.
   */
  type ValidExcelRow = {
    excelRow: number;
    code: string;
    installation: string;
    action: string;
    equipmentId: string;
    company: string;
    rawStatus: string;
    status: V1Status;
    comment: string;
  };

  const validRows: ValidExcelRow[] =
    [];

  for (
    let excelRow =
      FIRST_DATA_ROW;
    excelRow <=
    LAST_DATA_ROW;
    excelRow += 1
  ) {
    const row =
      rows[excelRow - 1] ||
      [];

    /*
     * O = ESTADO.
     *
     * Si está vacío, la fila se ignora completamente.
     */
    const rawStatus =
      text(
        row[
          EXCEL_COLUMNS.STATUS
        ]
      );

    if (!rawStatus) {
      continue;
    }

    /*
     * Estado no reconocido.
     */
    const status =
      statusFromExcel(
        rawStatus
      );

    if (!status) {
      excluded += 1;

      warnings.push(
        `Fila ${excelRow}: el valor de ESTADO de la columna O "${rawStatus}" no es un estado reconocido. La fila no se ha importado.`
      );

      continue;
    }

    /*
     * C = código.
     */
    const code =
      text(
        row[
          EXCEL_COLUMNS.CODE
        ]
      );

    /*
     * D = instalación.
     */
    const installation =
      text(
        row[
          EXCEL_COLUMNS.INSTALLATION
        ]
      );

    /*
     * E = actuación.
     */
    const action =
      text(
        row[
          EXCEL_COLUMNS.ACTION
        ]
      );

    if (!code) {
      unmatched += 1;

      warnings.push(
        `Fila ${excelRow}: tiene un estado válido "${rawStatus}", pero la columna C (código) está vacía. La fila no se ha importado.`
      );

      continue;
    }

    if (!installation) {
      unmatched += 1;

      warnings.push(
        `Fila ${excelRow}: tiene un estado válido "${rawStatus}", pero la columna D (INSTALACION) está vacía. No se ha podido identificar el elemento del catálogo.`
      );

      continue;
    }

    if (!action) {
      unmatched += 1;

      warnings.push(
        `Fila ${excelRow}: el código "${code}" y la INSTALACION "${installation}" son válidos, pero la columna E (ACTUACION) está vacía. No se ha podido identificar el elemento del catálogo.`
      );

      continue;
    }

    /*
     * G = ID.
     *
     * Se importa como dato.
     * NO se utiliza para localizar el catálogo.
     */
    const equipmentId =
      text(
        row[
          EXCEL_COLUMNS.EQUIPMENT_ID
        ]
      );

    /*
     * H = Empresa.
     */
    const company =
      text(
        row[
          EXCEL_COLUMNS.COMPANY
        ]
      );

    /*
     * R = Comentario.
     */
    const comment =
      text(
        row[
          EXCEL_COLUMNS.COMMENT
        ]
      );

    validRows.push({
      excelRow,
      code,
      installation,
      action,
      equipmentId,
      company,
      rawStatus,
      status,
      comment,
    });
  }

  /*
   * ==========================================================
   * SEGUNDO PASO:
   *
   * Agrupar las filas por C + D + E.
   *
   * Ejemplo:
   *
   * 1.1 | Ascens. | Montac. OCA
   * 1.1 | Ascens. | Montac. OCA
   * 1.1 | Ascens. | Montac. OCA
   *
   * -> mismo grupo con 3 unidades.
   */
  const groups =
    new Map<
      string,
      ValidExcelRow[]
    >();

  for (const row of validRows) {
    const key =
      duplicateGroupKey(
        row.code,
        row.installation,
        row.action
      );

    const group =
      groups.get(key);

    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  /*
   * ==========================================================
   * TERCER PASO:
   *
   * Procesar cada grupo y asociar sus unidades al catálogo.
   *
   * La búsqueda se hace por D + E.
   *
   * Si hay varias filas Excel y varias entradas de catálogo
   * con la misma D + E, se asignan en orden:
   *
   * Excel unidad 1 -> catálogo coincidencia 1
   * Excel unidad 2 -> catálogo coincidencia 2
   * Excel unidad 3 -> catálogo coincidencia 3
   */
  for (const group of groups.values()) {
    const firstRow =
      group[0];

    if (!firstRow) {
      continue;
    }

    const catalogMatches =
      findCatalogItems(
        catalogItems,
        firstRow.installation,
        firstRow.action
      );

    /*
     * No existe ningún elemento del catálogo con D + E.
     */
    if (
      catalogMatches.length === 0
    ) {
      unmatched +=
        group.length;

      warnings.push(
        `Código "${firstRow.code}": no existe en el catálogo una INSTALACION "${firstRow.installation}" con ACTUACION "${firstRow.action}". Se han omitido ${group.length} unidad${group.length === 1 ? "" : "es"}.`
      );

      continue;
    }

    /*
     * Hay más unidades en Excel que elementos equivalentes
     * en el catálogo.
     *
     * En este caso no debemos asociar una unidad al elemento
     * equivocado. Las unidades que no tengan correspondencia
     * quedan fuera.
     */
    if (
      group.length >
      catalogMatches.length
    ) {
      unmatched +=
        group.length -
        catalogMatches.length;

      warnings.push(
        `Código "${firstRow.code}": se han encontrado ${group.length} unidades en el Excel para INSTALACION "${firstRow.installation}" + ACTUACION "${firstRow.action}", pero solamente existen ${catalogMatches.length} elementos equivalentes en el catálogo. Se importarán las ${Math.min(group.length, catalogMatches.length)} primeras y se omitirán ${group.length - catalogMatches.length}.`
      );
    }

    /*
     * Si hay más elementos de catálogo que filas Excel,
     * solamente se importan las unidades que existen en Excel.
     */
    const unitsToImport =
      Math.min(
        group.length,
        catalogMatches.length
      );

    for (
      let unitIndex = 0;
      unitIndex <
      unitsToImport;
      unitIndex += 1
    ) {
      const excelData =
        group[unitIndex];

      const catalogItem =
        catalogMatches[
          unitIndex
        ];

      if (
        !excelData ||
        !catalogItem
      ) {
        continue;
      }

      /*
       * Código final:
       *
       * Una sola unidad:
       *   1.1
       *
       * Varias:
       *   1.1.1
       *   1.1.2
       *   1.1.3
       */
      const finalCode =
        buildUnitCode(
          excelData.code,
          group.length,
          unitIndex + 1
        );

      parsedRows.push({
        excelRow:
          excelData.excelRow,

        code:
          finalCode,

        ordinal:
          getCatalogOrdinal(
            catalogItem
          ),

        catalogItemId:
          String(
            catalogItem.id
          ),

        category:
          getCatalogCategory(
            catalogItem
          ),

        /*
         * D = Instalacion.
         */
        installation:
          excelData.installation,

        /*
         * E = Actuacion.
         */
        action:
          excelData.action,

        actionCode:
          getCatalogActionCode(
            catalogItem
          ),

        /*
         * G = ID.
         *
         * Solamente se importa como dato.
         */
        equipmentId:
          excelData.equipmentId,

        /*
         * H = Empresa.
         */
        company:
          excelData.company,

        /*
         * No se toma ninguna fecha de otras columnas.
         */
        inspectionDate:
          "",

        /*
         * O = Estado.
         */
        status:
          excelData.status,

        selected: [
          excelData.status,
        ],

        multiple:
          group.length > 1,

        /*
         * R = Comentario.
         */
        comment:
          excelData.comment,
      });
    }
  }

  /*
   * Ordenar las filas importadas según el orden del Excel.
   */
  parsedRows.sort(
    (a, b) =>
      a.excelRow -
      b.excelRow
  );

  return {
    centerName: text(
      (detected.center as any)
        .name
    ),

    centerCode: text(
      (detected.center as any)
        .code
    ),

    centerId: String(
      (detected.center as any)
        .id
    ),

    country,

    year:
      detected.year,

    reviewText:
      detected.reviewText,

    period,

    reviewDate:
      "",

    rows:
      parsedRows,

    excluded,

    multiple,

    unmatched,

    warnings,
  };
}

function statusClasses(
  status: V1Status
) {
  if (
    status === "APTO"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    status ===
    "APTO CONDICIONADO"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (
    status ===
    "NO APTO"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (
    status ===
    "PENDIENTE"
  ) {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function ImportPage() {
  const [file, setFile] =
    useState<File | null>(null);

  const [parsed, setParsed] =
    useState<ParsedImport | null>(
      null
    );

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const summary = useMemo(() => {
    if (!parsed) {
      return null;
    }

    const counts = {
      APTO:
        parsed.rows.filter(
          (r) =>
            r.status ===
            "APTO"
        ).length,

      "APTO CONDICIONADO":
        parsed.rows.filter(
          (r) =>
            r.status ===
            "APTO CONDICIONADO"
        ).length,

      "NO APTO":
        parsed.rows.filter(
          (r) =>
            r.status ===
            "NO APTO"
        ).length,

      PENDIENTE:
        parsed.rows.filter(
          (r) =>
            r.status ===
            "PENDIENTE"
        ).length,
    };

    const points =
      counts.APTO * 3 +
      counts[
        "APTO CONDICIONADO"
      ] *
        2 +
      counts[
        "NO APTO"
      ];

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

      const wb =
        XLSX.read(
          buffer,
          {
            type: "array",
            cellDates: true,
          }
        );

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
    if (
      !parsed ||
      !summary
    ) {
      return;
    }

    setError("");
    setMessage("");

    const state =
      loadState();

    const key =
      reviewKey(
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
        ] ??
        blankItem();

      items[
        row.catalogItemId
      ] = {
        ...current,

        status:
          row.status,

        date:
          row.inspectionDate,

        equipmentId:
          row.equipmentId,

        company:
          row.company,

        apto:
          row.status ===
          "APTO",

        condicionado:
          row.status ===
          "APTO CONDICIONADO",

        noApto:
          row.status ===
          "NO APTO",

        confirmed:
          false,

        confirmedAt:
          undefined,

        confirmedBy:
          undefined,
      };
    }

    const review:
      ReviewState = {
      ...(existing || {}),

      year:
        parsed.year,

      period:
        parsed.period,

      itemIds:
        parsed.rows.map(
          (row) =>
            row.catalogItemId
        ),

      confirmed:
        false,

      confirmedAt:
        undefined,

      confirmedBy:
        undefined,

      items,

      participants:
        existing?.participants ||
        [],
    };

    const nextState:
      V1State = {
      ...state,

      reviews: {
        ...state.reviews,

        [key]: review,
      },
    };

    saveState(
      nextState
    );

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
              Importa una revisión histórica desde la plantilla corporativa Excel.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-medium">
            Estructura utilizada por el importador
          </p>

          <p className="mt-1">
            Cabecera: E2 = Nombre del centro, E7 = Revisión y G7 = Año de revisión.
          </p>

          <p className="mt-2">
            Tabla: C = Código, D = Instalación, E = Actuación,
            G = ID, H = Empresa, O = Estado y R = Comentario.
          </p>

          <p className="mt-2 font-semibold">
            La columna O (ESTADO) determina si una fila se importa.
            Si O está vacía, la fila se ignora completamente.
          </p>

          <p className="mt-2 font-semibold">
            La identificación del elemento se realiza comparando
            D (INSTALACION) y E (ACTUACION) con el catálogo.
          </p>

          <p className="mt-2 font-semibold">
            Si existen varias unidades con el mismo código C,
            INSTALACION D y ACTUACION E, se generan códigos
            1.1.1, 1.1.2, 1.1.3, etc., manteniendo los datos
            de cada fila.
          </p>

          <p className="mt-2 font-semibold">
            G (ID) se importa como dato. La columna N no se utiliza.
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

      {parsed &&
        summary && (
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

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
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
                    {
                      summary.counts
                        .APTO
                    }
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
                    {
                      parsed.unmatched
                    }
                  </div>
                </div>

                <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                  <div className="text-xs font-medium text-purple-700">
                    Coincidencias múltiples
                  </div>

                  <div className="mt-1 text-2xl font-bold text-purple-800">
                    {
                      parsed.multiple
                    }
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <strong>
                  Regla de importación:
                </strong>{" "}
                únicamente se procesan filas cuyo estado de la
                columna O sea reconocido. Las filas con O vacía
                se ignoran completamente. El elemento del catálogo
                se identifica mediante INSTALACION D + ACTUACION E.
                El código C se conserva como referencia y, cuando
                existen varias unidades iguales, se amplía con
                .1, .2, .3, etc. G solamente aporta el ID de esa
                fila y N se ignora.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Elementos detectados
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Cada línea mantiene los datos correspondientes a
                  su propia fila del Excel.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">
                        Código
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
                          key={`${row.catalogItemId}-${row.excelRow}`}
                          className="hover:bg-slate-50"
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                            {row.code ||
                              "—"}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
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
                              {
                                row.status
                              }
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

            {(parsed.excluded >
              0 ||
              parsed.unmatched >
                0 ||
              parsed.multiple >
                0 ||
              parsed.warnings
                .length >
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
                      silenciosamente. Las filas con estado no
                      reconocido o sin correspondencia mediante
                      D + E aparecen aquí.
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
                            Elementos sin correspondencia mediante D + E:
                          </strong>{" "}
                          {
                            parsed.unmatched
                          }
                        </p>
                      )}

                      {parsed.multiple >
                        0 && (
                        <p>
                          <strong>
                            Grupos con varias unidades:
                          </strong>{" "}
                          {
                            parsed.multiple
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
                            {
                              warning
                            }
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
                  {
                    parsed.rows
                      .length
                  }{" "}
                  elementos en la revisión histórica{" "}
                  {
                    parsed.period
                  }{" "}
                  {
                    parsed.year
                  }.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  confirmImport
                }
                disabled={
                  parsed.rows
                    .length ===
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
