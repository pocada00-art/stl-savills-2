"use client";

import { useEffect, useMemo, useState } from "react";
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
  reviewKey,
  reviewSummary,
  blankItem,
  type Period,
  type V1State,
  type V1Status,
} from "@/lib/v1-state";

/* =========================================================
 * TIPOS
 * ========================================================= */

type ViewMode = "summary" | "matrix";

type SortKey =
  | "code"
  | "name"
  | "score"
  | "apto"
  | "condicionado"
  | "noApto"
  | "pendiente"
  | "confirmation";

type SortDirection = "asc" | "desc";

type HistoricalReview = {
  year: number;
  period: Period;
  date: string;
  status: V1Status;
  item: ReturnType<typeof blankItem>;
};

/* =========================================================
 * FRECUENCIAS
 * ========================================================= */

/**
 * Convierte la frecuencia del catálogo en meses.
 *
 * Ejemplos:
 *
 * mensual          -> 1
 * bimensual        -> 2
 * trimestral       -> 3
 * cuatrimestral    -> 4
 * semestral        -> 6
 * anual            -> 12
 * bienal           -> 24
 * 3 meses          -> 3
 * 2 años           -> 24
 * 3                -> 36
 *
 * Los números sin unidad se interpretan como AÑOS.
 */
function parseFrequency(frequency: string) {
  const value = String(frequency || "")
    .trim()
    .toLowerCase();

  if (!value) {
    return null;
  }

  /*
   * IMPORTANTE:
   * bimensual se comprueba antes de mensual.
   */
  if (value.includes("bimensual")) {
    return { months: 2 };
  }

  if (value.includes("mensual")) {
    return { months: 1 };
  }

  if (value.includes("trimestral")) {
    return { months: 3 };
  }

  if (value.includes("cuatrimestral")) {
    return { months: 4 };
  }

  if (value.includes("semestral")) {
    return { months: 6 };
  }

  if (value.includes("bienal")) {
    return { months: 24 };
  }

  if (value.includes("anual")) {
    return { months: 12 };
  }

  const numericWithUnit = value.match(
    /^(\d+(?:[.,]\d+)?)\s*(mes|meses|año|años)$/
  );

  if (numericWithUnit) {
    const amount = Number(
      numericWithUnit[1].replace(",", ".")
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      return null;
    }

    if (
      value.includes("año") ||
      value.includes("años")
    ) {
      return {
        months: Math.round(amount * 12),
      };
    }

    return {
      months: Math.round(amount),
    };
  }

  const numericOnly = value.match(
    /^\d+(?:[.,]\d+)?$/
  );

  if (numericOnly) {
    const years = Number(
      value.replace(",", ".")
    );

    if (!Number.isFinite(years) || years <= 0) {
      return null;
    }

    return {
      months: Math.round(years * 12),
    };
  }

  return null;
}

/**
 * Calcula la próxima revisión a partir de:
 *
 * fecha de revisión + frecuencia
 *
 * Devuelve YYYY-MM-DD.
 */
function calculateNextReview(
  date: string,
  frequency: string
): string {
  if (!date || !frequency) {
    return "";
  }

  const normalizedFrequency = String(
    frequency
  )
    .trim()
    .toLowerCase();

  if (normalizedFrequency === "inicial") {
    return "";
  }

  const parsedFrequency =
    parseFrequency(frequency);

  if (!parsedFrequency) {
    return "";
  }

  const match = date.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) {
    return "";
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return "";
  }

  const result = new Date(
    year,
    month - 1,
    day
  );

  result.setHours(0, 0, 0, 0);

  if (Number.isNaN(result.getTime())) {
    return "";
  }

  /*
   * IMPORTANTE:
   *
   * parseFrequency() devuelve:
   *
   * { months: number }
   *
   * Por eso utilizamos parsedFrequency.months.
   */
  const targetMonthIndex =
    month - 1 +
    parsedFrequency.months;

  const targetYear =
    year +
    Math.floor(
      targetMonthIndex / 12
    );

  const targetMonth =
    ((targetMonthIndex % 12) + 12) % 12;

  const lastDayOfTargetMonth =
    new Date(
      targetYear,
      targetMonth + 1,
      0
    ).getDate();

  const targetDay = Math.min(
    day,
    lastDayOfTargetMonth
  );

  const finalDate = new Date(
    targetYear,
    targetMonth,
    targetDay
  );

  finalDate.setHours(0, 0, 0, 0);

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
    ).padStart(2, "0");

  const finalDay =
    String(
      finalDate.getDate()
    ).padStart(2, "0");

  return `${finalYear}-${finalMonth}-${finalDay}`;
}

/* =========================================================
 * FECHAS
 * ========================================================= */

/**
 * Formato solicitado para la Matriz:
 *
 * YYYY-MM-DD -> MM/AA
 *
 * Ejemplo:
 * 15/01/2027 -> 01/27
 */
function formatMonthYear(
  value: string
): string {
  if (!value) {
    return "";
  }

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) {
    return "";
  }

  return `${match[2]}/${match[1].slice(-2)}`;
}

/**
 * Convierte una fecha YYYY-MM-DD
 * a un valor numérico comparable.
 */
function dateValue(
  value: string
): number {
  if (!value) {
    return 0;
  }

  const time = new Date(
    `${value}T00:00:00`
  ).getTime();

  return Number.isNaN(time) ? 0 : time;
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
        dot: "bg-emerald-500",
        letter: "A",
      };

    case "APTO CONDICIONADO":
      return {
        badge:
          "bg-amber-100 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
        letter: "C",
      };

    case "NO APTO":
      return {
        badge:
          "bg-red-100 text-red-700 border-red-200",
        dot: "bg-red-500",
        letter: "N",
      };

    case "PENDIENTE":
      return {
        badge:
          "bg-orange-100 text-orange-700 border-orange-200",
        dot: "bg-orange-500",
        letter: "P",
      };

    default:
      return {
        badge:
          "bg-slate-100 text-slate-500 border-slate-200",
        dot: "bg-slate-400",
        letter: "S",
      };
  }
}

/* =========================================================
 * HISTÓRICO
 * ========================================================= */

/**
 * Obtiene todas las revisiones históricas
 * de un elemento concreto de un centro.
 *
 * Solamente se consideran revisiones que
 * tengan una fecha real.
 */
function getHistoricalReviews(
  state: V1State,
  centerId: string,
  itemId: string
): HistoricalReview[] {
  const result: HistoricalReview[] = [];

  Object.entries(
    state.reviews
  ).forEach(([key, review]) => {
    const expectedPrefix =
      `${centerId}:`;

    if (!key.startsWith(expectedPrefix)) {
      return;
    }

    const match = key.match(
      /^(.+):(\d{4}):(S1|S2)$/
    );

    if (!match) {
      return;
    }

    const year = Number(match[2]);
    const period =
      match[3] as Period;

    const item =
      review.items?.[itemId];

    if (!item || !item.date) {
      return;
    }

    result.push({
      year,
      period,
      date: item.date,
      status: item.status,
      item,
    });
  });

  return result.sort(
    (a, b) => {
      const dateDifference =
        dateValue(b.date) -
        dateValue(a.date);

      if (dateDifference !== 0) {
        return dateDifference;
      }

      if (b.year !== a.year) {
        return b.year - a.year;
      }

      return (
        (b.period === "S2" ? 2 : 1) -
        (a.period === "S2" ? 2 : 1)
      );
    }
  );
}

/**
 * Devuelve la última revisión real
 * de un elemento.
 */
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

  return history[0] || null;
}

/**
 * Devuelve la próxima revisión
 * calculada desde la última revisión real.
 */
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
 * ORDENACIÓN DE CENTROS
 * ========================================================= */

function compareCenterCode(
  a: any,
  b: any
): number {
  const aCode =
    String(a.code ?? "").trim();

  const bCode =
    String(b.code ?? "").trim();

  const aNumber =
    Number(aCode);

  const bNumber =
    Number(bCode);

  const aIsNumber =
    aCode !== "" &&
    Number.isFinite(aNumber);

  const bIsNumber =
    bCode !== "" &&
    Number.isFinite(bNumber);

  if (
    aIsNumber &&
    bIsNumber
  ) {
    return aNumber - bNumber;
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
      sensitivity: "base",
    }
  );
}

/* =========================================================
 * COMPONENTE
 * ========================================================= */

export default function Inspections() {
  const [
    country,
    setCountry,
  ] = useState("España");

  const [q, setQ] =
    useState("");

  const [
    period,
    setPeriod,
  ] = useState<Period>("S2");

  const [year, setYear] =
    useState(2026);

  const [
    mode,
    setMode,
  ] = useState<ViewMode>("summary");

  const [
    showLast,
    setShowLast,
  ] = useState(false);

  const [
    showNext,
    setShowNext,
  ] = useState(false);

  const [
    category,
    setCategory,
  ] = useState("Todas");

  const [
    state,
    setState,
  ] = useState<V1State>(
    loadState()
  );

  const [
    sortKey,
    setSortKey,
  ] = useState<SortKey>("code");

  const [
    sortDirection,
    setSortDirection,
  ] =
    useState<SortDirection>("asc");

  const [
    savedStateLoaded,
    setSavedStateLoaded,
  ] = useState(false);

  useEffect(() => {
    const loaded =
      loadState();

    setState(loaded);
    setSavedStateLoaded(true);
  }, []);

  useEffect(() => {
    const handler = () => {
      setState(loadState());
    };

    window.addEventListener(
      "stl-role-change",
      handler
    );

    return () => {
      window.removeEventListener(
        "stl-role-change",
        handler
      );
    };
  }, []);

  const centers = useMemo(() => {
    return demo.centers
      .filter(
        c =>
          c.country === country &&
          c.status === "Activo"
      )
      .sort(compareCenterCode);
  }, [country]);

  const catalog = useMemo(() => {
    return country === "España"
      ? demo.esCatalog
      : demo.ptCatalog;
  }, [country]);

  const categories =
    useMemo(() => {
      return [
        "Todas",
        ...Array.from(
          new Set(
            catalog
              .map(
                (x: any) =>
                  x.category
              )
              .filter(Boolean)
          )
        ),
      ];
    }, [catalog]);

  /**
   * Filtrado de elementos de la Matriz.
   */
  const matrixItems =
    useMemo(() => {
      return catalog.filter(
        (x: any) => {
          const matchesCategory =
            category === "Todas" ||
            x.category === category;

          const text =
            `${x.code} ${x.installation} ${x.action} ${x.category || ""}`;

          const matchesSearch =
            text
              .toLowerCase()
              .includes(
                q.toLowerCase()
              );

          return (
            matchesCategory &&
            matchesSearch
          );
        }
      );
    }, [
      catalog,
      category,
      q,
    ]);

  /**
   * Datos de cada centro.
   *
   * El resumen utiliza el periodo
   * seleccionado.
   */
  const rows = useMemo(() => {
    const result =
      centers
        .filter(c =>
          `${c.name} ${c.code} ${
            c.shortCode || ""
          }`
            .toLowerCase()
            .includes(
              q.toLowerCase()
            )
        )
        .map(c => {
          const active =
            catalog.filter(
              (x: any) =>
                state.activeItems[
                  c.id
                ]?.[x.id] !== false
            );

          const review =
            state.reviews[
              reviewKey(
                c.id,
                year,
                period
              )
            ];

          const summary =
            reviewSummary(
              review,
              active.map(
                (x: any) =>
                  x.id
              )
            );

          return {
            c,
            active,
            review,
            summary,
          };
        });

    result.sort(
      (a, b) => {
        let comparison = 0;

        switch (sortKey) {
          case "code":
            comparison =
              compareCenterCode(
                a.c,
                b.c
              );
            break;

          case "name":
            comparison =
              String(a.c.name)
                .localeCompare(
                  String(b.c.name),
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
              a.summary.counts[
                "APTO"
              ] -
              b.summary.counts[
                "APTO"
              ];
            break;

          case "condicionado":
            comparison =
              a.summary.counts[
                "APTO CONDICIONADO"
              ] -
              b.summary.counts[
                "APTO CONDICIONADO"
              ];
            break;

          case "noApto":
            comparison =
              a.summary.counts[
                "NO APTO"
              ] -
              b.summary.counts[
                "NO APTO"
              ];
            break;

          case "pendiente":
            comparison =
              (
                a.summary.counts[
                  "PENDIENTE"
                ] +
                a.summary.counts[
                  "SIN INFORMACIÓN"
                ]
              ) -
              (
                b.summary.counts[
                  "PENDIENTE"
                ] +
                b.summary.counts[
                  "SIN INFORMACIÓN"
                ]
              );
            break;

          case "confirmation":
            comparison =
              a.summary
                .pendingConfirmation -
              b.summary
                .pendingConfirmation;
            break;
        }

        return sortDirection ===
          "asc"
          ? comparison
          : -comparison;
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
  ]);

  /**
   * Estado de una celda de la matriz.
   *
   * El estado corresponde al periodo
   * seleccionado.
   *
   * Las fechas son independientes y
   * proceden del histórico completo.
   */
  function getMatrixCell(
    centerId: string,
    item: any
  ) {
    const review =
      state.reviews[
        reviewKey(
          centerId,
          year,
          period
        )
      ];

    const itemReview =
      review?.items?.[item.id] ||
      blankItem();

    const active =
      state.activeItems[
        centerId
      ]?.[item.id] !== false;

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
          item.frequency || ""
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

  /**
   * Ordenación del resumen.
   */
  function handleSort(
    key: SortKey
  ) {
    if (sortKey === key) {
      setSortDirection(
        current =>
          current === "asc"
            ? "desc"
            : "asc"
      );
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function SortIcon({
    column,
  }: {
    column: SortKey;
  }) {
    if (sortKey !== column) {
      return (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
      );
    }

    return sortDirection ===
      "asc" ? (
      <ChevronUp className="h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5" />
    );
  }

  /**
   * Exportación preparada para PDF.
   *
   * Se utiliza la impresión nativa del navegador
   * para evitar añadir dependencias externas al proyecto.
   *
   * El usuario puede seleccionar:
   *
   * Guardar como PDF
   */
  function exportPdf() {
    window.print();
  }

  if (!savedStateLoaded) {
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

  return (
    <div className="space-y-6 inspections-page">

      {/* =====================================================
       * CABECERA
       * ===================================================== */}

      <div className="print-header hidden">
        <div className="text-2xl font-black">
          Plan de inspecciones
        </div>

        <div className="mt-1 text-sm">
          {mode === "summary"
            ? "Informe Resumen"
            : "Informe Matriz"}
        </div>

        <div className="mt-2 text-xs">
          País: {country} · Periodo:{" "}
          {period} {year}
        </div>
      </div>

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
              onChange={e =>
                setQ(e.target.value)
              }
              placeholder={
                mode === "summary"
                  ? "Buscar centro..."
                  : "Buscar centro o elemento..."
              }
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#002A54]"
            />

          </div>

          <Select
            value={country}
            onChange={value => {
              setCountry(value);
              setCategory("Todas");
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
            value={String(year)}
            onChange={value =>
              setYear(Number(value))
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

          {mode === "matrix" && (
            <Select
              value={category}
              onChange={setCategory}
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
                    {categoryName}
                  </option>
                )
              )}
            </Select>
          )}

          <Button
            variant={
              mode === "summary"
                ? "primary"
                : "secondary"
            }
            onClick={() =>
              setMode("summary")
            }
          >
            <List className="mr-2 inline h-4 w-4" />
            Resumen
          </Button>

          <Button
            variant={
              mode === "matrix"
                ? "primary"
                : "secondary"
            }
            onClick={() =>
              setMode("matrix")
            }
          >
            <LayoutGrid className="mr-2 inline h-4 w-4" />
            Matriz
          </Button>

          <Button
            variant="secondary"
            onClick={exportPdf}
          >
            <FileDown className="mr-2 inline h-4 w-4" />
            Exportar PDF
          </Button>

        </div>

        {/* SELECTORES DE FECHAS */}

        <div className="mt-4 flex flex-wrap items-center gap-5 border-t border-slate-100 pt-4">

          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Fechas en matriz
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showLast}
              onChange={e =>
                setShowLast(
                  e.target.checked
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
              checked={showNext}
              onChange={e =>
                setShowNext(
                  e.target.checked
                )
              }
              className="h-4 w-4 rounded border-slate-300"
            />

            <span>
              Próxima revisión
            </span>
          </label>

          {mode === "matrix" &&
            (showLast ||
              showNext) && (
              <div className="text-xs text-slate-400">
                Formato de fecha: MM/AA
              </div>
            )}

        </div>

      </Card>

      {/* =====================================================
       * RESUMEN
       * ===================================================== */}

      {mode === "summary" && (
        <Card className="p-6 summary-report">

          <div className="mb-5 flex items-center justify-between gap-4">

            <div>
              <div className="text-lg font-black text-slate-800">
                Resumen de cumplimiento
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {country} · {period}{" "}
                {year}
              </div>
            </div>

            <div className="no-print">
              <Badge>
                {rows.length} centros
              </Badge>
            </div>

          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">

            <table className="w-full min-w-[1100px] text-sm">

              <thead className="bg-[#002A54] text-left text-xs font-bold uppercase tracking-wide text-white print-table-header">

                <tr>

                  <th className="w-28 px-3 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort(
                          "code"
                        )
                      }
                      className="flex items-center gap-1"
                    >
                      Nº centro
                      <SortIcon column="code" />
                    </button>
                  </th>

                  <th className="min-w-[240px] px-3 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort(
                          "name"
                        )
                      }
                      className="flex items-center gap-1"
                    >
                      Centro
                      <SortIcon column="name" />
                    </button>
                  </th>

                  <th className="w-36 px-3 py-3">
                    Estado
                  </th>

                  <th className="w-32 px-3 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort(
                          "score"
                        )
                      }
                      className="flex items-center gap-1"
                    >
                      Cumplimiento
                      <SortIcon column="score" />
                    </button>
                  </th>

                  <th className="w-20 px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort(
                          "apto"
                        )
                      }
                      className="mx-auto flex items-center gap-1"
                    >
                      APTO
                      <SortIcon column="apto" />
                    </button>
                  </th>

                  <th className="w-24 px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort(
                          "condicionado"
                        )
                      }
                      className="mx-auto flex items-center gap-1"
                    >
                      COND.
                      <SortIcon column="condicionado" />
                    </button>
                  </th>

                  <th className="w-24 px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort(
                          "noApto"
                        )
                      }
                      className="mx-auto flex items-center gap-1"
                    >
                      NO APTO
                      <SortIcon column="noApto" />
                    </button>
                  </th>

                  <th className="w-24 px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort(
                          "pendiente"
                        )
                      }
                      className="mx-auto flex items-center gap-1"
                    >
                      PEND.
                      <SortIcon column="pendiente" />
                    </button>
                  </th>

                  <th className="w-36 px-3 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort(
                          "confirmation"
                        )
                      }
                      className="flex items-center gap-1"
                    >
                      Confirmación
                      <SortIcon column="confirmation" />
                    </button>
                  </th>

                </tr>

              </thead>

              <tbody>

                {rows.map(
                  row => {
                    const pending =
                      row.summary
                        .pendingConfirmation;

                    return (
                      <tr
                        key={
                          row.c.id
                        }
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >

                        {/* Nº CENTRO */}

                        <td className="px-3 py-3 align-middle font-mono text-sm font-black text-slate-700">
                          {row.c.code}
                        </td>

                        {/* CENTRO */}

                        <td className="px-3 py-3 align-middle">

                          <Link
                            href={`/centers/${row.c.id}`}
                            className="font-bold text-slate-800 hover:text-[#002A54] hover:underline"
                          >
                            {
                              row.c.name
                            }
                          </Link>

                        </td>

                        {/* ESTADO */}

                        <td className="px-3 py-3 align-middle">

                          {row.review?.confirmed ? (
                            <Badge tone="success">
                              CONFIRMADA
                            </Badge>
                          ) : (
                            <Badge tone="warning">
                              EN CURSO
                            </Badge>
                          )}

                        </td>

                        {/* CUMPLIMIENTO */}

                        <td className="px-3 py-3 align-middle">

                          <span className="text-lg font-black">
                            {
                              row.summary
                                .score
                            }
                            %
                          </span>

                        </td>

                        {/* APTO */}

                        <td className="px-3 py-3 text-center align-middle font-semibold text-emerald-700">
                          {
                            row.summary
                              .counts[
                              "APTO"
                            ]
                          }
                        </td>

                        {/* CONDICIONADO */}

                        <td className="px-3 py-3 text-center align-middle font-semibold text-amber-700">
                          {
                            row.summary
                              .counts[
                              "APTO CONDICIONADO"
                            ]
                          }
                        </td>

                        {/* NO APTO */}

                        <td className="px-3 py-3 text-center align-middle font-semibold text-red-700">
                          {
                            row.summary
                              .counts[
                              "NO APTO"
                            ]
                          }
                        </td>

                        {/* PENDIENTE */}

                        <td className="px-3 py-3 text-center align-middle font-semibold text-orange-700">
                          {
                            row.summary
                              .counts[
                              "PENDIENTE"
                            ] +
                              row.summary
                                .counts[
                                "SIN INFORMACIÓN"
                              ]
                          }
                        </td>

                        {/* CONFIRMACIÓN */}

                        <td className="px-3 py-3 align-middle">

                          {pending ===
                          0 ? (
                            <Badge tone="success">
                              Completa
                            </Badge>
                          ) : (
                            <Badge tone="warning">
                              {pending}{" "}
                              pendientes
                            </Badge>
                          )}

                        </td>

                      </tr>
                    );
                  }
                )}

                {rows.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-12 text-center text-sm text-slate-400"
                    >
                      No hay centros que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                )}

              </tbody>

            </table>

          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
            <span>
              País:{" "}
              <b className="text-slate-600">
                {country}
              </b>
            </span>

            <span>·</span>

            <span>
              Periodo:{" "}
              <b className="text-slate-600">
                {period} {year}
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

      {mode === "matrix" && (
        <Card className="p-6 matrix-report">

          <div className="mb-5 flex items-center justify-between gap-4">

            <div>
              <div className="text-lg font-black text-slate-800">
                Matriz de inspecciones
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {country} · {period}{" "}
                {year}
                {category !==
                  "Todas" &&
                  ` · ${category}`}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 no-print">

              <Badge>
                {rows.length} centros
              </Badge>

              <Badge>
                {
                  matrixItems.length
                } elementos
              </Badge>

            </div>

          </div>

          <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 no-print">

            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              APTO
            </div>

            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              APTO CONDICIONADO
            </div>

            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              NO APTO
            </div>

            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-orange-500" />
              PENDIENTE
            </div>

            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-slate-400" />
              SIN INFORMACIÓN
            </div>

            <div className="ml-auto text-slate-400">
              Fechas: MM/AA
            </div>

          </div>

          <div className="overflow-auto rounded-2xl border border-slate-200">

            <table className="inspection-matrix min-w-max border-collapse text-xs">

              <thead className="bg-[#002A54] text-white print-table-header">

                <tr>

                  {/* Nº CENTRO */}

                  <th
                    rowSpan={2}
                    className="matrix-fixed-header sticky left-0 z-30 w-24 min-w-24 border-r border-white/20 bg-[#002A54] px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wide"
                  >
                    Nº
                    <br />
                    centro
                  </th>

                  {/* CENTRO */}

                  <th
                    rowSpan={2}
                    className="matrix-fixed-header sticky left-24 z-30 w-48 min-w-48 border-r border-white/20 bg-[#002A54] px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wide"
                  >
                    Centro
                  </th>

                  {/* ELEMENTOS */}

                  {matrixItems.map(
                    (item: any) => (
                      <th
                        key={
                          item.id
                        }
                        className="matrix-element-header h-52 w-14 min-w-14 border-r border-white/20 bg-[#002A54] p-0 align-bottom"
                        title={`${item.code} · ${item.installation} · ${item.action}`}
                      >
                        <div className="flex h-52 w-14 items-center justify-center overflow-hidden">

                          <div className="matrix-vertical-text">
                            {item.code}{" "}
                            ·{" "}
                            {
                              item.installation
                            }
                            {item.category
                              ? ` · ${item.category}`
                              : ""}
                          </div>

                        </div>
                      </th>
                    )
                  )}

                </tr>

                <tr>
                  {matrixItems.map(
                    (item: any) => (
                      <th
                        key={`sub-${item.id}`}
                        className="hidden"
                      >
                        {item.code}
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

                      {/* Nº CENTRO */}

                      <td className="matrix-fixed-cell sticky left-0 z-20 w-24 min-w-24 border-r border-slate-200 bg-white px-2 py-3 text-center font-mono text-xs font-black text-slate-700">
                        <Link
                          href={`/centers/${row.c.id}`}
                          className="hover:text-[#002A54] hover:underline"
                        >
                          {
                            row.c.code
                          }
                        </Link>
                      </td>

                      {/* CENTRO */}

                      <td className="matrix-fixed-cell sticky left-24 z-20 w-48 min-w-48 border-r border-slate-200 bg-white px-3 py-3">
                        <Link
                          href={`/centers/${row.c.id}`}
                          className="font-bold text-slate-800 hover:text-[#002A54] hover:underline"
                        >
                          {
                            row.c.name
                          }
                        </Link>
                      </td>

                      {/* ELEMENTOS */}

                      {matrixItems.map(
                        (item: any) => {
                          const cell =
                            getMatrixCell(
                              row.c.id,
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
                                className="w-14 min-w-14 border-r border-slate-100 bg-slate-50 px-1 py-2 text-center align-middle"
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
                              cell.nextReview
                            );

                          return (
                            <td
                              key={
                                item.id
                              }
                              className="w-14 min-w-14 border-r border-slate-100 px-1 py-1 text-center align-middle"
                              title={`${item.code} · ${item.installation}`}
                            >

                              <div className="flex min-h-[70px] flex-col items-center justify-center gap-1">

                                {/* ESTADO */}

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

                                {/* ÚLTIMA */}

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

                                {/* PRÓXIMA */}

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
                                          cell.nextReview
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

            <span>
              ·
            </span>

            <span>
              Las fechas proceden del histórico
              de cada elemento y centro.
            </span>

            <span>
              ·
            </span>

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
       * ESTILOS ESPECÍFICOS
       * ===================================================== */}

      <style jsx global>{`

        /*
         * Texto de los elementos de la Matriz:
         *
         * ROTACIÓN REAL DE 90º.
         *
         * Se utiliza writing-mode para mantener
         * las columnas extremadamente estrechas.
         */

        .matrix-vertical-text {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          white-space: nowrap;
          font-size: 10px;
          line-height: 1;
          font-weight: 700;
          letter-spacing: 0.02em;
          max-height: 190px;
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

        /*
         * Al imprimir:
         *
         * - se ocultan filtros y controles;
         * - se mantiene la cabecera;
         * - la matriz se imprime horizontal;
         * - las cabeceras de tabla se repiten.
         */

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

          /*
           * Eliminamos el sticky durante impresión
           * para evitar problemas de superposición.
           */

          .matrix-fixed-header,
          .matrix-fixed-cell {
            position: static !important;
          }

          /*
           * La matriz no necesita scroll durante
           * la impresión.
           */

          .overflow-auto,
          .overflow-x-auto {
            overflow: visible !important;
          }

          /*
           * Mantener el texto vertical también
           * en el PDF.
           */

          .matrix-vertical-text {
            writing-mode: vertical-rl !important;
            transform: rotate(180deg) !important;
          }

        }

      `}</style>

    </div>
  );
}
