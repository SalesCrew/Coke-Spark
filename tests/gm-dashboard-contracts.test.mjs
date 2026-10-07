import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const normalize = (value) => value.replace(/import type \{ AvailabilityAudit \} from [^;]+;/g, '').replace(/\/\/[^\n]*/g, '').replace(/\s+/g, '');
test('frontend deployment contracts do not depend on the backend checkout', async () => {
  const [dashboard, workspace, model, backendWorkspace, backendDashboard] = await Promise.all([
    readFile(new URL('../src/types/gm-dashboard.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/types/praemien-workspace.ts', import.meta.url), 'utf8'),
    readFile(new URL('../backend/src/praemien-model.shared.ts', import.meta.url), 'utf8'),
    readFile(new URL('../backend/src/lib/praemien-workspace.ts', import.meta.url), 'utf8'),
    readFile(new URL('../backend/src/gm-dashboard.shared.ts', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(dashboard + workspace, /from\s+['"][^'"]*backend\//);
  assert.equal(normalize(dashboard), normalize(backendDashboard));
  const modelTypes = model.slice(model.indexOf('export type MetricUnit'), model.indexOf('export const money'));
  const workspaceTypes = backendWorkspace.slice(backendWorkspace.indexOf('export type WaveInfo'), backendWorkspace.indexOf('type Setting ='));
  assert.equal(normalize(workspace), normalize(modelTypes + workspaceTypes));
});

test('production typecheck excludes backend-dependent tests and route modules expose only route exports', async () => {
  const [config, mhd, durcharbeit, catalog] = await Promise.all([
    readFile(new URL('../tsconfig.json', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/admin/mhd/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/admin/durcharbeit/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/admin/ScopedQuestionnaireCatalog.tsx', import.meta.url), 'utf8'),
  ]);
  assert.ok(JSON.parse(config).exclude.includes('tests'));
  assert.match(mhd, /export \{ default \} from "@\/components\/admin\/ScopedQuestionnaireCatalog"/);
  assert.doesNotMatch(durcharbeit, /from "@\/app\/admin\/mhd\/page"/);
  assert.match(catalog, /export function ScopedQuestionnaireCatalog/);
});
