import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import chamaAssetsApi from "../api/chamaAssets.api";

const inputClass = "min-h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist";
const primaryClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";
const KES = (value) => `KES ${Number(value || 0).toLocaleString("en-KE")}`;

// "If a manager logs income with no matching M-Pesa record, it's
// flagged, not silently accepted." This is that flag queue — every
// asset-income entry across the whole chama that was recorded as an
// M-Pesa collection but hasn't matched a real Safaricom C2B confirmation
// yet (see chamaAsset.service.js#recordIncome). A leader can close the
// flag by hand once they've independently found the matching receipt
// (e.g. in the till's M-Pesa statement) — this does NOT re-post the
// income, it only confirms an entry that's already in the books.
export default function AssetReconciliationQueue({ chamaId, notify }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [receiptDrafts, setReceiptDrafts] = useState({});

  const load = useCallback(async () => {
    if (!chamaId) return;
    setLoading(true);
    try {
      const { data } = await chamaAssetsApi.unverifiedIncome(chamaId);
      setEntries(data?.data?.entries || []);
    } catch (err) {
      notify(err.response?.data?.message || "Could not load the reconciliation queue.", true);
    } finally {
      setLoading(false);
    }
  }, [chamaId, notify]);

  useEffect(() => { load(); }, [load]);

  if (loading && entries.length === 0) return null;
  if (entries.length === 0) return null;

  const verify = async (transactionId) => {
    setBusyId(transactionId);
    try {
      await chamaAssetsApi.verifyIncome(chamaId, transactionId, receiptDrafts[transactionId] || "");
      await load();
      notify("Entry verified and cleared from the reconciliation queue.");
    } catch (err) {
      notify(err.response?.data?.message || "Could not verify this entry.", true);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700/60 dark:bg-amber-950/20">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-700 dark:text-amber-400" />
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
          {entries.length} M-Pesa {entries.length === 1 ? "collection" : "collections"} awaiting reconciliation
        </h3>
      </div>
      <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-300/70">
        These were logged as M-Pesa income but haven't matched a real Safaricom confirmation yet — not silently accepted.
        Verify once you've found the matching receipt in the till's M-Pesa statement.
      </p>
      <div className="mt-2 divide-y divide-amber-200 dark:divide-amber-800/50">
        {entries.map((entry) => (
          <div key={entry._id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div>
              <p className="text-xs font-medium text-slate-900 dark:text-mist">
                {entry.asset_id?.name || "Asset"} · {KES(entry.amount)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-mist-muted">
                {entry.description || "Asset income"} · {new Date(entry.occurred_at).toLocaleString()}
              </p>
            </div>
            <div className="flex items-end gap-2">
              <input
                aria-label="M-Pesa receipt no."
                className={`${inputClass} w-36`}
                placeholder="M-Pesa receipt no."
                value={receiptDrafts[entry._id] || ""}
                onChange={(event) => setReceiptDrafts((v) => ({ ...v, [entry._id]: event.target.value }))}
              />
              <button type="button" className={primaryClass} disabled={busyId === entry._id} onClick={() => verify(entry._id)}>
                <Check size={14} />Verify
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
