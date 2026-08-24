export type V1Role =
  | "ADMIN"
  | "GESTOR"
  | "LECTURA";

export type V1Status =
  | "APTO"
  | "APTO CONDICIONADO"
  | "NO APTO"
  | "PENDIENTE"
  | "SIN INFORMACIÓN";

export type Period =
  | "S1"
  | "S2";

export type ItemReview = {
  status: V1Status;
  date: string;
  company: string;

  // Datos adicionales de la revisión
  equipmentId: string;
  observations: string;
  comment: string;
  secondReviewDate: string;

  // Equivalentes a las columnas M, N y O del Excel
  apto: boolean;
  condicionado: boolean;
  noApto: boolean;

  confirmed: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
};

export type ReviewState = {
  year: number;
  period: Period;
  confirmed: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
  items: Record<string, ItemReview>;
  participants: {
    name: string;
    role: string;
    signed: boolean;
  }[];
};

/**
 * Datos modificables de un centro.
 *
 * Estos campos representan únicamente los cambios
 * realizados por el usuario sobre los datos originales
 * de demo.centers.
 *
 * Los campos son opcionales porque state.centers[id]
 * solo almacena aquello que haya sido modificado.
 */
export type CenterOverride = {
  id?: string;

  name?: string;
  code?: string;
  shortCode?: string;

  address?: string;
  country?: string;
  city?: string;
  province?: string;

  stl?: string;
  framework?: string;
  status?: string;

  property?: string | null;

  manager?: string | null;
  managerPhone?: string;
  managerEmail?: string;

  technicalResponsible?: string;
  technicalResponsiblePhone?: string;
  technicalResponsibleEmail?: string;

  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;

  imageUrl?: string;
  logoUrl?: string;
};

/**
 * Centro resultante después de aplicar:
 *
 *   datos originales del centro
 *   +
 *   overrides guardados en V1State
 *
 * El tipo se mantiene separado de CenterOverride porque
 * representa el centro ya resuelto que utilizan las vistas.
 */
export type ResolvedCenter = {
  id: string;
  name: string;
  code: string;
  shortCode?: string;

  address?: string;
  country: string;
  stl: string;
  framework?: string;
  status: string;

  property?: string | null;

  manager?: string | null;
  managerPhone?: string;
  managerEmail?: string;

  technicalResponsible?: string;
  technicalResponsiblePhone?: string;
  technicalResponsibleEmail?: string;

  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;

  city?: string;
  province?: string;

  imageUrl?: string;
  logoUrl?: string;
};

export type V1Country =
  | "España"
  | "Portugal";

export type V1State = {
  role: V1Role;

  country?: V1Country;

  centerId?: string;

  centers: Record<
    string,
    CenterOverride
  >;

  activeItems: Record<
    string,
    Record<string, boolean>
  >;

  reviews: Record<
    string,
    ReviewState
  >;
};

export const STORAGE_KEY =
  "stl-savills-v1-state";

export const CURRENT_YEAR = 2026;

export const CURRENT_PERIOD: Period =
  "S2";

/* =========================================================
 * CENTROS
 * ========================================================= */

/**
 * Resuelve un centro aplicando los cambios guardados
 * en state.centers[id] sobre los datos originales.
 *
 * Regla:
 *
 *   centro original
 *          +
 *   override guardado
 *          =
 *   centro resuelto
 *
 * El ID interno nunca se modifica.
 *
 * El código/número del centro procede del dato original
 * salvo que exista explícitamente un override guardado.
 *
 * Esta función debe ser utilizada por las distintas
 * pantallas de la aplicación que necesiten mostrar
 * información editable del centro.
 */
export function resolveCenter<
  T extends Record<string, any>
>(
  center: T,
  state: V1State
): T & ResolvedCenter {
  const overrides =
    (state.centers?.[center.id] ||
      {}) as CenterOverride;

  return {
    ...center,
    ...overrides,

    /*
     * El identificador interno nunca se modifica.
     */
    id: center.id,

    /*
     * El nombre sí puede ser modificado.
     */
    name:
      overrides.name !== undefined
        ? String(overrides.name)
        : String(center.name ?? ""),

    /*
     * El número de centro es el oficial,
     * salvo que exista un override explícito.
     */
    code:
      overrides.code !== undefined
        ? String(overrides.code)
        : String(center.code ?? ""),

    shortCode:
      overrides.shortCode !== undefined
        ? String(overrides.shortCode)
        : center.shortCode,

    country:
      overrides.country !== undefined
        ? String(overrides.country)
        : String(center.country ?? ""),

    stl:
      overrides.stl !== undefined
        ? String(overrides.stl)
        : String(center.stl ?? ""),

    status:
      overrides.status !== undefined
        ? String(overrides.status)
        : String(center.status ?? ""),
  } as T & ResolvedCenter;
}

/**
 * Resuelve todos los centros de la aplicación.
 *
 * Mantiene una única regla de resolución para cualquier
 * vista que trabaje con centros.
 */
export function resolveCenters<
  T extends Record<string, any>
>(
  centers: T[],
  state: V1State
): Array<T & ResolvedCenter> {
  return centers.map(
    center =>
      resolveCenter(
        center,
        state
      )
  );
}

/* =========================================================
 * REVISIONES
 * ========================================================= */

export function blankItem(): ItemReview {
  return {
    status:
      "SIN INFORMACIÓN",

    date: "",
    company: "",

    equipmentId: "",
    observations: "",
    comment: "",
    secondReviewDate: "",

    apto: false,
    condicionado: false,
    noApto: false,

    confirmed: false,
  };
}

export function reviewKey(
  centerId: string,
  year: number,
  period: Period
) {
  return `${centerId}:${year}:${period}`;
}

/* =========================================================
 * ESTADO
 * ========================================================= */

function getEmptyState(): V1State {
  return {
    role: "ADMIN",
    country: undefined,
    centerId: undefined,

    centers: {},

    activeItems: {},

    reviews: {},
  };
}

export function loadState(): V1State {
  if (
    typeof window ===
    "undefined"
  ) {
    return getEmptyState();
  }

  try {
    const raw =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (raw) {
      return JSON.parse(
        raw
      ) as V1State;
    }
  } catch {}

  return getEmptyState();
}

export function saveState(
  state: V1State
) {
  if (
    typeof window !==
    "undefined"
  ) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );
  }
}

/* =========================================================
 * PUNTUACIÓN
 * ========================================================= */

export function scoreForV1Status(
  status: V1Status
) {
  return {
    APTO: 3,
    "APTO CONDICIONADO": 2,
    "NO APTO": 1,
    PENDIENTE: 0,
    "SIN INFORMACIÓN": 0,
  }[status];
}

/* =========================================================
 * RESUMEN DE REVISIÓN
 * ========================================================= */

export function reviewSummary(
  review:
    | ReviewState
    | undefined,
  activeIds: string[]
) {
  const items =
    activeIds.map(
      id =>
        review?.items?.[id] ??
        blankItem()
    );

  const counts = {
    APTO: items.filter(
      i =>
        i.status === "APTO"
    ).length,

    "APTO CONDICIONADO":
      items.filter(
        i =>
          i.status ===
          "APTO CONDICIONADO"
      ).length,

    "NO APTO":
      items.filter(
        i =>
          i.status ===
          "NO APTO"
      ).length,

    PENDIENTE:
      items.filter(
        i =>
          i.status ===
          "PENDIENTE"
      ).length,

    "SIN INFORMACIÓN":
      items.filter(
        i =>
          i.status ===
          "SIN INFORMACIÓN"
      ).length,
  };

  const confirmed =
    items.filter(
      i => i.confirmed
    ).length;

  const points =
    items.reduce(
      (sum, i) =>
        sum +
        scoreForV1Status(
          i.status
        ),
      0
    );

  const max =
    activeIds.length * 3;

  return {
    counts,

    confirmed,

    total:
      items.length,

    pendingConfirmation:
      items.length -
      confirmed,

    points,

    max,

    score: max
      ? Math.round(
          (points / max) *
            100
        )
      : 0,
  };
}
