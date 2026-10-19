// Permission headers identify the page making a request, including its shared read dependencies.
export function getCustomerAdminPageKeyForPath(pathname: string): string | null {
  const smPages: Array<[string, string]> = [
    ["/admin/sm/dashboard", "sm_dashboard"],
    ["/admin/sm/fragebogen", "sm_fragebogen"],
    ["/admin/sm/durcharbeit-verplanung", "sm_durcharbeit_verplanung"],
    ["/admin/sm/durcharbeit-maerkte", "sm_durcharbeit_maerkte"],
    ["/admin/sm/durcharbeit", "sm_durcharbeit"],
    ["/admin/sm/fbmanagement", "sm_fbmanagement"],
    ["/admin/sm/fotoarchiv", "sm_fotoarchiv"],
    ["/admin/sm/verplanung", "sm_verplanung"],
    ["/admin/sm/zeiterfassung", "sm_zeiterfassung"],
    ["/admin/sm/maerkte", "sm_maerkte"],
    ["/admin/sm/nachrichten", "sm_nachrichten"],
  ];
  const smPage = smPages.find(([href]) => pathname === href || pathname.startsWith(`${href}/`));
  if (smPage) return smPage[1];
  if (pathname.startsWith("/admin/wochenschwerpunkte")) return "wochenschwerpunkte";
  if (pathname.startsWith("/admin/gm-dashboard")) return "gm_dashboard";
  if (pathname.startsWith("/admin/datenschutzanfragen")) return "datenschutzanfragen";
  if (pathname.startsWith("/admin/ipp-berechnung")) return "ipp_berechnung";
  if (pathname.startsWith("/admin/praemien")) return "praemien";
  if (pathname.startsWith("/admin/flexbesuche")) return "flexbesuche";
  if (pathname.startsWith("/admin/billa")) return "billa";
  if (pathname.startsWith("/admin/kuehlerinventur")) return "kuehlerinventur";
  if (pathname.startsWith("/admin/mhd")) return "mhd";
  if (pathname.startsWith("/admin/durcharbeit")) return "durcharbeit";
  if (pathname.startsWith("/admin/fbmanagement")) return "fbmanagement";
  if (pathname.startsWith("/admin/fotoarchiv")) return "fotoarchiv";
  if (pathname.startsWith("/admin/zeiterfassung")) return "zeiterfassung";
  if (pathname.startsWith("/admin/maerkte")) return "maerkte";
  if (pathname.startsWith("/admin/lager")) return "lager";
  if (pathname.startsWith("/admin/shelfmerchandiser")) return "shelfmerchandiser";
  if (pathname.startsWith("/admin/gebietsmanager")) return "gebietsmanager";
  if (pathname.startsWith("/admin/fragebogen")) return "fragebogen";
  return null;
}

/** Stable owner identity for permission-aware SM read workspaces. */
export function customerAdminReadOwner(user: { id: string; role: string; permissions?: Record<string, string[]> | null } | undefined, pageKey: string): string | null {
  if (!user) return null;
  if (user.role === "admin" || user.role === "sm_admin") return user.id;
  return user.role === "kunde" && user.permissions?.[pageKey]?.includes("read") ? user.id : null;
}
