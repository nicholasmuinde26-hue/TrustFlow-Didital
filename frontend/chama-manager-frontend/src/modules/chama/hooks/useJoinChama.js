import { useState } from "react";
import chamaService from "../services/chama.service";

// Backs the invite-LINK flow on JoinChamaPage: previewing a shared
// /chamas/join?token=... link before login, then accepting it once
// authenticated. The join-CODE and public-directory flows on that page
// call chamaService.joinWithCode directly and don't use this hook.
export default function useJoinChama() {
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);

  async function previewInvite(token) {
    try {
      setPreviewing(true);
      setPreviewError(null);
      return await chamaService.previewInvite(token);
    } catch (err) {
      setPreviewError(
        err.response?.data?.message ?? "Unable to load this invitation."
      );
      throw err;
    } finally {
      setPreviewing(false);
    }
  }

  async function acceptInvite(token) {
    try {
      setJoining(true);
      setJoinError(null);
      return await chamaService.acceptInvite(token);
    } catch (err) {
      setJoinError(
        err.response?.data?.message ?? "Unable to submit your request to join."
      );
      throw err;
    } finally {
      setJoining(false);
    }
  }

  return {
    previewInvite,
    previewing,
    previewError,
    acceptInvite,
    joining,
    joinError,
  };
}
