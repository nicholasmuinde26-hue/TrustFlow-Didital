import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEGACY_MODULES_BY_PRESET,
  WORKSPACE_MODULES,
  WORKSPACE_PRESETS,
  buildWorkspaceConfig,
  getEnabledModules,
  validateModuleSelection,
} from '../../../constants/workspaceModules.constants.js';
import { getOrganizationPresetKey } from '../../../constants/organizationTypes.constants.js';
import { assertNothingBlocked } from '../workspacemodulechange.service.js';
import { inferOrganizationType } from '../../../scripts/backfillWorkspaceConfig.js';
import { isPlanAvailableForFamily } from '../../billing/index.js';

test('family and organization type resolve to their intended presets', () => {
  assert.equal(getOrganizationPresetKey('sacco', 'farmer_sacco'), 'farmer_sacco');
  assert.equal(getOrganizationPresetKey('cooperative', 'agricultural'), 'agricultural_cooperative');
  assert.equal(getOrganizationPresetKey('cooperative', 'consumer'), 'cooperative');
  assert.equal(getOrganizationPresetKey('chama', 'housing'), 'housing_group');
});

test('legacy type backfill recognizes SACCO and cooperative families', () => {
  assert.deepEqual(inferOrganizationType({ chama_type: 'farmer_sacco' }), { family: 'sacco', type: 'farmer_sacco' });
  assert.deepEqual(inferOrganizationType({ chama_type: 'agricultural' }), { family: 'cooperative', type: 'agricultural' });
  assert.deepEqual(inferOrganizationType({ chama_type: 'standard' }), { family: 'chama', type: 'custom' });
});

test('SACCO and cooperative preset module selections satisfy dependencies', () => {
  for (const key of ['community_sacco', 'farmer_sacco', 'employee_sacco', 'investment_sacco', 'housing_sacco', 'agricultural_cooperative', 'cooperative', 'housing_cooperative']) {
    const result = validateModuleSelection(WORKSPACE_PRESETS[key].modules);
    assert.equal(result.ok, true, `${key}: ${result.errors.join('; ')}`);
  }
  assert.equal(WORKSPACE_MODULES.share_linked_limits.requires.includes('loan_products'), true);
});

test('switching off a module with live records is rejected', () => {
  const blocked = { loans: { reason: 'Loans has 2 unsettled loans.' } };
  assert.throws(() => assertNothingBlocked(blocked, ['loans']), (error) => error.code === 'MODULE_HAS_OPEN_DATA');
  assert.doesNotThrow(() => assertNothingBlocked(blocked, ['polls']));
});

test('saved module lists stay fixed when preset definitions are expanded', () => {
  const saved = buildWorkspaceConfig({ preset: 'farmer_sacco', enabled: LEGACY_MODULES_BY_PRESET.farmer_sacco });
  assert.deepEqual(getEnabledModules({ chama_type: 'farmer_sacco', workspace_config: saved }), LEGACY_MODULES_BY_PRESET.farmer_sacco);
  assert.equal(getEnabledModules({ chama_type: 'farmer_sacco' }).includes('share_capital'), false);
});

test('billing plan family scopes preserve legacy plans and separate specialist plans', () => {
  assert.equal(isPlanAvailableForFamily({ code: 'legacy' }, 'sacco'), true);
  assert.equal(isPlanAvailableForFamily({ code: 'sacco_plus', organization_families: ['sacco'] }, 'sacco'), true);
  assert.equal(isPlanAvailableForFamily({ code: 'sacco_plus', organization_families: ['sacco'] }, 'chama'), false);
});
