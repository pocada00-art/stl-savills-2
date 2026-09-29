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

const HEADER_SCAN_ROWS = 100;
const MAX_DATA_ROWS = 2000;

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

function compactNormalize(value: unknown): string {
  return normalize(value)
    .replace(/[.:;,_/\\()[\]{}'"`´\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HEADER_ALIASES = {
  INSTALLATION: [
    "instalacion",
    "instalación",
    "instalaciones",
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
    "id elemento",
    "identificador",
  ],
  COMPANY: [
    "empresa",
    "mantenedora",
    "mantenimiento",
  ],
  STATUS: [
    "estado",
    "status",
    "resultado",
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
    "codigo stl",
    "código stl",
  ],
} as const;

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

function detectExcelColumns(
  rows: any[][]
): ExcelColumnMap {
  let bestRow = -1;
  let bestScore = -1;

  let bestColumns: Partial<ExcelColumnMap> =
    {};

  const scanLimit = Math.min(
    HEADER_SCAN_ROWS,
    rows.length
  );

  for (
    let rowIndex = 0;
    rowIndex < scanLimit;
    rowIndex += 1
  ) {
    const row = rows[rowIndex] || [];

    const installation =
      findHeaderColumn(
        row,
        [...HEADER_ALIASES.INSTALLATION]
      );

    const action =
      findHeaderColumn(
        row,
        [...HEADER_ALIASES.ACTION]
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

    const code =
      findHeaderColumn(
        row,
        [...HEADER_ALIASES.CODE]
      );

    let score = 0;

    if (installation >= 0) {
      score += 5;
    }

    if (action >= 0) {
      score += 5;
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

    if (code >= 0) {
      score += 2;
    }

    /*
     * Una fila que contiene varios de los encabezados
     * reconocibles tiene prioridad sobre cualquier otra.
     */
    if (score > bestScore) {
      bestScore = score;
      bestRow = rowIndex;

      bestColumns = {
        headerRow: rowIndex,
        code,
        installation,
        action,
        equipmentId,
        company,
        status,
        comment,
      };
    }
  }

  if (
    bestRow < 0 ||
    bestScore < 12
  ) {
    throw new Error(
      "No se ha podido identificar la fila de encabezados de la tabla STL. No se han encontrado suficientes encabezados reconocibles."
    );
  }

  const equipmentId =
    bestColumns.equipmentId ?? -1;

  const company =
    bestColumns.company ?? -1;

  const status =
    bestColumns.status ?? -1;

  const comment =
    bestColumns.comment ?? -1;

  const installation =
    bestColumns.installation ?? -1;

  const action =
    bestColumns.action ?? -1;

  const code =
    bestColumns.code ?? -1;

  if (installation < 0) {
    throw new Error(
      `No se ha podido localizar la columna INSTALACIÓN en la fila de encabezados ${bestRow + 1}.`
    );
  }

  if (action < 0) {
    /*
     * Algunas versiones históricas pueden tener la actuación
     * sin contenido, pero normalmente el encabezado existe.
     *
     * Si no existe, utilizamos la columna siguiente a
     * INSTALACIÓN como respaldo, siempre que no coincida
     * con ninguna de las columnas ya detectadas.
     */
    const candidate =
      installation + 1;

    if (
      candidate >= 0 &&
      candidate !== equipmentId &&
      candidate !== company &&
      candidate !== status &&
      candidate !== comment &&
      candidate !== code
    ) {
      bestColumns.action =
        candidate;
    }
  }

  const finalAction =
    bestColumns.action ?? -1;

  if (finalAction < 0) {
    throw new Error(
      `No se ha podido localizar la columna ACTUACIÓN en la fila de encabezados ${bestRow + 1}.`
    );
  }

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
   * NO utilizamos ya la fórmula:
   *
   *   ID - 3
   *   ID - 2
   *   ID - 4
   *
   * porque no es válida para todas las plantillas.
   *
   * Ejemplo real 2026:
   *
   * C = Instalación
   * D = Código
   * E = Actuación
   * H = ID
   *
   * Ejemplo real 2024:
   *
   * B = Instalación
   * C = Código
   * D = Actuación
   * G = ID
   *
   * Por tanto se utilizan los encabezados detectados.
   */

  return {
    headerRow: bestRow,
    code,
    installation,
    action: finalAction,
    equipmentId,
    company,
    status,
    comment,
  };
}

function getCell(
  rows: any[][],
  row: number,
  column: number
): string {
  if (
    row < 0 ||
    column < 0
  ) {
    return "";
  }

  return text(
    rows[row]?.[column]
  );
}

function findNonLabelValue(
  rows: any[][],
  row: number,
  startColumn: number,
  maxColumns = 8
): string {
  const current =
    rows[row] || [];

  for (
    let offset = 1;
    offset <= maxColumns;
    offset += 1
  ) {
    const column =
      startColumn + offset;

    const candidate =
      text(current[column]);

    const normalized =
      normalize(candidate);

    if (
      candidate &&
      normalized !== "centro" &&
      normalized !== "centro comercial" &&
      normalized !== "revision" &&
      normalized !== "revisión" &&
      normalized !== "tipo"
    ) {
      return candidate;
    }
  }

  return "";
}

function findCellByLabel(
  rows: any[][],
  aliases: string[],
  maxRows = 30
): {
  row: number;
  column: number;
} | null {
  const limit = Math.min(
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

    /*
     * Excel puede representar fechas como
     * números seriales. No intentamos convertirlos
     * aquí si no están dentro del rango esperado.
     */
  }

  const valueText =
    text(value);

  const match =
    valueText.match(
      /\b(20\d{2})\b/
    );

  return match
    ? Number(match[1])
    : 0;
}

function findYearInPositions(
  rows: any[][]
): number {
  /*
   * Posiciones reales conocidas:
   *
   * 2026 -> H7
   * 2024 -> E6
   *
   * También se contemplan G7 y otras posiciones
   * utilizadas por versiones intermedias.
   */
  const positions = [
    [6, 7],
    [6, 4],
    [6, 6],
    [5, 4],
    [2, 4],
    [1, 5],
    [1, 4],
  ];

  for (
    const [row, column] of positions
  ) {
    const year =
      valueToYear(
        rows[row]?.[column]
      );

    if (year) {
      return year;
    }
  }

  return 0;
}

function findYearInTopSection(
  rows: any[][]
): number {
  const limit =
    Math.min(25, rows.length);

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

function findCenterFromKnownPositions(
  rows: any[][]
): string {
  /*
   * Posiciones reales observadas:
   *
   * 2026 -> F2
   * 2025 -> F2 / E2 según versión
   * 2024 -> E3
   */
  const positions = [
    [1, 5],
    [1, 4],
    [2, 4],
    [2, 5],
    [1, 6],
    [2, 6],
  ];

  for (
    const [row, column] of positions
  ) {
    const candidate =
      getCell(
        rows,
        row,
        column
      );

    const normalized =
      normalize(candidate);

    if (
      candidate &&
      normalized !== "centro" &&
      normalized !== "centro comercial"
    ) {
      return candidate;
    }
  }

  return "";
}

function findCenterFromLabel(
  rows: any[][]
): string {
  const centerLabel =
    findCellByLabel(
      rows,
      [
        "centro comercial",
        "centro",
      ]
    );

  if (!centerLabel) {
    return "";
  }

  const direct =
    findNonLabelValue(
      rows,
      centerLabel.row,
      centerLabel.column,
      10
    );

  if (direct) {
    return direct;
  }

  /*
   * Algunas plantillas colocan la etiqueta y el valor
   * en filas diferentes por celdas combinadas.
   */
  for (
    let rowOffset = 1;
    rowOffset <= 3;
    rowOffset += 1
  ) {
    const candidateRow =
      centerLabel.row +
      rowOffset;

    if (
      candidateRow >=
      rows.length
    ) {
      break;
    }

    const row =
      rows[candidateRow] || [];

    for (
      let column = 0;
      column < row.length;
      column += 1
    ) {
      const candidate =
        text(row[column]);

      const normalized =
        normalize(candidate);

      if (
        candidate &&
        normalized !== "centro" &&
        normalized !== "centro comercial"
      ) {
        return candidate;
      }
    }
  }

  return "";
}

function findCenterMatchingDemo(
  rows: any[][]
): any | null {
  const centers =
    (demo.centers as any[]) || [];

  const topValues =
    rows
      .slice(0, 15)
      .flat()
      .map(text)
      .filter(Boolean);

  for (
    const center of centers
  ) {
    const names = [
      text(center?.name),
      text(center?.shortCode),
      text(center?.code),
    ].filter(Boolean);

    for (
      const name of names
    ) {
      const normalizedName =
        normalize(name);

      if (!normalizedName) {
        continue;
      }

      const found =
        topValues.some(
          (value) => {
            const normalizedValue =
              normalize(value);

            return (
              normalizedValue ===
                normalizedName ||
              normalizedValue.includes(
                normalizedName
              ) ||
              normalizedName.includes(
                normalizedValue
              )
            );
          }
        );

      if (found) {
        return center;
      }
    }
  }

  return null;
}

function detectCenter(
  rows: any[][],
  fileName: string
) {
  let centerName =
    findCenterFromKnownPositions(
      rows
    );

  if (!centerName) {
    centerName =
      findCenterFromLabel(
        rows
      );
  }

  const demoCenter =
    findCenterMatchingDemo(
      rows
    );

  /*
   * Si encontramos directamente un centro de demo,
   * utilizamos su nombre real. Esto evita que una celda
   * "CENTRO" sea confundida con el nombre.
   */
  if (
    demoCenter &&
    text(demoCenter?.name)
  ) {
    const normalizedDetected =
      normalize(centerName);

    const normalizedDemo =
      normalize(
        text(demoCenter.name)
      );

    if (
      !normalizedDetected ||
      normalizedDetected ===
        "centro" ||
      normalizedDetected ===
        "centro comercial" ||
      normalizedDetected ===
        "nombre del centro"
    ) {
      centerName =
        text(demoCenter.name);
    } else if (
      normalizedDetected !==
      normalizedDemo
    ) {
      /*
       * Si el valor detectado es un código,
       * nombre corto o variante, preferimos
       * el nombre oficial del centro.
       */
      const possibleIdentifiers = [
        normalize(
          demoCenter?.shortCode
        ),
        normalize(
          demoCenter?.code
        ),
      ].filter(Boolean);

      if (
        possibleIdentifiers.includes(
          normalizedDetected
        )
      ) {
        centerName =
          text(demoCenter.name);
      }
    }
  }

  if (!centerName) {
    throw new Error(
      "No se ha podido localizar el nombre del centro en la cabecera del documento Excel."
    );
  }

  const normalizedCenterName =
    normalize(centerName);

  if (
    normalizedCenterName ===
      "centro" ||
    normalizedCenterName ===
      "centro comercial"
  ) {
    throw new Error(
      "Se ha localizado la etiqueta CENTRO, pero no el nombre real del centro en la cabecera del Excel."
    );
  }

  const reviewPositions = [
    [6, 4],
    [6, 5],
    [6, 6],
    [5, 4],
    [5, 5],
    [1, 5],
    [1, 4],
  ];

  let reviewText = "";

  for (
    const [row, column] of
      reviewPositions
  ) {
    const candidate =
      getCell(
        rows,
        row,
        column
      );

    if (!candidate) {
      continue;
    }

    const normalized =
      normalize(candidate);

    if (
      normalized === "revision" ||
      normalized === "revisión" ||
      normalized === "tipo"
    ) {
      continue;
    }

    reviewText =
      candidate;
    break;
  }

  if (!reviewText) {
    const reviewLabel =
      findCellByLabel(
        rows,
        [
          "tipo de revision",
          "tipo de revisión",
          "revision",
          "revisión",
          "tipo",
        ]
      );

    if (reviewLabel) {
      reviewText =
        findNonLabelValue(
          rows,
          reviewLabel.row,
          reviewLabel.column,
          8
        );
    }
  }

  let year =
    findYearInPositions(
      rows
    );

  if (!year) {
    year =
      findYearInTopSection(
        rows
      );
  }

  const fileNameNormalized =
    normalize(fileName);

  if (!year) {
    const fileYear =
      fileNameNormalized.match(
        /\b(20\d{2})\b/
      );

    if (fileYear) {
      year =
        Number(fileYear[1]);
    }
  }

  if (!year) {
    throw new Error(
      "No se ha podido identificar el año de la revisión en la cabecera del documento Excel. La importación se ha detenido para evitar archivarla en un año incorrecto."
    );
  }

  let center =
    demoCenter;

  if (!center) {
    center =
      (demo.centers as any[]).find(
        (c: any) => {
          const values = [
            normalize(c?.name),
            normalize(c?.shortCode),
            normalize(c?.code),
          ].filter(Boolean);

          return values.includes(
            normalizedCenterName
          );
        }
      );
  }

  if (!center) {
    /*
     * Último intento: búsqueda parcial controlada.
     */
    center =
      (demo.centers as any[]).find(
        (c: any) => {
          const name =
            normalize(c?.name);

          const shortCode =
            normalize(c?.shortCode);

          const code =
            normalize(c?.code);

          return (
            (name &&
              (normalizedCenterName.includes(
                name
              ) ||
                name.includes(
                  normalizedCenterName
                ))) ||
            (shortCode &&
              normalizedCenterName.includes(
                shortCode
              )) ||
            (code &&
              normalizedCenterName ===
                code)
          );
        }
      );
  }

  if (!center) {
    throw new Error(
      `No se ha podido identificar el centro "${centerName}" en la base de centros.`
    );
  }

  return {
    name:
      text(center.name),

    code:
      text(center.code),

    center,

    year,

    reviewText,

    fileName:
      fileNameNormalized,
  };
}

function detectPeriodInText(
  value: string
): Period | "" {
  const source =
    compactNormalize(value);

  if (!source) {
    return "";
  }

  /*
   * Formatos directos:
   *
   * S1
   * S2
   * S-1
   * S.2
   * S 1
   */
  if (
    /(?:^|\s)s[\s._-]*1(?:\s|$)/.test(
      source
    )
  ) {
    return "S1";
  }

  if (
    /(?:^|\s)s[\s._-]*2(?:\s|$)/.test(
      source
    )
  ) {
    return "S2";
  }

  /*
   * Semestres.
   */
  if (
    source.includes(
      "semestre 1"
    ) ||
    source.includes(
      "1 semestre"
    ) ||
    source.includes(
      "primer semestre"
    ) ||
    source.includes(
      "primer semestre"
    )
  ) {
    return "S1";
  }

  if (
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

  /*
   * Revisión 1 / Revisión 2.
   */
  if (
    /(?:revision|revisión|rev)\s*(?:n[ºo.]?\s*)?1\b/.test(
      source
    )
  ) {
    return "S1";
  }

  if (
    /(?:revision|revisión|rev)\s*(?:n[ºo.]?\s*)?2\b/.test(
      source
    )
  ) {
    return "S2";
  }

  /*
   * 1ª revisión / 2ª revisión
   * 1º revisión / 2º revisión
   * 1a revisión / 2a revisión
   */
  if (
    /\b1\s*(?:ª|º|a|o)?\s*(?:revision|revisión)\b/.test(
      source
    )
  ) {
    return "S1";
  }

  if (
    /\b2\s*(?:ª|º|a|o)?\s*(?:revision|revisión)\b/.test(
      source
    )
  ) {
    return "S2";
  }

  /*
   * Formato "REV 1" / "REV 2".
   */
  if (
    /\brev\s*1\b/.test(source)
  ) {
    return "S1";
  }

  if (
    /\brev\s*2\b/.test(source)
  ) {
    return "S2";
  }

  return "";
}

function detectPeriod(
  reviewText: string,
  fileName: string,
  rows: any[][]
): Period {
  /*
   * Es importante revisar cada fuente por separado.
   * No buscamos primero todos los S1 y después todos los S2,
   * porque un documento puede contener referencias históricas
   * a ambos periodos.
   *
   * Prioridad:
   *
   * 1. texto de revisión de la cabecera
   * 2. nombre del archivo
   * 3. resto de la cabecera
   */
  const sources = [
    reviewText,
    fileName,
    rows
      .slice(0, 20)
      .flat()
      .map(text)
      .filter(Boolean)
      .join(" "),
  ];

  for (
    const source of sources
  ) {
    const period =
      detectPeriodInText(
        source
      );

    if (period) {
      return period;
    }
  }

  throw new Error(
    `No se ha podido identificar si la revisión "${reviewText || fileName}" corresponde a S1 o S2. Se han probado S1/S2, semestre, revisión 1/2 y formatos 1ª/2ª revisión.`
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
  const normalized =
    compactNormalize(value);

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
    normalized ===
      "pte" ||
    normalized ===
      "pte"
  ) {
    return "PENDIENTE";
  }

  if (
    normalized ===
      "sin informacion" ||
    normalized ===
      "sin info" ||
    normalized ===
      "error"
  ) {
    return "SIN INFORMACIÓN";
  }

  return "";
}

function getCatalogInstallation(
  item: any
): string {
  return catalogText(
    item,
    [
      "installation",
      "instalacion",
      "INSTALACION",
      "install",
      "installationName",
      "nombreInstalacion",
    ]
  );
}

function getCatalogAction(
  item: any
): string {
  return catalogText(
    item,
    [
      "action",
      "actuacion",
      "ACTUACION",
      "actuation",
      "actionName",
      "nombreActuacion",
    ]
  );
}

function getCatalogCode(
  item: any
): string {
  return catalogText(
    item,
    [
      "actionCode",
      "baseCode",
      "code",
      "codigo",
      "codigoElemento",
    ]
  );
}

function findCatalogItems(
  catalogItems: any[],
  installation: string,
  action: string,
  baseCode = ""
): any[] {
  const normalizedInstallation =
    normalize(installation);

  const normalizedAction =
    normalize(action);

  const normalizedCode =
    normalize(baseCode);

  if (!normalizedInstallation) {
    return [];
  }

  /*
   * Regla principal:
   *
   * INSTALACION + ACTUACION
   */
  if (normalizedAction) {
    const exactMatches =
      catalogItems.filter(
        (item) => {
          const catalogInstallation =
            getCatalogInstallation(
              item
            );

          const catalogAction =
            getCatalogAction(
              item
            );

          return (
            normalize(
              catalogInstallation
            ) ===
              normalizedInstallation &&
            normalize(
              catalogAction
            ) ===
              normalizedAction
          );
        }
      );

    if (
      exactMatches.length > 0
    ) {
      return exactMatches;
    }
  }

  /*
   * Compatibilidad con la plantilla histórica 2024:
   *
   * en determinadas filas la ACTUACION está vacía.
   *
   * En ese caso NO inventamos una actuación.
   * Utilizamos el código real del Excel como referencia
   * secundaria para localizar el elemento del catálogo.
   */
  if (
    !normalizedAction &&
    normalizedCode
  ) {
    const codeMatches =
      catalogItems.filter(
        (item) => {
          const catalogInstallation =
            getCatalogInstallation(
              item
            );

          const catalogCode =
            getCatalogCode(
              item
            );

          return (
            normalize(
              catalogInstallation
            ) ===
              normalizedInstallation &&
            normalize(
              catalogCode
            ) ===
              normalizedCode
          );
        }
      );

    if (
      codeMatches.length > 0
    ) {
      return codeMatches;
    }

    /*
     * Segundo intento por código sin depender
     * del formato textual de la instalación.
     */
    const codeOnlyMatches =
      catalogItems.filter(
        (item) =>
          normalize(
            getCatalogCode(item)
          ) === normalizedCode
      );

    if (
      codeOnlyMatches.length > 0
    ) {
      return codeOnlyMatches;
    }
  }

  return [];
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
    const value of possibleValues
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
      "codigo",
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
        rows[previous]?.[column]
      );

    if (value) {
      /*
       * No queremos recuperar el nombre de una cabecera
       * como valor de una fila de datos.
       */
      const normalized =
        normalize(value);

      if (
        normalized ===
          "instalacion" ||
        normalized ===
          "actuacion" ||
        normalized ===
          "codigo" ||
        normalized ===
          "id" ||
        normalized ===
          "empresa" ||
        normalized ===
          "estado" ||
        normalized ===
          "comentario"
      ) {
        continue;
      }

      return value;
    }
  }

  return "";
}

function duplicateGroupKey(
  installation: string,
  action: string,
  code: string
): string {
  const normalizedInstallation =
    normalize(installation);

  const normalizedAction =
    normalize(action);

  /*
   * Para las plantillas normales:
   *
   *   Instalación + Actuación
   *
   * Para la plantilla histórica 2024 cuando Actuación
   * está vacía:
   *
   *   Instalación + Código
   *
   * Esto evita juntar elementos diferentes de una misma
   * instalación.
   */
  if (!normalizedAction) {
    return [
      normalizedInstallation,
      "__SIN_ACTUACION__",
      normalize(code),
    ].join("|");
  }

  return [
    normalizedInstallation,
    normalizedAction,
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
    !rows.length
  ) {
    throw new Error(
      "La hoja Excel está vacía."
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
        row[columns.status]
      );

    /*
     * ESTADO vacío:
     * se ignora completamente.
     */
    if (!rawStatus) {
      continue;
    }

    const status =
      statusFromExcel(
        rawStatus
      );

    if (!status) {
      excluded += 1;

      warnings.push(
        `Fila ${rowIndex + 1}: el valor de ESTADO "${rawStatus}" no es un estado reconocido. La fila no se ha importado.`
      );

      continue;
    }

    const code =
      forwardFill(
        rows,
        rowIndex,
        columns.code,
        text(
          row[columns.code]
        )
      );

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

    const action =
      forwardFill(
        rows,
        rowIndex,
        columns.action,
        text(
          row[
            columns.action
          ]
        )
      );

    if (!installation) {
      unmatched += 1;

      warnings.push(
        `Fila ${rowIndex + 1}: tiene un estado válido "${rawStatus}", pero no se ha podido obtener INSTALACIÓN.`
      );

      continue;
    }

    /*
     * ACTUACIÓN puede estar vacía en la plantilla 2024.
     *
     * No rechazamos automáticamente la fila.
     * findCatalogItems utilizará el código como
     * referencia secundaria en ese caso.
     */

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
      text(
        row[
          columns.comment
        ]
      );

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
        row.action,
        row.code
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
     * El código base se toma del primer código disponible
     * del grupo, tal como exige la regla de importación.
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
          )}: no se ha encontrado ningún código base en la columna C/D correspondiente. Se han omitido para evitar generar códigos incorrectos.`
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
        `Código "${baseCode}": no existe en el catálogo una correspondencia para INSTALACIÓN "${firstRow.installation}"${
          firstRow.action
            ? ` + ACTUACIÓN "${firstRow.action}"`
            : " utilizando el código histórico como referencia"
        }. Se han omitido ${group.length} unidad${
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
        `Código "${baseCode}": se han encontrado ${group.length} unidades en el Excel, pero solamente existen ${catalogMatches.length} elementos equivalentes en el catálogo. Se importarán las ${Math.min(
          group.length,
          catalogMatches.length
        )} primeras.`
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

  return {
    centerName:
      text(
        detected.center?.name
      ),

    centerCode:
      text(
        detected.center?.code
      ),

    centerId:
      String(
        detected.center?.id
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
    status === "NO APTO"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (
    status === "PENDIENTE"
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
      !summary ||
      parsed.rows.length === 0
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
            El importador reconoce las diferentes versiones de las plantillas STL y localiza sus encabezados reales.
          </p>

          <p className="mt-2">
            Se detectan automáticamente Código, Instalación, Actuación, ID, Empresa, Estado y Comentario.
          </p>

          <p className="mt-2 font-semibold">
            La columna ESTADO determina si una fila se procesa. Las filas con ESTADO vacío se ignoran completamente.
          </p>

          <p className="mt-2 font-semibold">
            La identificación normal se realiza mediante INSTALACIÓN + ACTUACIÓN. En la plantilla histórica 2024, cuando ACTUACIÓN está vacía, se utiliza el código histórico como referencia secundaria.
          </p>

          <p className="mt-2 font-semibold">
            Las unidades repetidas conservan los datos de su propia fila y reciben los códigos .1, .2, .3, etc., cuando corresponde.
          </p>

          <p className="mt-2 font-semibold">
            La revisión y el año se obtienen de la cabecera del documento y, cuando es necesario, del nombre del archivo.
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
                únicamente se procesan filas cuyo ESTADO sea reconocido.
                Las filas con ESTADO vacío se ignoran.
                La identificación normal se realiza mediante INSTALACIÓN + ACTUACIÓN.
                En la plantilla histórica 2024, cuando ACTUACIÓN está vacía,
                se utiliza el código como referencia secundaria.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Elementos detectados
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Cada línea mantiene los datos correspondientes a su propia fila del Excel.
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
                      Las filas con ESTADO vacío se ignoran.
                      Las filas con estado no reconocido o sin
                      correspondencia con el catálogo aparecen aquí.
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
