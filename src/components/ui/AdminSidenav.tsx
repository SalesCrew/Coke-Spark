"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogOut, MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AdminManagerPanel } from "@/components/admin/AdminManagerPanel";
import { AdminKurtiPanel } from "@/components/admin/AdminKurtiPanel";
import { AdminProfilePopover } from "@/components/admin/AdminProfilePopover";
import { CustomerAccessPanel } from "@/components/admin/CustomerAccessPanel";
import { ADMIN_NAV_GROUPS } from "@/components/ui/adminNavigation";
import { Plasma } from "@/components/ui/Plasma";
import { useAdminAccess } from "@/context/AdminAccessContext";
import { logoutCurrentUser, readAuthSession, subscribeAuthSession } from "@/lib/api/backend";

const COLLAPSED_W = 56;
const EXPANDED_W = 200;

type SidebarOverlayState = "closed" | "profile" | "password" | "manager" | "customerAccess";

export function AdminSidenav() {
  const [hovered, setHovered] = useState(false);
  const [overlayState, setOverlayState] = useState<SidebarOverlayState>("closed");
  const [kurtiOpen, setKurtiOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [authUser, setAuthUser] = useState(() => readAuthSession()?.user ?? null);
  const pathname = usePathname();
  const router = useRouter();
  const profileButtonRef = useRef<HTMLButtonElement | null>(null);
  const adminAccess = useAdminAccess();

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
    const onResize = () => refreshAnchorRect();
    const onWindowScroll = (event: Event) => {
      if (event.target === document || event.target === window || event.target === document.scrollingElement) {
        refreshAnchorRect();
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onWindowScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onWindowScroll, true);
    };
  }, [overlayState, hovered, refreshAnchorRect]);

  const handleLogout = () => {
    logoutCurrentUser();
    setOverlayState("closed");
    setKurtiOpen(false);
    if (typeof window !== "undefined") {
      window.location.assign("/");
      return;
    }
    router.replace("/");
    router.refresh();
  };
  const isSidebarExpanded = hovered || overlayState !== "closed" || kurtiOpen;

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

  const visibleNavGroups = useMemo(
    () =>
      ADMIN_NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => (!item.adminOnly || adminAccess.isAdmin) && adminAccess.canRead(item.pageKey)),
      })).filter((group) => group.items.length > 0),
    [adminAccess],
  );

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
            setKurtiOpen(false);
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
          {visibleNavGroups.map((group, gi) => (
            <div key={group.label} style={{ marginBottom: gi < visibleNavGroups.length - 1 ? 8 : 0 }}>
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
              {gi < visibleNavGroups.length - 1 && (
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
          {adminAccess.isAdmin ? (
            <button
              type="button"
              aria-expanded={kurtiOpen}
              aria-controls="admin-kurti-panel"
              onClick={() => {
                setOverlayState("closed");
                setKurtiOpen((current) => !current);
              }}
              style={{
                width: "100%",
                height: 38,
                marginBottom: 5,
                borderRadius: 11,
                border: kurtiOpen ? "1px solid rgba(220,38,38,0.18)" : "1px solid rgba(220,38,38,0.08)",
                background: kurtiOpen
                  ? "linear-gradient(112deg, rgba(220,38,38,0.16), rgba(239,68,68,0.06))"
                  : "linear-gradient(112deg, rgba(220,38,38,0.085), rgba(239,68,68,0.025))",
                color: kurtiOpen ? "#b91c1c" : "rgba(185,28,28,0.72)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: isSidebarExpanded ? "flex-start" : "center",
                paddingLeft: isSidebarExpanded ? 12 : 0,
                paddingRight: isSidebarExpanded ? 8 : 0,
                gap: isSidebarExpanded ? 10 : 0,
                fontFamily: "inherit",
                overflow: "hidden",
                whiteSpace: "nowrap",
                boxShadow: kurtiOpen ? "0 5px 14px rgba(185,28,28,0.08)" : "none",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ width: 16, height: 16, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <MessageCircle size={16} strokeWidth={kurtiOpen ? 2.1 : 1.8} />
              </div>
              <span
                style={{
                  minWidth: 0,
                  flex: isSidebarExpanded ? 1 : "0 0 0",
                  width: isSidebarExpanded ? "auto" : 0,
                  opacity: isSidebarExpanded ? 1 : 0,
                  overflow: "hidden",
                  textAlign: "left",
                  fontSize: 12,
                  fontWeight: 700,
                  transition: "opacity 0.2s ease, width 0.25s ease",
                }}
              >
                Kurti
              </span>
              <span
                style={{
                  display: isSidebarExpanded ? "inline-flex" : "none",
                  alignItems: "center",
                  height: 17,
                  padding: "0 6px",
                  borderRadius: 999,
                  color: "rgba(153,27,27,0.74)",
                  background: "rgba(255,255,255,0.5)",
                  border: "1px solid rgba(220,38,38,0.09)",
                  fontSize: 7.5,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                }}
              >
                NEU
              </span>
            </button>
          ) : null}
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
        onOpenManager={adminAccess.isAdmin ? () => setOverlayState("manager") : undefined}
        onOpenCustomerAccess={adminAccess.isAdmin ? () => setOverlayState("customerAccess") : undefined}
        onLogout={handleLogout}
      />
      <AdminManagerPanel
        open={overlayState === "manager"}
        anchorRect={anchorRect}
        currentUserId={authUser?.id ?? null}
        onClose={() => setOverlayState("closed")}
      />
      <CustomerAccessPanel
        open={overlayState === "customerAccess"}
        anchorRect={anchorRect}
        onClose={() => setOverlayState("closed")}
      />
      {adminAccess.isAdmin ? (
        <AdminKurtiPanel
          open={kurtiOpen}
          sidebarExpanded={isSidebarExpanded}
          onClose={() => setKurtiOpen(false)}
        />
      ) : null}
    </>
  );
}
