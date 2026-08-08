import { useState } from "react";
import { useNavigate } from "react-router-dom";

import contributionGroupService from "../services/contributionGroup.service";

import useWorkspace from "@/app/hooks/useWorkspace";

export default function useCreateContributionGroup() {
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const workspace = useWorkspace();

  async function create(payload) {
    setLoading(true);

    try {
      const group =
        await contributionGroupService.create(payload);

      if (workspace.refresh) {
        await workspace.refresh();
      }

      navigate(`/workspace/${group._id}`);

      return group;
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    create,
  };
}