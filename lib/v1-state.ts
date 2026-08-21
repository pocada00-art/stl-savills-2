export type V1Role = "ADMIN" | "GESTOR" | "LECTURA";

export type V1Status =
  | "APTO"
  | "APTO CONDICIONADO"
  | "NO APTO"
  | "PENDIENTE"
  | "SIN INFORMACIÓN";

export type Period = "S1" | "S2";

export type ItemReview = {
  status: V1Status;
  date: string;
  company: string;

  // Datos adicionales de la revisión
  equipmentId: string;
  observations: string;
  comment: string;
  secondReviewDate: string;

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

export type CenterOverride = {
  property?: string;

  address?: string;
  city?: string;
  province?: string;

  manager?: string;
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

export type V1Country = "España" | "Portugal";

export type V1State = {
  role: V1Role;
  country?: V1Country;
  centerId?: string;

  centers: Record<string, CenterOverride>;

  activeItems: Record<
    string,
    Record<string, boolean>
  >;

  reviews: Record<string, ReviewState>;
};

export const STORAGE_KEY = "stl-savills-v1-state";

export const CURRENT_YEAR = 2026;

export const CURRENT_PERIOD: Period = "S2";

export function blankItem(): ItemReview {
  return {
    status: "SIN INFORMACIÓN",
    date: "",
    company: "",

    equipmentId: "",
    observations: "",
    comment: "",
    secondReviewDate: "",

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

export function loadState(): V1State {
  if (typeof window === "undefined") {
    return {
      role: "ADMIN",
      country: undefined,
      centerId: undefined,
      centers: {},
      activeItems: {},
      reviews: {},
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}

  return {
    role: "ADMIN",
    country: undefined,
    centerId: undefined,
    centers: {},
    activeItems: {},
    reviews: {},
  };
}

export function saveState(state: V1State) {
  if (typeof window !== "undefined") {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );
  }
}

export function scoreForV1Status(status: V1Status) {
  return {
    "APTO": 3,
    "APTO CONDICIONADO": 2,
    "NO APTO": 1,
    "PENDIENTE": 0,
    "SIN INFORMACIÓN": 0,
  }[status];
}

export function reviewSummary(
  review: ReviewState | undefined,
  activeIds: string[]
) {
  const items = activeIds.map(
    id => review?.items[id] ?? blankItem()
  );

  const counts = {
    "APTO": items.filter(
      i => i.status === "APTO"
    ).length,

    "APTO CONDICIONADO": items.filter(
      i => i.status === "APTO CONDICIONADO"
    ).length,

    "NO APTO": items.filter(
      i => i.status === "NO APTO"
    ).length,

    "PENDIENTE": items.filter(
      i => i.status === "PENDIENTE"
    ).length,

    "SIN INFORMACIÓN": items.filter(
      i => i.status === "SIN INFORMACIÓN"
    ).length,
  };

  const confirmed = items.filter(
    i => i.confirmed
  ).length;

  const points = items.reduce(
    (sum, i) =>
      sum + scoreForV1Status(i.status),
    0
  );

  const max = activeIds.length * 3;

  return {
    counts,
    confirmed,
    total: items.length,
    pendingConfirmation:
      items.length - confirmed,
    points,
    max,
    score: max
      ? Math.round((points / max) * 100)
      : 0,
  };
}
