import type { Viewport } from "next";
import LoginPage from "@/components/LoginPage";

// Extend only the login route into iPhone safe areas, not the dashboards.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#e51b25",
};

export default function Home() {
  return <LoginPage />;
}
