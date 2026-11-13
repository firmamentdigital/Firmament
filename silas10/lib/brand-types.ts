export type EventBrand = {
  id: string; category: "organizer" | "supporter"; label: string;
  imageUrl: string; sortOrder: number; active: boolean; version: number;
};
export const DEFAULT_BRANDS: EventBrand[] = [
  { id: "default-silas", category: "organizer", label: "Silas 10", imageUrl: "/assets/silas-signature.png", sortOrder: 0, active: true, version: 0 },
  { id: "default-cod", category: "organizer", label: "COD — Centro de Orientação Desportiva SPFC", imageUrl: "/assets/cod-logo.png", sortOrder: 10, active: true, version: 0 },
  { id: "default-athletics", category: "organizer", label: "Escola de Atletismo SPFC", imageUrl: "/assets/escola-atletismo-spfc.png", sortOrder: 20, active: true, version: 0 },
  { id: "default-bookfair", category: "supporter", label: "BookFair", imageUrl: "/assets/bookfair-logo.png", sortOrder: 30, active: true, version: 0 },
  { id: "default-wmorente", category: "supporter", label: "WMorente", imageUrl: "/assets/wmorente-logo.png", sortOrder: 40, active: true, version: 0 },
  { id: "default-firmament", category: "supporter", label: "Firmament", imageUrl: "/assets/firmament-logo.png", sortOrder: 50, active: true, version: 0 },
];
