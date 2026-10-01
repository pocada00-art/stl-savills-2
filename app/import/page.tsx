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

type ExcelLayout = {
  name: "2025" | "2026";
  columns: {
    CODE: number;
    INSTALLATION: number;
    ACTION: number;
    EQUIPMENT_ID: number;
    COMPANY: number;
    STATUS: number;
    COMMENT: number;
  };
  header: {
    CENTER_NAME: { row: number; column: number };
    REVIEW: { row: number; column: number };
    YEAR: { row: number; column: number };
    REVIEW_DATE?: { row: number; column: number };
  };
};

const EXCEL_LAYOUT_2025: ExcelLayout = {
  name: "2025",
  columns: {
    CODE: 2, // C
    INSTALLATION: 3, // D
    ACTION: 4, // E
    EQUIPMENT_ID: 6, // G
    COMPANY: 7, // H
    STATUS: 14, // O
    COMMENT: 17, // R
  },
  header: {
    CENTER_NAME: { row: 2, column: 4 }, // E2
    REVIEW: { row: 7, column: 4 }, // E7
    YEAR: { row: 7, column: 6 }, // G7
  },
};

const EXCEL_LAYOUT_2026: ExcelLayout = {
  name: "2026",
  columns: {
    CODE: 3, // D
    INSTALLATION: 2, // C
    ACTION: 4, // E
    EQUIPMENT_ID: 7, // H
    COMPANY: 8, // I
    STATUS: 15, // P
    COMMENT: 18, // S
  },
  header: {
    CENTER_NAME: { row: 2, column: 5 }, // F2
    REVIEW: { row: 7, column: 5 }, // F7
    YEAR: { row: 7, column: 7 }, // H7
    REVIEW_DATE: { row: 6, column: 5 }, // F6
  },
};

const FIRST_DATA_ROW = 12;
const LAST_DATA_ROW = 200;

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
function statusFromExcel(value: unknown): V1Status | null {
  const status = normalize(value)
    .replace(/[.:;,\-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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
    status === "apto condicionado"
  ) {
    return "APTO CONDICIONADO";
  }

  if (
    status === "pte" ||
    status === "pendiente"
  ) {
    return "PENDIENTE";
  }

  if (
    status === "sin informacion" ||
    status === "error"
  ) {
    return "SIN INFORMACIÓN";
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
function detectExcelLayout(rows: any[][]): ExcelLayout {
  const center2026 = text(rows[1]?.[EXCEL_LAYOUT_2026.header.CENTER_NAME.column]);
  const review2026 = text(rows[6]?.[EXCEL_LAYOUT_2026.header.REVIEW.column]);
  const year2026 = text(rows[6]?.[EXCEL_LAYOUT_2026.header.YEAR.column]);

  /*
   * La plantilla 2026 utiliza:
   * F2 = centro, F7 = tipo de revisión, H7 = año.
   *
   * No dependemos únicamente de que H7 tenga valor: también exigimos
   * que F2 y F7 estén informados para evitar interpretar por error
   * una plantilla 2025 como 2026.
   */
  if (center2026 && review2026 && /20\d{2}/.test(year2026)) {
    return EXCEL_LAYOUT_2026;
  }

  return EXCEL_LAYOUT_2025;
}

function detectCenter(rows: any[][], layout: ExcelLayout) {
  const centerName = text(
    rows[layout.header.CENTER_NAME.row - 1]?.[
      layout.header.CENTER_NAME.column
    ]
  );

  const reviewText = text(
    rows[layout.header.REVIEW.row - 1]?.[
      layout.header.REVIEW.column
    ]
  );

  const rawYear =
    rows[layout.header.YEAR.row - 1]?.[
      layout.header.YEAR.column
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
      `No se ha encontrado el nombre del centro en la celda ${
        layout.name === "2026" ? "F2" : "E2"
      } del documento Excel.`
    );
  }

  if (!reviewText) {
    throw new Error(
      `No se ha encontrado la revisión en la celda ${
        layout.name === "2026" ? "F7" : "E7"
      } del documento Excel.`
    );
  }

  if (!year) {
    throw new Error(
      `No se ha podido identificar el año de la revisión en la celda ${
        layout.name === "2026" ? "H7" : "G7"
      } del documento Excel. La importación se ha detenido para evitar archivarla en un año incorrecto.`
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

  let reviewDate = "";

  if (layout.header.REVIEW_DATE) {
    const rawReviewDate =
      rows[layout.header.REVIEW_DATE.row - 1]?.[
        layout.header.REVIEW_DATE.column
      ];

    if (rawReviewDate instanceof Date && !Number.isNaN(rawReviewDate.getTime())) {
      reviewDate = rawReviewDate.toISOString().slice(0, 10);
    } else {
      const dateText = text(rawReviewDate);
      if (dateText) {
        reviewDate = dateText;
      }
    }
  }

  return {
    name: centerName,
    code: text((center as any).code),
    center: center as any,
    year,
    reviewText,
    reviewDate,
    layout,
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
function compactNormalize(value: unknown): string {
  return normalize(value).replace(/[^a-z0-9]+/g, "");
}

function codeVariants(value: unknown): string[] {
  const raw = text(value).replace(/\s+/g, "");
  if (!raw) return [];

  const variants = new Set<string>();
  variants.add(raw);
  variants.add(raw.replace(/\.+$/, ""));

  const withoutUnit = raw.replace(/\.\d+$/, "");
  variants.add(withoutUnit);

  return Array.from(variants).filter(Boolean);
}

function catalogCodeMatches(
  excelCode: string,
  catalogItem: any
): boolean {
  const excelVariants = codeVariants(excelCode);
  if (!excelVariants.length) return false;

  const catalogValues = [
    catalogItem?.actionCode,
    catalogItem?.baseCode,
    catalogItem?.code,
  ];

  const catalogVariants = catalogValues.flatMap(codeVariants);

  return excelVariants.some((value) =>
    catalogVariants.includes(value)
  );
}

function findCatalogItems(
  catalogItems: any[],
  installation: string,
  action: string,
  excelCode = ""
): any[] {
  const normalizedInstallation =
    compactNormalize(installation);

  const normalizedAction =
    compactNormalize(action);

  if (!normalizedInstallation) {
    return [];
  }

  const byInstallation = catalogItems.filter((item) => {
    const catalogInstallation = catalogText(item, [
      "installation",
      "instalacion",
      "INSTALACION",
      "install",
      "installationName",
      "nombreInstalacion",
    ]);

    return compactNormalize(catalogInstallation) === normalizedInstallation;
  });

  if (!byInstallation.length) {
    return [];
  }

  if (normalizedAction) {
    const exactAction = byInstallation.filter((item) => {
      const catalogAction = catalogText(item, [
        "action",
        "actuacion",
        "ACTUACION",
        "actuation",
        "actionName",
        "nombreActuacion",
      ]);

      return compactNormalize(catalogAction) === normalizedAction;
    });

    if (exactAction.length) {
      return exactAction;
    }
  }

  /*
   * Plantillas históricas como OASIZ 2024 tienen ACTUACION vacía.
   * En ese caso el código C pasa a ser el segundo identificador.
   */
  if (excelCode) {
    return byInstallation.filter((item) =>
      catalogCodeMatches(excelCode, item)
    );
  }

  return [];
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
  action: string,
  code = ""
): string {
  const normalizedInstallation = compactNormalize(installation);
  const normalizedAction = compactNormalize(action);

  if (normalizedAction) {
    return `${normalizedInstallation}|${normalizedAction}`;
  }

  return `${normalizedInstallation}|__SIN_ACTUACION__|${codeVariants(code)[0] || ""}`;
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

  const layout = detectExcelLayout(rows);

  const detected =
    detectCenter(rows, layout);

  const columns = detected.layout.columns;

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
   * PRIMER PASO: leer las filas con ESTADO reconocido.
   *
   * El código Excel es OPCIONAL. Nunca se descarta una fila válida
   * por no tener C: si D + E coinciden con el catálogo, el código
   * se obtiene del catálogo. En plantillas antiguas donde E está
   * vacío, se utiliza D + C como identificación de respaldo.
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

  const validRows: ValidExcelRow[] = [];
  let mergedInstallation = "";

  for (
    let excelRow = FIRST_DATA_ROW;
    excelRow <= LAST_DATA_ROW;
    excelRow += 1
  ) {
    const row = rows[excelRow - 1] || [];

    const rawStatus = text(row[columns.STATUS]);

    const rawInstallation = text(row[columns.INSTALLATION]);

    if (rawInstallation) {
      mergedInstallation = rawInstallation;
    }

    if (!rawStatus) {
      continue;
    }

    const status = statusFromExcel(rawStatus);

    if (!status) {
      excluded += 1;
      warnings.push(
        `Fila ${excelRow}: el valor de ESTADO de la columna O "${rawStatus}" no es un estado reconocido. La fila no se ha importado.`
      );
      continue;
    }

    const code = text(row[columns.CODE]);
    const installation = rawInstallation || mergedInstallation;
    const action = text(row[columns.ACTION]);

    if (!installation) {
      unmatched += 1;
      warnings.push(
        `Fila ${excelRow}: tiene un estado válido "${rawStatus}", pero la columna D (INSTALACION) está vacía. No se ha podido identificar el elemento del catálogo.`
      );
      continue;
    }

    /*
     * ACTUACION puede estar vacía en las plantillas históricas.
     * Solo se rechaza la fila si además no existe código de respaldo.
     */
    if (!action && !code) {
      unmatched += 1;
      warnings.push(
        `Fila ${excelRow}: la INSTALACION "${installation}" tiene un estado válido, pero no dispone ni de ACTUACION ni de código C para identificar el elemento del catálogo.`
      );
      continue;
    }

    validRows.push({
      excelRow,
      code,
      installation,
      action,
      equipmentId: text(row[columns.EQUIPMENT_ID]),
      company: text(row[columns.COMPANY]),
      rawStatus,
      status,
      comment: text(row[columns.COMMENT]),
    });
  }

  /*
   * ==========================================================
   * SEGUNDO PASO: agrupar.
   *
   * Con ACTUACION se agrupa por D + E.
   * Sin ACTUACION (caso histórico) se agrupa por D + C.
   */
  const groups = new Map<string, ValidExcelRow[]>();

  for (const row of validRows) {
    const key = duplicateGroupKey(
      row.installation,
      row.action,
      row.code
    );

    const group = groups.get(key);
    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  /*
   * El catálogo puede contener varias entradas con la misma
   * combinación D + E. Las vamos consumiendo en orden para no
   * reutilizar el mismo ID de catálogo en varias filas.
   */
  const catalogUsage = new Map<string, number>();

  for (const group of groups.values()) {
    const firstRow = group[0];
    if (!firstRow) continue;

    if (group.length > 1) {
      multiple += 1;
    }

    const catalogMatches = findCatalogItems(
      catalogItems,
      firstRow.installation,
      firstRow.action,
      firstRow.code
    );

    if (catalogMatches.length === 0) {
      unmatched += group.length;
      warnings.push(
        `Filas ${group.map((row) => row.excelRow).join(", ")}: no existe en el catálogo una correspondencia para INSTALACION "${firstRow.installation}"${firstRow.action ? ` + ACTUACION "${firstRow.action}"` : ` + código "${firstRow.code}"`}. Se han omitido ${group.length} unidad${group.length === 1 ? "" : "es"}.`
      );
      continue;
    }

    const catalogKey = duplicateGroupKey(
      firstRow.installation,
      firstRow.action,
      firstRow.code
    );

    const alreadyUsed = catalogUsage.get(catalogKey) ?? 0;
    const remainingCatalogMatches = catalogMatches.slice(alreadyUsed);

    if (remainingCatalogMatches.length === 0) {
      unmatched += group.length;
      warnings.push(
        `Filas ${group.map((row) => row.excelRow).join(", ")}: los elementos equivalentes del catálogo ya han sido utilizados anteriormente. Se han omitido ${group.length} unidad${group.length === 1 ? "" : "es"}.`
      );
      continue;
    }

    const unitsToImport = Math.min(
      group.length,
      remainingCatalogMatches.length
    );

    if (group.length > remainingCatalogMatches.length) {
      const omitted = group.length - remainingCatalogMatches.length;
      unmatched += omitted;
      warnings.push(
        `Filas ${group.map((row) => row.excelRow).join(", ")}: hay ${group.length} unidades pero solo ${remainingCatalogMatches.length} elementos equivalentes disponibles en el catálogo. Se importarán ${unitsToImport} y se omitirán ${omitted}.`
      );
    }

    catalogUsage.set(
      catalogKey,
      alreadyUsed + unitsToImport
    );

    /*
     * El código base tiene esta prioridad:
     * 1) primer C válido del grupo;
     * 2) actionCode del primer elemento del catálogo;
     * 3) baseCode del catálogo;
     * 4) code del catálogo.
     *
     * Por tanto, la ausencia de C ya NO bloquea la importación.
     */
    const firstCatalogItem = remainingCatalogMatches[0];
    const baseCode =
      group.find((row) => text(row.code))?.code ||
      getCatalogActionCode(firstCatalogItem) ||
      catalogText(firstCatalogItem, [
        "baseCode",
        "code",
      ]);

    for (
      let unitIndex = 0;
      unitIndex < unitsToImport;
      unitIndex += 1
    ) {
      const excelData = group[unitIndex];
      const catalogItem = remainingCatalogMatches[unitIndex];

      if (!excelData || !catalogItem) continue;

      const catalogItemId = getCatalogItemId(catalogItem);

      if (!catalogItemId) {
        unmatched += 1;
        warnings.push(
          `Fila ${excelData.excelRow}: la coincidencia mediante catálogo existe, pero el elemento del catálogo no tiene un ID válido. La fila no se ha importado.`
        );
        continue;
      }

      const finalCode = buildUnitCode(
        baseCode,
        group.length,
        unitIndex + 1
      );

      parsedRows.push({
        excelRow: excelData.excelRow,
        code: finalCode,
        ordinal: getCatalogOrdinal(catalogItem),
        catalogItemId,
        category: getCatalogCategory(catalogItem),
        installation: excelData.installation,
        action: excelData.action || catalogText(catalogItem, [
          "action",
          "actuacion",
          "ACTUACION",
        ]),
        actionCode: getCatalogActionCode(catalogItem),
        equipmentId: excelData.equipmentId,
        company: excelData.company,
        inspectionDate: detected.reviewDate,
        status: excelData.status,
        selected: [excelData.status],
        multiple: group.length > 1,
        comment: excelData.comment,
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
      detected.reviewDate,

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
            2025: E2 = Nombre del centro, E7 = Revisión y G7 = Año. 2026: F2 = Centro, F7 = Tipo y H7 = Año.
          </p>

          <p className="mt-2">
            2025: C = Código, D = Instalación, E = Actuación, G = ID, H = Empresa, O = Estado y R = Comentario. 2026: D = Código, C = Instalación, E = Actuación, H = ID, I = Empresa, P = Estado y S = Comentario.
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
