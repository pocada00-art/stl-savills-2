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

type ExcelColumnMap = {
  headerRow: number;
  code: number;
  installation: number;
  action: number;
  equipmentId: number;
  company: number;
  status: number;
  comment: number;
};

/**
 * El formato visual de las plantillas STL ha cambiado entre años.
 * Por ello NO se utilizan posiciones fijas de columnas.
 *
 * El importador localiza primero la fila de encabezados mediante
 * sus textos y después determina las columnas de datos a partir
 * de esos encabezados y de la estructura inmediatamente adyacente.
 */
const HEADER_SCAN_ROWS = 80;
const MAX_DATA_ROWS = 1000;

function text(value: unknown): string { 
  return String(value ?? "").trim(); 
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedHeader(value: unknown): string {
  return normalize(value)
    .replace(/[ªº.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headerMatches(
  value: unknown,
  aliases: string[]
): boolean {
  const current = normalizedHeader(value);

  if (!current) {
    return false;
  }

  return aliases.some(
    (alias) =>
      current === normalizedHeader(alias) ||
      current.includes(normalizedHeader(alias))
  );
}

const HEADER_ALIASES = {
  INSTALLATION: [
    "instalacion",
    "instalación",
  ],
  ACTION: [
    "actuacion",
    "actuación",
    "accion",
    "acción",
  ],
  EQUIPMENT_ID: [
    "id",
    "id equipo",
    "identificador",
  ],
  COMPANY: [
    "empresa",
    "mantenedora",
  ],
  STATUS: [
    "estado",
    "status",
  ],
  COMMENT: [
    "comentario",
    "comentarios",
    "observaciones",
    "observacion",
    "observación",
  ],
  CODE: [
    "codigo",
    "código",
    "codigo elemento",
    "código elemento",
  ],
} as const;

function findHeaderColumn(
  row: any[],
  aliases: string[],
  exact = false
): number {
  for (let column = 0; column < row.length; column += 1) {
    const current = normalizedHeader(row[column]);

    if (!current) {
      continue;
    }

    const matches = aliases.some((alias) => {
      const normalizedAlias = normalizedHeader(alias);

      return exact
        ? current === normalizedAlias
        : current === normalizedAlias ||
            current.includes(normalizedAlias);
    });

    if (matches) {
      return column;
    }
  }

  return -1;
}

function detectExcelColumns(
  rows: any[][]
): ExcelColumnMap {
  let bestRow = -1;
  let bestScore = -1;
  let bestColumns: Partial<ExcelColumnMap> = {};

  const scanLimit = Math.min(
    HEADER_SCAN_ROWS,
    rows.length
  );

  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const row = rows[rowIndex] || [];

    const installation = findHeaderColumn(
      row,
      [...HEADER_ALIASES.INSTALLATION]
    );
    const action = findHeaderColumn(
      row,
      [...HEADER_ALIASES.ACTION]
    );
    const equipmentId = findHeaderColumn(
      row,
      [...HEADER_ALIASES.EQUIPMENT_ID],
      true
    );
    const company = findHeaderColumn(
      row,
      [...HEADER_ALIASES.COMPANY]
    );
    const status = findHeaderColumn(
      row,
      [...HEADER_ALIASES.STATUS]
    );
    const comment = findHeaderColumn(
      row,
      [...HEADER_ALIASES.COMMENT]
    );
    const explicitCode = findHeaderColumn(
      row,
      [...HEADER_ALIASES.CODE]
    );

    let score = 0;

    if (installation >= 0) score += 4;
    if (action >= 0) score += 4;
    if (equipmentId >= 0) score += 3;
    if (company >= 0) score += 2;
    if (status >= 0) score += 4;
    if (comment >= 0) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestRow = rowIndex;
      bestColumns = {
        headerRow: rowIndex,
        installation,
        action,
        equipmentId,
        company,
        status,
        comment,
        code: explicitCode,
      };
    }
  }

  if (bestRow < 0 || bestScore < 10) {
    throw new Error(
      "No se ha podido identificar la estructura de la tabla STL en el archivo Excel. No se han encontrado suficientes encabezados reconocibles (INSTALACION, ID, EMPRESA, ESTADO, etc.)."
    );
  }

  const equipmentId = bestColumns.equipmentId ?? -1;
  const company = bestColumns.company ?? -1;
  const status = bestColumns.status ?? -1;
  const comment = bestColumns.comment ?? -1;

  if (equipmentId < 0) {
    throw new Error(
      `No se ha podido localizar la columna ID en la fila de encabezados ${bestRow + 1}.`
    );
  }

  if (company < 0) {
    throw new Error(
      `No se ha podido localizar la columna EMPRESA en la fila de encabezados ${bestRow + 1}.`
    );
  }

  if (status < 0) {
    throw new Error(
      `No se ha podido localizar la columna ESTADO en la fila de encabezados ${bestRow + 1}.`
    );
  }

  if (comment < 0) {
    throw new Error(
      `No se ha podido localizar la columna COMENTARIO en la fila de encabezados ${bestRow + 1}.`
    );
  }

  /*
   * En las versiones observadas la cabecera INSTALACION puede estar
   * fusionada sobre varias columnas y no quedar justo encima de la
   * celda que contiene el dato.
   *
   * La zona inmediatamente anterior al ID mantiene una estructura
   * estable:
   *
   *   ... | CODIGO | INSTALACION | ACTUACION | PERIODICIDAD | ID
   *
   * Por ello, cuando no existe un encabezado específico fiable,
   * usamos el ID como ancla estructural.
   */
  let installation = bestColumns.installation ?? -1;
  let action = bestColumns.action ?? -1;
  let code = bestColumns.code ?? -1;

  const structuralInstallation = equipmentId - 3;
  const structuralAction = equipmentId - 2;
  const structuralCode = equipmentId - 4;

  if (structuralInstallation >= 0) {
    installation = structuralInstallation;
  }

  if (structuralAction >= 0) {
    action = structuralAction;
  }

  if (structuralCode >= 0) {
    code = structuralCode;
  }

  if (installation < 0 || action < 0 || code < 0) {
    throw new Error(
      `No se ha podido reconstruir la estructura Código + Instalación + Actuación a partir de la columna ID detectada en la fila ${bestRow + 1}.`
    );
  }

  return {
    headerRow: bestRow,
    code,
    installation,
    action,
    equipmentId,
    company,
    status,
    comment,
  };
}

function findCellByLabel(
  rows: any[][],
  aliases: string[],
  maxRows = 20
): { row: number; column: number } | null {
  const limit = Math.min(
    maxRows,
    rows.length
  );

  for (let row = 0; row < limit; row += 1) {
    const current = rows[row] || [];

    for (let column = 0; column < current.length; column += 1) {
      if (headerMatches(current[column], aliases)) {
        return { row, column };
      }
    }
  }

  return null;
}

function valueToYear(value: unknown): number {
  if (
    value instanceof Date &&
    !Number.isNaN(value.getTime())
  ) {
    return value.getFullYear();
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    const number = Math.trunc(value);

    if (number >= 2000 && number <= 2100) {
      return number;
    }
  }

  const valueText = text(value);
  const match = valueText.match(/20\d{2}/);

  return match ? Number(match[0]) : 0;
}

function findYearInTopSection(
  rows: any[][]
): number {
  const limit = Math.min(
    20,
    rows.length
  );

  for (let row = 0; row < limit; row += 1) {
    for (const value of rows[row] || []) {
      const year = valueToYear(value);

      if (year) {
        return year;
      }
    }
  }

  return 0;
}

function detectCenter(
  rows: any[][],
  fileName: string
) {
  const centerLabel = findCellByLabel(
    rows,
    ["centro", "centro comercial"]
  );

  if (!centerLabel) {
    throw new Error(
      "No se ha encontrado la etiqueta CENTRO en la cabecera del documento Excel."
    );
  }

  let centerName = "";

  for (
    let column = centerLabel.column + 1;
    column < Math.min(
      centerLabel.column + 5,
      rows[centerLabel.row]?.length ?? 0
    );
    column += 1
  ) {
    const candidate = text(
      rows[centerLabel.row]?.[column]
    );

    if (candidate) {
      centerName = candidate;
      break;
    }
  }

  if (!centerName) {
    throw new Error(
      `Se ha encontrado la etiqueta CENTRO en ${centerLabel.row + 1}, pero no se ha podido obtener el nombre del centro.`
    );
  }

  const reviewLabel = findCellByLabel(
    rows,
    ["tipo", "revision", "revisión", "tipo de revision", "tipo de revisión"]
  );

  let reviewText = "";

  if (reviewLabel) {
    for (
      let column = reviewLabel.column + 1;
      column < Math.min(
        reviewLabel.column + 5,
        rows[reviewLabel.row]?.length ?? 0
      );
      column += 1
    ) {
      const candidate = text(
        rows[reviewLabel.row]?.[column]
      );

      if (candidate) {
        reviewText = candidate;
        break;
      }
    }
  }

  let year = findYearInTopSection(rows);

  const fileNameNormalized = normalize(fileName);

  if (!year) {
    const fileYear = fileNameNormalized.match(/(?:^|[^0-9])((?:20)?\d{2})(?:[^0-9]|$)/);

    if (fileYear) {
      const candidate = fileYear[1];
      year = candidate.length === 2
        ? 2000 + Number(candidate)
        : Number(candidate);
    }
  }

  if (!year) {
    throw new Error(
      "No se ha podido identificar el año de la revisión en la cabecera del documento Excel. La importación se ha detenido para evitar archivarla en un año incorrecto."
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
    fileName: fileNameNormalized,
  };
}

function detectPeriod(
  reviewText: string,
  fileName: string,
  rows: any[][]
): Period {
  const sources = [
    reviewText,
    fileName,
  ];

  const topText = rows
    .slice(0, 20)
    .flat()
    .map(text)
    .filter(Boolean)
    .join(" ");

  sources.push(topText);

  const normalizedSources = sources.map(normalize);

  for (const source of normalizedSources) {
    if (
      /\bs1\b/.test(source) ||
      source.includes("semestre 1") ||
      source.includes("1 semestre") ||
      source.includes("primer semestre")
    ) {
      return "S1";
    }
  }

  for (const source of normalizedSources) {
    if (
      /\bs2\b/.test(source) ||
      source.includes("semestre 2") ||
      source.includes("2 semestre") ||
      source.includes("segundo semestre")
    ) {
      return "S2";
    }
  }

  throw new Error(
    `No se ha podido identificar si la revisión "${reviewText || fileName}" corresponde a S1 o S2. La importación se ha detenido para evitar archivarla en un periodo incorrecto.`
  );
}

function catalogText(
  source: any,
  keys: string[]
): string {
  if (!source) {
    return "";
  }

  for (const key of keys) {
    const value = source?.[key];

    if (
      value !== undefined &&
      value !== null
    ) {
      const result = text(value);

      if (result) {
        return result;
      }
    }
  }

  return "";
}

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
        normalize(catalogInstallation) === normalizedInstallation &&
        normalize(catalogAction) === normalizedAction
      );
    }
  );
}

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
        normalize(catalogInstallation) === normalizedInstallation &&
        normalize(catalogAction) === normalizedAction
      );
    }
  );
}

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

function getCatalogActionCode(
  catalogItem: any
): string {
  return catalogText(catalogItem, [
    "actionCode",
    "baseCode",
    "code",
  ]);
}

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
 * Las distintas versiones utilizan celdas combinadas.
 * Cuando XLSX lee una celda combinada solamente queda valor
 * en la primera fila del bloque. Esta función permite recuperar
 * el último valor no vacío de las columnas jerárquicas.
 */
function forwardFill(
  rows: any[][],
  rowIndex: number,
  column: number,
  currentValue: string
): string {
  if (currentValue) {
    return currentValue;
  }

  for (let previous = rowIndex - 1; previous >= 0; previous -= 1) {
    const value = text(
      rows[previous]?.[column]
    );

    if (value) {
      return value;
    }
  }

  return "";
}

function duplicateGroupKey(
  installation: string,
  action: string
): string {
  return [
    normalize(installation),
    normalize(action),
  ].join("|");
}

function buildUnitCode(
  baseCode: string,
  totalUnits: number,
  unitIndex: number
): string {
  const cleanCode = text(baseCode);

  if (totalUnits <= 1) {
    return cleanCode;
  }

  return `${cleanCode}.${unitIndex}`;
}

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

function parseWorkbook(
  wb: XLSX.WorkBook,
  fileName = ""
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

  const columns = detectExcelColumns(rows);
  const detected = detectCenter(rows, fileName);
  const period = detectPeriod(
    detected.reviewText,
    fileName,
    rows
  );

  const country =
    (detected.center as any).country === "Portugal"
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

  const parsedRows: ImportRow[] = [];
  const warnings: string[] = [];

  let excluded = 0;
  let unmatched = 0;

  const validRows: ValidExcelRow[] = [];

  const lastRow = Math.min(
    rows.length,
    columns.headerRow + MAX_DATA_ROWS
  );

  for (
    let rowIndex = columns.headerRow + 1;
    rowIndex < lastRow;
    rowIndex += 1
  ) {
    const row = rows[rowIndex] || [];

    const rawStatus = text(
      row[columns.status]
    );

    /*
     * REGLA PRINCIPAL:
     *
     * Si ESTADO está vacío, la fila se ignora completamente.
     */
    if (!rawStatus) {
      continue;
    }

    const status = statusFromExcel(rawStatus);

    if (!status) {
      excluded += 1;

      warnings.push(
        `Fila ${rowIndex + 1}: el valor de ESTADO "${rawStatus}" no es un estado reconocido. La fila no se ha importado.`
      );

      continue;
    }

    /*
     * Las celdas C/D equivalentes pueden estar combinadas.
     * Recuperamos el valor visible de la primera fila del bloque.
     */
    const code = forwardFill(
      rows,
      rowIndex,
      columns.code,
      text(row[columns.code])
    );

    const installation = forwardFill(
      rows,
      rowIndex,
      columns.installation,
      text(row[columns.installation])
    );

    const action = forwardFill(
      rows,
      rowIndex,
      columns.action,
      text(row[columns.action])
    );

    if (!installation) {
      unmatched += 1;

      warnings.push(
        `Fila ${rowIndex + 1}: tiene un estado válido "${rawStatus}", pero no se ha podido obtener INSTALACION.`
      );

      continue;
    }

    if (!action) {
      unmatched += 1;

      warnings.push(
        `Fila ${rowIndex + 1}: la INSTALACION "${installation}" es válida, pero no se ha podido obtener ACTUACION.`
      );

      continue;
    }

    /*
     * El código puede estar vacío en filas posteriores de una
     * celda combinada. No rechazamos la fila: el código base se
     * resolverá al agrupar por INSTALACION + ACTUACION.
     */
    const equipmentId = text(
      row[columns.equipmentId]
    );

    const company = text(
      row[columns.company]
    );

    const comment = text(
      row[columns.comment]
    );

    validRows.push({
      excelRow: rowIndex + 1,
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
   * Las unidades repetidas se agrupan exclusivamente por:
   *
   *   INSTALACION + ACTUACION
   *
   * El código NO forma parte de la clave porque en las plantillas
   * puede estar en una celda combinada y aparecer solamente en la
   * primera fila del grupo.
   */
  const groups = new Map<string, ValidExcelRow[]>();

  for (const row of validRows) {
    const key = duplicateGroupKey(
      row.installation,
      row.action
    );

    const group = groups.get(key);

    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  let multiple = 0;

  for (const group of groups.values()) {
    const firstRow = group[0];

    if (!firstRow) {
      continue;
    }

    if (group.length > 1) {
      multiple += 1;
    }

    const baseCode =
      group.find((row) => text(row.code))?.code || "";

    if (!baseCode) {
      unmatched += group.length;

      warnings.push(
        `Filas ${group.map((row) => row.excelRow).join(", ")}: se han encontrado ${group.length} unidad${group.length === 1 ? "" : "es"} con INSTALACION "${firstRow.installation}" + ACTUACION "${firstRow.action}", pero no se ha encontrado ningún código base en la columna correspondiente. Se han omitido para evitar generar códigos incorrectos.`
      );

      continue;
    }

    const catalogMatches = findCatalogItems(
      catalogItems,
      firstRow.installation,
      firstRow.action
    );

    if (catalogMatches.length === 0) {
      unmatched += group.length;

      warnings.push(
        `Código "${baseCode}": no existe en el catálogo una INSTALACION "${firstRow.installation}" con ACTUACION "${firstRow.action}". Se han omitido ${group.length} unidad${group.length === 1 ? "" : "es"}.`
      );

      continue;
    }

    if (group.length > catalogMatches.length) {
      unmatched +=
        group.length - catalogMatches.length;

      warnings.push(
        `Código "${baseCode}": se han encontrado ${group.length} unidades en el Excel para INSTALACION "${firstRow.installation}" + ACTUACION "${firstRow.action}", pero solamente existen ${catalogMatches.length} elementos equivalentes en el catálogo. Se importarán las ${Math.min(group.length, catalogMatches.length)} primeras y se omitirán ${group.length - catalogMatches.length}.`
      );
    }

    const unitsToImport = Math.min(
      group.length,
      catalogMatches.length
    );

    for (
      let unitIndex = 0;
      unitIndex < unitsToImport;
      unitIndex += 1
    ) {
      const excelData = group[unitIndex];
      const catalogItem = catalogMatches[unitIndex];

      if (!excelData || !catalogItem) {
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
        catalogItemId: String(catalogItem.id),
        category: getCatalogCategory(catalogItem),
        installation: excelData.installation,
        action: excelData.action,
        actionCode: getCatalogActionCode(catalogItem),
        equipmentId: excelData.equipmentId,
        company: excelData.company,
        inspectionDate: "",
        status: excelData.status,
        selected: [excelData.status],
        multiple: group.length > 1,
        comment: excelData.comment,
      });
    }
  }

  parsedRows.sort(
    (a, b) => a.excelRow - b.excelRow
  );

  return {
    centerName: text((detected.center as any).name),
    centerCode: text((detected.center as any).code),
    centerId: String((detected.center as any).id),
    country,
    year: detected.year,
    reviewText:
      detected.reviewText ||
      `${period} ${detected.year}`,
    period,
    reviewDate: "",
    rows: parsedRows,
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
        parseWorkbook(wb, nextFile.name);

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
            La cabecera y las columnas se detectan automáticamente a partir de los encabezados de la plantilla, por lo que no depende de una posición fija.
          </p>

          <p className="mt-2">
            Tabla: se localizan automáticamente Código, Instalación, Actuación, ID, Empresa, Estado y Comentario, aunque cambien de columna entre versiones.
          </p>

          <p className="mt-2 font-semibold">
            La columna identificada como ESTADO determina si una fila se importa.
            Si ESTADO está vacío, la fila se ignora completamente.
          </p>

          <p className="mt-2 font-semibold">
            La identificación del elemento se realiza comparando
            INSTALACION y ACTUACION con el catálogo, independientemente
            de la columna que ocupen en cada versión del Excel.
          </p>

          <p className="mt-2 font-semibold">
            Cuando varias filas válidas tienen la misma INSTALACION
            y ACTUACION, todas se consideran unidades del mismo
            elemento. El código base se toma del primer código
            disponible del grupo y se generan 1.1.1, 1.1.2, 1.1.3, etc.
          </p>

          <p className="mt-2 font-semibold">
            El ID se importa únicamente como dato de su propia fila.
            No se utiliza ninguna columna auxiliar por posición fija.
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
                únicamente se procesan filas cuyo ESTADO detectado sea reconocido.
                Las filas con ESTADO vacío se ignoran completamente.
                El elemento del catálogo se identifica mediante INSTALACION + ACTUACION.
                Cuando existen varias filas con el mismo par, el código base se toma
                del primer código disponible del grupo y se generan códigos .1, .2, .3, etc.
                El ID solamente aporta el identificador de cada fila.
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
