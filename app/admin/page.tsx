import type { Metadata, Viewport } from "next";
import AdminApp from "@/components/AdminApp";

// The organisation's private dashboard. Installable as an app ("Add to Home screen").
export const metadata: Metadata = {
  title: "Myithri",
  description: "Voice feedback, impact stories and reports for your organisation, by Auraclusive.",
  robots: { index: false, follow: false },
  manifest: "/admin.webmanifest",
  icons: { icon: "/admin-icons/icon-192.png", apple: "/admin-icons/icon-192.png" },
  appleWebApp: { capable: true, title: "Myithri", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0B1F44" };

export default function AdminPage() {
  return <AdminApp />;
}
