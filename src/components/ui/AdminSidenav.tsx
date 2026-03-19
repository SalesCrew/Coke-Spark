"use client";

import { useState } from "react";
import { ClipboardList, Users, BarChart3, Settings, Refrigerator, FlaskConical, Zap, ShoppingBag, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plasma } from "@/components/ui/Plasma";

const NAV_GROUPS = [
  {
    label: "Fragebögen",
    items: [
      { label: "Standartbesuch", icon: ClipboardList, href: "/admin/fragebogen", color: { bg: "linear-gradient(to bottom, #DC2626, #e84040)", ring: "#c42020", shadow: "rgba(180,20,20,0.14)" } },
      { label: "Flexbesuche", icon: Zap, href: "/admin/flexbesuche", color: { bg: "linear-gradient(to bottom, #84CC16, #65a30d)", ring: "#4d7c0f", shadow: "rgba(132,204,22,0.25)" } },
      { label: "Billa", icon: ShoppingBag, href: "/admin/billa", color: { bg: "linear-gradient(to bottom, #0891B2, #0e7490)", ring: "#155e75", shadow: "rgba(8,145,178,0.25)" } },
      { label: "Kühlerinventur", icon: Refrigerator, href: "/admin/kuehlerinventur", color: { bg: "linear-gradient(to bottom, #F59E0B, #D97706)", ring: "#B45309", shadow: "rgba(245,158,11,0.25)" } },
      { label: "MHD", icon: FlaskConical, href: "/admin/mhd", color: { bg: "linear-gradient(to bottom, #8b5cf6, #7C3AED)", ring: "#6d28d9", shadow: "rgba(124,58,237,0.25)" } },
      { label: "FB Management", icon: LayoutGrid, href: "/admin/fbmanagement", color: { bg: "linear-gradient(to bottom, #DC2626, #e84040)", ring: "#c42020", shadow: "rgba(180,20,20,0.14)" } },
    ],
  },
  {
    label: null,
    items: [
      { label: "Mitarbeiter", icon: Users, href: "/admin/mitarbeiter", color: { bg: "linear-gradient(to bottom, #DC2626, #e84040)", ring: "#c42020", shadow: "rgba(180,20,20,0.14)" } },
      { label: "Statistiken", icon: BarChart3, href: "/admin/statistiken", color: { bg: "linear-gradient(to bottom, #DC2626, #e84040)", ring: "#c42020", shadow: "rgba(180,20,20,0.14)" } },
      { label: "Einstellungen", icon: Settings, href: "/admin/einstellungen", color: { bg: "linear-gradient(to bottom, #DC2626, #e84040)", ring: "#c42020", shadow: "rgba(180,20,20,0.14)" } },
    ],
  },
];

const COLLAPSED_W = 56;
const EXPANDED_W = 200;

export function AdminSidenav() {
  const [hovered, setHovered] = useState(false);
  const pathname = usePathname();

  const plasmaColor = pathname.startsWith("/admin/kuehlerinventur")
    ? "#D97706"
    : pathname.startsWith("/admin/mhd")
    ? "#7C3AED"
    : pathname.startsWith("/admin/flexbesuche")
    ? "#84CC16"
    : pathname.startsWith("/admin/billa")
    ? "#0891B2"
    : "#DC2626";

  return (
    <nav
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: hovered ? EXPANDED_W : COLLAPSED_W,
        minHeight: "100vh",
        backgroundColor: "#ffffff",
        borderRight: "1px solid rgba(0,0,0,0.06)",
        transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
        display: "flex",
        flexDirection: "column",
        paddingTop: 12,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Logo / Plasma header */}
      <div
        style={{
          height: hovered ? 56 : 40,
          width: hovered ? "auto" : 40,
          margin: "0 8px 12px",
          alignSelf: hovered ? "auto" : "center",
          borderRadius: 12,
          backgroundColor: "rgba(0,0,0,0.04)",
          overflow: "hidden",
          position: "relative",
          flexShrink: 0,
          transition: "width 0.25s cubic-bezier(0.4,0,0.2,1), height 0.25s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Plasma effect */}
        <div style={{ position: "absolute", inset: 0 }}>
          <Plasma
            color={plasmaColor}
            speed={0.6}
            direction="forward"
            scale={1.1}
            opacity={0.75}
            mouseInteractive={true}
            tintStrength={0.93}
          />
        </div>

        {/* Label centered */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: hovered ? 14 : 11,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
              textShadow: "0 1px 3px rgba(0,0,0,0.6), 0 2px 12px rgba(0,0,0,0.5), 0 0 20px rgba(0,0,0,0.3)",
              transition: "font-size 0.2s ease",
            }}
          >
            {hovered ? "Kilian S." : "K.S."}
          </span>
        </div>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, padding: "4px 8px" }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} style={{ marginBottom: gi < NAV_GROUPS.length - 1 ? 8 : 0 }}>
            {group.label && (
              <div style={{
                height: 22,
                display: "flex",
                alignItems: "center",
                paddingLeft: hovered ? 12 : 0,
                justifyContent: hovered ? "flex-start" : "center",
                marginBottom: 2,
                overflow: "hidden",
              }}>
                <span style={{
                  fontSize: 9,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "rgba(0,0,0,0.25)",
                  opacity: hovered ? 1 : 0,
                  transition: "opacity 0.2s ease",
                  whiteSpace: "nowrap",
                }}>
                  {group.label}
                </span>
                {!hovered && (
                  <div style={{ width: 16, height: 1, backgroundColor: "rgba(0,0,0,0.1)" }} />
                )}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: 34,
                    borderRadius: 10,
                    marginBottom: 2,
                    paddingLeft: hovered ? 12 : 0,
                    justifyContent: hovered ? "flex-start" : "center",
                    gap: hovered ? 10 : 0,
                    background: isActive ? item.color.bg : "transparent",
                    boxShadow: isActive
                      ? `inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px ${item.color.ring}, 0 1px 6px ${item.color.shadow}`
                      : undefined,
                    color: isActive ? "#ffffff" : "rgba(0,0,0,0.35)",
                    textDecoration: "none",
                    transition: "all 0.2s ease",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <div style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={16} strokeWidth={isActive ? 2 : 1.6} />
                  </div>
                  <span style={{
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 500,
                    width: hovered ? "auto" : 0,
                    overflow: "hidden",
                    opacity: hovered ? 1 : 0,
                    transition: "opacity 0.2s ease, width 0.25s ease",
                  }}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
            {gi < NAV_GROUPS.length - 1 && (
              <div style={{ height: 1, margin: "6px 4px", background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.05), transparent)" }} />
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}
