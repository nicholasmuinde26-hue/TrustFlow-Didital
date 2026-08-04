import { useState } from "react";
import chamaService from "../services/chama.service";

export default function useJoinChama() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function joinChama(payload) {
    try {
      setLoading(true);
      setError(null);

      return await chamaService.join(payload);
    } catch (err) {
      setError(
        err.response?.data?.message ??
        "Unable to join chama."
      );

      throw err;
    } finally {
      setLoading(false);
    }
  }

  return {
    joinChama,
    loading,
    error,
  };
}