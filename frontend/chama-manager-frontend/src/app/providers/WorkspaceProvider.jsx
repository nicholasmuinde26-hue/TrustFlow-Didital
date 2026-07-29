import {
  useEffect,
  useMemo,
  useState,
} from "react";

import WorkspaceContext from "../store/workspace.store";

import workspaceService from "../services/workspace.service";

export default function WorkspaceProvider({
  children,
}) {
  const [workspaces, setWorkspaces] = useState([]);

  const [activeWorkspace, setActiveWorkspace] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  //-----------------------------------------------------

  async function loadWorkspaces() {
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
          (w) => w.id === saved
        ) || items[0];

      setActiveWorkspace(current || null);
    } finally {
      setLoading(false);
    }
  }

  //-----------------------------------------------------

  useEffect(() => {
    loadWorkspaces();
  }, []);

  //-----------------------------------------------------

  function selectWorkspace(workspace) {
    setActiveWorkspace(workspace);

    localStorage.setItem(
      "active_workspace",
      workspace.id
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