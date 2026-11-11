export type EventBrand = {
  id: string; category: "organizer" | "supporter"; label: string;
  imageUrl: string; sortOrder: number; active: boolean; version: number;
};
export const DEFAULT_BRANDS: EventBrand[] = [
  { id: "default-cod", category: "organizer", label: "COD — Centro de Orientação Desportiva SPFC", imageUrl: "/assets/cod-logo.png", sortOrder: 10, active: true, version: 0 },
  { id: "default-athletics", category: "organizer", label: "Escola de Atletismo SPFC", imageUrl: "/assets/escola-atletismo-spfc.png", sortOrder: 20, active: true, version: 0 },
];
