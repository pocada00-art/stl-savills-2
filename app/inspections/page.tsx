"use client";

import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import Link from "next/link";

import {
  Search,
  LayoutGrid,
  List,
  ArrowUpDown,
  FileDown,
  ChevronUp,
  ChevronDown,
  CalendarDays,
  EyeOff,
  Eye,
  Minus,
} from "lucide-react";

import {
  Card,
  SectionTitle,
  Badge,
  Select,
  Button,
} from "@/components/ui";

import { demo } from "@/lib/data";

import {
  loadState,
  saveState,
  resolveCenters,
  reviewKey,
  reviewSummary,
  blankItem,
  CURRENT_YEAR,
  CURRENT_PERIOD,
  type Period,
  type V1Country,
  type V1State,
  type V1Status,
} from "@/lib/v1-state";

/* =========================================================
 * TIPOS
 * ========================================================= */

type ViewMode =
  | "summary"
  | "matrix";

type SortKey =
  | "code"
  | "name"
  | "status"
  | "score"
  | "apto"
  | "condicionado"
  | "noApto"
  | "pendiente"
  | "confirmation";

type SortDirection =
  | "asc"
  | "desc";

type HistoricalReview = {
  year: number;
  period: Period;
  date: string;
  status: V1Status;
  item: ReturnType<
    typeof blankItem
  >;
};

type SummaryColumnKey =
  | "code"
  | "name"
  | "status"
  | "score"
  | "apto"
  | "condicionado"
  | "noApto"
  | "pendiente"
  | "confirmation";

/* =========================================================
 * COLUMNAS DEL RESUMEN
 * ========================================================= */

const SUMMARY_COLUMNS: {
  key: SummaryColumnKey;
  label: string;
  sortKey?: SortKey;
}[] = [
  {
    key: "code",
    label: "Nº centro",
    sortKey: "code",
  },
  {
    key: "name",
    label: "Centro",
    sortKey: "name",
  },
  {
    key: "status",
    label: "Estado",
    sortKey: "status",
  },
  {
    key: "score",
    label: "Cumplimiento",
    sortKey: "score",
  },
  {
    key: "apto",
    label: "Apto",
    sortKey: "apto",
  },
  {
    key: "condicionado",
    label: "Apto condicionado",
    sortKey: "condicionado",
  },
  {
    key: "noApto",
    label: "No apto",
    sortKey: "noApto",
  },
  {
    key: "pendiente",
    label: "Pendiente",
    sortKey: "pendiente",
  },
  {
    key: "confirmation",
    label: "Confirmación",
    sortKey: "confirmation",
  },
];

const SUMMARY_DEFAULT_WIDTHS: Record<
  SummaryColumnKey,
  number
> = {
  code: 105,
  name: 250,
  status: 175,
  score: 125,
  apto: 90,
  condicionado: 135,
  noApto: 105,
  pendiente: 105,
  confirmation: 190,
};

const SUMMARY_MIN_WIDTHS: Record<
  SummaryColumnKey,
  number
> = {
  code: 72,
  name: 140,
  status: 120,
  score: 100,
  apto: 65,
  condicionado: 90,
  noApto: 75,
  pendiente: 75,
  confirmation: 145,
};

/* =========================================================
 * FRECUENCIAS
 * ========================================================= */

/**
 * Convierte la frecuencia de revisión en meses.
 *
 * Ejemplos:
 *
 * - mensual       → 1
 * - bimensual     → 2
 * - trimestral    → 3
 * - cuatrimestral → 4
 * - semestral     → 6
 * - anual         → 12
 * - bienal        → 24
 *
 * También admite valores numéricos:
 *
 * - "6 meses" → 6
 * - "1 año"   → 12
 * - "2 años"  → 24
 */
function parseFrequency(
  frequency: string
): { months: number } | null {
  const value =
    String(frequency || "")
      .trim()
      .toLowerCase();

  if (!value) {
    return null;
  }

  if (
    value.includes(
      "bimensual"
    )
  ) {
    return {
      months: 2,
    };
  }

  if (
    value.includes(
      "mensual"
    )
  ) {
    return {
      months: 1,
    };
  }

  if (
    value.includes(
      "trimestral"
    )
  ) {
    return {
      months: 3,
    };
  }

  if (
    value.includes(
      "cuatrimestral"
    )
  ) {
    return {
      months: 4,
    };
  }

  if (
    value.includes(
      "semestral"
    )
  ) {
    return {
      months: 6,
    };
  }

  if (
    value.includes(
      "bienal"
    )
  ) {
    return {
      months: 24,
    };
  }

  if (
    value.includes(
      "anual"
    )
  ) {
    return {
      months: 12,
    };
  }

  const numericWithUnit =
    value.match(
      /^(\d+(?:[.,]\d+)?)\s*(mes|meses|año|años)$/
    );

  if (numericWithUnit) {
    const amount =
      Number(
        numericWithUnit[1].replace(
          ",",
          "."
        )
      );

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      return null;
    }

    if (
      value.includes(
        "año"
      ) ||
      value.includes(
        "años"
      )
    ) {
      return {
        months:
          Math.round(
            amount * 12
          ),
      };
    }

    return {
      months:
        Math.round(
          amount
        ),
    };
  }

  /*
   * Si se introduce únicamente un número,
   * se interpreta como años.
   *
   * Ejemplo:
   * "1" → 12 meses
   * "2" → 24 meses
   */
  const numericOnly =
    value.match(
      /^\d+(?:[.,]\d+)?$/
    );

  if (numericOnly) {
    const years =
      Number(
        value.replace(
          ",",
          "."
        )
      );

    if (
      !Number.isFinite(
        years
      ) ||
      years <= 0
    ) {
      return null;
    }

    return {
      months:
        Math.round(
          years * 12
        ),
    };
  }

  return null;
}

/**
 * Calcula la próxima revisión.
 *
 * Se conserva el día original siempre que sea posible.
 *
 * Si el día no existe en el mes de destino,
 * se utiliza el último día disponible.
 */
function calculateNextReview(
  date: string,
  frequency: string
): string {
  if (
    !date ||
    !frequency
  ) {
    return "";
  }

  const normalizedFrequency =
    String(frequency)
      .trim()
      .toLowerCase();

  if (
    normalizedFrequency ===
    "inicial"
  ) {
    return "";
  }

  const parsedFrequency =
    parseFrequency(
      frequency
    );

  if (
    !parsedFrequency ||
    !Number.isFinite(
      parsedFrequency.months
    ) ||
    parsedFrequency.months <= 0
  ) {
    return "";
  }

  const match =
    date.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!match) {
    return "";
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  if (
    !Number.isInteger(
      year
    ) ||
    !Number.isInteger(
      month
    ) ||
    !Number.isInteger(
      day
    ) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return "";
  }

  const targetMonthIndex =
    month -
    1 +
    parsedFrequency.months;

  const targetYear =
    year +
    Math.floor(
      targetMonthIndex /
        12
    );

  const targetMonth =
    ((targetMonthIndex %
      12) +
      12) %
    12;

  const lastDayOfTargetMonth =
    new Date(
      targetYear,
      targetMonth + 1,
      0
    ).getDate();

  const targetDay =
    Math.min(
      day,
      lastDayOfTargetMonth
    );

  const finalDate =
    new Date(
      targetYear,
      targetMonth,
      targetDay
    );

  finalDate.setHours(
    0,
    0,
    0,
    0
  );

  if (
    Number.isNaN(
      finalDate.getTime()
    )
  ) {
    return "";
  }

  const finalYear =
    finalDate.getFullYear();

  const finalMonth =
    String(
      finalDate.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const finalDay =
    String(
      finalDate.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${finalYear}-${finalMonth}-${finalDay}`;
}

/* =========================================================
 * FECHAS
 * ========================================================= */

function formatMonthYear(
  value: string
): string {
  if (!value) {
    return "";
  }

  const match =
    value.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!match) {
    return "";
  }

  return `${match[2]}/${match[1].slice(-2)}`;
}

function dateValue(
  value: string
): number {
  if (!value) {
    return 0;
  }

  const time =
    new Date(
      `${value}T00:00:00`
    ).getTime();

  return Number.isNaN(
    time
  )
    ? 0
    : time;
}

/* =========================================================
 * CÓDIGO DE CENTRO
 * ========================================================= */

/**
 * Formato oficial del número/código del centro.
 *
 * 1    → 01
 * 8    → 08
 * 11   → 11
 * 14.4 → 14.4
 * 1.4  → 01.4
 */
function formatCenterCode(
  value: unknown
): string {
  const raw =
    String(
      value ?? ""
    )
      .trim()
      .replace(
        ",",
        "."
      );

  if (!raw) {
    return "";
  }

  if (
    /^\d+(?:\.\d+)?$/.test(
      raw
    )
  ) {
    const [
      integerPart,
      decimalPart,
    ] =
      raw.split(".");

    const paddedInteger =
      integerPart.padStart(
        2,
        "0"
      );

    return decimalPart !==
      undefined
      ? `${paddedInteger}.${decimalPart}`
      : paddedInteger;
  }

  return raw.toUpperCase();
}

/* =========================================================
 * ESTADOS / COLORES
 * ========================================================= */

function getStatusClasses(
  status: V1Status
) {
  switch (status) {
    case "APTO":
      return {
        badge:
          "bg-emerald-100 text-emerald-700 border-emerald-200",
        dot:
          "bg-emerald-500",
        letter:
          "A",
      };

    case "APTO CONDICIONADO":
      return {
        badge:
          "bg-amber-100 text-amber-700 border-amber-200",
        dot:
          "bg-amber-500",
        letter:
          "C",
      };

    case "NO APTO":
      return {
        badge:
          "bg-red-100 text-red-700 border-red-200",
        dot:
          "bg-red-500",
        letter:
          "N",
      };

    case "PENDIENTE":
      return {
        badge:
          "bg-orange-100 text-orange-700 border-orange-200",
        dot:
          "bg-orange-500",
        letter:
          "P",
      };

    default:
      return {
        badge:
          "bg-slate-100 text-slate-500 border-slate-200",
        dot:
          "bg-slate-400",
        letter:
          "S",
      };
  }
}

/**
 * Texto corto y legible para el estado global.
 */
function formatOverallStatus(
  status:
    | V1Status
    | "EN CURSO"
): string {
  switch (status) {
    case "APTO":
      return "Apto";

    case "APTO CONDICIONADO":
      return "Apto condicionado";

    case "NO APTO":
      return "No apto";

    case "PENDIENTE":
      return "Pendiente";

    case "SIN INFORMACIÓN":
      return "Sin información";

    default:
      return "En curso";
  }
}

/* =========================================================
 * HISTÓRICO
 * ========================================================= */

function getHistoricalReviews(
  state: V1State,
  centerId: string,
  itemId: string
): HistoricalReview[] {
  const result: HistoricalReview[] =
    [];

  Object.entries(
    state.reviews || {}
  ).forEach(
    ([key, review]) => {
      const expectedPrefix =
        `${centerId}:`;

      if (
        !key.startsWith(
          expectedPrefix
        )
      ) {
        return;
      }

      const match =
        key.match(
          /^(.+):(\d{4}):(S1|S2)$/
        );

      if (!match) {
        return;
      }

      const year =
        Number(
          match[2]
        );

      const period =
        match[3] as Period;

      const item =
        review.items?.[
          itemId
        ];

      if (
        !item ||
        !item.date
      ) {
        return;
      }

      result.push({
        year,
        period,
        date:
          item.date,
        status:
          item.status,
        item,
      });
    }
  );

  return result.sort(
    (a, b) => {
      const dateDifference =
        dateValue(
          b.date
        ) -
        dateValue(
          a.date
        );

      if (
        dateDifference !==
        0
      ) {
        return dateDifference;
      }

      if (
        b.year !==
        a.year
      ) {
        return (
          b.year -
          a.year
        );
      }

      return (
        (b.period ===
        "S2"
          ? 2
          : 1) -
        (a.period ===
        "S2"
          ? 2
          : 1)
      );
    }
  );
}

function getLastReview(
  state: V1State,
  centerId: string,
  itemId: string
): HistoricalReview | null {
  const history =
    getHistoricalReviews(
      state,
      centerId,
      itemId
    );

  return (
    history[0] ||
    null
  );
}

function getNextReview(
  state: V1State,
  centerId: string,
  itemId: string,
  frequency: string
): string {
  const last =
    getLastReview(
      state,
      centerId,
      itemId
    );

  if (!last) {
    return "";
  }

  return calculateNextReview(
    last.date,
    frequency
  );
}

/* =========================================================
 * ORDENACIÓN
 * ========================================================= */

function compareCenterCode(
  a: {
    code?: unknown;
  },
  b: {
    code?: unknown;
  }
): number {
  const aCode =
    String(
      a.code ?? ""
    ).trim();

  const bCode =
    String(
      b.code ?? ""
    ).trim();

  const aNumber =
    Number(aCode);

  const bNumber =
    Number(bCode);

  const aIsNumber =
    aCode !== "" &&
    Number.isFinite(
      aNumber
    );

  const bIsNumber =
    bCode !== "" &&
    Number.isFinite(
      bNumber
    );

  if (
    aIsNumber &&
    bIsNumber
  ) {
    return (
      aNumber -
      bNumber
    );
  }

  if (aIsNumber) {
    return -1;
  }

  if (bIsNumber) {
    return 1;
  }

  return aCode.localeCompare(
    bCode,
    "es",
    {
      numeric: true,
      sensitivity:
        "base",
    }
  );
}

/* =========================================================
 * VALIDACIÓN DE CENTRO
 * ========================================================= */

function getCenterValidationState(
  review: V1State["reviews"][string] | undefined,
  activeIds: string[]
) {
  const items =
    activeIds.map(
      itemId =>
        review?.items?.[
          itemId
        ] ||
        blankItem()
    );

  const pending =
    items.filter(
      item =>
        item.status ===
          "PENDIENTE" ||
        item.status ===
          "SIN INFORMACIÓN"
    ).length;

  const total =
    items.length;

  const reviewed =
    total - pending;

  const allReviewed =
    total > 0 &&
    pending === 0 &&
    reviewed === total;

  let overallStatus:
    | V1Status
    | "EN CURSO" =
    "EN CURSO";

  if (
    review?.confirmed
  ) {
    if (
      items.some(
        item =>
          item.status ===
          "NO APTO"
      )
    ) {
      overallStatus =
        "NO APTO";
    } else if (
      items.some(
        item =>
          item.status ===
          "APTO CONDICIONADO"
      )
    ) {
      overallStatus =
        "APTO CONDICIONADO";
    } else if (
      items.some(
        item =>
          item.status ===
            "PENDIENTE" ||
          item.status ===
            "SIN INFORMACIÓN"
      )
    ) {
      overallStatus =
        "PENDIENTE";
    } else if (
      items.length > 0 &&
      items.every(
        item =>
          item.status ===
          "APTO"
      )
    ) {
      overallStatus =
        "APTO";
    } else {
      overallStatus =
        "SIN INFORMACIÓN";
    }
  }

  return {
    total,
    reviewed,
    pending,
    allReviewed,
    overallStatus,
  };
}

/* =========================================================
 * TEXTO CORTO PARA MATRIZ
 * ========================================================= */

function getMatrixShortTitle(
  item: any
): string {
  const code =
    String(
      item.code ?? ""
    ).trim();

  const installation =
    String(
      item.installation ??
        ""
    )
      .trim()
      .toLowerCase();

  if (
    installation.includes(
      "ascensor"
    ) ||
    installation.includes(
      "montacarga"
    ) ||
    installation.includes(
      "montacargas"
    )
  ) {
    return `Ascen. ${code}`;
  }

  if (
    installation.includes(
      "alta tensión"
    ) ||
    installation.includes(
      "alta tension"
    )
  ) {
    return "A.T.";
  }

  if (
    installation.includes(
      "baja tensión"
    ) ||
    installation.includes(
      "baja tension"
    )
  ) {
    return "B.T.";
  }

  if (
    installation.includes(
      "protección contra incendios"
    ) ||
    installation.includes(
      "proteccion contra incendios"
    )
  ) {
    return "P.C.I.";
  }

  if (
    installation.includes(
      "climatización"
    ) ||
    installation.includes(
      "climatizacion"
    )
  ) {
    return "Clim.";
  }

  if (
    installation.includes(
      "instalación eléctrica"
    ) ||
    installation.includes(
      "instalacion electrica"
    ) ||
    installation.includes(
      "eléctrica"
    ) ||
    installation.includes(
      "electrica"
    )
  ) {
    return "I.E.";
  }

  if (
    installation.includes(
      "gas"
    )
  ) {
    return "Gas";
  }

  if (
    installation.includes(
      "fontanería"
    ) ||
    installation.includes(
      "fontaneria"
    )
  ) {
    return "Font.";
  }

  if (
    installation.includes(
      "puertas"
    )
  ) {
    return "Puert.";
  }

  if (
    installation.includes(
      "cubierta"
    )
  ) {
    return "Cub.";
  }

  if (
    installation.includes(
      "estructura"
    )
  ) {
    return "Estr.";
  }

  if (
    installation.includes(
      "aparatos a presión"
    ) ||
    installation.includes(
      "aparatos a presion"
    )
  ) {
    return "A.P.";
  }

  if (
    installation.includes(
      "instalación térmica"
    ) ||
    installation.includes(
      "instalacion termica"
    )
  ) {
    return "I.T.";
  }

  const clean =
    String(
      item.installation ||
        item.action ||
        item.category ||
        ""
    )
      .trim();

  if (!clean) {
    return code;
  }

  if (
    clean.length <= 18
  ) {
    return code
      ? `${code} · ${clean}`
      : clean;
  }

  const shortened =
    `${clean.slice(
      0,
      17
    )}…`;

  return code
    ? `${code} · ${shortened}`
    : shortened;
}

/* =========================================================
 * COMPONENTE
 * ========================================================= */

export default function Inspections() {
  const [
    country,
    setCountry,
  ] =
    useState<V1Country>(
      "España"
    );

  const [
    q,
    setQ,
  ] = useState("");

  const [
    period,
    setPeriod,
  ] =
    useState<Period>(
      CURRENT_PERIOD
    );

  const [
    year,
    setYear,
  ] =
    useState(
      CURRENT_YEAR
    );

  const [
    mode,
    setMode,
  ] =
    useState<ViewMode>(
      "summary"
    );

  const [
    showLast,
    setShowLast,
  ] =
    useState(false);

  const [
    showNext,
    setShowNext,
  ] =
    useState(false);

  const [
    category,
    setCategory,
  ] =
    useState("Todas");

  const [
    state,
    setState,
  ] =
    useState<V1State>(
      loadState()
    );

  const [
    sortKey,
    setSortKey,
  ] =
    useState<SortKey>(
      "code"
    );

  const [
    sortDirection,
    setSortDirection,
  ] =
    useState<SortDirection>(
      "asc"
    );

  const [
    savedStateLoaded,
    setSavedStateLoaded,
  ] =
    useState(false);

  const [
    columnWidths,
    setColumnWidths,
  ] =
    useState<
      Record<
        SummaryColumnKey,
        number
      >
    >(
      SUMMARY_DEFAULT_WIDTHS
    );

  const [
    hiddenColumns,
    setHiddenColumns,
  ] =
    useState<
      Record<
        SummaryColumnKey,
        boolean
      >
    >({
      code: false,
      name: false,
      status: false,
      score: false,
      apto: false,
      condicionado: false,
      noApto: false,
      pendiente: false,
      confirmation: false,
    });

  /* =======================================================
   * CARGA Y SINCRONIZACIÓN DEL ESTADO
   * ======================================================= */

  useEffect(() => {
    const loaded =
      loadState();

    setState(
      loaded
    );

    setSavedStateLoaded(
      true
    );
  }, []);

  useEffect(() => {
    const refreshState =
      () => {
        setState(
          loadState()
        );
      };

    window.addEventListener(
      "storage",
      refreshState
    );

    window.addEventListener(
      "stl-role-change",
      refreshState
    );

    window.addEventListener(
      "stl-state-change",
      refreshState
    );

    return () => {
      window.removeEventListener(
        "storage",
        refreshState
      );

      window.removeEventListener(
        "stl-role-change",
        refreshState
      );

      window.removeEventListener(
        "stl-state-change",
        refreshState
      );
    };
  }, []);

  /* =======================================================
   * CENTROS RESUELTOS
   * ======================================================= */

  const centers =
    useMemo(() => {
      /*
       * La resolución de centros está centralizada
       * exclusivamente en lib/v1-state.ts.
       */
      return resolveCenters(
        demo.centers,
        state
      )
        .filter(
          center =>
            center.country ===
              country &&
            center.status ===
              "Activo"
        )
        .sort(
          compareCenterCode
        );
    }, [
      country,
      state,
    ]);

  /* =======================================================
   * CATÁLOGO
   * ======================================================= */

  const catalog =
    useMemo(() => {
      return country ===
        "España"
        ? demo.esCatalog
        : demo.ptCatalog;
    }, [
      country,
    ]);

  /* =======================================================
   * CATEGORÍAS
   * ======================================================= */

  const categories =
    useMemo(() => {
      return [
        "Todas",
        ...Array.from(
          new Set(
            catalog
              .map(
                (item: any) =>
                  item.category
              )
              .filter(Boolean)
          )
        ),
      ];
    }, [
      catalog,
    ]);

  /* =======================================================
   * MATRIZ
   * ======================================================= */

  /**
   * IMPORTANTE:
   *
   * La búsqueda NO filtra las columnas de la matriz.
   *
   * De esta forma, si buscamos un centro,
   * siguen apareciendo todos sus elementos.
   *
   * La categoría sí determina las columnas visibles.
   */
  const matrixItems =
    useMemo(() => {
      return catalog.filter(
        (item: any) =>
          category ===
            "Todas" ||
          item.category ===
            category
      );
    }, [
      catalog,
      category,
    ]);

  /* =======================================================
   * RESUMEN / FILAS
   * ======================================================= */

  const rows =
    useMemo(() => {
      const normalizedQuery =
        q
          .trim()
          .toLowerCase();

      const result =
        centers
          .map(
            center => {
              /*
               * Un elemento está activo salvo que exista
               * expresamente como false para ese centro.
               */
              const active =
                catalog.filter(
                  (item: any) =>
                    state
                      .activeItems?.[
                      center.id
                    ]?.[
                      item.id
                    ] !== false
                );

              const review =
                state
                  .reviews?.[
                  reviewKey(
                    center.id,
                    year,
                    period
                  )
                ];

              const summary =
                reviewSummary(
                  review,
                  active.map(
                    (item: any) =>
                      item.id
                  )
                );

              const validation =
                getCenterValidationState(
                  review,
                  active.map(
                    (item: any) =>
                      String(
                        item.id
                      )
                  )
                );

              return {
                c:
                  center,
                active,
                review,
                summary,
                validation,
              };
            }
          )
          .filter(
            row => {
              if (
                !normalizedQuery
              ) {
                return true;
              }

              const centerText =
                `${row.c.name} ${
                  row.c.code
                } ${
                  row.c.shortCode ||
                  ""
                }`
                  .toLowerCase();

              if (
                centerText.includes(
                  normalizedQuery
                )
              ) {
                return true;
              }

              /*
               * En Matriz también permitimos buscar
               * por elemento, pero solo mostramos
               * los centros que contienen ese elemento.
               *
               * Las columnas de la matriz NO se reducen.
               */
              if (
                mode ===
                "matrix"
              ) {
                return row.active.some(
                  (item: any) => {
                    const itemText =
                      `${item.code} ${
                        item.installation
                      } ${
                        item.action
                      } ${
                        item.category ||
                        ""
                      }`
                        .toLowerCase();

                    return itemText.includes(
                      normalizedQuery
                    );
                  }
                );
              }

              return false;
            }
          );

      result.sort(
        (a, b) => {
          let comparison =
            0;

          switch (
            sortKey
          ) {
            case "code":
              comparison =
                compareCenterCode(
                  a.c,
                  b.c
                );
              break;

            case "name":
              comparison =
                String(
                  a.c.name
                ).localeCompare(
                  String(
                    b.c.name
                  ),
                  "es",
                  {
                    sensitivity:
                      "base",
                  }
                );
              break;

            case "status":
              comparison =
                a.validation.overallStatus.localeCompare(
                  b.validation.overallStatus,
                  "es",
                  {
                    sensitivity:
                      "base",
                  }
                );
              break;

            case "score":
              comparison =
                a.summary.score -
                b.summary.score;
              break;

            case "apto":
              comparison =
                a.summary
                  .counts[
                  "APTO"
                ] -
                b.summary
                  .counts[
                  "APTO"
                ];
              break;

            case "condicionado":
              comparison =
                a.summary
                  .counts[
                  "APTO CONDICIONADO"
                ] -
                b.summary
                  .counts[
                  "APTO CONDICIONADO"
                ];
              break;

            case "noApto":
              comparison =
                a.summary
                  .counts[
                  "NO APTO"
                ] -
                b.summary
                  .counts[
                  "NO APTO"
                ];
              break;

            case "pendiente":
              comparison =
                (
                  a.summary
                    .counts[
                    "PENDIENTE"
                  ] +
                  a.summary
                    .counts[
                    "SIN INFORMACIÓN"
                  ]
                ) -
                (
                  b.summary
                    .counts[
                    "PENDIENTE"
                  ] +
                  b.summary
                    .counts[
                    "SIN INFORMACIÓN"
                  ]
                );
              break;

            case "confirmation":
              comparison =
                Number(
                  a.review
                    ?.confirmed
                ) -
                Number(
                  b.review
                    ?.confirmed
                );

              if (
                comparison ===
                0
              ) {
                comparison =
                  a.validation
                    .pending -
                  b.validation
                    .pending;
              }

              break;
          }

          return (
            sortDirection ===
            "asc"
              ? comparison
              : -comparison
          );
        }
      );

      return result;
    }, [
      centers,
      catalog,
      q,
      state,
      year,
      period,
      sortKey,
      sortDirection,
      mode,
    ]);

  /* =======================================================
   * CELDA MATRIZ
   * ======================================================= */

  function getMatrixCell(
    centerId: string,
    item: any
  ) {
    const review =
      state
        .reviews?.[
        reviewKey(
          centerId,
          year,
          period
        )
      ];

    const itemReview =
      review?.items?.[
        item.id
      ] ||
      blankItem();

    const active =
      state
        .activeItems?.[
        centerId
      ]?.[
        item.id
      ] !== false;

    const lastReview =
      getLastReview(
        state,
        centerId,
        item.id
      );

    const nextReview =
      getNextReview(
        state,
        centerId,
        item.id,
        String(
          item.frequency ||
            ""
        )
      );

    return {
      review,
      itemReview,
      active,
      lastReview,
      nextReview,
    };
  }

  /* =======================================================
   * ORDENACIÓN
   * ======================================================= */

  function handleSort(
    key: SortKey
  ) {
    if (
      sortKey === key
    ) {
      setSortDirection(
        current =>
          current ===
          "asc"
            ? "desc"
            : "asc"
      );

      return;
    }

    setSortKey(
      key
    );

    setSortDirection(
      "asc"
    );
  }

  function SortIcon({
    column,
  }: {
    column: SortKey;
  }) {
    if (
      sortKey !== column
    ) {
      return (
        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" />
      );
    }

    return sortDirection ===
      "asc" ? (
      <ChevronUp className="h-3.5 w-3.5 shrink-0" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
    );
  }

  /* =======================================================
   * COLUMNAS DEL RESUMEN
   * ======================================================= */

  function hideSummaryColumn(
    key: SummaryColumnKey
  ) {
    setHiddenColumns(
      current => ({
        ...current,
        [key]: true,
      })
    );
  }

  function restoreSummaryColumn(
    key: SummaryColumnKey
  ) {
    setHiddenColumns(
      current => ({
        ...current,
        [key]: false,
      })
    );
  }

  function reduceAllSummaryColumns() {
    setColumnWidths(
      {
        code:
          SUMMARY_MIN_WIDTHS.code,
        name:
          SUMMARY_MIN_WIDTHS.name,
        status:
          SUMMARY_MIN_WIDTHS.status,
        score:
          SUMMARY_MIN_WIDTHS.score,
        apto:
          SUMMARY_MIN_WIDTHS.apto,
        condicionado:
          SUMMARY_MIN_WIDTHS.condicionado,
        noApto:
          SUMMARY_MIN_WIDTHS.noApto,
        pendiente:
          SUMMARY_MIN_WIDTHS.pendiente,
        confirmation:
          SUMMARY_MIN_WIDTHS.confirmation,
      }
    );
  }

  function startColumnResize(
    key: SummaryColumnKey,
    event: ReactMouseEvent
  ) {
    event.preventDefault();
    event.stopPropagation();

    const startX =
      event.clientX;

    const startWidth =
      columnWidths[key];

    const handleMouseMove =
      (
        moveEvent: MouseEvent
      ) => {
        const delta =
          moveEvent.clientX -
          startX;

        const nextWidth =
          Math.max(
            SUMMARY_MIN_WIDTHS[
              key
            ],
            startWidth +
              delta
          );

        setColumnWidths(
          current => ({
            ...current,
            [key]:
              nextWidth,
          })
        );
      };

    const handleMouseUp =
      () => {
        window.removeEventListener(
          "mousemove",
          handleMouseMove
        );

        window.removeEventListener(
          "mouseup",
          handleMouseUp
        );
      };

    window.addEventListener(
      "mousemove",
      handleMouseMove
    );

    window.addEventListener(
      "mouseup",
      handleMouseUp
    );
  }

  const visibleSummaryColumns =
    SUMMARY_COLUMNS.filter(
      column =>
        !hiddenColumns[
          column.key
        ]
    );

  const hiddenSummaryColumns =
    SUMMARY_COLUMNS.filter(
      column =>
        hiddenColumns[
          column.key
        ]
    );

  /* =======================================================
   * VALIDACIÓN DEL CENTRO
   * ======================================================= */

  function validateCenter(
    row: (typeof rows)[number]
  ) {
    /*
     * La validación de centro se reserva al administrador,
     * igual que las operaciones de confirmación existentes.
     */
    if (
      state.role !==
      "ADMIN"
    ) {
      return;
    }

    if (
      row.review
        ?.confirmed
    ) {
      return;
    }

    if (
      !row.validation
        .allReviewed
    ) {
      return;
    }

    const key =
      reviewKey(
        row.c.id,
        year,
        period
      );

    const currentReview =
      state.reviews?.[
        key
      ];

    /*
     * No se puede confirmar un centro que no tenga
     * revisión registrada.
     */
    if (
      !currentReview
    ) {
      return;
    }

    /*
     * Comprobación adicional de seguridad:
     * todos los elementos activos deben estar revisados.
     */
    const activeIds =
      row.active.map(
        (item: any) =>
          String(
            item.id
          )
      );

    const pending =
      activeIds.filter(
        itemId => {
          const item =
            currentReview
              .items?.[
              itemId
            ] ||
            blankItem();

          return (
            item.status ===
              "PENDIENTE" ||
            item.status ===
              "SIN INFORMACIÓN"
          );
        }
      );

    if (
      pending.length >
      0
    ) {
      return;
    }

    const now =
      new Date().toISOString();

    const nextReview = {
      ...currentReview,
      confirmed: true,
      confirmedAt:
        now,
      confirmedBy:
        "Administrador",
    };

    const nextState: V1State =
      {
        ...state,
        reviews: {
          ...state.reviews,
          [key]:
            nextReview,
        },
      };

    saveState(
      nextState
    );

    setState(
      nextState
    );

    window.dispatchEvent(
      new Event(
        "stl-state-change"
      )
    );
  }

  /* =======================================================
   * EXPORTACIÓN
   * ======================================================= */

  function exportPdf() {
    window.print();
  }

  /* =======================================================
   * CARGANDO
   * ======================================================= */

  if (
    !savedStateLoaded
  ) {
    return (
      <div className="space-y-6">
        <Card className="p-8">
          <div className="text-sm text-slate-500">
            Cargando plan de inspecciones...
          </div>
        </Card>
      </div>
    );
  }

  /* =======================================================
   * RENDER
   * ======================================================= */

  return (
    <div className="space-y-6 inspections-page">

      {/* =====================================================
       * CABECERA DE IMPRESIÓN
       * ===================================================== */}

      <div className="print-header hidden">
        <div className="text-2xl font-black">
          Plan de inspecciones
        </div>

        <div className="mt-1 text-sm">
          {mode ===
          "summary"
            ? "Informe Resumen"
            : "Informe Matriz"}
        </div>

        <div className="mt-2 text-xs">
          País: {country} · Periodo:{" "}
          {period} {year}
        </div>
      </div>

      {/* =====================================================
       * TÍTULO
       * ===================================================== */}

      <SectionTitle
        title="Plan de inspecciones"
        subtitle="Resumen y matriz de seguimiento técnico-legal por centro y elemento"
      />

      {/* =====================================================
       * FILTROS
       * ===================================================== */}

      <Card className="p-4 no-print">

        <div className="flex flex-wrap gap-3">

          <div className="relative min-w-[260px] flex-1">

            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />

            <input
              value={q}
              onChange={event =>
                setQ(
                  event.target.value
                )
              }
              placeholder={
                mode ===
                "summary"
                  ? "Buscar centro..."
                  : "Buscar centro o elemento..."
              }
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#002A54]"
            />

          </div>

          <Select
            value={country}
            onChange={value => {
              setCountry(
                value as V1Country
              );

              setCategory(
                "Todas"
              );
            }}
          >
            <option value="España">
              España
            </option>

            <option value="Portugal">
              Portugal
            </option>
          </Select>

          <Select
            value={String(
              year
            )}
            onChange={value =>
              setYear(
                Number(
                  value
                )
              )
            }
          >
            <option value="2026">
              2026
            </option>

            <option value="2027">
              2027
            </option>

            <option value="2028">
              2028
            </option>
          </Select>

          <Select
            value={period}
            onChange={value =>
              setPeriod(
                value as Period
              )
            }
          >
            <option value="S1">
              S1
            </option>

            <option value="S2">
              S2
            </option>
          </Select>

          {/* ÚNICO selector de categoría */}
          {mode ===
            "matrix" && (
            <Select
              value={category}
              onChange={
                setCategory
              }
            >
              {categories.map(
                categoryName => (
                  <option
                    key={
                      categoryName
                    }
                    value={
                      categoryName
                    }
                  >
                    {
                      categoryName
                    }
                  </option>
                )
              )}
            </Select>
          )}

          <Button
            variant={
              mode ===
              "summary"
                ? "primary"
                : "secondary"
            }
            onClick={() =>
              setMode(
                "summary"
              )
            }
          >
            <List className="mr-2 inline h-4 w-4" />
            Resumen
          </Button>

          <Button
            variant={
              mode ===
              "matrix"
                ? "primary"
                : "secondary"
            }
            onClick={() =>
              setMode(
                "matrix"
              )
            }
          >
            <LayoutGrid className="mr-2 inline h-4 w-4" />
            Matriz
          </Button>

          <Button
            variant="secondary"
            onClick={
              exportPdf
            }
          >
            <FileDown className="mr-2 inline h-4 w-4" />
            Imprimir
          </Button>

        </div>

        {/* ===================================================
         * FECHAS SOLO EN MATRIZ
         * =================================================== */}

        {mode ===
          "matrix" && (
          <div className="mt-4 flex flex-wrap items-center gap-5 border-t border-slate-100 pt-4">

            <div className="text-xs font-bold text-slate-400">
              Fechas en matriz
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">

              <input
                type="checkbox"
                checked={
                  showLast
                }
                onChange={event =>
                  setShowLast(
                    event.target.checked
                  )
                }
                className="h-4 w-4 rounded border-slate-300"
              />

              <span>
                Última revisión
              </span>

            </label>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">

              <input
                type="checkbox"
                checked={
                  showNext
                }
                onChange={event =>
                  setShowNext(
                    event.target.checked
                  )
                }
                className="h-4 w-4 rounded border-slate-300"
              />

              <span>
                Próxima revisión
              </span>

            </label>

            {(showLast ||
              showNext) && (
              <div className="text-xs text-slate-400">
                Formato de fecha: MM/AA
              </div>
            )}

          </div>
        )}

      </Card>

      {/* =====================================================
       * RESUMEN
       * ===================================================== */}

      {mode ===
        "summary" && (
        <Card className="p-6 summary-report">

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

            <div>
              <div className="text-lg font-black text-slate-800">
                Resumen de cumplimiento
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {country} ·{" "}
                {period}{" "}
                {year}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 no-print">

              <Badge>
                {
                  rows.length
                }{" "}
                centros
              </Badge>

              <button
                type="button"
                onClick={
                  reduceAllSummaryColumns
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                title="Reducir todas las columnas al mínimo"
              >
                <Minus className="h-3.5 w-3.5" />
                Reducir columnas
              </button>

              {hiddenSummaryColumns.length >
                0 && (
                <div className="group relative">

                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                    title="Mostrar columnas ocultas"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Mostrar columnas
                  </button>

                  <div className="invisible absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100">

                    {hiddenSummaryColumns.map(
                      column => (
                        <button
                          key={
                            column.key
                          }
                          type="button"
                          onClick={() =>
                            restoreSummaryColumn(
                              column.key
                            )
                          }
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                        >
                          <span>
                            {
                              column.label
                            }
                          </span>

                          <Eye className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                      )
                    )}

                  </div>

                </div>
              )}

            </div>

          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">

            <table
              className="text-sm"
              style={{
                minWidth:
                  visibleSummaryColumns.reduce(
                    (
                      total,
                      column
                    ) =>
                      total +
                      columnWidths[
                        column.key
                      ],
                    0
                  ),
              }}
            >

              <thead className="bg-[#002A54] text-left text-xs font-bold text-white print-table-header">

                <tr>

                  {visibleSummaryColumns.map(
                    column => {
                      const width =
                        columnWidths[
                          column.key
                        ];

                      const sort =
                        column.sortKey;

                      return (
                        <th
                          key={
                            column.key
                          }
                          style={{
                            width: `${width}px`,
                            minWidth: `${width}px`,
                          }}
                          className={`relative border-r border-white/10 px-2 py-2 ${
                            column.key ===
                              "apto" ||
                            column.key ===
                              "condicionado" ||
                            column.key ===
                              "noApto" ||
                            column.key ===
                              "pendiente"
                              ? "text-center"
                              : ""
                          }`}
                        >

                          <div
                            className={`flex min-h-[28px] items-center gap-1 ${
                              column.key ===
                                "apto" ||
                              column.key ===
                                "condicionado" ||
                              column.key ===
                                "noApto" ||
                              column.key ===
                                "pendiente"
                                ? "justify-center"
                                : "justify-between"
                            }`}
                          >

                            {sort ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleSort(
                                    sort
                                  )
                                }
                                className="flex min-w-0 items-center gap-1 text-left"
                              >
                                <span className="truncate">
                                  {
                                    column.label
                                  }
                                </span>

                                <SortIcon
                                  column={
                                    sort
                                  }
                                />
                              </button>
                            ) : (
                              <span className="truncate">
                                {
                                  column.label
                                }
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                hideSummaryColumn(
                                  column.key
                                )
                              }
                              className="no-print ml-auto shrink-0 rounded p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
                              title={`Ocultar ${column.label}`}
                            >
                              <EyeOff className="h-3 w-3" />
                            </button>

                          </div>

                          <span
                            onMouseDown={event =>
                              startColumnResize(
                                column.key,
                                event
                              )
                            }
                            className="no-print absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-white/30"
                            title="Arrastrar para cambiar el ancho"
                          />

                        </th>
                      );
                    }
                  )}

                </tr>

              </thead>

              <tbody>

                {rows.map(
                  row => {
                    const pending =
                      row.validation
                        .pending;

                    const overallStatus =
                      row.validation
                        .overallStatus;

                    const confirmed =
                      Boolean(
                        row.review
                          ?.confirmed
                      );

                    return (
                      <tr
                        key={
                          row.c.id
                        }
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >

                        {visibleSummaryColumns.map(
                          column => {
                            switch (
                              column.key
                            ) {
                              case "code":
                                return (
                                  <td
                                    key={
                                      column.key
                                    }
                                    style={{
                                      width: `${columnWidths.code}px`,
                                      minWidth: `${columnWidths.code}px`,
                                    }}
                                    className="px-2 py-1.5 align-middle font-mono text-xs font-black text-slate-700"
                                  >
                                    {
                                      formatCenterCode(
                                        row.c.code
                                      )
                                    }
                                  </td>
                                );

                              case "name":
                                return (
                                  <td
                                    key={
                                      column.key
                                    }
                                    style={{
                                      width: `${columnWidths.name}px`,
                                      minWidth: `${columnWidths.name}px`,
                                    }}
                                    className="px-2 py-1.5 align-middle"
                                  >
                                    <Link
                                      href={`/centers/${encodeURIComponent(
                                        row.c.id
                                      )}`}
                                      className="font-bold uppercase text-slate-800 hover:text-[#002A54] hover:underline"
                                    >
                                      {
                                        row.c
                                          .name
                                      }
                                    </Link>
                                  </td>
                                );

                              case "status":
                                return (
                                  <td
                                    key={
                                      column.key
                                    }
                                    style={{
                                      width: `${columnWidths.status}px`,
                                      minWidth: `${columnWidths.status}px`,
                                    }}
                                    className="px-2 py-1.5 align-middle"
                                  >
                                    {confirmed ? (
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <Badge tone="success">
                                          CONFIRMADA
                                        </Badge>

                                        <span className="text-[11px] font-semibold text-slate-600">
                                          ·{" "}
                                          {
                                            formatOverallStatus(
                                              overallStatus
                                            )
                                          }
                                        </span>
                                      </div>
                                    ) : (
                                      <Badge tone="warning">
                                        EN CURSO
                                      </Badge>
                                    )}
                                  </td>
                                );

                              case "score":
                                return (
                                  <td
                                    key={
                                      column.key
                                    }
                                    style={{
                                      width: `${columnWidths.score}px`,
                                      minWidth: `${columnWidths.score}px`,
                                    }}
                                    className="px-2 py-1.5 align-middle"
                                  >
                                    <span className="text-base font-black">
                                      {
                                        row
                                          .summary
                                          .score
                                      }
                                      %
                                    </span>
                                  </td>
                                );

                              case "apto":
                                return (
                                  <td
                                    key={
                                      column.key
                                    }
                                    style={{
                                      width: `${columnWidths.apto}px`,
                                      minWidth: `${columnWidths.apto}px`,
                                    }}
                                    className="px-2 py-1.5 text-center align-middle font-semibold text-emerald-700"
                                  >
                                    {
                                      row
                                        .summary
                                        .counts[
                                        "APTO"
                                      ]
                                    }
                                  </td>
                                );

                              case "condicionado":
                                return (
                                  <td
                                    key={
                                      column.key
                                    }
                                    style={{
                                      width: `${columnWidths.condicionado}px`,
                                      minWidth: `${columnWidths.condicionado}px`,
                                    }}
                                    className="px-2 py-1.5 text-center align-middle font-semibold text-amber-700"
                                  >
                                    {
                                      row
                                        .summary
                                        .counts[
                                        "APTO CONDICIONADO"
                                      ]
                                    }
                                  </td>
                                );

                              case "noApto":
                                return (
                                  <td
                                    key={
                                      column.key
                                    }
                                    style={{
                                      width: `${columnWidths.noApto}px`,
                                      minWidth: `${columnWidths.noApto}px`,
                                    }}
                                    className="px-2 py-1.5 text-center align-middle font-semibold text-red-700"
                                  >
                                    {
                                      row
                                        .summary
                                        .counts[
                                        "NO APTO"
                                      ]
                                    }
                                  </td>
                                );

                              case "pendiente":
                                return (
                                  <td
                                    key={
                                      column.key
                                    }
                                    style={{
                                      width: `${columnWidths.pendiente}px`,
                                      minWidth: `${columnWidths.pendiente}px`,
                                    }}
                                    className="px-2 py-1.5 text-center align-middle font-semibold text-orange-700"
                                  >
                                    {
                                      row
                                        .summary
                                        .counts[
                                        "PENDIENTE"
                                      ] +
                                      row
                                        .summary
                                        .counts[
                                        "SIN INFORMACIÓN"
                                      ]
                                    }
                                  </td>
                                );

                              case "confirmation":
                                return (
                                  <td
                                    key={
                                      column.key
                                    }
                                    style={{
                                      width: `${columnWidths.confirmation}px`,
                                      minWidth: `${columnWidths.confirmation}px`,
                                    }}
                                    className="px-2 py-1.5 align-middle"
                                  >

                                    {confirmed ? (
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge tone="success">
                                          Validada
                                        </Badge>

                                        <span className="text-[11px] text-slate-500">
                                          {
                                            formatOverallStatus(
                                              overallStatus
                                            )
                                          }
                                        </span>
                                      </div>
                                    ) : row.validation
                                        .allReviewed &&
                                      state.role ===
                                        "ADMIN" ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          validateCenter(
                                            row
                                          )
                                        }
                                        className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                                      >
                                        Validar centro
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled
                                        className="inline-flex cursor-not-allowed items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-400"
                                        title={
                                          state.role !==
                                          "ADMIN"
                                            ? "Solo un administrador puede validar el centro."
                                            : "El centro todavía tiene elementos pendientes de revisión."
                                        }
                                      >
                                        {state.role !==
                                        "ADMIN"
                                          ? "Validación restringida"
                                          : `${pending} pendiente${
                                              pending ===
                                              1
                                                ? ""
                                                : "s"
                                            }`}
                                      </button>
                                    )}

                                  </td>
                                );

                              default:
                                return null;
                            }
                          }
                        )}

                      </tr>
                    );
                  }
                )}

                {rows.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        visibleSummaryColumns.length
                      }
                      className="px-6 py-10 text-center text-sm text-slate-400"
                    >
                      No hay centros que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                )}

              </tbody>

            </table>

          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">

            <span>
              País:{" "}
              <b className="text-slate-600">
                {
                  country
                }
              </b>
            </span>

            <span>·</span>

            <span>
              Periodo:{" "}
              <b className="text-slate-600">
                {period}{" "}
                {year}
              </b>
            </span>

            <span>·</span>

            <span>
              Fecha de generación:{" "}
              <b className="text-slate-600">
                {new Date().toLocaleDateString(
                  "es-ES"
                )}
              </b>
            </span>

          </div>

        </Card>
      )}

      {/* =====================================================
       * MATRIZ
       * ===================================================== */}

      {mode ===
        "matrix" && (
        <Card className="p-6 matrix-report">

          <div className="mb-5 flex items-center justify-between gap-4">

            <div>
              <div className="text-lg font-black text-slate-800">
                Matriz de inspecciones
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {country} ·{" "}
                {period}{" "}
                {year}
                {category !==
                  "Todas" &&
                  ` · ${category}`}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 no-print">

              <Badge>
                {
                  rows.length
                }{" "}
                centros
              </Badge>

              <Badge>
                {
                  matrixItems.length
                }{" "}
                elementos
              </Badge>

            </div>

          </div>

          <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 no-print">

            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              Apto
            </div>

            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              Apto condicionado
            </div>

            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              No apto
            </div>

            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-orange-500" />
              Pendiente
            </div>

            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-slate-400" />
              Sin información
            </div>

            <div className="ml-auto text-slate-400">
              Fechas: MM/AA
            </div>

          </div>

          {/* =================================================
           * ÚNICA ZONA CON DESPLAZAMIENTO HORIZONTAL
           * ================================================= */}

          <div className="overflow-x-auto rounded-2xl border border-slate-200">

            <table className="inspection-matrix min-w-max border-collapse text-xs">

              <thead className="bg-[#002A54] text-white print-table-header">

                <tr>

                  <th
                    rowSpan={2}
                    className="matrix-fixed-header sticky left-0 z-30 w-24 min-w-24 border-r border-white/20 bg-[#002A54] px-2 py-3 text-center text-[10px] font-bold"
                  >
                    Nº
                    <br />
                    centro
                  </th>

                  <th
                    rowSpan={2}
                    className="matrix-fixed-header sticky left-24 z-30 w-48 min-w-48 border-r border-white/20 bg-[#002A54] px-3 py-3 text-left text-[10px] font-bold"
                  >
                    Centro
                  </th>

                  {matrixItems.map(
                    (
                      item: any
                    ) => (
                      <th
                        key={
                          item.id
                        }
                        className="matrix-element-header h-52 w-14 min-w-14 border-r border-white/20 bg-[#002A54] p-0 align-bottom"
                        title={`${item.code} · ${item.installation} · ${item.action}`}
                      >
                        <div className="flex h-52 w-14 items-center justify-center overflow-hidden">

                          <div className="matrix-vertical-text">
                            {
                              getMatrixShortTitle(
                                item
                              )
                            }
                          </div>

                        </div>
                      </th>
                    )
                  )}

                </tr>

                <tr>
                  {matrixItems.map(
                    (
                      item: any
                    ) => (
                      <th
                        key={`sub-${item.id}`}
                        className="hidden"
                      >
                        {
                          item.code
                        }
                      </th>
                    )
                  )}
                </tr>

              </thead>

              <tbody>

                {rows.map(
                  row => (
                    <tr
                      key={
                        row.c.id
                      }
                      className="border-t border-slate-200"
                    >

                      <td className="matrix-fixed-cell sticky left-0 z-20 w-24 min-w-24 border-r border-slate-200 bg-white px-2 py-2 text-center font-mono text-xs font-black text-slate-700">

                        <Link
                          href={`/centers/${encodeURIComponent(
                            row.c.id
                          )}`}
                          className="hover:text-[#002A54] hover:underline"
                        >
                          {
                            formatCenterCode(
                              row.c.code
                            )
                          }
                        </Link>

                      </td>

                      <td className="matrix-fixed-cell sticky left-24 z-20 w-48 min-w-48 border-r border-slate-200 bg-white px-3 py-2">

                        <Link
                          href={`/centers/${encodeURIComponent(
                            row.c.id
                          )}`}
                          className="font-bold uppercase text-slate-800 hover:text-[#002A54] hover:underline"
                        >
                          {
                            row.c
                              .name
                          }
                        </Link>

                      </td>

                      {matrixItems.map(
                        (
                          item: any
                        ) => {
                          const cell =
                            getMatrixCell(
                              row.c
                                .id,
                              item
                            );

                          if (
                            !cell.active
                          ) {
                            return (
                              <td
                                key={
                                  item.id
                                }
                                className="w-14 min-w-14 border-r border-slate-100 bg-slate-50 px-1 py-1 text-center align-middle"
                                title="Elemento no activo"
                              >
                                <span className="text-lg font-light text-slate-300">
                                  —
                                </span>
                              </td>
                            );
                          }

                          const status =
                            cell
                              .itemReview
                              .status;

                          const statusVisual =
                            getStatusClasses(
                              status
                            );

                          const hasLast =
                            Boolean(
                              cell
                                .lastReview
                                ?.date
                            );

                          const hasNext =
                            Boolean(
                              cell
                                .nextReview
                            );

                          return (
                            <td
                              key={
                                item.id
                              }
                              className="w-14 min-w-14 border-r border-slate-100 px-1 py-1 text-center align-middle"
                              title={`${item.code} · ${item.installation}`}
                            >

                              <div className="flex min-h-[64px] flex-col items-center justify-center gap-1">

                                <span
                                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-black ${statusVisual.badge}`}
                                  title={
                                    status
                                  }
                                >
                                  {
                                    statusVisual.letter
                                  }
                                </span>

                                {showLast && (
                                  <div
                                    className={`whitespace-nowrap text-[9px] font-semibold ${
                                      hasLast
                                        ? "text-slate-600"
                                        : "text-slate-300"
                                    }`}
                                  >
                                    U:{" "}
                                    {hasLast
                                      ? formatMonthYear(
                                          cell
                                            .lastReview!
                                            .date
                                        )
                                      : "—"}
                                  </div>
                                )}

                                {showNext && (
                                  <div
                                    className={`whitespace-nowrap text-[9px] font-semibold ${
                                      hasNext
                                        ? "text-slate-600"
                                        : "text-slate-300"
                                    }`}
                                  >
                                    P:{" "}
                                    {hasNext
                                      ? formatMonthYear(
                                          cell
                                            .nextReview
                                        )
                                      : "—"}
                                  </div>
                                )}

                              </div>

                            </td>
                          );
                        }
                      )}

                    </tr>
                  )
                )}

                {rows.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        matrixItems.length +
                        2
                      }
                      className="px-6 py-12 text-center text-sm text-slate-400"
                    >
                      No hay centros que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                )}

              </tbody>

            </table>

          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">

            <span>
              <b className="text-slate-600">
                U:
              </b>{" "}
              Última revisión
            </span>

            <span>
              <b className="text-slate-600">
                P:
              </b>{" "}
              Próxima revisión
            </span>

            <span>·</span>

            <span>
              Las fechas proceden del histórico
              de cada elemento y centro.
            </span>

            <span>·</span>

            <span>
              Los elementos no activos no computan
              y aparecen como "—".
            </span>

          </div>

          <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-800 no-print">

            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />

            <div>
              La próxima revisión se calcula a partir
              de la última fecha de revisión registrada
              para cada elemento y de su frecuencia.
              Actualmente no se aplican todavía
              sábados, domingos ni festivos.
            </div>

          </div>

        </Card>
      )}

      {/* =====================================================
       * ESTILOS
       * ===================================================== */}

      <style jsx global>{`

        .matrix-vertical-text {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          white-space: nowrap;
          font-size: 10px;
          line-height: 1;
          font-weight: 700;
          letter-spacing: 0.02em;
          max-height: 190px;
          max-width: 48px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .inspection-matrix th,
        .inspection-matrix td {
          vertical-align: middle;
        }

        .inspection-matrix .matrix-fixed-header,
        .inspection-matrix .matrix-fixed-cell {
          position: sticky;
        }

        .inspection-matrix thead {
          display: table-header-group;
        }

        .summary-report table {
          table-layout: fixed;
        }

        .summary-report th,
        .summary-report td {
          box-sizing: border-box;
        }

        @media print {

          @page {
            size: landscape;
            margin: 8mm;
          }

          html,
          body {
            background: white !important;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .no-print {
            display: none !important;
          }

          .print-header {
            display: block !important;
            margin-bottom: 12px;
          }

          .inspections-page {
            width: 100% !important;
            max-width: none !important;
          }

          .inspections-page > * {
            break-inside: auto;
          }

          .summary-report,
          .matrix-report {
            box-shadow: none !important;
            border: 0 !important;
            padding: 0 !important;
          }

          .print-table-header {
            display: table-header-group !important;
          }

          table {
            page-break-inside: auto;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          th,
          td {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .matrix-fixed-header,
          .matrix-fixed-cell {
            position: static !important;
          }

          .overflow-auto,
          .overflow-x-auto {
            overflow: visible !important;
          }

          .matrix-vertical-text {
            writing-mode: vertical-rl !important;
            transform: rotate(180deg) !important;
          }

        }

      `}</style>

    </div>
  );
}
