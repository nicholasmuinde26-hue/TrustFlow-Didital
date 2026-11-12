import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKSPACE_MODULES } from '../constants/workspaceModules.constants.js';
import { moduleRegistry } from '../modules/registry.js';

test('registered feature modules use catalog keys and public route registrations', () => {
  const byKey = new Map(moduleRegistry.map((module) => [module.key, module]));
  assert.deepEqual([...byKey.keys()].sort(), ['announcements', 'chat', 'disputes', 'meetings', 'officials', 'polls']);

  for (const module of moduleRegistry) {
    assert.ok(WORKSPACE_MODULES[module.key], `${module.key} exists in the workspace catalog`);
    assert.ok(Array.isArray(module.routes));
    assert.ok(module.routes.length > 0);
    assert.ok(Array.isArray(module.jobs));
    for (const route of module.routes) {
      assert.ok(['/api/v1/workspaces', '/api/v1/chamas', '/api/v1/chat'].includes(route.mountPath));
      assert.equal(typeof route.router, 'function');
    }
  }
  assert.equal(byKey.get('polls').jobs.length, 1);
  assert.equal(byKey.get('announcements').jobs.length, 0);
  assert.equal(byKey.get('disputes').jobs.length, 0);
  assert.equal(byKey.get('disputes').routes[0].mountPath, '/api/v1/chamas');
  assert.equal(byKey.get('officials').routes[0].mountPath, '/api/v1/chamas');
  assert.equal(byKey.get('meetings').routes[0].mountPath, '/api/v1/workspaces');
  assert.equal(byKey.get('chat').routes[0].mountPath, '/api/v1/chat');
});
