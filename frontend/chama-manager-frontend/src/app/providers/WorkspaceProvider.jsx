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

  async function loadWorkspaces() {
    setLoading(true);

    try {
      // workspaceService.getWorkspaces() already unwraps to the plain
      // array (see the comment in that file for the response shape).
      const items = await workspaceService.getWorkspaces();

      setWorkspaces(items);

      const saved =
        localStorage.getItem(
          "active_workspace"
        );

      const current =
        items.find(
          (w) => (w.id ?? w._id) === saved
        ) || null;

      setActiveWorkspace(current);
    } finally {
      setLoading(false);
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
