import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Courrier - Claire Bernard - Outlook",
  description: "Démo Solen : détection des fraudes au virement dans la boîte mail",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
