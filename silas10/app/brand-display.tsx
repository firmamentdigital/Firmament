import type { EventBrand } from "@/lib/brand-types";
export default function BrandDisplay({ brands, compact = false }: { brands: EventBrand[]; compact?: boolean }) {
  const active = brands.filter(brand => brand.active);
  if (!active.length) return null;
  return <div className={"event-brands" + (compact ? " compact-brands" : "")}>
    {(["organizer", "supporter"] as const).map(category => {
      const group = active.filter(brand => brand.category === category);
      return group.length ? <section className="brand-group" key={category} aria-label={category === "organizer" ? "Realizadores do evento" : "Apoiadores do evento"}>
        <h4>{category === "organizer" ? "Realização" : "Apoio"}</h4>
        <div className="brand-logos">{group.map(brand => <img key={brand.id} src={brand.imageUrl} alt={brand.label} loading="eager" decoding="async" />)}</div>
      </section> : null;
    })}
  </div>;
}
