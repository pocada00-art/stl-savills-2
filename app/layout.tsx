import "./globals.css";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "STL SAVILLS",
  description: "Gestor web de inspecciones legales para centros comerciales",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body><AppShell>{children}</AppShell></body></html>;
}
