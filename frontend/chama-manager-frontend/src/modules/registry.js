import announcements from './announcements/index.js';
import chat from './chat/index.js';
import meetings from './meetings/index.js';
import polls from './polls/index.js';

// Frontend feature metadata lives beside each feature. The app router and
// workspace navigation consume these public registrations.
export const workspaceFeatureModules = Object.freeze([chat, meetings, polls, announcements]);

const registeredKeys = new Set();
for (const module of workspaceFeatureModules) {
  if (registeredKeys.has(module.key)) {
    throw new Error(`Frontend module registry: duplicate key "${module.key}"`);
  }
  registeredKeys.add(module.key);
  if (!module.routes.length || !module.workspacePaths.length || !module.navigation) {
    throw new Error(`Frontend module registry: incomplete registration for "${module.key}"`);
  }
}
