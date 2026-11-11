import RegistrationExperience from "./registration-experience";
import { listBrands } from "@/lib/brands";
export const dynamic = "force-dynamic";
export default async function Home() {
  return <RegistrationExperience brands={await listBrands()} />;
}
