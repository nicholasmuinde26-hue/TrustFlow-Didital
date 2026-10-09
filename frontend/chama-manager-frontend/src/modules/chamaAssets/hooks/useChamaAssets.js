import { useCallback, useEffect, useState } from 'react';

import { useSocket } from '@/app/providers/SocketProvider';
import chamaAssetsApi from '../api/chamaAssets.api';

/**
 * Drives the dashboard's "Assets & Income" panel.
 *
 * - `assets.length === 0` is the signal the dashboard uses to hide the
 *   panel entirely and show the "+ Register a business or property" CTA
 *   instead — see ChamaAssetsPanel.jsx.
 * - Listens on the chama's existing socket room (every member auto-joins
 *   `chama:<id>` on connect — see socketServer.js#joinChamaRooms) for
 *   `finance:asset_income` and `chama_asset:updated`, so a figure the
 *   treasurer records shows up here without a refresh or a poll.
 */
export function useChamaAssets(chamaId) {
  const { socket } = useSocket();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // assetId -> running total of income events received live this session,
  // so the number can visibly tick up the instant it's recorded, ahead of
  // the next full refetch.
  const [liveDeltas, setLiveDeltas] = useState({});

  const refetch = useCallback(async () => {
    if (!chamaId) return;
    setLoading(true);
    try {
      const { data } = await chamaAssetsApi.list(chamaId, { includePending: true });
      setAssets(data?.data?.assets || []);
      setLiveDeltas({});
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [chamaId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!socket || !chamaId) return undefined;

    const onIncome = (payload) => {
      setLiveDeltas((prev) => ({
        ...prev,
        [payload.assetId]: (prev[payload.assetId] || 0) + Number(payload.amount || 0),
      }));
    };

    // An asset was requested, approved, or rejected — the set of assets
    // shown (or whether the panel should be visible at all) may have
    // changed, so just refetch rather than trying to patch it by hand.
    const onAssetChanged = () => refetch();

    socket.on('finance:asset_income', onIncome);
    socket.on('chama_asset:updated', onAssetChanged);
    socket.on('chama_asset:requested', onAssetChanged);

    return () => {
      socket.off('finance:asset_income', onIncome);
      socket.off('chama_asset:updated', onAssetChanged);
      socket.off('chama_asset:requested', onAssetChanged);
    };
  }, [socket, chamaId, refetch]);

  return {
    assets,
    hasAssets: assets.length > 0,
    liveDeltas,
    loading,
    error,
    refetch,
  };
}

export default useChamaAssets;