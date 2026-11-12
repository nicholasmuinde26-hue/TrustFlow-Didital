// Public workspace API. Other frontend modules consume these shared workspace
// concepts through this entry point instead of importing implementation files.
export * from './config/workspaceModules.js';
export * from './config/workspaceNavigation.js';
export * from './permissions/Permissions.js';
export * from './hooks/useTerminology.js';
export * from './hooks/useWorkspaceModules.js';
export * from './utils/moduleSelection.js';

export { default as WorkspaceOverviewPage } from './pages/WorkspaceOverviewPage.jsx';
export { default as WorkspaceSettingsPage } from './pages/WorkspaceSettingsPage.jsx';
export { default as WorkspacesPage } from './pages/WorkspacesPage.jsx';
export { default as MyChamaRouterPage } from './pages/MyChamaRouterPage.jsx';
export { default as WorkspaceQuickLaunchers } from './components/WorkspaceQuickLaunchers.jsx';
export { default as WorkspaceSetupPicker } from './components/WorkspaceSetupPicker.jsx';
export { default as WorkspaceRequestModal } from './components/WorkspaceRequestModal.jsx';
export { default as AdminInquiryBottomPanel } from './components/AdminInquiryBottomPanel.jsx';
export { default as useTerminology } from './hooks/useTerminology.js';
export { default as workspaceModulesApi } from './api/workspaceModules.api.js';
export { default as useDashboard } from './hooks/useDashboard.js';
