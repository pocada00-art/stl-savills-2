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

export type V1Country =
  | "España"
  | "Portugal";

export type V1STL =
  | "STL_ES_2026_V1"
  | "STL_PT_2026_V1";

export type V1CenterStatus =
  | "Activo"
  | "Inactivo";

/**
 * Datos modificables de un centro.
 *
 * También se utiliza para almacenar centros nuevos.
 */
export type CenterOverride = {
  id?: string;

  name?: string;
  code?: string;
  shortCode?: string;

  country?: V1Country;
  address?: string;
  city?: string;
  province?: string;

  property?: string | null;

  stl?: V1STL;

  status?: V1CenterStatus;

  manager?: string | null;
  managerPhone?: string;
  managerEmail?: string;

  technicalResponsible?: string;
  technicalResponsiblePhone?: string;
  technicalResponsibleEmail?: string;

  imageUrl?: string;
  logoUrl?: string;
};

/**
 * Centro resuelto utilizado por las distintas vistas.
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
   * Centros modificados y centros creados.
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
 * RESOLVER UN CENTRO
 * ========================================================= */

/**
 * Resuelve un centro aplicando los datos guardados
 * en state.centers[id].
 *
 * Puede recibir:
 *
 * - un centro original de demo.centers
 * - un centro nuevo procedente de state.centers
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

  const resolved = {
    ...center,
    ...overrides,

    /*
     * El ID interno nunca cambia.
     */
    id: center.id,

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
        ? overrides.shortCode
        : center.shortCode,

    /*
     * Localización.
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
  };

  return resolved as T & ResolvedCenter;
}

/* =========================================================
 * RESOLVER TODOS LOS CENTROS
 * ========================================================= */

/**
 * Resuelve todos los centros disponibles.
 *
 * Incluye:
 *
 * 1. Centros originales de demo.centers.
 * 2. Centros modificados guardados en state.centers.
 * 3. Centros nuevos creados por el usuario y que no existen
 *    en demo.centers.
 *
 * Los centros se identifican siempre por su ID interno.
 */
export function resolveCenters<
  T extends Record<string, any>
>(
  centers: T[],
  state: V1State
): Array<T & ResolvedCenter> {
  /*
   * Mapa único por ID.
   *
   * Primero introducimos los centros originales.
   */
  const byId =
    new Map<string, T>();

  for (const center of centers) {
    if (
      center &&
      typeof center.id ===
        "string"
    ) {
      byId.set(
        center.id,
        center
      );
    }
  }

  /*
   * Incorporamos los centros persistidos.
   *
   * Si ya existe el centro en demo, NO creamos otro.
   *
   * Si no existe, significa que es un centro nuevo.
   */
  for (const [
    id,
    override,
  ] of Object.entries(
    state.centers || {}
  )) {
    if (
      byId.has(id)
    ) {
      continue;
    }

    /*
     * Centro nuevo.
     *
     * Aquí no podemos afirmar directamente que el objeto
     * tiene el tipo genérico T, porque T puede contener
     * campos adicionales.
     *
     * La conversión mediante unknown es intencionada:
     * posteriormente resolveCenter() añadirá los campos
     * necesarios de ResolvedCenter.
     */
    const persistedCenter =
      {
        id,

        name:
          override.name ??
          "",

        code:
          override.code ??
          "",

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
      } as unknown as T;

    byId.set(
      id,
      persistedCenter
    );
  }

  /*
   * Todos los centros pasan por el mismo resolver.
   */
  return Array.from(
    byId.values()
  ).map(
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
 */
export function reviewKey(
  centerId: string,
  year: number,
  period: Period
): string {
  return `${centerId}:${year}:${period}`;
}

/* =========================================================
 * ESTADO INICIAL
 * ========================================================= */

function getEmptyState(): V1State {
  return {
    role:
      "ADMIN",

    country:
      undefined,

    centerId:
      undefined,

    centers:
      {},

    activeItems:
      {},

    reviews:
      {},
  };
}

/* =========================================================
 * CARGAR ESTADO
 * ========================================================= */

/**
 * Carga el estado V1 desde localStorage.
 *
 * En servidor devuelve el estado inicial.
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

      /*
       * Normalizamos estructuras antiguas.
       */
      return {
        role:
          parsed.role ??
          "ADMIN",

        country:
          parsed.country,

        centerId:
          parsed.centerId,

        centers:
          parsed.centers ??
          {},

        activeItems:
          parsed.activeItems ??
          {},

        reviews:
          parsed.reviews ??
          {},
      };
    }
  } catch {
    /*
     * Si localStorage está corrupto,
     * utilizamos el estado inicial.
     */
  }

  return getEmptyState();
}

/* =========================================================
 * GUARDAR ESTADO
 * ========================================================= */

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
    APTO:
      3,

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
    activeIds.length *
    3;

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

    score:
      max
        ? Math.round(
            (points / max) *
              100
          )
        : 0,
  };
}
