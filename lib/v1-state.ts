/* =========================================================
 * TIPOS V1
 * ========================================================= */

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

/* =========================================================
 * REVISIONES
 * ========================================================= */

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

  items: Record<
    string,
    ItemReview
  >;

  participants: {
    name: string;
    role: string;
    signed: boolean;
  }[];
};

/* =========================================================
 * CENTROS
 * ========================================================= */

/**
 * Países disponibles para los centros.
 */
export type V1Country =
  | "España"
  | "Portugal";

/**
 * Versiones STL disponibles.
 */
export type V1STL =
  | "STL_ES_2026_V1"
  | "STL_PT_2026_V1";

/**
 * Estados disponibles para un centro.
 */
export type V1CenterStatus =
  | "Activo"
  | "Inactivo";

/**
 * Datos modificables de un centro.
 *
 * Estos campos representan únicamente los cambios
 * realizados por el usuario sobre los datos originales
 * de demo.centers.
 *
 * Los campos son opcionales porque state.centers[id]
 * solo almacena aquello que haya sido modificado.
 *
 * Se han eliminado expresamente:
 *
 * - framework
 * - contactName
 * - contactEmail
 * - contactPhone
 */
export type CenterOverride = {
  id?: string;

  /*
   * Identificación del centro.
   */
  name?: string;
  code?: string;
  shortCode?: string;

  /*
   * Ubicación y clasificación.
   */
  country?: V1Country;
  address?: string;
  city?: string;
  province?: string;

  /*
   * Propiedad.
   */
  property?: string | null;

  /*
   * Versión del STL.
   */
  stl?: V1STL;

  /*
   * Estado del centro.
   */
  status?: V1CenterStatus;

  /*
   * Responsable.
   */
  manager?: string | null;
  managerPhone?: string;
  managerEmail?: string;

  /*
   * Responsable técnico.
   */
  technicalResponsible?: string;
  technicalResponsiblePhone?: string;
  technicalResponsibleEmail?: string;

  /*
   * Recursos gráficos.
   */
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

  /*
   * Identificación.
   */
  name: string;
  code: string;
  shortCode?: string;

  /*
   * Ubicación y clasificación.
   */
  country: V1Country;
  address?: string;
  city?: string;
  province?: string;

  /*
   * Propiedad.
   */
  property?: string | null;

  /*
   * STL.
   */
  stl: V1STL;

  /*
   * Estado.
   */
  status: V1CenterStatus;

  /*
   * Responsable.
   */
  manager?: string | null;
  managerPhone?: string;
  managerEmail?: string;

  /*
   * Responsable técnico.
   */
  technicalResponsible?: string;
  technicalResponsiblePhone?: string;
  technicalResponsibleEmail?: string;

  /*
   * Recursos gráficos.
   */
  imageUrl?: string;
  logoUrl?: string;
};

/* =========================================================
 * ESTADO GLOBAL V1
 * ========================================================= */

export type V1State = {
  role: V1Role;

  country?: V1Country;

  centerId?: string;

  /**
   * Cambios realizados sobre los centros originales.
   *
   * La clave es siempre el ID interno del centro.
   */
  centers: Record<
    string,
    CenterOverride
  >;

  /**
   * Elementos activos por centro.
   *
   * centerId
   *   ->
   * equipmentId
   *   ->
   * activo / inactivo
   */
  activeItems: Record<
    string,
    Record<string, boolean>
  >;

  /**
   * Revisiones históricas.
   *
   * reviewKey(centerId, year, period)
   */
  reviews: Record<
    string,
    ReviewState
  >;
};

/* =========================================================
 * CONFIGURACIÓN
 * ========================================================= */

export const STORAGE_KEY =
  "stl-savills-v1-state";

export const CURRENT_YEAR =
  2026;

export const CURRENT_PERIOD: Period =
  "S2";

/* =========================================================
 * RESOLUCIÓN DE CENTROS
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
 * El número de centro NO se genera.
 * Se conserva el número oficial existente en los
 * datos originales salvo que el usuario lo modifique
 * explícitamente mediante un override.
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
     * Nombre del centro.
     */
    name:
      overrides.name !== undefined
        ? String(overrides.name)
        : String(center.name ?? ""),

    /*
     * Número oficial del centro.
     *
     * No se genera ningún número correlativo.
     */
    code:
      overrides.code !== undefined
        ? String(overrides.code)
        : String(center.code ?? ""),

    /*
     * Código / abreviatura.
     */
    shortCode:
      overrides.shortCode !== undefined
        ? String(overrides.shortCode)
        : center.shortCode,

    /*
     * País.
     *
     * Solo se contemplan los valores definidos
     * por V1Country.
     */
    country:
      overrides.country !== undefined
        ? overrides.country
        : (center.country as V1Country),

    /*
     * STL.
     *
     * Solo se contemplan las versiones definidas
     * por V1STL.
     */
    stl:
      overrides.stl !== undefined
        ? overrides.stl
        : (center.stl as V1STL),

    /*
     * Estado del centro.
     *
     * Solo se contemplan Activo e Inactivo.
     */
    status:
      overrides.status !== undefined
        ? overrides.status
        : (center.status as V1CenterStatus),
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
    (center) =>
      resolveCenter(
        center,
        state
      )
  );
}

/* =========================================================
 * REVISIONES
 * ========================================================= */

/**
 * Crea una revisión vacía.
 *
 * El estado inicial siempre es:
 *
 * SIN INFORMACIÓN
 */
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

/**
 * Genera la clave única de una revisión.
 *
 * Ejemplo:
 *
 * 123:2026:S2
 */
export function reviewKey(
  centerId: string,
  year: number,
  period: Period
): string {
  return `${centerId}:${year}:${period}`;
}

/* =========================================================
 * ESTADO
 * ========================================================= */

/**
 * Estado inicial de la aplicación.
 */
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

/**
 * Carga el estado V1 desde localStorage.
 *
 * En servidor devuelve siempre el estado vacío
 * para evitar acceder a window/localStorage durante
 * el renderizado de Next.js.
 */
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
  } catch {
    /*
     * Si localStorage contiene información
     * corrupta, utilizamos el estado inicial.
     */
  }

  return getEmptyState();
}

/**
 * Guarda el estado V1 en localStorage.
 */
export function saveState(
  state: V1State
): void {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(state)
  );
}

/* =========================================================
 * PUNTUACIÓN
 * ========================================================= */

/**
 * Convierte un estado V1 en puntuación.
 *
 * APTO                  = 3
 * APTO CONDICIONADO     = 2
 * NO APTO               = 1
 * PENDIENTE             = 0
 * SIN INFORMACIÓN       = 0
 */
export function scoreForV1Status(
  status: V1Status
): number {
  return {
    APTO: 3,

    "APTO CONDICIONADO":
      2,

    "NO APTO":
      1,

    PENDIENTE:
      0,

    "SIN INFORMACIÓN":
      0,
  }[status];
}

/* =========================================================
 * RESUMEN DE REVISIÓN
 * ========================================================= */

/**
 * Calcula el resumen de una revisión.
 *
 * activeIds contiene exclusivamente los elementos
 * actualmente activos del centro.
 */
export function reviewSummary(
  review:
    | ReviewState
    | undefined,
  activeIds: string[]
) {
  const items =
    activeIds.map(
      (id) =>
        review?.items?.[id] ??
        blankItem()
    );

  const counts = {
    APTO:
      items.filter(
        (item) =>
          item.status ===
          "APTO"
      ).length,

    "APTO CONDICIONADO":
      items.filter(
        (item) =>
          item.status ===
          "APTO CONDICIONADO"
      ).length,

    "NO APTO":
      items.filter(
        (item) =>
          item.status ===
          "NO APTO"
      ).length,

    PENDIENTE:
      items.filter(
        (item) =>
          item.status ===
          "PENDIENTE"
      ).length,

    "SIN INFORMACIÓN":
      items.filter(
        (item) =>
          item.status ===
          "SIN INFORMACIÓN"
      ).length,
  };

  const confirmed =
    items.filter(
      (item) =>
        item.confirmed
    ).length;

  const points =
    items.reduce(
      (sum, item) =>
        sum +
        scoreForV1Status(
          item.status
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
