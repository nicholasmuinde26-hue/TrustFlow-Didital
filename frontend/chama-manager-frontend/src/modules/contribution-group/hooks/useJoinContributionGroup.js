import { useState } from "react";
import { useNavigate } from "react-router-dom";

import contributionGroupService from "../services/contributionGroup.service";

import useWorkspace from "@/app/hooks/useWorkspace";

export default function useJoinContributionGroup() {
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const { refreshWorkspaces } = useWorkspace();

  async function join(payload) {
    setLoading(true);

    try {
      const group =
        await contributionGroupService.join(payload);

      await refreshWorkspaces();

      navigate(`/workspace/${group._id}`);

      return group;
    } finally {
      setLoading(false);
    }
  }

  return {
    join,
    loading,
  };
}