import raw from "@/data/demo-data.json";
export const demo = raw;
export type DemoCenter = typeof raw.centers[number];
export type CatalogItem = typeof raw.esCatalog[number];
export const allCatalog = [...raw.esCatalog, ...raw.ptCatalog];
