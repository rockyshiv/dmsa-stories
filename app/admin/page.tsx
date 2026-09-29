import type { Metadata, Viewport } from "next";
import AdminApp from "@/components/AdminApp";

// Shiva's private dashboard. Installable as an app ("Add to Home screen").
export const metadata: Metadata = {
  title: "DMSA Player Stories",
  description: "Send interview links, follow players' progress and create impact stories.",
  robots: { index: false, follow: false },
  manifest: "/dmsa-stories/admin.webmanifest",
  icons: { icon: "/dmsa-stories/admin-icons/icon-192.png", apple: "/dmsa-stories/admin-icons/icon-192.png" },
  appleWebApp: { capable: true, title: "DMSA Stories", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#081733" };

export default function AdminPage() {
  return <AdminApp />;
}
