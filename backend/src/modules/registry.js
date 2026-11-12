import { WORKSPACE_MODULES } from '../constants/workspaceModules.constants.js';
import announcements from './announcements/index.js';
import chat from './chat/index.js';
import disputes from './disputes/index.js';
import meetings from './meetings/index.js';
import officials from './officials/index.js';
import polls from './polls/index.js';

// The registry is the composition point for feature modules. Keep each entry
// in its module's public index; application boot code should not reach inside.
export const moduleRegistry = Object.freeze([meetings, announcements, polls, disputes, officials, chat]);

for (const module of moduleRegistry) {
  if (!WORKSPACE_MODULES[module.key]) {
    throw new Error(`Module registry: unknown workspace module "${module.key}"`);
  }
}

export function mountRegisteredModuleRoutes(app) {
  for (const module of moduleRegistry) {
    for (const route of module.routes) app.use(route.mountPath, route.router);
  }
}

export function startRegisteredModuleJobs() {
  return moduleRegistry.flatMap((module) => module.jobs.map((start) => start()));
}
