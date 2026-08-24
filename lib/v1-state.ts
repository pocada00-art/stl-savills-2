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

  equipmentId: string;
  observations: string;
  comment: string;
  secondReviewDate: string;

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
 * Países disponibles.
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
 * Para los centros existentes en demo.centers:
 *
 *   state.centers[id]
 *
 * contiene únicamente los cambios realizados.
 *
 * Para los centros creados desde la aplicación:
 *
 *   state.centers[id]
 *
 * contiene todos los datos necesarios para reconstruir
 * el centro aunque este no exista en demo.centers.
 */
export type CenterOverride = {
  id?: string;

  /*
   * Identificación.
   */
  name?: string;
  code?: string;
  shortCode?: string;

  /*
   * Ubicación.
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
   * STL.
   */
  stl?: V1STL;

  /*
   * Estado.
   */
  status?: V1CenterStatus;

  /*
   * Responsable de gestión.
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
 *   datos originales
 *   +
 *   datos persistidos
 *
 * Puede representar tanto:
 *
 * 1. un centro original de demo.centers
 * 2. un centro creado desde la aplicación
 */
export type ResolvedCenter = {
  id: string;

  name: string;
  code: string;
  shortCode?: string;

  country: V1Country;
  address?: string;
  city?: string;
  province?: string;

  property?: string | null;

  stl: V1STL;

  status: V1CenterStatus;

  manager?: string | null;
  managerPhone?: string;
  managerEmail?: string;

  technicalResponsible?: string;
  technicalResponsiblePhone?: string;
  technicalResponsibleEmail?: string;

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
   * Centros modificados o creados.
   *
   * La clave es siempre el ID interno.
   */
  centers: Record<
    string,
    CenterOverride
  >;

  /**
   * Elementos activos por centro.
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
 * Obtiene el override persistido de un centro.
 */
function getCenterOverride(
  centerId: string,
  state: V1State
): CenterOverride {
  return (
    state.centers?.[centerId] ||
    {}
  );
}

/**
 * Determina si un objeto de centro contiene los datos
 * mínimos necesarios para ser considerado un centro
 * válido.
 *
 * Esta función se utiliza principalmente para reconstruir
 * centros creados desde la aplicación que no existen en
 * demo.centers.
 */
function isPersistedCenter(
  override: CenterOverride
): boolean {
  return Boolean(
    override.id &&
    override.name &&
    override.code &&
    override.country &&
    override.stl &&
    override.status
  );
}

/**
 * Resuelve un centro aplicando los cambios guardados
 * en state.centers[id].
 *
 * IMPORTANTE:
 *
 * Esta función funciona tanto con:
 *
 * - centros originales de demo.centers
 * - centros creados dinámicamente
 *
 * Para un centro nuevo, el objeto "center" puede contener
 * únicamente el ID y los datos persistidos se utilizarán
 * como fuente principal.
 */
export function resolveCenter<
  T extends Record<string, any>
>(
  center: T,
  state: V1State
): T & ResolvedCenter {
  const centerId =
    String(center.id ?? "");

  const overrides =
    getCenterOverride(
      centerId,
      state
    );

  return {
    ...center,
    ...overrides,

    /*
     * El ID interno siempre pertenece al centro original
     * o al centro persistido.
     */
    id:
      centerId ||
      String(overrides.id ?? ""),

    /*
     * Identificación.
     */
    name:
      overrides.name !== undefined
        ? String(overrides.name)
        : String(center.name ?? ""),

    code:
      overrides.code !== undefined
        ? String(overrides.code)
        : String(center.code ?? ""),

    shortCode:
      overrides.shortCode !== undefined
        ? String(overrides.shortCode)
        : center.shortCode,

    /*
     * Ubicación.
     */
    country:
      overrides.country !== undefined
        ? overrides.country
        : (center.country as V1Country),

    address:
      overrides.address !== undefined
        ? overrides.address
        : center.address,

    city:
      overrides.city !== undefined
        ? overrides.city
        : center.city,

    province:
      overrides.province !== undefined
        ? overrides.province
        : center.province,

    /*
     * Propiedad.
     */
    property:
      overrides.property !== undefined
        ? overrides.property
        : center.property,

    /*
     * STL.
     */
    stl:
      overrides.stl !== undefined
        ? overrides.stl
        : (center.stl as V1STL),

    /*
     * Estado.
     */
    status:
      overrides.status !== undefined
        ? overrides.status
        : (center.status as V1CenterStatus),

    /*
     * Responsable.
     */
    manager:
      overrides.manager !== undefined
        ? overrides.manager
        : center.manager,

    managerPhone:
      overrides.managerPhone !== undefined
        ? overrides.managerPhone
        : center.managerPhone,

    managerEmail:
      overrides.managerEmail !== undefined
        ? overrides.managerEmail
        : center.managerEmail,

    /*
     * Responsable técnico.
     */
    technicalResponsible:
      overrides.technicalResponsible !== undefined
        ? overrides.technicalResponsible
        : center.technicalResponsible,

    technicalResponsiblePhone:
      overrides.technicalResponsiblePhone !== undefined
        ? overrides.technicalResponsiblePhone
        : center.technicalResponsiblePhone,

    technicalResponsibleEmail:
      overrides.technicalResponsibleEmail !== undefined
        ? overrides.technicalResponsibleEmail
        : center.technicalResponsibleEmail,

    /*
     * Recursos gráficos.
     */
    imageUrl:
      overrides.imageUrl !== undefined
        ? overrides.imageUrl
        : center.imageUrl,

    logoUrl:
      overrides.logoUrl !== undefined
        ? overrides.logoUrl
        : center.logoUrl,
  } as T & ResolvedCenter;
}

/* =========================================================
 * RESOLVER TODOS LOS CENTROS
 * ========================================================= */

/**
 * Resuelve todos los centros de la aplicación.
 *
 * IMPORTANTE:
 *
 * Hasta ahora esta función únicamente resolvía los centros
 * que recibía en el parámetro "centers".
 *
 * Eso provocaba que los centros nuevos no apareciesen en
 * otras pantallas porque únicamente existían en:
 *
 *   state.centers
 *
 * y no en:
 *
 *   demo.centers
 *
 * A partir de ahora:
 *
 *   resolveCenters(demo.centers, state)
 *
 * devuelve:
 *
 *   centros originales
 *   +
 *   centros modificados
 *   +
 *   centros nuevos
 *
 * Los centros nuevos se detectan porque existen en
 * state.centers pero no en el listado original.
 */
export function resolveCenters<
  T extends Record<string, any>
>(
  centers: T[],
  state: V1State
): Array<T & ResolvedCenter> {
  /*
   * -------------------------------------------------------
   * 1. Resolver los centros originales.
   * -------------------------------------------------------
   */
  const resolved =
    centers.map(
      (center) =>
        resolveCenter(
          center,
          state
        )
    );

  /*
   * -------------------------------------------------------
   * 2. Crear un índice de IDs ya existentes.
   * -------------------------------------------------------
   */
  const existingIds =
    new Set(
      resolved.map(
        (center) =>
          String(center.id)
      )
    );

  /*
   * -------------------------------------------------------
   * 3. Añadir centros creados desde la aplicación.
   *
   * Estos centros existen únicamente en state.centers.
   * -------------------------------------------------------
   */
  const persistedCenters =
    Object.entries(
      state.centers || {}
    )
      .filter(
        ([id, override]) =>
          !existingIds.has(id) &&
          isPersistedCenter(
            override
          )
      )
      .map(
        ([id, override]) => {
          /*
           * Creamos un centro base mínimo.
           *
           * Todos los datos reales proceden del override
           * persistido.
           */
          const persistedCenter = {
            id,

            name:
              override.name ?? "",

            code:
              override.code ?? "",

            shortCode:
              override.shortCode,

            country:
              override.country,

            address:
              override.address,

            city:
              override.city,

            province:
              override.province,

            property:
              override.property,

            stl:
              override.stl,

            status:
              override.status,

            manager:
              override.manager,

            managerPhone:
              override.managerPhone,

            managerEmail:
              override.managerEmail,

            technicalResponsible:
              override.technicalResponsible,

            technicalResponsiblePhone:
              override.technicalResponsiblePhone,

            technicalResponsibleEmail:
              override.technicalResponsibleEmail,

            imageUrl:
              override.imageUrl,

            logoUrl:
              override.logoUrl,
          };

          return resolveCenter(
            persistedCenter,
            state
          );
        }
      );

  /*
   * -------------------------------------------------------
   * 4. Resultado final.
   *
   * Primero los centros originales y después los nuevos.
   * -------------------------------------------------------
   */
  return [
    ...resolved,
    ...persistedCenters,
  ];
}

/**
 * Devuelve un único centro por ID.
 *
 * Esta función permite a cualquier pantalla obtener un
 * centro independientemente de si:
 *
 * - pertenece a demo.centers
 * - ha sido creado desde la aplicación
 * - ha sido modificado mediante overrides
 *
 * "centers" debe ser el listado base de centros de la
 * aplicación, normalmente demo.centers.
 */
export function resolveCenterById<
  T extends Record<string, any>
>(
  centers: T[],
  centerId: string,
  state: V1State
): (T & ResolvedCenter) | undefined {
  const all =
    resolveCenters(
      centers,
      state
    );

  return all.find(
    (center) =>
      String(center.id) ===
      String(centerId)
  );
}

/* =========================================================
 * REVISIONES
 * ========================================================= */

/**
 * Crea una revisión vacía.
 *
 * Estado inicial:
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
 * Normaliza un estado antiguo.
 *
 * Sirve para evitar errores si localStorage contiene una
 * versión anterior en la que alguno de los nuevos objetos
 * todavía no existía.
 */
function normalizeState(
  value: Partial<V1State>
): V1State {
  return {
    role:
      value.role ??
      "ADMIN",

    country:
      value.country,

    centerId:
      value.centerId,

    centers:
      value.centers ??
      {},

    activeItems:
      value.activeItems ??
      {},

    reviews:
      value.reviews ??
      {},
  };
}

/**
 * Carga el estado V1 desde localStorage.
 *
 * En servidor devuelve siempre el estado vacío.
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
      const parsed =
        JSON.parse(
          raw
        ) as Partial<V1State>;

      return normalizeState(
        parsed
      );
    }
  } catch {
    /*
     * Si localStorage está corrupto,
     * utilizamos el estado inicial.
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
    JSON.stringify(
      normalizeState(state)
    )
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
