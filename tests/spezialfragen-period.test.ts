import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spezialfragePeriodError, updateSpezialfragePeriod, clearSpezialfragePeriod } from '../src/lib/spezialfragen-period';
import { spezialfragePeriodError as backendError } from '../backend/src/lib/spezialfragen-period';
import { applyQuestionTypeSwitch } from '../src/utils/questionTypeSwitch';
import { cloneQuestionForModuleInsert } from '../src/utils/existingQuestionPicker';
import { QUESTION_TYPES } from '../src/utils/fragebogen';
import type { Question } from '../src/types/fragebogen';
const period = { startDate: '2026-10-07', endDate: '2026-10-09' };
const original: Question = { id:'synthetic', type:'yesno', text:'Synthetic', required:true, config:{ spezialfragePeriod:period, images:['synthetic.png'] }, rules:[], scoring:{} };
test('UI and server agree about every valid and invalid schedule', () => {
  for (const value of [undefined, null, '', [], {}, period, { startDate:'2026-02-29', endDate:'2026-03-01' }, { startDate:'2028-02-29', endDate:'2028-02-29' }, { startDate:'2026-10-09', endDate:'2026-10-07' }]) assert.equal(spezialfragePeriodError({ spezialfragePeriod:value }),backendError({ spezialfragePeriod:value }));
});
test('date editing and clearing preserve unrelated config and never mutate source values', () => {
  const changed = updateSpezialfragePeriod(original.config,'endDate','2026-10-10');
  assert.deepEqual(changed.spezialfragePeriod, { ...period, endDate:'2026-10-10' });
  assert.deepEqual(clearSpezialfragePeriod(changed), { images:['synthetic.png'] });
  assert.deepEqual(original.config.spezialfragePeriod,period);
  assert.ok(spezialfragePeriodError(updateSpezialfragePeriod({},'startDate','2026-10-07')));
});
test('switching question type and importing from the shared pool retain the date window', () => {
  for (const type of QUESTION_TYPES) assert.deepEqual(applyQuestionTypeSwitch(original,type).config.spezialfragePeriod,period);
  const copy = cloneQuestionForModuleInsert(original);
  assert.equal(copy.id,original.id); assert.deepEqual(copy.config.spezialfragePeriod,period);
  (copy.config.spezialfragePeriod as typeof period).endDate = '2026-10-20';
  assert.equal(period.endDate,'2026-10-09');
});
