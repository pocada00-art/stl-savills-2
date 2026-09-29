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
 * ESTRUCTURAS STL SOPORTADAS
 * ============================================================
 *
 * PLANTILLA MODERNA / 2026
 *
 * C = INSTALACIÓN
 * D = CÓDIGO
 * E = ACTUACIÓN
 * H = ID
 * I = EMPRESA
 * P = ESTADO
 * S = COMENTARIO
 *
 * PLANTILLA LEGACY / 2024
 *
 * B = INSTALACIÓN
 * C = CÓDIGO
 * D = ACTUACIÓN
 * G = ID
 * H = EMPRESA
 * S = ESTADO
 * U = COMENTARIO
 *
 * La detección se realiza a partir de la cabecera real del Excel.
 * No se utiliza el desplazamiento "ID - 3", "ID - 2", etc.,
 * porque las dos plantillas no tienen la misma estructura.
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
  template: "modern" | "legacy" | "generic";
};

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
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalización utilizada para comparar textos de catálogo.
 *
 * Elimina puntuación que no debería impedir que dos descripciones
 * equivalentes coincidan.
 */
function normalizeComparable(value: unknown): string {
  return normalize(value)
    .replace(/[.,;:()[\]{}'"“”‘’/\\_-]+/g, " ")
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

  return aliases.some((alias) => {
    const normalizedAlias =
      normalizedHeader(alias);

    return (
      current === normalizedAlias ||
      current.includes(normalizedAlias)
    );
  });
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
  for (
    let column = 0;
    column < row.length;
    column += 1
  ) {
    const current =
      normalizedHeader(row[column]);

    if (!current) {
      continue;
    }

    const matches =
      aliases.some((alias) => {
        const normalizedAlias =
          normalizedHeader(alias);

        return exact
          ? current === normalizedAlias
          : current === normalizedAlias ||
              current.includes(
                normalizedAlias
              );
      });

    if (matches) {
      return column;
    }
  }

  return -1;
}

/**
 * Detecta la fila real de cabecera.
 *
 * Las plantillas tienen una fila de cabecera diferente entre
 * versiones, por lo que primero localizamos la fila que contiene
 * la combinación de ID / Empresa / Estado / Comentario.
 */
function detectHeaderRow(
  rows: any[][]
): {
  row: number;
  installationHeader: number;
  equipmentId: number;
  company: number;
  status: number;
  comment: number;
} {
  let bestRow = -1;
  let bestScore = -1;

  let bestInstallation = -1;
  let bestEquipmentId = -1;
  let bestCompany = -1;
  let bestStatus = -1;
  let bestComment = -1;

  const scanLimit =
    Math.min(
      HEADER_SCAN_ROWS,
      rows.length
    );

  for (
    let rowIndex = 0;
    rowIndex < scanLimit;
    rowIndex += 1
  ) {
    const row =
      rows[rowIndex] || [];

    const installation =
      findHeaderColumn(
        row,
        [...HEADER_ALIASES.INSTALLATION]
      );

    const equipmentId =
      findHeaderColumn(
        row,
        [...HEADER_ALIASES.EQUIPMENT_ID],
        true
      );

    const company =
      findHeaderColumn(
        row,
        [...HEADER_ALIASES.COMPANY]
      );

    const status =
      findHeaderColumn(
        row,
        [...HEADER_ALIASES.STATUS]
      );

    const comment =
      findHeaderColumn(
        row,
        [...HEADER_ALIASES.COMMENT]
      );

    let score = 0;

    if (installation >= 0) {
      score += 4;
    }

    if (equipmentId >= 0) {
      score += 4;
    }

    if (company >= 0) {
      score += 3;
    }

    if (status >= 0) {
      score += 5;
    }

    if (comment >= 0) {
      score += 3;
    }

    if (
      score > bestScore
    ) {
      bestScore = score;
      bestRow = rowIndex;

      bestInstallation =
        installation;

      bestEquipmentId =
        equipmentId;

      bestCompany =
        company;

      bestStatus =
        status;

      bestComment =
        comment;
    }
  }

  if (
    bestRow < 0 ||
    bestScore < 12
  ) {
    throw new Error(
      "No se ha podido identificar la fila de cabecera de la plantilla STL. El archivo no tiene una estructura reconocible."
    );
  }

  if (
    bestEquipmentId < 0
  ) {
    throw new Error(
      `No se ha podido localizar la columna ID en la cabecera de la fila ${
        bestRow + 1
      }.`
    );
  }

  if (
    bestCompany < 0
  ) {
    throw new Error(
      `No se ha podido localizar la columna EMPRESA en la cabecera de la fila ${
        bestRow + 1
      }.`
    );
  }

  if (
    bestStatus < 0
  ) {
    throw new Error(
      `No se ha podido localizar la columna ESTADO en la cabecera de la fila ${
        bestRow + 1
      }.`
    );
  }

  return {
    row: bestRow,
    installationHeader:
      bestInstallation,
    equipmentId:
      bestEquipmentId,
    company:
      bestCompany,
    status:
      bestStatus,
    comment:
      bestComment,
  };
}

/**
 * Reconstruye las columnas reales de las dos plantillas
 * STL conocidas.
 *
 * IMPORTANTE:
 * No usamos ya:
 *
 *   ID - 3 = Instalación
 *   ID - 2 = Actuación
 *   ID - 4 = Código
 *
 * porque eso era precisamente lo que hacía que los Excel
 * adjuntos no se reconocieran correctamente.
 */
function detectExcelColumns(
  rows: any[][]
): ExcelColumnMap {
  const header =
    detectHeaderRow(rows);

  /*
   * PLANTILLA MODERNA
   *
   * Cabecera típica:
   *
   * A Nº
   * B:F INSTALACIÓN
   * G Periodicidad
   * H ID
   * I Empresa
   * P ESTADO
   * S Comentario
   *
   * Los datos reales de instalación están en C.
   */
  if (
    header.status === 15 &&
    header.equipmentId === 7 &&
    header.company === 8 &&
    header.comment === 18
  ) {
    return {
      headerRow:
        header.row,
      code: 3,
      installation: 2,
      action: 4,
      equipmentId: 7,
      company: 8,
      status: 15,
      comment: 18,
      template:
        "modern",
    };
  }

  /*
   * PLANTILLA LEGACY
   *
   * Cabecera típica:
   *
   * A:D INSTALACIÓN
   * F Periodicidad
   * G ID
   * H Empresa
   * S ESTADO
   * U Comentario
   *
   * Los datos reales de instalación están en B.
   */
  if (
    header.status === 18 &&
    header.equipmentId === 6 &&
    header.company === 7 &&
    header.comment === 20
  ) {
    return {
      headerRow:
        header.row,
      code: 2,
      installation: 1,
      action: 3,
      equipmentId: 6,
      company: 7,
      status: 18,
      comment: 20,
      template:
        "legacy",
    };
  }

  /*
   * Fallback para pequeñas variantes futuras.
   *
   * Si la plantilla mantiene la estructura moderna alrededor
   * del ESTADO, utilizamos sus columnas conocidas.
   */
  if (
    header.status >= 14 &&
    header.status <= 16 &&
    header.equipmentId >= 6 &&
    header.equipmentId <= 8
  ) {
    return {
      headerRow:
        header.row,
      code: 3,
      installation: 2,
      action: 4,
      equipmentId:
        header.equipmentId,
      company:
        header.company,
      status:
        header.status,
      comment:
        header.comment >= 0
          ? header.comment
          : 18,
      template:
        "modern",
    };
  }

  /*
   * Fallback para variantes legacy.
   */
  if (
    header.status >= 18 &&
    header.status <= 19 &&
    header.equipmentId >= 6 &&
    header.equipmentId <= 7
  ) {
    return {
      headerRow:
        header.row,
      code: 2,
      installation: 1,
      action: 3,
      equipmentId:
        header.equipmentId,
      company:
        header.company,
      status:
        header.status,
      comment:
        header.comment >= 0
          ? header.comment
          : 20,
      template:
        "legacy",
    };
  }

  throw new Error(
    `Se ha detectado una cabecera STL en la fila ${
      header.row + 1
    }, pero la distribución de columnas no corresponde a ninguna de las plantillas STL soportadas.`
  );
}

function findCellByLabel(
  rows: any[][],
  aliases: string[],
  maxRows = 20
): {
  row: number;
  column: number;
} | null {
  const limit =
    Math.min(
      maxRows,
      rows.length
    );

  for (
    let row = 0;
    row < limit;
    row += 1
  ) {
    const current =
      rows[row] || [];

    for (
      let column = 0;
      column < current.length;
      column += 1
    ) {
      if (
        headerMatches(
          current[column],
          aliases
        )
      ) {
        return {
          row,
          column,
        };
      }
    }
  }

  return null;
}

function valueToYear(
  value: unknown
): number {
  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {
    return value.getFullYear();
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    const number =
      Math.trunc(value);

    if (
      number >= 2000 &&
      number <= 2100
    ) {
      return number;
    }
  }

  const valueText =
    text(value);

  const match =
    valueText.match(
      /20\d{2}/
    );

  return match
    ? Number(match[0])
    : 0;
}

function findYearInTopSection(
  rows: any[][]
): number {
  const limit =
    Math.min(
      20,
      rows.length
    );

  for (
    let row = 0;
    row < limit;
    row += 1
  ) {
    for (
      const value of
        rows[row] || []
    ) {
      const year =
        valueToYear(value);

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
  const centerLabel =
    findCellByLabel(
      rows,
      [
        "centro",
        "centro comercial",
      ]
    );

  if (!centerLabel) {
    throw new Error(
      "No se ha encontrado la etiqueta CENTRO en la cabecera del documento Excel."
    );
  }

  let centerName = "";

  /*
   * El nombre puede estar inmediatamente a la derecha
   * o dentro de una celda combinada.
   */
  for (
    let column =
      centerLabel.column + 1;
    column <
    Math.min(
      centerLabel.column + 6,
      rows[
        centerLabel.row
      ]?.length ?? 0
    );
    column += 1
  ) {
    const candidate =
      text(
        rows[
          centerLabel.row
        ]?.[column]
      );

    if (candidate) {
      centerName =
        candidate;
      break;
    }
  }

  if (!centerName) {
    throw new Error(
      `Se ha encontrado la etiqueta CENTRO en la fila ${
        centerLabel.row + 1
      }, pero no se ha podido obtener el nombre del centro.`
    );
  }

  const reviewLabel =
    findCellByLabel(
      rows,
      [
        "tipo",
        "revision",
        "revisión",
        "tipo de revision",
        "tipo de revisión",
      ]
    );

  let reviewText = "";

  if (reviewLabel) {
    for (
      let column =
        reviewLabel.column + 1;
      column <
      Math.min(
        reviewLabel.column + 6,
        rows[
          reviewLabel.row
        ]?.length ?? 0
      );
      column += 1
    ) {
      const candidate =
        text(
          rows[
            reviewLabel.row
          ]?.[column]
        );

      if (candidate) {
        reviewText =
          candidate;
        break;
      }
    }
  }

  let year =
    findYearInTopSection(
      rows
    );

  const fileNameNormalized =
    normalize(fileName);

  /*
   * El nombre de archivo es una fuente secundaria de año.
   *
   * Se utiliza solamente si la cabecera no lo proporciona.
   */
  if (!year) {
    const fileYear =
      fileNameNormalized.match(
        /(?:^|[^0-9])((?:20)?\d{2})(?:[^0-9]|$)/
      );

    if (fileYear) {
      const candidate =
        fileYear[1];

      year =
        candidate.length === 2
          ? 2000 +
            Number(candidate)
          : Number(candidate);
    }
  }

  if (!year) {
    throw new Error(
      "No se ha podido identificar el año de la revisión. La importación se ha detenido para evitar guardar una revisión histórica en un año incorrecto."
    );
  }

  const center =
    demo.centers.find(
      (c: any) =>
        normalize(c.name) ===
          normalize(centerName) ||
        normalize(c.shortCode) ===
          normalize(centerName) ||
        normalize(c.code) ===
          normalize(centerName)
    );

  if (!center) {
    throw new Error(
      `No se ha podido identificar el centro "${centerName}" en la base de centros.`
    );
  }

  return {
    name: text(
      (center as any).name
    ),
    code: text(
      (center as any).code
    ),
    center:
      center as any,
    year,
    reviewText,
    fileName:
      fileNameNormalized,
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

  const topText =
    rows
      .slice(0, 20)
      .flat()
      .map(text)
      .filter(Boolean)
      .join(" ");

  sources.push(topText);

  const normalizedSources =
    sources.map(normalize);

  for (
    const source of
      normalizedSources
  ) {
    if (
      /\bs1\b/.test(source) ||
      source.includes(
        "semestre 1"
      ) ||
      source.includes(
        "1 semestre"
      ) ||
      source.includes(
        "primer semestre"
      )
    ) {
      return "S1";
    }
  }

  for (
    const source of
      normalizedSources
  ) {
    if (
      /\bs2\b/.test(source) ||
      source.includes(
        "semestre 2"
      ) ||
      source.includes(
        "2 semestre"
      ) ||
      source.includes(
        "segundo semestre"
      )
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

  for (
    const key of keys
  ) {
    const value =
      source?.[key];

    if (
      value !== undefined &&
      value !== null
    ) {
      const result =
        text(value);

      if (result) {
        return result;
      }
    }
  }

  return "";
}

function statusFromExcel(
  value: unknown
): V1Status | "" {
  /*
   * PTE. y PTE deben considerarse exactamente el mismo estado.
   * También eliminamos signos de puntuación para evitar que
   * "PTE." quede sin reconocer.
   */
  const normalized =
    normalize(value)
      .replace(/[.:;,_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  if (!normalized) {
    return "";
  }

  if (
    normalized === "apto" ||
    normalized === "favorable"
  ) {
    return "APTO";
  }

  if (
    normalized ===
      "apto condicionado" ||
    normalized ===
      "condicionado"
  ) {
    return "APTO CONDICIONADO";
  }

  if (
    normalized ===
      "no apto" ||
    normalized ===
      "desfavorable"
  ) {
    return "NO APTO";
  }

  if (
    normalized ===
      "pendiente" ||
    normalized === "pte"
  ) {
    return "PENDIENTE";
  }

  if (
    normalized ===
      "sin informacion" ||
    normalized === "error"
  ) {
    return "SIN INFORMACIÓN";
  }

  return "";
}

function getCatalogOrdinal(
  catalogItem: any
): number {
  const possibleValues = [
    catalogItem?.ordinal,
    catalogItem?.number,
    catalogItem?.numero,
  ];

  for (
    const value of
      possibleValues
  ) {
    const number =
      Number(value);

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
  return catalogText(
    catalogItem,
    [
      "actionCode",
      "baseCode",
      "code",
      "elementCode",
      "codigo",
      "codigoElemento",
    ]
  );
}

function getCatalogCategory(
  catalogItem: any
): string {
  return catalogText(
    catalogItem,
    [
      "category",
      "categoria",
      "CATEGORY",
    ]
  );
}

function getCatalogInstallation(
  catalogItem: any
): string {
  return catalogText(
    catalogItem,
    [
      "installation",
      "instalacion",
      "INSTALACION",
      "installationName",
      "install",
      "installationText",
    ]
  );
}

function getCatalogAction(
  catalogItem: any
): string {
  return catalogText(
    catalogItem,
    [
      "action",
      "actuacion",
      "ACTUACION",
      "actuation",
      "actionName",
      "actionText",
    ]
  );
}

/**
 * Devuelve una puntuación de similitud sencilla entre dos
 * descripciones.
 *
 * No se pretende hacer una búsqueda difusa indiscriminada:
 * solamente se utiliza como respaldo cuando la coincidencia
 * exacta no funciona por diferencias de formato de la plantilla.
 */
function textSimilarity(
  first: string,
  second: string
): number {
  const a =
    normalizeComparable(first);

  const b =
    normalizeComparable(second);

  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 100;
  }

  if (
    a.includes(b) ||
    b.includes(a)
  ) {
    return 85;
  }

  const aTokens =
    new Set(
      a.split(" ")
        .filter(
          (token) =>
            token.length >= 2
        )
    );

  const bTokens =
    new Set(
      b.split(" ")
        .filter(
          (token) =>
            token.length >= 2
        )
    );

  if (
    aTokens.size === 0 ||
    bTokens.size === 0
  ) {
    return 0;
  }

  let common = 0;

  for (
    const token of
      aTokens
  ) {
    if (
      bTokens.has(token)
    ) {
      common += 1;
    }
  }

  const denominator =
    Math.max(
      aTokens.size,
      bTokens.size
    );

  return denominator
    ? Math.round(
        (common /
          denominator) *
          80
      )
    : 0;
}

/**
 * Busca elementos del catálogo.
 *
 * Primera prioridad:
 *   INSTALACION + ACTUACION
 *
 * Segunda prioridad:
 *   misma combinación textual con pequeñas diferencias
 *
 * Tercera prioridad:
 *   código base + similitud de descripción.
 *
 * Esta última vía es necesaria para plantillas como las adjuntas,
 * donde por ejemplo "PCI. Ext., Det..." y "Ext., Det..." pueden
 * representar el mismo elemento.
 */
function findCatalogItems(
  catalogItems: any[],
  installation: string,
  action: string,
  baseCode: string
): any[] {
  const normalizedInstallation =
    normalizeComparable(
      installation
    );

  const normalizedAction =
    normalizeComparable(
      action
    );

  const normalizedCode =
    normalizeComparable(
      baseCode
    );

  if (
    !normalizedInstallation &&
    !normalizedAction &&
    !normalizedCode
  ) {
    return [];
  }

  /*
   * 1. Coincidencia exacta por instalación + actuación.
   */
  const exact =
    catalogItems.filter(
      (item) => {
        const itemInstallation =
          normalizeComparable(
            getCatalogInstallation(
              item
            )
          );

        const itemAction =
          normalizeComparable(
            getCatalogAction(
              item
            )
          );

        return (
          itemInstallation ===
            normalizedInstallation &&
          itemAction ===
            normalizedAction
        );
      }
    );

  if (
    exact.length > 0
  ) {
    return exact;
  }

  /*
   * 2. Si no hay actuación, el código es la referencia
   *    segura de respaldo.
   */
  if (
    !normalizedAction &&
    normalizedCode
  ) {
    const byCode =
      catalogItems.filter(
        (item) =>
          normalizeComparable(
            getCatalogActionCode(
              item
            )
          ) ===
          normalizedCode
      );

    if (
      byCode.length > 0
    ) {
      return byCode;
    }
  }

  /*
   * 3. Candidatos que compartan código.
   */
  let candidates =
    normalizedCode
      ? catalogItems.filter(
          (item) =>
            normalizeComparable(
              getCatalogActionCode(
                item
              )
            ) ===
            normalizedCode
        )
      : [];

  /*
   * Si no se encuentra código en catálogo, permitimos buscar
   * por texto, pero solamente cuando la similitud es suficiente.
   */
  if (
    candidates.length === 0
  ) {
    candidates =
      catalogItems.slice();
  }

  const scored =
    candidates
      .map((item) => {
        const itemInstallation =
          getCatalogInstallation(
            item
          );

        const itemAction =
          getCatalogAction(
            item
          );

        const installationScore =
          textSimilarity(
            installation,
            itemInstallation
          );

        const actionScore =
          textSimilarity(
            action,
            itemAction
          );

        const codeScore =
          normalizedCode &&
          normalizeComparable(
            getCatalogActionCode(
              item
            )
          ) ===
            normalizedCode
            ? 45
            : 0;

        let score =
          codeScore;

        if (
          installationScore >=
          80
        ) {
          score += 30;
        } else if (
          installationScore >=
          60
        ) {
          score += 20;
        }

        if (
          actionScore >=
          80
        ) {
          score += 35;
        } else if (
          actionScore >=
          60
        ) {
          score += 25;
        } else if (
          !normalizedAction &&
          !itemAction
        ) {
          score += 35;
        }

        return {
          item,
          score,
        };
      })
      .filter(
        (entry) =>
          entry.score >= 60
      )
      .sort(
        (a, b) =>
          b.score -
          a.score
      );

  if (
    scored.length === 0
  ) {
    return [];
  }

  const bestScore =
    scored[0]?.score ?? 0;

  return scored
    .filter(
      (entry) =>
        entry.score ===
        bestScore
    )
    .map(
      (entry) =>
        entry.item
    );
}

/**
 * Recupera el último valor no vacío de una columna.
 *
 * Se utiliza para las celdas combinadas.
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

  for (
    let previous =
      rowIndex - 1;
    previous >= 0;
    previous -= 1
  ) {
    const value =
      text(
        rows[previous]?.[
          column
        ]
      );

    if (value) {
      return value;
    }
  }

  return "";
}

/**
 * Recupera una columna jerárquica.
 *
 * Para ACTUACION hay una particularidad importante:
 *
 * Si una nueva fila contiene CÓDIGO pero ACTUACION está vacía,
 * NO debemos arrastrar la actuación anterior.
 *
 * Esto ocurre en la plantilla 2024 con elementos como:
 *
 *   17 Megafonia
 *   18 Z. infantiles
 *   19 Inst. Fotovoltaica
 *   20 CCTV
 *
 * donde ACTUACION está realmente vacía.
 */
function resolveAction(
  rows: any[][],
  rowIndex: number,
  codeColumn: number,
  actionColumn: number
): string {
  const currentAction =
    text(
      rows[rowIndex]?.[
        actionColumn
      ]
    );

  if (currentAction) {
    return currentAction;
  }

  const currentCode =
    text(
      rows[rowIndex]?.[
        codeColumn
      ]
    );

  /*
   * Si comienza un nuevo elemento y no tiene actuación,
   * su actuación debe quedar vacía.
   */
  if (currentCode) {
    return "";
  }

  return forwardFill(
    rows,
    rowIndex,
    actionColumn,
    ""
  );
}

function duplicateGroupKey(
  installation: string,
  action: string
): string {
  return [
    normalizeComparable(
      installation
    ),
    normalizeComparable(
      action
    ),
  ].join("|");
}

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
    wb.SheetNames.includes(
      "FICHA"
    )
      ? "FICHA"
      : wb.SheetNames[0];

  if (!sheetName) {
    throw new Error(
      "El archivo no contiene ninguna hoja."
    );
  }

  const ws =
    wb.Sheets[sheetName];

  if (!ws) {
    throw new Error(
      `No se ha podido abrir la hoja "${sheetName}".`
    );
  }

  /*
   * raw=true es importante para conservar los valores calculados
   * que contienen las celdas ESTADO de las plantillas corporativas.
   */
  const rows =
    XLSX.utils.sheet_to_json(
      ws,
      {
        header: 1,
        defval: null,
        raw: true,
      }
    ) as any[][];

  if (
    rows.length === 0
  ) {
    throw new Error(
      "La hoja FICHA está vacía."
    );
  }

  const columns =
    detectExcelColumns(
      rows
    );

  const detected =
    detectCenter(
      rows,
      fileName
    );

  const period =
    detectPeriod(
      detected.reviewText,
      fileName,
      rows
    );

  const country =
    (detected.center as any)
      .country ===
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

  if (
    !Array.isArray(
      catalogItems
    ) ||
    catalogItems.length === 0
  ) {
    throw new Error(
      `No se ha podido cargar el catálogo de elementos de ${
        country === "España"
          ? "España"
          : "Portugal"
      }. La importación se ha detenido para evitar crear elementos sin correspondencia.`
    );
  }

  const parsedRows:
    ImportRow[] = [];

  const warnings:
    string[] = [];

  let excluded = 0;
  let unmatched = 0;

  const validRows:
    ValidExcelRow[] = [];

  const lastRow =
    Math.min(
      rows.length,
      columns.headerRow +
        MAX_DATA_ROWS
    );

  for (
    let rowIndex =
      columns.headerRow + 1;
    rowIndex < lastRow;
    rowIndex += 1
  ) {
    const row =
      rows[rowIndex] || [];

    const rawStatus =
      text(
        row[
          columns.status
        ]
      );

    /*
     * ESTADO vacío:
     *
     * la fila no se procesa.
     */
    if (!rawStatus) {
      continue;
    }

    /*
     * "-" significa que el elemento no tiene resultado
     * aplicable en esa revisión.
     *
     * Se ignora completamente, igual que una celda vacía.
     */
    const normalizedRawStatus =
      normalize(rawStatus);

    if (
      normalizedRawStatus ===
        "-" ||
      normalizedRawStatus ===
        "–" ||
      normalizedRawStatus ===
        "—"
    ) {
      continue;
    }

    const status =
      statusFromExcel(
        rawStatus
      );

    if (!status) {
      excluded += 1;

      warnings.push(
        `Fila ${
          rowIndex + 1
        }: el valor de ESTADO "${rawStatus}" no es un estado reconocido. La fila no se ha importado.`
      );

      continue;
    }

    /*
     * CÓDIGO
     *
     * Se recupera mediante forward-fill porque en ambas plantillas
     * el código puede estar en una celda combinada.
     */
    const code =
      forwardFill(
        rows,
        rowIndex,
        columns.code,
        text(
          row[
            columns.code
          ]
        )
      );

    /*
     * INSTALACIÓN
     *
     * También puede estar en una celda combinada.
     */
    const installation =
      forwardFill(
        rows,
        rowIndex,
        columns.installation,
        text(
          row[
            columns.installation
          ]
        )
      );

    /*
     * ACTUACIÓN
     *
     * Se trata de forma especial para no arrastrar una actuación
     * anterior a un nuevo elemento que realmente no tiene actuación.
     */
    const action =
      resolveAction(
        rows,
        rowIndex,
        columns.code,
        columns.action
      );

    if (!installation) {
      unmatched += 1;

      warnings.push(
        `Fila ${
          rowIndex + 1
        }: tiene un estado válido "${rawStatus}", pero no se ha podido obtener INSTALACIÓN.`
      );

      continue;
    }

    const equipmentId =
      text(
        row[
          columns.equipmentId
        ]
      );

    const company =
      text(
        row[
          columns.company
        ]
      );

    const comment =
      columns.comment >= 0
        ? text(
            row[
              columns.comment
            ]
          )
        : "";

    validRows.push({
      excelRow:
        rowIndex + 1,
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
   * Agrupación de unidades.
   *
   * La clave sigue siendo INSTALACION + ACTUACION.
   *
   * Cuando ACTUACION está vacía se agrupa por instalación.
   * El código se utiliza posteriormente para identificar el
   * elemento exacto del catálogo.
   */
  const groups =
    new Map<
      string,
      ValidExcelRow[]
    >();

  for (
    const row of validRows
  ) {
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
      groups.set(
        key,
        [row]
      );
    }
  }

  let multiple = 0;

  for (
    const group of groups.values()
  ) {
    const firstRow =
      group[0];

    if (!firstRow) {
      continue;
    }

    if (
      group.length > 1
    ) {
      multiple += 1;
    }

    /*
     * El código base siempre procede del primer código disponible
     * del grupo.
     */
    const baseCode =
      group.find(
        (row) =>
          text(row.code)
      )?.code || "";

    if (!baseCode) {
      unmatched +=
        group.length;

      warnings.push(
        `Filas ${group
          .map(
            (row) =>
              row.excelRow
          )
          .join(
            ", "
          )}: no se ha encontrado ningún código base para INSTALACIÓN "${firstRow.installation}" + ACTUACIÓN "${firstRow.action}". Se han omitido para evitar crear códigos incorrectos.`
      );

      continue;
    }

    const catalogMatches =
      findCatalogItems(
        catalogItems,
        firstRow.installation,
        firstRow.action,
        baseCode
      );

    if (
      catalogMatches.length ===
      0
    ) {
      unmatched +=
        group.length;

      warnings.push(
        `Código "${baseCode}": no se ha encontrado correspondencia en el catálogo para INSTALACIÓN "${firstRow.installation}" + ACTUACIÓN "${firstRow.action}". Se han omitido ${group.length} unidad${
          group.length === 1
            ? ""
            : "es"
        }.`
      );

      continue;
    }

    if (
      group.length >
      catalogMatches.length
    ) {
      unmatched +=
        group.length -
        catalogMatches.length;

      warnings.push(
        `Código "${baseCode}": el Excel contiene ${group.length} unidades para INSTALACIÓN "${firstRow.installation}" + ACTUACIÓN "${firstRow.action}", pero el catálogo solamente permite ${catalogMatches.length}. Se importarán las ${Math.min(
          group.length,
          catalogMatches.length
        )} primeras y se omitirá el resto.`
      );
    }

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

        catalogItemId:
          String(
            catalogItem.id
          ),

        category:
          getCatalogCategory(
            catalogItem
          ),

        installation:
          excelData.installation,

        action:
          excelData.action,

        actionCode:
          getCatalogActionCode(
            catalogItem
          ),

        equipmentId:
          excelData.equipmentId,

        company:
          excelData.company,

        inspectionDate:
          "",

        status:
          excelData.status,

        selected: [
          excelData.status,
        ],

        multiple:
          group.length > 1,

        comment:
          excelData.comment,
      });
    }
  }

  parsedRows.sort(
    (a, b) =>
      a.excelRow -
      b.excelRow
  );

  if (
    parsedRows.length === 0
  ) {
    throw new Error(
      `El archivo ${
        fileName || "Excel"
      } ha sido leído correctamente, pero no se ha podido emparejar ninguna fila con el catálogo. Se han revisado ${validRows.length} filas con estado válido. Revisa las observaciones de estructura y catálogo.`
    );
  }

  return {
    centerName:
      text(
        (detected.center as any)
          .name
      ),

    centerCode:
      text(
        (detected.center as any)
          .code
      ),

    centerId:
      String(
        (detected.center as any)
          .id
      ),

    country,

    year:
      detected.year,

    reviewText:
      detected.reviewText ||
      `${period} ${detected.year}`,

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
): string {
  if (
    status ===
    "APTO"
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
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function ImportPage() {
  const [file, setFile] =
    useState<File | null>(
      null
    );

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

  const summary =
    useMemo(() => {
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
        parsed.rows.length *
        3;

      const score = max
        ? Math.round(
            (points /
              max) *
              100
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
    setFile(
      nextFile
    );

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
        parseWorkbook(
          wb,
          nextFile.name
        );

      setParsed(
        result
      );
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

    for (
      const row of parsed.rows
    ) {
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
          row.inspectionDate ||
          current.date,

        equipmentId:
          row.equipmentId ||
          current.equipmentId,

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

        [key]:
          review,
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
            El importador reconoce automáticamente las
            distintas versiones de la plantilla STL y adapta
            las columnas a la estructura real del documento.
          </p>

          <p className="mt-2">
            Se soportan las plantillas modernas y legacy,
            incluyendo celdas combinadas de Instalación,
            Código y Actuación.
          </p>

          <p className="mt-2 font-semibold">
            La columna ESTADO determina si la fila se procesa.
            Las filas vacías o con "-" se ignoran.
          </p>

          <p className="mt-2 font-semibold">
            PTE. se interpreta correctamente como PENDIENTE.
          </p>

          <p className="mt-2 font-semibold">
            La identificación del elemento se realiza primero
            mediante INSTALACIÓN + ACTUACIÓN y, cuando la
            plantilla presenta diferencias de descripción, se
            utiliza el código del elemento como referencia
            adicional.
          </p>

          <p className="mt-2 font-semibold">
            Las unidades repetidas conservan los datos propios
            de cada fila y generan códigos .1, .2, .3, etc.,
            cuando corresponde.
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
            onChange={(
              event
            ) => {
              const selectedFile =
                event.target
                  .files?.[0];

              if (
                selectedFile
              ) {
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
                    {
                      parsed.rows.length
                    }
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
                      summary
                        .counts[
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
                      summary
                        .counts[
                        "NO APTO"
                      ]
                    }
                  </div>
                </div>

                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <div className="text-xs font-medium text-orange-700">
                    PENDIENTE
                  </div>

                  <div className="mt-1 text-2xl font-bold text-orange-800">
                    {
                      summary
                        .counts[
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
                se procesan únicamente filas con un estado
                reconocido. Las filas vacías o con "-" se
                ignoran. Se respetan las celdas combinadas y
                cada fila conserva su propio ID, empresa,
                estado y comentario.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Elementos detectados
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Cada línea mantiene los datos correspondientes
                  a su propia fila del Excel.
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
                      Las filas vacías o con "-" no se
                      importan. Las diferencias de catálogo
                      se muestran aquí para poder revisarlas
                      antes de confirmar.
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
                            Elementos sin correspondencia:
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
