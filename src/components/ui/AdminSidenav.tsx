"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, Refrigerator, FlaskConical, Zap, ShoppingBag, LayoutGrid, Gift, MapPin, UserCheck, Clock, TrendingUp, Warehouse, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AdminManagerPanel } from "@/components/admin/AdminManagerPanel";
import { AdminProfilePopover } from "@/components/admin/AdminProfilePopover";
import { Plasma } from "@/components/ui/Plasma";
import { logoutCurrentUser, readAuthSession, subscribeAuthSession } from "@/lib/api/backend";

const NAV_GROUPS = [
  {
    label: "Analyse",
    items: [
      { label: "IPP Berechnung", icon: TrendingUp,      href: "/admin/ipp-berechnung", color: { bg: "linear-gradient(to bottom, #DC2626, #b91c1c)", ring: "#a91b1b", shadow: "rgba(180,20,20,0.14)" } },
    ],
  },
  {
    label: "Prämien",
    items: [
      { label: "Prämien", icon: Gift, href: "/admin/praemien", color: { bg: "linear-gradient(to bottom, #DC2626, #b91c1c)", ring: "#a91b1b", shadow: "rgba(180,20,20,0.14)" } },
    ],
  },
  {
    label: "Fragebögen",
    items: [
      { label: "Standardbesuch", icon: ClipboardList, href: "/admin/fragebogen", color: { bg: "linear-gradient(to bottom, #DC2626, #e84040)", ring: "#c42020", shadow: "rgba(180,20,20,0.14)" } },
      { label: "Flexbesuche", icon: Zap, href: "/admin/flexbesuche", color: { bg: "linear-gradient(to bottom, #84CC16, #65a30d)", ring: "#4d7c0f", shadow: "rgba(132,204,22,0.25)" } },
      { label: "Billa", icon: ShoppingBag, href: "/admin/billa", color: { bg: "linear-gradient(to bottom, #0891B2, #0e7490)", ring: "#155e75", shadow: "rgba(8,145,178,0.25)" } },
      { label: "Kühlerinventur", icon: Refrigerator, href: "/admin/kuehlerinventur", color: { bg: "linear-gradient(to bottom, #F59E0B, #D97706)", ring: "#B45309", shadow: "rgba(245,158,11,0.25)" } },
      { label: "MHD", icon: FlaskConical, href: "/admin/mhd", color: { bg: "linear-gradient(to bottom, #8b5cf6, #7C3AED)", ring: "#6d28d9", shadow: "rgba(124,58,237,0.25)" } },
      { label: "FB Management", icon: LayoutGrid, href: "/admin/fbmanagement", color: { bg: "linear-gradient(to bottom, #DC2626, #e84040)", ring: "#c42020", shadow: "rgba(180,20,20,0.14)" } },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Zeiterfassung", icon: Clock, href: "/admin/zeiterfassung", color: { bg: "linear-gradient(to bottom, #DC2626, #e84040)", ring: "#c42020", shadow: "rgba(180,20,20,0.14)" } },
      { label: "Märkte", icon: MapPin, href: "/admin/maerkte", color: { bg: "linear-gradient(to bottom, #DC2626, #e84040)", ring: "#c42020", shadow: "rgba(180,20,20,0.14)" } },
      { label: "Lager", icon: Warehouse, href: "/admin/lager", color: { bg: "linear-gradient(to bottom, #DC2626, #e84040)", ring: "#c42020", shadow: "rgba(180,20,20,0.14)" } },
      { label: "Gebietsmanager", icon: UserCheck, href: "/admin/gebietsmanager", color: { bg: "linear-gradient(to bottom, #DC2626, #e84040)", ring: "#c42020", shadow: "rgba(180,20,20,0.14)" } },
    ],
  },
];

const COLLAPSED_W = 56;
const EXPANDED_W = 200;

type SidebarOverlayState = "closed" | "profile" | "password" | "manager";

export function AdminSidenav() {
  const [hovered, setHovered] = useState(false);
  const [overlayState, setOverlayState] = useState<SidebarOverlayState>("closed");
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [authUser, setAuthUser] = useState(() => readAuthSession()?.user ?? null);
  const pathname = usePathname();
  const router = useRouter();
  const profileButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const syncAuthUser = () => {
      setAuthUser(readAuthSession()?.user ?? null);
    };
    syncAuthUser();
    return subscribeAuthSession(syncAuthUser);
  }, []);

  useEffect(() => {
    setOverlayState("closed");
  }, [pathname]);

  const refreshAnchorRect = useCallback(() => {
    if (!profileButtonRef.current) return;
    setAnchorRect(profileButtonRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (overlayState === "closed") return;
    refreshAnchorRect();
    const onWindowChange = () => refreshAnchorRect();
    window.addEventListener("resize", onWindowChange);
    window.addEventListener("scroll", onWindowChange, true);
    return () => {
      window.removeEventListener("resize", onWindowChange);
      window.removeEventListener("scroll", onWindowChange, true);
    };
  }, [overlayState, hovered, refreshAnchorRect]);

  const handleLogout = () => {
    logoutCurrentUser();
    setOverlayState("closed");
    if (typeof window !== "undefined") {
      window.location.assign("/");
      return;
    }
    router.replace("/");
    router.refresh();
  };
  const isSidebarExpanded = hovered || overlayState !== "closed";

  const displayName = useMemo(() => {
    const firstName = authUser?.firstName?.trim() ?? "";
    const lastName = authUser?.lastName?.trim() ?? "";
    const full = `${firstName} ${lastName}`.trim();
    return full.length > 0 ? full : "Admin";
  }, [authUser]);
  const displayInitials = useMemo(() => {
    const first = authUser?.firstName?.trim().charAt(0) ?? "";
    const last = authUser?.lastName?.trim().charAt(0) ?? "";
    const initials = `${first}${last}`.toUpperCase();
    return initials.length > 0 ? initials : "A";
  }, [authUser]);

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
    <>
      <nav
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: isSidebarExpanded ? EXPANDED_W : COLLAPSED_W,
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
        <button
          ref={profileButtonRef}
          type="button"
          onClick={() => {
            if (overlayState === "closed") {
              refreshAnchorRect();
              setOverlayState("profile");
              return;
            }
            setOverlayState("closed");
          }}
          style={{
            height: isSidebarExpanded ? 56 : 40,
            width: isSidebarExpanded ? "auto" : 40,
            margin: "0 8px 12px",
            alignSelf: isSidebarExpanded ? "auto" : "center",
            borderRadius: 12,
            backgroundColor: "rgba(0,0,0,0.04)",
            overflow: "hidden",
            position: "relative",
            flexShrink: 0,
            transition: "width 0.25s cubic-bezier(0.4,0,0.2,1), height 0.25s cubic-bezier(0.4,0,0.2,1)",
            border: overlayState === "closed" ? "1px solid transparent" : "1px solid rgba(220,38,38,0.32)",
            cursor: "pointer",
            outline: "none",
            padding: 0,
          }}
        >
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

          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: isSidebarExpanded ? "flex-start" : "center",
              paddingLeft: isSidebarExpanded ? 10 : 0,
              paddingRight: isSidebarExpanded ? 10 : 0,
              gap: isSidebarExpanded ? 8 : 0,
            }}
          >
            <div
              style={{
                width: isSidebarExpanded ? 26 : 20,
                height: isSidebarExpanded ? 26 : 20,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.5)",
                background: "rgba(255,255,255,0.22)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                flexShrink: 0,
                fontSize: isSidebarExpanded ? 11 : 9,
                fontWeight: 800,
                letterSpacing: "0.01em",
                textShadow: "0 1px 2px rgba(0,0,0,0.35)",
              }}
            >
              {displayInitials}
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                textShadow: "0 1px 3px rgba(0,0,0,0.6), 0 2px 12px rgba(0,0,0,0.5), 0 0 20px rgba(0,0,0,0.3)",
                opacity: isSidebarExpanded ? 1 : 0,
                width: isSidebarExpanded ? "auto" : 0,
                overflow: "hidden",
                transition: "opacity 0.2s ease, width 0.2s ease",
              }}
            >
              {displayName}
            </span>
          </div>
        </button>

        <div style={{ flex: 1, padding: "4px 8px" }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} style={{ marginBottom: gi < NAV_GROUPS.length - 1 ? 8 : 0 }}>
              {group.label && (
                <div
                  style={{
                    height: 22,
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: isSidebarExpanded ? 12 : 0,
                    justifyContent: isSidebarExpanded ? "flex-start" : "center",
                    marginBottom: 2,
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      color: "rgba(0,0,0,0.25)",
                      opacity: isSidebarExpanded ? 1 : 0,
                      transition: "opacity 0.2s ease",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {group.label}
                  </span>
                  {!isSidebarExpanded && <div style={{ width: 16, height: 1, backgroundColor: "rgba(0,0,0,0.1)" }} />}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOverlayState("closed")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      height: 34,
                      borderRadius: 10,
                      marginBottom: 2,
                      paddingLeft: isSidebarExpanded ? 12 : 0,
                      justifyContent: isSidebarExpanded ? "flex-start" : "center",
                      gap: isSidebarExpanded ? 10 : 0,
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
                      <Icon size={16} strokeWidth={isActive ? 2 : 1.6} />
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: isActive ? 600 : 500,
                        width: isSidebarExpanded ? "auto" : 0,
                        overflow: "hidden",
                        opacity: isSidebarExpanded ? 1 : 0,
                        transition: "opacity 0.2s ease, width 0.25s ease",
                      }}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
              {gi < NAV_GROUPS.length - 1 && (
                <div
                  style={{
                    height: 1,
                    margin: "6px 4px",
                    background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.05), transparent)",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            padding: "8px",
            borderTop: "1px solid rgba(0,0,0,0.06)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={handleLogout}
            style={{
              width: "100%",
              height: 34,
              borderRadius: 10,
              border: "none",
              background: "transparent",
              color: "rgba(185,28,28,0.85)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: isSidebarExpanded ? "flex-start" : "center",
              paddingLeft: isSidebarExpanded ? 12 : 0,
              gap: isSidebarExpanded ? 10 : 0,
              fontFamily: "inherit",
              transition: "all 0.2s ease",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(220,38,38,0.08)";
              e.currentTarget.style.color = "#b91c1c";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(185,28,28,0.85)";
            }}
          >
            <div style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <LogOut size={16} strokeWidth={1.9} />
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                width: isSidebarExpanded ? "auto" : 0,
                opacity: isSidebarExpanded ? 1 : 0,
                transition: "opacity 0.2s ease, width 0.25s ease",
              }}
            >
              Logout
            </span>
          </button>
        </div>
      </nav>

      <AdminProfilePopover
        open={overlayState === "profile" || overlayState === "password"}
        mode={overlayState === "password" ? "password" : "profile"}
        anchorRect={anchorRect}
        userId={authUser?.id ?? null}
        userName={displayName}
        userEmail={authUser?.email ?? ""}
        onClose={() => setOverlayState("closed")}
        onModeChange={(next) => setOverlayState(next)}
        onOpenManager={() => setOverlayState("manager")}
        onLogout={handleLogout}
      />
      <AdminManagerPanel
        open={overlayState === "manager"}
        anchorRect={anchorRect}
        currentUserId={authUser?.id ?? null}
        onClose={() => setOverlayState("closed")}
      />
    </>
  );
}
