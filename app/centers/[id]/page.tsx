"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  ArrowLeft,
  ArrowUpDown,
  Plus,
  Minus,
  Search,
  FileCheck2,
  ChevronDown,
  ChevronUp,
  X,
  Building2,
  Zap,
  Flame,
  Droplets,
  ShieldCheck,
  Settings,
  CalendarDays,
  ClipboardCheck,
  BarChart3,
  CircleAlert,
  SlidersHorizontal,
  Eye,
  EyeOff,
} from "lucide-react";

import { demo } from "@/lib/data";

import {
  Card,
  SectionTitle,
  Badge,
  Button,
  Select,
} from "@/components/ui";

import {
  loadState,
  saveState,
  reviewKey,
  reviewSummary,
  blankItem,
  resolveCenter,
  type V1State,
  type V1Status,
  type Period,
  type CenterOverride,
  type CenterItem,
} from "@/lib/v1-state";

import {
  loadCenterImage,
} from "@/lib/image-storage";

const STATUSES: V1Status[] = [
  "APTO",
  "APTO CONDICIONADO",
  "NO APTO",
  "PENDIENTE",
  "SIN INFORMACIÓN",
];

type IconComponent =
  React.ComponentType<{
    className?: string;
  }>;

type TableColumnKey =
  | "code"
  | "type"
  | "installation"
  | "description"
  | "action"
  | "frequency"
  | "equipmentId"
  | "company"
  | "status"
  | "date"
  | "nextReview"
  | "secondReview"
  | "result"
  | "comment"
  | "actions";

const TABLE_COLUMN_LABELS: Record<TableColumnKey, string> = {
  code: "Código",
  type: "Tipo",
  installation: "Instalación",
  description: "Descripción",
  action: "Actuación",
  frequency: "Frecuencia",
  equipmentId: "ID equipo",
  company: "Empresa",
  status: "Estado revisión",
  date: "Fecha",
  nextReview: "Próxima revisión",
  secondReview: "2ª revisión",
  result: "Resultado",
  comment: "Comentario",
  actions: "",
};

const TABLE_COLUMN_DEFAULT_WIDTHS: Record<TableColumnKey, number> = {
  code: 96,
  type: 70,
  installation: 180,
  description: 180,
  action: 180,
  frequency: 120,
  equipmentId: 130,
  company: 140,
  status: 155,
  date: 125,
  nextReview: 155,
  secondReview: 135,
  result: 130,
  comment: 190,
  actions: 52,
};

const TABLE_COLUMN_MIN_WIDTHS: Record<TableColumnKey, number> = {
  code: 70,
  type: 55,
  installation: 120,
  description: 100,
  action: 120,
  frequency: 90,
  equipmentId: 90,
  company: 90,
  status: 110,
  date: 100,
  nextReview: 110,
  secondReview: 100,
  result: 100,
  comment: 120,
  actions: 44,
};

/* =========================================================
 * UTILIDADES VISUALES
 * ========================================================= */

function getInstallationVisual(
  installation = "",
  category = ""
): {
  Icon: IconComponent;
  wrapper: string;
  icon: string;
} {
  const value =
    `${installation} ${category}`.toLowerCase();

  if (
    value.includes("ascensor") ||
    value.includes("montacarga") ||
    value.includes("elevador")
  ) {
    return {
      Icon: Building2,
      wrapper:
        "bg-blue-50 border-blue-100",
      icon: "text-blue-600",
    };
  }

  if (
    value.includes("alta tensión") ||
    value.includes("alta tension") ||
    value.includes("eléctr") ||
    value.includes("electr")
  ) {
    return {
      Icon: Zap,
      wrapper:
        "bg-amber-50 border-amber-100",
      icon: "text-amber-600",
    };
  }

  if (
    value.includes("contra incend") ||
    value.includes("incend")
  ) {
    return {
      Icon: Flame,
      wrapper:
        "bg-red-50 border-red-100",
      icon: "text-red-600",
    };
  }

  if (
    value.includes("agua") ||
    value.includes("fontan") ||
    value.includes("abastecimiento") ||
    value.includes("saneamiento")
  ) {
    return {
      Icon: Droplets,
      wrapper:
        "bg-cyan-50 border-cyan-100",
      icon: "text-cyan-600",
    };
  }

  if (
    value.includes("seguridad") ||
    value.includes("alarma") ||
    value.includes("intrusión") ||
    value.includes("intrusion")
  ) {
    return {
      Icon: ShieldCheck,
      wrapper:
        "bg-violet-50 border-violet-100",
      icon: "text-violet-600",
    };
  }

  if (
    value.includes("climat") ||
    value.includes("aire acondicionado") ||
    value.includes("ventil")
  ) {
    return {
      Icon: Settings,
      wrapper:
        "bg-emerald-50 border-emerald-100",
      icon: "text-emerald-600",
    };
  }

  return {
    Icon: Building2,
    wrapper:
      "bg-slate-50 border-slate-200",
    icon: "text-slate-500",
  };
}

function getStatusClasses(
  status: V1Status
) {
  switch (status) {
    case "APTO":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "APTO CONDICIONADO":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "NO APTO":
      return "bg-red-50 text-red-700 border-red-200";

    case "PENDIENTE":
      return "bg-orange-50 text-orange-700 border-orange-200";

    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function getResultVisual(
  result: string
) {
  switch (result) {
    case "FAVORABLE":
      return {
        className:
          "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-500",
      };

    case "CONDICIONADO":
      return {
        className:
          "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
      };

    case "DESFAVORABLE":
      return {
        className:
          "bg-red-50 text-red-700 border-red-200",
        dot: "bg-red-500",
      };

    case "PTE.":
      return {
        className:
          "bg-orange-50 text-orange-700 border-orange-200",
        dot: "bg-orange-500",
      };

    case "ERROR":
      return {
        className:
          "bg-slate-100 text-slate-700 border-slate-300",
        dot: "bg-slate-500",
      };

    default:
      return {
        className:
          "bg-slate-50 text-slate-500 border-slate-200",
        dot: "bg-slate-300",
      };
  }
}

function formatCenterCode(value: string | number | undefined | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";

  // Los códigos pueden ser enteros (01, 02, 11) o contener
  // un punto decimal (14.4). El punto forma parte del código
  // oficial y nunca debe eliminarse.
  const numeric = raw.match(/^(\d+)([.,]\d+)?$/);
  if (numeric) {
    const integerPart = numeric[1].padStart(2, "0");
    const decimalPart = numeric[2]
      ? `.${numeric[2].slice(1)}`
      : "";
    return `${integerPart}${decimalPart}`;
  }

  return raw.toUpperCase();
}

function normalizeCenterCodeForCompare(value: string | number | undefined | null) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return "";
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric.toString() : raw.toLowerCase();
}

function sentenceCase(value: string | number | null | undefined, fallback = "—") {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function resolveBaseCode(catalog: any[], index: number): string {
  for (let i = index; i >= 0; i -= 1) {
    const code = String(catalog[i]?.code ?? "").trim();
    if (code) return code;
  }
  return "";
}

function instanceCode(baseCode: string, ordinal: number): string {
  return baseCode ? `${baseCode}.${ordinal}` : String(ordinal);
}

/* =========================================================
 * FRECUENCIAS
 * ========================================================= */

function parseFrequency(
  frequency: string
) {
  const value = String(
    frequency || ""
  )
    .trim()
    .toLowerCase();

  if (!value) {
    return null;
  }

  if (value.includes("bimensual")) {
    return {
      months: 2,
    };
  }

  if (value.includes("mensual")) {
    return {
      months: 1,
    };
  }

  if (value.includes("trimestral")) {
    return {
      months: 3,
    };
  }

  if (value.includes("cuatrimestral")) {
    return {
      months: 4,
    };
  }

  if (value.includes("semestral")) {
    return {
      months: 6,
    };
  }

  if (value.includes("bienal")) {
    return {
      months: 24,
    };
  }

  if (value.includes("anual")) {
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
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return null;
    }

    if (
      value.includes("año") ||
      value.includes("años")
    ) {
      return {
        months: Math.round(
          amount * 12
        ),
      };
    }

    return {
      months: Math.round(amount),
    };
  }

  const numericOnly =
    value.match(
      /^\d+(?:[.,]\d+)?$/
    );

  if (numericOnly) {
    const years =
      Number(
        value.replace(",", ".")
      );

    if (
      !Number.isFinite(years) ||
      years <= 0
    ) {
      return null;
    }

    return {
      months: Math.round(
        years * 12
      ),
    };
  }

  return null;
}

/* =========================================================
 * PRÓXIMA REVISIÓN
 * ========================================================= */

function calculateNextReview(
  date: string,
  frequency: string
): string {
  if (!date || !frequency) {
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
    parseFrequency(frequency);

  if (!parsedFrequency) {
    return "";
  }

  const months =
    parsedFrequency.months;

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
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return "";
  }

  const originalDay = day;

  const result =
    new Date(
      year,
      month - 1,
      day
    );

  result.setHours(
    0,
    0,
    0,
    0
  );

  if (
    Number.isNaN(
      result.getTime()
    )
  ) {
    return "";
  }

  const targetMonthIndex =
    month - 1 + months;

  const targetYear =
    year +
    Math.floor(
      targetMonthIndex / 12
    );

  const targetMonth =
    ((targetMonthIndex % 12) + 12) %
    12;

  const lastDayOfTargetMonth =
    new Date(
      targetYear,
      targetMonth + 1,
      0
    ).getDate();

  const targetDay =
    Math.min(
      originalDay,
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
    ).padStart(2, "0");

  const finalDay =
    String(
      finalDate.getDate()
    ).padStart(2, "0");

  return `${finalYear}-${finalMonth}-${finalDay}`;
}

/* =========================================================
 * RESULTADO
 * ========================================================= */

function calculateResult(
  status: V1Status,
  date: string,
  secondReviewDate: string,
  nextReviewDate: string,
  frequency: string
) {
  const normalizedFrequency =
    String(frequency || "")
      .trim()
      .toLowerCase();

  if (
    normalizedFrequency ===
    "inicial"
  ) {
    switch (status) {
      case "APTO":
        return "FAVORABLE";

      case "APTO CONDICIONADO":
        return "CONDICIONADO";

      case "NO APTO":
        return "DESFAVORABLE";

      case "PENDIENTE":
        return "PENDIENTE";

      case "SIN INFORMACIÓN":
        return "SIN INFORMACIÓN";

      default:
        return "ERROR";
    }
  }

  if (
    (
      status === "APTO" ||
      status === "APTO CONDICIONADO" ||
      status === "NO APTO"
    ) &&
    !date
  ) {
    return "ERROR";
  }

  if (!date) {
    return "-";
  }

  if (
    status === "APTO CONDICIONADO"
  ) {
    if (!secondReviewDate) {
      return "CONDICIONADO";
    }

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const secondDate =
      new Date(
        `${secondReviewDate}T00:00:00`
      );

    if (
      !Number.isNaN(
        secondDate.getTime()
      ) &&
      secondDate < today
    ) {
      return "PTE.";
    }

    return "CONDICIONADO";
  }

  if (
    status === "APTO" ||
    status === "NO APTO"
  ) {
    if (!nextReviewDate) {
      return "ERROR";
    }

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const nextDate =
      new Date(
        `${nextReviewDate}T00:00:00`
      );

    if (
      Number.isNaN(
        nextDate.getTime()
      )
    ) {
      return "ERROR";
    }

    if (nextDate < today) {
      return "PTE.";
    }

    if (status === "APTO") {
      return "FAVORABLE";
    }

    if (status === "NO APTO") {
      return "DESFAVORABLE";
    }
  }

  if (
    status === "PENDIENTE" ||
    status === "SIN INFORMACIÓN"
  ) {
    return status;
  }

  return "ERROR";
}

/* =========================================================
 * FECHAS
 * ========================================================= */

function formatDate(
  value: string
) {
  if (!value) {
    return "—";
  }

  const d =
    new Date(
      `${value}T00:00:00`
    );

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {
    return "—";
  }

  return d.toLocaleDateString(
    "es-ES"
  );
}

function HeaderField({
  label,
  value,
  disabled,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`min-w-0 ${className}`}>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[.14em] text-white/45">
        {label}
      </span>
      <input
        disabled={disabled}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full min-w-0 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold uppercase text-white outline-none placeholder:text-white/30 focus:border-[#FFCC00] disabled:cursor-default"
        placeholder="—"
      />
    </label>
  );
}

function HeaderContactRow({
  label,
  name,
  phone,
  email,
  disabled,
  onNameChange,
  onPhoneChange,
  onEmailChange,
}: {
  label: string;
  name: string;
  phone: string;
  email: string;
  disabled: boolean;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[62px_minmax(0,1fr)] items-center gap-2">
      <span className="truncate text-[9px] font-bold uppercase tracking-[.12em] text-white/50">
        {label}
      </span>
      <div className="grid min-w-0 grid-cols-[1.05fr_.55fr_1.25fr] gap-1.5">
        <input
          disabled={disabled}
          value={name}
          onChange={e => onNameChange(e.target.value)}
          className="min-w-0 rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-[11px] font-semibold uppercase text-white outline-none placeholder:text-white/30 focus:border-[#FFCC00] disabled:cursor-default disabled:opacity-60"
          placeholder="NOMBRE"
          aria-label={`${label} nombre`}
        />
        <input
          disabled={disabled}
          value={phone}
          onChange={e => onPhoneChange(e.target.value)}
          className="min-w-0 rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-[11px] font-semibold text-white outline-none placeholder:text-white/30 focus:border-[#FFCC00] disabled:cursor-default disabled:opacity-60"
          placeholder="TELÉFONO"
          aria-label={`${label} teléfono`}
        />
        <input
          disabled={disabled}
          type="email"
          value={email}
          onChange={e => onEmailChange(e.target.value)}
          className="min-w-0 rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-[11px] font-semibold text-white outline-none placeholder:text-white/30 focus:border-[#FFCC00] disabled:cursor-default disabled:opacity-60"
          placeholder="EMAIL"
          aria-label={`${label} email`}
        />
      </div>
    </div>
  );
}

function TableHeader({
  column,
  sort,
  onSort,
  width,
}: {
  column: TableColumnKey;
  sort: { key: TableColumnKey; direction: "asc" | "desc" };
  onSort: (key: TableColumnKey) => void;
  width: number;
}) {
  const sortable = column !== "actions";
  const active = sort.key === column;

  return (
    <th
      className="px-2 py-2"
      style={{ width, minWidth: width }}
    >
      <button
        type="button"
        disabled={!sortable}
        onClick={() => sortable && onSort(column)}
        className={`inline-flex w-full items-center justify-between gap-1 text-left ${
          sortable ? "cursor-pointer hover:text-[#FFCC00]" : "cursor-default"
        }`}
        title={sortable ? `Ordenar por ${TABLE_COLUMN_LABELS[column]}` : undefined}
      >
        <span>{TABLE_COLUMN_LABELS[column]}</span>
        {sortable && (
          <span className="shrink-0 opacity-70">
            {active ? (sort.direction === "asc" ? "▲" : "▼") : <ArrowUpDown className="h-3 w-3" />}
          </span>
        )}
      </button>
    </th>
  );
}

/* =========================================================
 * COMPONENTE
 * ========================================================= */

export default function CenterDetail() {
  const params =
    useParams();

  const id =
    String(params.id);

  /* -------------------------------------------------------
   * ESTADO
   * ------------------------------------------------------- */

  const [
    state,
    setState,
  ] =
    useState<V1State>({
      role: "ADMIN",
      country: undefined,
      centerId: undefined,
      centers: {},
      activeItems: {},
      reviews: {},
    });

  const [
    period,
    setPeriod,
  ] =
    useState<Period>("S2");

  const [
    year,
    setYear,
  ] =
    useState(2026);

  const [
    q,
    setQ,
  ] =
    useState("");

  const [
    category,
    setCategory,
  ] =
    useState("Todas");

  const [
    saved,
    setSaved,
  ] =
    useState(false);

  const [
    participant,
    setParticipant,
  ] =
    useState("");

  const [
    centerCodeDraft,
    setCenterCodeDraft,
  ] =
    useState("");

  const [
    showAddElement,
    setShowAddElement,
  ] =
    useState(false);

  const [
    addElementSearch,
    setAddElementSearch,
  ] =
    useState("");

  const [
    openHistory,
    setOpenHistory,
  ] =
    useState(false);


  const [
    openReview,
    setOpenReview,
  ] =
    useState(true);

  const [
    openInstallations,
    setOpenInstallations,
  ] =
    useState(true);

  const [showColumnOptions, setShowColumnOptions] =
    useState(false);

  const [columnVisibility, setColumnVisibility] =
    useState<Record<TableColumnKey, boolean>>({
      code: true,
      type: true,
      installation: true,
      description: true,
      action: true,
      frequency: true,
      equipmentId: true,
      company: true,
      status: true,
      date: true,
      nextReview: true,
      secondReview: true,
      result: true,
      comment: true,
      actions: true,
    });

  const [columnWidths, setColumnWidths] =
    useState<Record<TableColumnKey, number>>(TABLE_COLUMN_DEFAULT_WIDTHS);

  const [tableSort, setTableSort] =
    useState<{ key: TableColumnKey; direction: "asc" | "desc" }>({
      key: "code",
      direction: "asc",
    });

  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);


  /* -------------------------------------------------------
   * IMÁGENES RESUELTAS
   *
   * Estas dos variables son las que realmente utilizaremos
   * en <img src>.
   *
   * Si el valor original es:
   *
   * indexeddb://center/<id>/image
   *
   * o:
   *
   * indexeddb://center/<id>/logo
   *
   * se resuelve mediante loadCenterImage().
   *
   * Si es una URL normal o data:image, se utiliza
   * directamente.
   * ------------------------------------------------------- */

  const [
    resolvedImageUrl,
    setResolvedImageUrl,
  ] =
    useState<string | null>(
      null
    );

  const [
    resolvedLogoUrl,
    setResolvedLogoUrl,
  ] =
    useState<string | null>(
      null
    );

  /* -------------------------------------------------------
   * CARGA DEL ESTADO
   * ------------------------------------------------------- */

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    const h = () =>
      setState(
        loadState()
      );

    window.addEventListener(
      "stl-role-change",
      h
    );

    return () => {
      window.removeEventListener(
        "stl-role-change",
        h
      );
    };
  }, []);

  /* -------------------------------------------------------
   * AÑO ACTUAL / HISTÓRICO
   *
   * Este useMemo se ejecuta siempre antes de cualquier
   * return condicional.
   * ------------------------------------------------------- */

  const currentYear =
    new Date().getFullYear();

  const reviewYears =
    useMemo(() => {
      const years =
        new Set<number>();

      for (
        let y = 2024;
        y <= currentYear;
        y++
      ) {
        years.add(y);
      }

      Object.keys(
        state.reviews
      ).forEach(
        reviewId => {
          const match =
            reviewId.match(
              /:(\d{4}):(S1|S2)$/
            );

          if (match) {
            const reviewYear =
              Number(
                match[1]
              );

            if (
              reviewYear <=
              currentYear
            ) {
              years.add(
                reviewYear
              );
            }
          }
        }
      );

      return Array.from(
        years
      ).sort(
        (a, b) =>
          a - b
      );
    }, [
      state.reviews,
      currentYear,
    ]);

  /* -------------------------------------------------------
   * CENTRO BASE
   * ------------------------------------------------------- */

  const demoCenter =
    demo.centers.find(
      c => c.id === id
    ) ||
    demo.centers.find(
      c =>
        encodeURIComponent(
          c.id
        ) === id
    ) ||
    null;

  const persistedCenter =
    state.centers[id] ||
    null;

  const rawCenter =
    demoCenter ||
    persistedCenter ||
    null;

  /*
   * IMPORTANTE:
   *
   * No hacemos return aquí.
   *
   * El componente todavía tiene Hooks que deben ejecutarse
   * en todos los renders para evitar React error #310.
   */

  const currentCenter =
    rawCenter
      ? resolveCenter(
          rawCenter,
          state
        )
      : null;

  /*
   * ID estable del centro.
   *
   * Se utiliza también dentro de callbacks para evitar que
   * TypeScript considere currentCenter como posiblemente nulo
   * al capturar la variable en una función.
   */
  const centerId =
    currentCenter?.id ?? "";

  const centerName =
    currentCenter?.name ??
    "";

  const centerCode =
    currentCenter?.code ??
    "";

  const centerShortCode =
    currentCenter?.shortCode ??
    "";

  /*
   * IMPORTANTE: este Hook debe ejecutarse en todos los renders.
   * Se coloca antes del return de "Centro no encontrado" para
   * evitar React error #310 cuando un centro nuevo pasa de no
   * estar disponible a estar disponible tras cargar el estado.
   */
  useEffect(() => {
    const formatted = formatCenterCode(centerCode);
    setCenterCodeDraft(formatted === "—" ? "" : formatted);
  }, [centerId, centerCode]);


  /* -------------------------------------------------------
   * RESOLUCIÓN DE IMÁGENES INDEXEDDB
   *
   * Este Hook está deliberadamente ANTES del return
   * "Centro no encontrado".
   *
   * Así React ejecuta siempre los mismos Hooks en el mismo
   * orden.
   * ------------------------------------------------------- */

  useEffect(() => {
    let cancelled =
      false;

    const urlsToRevoke: string[] =
      [];

    async function resolveImage(
      source:
        | string
        | undefined,
      setter:
        React.Dispatch<
          React.SetStateAction<
            string | null
          >
        >
    ) {
      if (!source) {
        setter(null);
        return;
      }

      /*
       * Imagen normal:
       *
       * - https://...
       * - /images/...
       * - data:image/...
       * - blob:...
       *
       * Se utiliza directamente.
       */
      if (
        !source.startsWith(
          "indexeddb://"
        )
      ) {
        setter(source);
        return;
      }

      try {
        /*
         * loadCenterImage() devuelve directamente una URL
         * preparada para <img src>.
         *
         * NO utilizar URL.createObjectURL() aquí.
         */
        const loaded =
          await loadCenterImage(
            source
          );

        if (
          cancelled
        ) {
          if (
            loaded &&
            loaded.startsWith(
              "blob:"
            )
          ) {
            urlsToRevoke.push(
              loaded
            );
          }

          return;
        }

        if (
          loaded &&
          loaded.startsWith(
            "blob:"
          )
        ) {
          urlsToRevoke.push(
            loaded
          );
        }

        setter(
          loaded || null
        );
      } catch (error) {
        console.error(
          "No se pudo cargar la imagen desde IndexedDB:",
          source,
          error
        );

        if (!cancelled) {
          setter(null);
        }
      }
    }

    const imageSource =
      currentCenter?.imageUrl;

    const logoSource =
      currentCenter?.logoUrl;

    void resolveImage(
      imageSource,
      setResolvedImageUrl
    );

    void resolveImage(
      logoSource,
      setResolvedLogoUrl
    );

    return () => {
      cancelled = true;

      urlsToRevoke.forEach(
        url => {
          try {
            URL.revokeObjectURL(
              url
            );
          } catch {
            /*
             * No hacemos nada.
             *
             * El navegador puede ignorar la revocación si
             * la URL ya no existe.
             */
          }
        }
      );
    };
  }, [
    currentCenter?.id,
    currentCenter?.imageUrl,
    currentCenter?.logoUrl,
  ]);

  /* -------------------------------------------------------
   * CATÁLOGO
   * ------------------------------------------------------- */

  const catalog =
    currentCenter
      ? currentCenter.country === "España"
        ? demo.esCatalog
        : demo.ptCatalog
      : [];

  const overrides =
    (
      state.centers[
        centerId
      ] || {}
    ) as CenterOverride;

  const normalizedDraftCode =
    normalizeCenterCodeForCompare(centerCodeDraft);

  const codeIsOccupied =
    normalizedDraftCode !== "" &&
    [
      ...demo.centers,
      ...Object.entries(state.centers).map(([key, value]) => ({
        id: key,
        ...value,
      })),
    ].some(center => {
      const otherId = String(center.id ?? "");
      const otherCode = String(center.code ?? "")
        .trim();
      const normalizedOtherCode = normalizeCenterCodeForCompare(otherCode);

      return (
        otherId !== centerId &&
        normalizedOtherCode !== "" &&
        normalizedOtherCode === normalizedDraftCode
      );
    });

  /* -------------------------------------------------------
   * ELEMENTOS
   * ------------------------------------------------------- */

  const activeMap =
    state.activeItems[centerId] || {};

  const catalogItems = useMemo(
    () =>
      catalog.map((item: any, index: number) => ({
        ...item,
        baseCode: resolveBaseCode(catalog as any[], index),
      })),
    [catalog]
  );

  const customItems = state.customItems?.[centerId] || [];

  const centerItems = useMemo(() => {
    const baseItems = catalogItems.filter(
      (x: any) => activeMap[x.id] !== false
    );
    return [...baseItems, ...customItems];
  }, [catalogItems, activeMap, customItems]);

  const numberedItems = useMemo(() => {
    const counters = new Map<string, number>();

    return centerItems.map((item: any) => {
      const baseCode = String(item.baseCode ?? item.code ?? "").trim();
      const ordinal = (counters.get(baseCode) || 0) + 1;
      counters.set(baseCode, ordinal);
      return {
        ...item,
        displayCode: instanceCode(baseCode, ordinal),
      };
    });
  }, [centerItems]);

  const selectableItems = useMemo(() => {
    const unique = new Map<string, any>();

    catalogItems.forEach((item: any) => {
      const baseCode = String(item.baseCode ?? item.code ?? "").trim();
      const key = `${baseCode}|${item.installation}`;
      if (!unique.has(key)) unique.set(key, item);
    });

    return Array.from(unique.values()).filter(
      (x: any) =>
        `${x.baseCode} ${sentenceCase(x.installation)} ${sentenceCase(x.action)} ${x.category}`
          .toLowerCase()
          .includes(addElementSearch.toLowerCase())
    );
  }, [catalogItems, addElementSearch]);

  const elementCounts = useMemo(() => {
    const counts = new Map<string, number>();
    centerItems.forEach((item: any) => {
      const baseCode = String(item.baseCode ?? item.code ?? "").trim();
      counts.set(baseCode, (counts.get(baseCode) || 0) + 1);
    });
    return counts;
  }, [centerItems]);

  /* -------------------------------------------------------
   * REVISIÓN
   * ------------------------------------------------------- */

  const key =
    reviewKey(
      centerId,
      year,
      period
    );

  const review =
    state.reviews[key] || {
      year,
      period,
      confirmed: false,
      items: {},
      participants: [],
    };

  const summary =
    reviewSummary(
      review,
      centerItems.map(
        (x: any) => x.id
      )
    );

  const categories = [
    "Todas",
    ...Array.from(
      new Set(
        catalog
          .map((x: any) => x.category)
          .filter(Boolean)
      )
    ),
  ];

  const visible = numberedItems.filter(
    (x: any) =>
      (category === "Todas" || x.category === category) &&
      `${x.displayCode} ${x.installation} ${x.action} ${x.category}`
        .toLowerCase()
        .includes(q.toLowerCase())
  );

  const sortedVisible = useMemo(() => {
    const getSortValue = (item: any): string => {
      const reviewItem = review.items[item.id] || blankItem();
      const nextDate = calculateNextReview(
        reviewItem.date,
        String(item.frequency || "")
      );
      const result = calculateResult(
        reviewItem.status,
        reviewItem.date,
        reviewItem.secondReviewDate,
        nextDate,
        String(item.frequency || "")
      );

      switch (tableSort.key) {
        case "code": return String(item.displayCode ?? "");
        case "type": return String(item.category ?? "");
        case "installation": return String(item.installation ?? "");
        case "description": return String(item.category ?? "");
        case "action": return String(item.action ?? "");
        case "frequency": return String(item.frequency ?? "");
        case "equipmentId": return String(reviewItem.equipmentId ?? "");
        case "company": return String(reviewItem.company ?? "");
        case "status": return String(reviewItem.status ?? "");
        case "date": return String(reviewItem.date ?? "");
        case "nextReview": return String(nextDate ?? "");
        case "secondReview": return String(reviewItem.secondReviewDate ?? "");
        case "result": return String(result ?? "");
        case "comment": return String(reviewItem.comment ?? "");
        case "actions": return "";
        default: return "";
      }
    };

    return [...visible].sort((a: any, b: any) =>
      getSortValue(a).localeCompare(
        getSortValue(b),
        "es",
        { numeric: true, sensitivity: "base" }
      ) * (tableSort.direction === "asc" ? 1 : -1)
    );
  }, [visible, tableSort, review]);

  const visibleColumnCount = Object.values(columnVisibility).filter(Boolean).length;

  function toggleTableSort(key: TableColumnKey) {
    setTableSort(current => ({
      key,
      direction:
        current.key === key && current.direction === "asc"
          ? "desc"
          : "asc",
    }));
  }

  function toggleColumnVisibility(key: TableColumnKey) {
    setColumnVisibility(current => {
      if (current[key] && Object.values(current).filter(Boolean).length <= 1) {
        return current;
      }
      return { ...current, [key]: !current[key] };
    });
  }

  function setColumnWidth(key: TableColumnKey, value: number) {
    setColumnWidths(current => ({ ...current, [key]: value }));
  }

  /*
   * -------------------------------------------------------
   * RETURN CONDICIONAL
   *
   * A partir de aquí todos los Hooks ya se han ejecutado.
   * -------------------------------------------------------
   */

  if (!currentCenter) {
    return (
      <Card className="p-8">
        <h2 className="text-xl font-bold">
          Centro no encontrado
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          El centro no existe ni en el catálogo demo ni
          entre los centros creados mediante el nuevo sistema.
        </p>

        <Link
          href="/centers"
          className="mt-4 inline-block text-sm underline"
        >
          Volver
        </Link>
      </Card>
    );
  }

    /* -------------------------------------------------------
   * ACTUALIZACIÓN DE ESTADO
   * ------------------------------------------------------- */

  function updateState(
    next: V1State
  ) {
    setState(next);

    saveState(next);

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 1500);
  }

  function updateCenter(
    field:
      keyof CenterOverride,
    value: string
  ) {
    /*
     * currentCenter está garantizado por el return
     * condicional anterior.
     *
     * Por tanto TypeScript ya puede tratarlo como no nulo.
     */
    updateState({
      ...state,
      centers: {
        ...state.centers,
        [centerId]: {
          ...overrides,
          [field]: value,
        },
      },
    });
  }

  function setActive(
    itemId: string,
    active: boolean
  ) {
    const next = {
      ...state,
      activeItems: {
        ...state.activeItems,
        [centerId]: {
          ...activeMap,
          [itemId]: active,
        },
      },
    };
    updateState(next);
  }

  function addElement(template: any) {
    if (readOnly || !currentCenter) return;

    // Capturamos el centro en una constante local para que TypeScript
    // mantenga la comprobación de nulabilidad dentro de toda la función.
    const center = currentCenter;

    const reusable = catalogItems.find(
      (item: any) =>
        item.baseCode === template.baseCode &&
        activeMap[item.id] === false
    );

    if (reusable) {
      setActive(reusable.id, true);
      return;
    }

    const customId = `custom-${centerId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const customItem: CenterItem = {
      id: customId,
      baseCode: String(template.baseCode ?? template.code ?? ""),
      country: center.country,
      stl: center.stl,
      category: template.category,
      installation: template.installation,
      action: template.action,
      frequency: template.frequency,
      normativeReference: template.normativeReference ?? null,
    };

    updateState({
      ...state,
      customItems: {
        ...(state.customItems || {}),
        [centerId]: [
          ...(state.customItems?.[centerId] || []),
          customItem,
        ],
      },
    });
  }

  function removeElement(itemId: string) {
    if (readOnly) return;

    const isCustom = customItems.some((item: any) => item.id === itemId);
    const nextReviews = { ...state.reviews };

    Object.keys(nextReviews).forEach(reviewId => {
      if (!nextReviews[reviewId]?.items?.[itemId]) return;
      const nextItems = { ...nextReviews[reviewId].items };
      delete nextItems[itemId];
      nextReviews[reviewId] = { ...nextReviews[reviewId], items: nextItems };
    });

    if (isCustom) {
      updateState({
        ...state,
        customItems: {
          ...(state.customItems || {}),
          [centerId]: customItems.filter((item: any) => item.id !== itemId),
        },
        reviews: nextReviews,
      });
      return;
    }

    updateState({
      ...state,
      activeItems: {
        ...state.activeItems,
        [centerId]: {
          ...activeMap,
          [itemId]: false,
        },
      },
      reviews: nextReviews,
    });
  }

  function getItem(
    itemId: string
  ) {
    return (
      review.items[itemId] ||
      blankItem()
    );
  }

  function updateItem(
    itemId: string,
    patch: Partial<
      ReturnType<
        typeof blankItem
      >
    >
  ) {
    const current =
      getItem(itemId);

    const nextReview = {
      ...review,
      items: {
        ...review.items,
        [itemId]: {
          ...current,
          ...patch,
        },
      },
    };

    updateState({
      ...state,
      reviews: {
        ...state.reviews,
        [key]: nextReview,
      },
    });
  }

  function confirmReview() {
    if (
      state.role !== "ADMIN" ||
      summary.pendingConfirmation >
        0
    ) {
      return;
    }

    const nextReview = {
      ...review,
      confirmed: true,
      confirmedAt:
        new Date().toISOString(),
      confirmedBy:
        "Administrador Demo",
      participants: [
        {
          name: "Gestor Demo",
          role: "GESTOR",
          signed: true,
        },
        {
          name:
            "Administrador Demo",
          role:
            "ADMINISTRADOR",
          signed: true,
        },
        ...(review.participants ||
          []).filter(
          p =>
            p.role ===
            "OTRO"
        ),
      ],
    };

    updateState({
      ...state,
      reviews: {
        ...state.reviews,
        [key]: nextReview,
      },
    });
  }

  function uploadImage(
    field:
      | "imageUrl"
      | "logoUrl",
    file: File
  ) {
    /*
     * La imagen nueva se almacena como data URL mediante
     * el comportamiento existente.
     *
     * Si el alta de centros utiliza indexeddb://, esta
     * pantalla también es capaz de resolverlo mediante
     * loadCenterImage().
     */
    const reader =
      new FileReader();

    reader.onload = () => {
      updateCenter(
        field,
        String(
          reader.result
        )
      );
    };

    reader.readAsDataURL(
      file
    );
  }

  const isInactive =
    String(currentCenter.status ?? "Activo").toLowerCase() !== "activo";

  const readOnly =
    state.role === "LECTURA" ||
    isInactive;

  const admin =
    state.role ===
    "ADMIN";

  /* -------------------------------------------------------
   * TOGGLE DE SECCIONES
   * ------------------------------------------------------- */

  function SectionToggle({
    open,
    onClick,
  }: {
    open: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
        title={
          open
            ? "Ocultar información"
            : "Mostrar información"
        }
      >
        {open ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
    );
  }

  /* =======================================================
   * RENDER
   * ======================================================= */

  return (
    <div className="space-y-6">

      {/* ===================================================
          CABECERA
          =================================================== */}

      <div className="flex items-center gap-3">

        <Link
          href="/centers"
          className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="text-sm text-slate-400">
          Centros / Ficha
        </div>

      </div>

      {/* ===================================================
          CABECERA DEL CENTRO
          =================================================== */}
      <Card className="overflow-hidden">
        <div
          className={`bg-[#002A54] px-3 py-2.5 text-white sm:px-4 sm:py-3 ${
            isInactive ? "grayscale opacity-75" : ""
          }`}
        >
          <div className="grid items-stretch gap-2 lg:grid-cols-[120px_minmax(0,1fr)_190px]">

            {/* LOGO */}
            <label
              className={`group relative flex min-h-[96px] min-w-0 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-white ${
                readOnly ? "" : "cursor-pointer hover:bg-slate-50"
              }`}
              title={readOnly ? "Logo del centro" : "Pulsar para cargar o cambiar el logo"}
            >
              {resolvedLogoUrl ? (
                <img
                  src={resolvedLogoUrl}
                  alt={`Logo ${centerName}`}
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <Building2 className="h-11 w-11 text-slate-300" />
              )}
              {!readOnly && (
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage("logoUrl", f);
                    e.currentTarget.value = "";
                  }}
                />
              )}
            </label>

            {/* INFORMACIÓN: 3 FILAS */}
            <div className="grid min-w-0 grid-rows-[auto_auto_auto] gap-1.5">
              {/* FILA 1 — IDENTIDAD */}
              <div className="flex min-w-0 items-center gap-2">
                <input
                  disabled={readOnly}
                  inputMode="numeric"
                  value={centerCodeDraft}
                  onChange={e => {
                    const value = e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".").slice(0, 8);
                    setCenterCodeDraft(value);
                    updateCenter("code", value);
                  }}
                  onBlur={() => {
                    const value = centerCodeDraft.replace(",", ".").trim();
                    const normalized = formatCenterCode(value) === "—" ? "" : formatCenterCode(value);
                    setCenterCodeDraft(normalized);
                    updateCenter("code", normalized);
                  }}
                  className={`w-[66px] shrink-0 rounded-lg border bg-white/10 px-2 py-1 text-2xl font-black tracking-tight text-white outline-none placeholder:text-white/30 sm:text-3xl ${
                    codeIsOccupied
                      ? "border-red-300 ring-2 ring-red-300/40"
                      : "border-white/15 focus:border-[#FFCC00]"
                  } disabled:cursor-default disabled:opacity-60`}
                  aria-label="Número de centro"
                  placeholder="01"
                />

                <input
                  disabled={readOnly}
                  value={centerName}
                  onChange={e =>
                    updateCenter("name", e.target.value.toUpperCase())
                  }
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-2xl font-black uppercase leading-none tracking-tight text-white outline-none placeholder:text-white/40 focus:border-[#FFCC00] sm:text-3xl disabled:cursor-default disabled:opacity-60"
                  aria-label="Nombre del centro"
                  placeholder="NOMBRE DEL CENTRO"
                />

                <input
                  disabled={readOnly}
                  value={centerShortCode}
                  onChange={e =>
                    updateCenter("shortCode", e.target.value.toUpperCase())
                  }
                  className="w-[82px] shrink-0 rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-sm font-black uppercase tracking-wider text-white outline-none placeholder:text-white/35 focus:border-[#FFCC00] disabled:cursor-default disabled:opacity-60"
                  aria-label="Código corto"
                  placeholder="CÓDIGO"
                />
              </div>

              {codeIsOccupied && (
                <div className="text-[10px] font-semibold leading-none text-red-200">
                  Este número de centro ya está ocupado por otro centro.
                </div>
              )}

              {/* FILA 2 — DIRECCIÓN + PAÍS / PROVINCIA / CIUDAD */}
              <div className="grid min-w-0 grid-cols-[1.35fr_1fr] items-center gap-2">
                <input
                  disabled={readOnly}
                  value={currentCenter.address ?? ""}
                  onChange={e => updateCenter("address", e.target.value.toUpperCase())}
                  className="min-w-0 rounded-lg border border-white/10 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold uppercase text-white outline-none placeholder:text-white/30 focus:border-[#FFCC00] disabled:cursor-default disabled:opacity-60"
                  placeholder="DIRECCIÓN"
                  aria-label="Dirección"
                />

                <div className="grid min-w-0 grid-cols-3 gap-1.5">
                  <div className="min-w-0 truncate rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] font-bold uppercase text-white/75" title={String(currentCenter.country ?? "").toUpperCase()}>
                    {String(currentCenter.country ?? "").toUpperCase() || "—"}
                  </div>

                  <input
                    disabled={readOnly}
                    value={currentCenter.province ?? ""}
                    onChange={e => updateCenter("province", e.target.value.toUpperCase())}
                    className="min-w-0 rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-[10px] font-semibold uppercase text-white outline-none placeholder:text-white/30 focus:border-[#FFCC00] disabled:cursor-default disabled:opacity-60"
                    placeholder="PROVINCIA"
                    aria-label="Provincia"
                  />

                  <input
                    disabled={readOnly}
                    value={currentCenter.city ?? ""}
                    onChange={e => updateCenter("city", e.target.value.toUpperCase())}
                    className="min-w-0 rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-[10px] font-semibold uppercase text-white outline-none placeholder:text-white/30 focus:border-[#FFCC00] disabled:cursor-default disabled:opacity-60"
                    placeholder="CIUDAD"
                    aria-label="Ciudad"
                  />
                </div>
              </div>

              {/* FILA 3 — RESPONSABLES */}
              <div className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-2">
                <HeaderContactRow
                  label="GESTIÓN"
                  name={String(currentCenter.manager ?? "")}
                  phone={String(currentCenter.managerPhone ?? "")}
                  email={String(currentCenter.managerEmail ?? "")}
                  disabled={readOnly}
                  onNameChange={value => updateCenter("manager", value.toUpperCase())}
                  onPhoneChange={value => updateCenter("managerPhone", value)}
                  onEmailChange={value => updateCenter("managerEmail", value)}
                />

                <HeaderContactRow
                  label="TÉCNICO"
                  name={String(currentCenter.technicalResponsible ?? "")}
                  phone={String(currentCenter.technicalResponsiblePhone ?? "")}
                  email={String(currentCenter.technicalResponsibleEmail ?? "")}
                  disabled={readOnly}
                  onNameChange={value => updateCenter("technicalResponsible", value.toUpperCase())}
                  onPhoneChange={value => updateCenter("technicalResponsiblePhone", value)}
                  onEmailChange={value => updateCenter("technicalResponsibleEmail", value)}
                />
              </div>
            </div>

            {/* IMAGEN DEL CENTRO */}
            <label
              className={`group relative flex min-h-[96px] min-w-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white/5 ${
                readOnly ? "" : "cursor-pointer hover:bg-white/10"
              }`}
              title={readOnly ? "Imagen del centro" : "Pulsar para cargar o cambiar la imagen del centro"}
            >
              {resolvedImageUrl ? (
                <img
                  src={resolvedImageUrl}
                  alt={centerName || "Imagen del centro"}
                  className="h-full min-h-[96px] w-full object-cover"
                />
              ) : (
                <div className="flex h-full min-h-[116px] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/20 text-white/40">
                  <Building2 className="h-8 w-8" />
                  <span className="text-[9px] font-semibold uppercase tracking-[.12em]">
                    Imagen del centro
                  </span>
                </div>
              )}
              {!readOnly && (
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage("imageUrl", f);
                    e.currentTarget.value = "";
                  }}
                />
              )}
            </label>
          </div>

          {saved && (
            <div className="mt-1 text-right text-[10px] font-semibold text-[#FFCC00]">
              Cambios guardados
            </div>
          )}
        </div>
      </Card>

      {/* ===================================================
          REVISIÓN
          =================================================== */}

      <Card className="p-3 sm:p-4">

        <div className="flex items-center justify-between gap-3">

          <SectionTitle
            title="Revisión técnico-legal"
            subtitle="Dos revisiones anuales con histórico independiente."
          />

          <SectionToggle
            open={
              openReview
            }
            onClick={() =>
              setOpenReview(
                v => !v
              )
            }
          />

        </div>

        {openReview && (
          <>

            <div className="mt-2 flex flex-wrap gap-1.5">

              <Select
                value={String(
                  year
                )}
                onChange={v =>
                  setYear(
                    Number(v)
                  )
                }
              >
                <option>
                  2026
                </option>
                <option>
                  2027
                </option>
                <option>
                  2028
                </option>
              </Select>

              <Select
                value={period}
                onChange={v =>
                  setPeriod(
                    v as Period
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

              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setOpenHistory(v => !v)}
                  title={openHistory ? "Ocultar histórico de cumplimiento" : "Mostrar histórico de cumplimiento"}
                  aria-label={openHistory ? "Ocultar histórico de cumplimiento" : "Mostrar histórico de cumplimiento"}
                  className={`rounded-xl border p-2 transition ${
                    openHistory
                      ? "border-[#FFCC00] bg-[#FFCC00] text-[#002A54]"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddElement(v => !v)}
                  title={showAddElement ? "Ocultar añadir elementos" : "Añadir elementos"}
                  aria-label={showAddElement ? "Ocultar añadir elementos" : "Añadir elementos"}
                  className={`rounded-xl border p-2 transition ${
                    showAddElement
                      ? "border-[#FFCC00] bg-[#FFCC00] text-[#002A54]"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

            </div>

            {openHistory && (
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">
                      Histórico de cumplimiento
                    </div>
                    <div className="text-xs text-slate-500">
                      Revisiones realizadas del centro hasta la fecha actual.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenHistory(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                    title="Ocultar histórico"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {reviewYears.length === 0 ? (
                  <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                    No hay revisiones históricas cargadas.
                  </div>
                ) : (
                  <div className="grid gap-1.5 md:grid-cols-4">
                    {reviewYears.flatMap(
                      y =>
                        (["S1", "S2"] as Period[]).map(p => {
                          const r =
                            state.reviews[reviewKey(centerId, y, p)];

                          const historicalActiveIds =
                            catalog
                              .filter(
                                (x: any) =>
                                  activeMap[x.id] !== false
                              )
                              .map((x: any) => x.id);

                          const sum = reviewSummary(
                            r,
                            historicalActiveIds
                          );

                          return (
                            <div
                              key={`${y}-${p}`}
                              className="rounded-lg border border-slate-200 bg-white p-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-semibold text-slate-400">
                                  {p} {y}
                                </div>
                                {r?.confirmed && (
                                  <Badge tone="success">
                                    Confirmada
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-0.5 text-base font-black">
                                {r ? `${sum.score}%` : "—"}
                              </div>
                              <div className="mt-0.5 text-[10px] text-slate-500">
                                {r
                                  ? r.confirmed
                                    ? "Revisión confirmada"
                                    : "Revisión cargada sin confirmar"
                                  : "Sin revisión cargada"}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <BarChart3 className="h-4 w-4" />
                  El histórico muestra únicamente años hasta el año actual.
                </div>
              </div>
            )}

            {showAddElement && !readOnly && (
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-800">Añadir elementos</div>
                    <div className="text-[10px] text-slate-500">Selecciona una instalación y pulsa + tantas veces como unidades necesites.</div>
                  </div>
                  <button type="button" onClick={() => setShowAddElement(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700" title="Cerrar">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input value={addElementSearch} onChange={e => setAddElementSearch(e.target.value)} placeholder="Buscar instalación..." className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-xs outline-none focus:border-[#002A54]" />
                </div>
                <div className="grid max-h-56 gap-1.5 overflow-y-auto md:grid-cols-2 xl:grid-cols-3">
                  {selectableItems.map((x: any) => {
                    const baseCode = String(x.baseCode ?? x.code ?? "").trim();
                    const count = elementCounts.get(baseCode) || 0;
                    const last = [...centerItems].reverse().find((item: any) => String(item.baseCode ?? item.code ?? "").trim() === baseCode);
                    return (
                      <div key={`${baseCode}-${x.installation}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-slate-800">{baseCode} · {x.installation}</div>
                          <div className="truncate text-[10px] text-slate-400">{count} elemento{count === 1 ? "" : "s"}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" disabled={!last} onClick={() => last && removeElement(last.id)} className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30" title="Eliminar un elemento"><Minus className="h-3 w-3" /></button>
                          <span className="w-5 text-center text-xs font-bold text-slate-700">{count}</span>
                          <button type="button" onClick={() => addElement(x)} className="flex h-6 w-6 items-center justify-center rounded-md bg-[#002A54] text-white hover:bg-[#003a73]" title="Añadir un elemento"><Plus className="h-3 w-3" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-2 grid gap-1.5 md:grid-cols-4">

              <div className="rounded-lg bg-slate-50 p-2.5">

                <div className="text-xs text-slate-400">
                  Estado
                </div>

                <div className="mt-1 font-bold">
                  {review.confirmed
                    ? "CONFIRMADA"
                    : "EN CURSO"}
                </div>

              </div>

              <div className="rounded-lg bg-slate-50 p-2.5">

                <div className="text-xs text-slate-400">
                  Elementos
                </div>

                <div className="mt-1 font-bold">
                  {
                    summary.confirmed
                  }/
                  {
                    summary.total
                  }
                </div>

              </div>

              <div className="rounded-lg bg-amber-50 p-2.5">

                <div className="text-xs text-amber-700">
                  Pendientes confirmar
                </div>

                <div className="mt-0.5 text-lg font-black text-amber-700">
                  {
                    summary.pendingConfirmation
                  }
                </div>

              </div>

              <div className="rounded-lg bg-emerald-50 p-2.5">

                <div className="text-xs text-emerald-700">
                  Cumplimiento
                </div>

                <div className="mt-0.5 text-lg font-black text-emerald-700">
                  {
                    summary.score
                  }%
                </div>

              </div>

            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">

              {STATUSES.map(
                s => (
                  <span
                    key={s}
                    className="rounded-full border border-slate-200 px-2 py-0.5"
                  >
                    <b>
                      {
                        summary.counts[
                          s
                        ]
                      }
                    </b>{" "}
                    {s}
                  </span>
                )
              )}

            </div>

            {review.confirmed && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">

                <div>

                  <div className="font-bold text-emerald-800">
                    Revisión{" "}
                    {period}{" "}
                    {year}{" "}
                    confirmada
                  </div>

                  <div className="text-xs text-emerald-700">
                    Administrador:{" "}
                    {
                      review.confirmedBy
                    }{" "}
                    ·{" "}
                    {review.confirmedAt
                      ? new Date(
                          review.confirmedAt
                        ).toLocaleString(
                          "es-ES"
                        )
                      : "—"}
                  </div>

                </div>

                <Link
                  href={`/centers/${centerId}/certificate?year=${year}&period=${period}`}
                  className="rounded-xl bg-[#002A54] px-4 py-2 text-sm font-semibold text-white"
                >
                  <FileCheck2 className="mr-2 inline h-4 w-4" />
                  Ver / exportar certificado
                </Link>

              </div>
            )}

            <div className="mt-2 rounded-lg border border-slate-200 p-2.5">

              <div className="text-sm font-bold">
                Participantes de la revisión
              </div>

              <div className="mt-1 space-y-1">

                {(
                  review.participants ||
                  []
                ).map(
                  (
                    p,
                    i
                  ) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs"
                    >

                      <span>
                        {p.name}{" "}
                        ·{" "}
                        {p.role}
                      </span>

                      {p.signed ? (
                        <Badge tone="success">
                          Firmado
                        </Badge>
                      ) : admin &&
                        !review.confirmed ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            const participants =
                              [
                                ...(
                                  review.participants ||
                                  []
                                ),
                              ];

                            participants[
                              i
                            ] = {
                              ...participants[
                                i
                              ],
                              signed:
                                true,
                            };

                            updateState({
                              ...state,
                              reviews: {
                                ...state.reviews,
                                [key]: {
                                  ...review,
                                  participants,
                                },
                              },
                            });
                          }}
                        >
                          Firmar
                        </Button>
                      ) : (
                        <Badge>
                          Pendiente
                        </Badge>
                      )}

                    </div>
                  )
                )}

              </div>

              {!readOnly &&
                !review.confirmed && (
                  <div className="mt-3 flex gap-2">

                    <input
                      value={
                        participant
                      }
                      onChange={e =>
                        setParticipant(
                          e.target.value
                        )
                      }
                      placeholder="Añadir participante"
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />

                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (
                          !participant.trim()
                        ) {
                          return;
                        }

                        const nextReview =
                          {
                            ...review,
                            participants:
                              [
                                ...(
                                  review.participants ||
                                  []
                                ),
                                {
                                  name:
                                    participant.trim(),
                                  role: "OTRO",
                                  signed:
                                    false,
                                },
                              ],
                          };

                        updateState({
                          ...state,
                          reviews: {
                            ...state.reviews,
                            [key]:
                              nextReview,
                          },
                        });

                        setParticipant(
                          ""
                        );
                      }}
                    >
                      Añadir
                    </Button>

                  </div>
                )}

            </div>

          </>
        )}

      </Card>

      {/* ===================================================
          INSTALACIONES
          =================================================== */}

      <Card className="p-3 sm:p-4">

        <div className="flex items-center justify-between gap-3">

          <SectionTitle
            title="Instalaciones y actuaciones"
            subtitle={`${centerItems.length} elementos configurados`}
          />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowColumnOptions(v => !v)}
              title="Configurar columnas"
              aria-label="Configurar columnas"
              className={`rounded-xl border p-2 transition ${
                showColumnOptions
                  ? "border-[#FFCC00] bg-[#FFCC00] text-[#002A54]"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <SectionToggle
              open={openInstallations}
              onClick={() => setOpenInstallations(v => !v)}
            />
          </div>

        </div>

        {openInstallations && (
          <>

            {showColumnOptions && (
              <div className="mb-2 mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-700">Configuración de columnas</div>
                  <div className="text-[10px] text-slate-400">Pulsa el título para ordenar. Ajusta el ancho con cada control.</div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {(Object.keys(TABLE_COLUMN_LABELS) as TableColumnKey[]).map(column => (
                    <div key={column} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleColumnVisibility(column)}
                          className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-700"
                          title={columnVisibility[column] ? `Ocultar ${TABLE_COLUMN_LABELS[column] || "columna"}` : `Mostrar ${TABLE_COLUMN_LABELS[column] || "columna"}`}
                        >
                          {columnVisibility[column] ? <Eye className="h-3.5 w-3.5 shrink-0" /> : <EyeOff className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate">{TABLE_COLUMN_LABELS[column] || "Acciones"}</span>
                        </button>
                        <span className="shrink-0 text-[10px] font-mono text-slate-400">{columnWidths[column]} px</span>
                      </div>
                      {columnVisibility[column] && (
                        <input
                          className="mt-1 w-full"
                          type="range"
                          min={TABLE_COLUMN_MIN_WIDTHS[column]}
                          max="320"
                          step="5"
                          value={columnWidths[column]}
                          onChange={e => setColumnWidth(column, Number(e.target.value))}
                          aria-label={`Ancho de ${TABLE_COLUMN_LABELS[column] || "acciones"}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-2 mt-3 flex flex-col gap-2 xl:flex-row">

              <div className="relative min-w-0 flex-1">

                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />

                <input
                  value={q}
                  onChange={e =>
                    setQ(
                      e.target.value
                    )
                  }
                  placeholder="Buscar código, instalación, actuación..."
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
                />

              </div>

              <Select
                value={
                  category
                }
                onChange={
                  setCategory
                }
              >
                {categories.map(
                  c => (
                    <option
                      key={c}
                      value={c}
                    >
                      {c}
                    </option>
                  )
                )}
              </Select>

            </div>

            <div className="rounded-2xl border border-slate-200">

              <div className="overflow-x-auto">

                <table className="min-w-[1500px] w-full text-xs">

                  <colgroup>
                    {(Object.keys(TABLE_COLUMN_LABELS) as TableColumnKey[]).map(column => (
                      <col
                        key={column}
                        style={{
                          width: columnWidths[column],
                          minWidth: columnWidths[column],
                          display: columnVisibility[column] ? undefined : "none",
                        }}
                      />
                    ))}
                  </colgroup>

                  <thead className="sticky top-0 z-10 bg-[#002A54] text-left text-xs font-bold tracking-wide text-white">
                    <tr>
                      {(Object.keys(TABLE_COLUMN_LABELS) as TableColumnKey[]).map(column => (
                        <TableHeader
                          key={column}
                          column={column}
                          sort={tableSort}
                          onSort={toggleTableSort}
                          width={columnWidths[column]}
                        />
                      ))}
                    </tr>
                  </thead>

                  <tbody>

                    {sortedVisible.map(
                      (
                        x: any
                      ) => {

                        const item =
                          getItem(
                            x.id
                          );

                        const locked =
                          readOnly ||
                          review.confirmed;

                        const visual =
                          getInstallationVisual(
                            x.installation,
                            x.category
                          );

                        const nextDate =
                          calculateNextReview(
                            item.date,
                            String(
                              x.frequency ||
                              ""
                            )
                          );

                        const result =
                          calculateResult(
                            item.status,
                            item.date,
                            item.secondReviewDate,
                            nextDate,
                            String(
                              x.frequency ||
                              ""
                            )
                          );

                        const resultVisual =
                          getResultVisual(
                            result
                          );

                        const Icon =
                          visual.Icon;

                        return (
                          <tr
                            key={
                              x.id
                            }
                            className="border-t border-slate-100 hover:bg-slate-50"
                          >

                            <td className="px-2 py-2 align-top font-mono text-xs font-bold text-slate-600">
                              {x.displayCode}
                            </td>

                            <td className="px-1.5 py-2 align-top">

                              <div
                                className={`mx-auto flex h-7 w-7 items-center justify-center rounded-xl border ${visual.wrapper}`}
                                title={
                                  x.category ||
                                  x.installation
                                }
                              >
                                <Icon
                                  className={`h-3.5 w-3.5 ${visual.icon}`}
                                />
                              </div>

                            </td>

                            <td className="px-2 py-2 align-top">
                              <div className="font-semibold leading-tight text-slate-800">
                                {x.installation}
                              </div>
                            </td>

                            <td className="px-2 py-2 align-top text-slate-400">
                              <div className="truncate" title={x.category || ""}>
                                {sentenceCase(x.category)}
                              </div>
                            </td>

                            <td className="px-2 py-2 align-top text-slate-600">
                              {x.action}
                            </td>

                            <td className="px-2 py-2 align-top">

                              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">

                                <CalendarDays className="h-3 w-3" />

                                {
                                  x.frequency ||
                                  "—"
                                }

                              </span>

                            </td>

                            <td className="px-2 py-2 align-top">

                              <input
                                disabled={
                                  locked
                                }
                                value={
                                  item.equipmentId
                                }
                                onChange={e =>
                                  updateItem(
                                    x.id,
                                    {
                                      equipmentId:
                                        e.target.value,
                                    }
                                  )
                                }
                                placeholder="ID equipo"
                                className="w-28 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs outline-none focus:border-[#002A54] disabled:bg-slate-50"
                              />

                            </td>

                            <td className="px-2 py-2 align-top">

                              <input
                                disabled={
                                  locked
                                }
                                value={
                                  item.company
                                }
                                onChange={e =>
                                  updateItem(
                                    x.id,
                                    {
                                      company:
                                        e.target.value,
                                    }
                                  )
                                }
                                placeholder="Empresa"
                                className="w-28 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs outline-none focus:border-[#002A54] disabled:bg-slate-50"
                              />

                            </td>

                            <td className="px-2 py-2 align-top">

                              <select
                                disabled={
                                  locked
                                }
                                value={
                                  item.status
                                }
                                onChange={e =>
                                  updateItem(
                                    x.id,
                                    {
                                      status:
                                        e.target.value as V1Status,
                                    }
                                  )
                                }
                                className={`w-36 rounded-lg border px-1.5 py-1 text-xs font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-70 ${getStatusClasses(
                                  item.status
                                )}`}
                              >

                                {STATUSES.map(
                                  s => (
                                    <option
                                      key={
                                        s
                                      }
                                      value={
                                        s
                                      }
                                    >
                                      {sentenceCase(s)}
                                    </option>
                                  )
                                )}

                              </select>

                            </td>

                            <td className="px-2 py-2 align-top">

                              <input
                                disabled={
                                  locked
                                }
                                type="date"
                                value={
                                  item.date
                                }
                                onChange={e =>
                                  updateItem(
                                    x.id,
                                    {
                                      date:
                                        e.target.value,
                                    }
                                  )
                                }
                                className="w-28 rounded-lg border border-slate-200 px-1.5 py-1 text-xs disabled:bg-slate-50"
                              />

                            </td>

                            <td className="px-2 py-2 align-top">

                              <div className="flex min-h-8 items-center gap-2">

                                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />

                                {nextDate ? (
                                  <div>

                                    <div className="font-semibold text-slate-700">
                                      {
                                        formatDate(
                                          nextDate
                                        )
                                      }
                                    </div>

                                    <div className="text-[10px] text-slate-400">
                                      {x.frequency
                                        ? `Fecha + ${x.frequency}`
                                        : "Calculada automáticamente"}
                                    </div>

                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-400">

                                    {!item.date
                                      ? "Introduce fecha"
                                      : !x.frequency
                                      ? "Sin frecuencia"
                                      : "Frecuencia no reconocida"}

                                  </div>
                                )}

                              </div>

                            </td>

                            <td className="px-2 py-2 align-top">

                              {item.status ===
                              "APTO CONDICIONADO" ? (
                                <input
                                  disabled={
                                    locked
                                  }
                                  type="date"
                                  value={
                                    item.secondReviewDate
                                  }
                                  onChange={e =>
                                    updateItem(
                                      x.id,
                                      {
                                        secondReviewDate:
                                          e.target.value,
                                      }
                                    )
                                  }
                                  className="w-28 rounded-lg border border-amber-200 bg-amber-50 px-1.5 py-1 text-xs disabled:bg-slate-50"
                                />
                              ) : (
                                <span className="text-xs text-slate-300">
                                  No aplica
                                </span>
                              )}

                            </td>

                            <td className="px-2 py-2 align-top">

                              <span
                                className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-bold ${resultVisual.className}`}
                              >

                                <span
                                  className={`h-2 w-2 rounded-full ${resultVisual.dot}`}
                                />

                                {sentenceCase(result)}

                              </span>

                            </td>

                            <td className="px-2 py-2 align-top">

                              <textarea
                                disabled={
                                  locked
                                }
                                value={
                                  item.comment
                                }
                                onChange={e =>
                                  updateItem(
                                    x.id,
                                    {
                                      comment:
                                        e.target.value,
                                    }
                                  )
                                }
                                placeholder="Introducir comentario..."
                                rows={2}
                                className="w-40 resize-y rounded-lg border border-slate-200 px-1.5 py-1 text-xs outline-none focus:border-[#002A54] disabled:bg-slate-50"
                              />

                            </td>

                            <td className="px-2 py-2 align-top">

                              {!readOnly &&
                                !review.confirmed && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActive(
                                        x.id,
                                        false
                                      )
                                    }
                                    title="Eliminar del listado activo"
                                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}

                            </td>

                          </tr>
                        );
                      }
                    )}

                    {visible.length ===
                      0 && (
                      <tr>

                        <td
                          colSpan={visibleColumnCount}
                          className="px-6 py-12 text-center text-sm text-slate-400"
                        >
                          No hay elementos que coincidan con la búsqueda.
                        </td>

                      </tr>
                    )}

                  </tbody>

                </table>

              </div>

            </div>

            <div
              ref={tableScrollRef}
              className="overflow-x-auto rounded-b-lg border-x border-b border-slate-200"
              onScroll={e => {
                if (bottomScrollRef.current) {
                  bottomScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
                }
              }}
            >
              <div className="h-1 min-w-[1500px]" />
            </div>

            <div
              ref={bottomScrollRef}
              className="fixed bottom-0 left-0 right-0 z-40 overflow-x-auto border border-slate-200 bg-white/95 shadow-lg backdrop-blur"
              onScroll={e => {
                if (tableScrollRef.current) {
                  tableScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
                }
              }}
            >
              <div className="h-2 min-w-[1500px]" />
            </div>

            <div className="mt-2 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-2 text-[10px] text-blue-800">

              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />

              <div>
                En esta fase, la próxima revisión se calcula exclusivamente como fecha de ejecución + frecuencia. Todavía no se aplican sábados, domingos ni festivos.
              </div>

            </div>

          </>
        )}

      </Card>

    </div>
  );
}
