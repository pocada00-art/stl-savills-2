"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  ArrowLeft,
  ImagePlus,
  Plus,
  RotateCcw,
  Search,
  FileCheck2,
  BarChart3,
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
  CircleAlert,
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
    openCenterData,
    setOpenCenterData,
  ] =
    useState(true);

  const [
    openHistory,
    setOpenHistory,
  ] =
    useState(true);

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
   * CATÁLOGO
   * ------------------------------------------------------- */

  const catalog =
    currentCenter.country ===
    "España"
      ? demo.esCatalog
      : demo.ptCatalog;

  const overrides =
    (
      state.centers[
        centerId
      ] || {}
    ) as CenterOverride;

  const centerName =
    currentCenter.name ??
    "";

  const centerCode =
    currentCenter.code ??
    "";

  const centerShortCode =
    currentCenter.shortCode ??
    "";

  /* -------------------------------------------------------
   * ELEMENTOS
   * ------------------------------------------------------- */

  const activeMap =
    state.activeItems[
      centerId
    ] || {};

  const activeItems =
    catalog.filter(
      (x: any) =>
        activeMap[
          x.id
        ] !== false
    );

  const inactiveItems =
    catalog.filter(
      (x: any) =>
        activeMap[
          x.id
        ] === false
    );

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
      activeItems.map(
        (x: any) =>
          x.id
      )
    );

  const categories = [
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

  const visible =
    activeItems.filter(
      (x: any) =>
        (
          category ===
            "Todas" ||
          x.category ===
            category
        ) &&
        `${x.code} ${x.installation} ${x.action} ${x.category}`
          .toLowerCase()
          .includes(
            q.toLowerCase()
          )
    );

  const selectableItems =
    catalog.filter(
      (x: any) =>
        `${x.code} ${x.installation} ${x.action} ${x.category}`
          .toLowerCase()
          .includes(
            addElementSearch.toLowerCase()
          )
    );

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

  function resetPeriod() {
    const next = {
      ...state,
    };

    delete next.reviews[key];

    updateState(next);
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

  const readOnly =
    state.role ===
      "LECTURA" ||
    currentCenter.status !==
      "Activo";

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

        <div className="grid min-h-44 grid-cols-[1fr_180px] bg-[#002A54] text-white">

          <div className="flex items-center gap-5 p-6">

            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white/10">

              {resolvedLogoUrl ? (
                <img
                  src={
                    resolvedLogoUrl
                  }
                  alt="Logo"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-2xl font-black text-[#FFCC00]">
                  {centerShortCode ||
                    centerCode}
                </span>
              )}

            </div>

            <div>

              <div className="text-xs font-bold uppercase tracking-[.18em] text-[#FFCC00]">
                {
                  currentCenter.country
                }{" "}
                ·{" "}
                {
                  currentCenter.stl
                }
              </div>

              <h1 className="mt-2 text-3xl font-black">
                {centerName}
              </h1>

              <p className="mt-2 text-sm text-white/70">
                {
                  currentCenter.address ||
                  "Dirección pendiente"
                }
              </p>

              <div className="mt-3 flex gap-2">

                <Badge tone="success">
                  {
                    currentCenter.status
                  }
                </Badge>

                <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                  Código{" "}
                  {
                    centerShortCode ||
                    "—"
                  }
                </span>

                <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                  Nº{" "}
                  {centerCode}
                </span>

              </div>

            </div>

          </div>

          <div className="flex items-center justify-center bg-white/5 p-4">

            {resolvedImageUrl ? (
              <img
                src={
                  resolvedImageUrl
                }
                alt={centerName}
                className="h-32 w-full rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-32 w-full items-center justify-center rounded-xl border border-dashed border-white/20 text-xs text-white/50">
                Imagen del centro
              </div>
            )}

          </div>

        </div>

      </Card>

      {/* ===================================================
          KPIs
          =================================================== */}

      <div className="grid gap-4 md:grid-cols-5">

        {[
          [
            "Cumplimiento",
            `${summary.score}%`,
          ],
          [
            "Confirmados",
            `${summary.confirmed}/${summary.total}`,
          ],
          [
            "Pendientes",
            summary.pendingConfirmation,
          ],
          [
            "No aptos",
            summary.counts[
              "NO APTO"
            ],
          ],
          [
            "Condicionados",
            summary.counts[
              "APTO CONDICIONADO"
            ],
          ],
        ].map(
          ([t, v]) => (
            <Card
              key={String(t)}
              className="p-5"
            >
              <div className="text-2xl font-black">
                {v}
              </div>

              <div className="mt-1 text-sm text-slate-500">
                {t}
              </div>
            </Card>
          )
        )}

      </div>

      {/* ===================================================
          DATOS DEL CENTRO
          =================================================== */}

      <Card className="p-6">

        <div className="flex items-center justify-between gap-4">

          <SectionTitle
            title="Datos del centro"
            subtitle="Edición disponible según perfil"
            action={
              saved ? (
                <Badge tone="success">
                  Guardado
                </Badge>
              ) : undefined
            }
          />

          <SectionToggle
            open={
              openCenterData
            }
            onClick={() =>
              setOpenCenterData(
                v => !v
              )
            }
          />

        </div>

        {openCenterData && (
          <>

            <div className="grid gap-4 md:grid-cols-4">

              <label className="text-sm">

                <span className="text-xs text-slate-400">
                  Nº centro
                </span>

                <input
                  disabled={
                    readOnly
                  }
                  value={
                    centerCode
                  }
                  onChange={e =>
                    updateCenter(
                      "code",
                      e.target.value
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono outline-none disabled:bg-slate-50"
                />

              </label>

              <label className="text-sm">

                <span className="text-xs text-slate-400">
                  Código corto
                </span>

                <input
                  disabled={
                    readOnly
                  }
                  value={
                    centerShortCode
                  }
                  onChange={e =>
                    updateCenter(
                      "shortCode",
                      e.target.value
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono uppercase outline-none disabled:bg-slate-50"
                />

              </label>

              <label className="text-sm md:col-span-2">

                <span className="text-xs text-slate-400">
                  Nombre completo del centro
                </span>

                <input
                  disabled={
                    readOnly
                  }
                  value={
                    centerName
                  }
                  onChange={e =>
                    updateCenter(
                      "name",
                      e.target.value
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold outline-none disabled:bg-slate-50"
                />

              </label>

              <label className="text-sm">

                <span className="text-xs text-slate-400">
                  Propiedad
                </span>

                <input
                  disabled={
                    readOnly
                  }
                  value={
                    currentCenter.property ??
                    ""
                  }
                  onChange={e =>
                    updateCenter(
                      "property",
                      e.target.value
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
                />

              </label>

              <label className="text-sm md:col-span-3">

                <span className="text-xs text-slate-400">
                  Dirección
                </span>

                <input
                  disabled={
                    readOnly
                  }
                  value={
                    currentCenter.address ??
                    ""
                  }
                  onChange={e =>
                    updateCenter(
                      "address",
                      e.target.value
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
                />

              </label>

              <label className="text-sm md:col-span-2">

                <span className="text-xs text-slate-400">
                  Ciudad
                </span>

                <input
                  disabled={
                    readOnly
                  }
                  value={
                    currentCenter.city ??
                    ""
                  }
                  onChange={e =>
                    updateCenter(
                      "city",
                      e.target.value
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
                />

              </label>

              <label className="text-sm md:col-span-2">

                <span className="text-xs text-slate-400">
                  Provincia
                </span>

                <input
                  disabled={
                    readOnly
                  }
                  value={
                    currentCenter.province ??
                    ""
                  }
                  onChange={e =>
                    updateCenter(
                      "province",
                      e.target.value
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
                />

              </label>

              <label className="text-sm">

                <span className="text-xs text-slate-400">
                  Gerente
                </span>

                <input
                  disabled={
                    readOnly
                  }
                  value={
                    currentCenter.manager ??
                    ""
                  }
                  onChange={e =>
                    updateCenter(
                      "manager",
                      e.target.value
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
                />

              </label>

              <label className="text-sm">

                <span className="text-xs text-slate-400">
                  Teléfono gerente
                </span>

                <input
                  disabled={
                    readOnly
                  }
                  value={
                    currentCenter.managerPhone ??
                    ""
                  }
                  onChange={e =>
                    updateCenter(
                      "managerPhone",
                      e.target.value
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
                />

              </label>

              <label className="text-sm">

                <span className="text-xs text-slate-400">
                  Email gerente
                </span>

                <input
                  disabled={
                    readOnly
                  }
                  type="email"
                  value={
                    currentCenter.managerEmail ??
                    ""
                  }
                  onChange={e =>
                    updateCenter(
                      "managerEmail",
                      e.target.value
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
                />

              </label>

              <div />

              <label className="text-sm">

                <span className="text-xs text-slate-400">
                  Responsable técnico
                </span>

                <input
                  disabled={
                    readOnly
                  }
                  value={
                    currentCenter.technicalResponsible ??
                    ""
                  }
                  onChange={e =>
                    updateCenter(
                      "technicalResponsible",
                      e.target.value
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
                />

              </label>

              <label className="text-sm">

                <span className="text-xs text-slate-400">
                  Teléfono responsable técnico
                </span>

                <input
                  disabled={
                    readOnly
                  }
                  value={
                    currentCenter.technicalResponsiblePhone ??
                    ""
                  }
                  onChange={e =>
                    updateCenter(
                      "technicalResponsiblePhone",
                      e.target.value
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
                />

              </label>

              <label className="text-sm">

                <span className="text-xs text-slate-400">
                  Email responsable técnico
                </span>

                <input
                  disabled={
                    readOnly
                  }
                  type="email"
                  value={
                    currentCenter.technicalResponsibleEmail ??
                    ""
                  }
                  onChange={e =>
                    updateCenter(
                      "technicalResponsibleEmail",
                      e.target.value
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none disabled:bg-slate-50"
                />

              </label>

              <div />

            </div>

            {!readOnly && (
              <div className="mt-5 flex flex-wrap gap-3">

                <label className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">

                  <ImagePlus className="mr-2 inline h-4 w-4" />

                  Logo

                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const f =
                        e.target.files?.[0];

                      if (f) {
                        uploadImage(
                          "logoUrl",
                          f
                        );
                      }
                    }}
                  />

                </label>

                <label className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">

                  <ImagePlus className="mr-2 inline h-4 w-4" />

                  Imagen centro

                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const f =
                        e.target.files?.[0];

                      if (f) {
                        uploadImage(
                          "imageUrl",
                          f
                        );
                      }
                    }}
                  />

                </label>

              </div>
            )}

          </>
        )}

      </Card>

      {/* ===================================================
          HISTÓRICO
          =================================================== */}

      <Card className="p-6">

        <div className="flex items-center justify-between gap-4">

          <SectionTitle
            title="Histórico de cumplimiento"
            subtitle="Revisiones realizadas del centro hasta la fecha actual"
          />

          <SectionToggle
            open={
              openHistory
            }
            onClick={() =>
              setOpenHistory(
                v => !v
              )
            }
          />

        </div>

        {openHistory && (
          <>

            {reviewYears.length ===
            0 ? (
              <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                No hay revisiones históricas cargadas.
              </div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-4">

                {reviewYears.flatMap(
                  y =>
                    (
                      [
                        "S1",
                        "S2",
                      ] as Period[]
                    ).map(p => {
                      const r =
                        state
                          .reviews[
                          reviewKey(
                            centerId,
                            y,
                            p
                          )
                        ];

                      const historicalActiveIds =
                        catalog
                          .filter(
                            (x: any) =>
                              activeMap[
                                x.id
                              ] !==
                              false
                          )
                          .map(
                            (x: any) =>
                              x.id
                          );

                      const sum =
                        reviewSummary(
                          r,
                          historicalActiveIds
                        );

                      return (
                        <div
                          key={`${y}-${p}`}
                          className="rounded-xl border border-slate-200 p-4"
                        >

                          <div className="flex items-center justify-between">

                            <div className="text-xs font-semibold text-slate-400">
                              {p}{" "}
                              {y}
                            </div>

                            {r?.confirmed && (
                              <Badge tone="success">
                                Confirmada
                              </Badge>
                            )}

                          </div>

                          <div className="mt-2 text-xl font-black">
                            {r
                              ? `${sum.score}%`
                              : "—"}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
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

            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">

              <BarChart3 className="h-4 w-4" />

              El histórico muestra únicamente años hasta el año actual.

            </div>

          </>
        )}

      </Card>

      {/* ===================================================
          REVISIÓN
          =================================================== */}

      <Card className="p-6">

        <div className="flex items-center justify-between gap-4">

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

            <div className="mt-5 flex flex-wrap gap-2">

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

              {admin && (
                <Button
                  variant="secondary"
                  onClick={
                    resetPeriod
                  }
                >
                  <RotateCcw className="mr-2 inline h-4 w-4" />
                  Reiniciar demo
                </Button>
              )}

            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-4">

              <div className="rounded-xl bg-slate-50 p-4">

                <div className="text-xs text-slate-400">
                  Estado
                </div>

                <div className="mt-1 font-bold">
                  {review.confirmed
                    ? "CONFIRMADA"
                    : "EN CURSO"}
                </div>

              </div>

              <div className="rounded-xl bg-slate-50 p-4">

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

              <div className="rounded-xl bg-amber-50 p-4">

                <div className="text-xs text-amber-700">
                  Pendientes confirmar
                </div>

                <div className="mt-1 text-xl font-black text-amber-700">
                  {
                    summary.pendingConfirmation
                  }
                </div>

              </div>

              <div className="rounded-xl bg-emerald-50 p-4">

                <div className="text-xs text-emerald-700">
                  Cumplimiento
                </div>

                <div className="mt-1 text-xl font-black text-emerald-700">
                  {
                    summary.score
                  }%
                </div>

              </div>

            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">

              {STATUSES.map(
                s => (
                  <span
                    key={s}
                    className="rounded-full border border-slate-200 px-3 py-1"
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
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">

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

            <div className="mt-5 rounded-xl border border-slate-200 p-4">

              <div className="text-sm font-bold">
                Participantes de la revisión
              </div>

              <div className="mt-2 space-y-2">

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

      <Card className="p-6">

        <div className="flex items-center justify-between gap-4">

          <SectionTitle
            title="Instalaciones y actuaciones"
            subtitle={`${activeItems.length} elementos activos · ${inactiveItems.length} elementos no activos`}
          />

          <SectionToggle
            open={
              openInstallations
            }
            onClick={() =>
              setOpenInstallations(
                v => !v
              )
            }
          />

        </div>

        {openInstallations && (
          <>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">

              <div className="flex flex-wrap items-center gap-2">

                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">

                  <ClipboardCheck className="h-4 w-4" />

                  Leyenda de resultados

                </div>

                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  FAVORABLE
                </span>

                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  CONDICIONADO
                </span>

                <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                  DESFAVORABLE
                </span>

                <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                  PTE.
                </span>

                <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  ERROR
                </span>

              </div>

            </div>

            <div className="mb-4 mt-5 flex flex-col gap-3 xl:flex-row">

              <div className="relative min-w-0 flex-1">

                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />

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

                <table className="min-w-[1700px] w-full text-sm">

                  <thead className="sticky top-0 z-10 bg-[#002A54] text-left text-xs font-bold uppercase tracking-wide text-white">

                    <tr>

                      <th className="w-24 px-3 py-3">
                        Código
                      </th>

                      <th className="w-16 px-2 py-3 text-center">
                        Tipo
                      </th>

                      <th className="min-w-[180px] px-3 py-3">
                        Instalación
                      </th>

                      <th className="min-w-[180px] px-3 py-3">
                        Actuación
                      </th>

                      <th className="w-28 px-3 py-3">
                        Frecuencia
                      </th>

                      <th className="w-36 px-3 py-3">
                        ID equipo
                      </th>

                      <th className="w-40 px-3 py-3">
                        Empresa
                      </th>

                      <th className="w-48 px-3 py-3">
                        Estado revisión
                      </th>

                      <th className="w-36 px-3 py-3">
                        Fecha
                      </th>

                      <th className="w-40 px-3 py-3">
                        Próxima revisión
                      </th>

                      <th className="w-36 px-3 py-3">
                        2ª revisión
                      </th>

                      <th className="w-40 px-3 py-3">
                        Resultado
                      </th>

                      <th className="min-w-[220px] px-3 py-3">
                        Comentario
                      </th>

                      <th className="w-12 px-3 py-3" />

                    </tr>

                  </thead>

                  <tbody>

                    {visible.map(
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

                            <td className="px-3 py-3 align-top font-mono text-xs font-bold text-slate-600">
                              {x.code}
                            </td>

                            <td className="px-2 py-3 align-top">

                              <div
                                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl border ${visual.wrapper}`}
                                title={
                                  x.category ||
                                  x.installation
                                }
                              >
                                <Icon
                                  className={`h-4 w-4 ${visual.icon}`}
                                />
                              </div>

                            </td>

                            <td className="px-3 py-3 align-top">

                              <div className="font-semibold text-slate-800">
                                {
                                  x.installation
                                }
                              </div>

                              {x.category && (
                                <div className="mt-1 text-xs text-slate-400">
                                  {
                                    x.category
                                  }
                                </div>
                              )}

                            </td>

                            <td className="px-3 py-3 align-top text-slate-600">
                              {x.action}
                            </td>

                            <td className="px-3 py-3 align-top">

                              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">

                                <CalendarDays className="h-3 w-3" />

                                {
                                  x.frequency ||
                                  "—"
                                }

                              </span>

                            </td>

                            <td className="px-3 py-3 align-top">

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
                                className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-[#002A54] disabled:bg-slate-50"
                              />

                            </td>

                            <td className="px-3 py-3 align-top">

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
                                className="w-36 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-[#002A54] disabled:bg-slate-50"
                              />

                            </td>

                            <td className="px-3 py-3 align-top">

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
                                className={`w-44 rounded-lg border px-2 py-1.5 text-xs font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-70 ${getStatusClasses(
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
                                      {s}
                                    </option>
                                  )
                                )}

                              </select>

                            </td>

                            <td className="px-3 py-3 align-top">

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
                                className="w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:bg-slate-50"
                              />

                            </td>

                            <td className="px-3 py-3 align-top">

                              <div className="flex min-h-8 items-center gap-2">

                                <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />

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

                            <td className="px-3 py-3 align-top">

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
                                  className="w-32 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs disabled:bg-slate-50"
                                />
                              ) : (
                                <span className="text-xs text-slate-300">
                                  No aplica
                                </span>
                              )}

                            </td>

                            <td className="px-3 py-3 align-top">

                              <span
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${resultVisual.className}`}
                              >

                                <span
                                  className={`h-2 w-2 rounded-full ${resultVisual.dot}`}
                                />

                                {
                                  result
                                }

                              </span>

                            </td>

                            <td className="px-3 py-3 align-top">

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
                                className="w-52 resize-y rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-[#002A54] disabled:bg-slate-50"
                              />

                            </td>

                            <td className="px-3 py-3 align-top">

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
                                    <X className="h-4 w-4" />
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
                          colSpan={
                            15
                          }
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

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-800">

              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />

              <div>
                En esta fase, la próxima revisión se calcula exclusivamente como fecha de ejecución + frecuencia. Todavía no se aplican sábados, domingos ni festivos.
              </div>

            </div>

            {/* =================================================
                ELEMENTOS NO ACTIVOS
                ================================================= */}

            <div className="mt-6 rounded-2xl border border-slate-200 p-5">

              <div className="flex items-center justify-between gap-4">

                <SectionTitle
                  title="Elementos no activos"
                  subtitle="No computan, no generan vencimientos y conservan su histórico"
                  action={
                    !readOnly ? (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setShowAddElement(
                            v =>
                              !v
                          )
                        }
                      >
                        <Plus className="mr-2 inline h-4 w-4" />
                        Añadir elemento
                      </Button>
                    ) : undefined
                  }
                />

              </div>

              {showAddElement &&
                !readOnly && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">

                    <div className="mb-3 text-sm font-bold">
                      Seleccionar elemento del catálogo
                    </div>

                    <div className="relative mb-3">

                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />

                      <input
                        value={
                          addElementSearch
                        }
                        onChange={e =>
                          setAddElementSearch(
                            e.target.value
                          )
                        }
                        placeholder="Buscar cualquier elemento..."
                        className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm"
                      />

                    </div>

                    <div className="max-h-80 space-y-2 overflow-y-auto">

                      {selectableItems.map(
                        (
                          x: any
                        ) => {

                          const isActive =
                            activeMap[
                              x.id
                            ] !==
                            false;

                          const visual =
                            getInstallationVisual(
                              x.installation,
                              x.category
                            );

                          const Icon =
                            visual.Icon;

                          return (
                            <div
                              key={
                                x.id
                              }
                              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
                            >

                              <div className="flex min-w-0 items-center gap-3">

                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${visual.wrapper}`}
                                >
                                  <Icon
                                    className={`h-4 w-4 ${visual.icon}`}
                                  />
                                </div>

                                <div className="min-w-0">

                                  <div className="truncate text-sm font-semibold">
                                    {
                                      x.code
                                    }{" "}
                                    ·{" "}
                                    {
                                      x.installation
                                    }
                                  </div>

                                  <div className="truncate text-xs text-slate-500">
                                    {
                                      x.action
                                    }{" "}
                                    ·{" "}
                                    {
                                      x.frequency
                                    }
                                  </div>

                                </div>

                              </div>

                              {isActive ? (
                                <Badge>
                                  Activo
                                </Badge>
                              ) : (
                                <Button
                                  variant="secondary"
                                  onClick={() =>
                                    setActive(
                                      x.id,
                                      true
                                    )
                                  }
                                >
                                  Activar
                                </Button>
                              )}

                            </div>
                          );
                        }
                      )}

                    </div>

                  </div>
                )}

              <div className="mt-4">

                {inactiveItems.length ===
                0 ? (
                  <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                    No hay elementos no activos actualmente.
                    Utiliza “Añadir elemento” para consultar y activar cualquier elemento del catálogo.
                  </div>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">

                    {inactiveItems.map(
                      (
                        x: any
                      ) => {

                        const visual =
                          getInstallationVisual(
                            x.installation,
                            x.category
                          );

                        const Icon =
                          visual.Icon;

                        return (
                          <div
                            key={
                              x.id
                            }
                            className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm"
                          >

                            <div className="flex min-w-0 items-center gap-3">

                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${visual.wrapper}`}
                              >
                                <Icon
                                  className={`h-4 w-4 ${visual.icon}`}
                                />
                              </div>

                              <div className="min-w-0">

                                <div className="truncate">
                                  <b>
                                    {
                                      x.code
                                    }
                                  </b>{" "}
                                  ·{" "}
                                  {
                                    x.installation
                                  }
                                </div>

                                <div className="truncate text-xs text-slate-500">
                                  {
                                    x.action
                                  }
                                </div>

                              </div>

                            </div>

                            {!readOnly && (
                              <Button
                                variant="secondary"
                                onClick={() =>
                                  setActive(
                                    x.id,
                                    true
                                  )
                                }
                              >
                                Activar
                              </Button>
                            )}

                          </div>
                        );
                      }
                    )}

                  </div>
                )}

              </div>

            </div>

          </>
        )}

      </Card>

    </div>
  );
}
