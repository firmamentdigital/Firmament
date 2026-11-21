import type { Metadata } from "next";
import "./globals.css";
import "./registration.css";
import "./operations.css";
import "./child-flow.css";
import "./refinements.css";
import "./management.css";
import "./raffle.css";

export const metadata: Metadata = {
  title: "Silas 10 · Reserve sua vaga",
  description: "Como realizar seu sonho. Inscreva sua família no encontro com Silas, dia 21 de novembro, das 9h às 11h, no SPFC.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
