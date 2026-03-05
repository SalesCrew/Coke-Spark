"use client";

import { useState } from "react";
import { ClipboardList, Users, BarChart3, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Fragebogen", icon: ClipboardList, href: "/admin/fragebogen" },
  { label: "Mitarbeiter", icon: Users, href: "/admin/mitarbeiter" },
  { label: "Statistiken", icon: BarChart3, href: "/admin/statistiken" },
  { label: "Einstellungen", icon: Settings, href: "/admin/einstellungen" },
];

const COLLAPSED_W = 56;
const EXPANDED_W = 200;

export function AdminSidenav() {
  const [hovered, setHovered] = useState(false);
  const pathname = usePathname();

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
        paddingTop: 20,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: 28,
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          paddingLeft: (COLLAPSED_W - 28) / 2,
          gap: 10,
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "linear-gradient(to bottom, #DC2626, #e84040)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow:
              "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #c42020, 0 1px 6px rgba(180,20,20,0.14)",
          }}
        >
          <span
            style={{
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            CS
          </span>
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#1a1a1a",
            opacity: hovered ? 1 : 0,
            transition: "opacity 0.2s ease",
            letterSpacing: "-0.01em",
          }}
        >
          Coke Spark
        </span>
      </div>

      <div
        style={{
          height: 1,
          margin: "0 12px 8px",
          background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.06), transparent)",
        }}
      />

      {/* Nav items */}
      <div style={{ flex: 1, padding: "4px 8px" }}>
        {NAV_ITEMS.map((item) => {
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
                background: isActive
                  ? "linear-gradient(to bottom, #DC2626, #e84040)"
                  : "transparent",
                boxShadow: isActive
                  ? "inset 0 1px 0.6px rgba(255,255,255,0.33), inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 0 1px #c42020, 0 1px 6px rgba(180,20,20,0.14)"
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
              <div
                style={{
                  width: 16,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon
                  size={16}
                  strokeWidth={isActive ? 2 : 1.6}
                />
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 500,
                  width: hovered ? "auto" : 0,
                  overflow: "hidden",
                  opacity: hovered ? 1 : 0,
                  transition: "opacity 0.2s ease, width 0.25s ease",
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
