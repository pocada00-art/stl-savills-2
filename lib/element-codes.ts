export type ElementCodeItem = {
  id?: string;
  country?: string;
  category?: string | null;
  installation?: string | null;
  action?: string | null;
  baseCode?: string | null;
  actionCode?: string | null;
  code?: string | null;
};

function normalizeLabel(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const ES_CATEGORY_NUMBERS: Record<string, number> = {
  "aparatos elevadores": 1,
  electricidad: 2,
  pararrayos: 3,
  pci: 4,
  "legionella y potabilidad": 5,
  fontaneria: 6,
  climatizacion: 7,
  gas: 8,
  "g. electrogeno": 9,
  sais: 10,
  "l. vida y anclajes": 11,
  bms: 12,
  "puertas aut.": 13,
  ite: 14,
  "inst. petroliferas": 15,
  "carg. electricos": 16,
  megafonia: 17,
  "z. infantiles": 18,
  "inst. fotovoltaica": 19,
  cctv: 20,
  ddd: 21,
  "cert. eficiencia energ.": 30,
  simulacro: 40,
  "eval. de riesgos": 50,
  cae: 60,
  pau: 100,
};

// Portugal: numeración basada en las descripciones/categorías reales
// del catálogo portugués, en su orden jerárquico.
const PT_CATEGORY_NUMBERS: Record<string, number> = {
  "aparatos elevadores": 1,
  electricidad: 2,
  pararrayos: 3,
  pci: 4,
  "legionella y potabilidad": 5,
  fontaneria: 6,
  climatizacion: 7,
  gas: 8,
  "g. electrogeno": 9,
  sais: 10,
  "l. vida y anclajes": 11,
  bms: 12,
  "puertas aut.": 13,
  ite: 14,
  "inst. petroliferas": 15,
  "carg. electricos": 16,
  megafonia: 17,
  "z. infantiles": 18,
  "inst. fotovoltaica": 19,
  cctv: 20,
  ddd: 21,
  "cert. eficiencia energ.": 22,
  simulacro: 23,
  "eval. de riesgos": 24,
  cae: 25,
  pau: 26,
  "calidad aire": 27,
  "medio ambiente": 28,
  licencias: 29,
  seguridad: 30,
  prl: 31,
  "control lojistas": 32,
};

function getCategoryNumber(
  item: ElementCodeItem,
  catalog: ElementCodeItem[],
): number {
  const country = normalizeLabel(item.country);
  const category = normalizeLabel(item.category);
  const configured = country === "portugal"
    ? PT_CATEGORY_NUMBERS[category]
    : ES_CATEGORY_NUMBERS[category];

  if (configured !== undefined) return configured;

  const seen = new Set<string>();
  for (const catalogItem of catalog) {
    const catalogCategory = normalizeLabel(catalogItem.category);
    if (!catalogCategory || seen.has(catalogCategory)) continue;
    seen.add(catalogCategory);
    if (catalogCategory === category) return seen.size;
  }

  return 0;
}

function hierarchyKey(
  category: unknown,
  installation: unknown,
  action: unknown,
): string {
  return [category, installation, action].map(normalizeLabel).join("|");
}

/**
 * Genera la codificación jerárquica del catálogo:
 * 1º dígito = Descripción/categoría
 * 2º dígito = Instalación
 * 3º dígito = Actuación
 */
export function buildElementCodes<T extends ElementCodeItem>(catalog: T[]) {
  const installationNumbers = new Map<string, number>();
  const actionNumbers = new Map<string, number>();

  return catalog.map(item => {
    const categoryNumber = getCategoryNumber(item, catalog);
    const categoryKey = `${normalizeLabel(item.country)}|${normalizeLabel(item.category)}`;
    const installationKey = `${categoryKey}|${normalizeLabel(item.installation)}`;

    if (!installationNumbers.has(installationKey)) {
      const installationOrdinal = countKeysWithPrefix(
        installationNumbers,
        `${categoryKey}|`,
      ) + 1;
      installationNumbers.set(installationKey, installationOrdinal);
    }

    const installationOrdinal = installationNumbers.get(installationKey) || 1;
    const baseCode = `${categoryNumber}.${installationOrdinal}`;

    const actionKey = `${installationKey}|${normalizeLabel(item.action)}`;
    if (!actionNumbers.has(actionKey)) {
      const actionOrdinal = countKeysWithPrefix(actionNumbers, `${installationKey}|`) + 1;
      actionNumbers.set(actionKey, actionOrdinal);
    }

    const actionOrdinal = actionNumbers.get(actionKey) || 1;
    const actionCode = `${baseCode}.${actionOrdinal}`;

    return {
      ...item,
      baseCode,
      actionCode,
    };
  });
}

function countKeysWithPrefix(map: Map<string, number>, prefix: string): number {
  return Array.from(map.keys()).filter(key => key.startsWith(prefix)).length;
}

/**
 * Añade el cuarto dígito únicamente cuando existen varias unidades
 * de la misma combinación Descripción + Instalación + Actuación.
 */
export function addDisplayCodes<T extends ElementCodeItem>(
  items: T[],
  catalog: ElementCodeItem[],
) {
  const catalogWithCodes = buildElementCodes(catalog);
  const byId = new Map(
    catalogWithCodes
      .filter(item => item.id)
      .map(item => [String(item.id), item]),
  );
  const byHierarchy = new Map(
    catalogWithCodes.map(item => [
      hierarchyKey(item.category, item.installation, item.action),
      item,
    ]),
  );

  const resolved = items.map(item => {
    const catalogItem = item.id
      ? byId.get(String(item.id))
      : undefined;
    const hierarchyItem = byHierarchy.get(
      hierarchyKey(item.category, item.installation, item.action),
    );
    const source = catalogItem || hierarchyItem;

    const baseCode = String(
      source?.baseCode ?? item.baseCode ?? item.code ?? "",
    ).trim();
    const actionCode = String(
      source?.actionCode ?? item.actionCode ?? "",
    ).trim();

    return {
      ...item,
      baseCode,
      actionCode,
    };
  });

  const counts = new Map<string, number>();
  resolved.forEach(item => {
    if (!item.actionCode) return;
    counts.set(item.actionCode, (counts.get(item.actionCode) || 0) + 1);
  });

  const ordinals = new Map<string, number>();

  return resolved.map(item => {
    const actionCode = item.actionCode;
    if (!actionCode) {
      return { ...item, displayCode: String(item.code ?? "") };
    }

    const ordinal = (ordinals.get(actionCode) || 0) + 1;
    ordinals.set(actionCode, ordinal);

    return {
      ...item,
      displayCode: counts.get(actionCode)! > 1
        ? `${actionCode}.${ordinal}`
        : actionCode,
    };
  });
}
