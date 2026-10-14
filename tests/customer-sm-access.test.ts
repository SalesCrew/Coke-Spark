import assert from "node:assert/strict";
import test from "node:test";
import { customerAdminReadOwner, getCustomerAdminPageKeyForPath } from "../src/lib/auth/customerPageKey";
import {
  clearCustomerWorkspacePermissions,
  getAdminPageKeyForPath,
  getCustomerPermissionGroups,
  getFirstReadableAdminHref,
} from "../src/components/ui/adminNavigation";

test("customer catalogs have distinct GM/SM page identities and preserve existing GM keys", () => {
  const gm = getCustomerPermissionGroups("gm").flatMap(group => group.items);
  const sm = getCustomerPermissionGroups("sm").flatMap(group => group.items);
  assert.deepEqual(gm.map(item => item.pageKey), ["gm_dashboard", "ipp_berechnung", "praemien", "fragebogen", "flexbesuche", "billa", "kuehlerinventur", "mhd", "durcharbeit", "fbmanagement", "fotoarchiv", "zeiterfassung", "maerkte", "lager", "gebietsmanager"]);
  assert.equal(sm.length, 12);
  assert.equal(new Set([...gm, ...sm].map(item => item.pageKey)).size, gm.length + sm.length);
  for (const item of [...gm, ...sm]) {
    assert.equal(item.adminOnly, undefined);
    assert.equal(getAdminPageKeyForPath(item.href), item.pageKey);
    assert.equal(getCustomerAdminPageKeyForPath(item.href), item.pageKey);
    assert.equal(getCustomerAdminPageKeyForPath(`${item.href}/detail`), item.pageKey);
    assert.equal(getAdminPageKeyForPath(`${item.href}/detail`), item.pageKey);
  }
  assert.equal(getAdminPageKeyForPath("/admin/sm/durcharbeit-verplanung"), "sm_durcharbeit_verplanung");
  assert.equal(getAdminPageKeyForPath("/admin/sm/durcharbeit"), "sm_durcharbeit");
});

test("SM-only accounts land on their first readable page without inheriting GM access", () => {
  assert.equal(getFirstReadableAdminHref(key => key === "sm_dashboard"), "/admin/sm/dashboard");
  assert.equal(getFirstReadableAdminHref(key => key === "sm_fotoarchiv"), "/admin/sm/fotoarchiv");
  assert.equal(getFirstReadableAdminHref(() => false), null);
  assert.equal(getFirstReadableAdminHref(key => key === "datenschutzanfragen"), null);
});

test("clearing either workspace preserves the other workspace and does not mutate the account", () => {
  const permissions = { gm_dashboard: ["read"], fragebogen: ["read", "update"], sm_dashboard: ["read"], sm_fragebogen: ["read", "write"], shelfmerchandiser: ["read"] };
  assert.deepEqual(clearCustomerWorkspacePermissions(permissions, "sm"), { gm_dashboard: ["read"], fragebogen: ["read", "update"] });
  assert.deepEqual(clearCustomerWorkspacePermissions(permissions, "gm"), { sm_dashboard: ["read"], sm_fragebogen: ["read", "write"], shelfmerchandiser: ["read"] });
  assert.equal(Object.keys(permissions).length, 5);
});

test("SM read workspaces retain a customer owner only for their exact readable page", () => {
  const user = {id:"synthetic-customer", role:"kunde", permissions:{sm_fotoarchiv:["read"], sm_fbmanagement:["write"], fotoarchiv:["read"]}};
  assert.equal(customerAdminReadOwner(user,"sm_fotoarchiv"),user.id);
  assert.equal(customerAdminReadOwner(user,"sm_fbmanagement"),null);
  assert.equal(customerAdminReadOwner({...user, permissions:{fotoarchiv:["read"]}},"sm_fotoarchiv"),null);
  assert.equal(customerAdminReadOwner({...user, role:"sm"},"sm_fotoarchiv"),null);
  assert.equal(customerAdminReadOwner({...user, role:"admin",permissions:{}},"sm_fotoarchiv"),user.id);
});
