import { useState } from "react";

import { useNavigate } from "react-router-dom";

import chamaService from "../services/chama.service";

import useWorkspace from "@/app/hooks/useWorkspace";

export default function useCreateChama() {
  const navigate = useNavigate();

  const { refreshWorkspaces } = useWorkspace();

  const [loading, setLoading] = useState(false);

  async function create(payload) {
    setLoading(true);

    try {
      const chama = await chamaService.create(payload);

      await refreshWorkspaces();

      navigate(`/workspace/${chama.id || chama._id}`);

      return chama;
    } finally {
      setLoading(false);
    }
  }

  return {
    create,
    loading,
  };
}