import {
  useEffect,
  useMemo,
  useState,
} from "react";

import WorkspaceContext from "../store/workspace.store";

import workspaceService from "../services/workspace.service";
import useAuth from "../hooks/useAuth";

import chamaService from "@/modules/chama/services/chama.service";
import contributionGroupService from "@/modules/contribution-group/services/contributionGroup.service";
import { businessService } from "@/modules/business/services/business.service";

// How often to silently re-pull the workspace list while the tab is open,
// so things like a workspace's member count / avatar preview on the Home
// page reflect changes (someone joining, an invite being accepted, etc.)
// made from another device or by another member without the user having
// to manually refresh.
const WORKSPACE_POLL_INTERVAL_MS = 20_000;

export default function WorkspaceProvider({
  children,
}) {
  const { isAuthenticated } = useAuth();

  const [workspaces, setWorkspaces] = useState([]);

  const [activeWorkspace, setActiveWorkspace] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  //-----------------------------------------------------
  //
  // `silent` is used for background refreshes (polling / tab focus) so
  // the UI doesn't flash a loading spinner every 20s — only the very
  // first load, and explicit calls to `refresh()`, show one.
  //
  //-----------------------------------------------------

  async function loadWorkspaces({ silent = false } = {}) {
    if (!silent) setLoading(true);

    try {
      // workspaceService.getWorkspaces() already unwraps to the plain
      // array (see the comment in that file for the response shape).
      const items = await workspaceService.getWorkspaces();

      setWorkspaces(items);

      // Re-select whichever workspace was active, but with the freshly
      // fetched data (e.g. an updated memberCount / members preview) —
      // falling back to whatever's saved in localStorage on first load.
      setActiveWorkspace((prevActive) => {
        const activeId = (prevActive?.id ?? prevActive?._id) || localStorage.getItem("active_workspace");

        return items.find((w) => (w.id ?? w._id) === activeId) || (silent ? prevActive : null);
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }

  //-----------------------------------------------------

  useEffect(() => {
    // Only fetch workspaces once we know the visitor is logged in —
    // anonymous visitors on the landing/login pages have none.
    if (isAuthenticated) {
      loadWorkspaces();
    } else {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  //-----------------------------------------------------
  //
  // Keep the workspace list (member counts, avatar previews, etc.) live
  // without a manual reload: poll quietly on an interval, and refetch
  // whenever the tab regains focus/visibility, since that's usually
  // exactly when a stale count would be most noticeable.
  //
  //-----------------------------------------------------

  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      loadWorkspaces({ silent: true });
    }, WORKSPACE_POLL_INTERVAL_MS);

    function handleFocus() {
      loadWorkspaces({ silent: true });
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  //-----------------------------------------------------

  function selectWorkspace(workspace) {
    setActiveWorkspace(workspace);

    localStorage.setItem(
      "active_workspace",
      workspace.id ?? workspace._id
    );
  }

  //-----------------------------------------------------

  async function refresh() {
    await loadWorkspaces();
  }

  //-----------------------------------------------------
  //
  // There is no unified POST /workspaces on the backend — creating a
  // workspace means POSTing to /chamas or /contribution-groups directly,
  // which have genuinely different accepted fields. This dispatches to
  // the right one and reloads the aggregate list afterward so the new
  // workspace shows up with the shape workspace.mapper.js produces (id,
  // type, role, ...).
  //
  //-----------------------------------------------------

  async function createChama(payload) {
    const chama = await chamaService.create(payload);
    const items = await workspaceService.getWorkspaces();
    setWorkspaces(items);

    const created = items.find(
      (w) => String(w.id ?? w._id) === String(chama._id)
    );

    return created || chama;
  }

  async function createContributionGroup(payload) {
    const group = await contributionGroupService.create(payload);
    const items = await workspaceService.getWorkspaces();
    setWorkspaces(items);

    const created = items.find(
      (w) => String(w.id ?? w._id) === String(group._id)
    );

    return created || group;
  }

  async function createBusiness(payload) {
    const business = await businessService.createBusiness(payload);
    const items = await workspaceService.getWorkspaces();
    setWorkspaces(items);
    return items.find((workspace) => String(workspace.id ?? workspace._id) === String(business._id)) || business;
  }

  //-----------------------------------------------------

  const value = useMemo(
    () => ({
      workspaces,

      activeWorkspace,

      loading,

      selectWorkspace,

      refresh,

      createChama,

      createContributionGroup,

      createBusiness,
    }),
    [
      workspaces,
      activeWorkspace,
      loading,
    ]
  );

  //-----------------------------------------------------

  return (
    <WorkspaceContext.Provider
      value={value}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
