import {
  useEffect,
  useMemo,
  useState,
} from "react";

import WorkspaceContext from "../store/workspace.store";

import workspaceService from "../services/workspace.service";
import useAuth from "../hooks/useAuth";

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
      const data =
        await workspaceService.getWorkspaces();

      const items = data.workspaces || [];

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

  const value = useMemo(
    () => ({
      workspaces,

      activeWorkspace,

      loading,

      selectWorkspace,

      refresh,
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