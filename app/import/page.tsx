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
 *   4. C es el código base que se importa.
 *   5. G es el ID que se importa como dato.
 *
 * REGLA PARA ELEMENTOS REPETIDOS:
 *
 * Cuando existen varias filas VÁLIDAS con el mismo:
 *
 *   D + E
 *
 * se consideran unidades diferentes del mismo elemento.
 *
 * El código base NO se obtiene de cada fila.
 *
 * Se toma SIEMPRE el código C de la PRIMERA FILA VÁLIDA
 * del grupo.
 *
 * Ejemplo:
 *
 *   Fila 12: C=1.1 | D=Ascens. y montac. | E=OCA..
 *   Fila 13: C=1.1 | D=Ascens. y montac. | E=OCA..
 *   Fila 14: C=1.1 | D=Ascens. y montac. | E=OCA..
 *
 * se convierten en:
 *
 *   1.1.1
 *   1.1.2
 *   1.1.3
 *
 * aunque las filas posteriores tengan C vacío,
 * otro valor o estén combinadas en Excel.
 *
 * Cada línea conserva los datos de SU PROPIA FILA:
 *
 *   G -> ID
 *   H -> Empresa
 *   O -> Estado
 *   R -> Comentario
 *
 * Las filas con O vacía se ignoran completamente.
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
 * No se utiliza C para localizar el catálogo.
 * No se utiliza G (ID).
 * No se utiliza N.
 *
 * El resultado conserva el orden del catálogo para poder
 * asignar las unidades repetidas una a una.
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
 * Obtiene el ID real del elemento del catálogo.
 */
function getCatalogItemId(
  catalogItem: any
): string {
  return text(
    catalogItem?.id ??
      catalogItem?.elementId ??
      catalogItem?.itemId
  );
}

/**
 * Crea la clave para detectar elementos repetidos.
 *
 * IMPORTANTE:
 *
 * El código C NO forma parte de esta clave.
 *
 * Dos filas se consideran unidades repetidas cuando
 * coinciden en:
 *
 *   D = INSTALACION
 *   E = ACTUACION
 *
 * Esto permite manejar correctamente el caso en el que
 * Excel presenta un código combinado o solamente muestra
 * el código C en la primera fila del grupo.
 */
function duplicateGroupKey(
  installation: string,
  action: string
): string {
  return [
    normalize(installation),
    normalize(action),
  ].join("|");
}

/**
 * Genera el código final de una unidad.
 *
 * Una sola unidad:
 *
 *   1.1
 *
 * Varias unidades:
 *
 *   1.1.1
 *   1.1.2
 *   1.1.3
 *
 * El código base procede SIEMPRE de la primera fila válida
 * del grupo D + E.
 */
function buildUnitCode(
  baseCode: string,
  totalUnits: number,
  unitIndex: number
): string {
  const cleanCode =
    text(baseCode).replace(/\.+$/, "");

  if (
    totalUnits <= 1
  ) {
    return cleanCode;
  }

  if (!cleanCode) {
    return "";
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
   * Leer únicamente las filas cuyo O (ESTADO) tenga contenido
   * y cuyo estado sea reconocido.
   *
   * Las filas con O vacía se ignoran completamente.
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
     *
     * IMPORTANTE:
     *
     * Este código solamente se utiliza para obtener el
     * código base de la PRIMERA FILA VÁLIDA de cada grupo D + E.
     *
     * No se utiliza para decidir si dos filas son repetidas.
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
        `Fila ${excelRow}: la INSTALACION "${installation}" es válida, pero la columna E (ACTUACION) está vacía. No se ha podido identificar el elemento del catálogo.`
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
   * Agrupar las filas VÁLIDAS exclusivamente por:
   *
   *   D + E
   *
   * NO por C + D + E.
   *
   * Esto es fundamental porque en Excel el código de C puede
   * estar combinado y aparecer únicamente en la primera fila
   * de varias unidades.
   *
   * Ejemplo:
   *
   * Fila 12:
   *   C=1.1
   *   D=Ascens. y montac.
   *   E=OCA..
   *
   * Fila 13:
   *   C=
   *   D=Ascens. y montac.
   *   E=OCA..
   *
   * Fila 14:
   *   C=
   *   D=Ascens. y montac.
   *   E=OCA..
   *
   * Todas forman UN ÚNICO GRUPO.
   */
  const groups =
    new Map<
      string,
      ValidExcelRow[]
    >();

  for (const row of validRows) {
    const key =
      duplicateGroupKey(
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
   * Reservar los elementos de catálogo en orden.
   *
   * Esto evita reutilizar el mismo elemento del catálogo
   * cuando existen varias filas Excel correspondientes a
   * diferentes elementos catalogados con el mismo D + E.
   */
  const catalogUsage =
    new Map<string, number>();

  /*
   * ==========================================================
   * CUARTO PASO:
   *
   * Procesar cada grupo D + E.
   */
  for (const group of groups.values()) {
    const firstRow =
      group[0];

    if (!firstRow) {
      continue;
    }

    /*
     * ========================================================
     * EL CÓDIGO BASE SE TOMA SIEMPRE DE LA PRIMERA FILA
     * VÁLIDA DEL GRUPO.
     *
     * Las filas siguientes pueden tener C vacío porque
     * el Excel tiene la celda combinada.
     */
    const baseCode =
      text(firstRow.code);

    if (!baseCode) {
      warnings.push(
        `Filas ${group[0]?.excelRow ?? ""}${group.length > 1 ? `-${group[group.length - 1]?.excelRow ?? ""}` : ""}: el grupo INSTALACION "${firstRow.installation}" + ACTUACION "${firstRow.action}" tiene estado válido, pero la primera fila no contiene código en C. Se importarán las unidades si existe correspondencia en el catálogo, pero no se podrá generar un código numérico.`
      );
    }

    /*
     * Si hay varias filas D + E, son unidades múltiples.
     *
     * Aquí contamos GRUPOS, no filas.
     */
    if (group.length > 1) {
      multiple += 1;
    }

    /*
     * Buscar el catálogo utilizando exclusivamente D + E.
     */
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
        `Código base "${baseCode || "sin código"}": no existe en el catálogo una INSTALACION "${firstRow.installation}" con ACTUACION "${firstRow.action}". Se han omitido ${group.length} unidad${group.length === 1 ? "" : "es"}.`
      );

      continue;
    }

    /*
     * Posición que ya hemos consumido para este D + E.
     *
     * Si anteriormente ya se importó otro grupo con el mismo
     * D + E, no volvemos a utilizar el primer elemento del
     * catálogo.
     */
    const catalogKey =
      duplicateGroupKey(
        firstRow.installation,
        firstRow.action
      );

    const alreadyUsed =
      catalogUsage.get(
        catalogKey
      ) ?? 0;

    const remainingCatalogMatches =
      catalogMatches.slice(
        alreadyUsed
      );

    /*
     * No quedan elementos disponibles del catálogo.
     */
    if (
      remainingCatalogMatches.length === 0
    ) {
      unmatched +=
        group.length;

      warnings.push(
        `Código base "${baseCode || "sin código"}": las unidades del grupo INSTALACION "${firstRow.installation}" + ACTUACION "${firstRow.action}" ya no tienen elementos disponibles equivalentes en el catálogo. Se han omitido ${group.length} unidad${group.length === 1 ? "" : "es"}.`
      );

      continue;
    }

    /*
     * Si hay más unidades Excel que elementos disponibles
     * en catálogo, las unidades restantes no se asignan
     * arbitrariamente a otro elemento.
     */
    if (
      group.length >
      remainingCatalogMatches.length
    ) {
      const omitted =
        group.length -
        remainingCatalogMatches.length;

      unmatched +=
        omitted;

      warnings.push(
        `Código base "${baseCode || "sin código"}": se han encontrado ${group.length} unidades para INSTALACION "${firstRow.installation}" + ACTUACION "${firstRow.action}", pero solamente quedan ${remainingCatalogMatches.length} elementos equivalentes disponibles en el catálogo. Se importarán ${remainingCatalogMatches.length} y se omitirán ${omitted}.`
      );
    }

    const unitsToImport =
      Math.min(
        group.length,
        remainingCatalogMatches.length
      );

    /*
     * Marcar como consumidos los elementos del catálogo
     * realmente utilizados.
     */
    catalogUsage.set(
      catalogKey,
      alreadyUsed +
        unitsToImport
    );

    /*
     * ========================================================
     * GENERAR LAS UNIDADES.
     *
     * El código base procede de firstRow.code.
     *
     * Para tres filas:
     *
     *   1.1.1
     *   1.1.2
     *   1.1.3
     *
     * Pero G, H, O y R proceden de cada fila individual.
     */
    for (
      let unitIndex = 0;
      unitIndex <
      unitsToImport;
      unitIndex += 1
    ) {
      const excelData =
        group[unitIndex];

      const catalogItem =
        remainingCatalogMatches[
          unitIndex
        ];

      if (
        !excelData ||
        !catalogItem
      ) {
        continue;
      }

      const catalogItemId =
        getCatalogItemId(
          catalogItem
        );

      /*
       * Un elemento sin ID real de catálogo no se puede
       * guardar correctamente en ReviewState.
       */
      if (!catalogItemId) {
        unmatched += 1;

        warnings.push(
          `Fila ${excelData.excelRow}: la coincidencia mediante D + E existe, pero el elemento del catálogo no tiene un ID válido. La fila no se ha importado.`
        );

        continue;
      }

      /*
       * Código final:
       *
       * Una sola unidad:
       *   1.1
       *
       * Varias unidades:
       *   1.1.1
       *   1.1.2
       *   1.1.3
       *
       * IMPORTANTE:
       *
       * Se utiliza baseCode, que procede de la PRIMERA
       * fila válida del grupo, no excelData.code.
       */
      const finalCode =
        buildUnitCode(
          baseCode,
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

        catalogItemId,

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

        /*
         * No existe una fecha específica importada desde
         * las columnas definidas del Excel.
         *
         * Si ya había fecha en el registro, se conserva.
         */
        date:
          row.inspectionDate ||
          current.date,

        /*
         * G = ID.
         */
        equipmentId:
          row.equipmentId ||
          current.equipmentId,

        /*
         * H = Empresa.
         */
        company:
          row.company ||
          current.company,

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
        Array.from(
          new Set(
            parsed.rows.map(
              (row) =>
                row.catalogItemId
            )
          )
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
            Cuando varias filas válidas tienen la misma
            INSTALACION D y ACTUACION E, todas se consideran
            unidades del mismo elemento. El código base se toma
            de la primera fila válida del grupo y se generan
            1.1.1, 1.1.2, 1.1.3, etc.
          </p>

          <p className="mt-2 font-semibold">
            G (ID) se importa como dato de cada fila.
            La columna N no se utiliza.
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
                    Grupos múltiples
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
                Cuando existen varias filas con el mismo D + E,
                el código base se toma de la primera fila válida
                del grupo y se generan códigos .1, .2, .3, etc.
                G solamente aporta el ID de cada fila y N se ignora.
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
