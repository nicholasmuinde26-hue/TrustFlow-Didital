import React, { useCallback, useEffect, useState } from "react";
import { Check, FileText, Flag, Plus, ReceiptText, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Stat, StatStrip } from "@/modules/chama/components/overview/primitives";
import { useChamaAssets } from "../hooks/useChamaAssets";
import chamaAssetsApi from "../api/chamaAssets.api";
import chamaApi from "@/modules/chama/api/chama.api";
import AssetLeaseSection from "./AssetLeaseSection";
import AssetComplianceSection from "./AssetComplianceSection";
import AssetProgressDashboard from "./AssetProgressDashboard";
import AssetReconciliationQueue from "./AssetReconciliationQueue";
import AssetManagerReportsSection from "./AssetManagerReportsSection";
import AssetDiscrepancyQueue from "./AssetDiscrepancyQueue";

const KES = (value) => `KES ${Number(value || 0).toLocaleString("en-KE")}`;
const inputClass = "min-h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist";
const actionClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-obsidian-border dark:text-mist dark:hover:bg-obsidian-raised";
const primaryClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";

const newProposal = { title: "", asset_type: "property", purchase_price: "", acquisition_costs: "", expected_monthly_income: "", funding_source: "chama_funds", risk_notes: "" };
const newRegistration = { name: "", asset_type: "property", description: "", expected_monthly_income: "", purchase_price: "", manager_id: "", document_type: "title_deed", file_url: "" };

export default function ChamaAssetsPanel({ chamaId, canManage = false, canApprove = false, currentUserId, initialAction, onActionHandled, activeTab = "all" }) {
  const { assets, loading, refetch } = useChamaAssets(chamaId);
  const [proposals, setProposals] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [distributionAsset, setDistributionAsset] = useState(null);
  const [distributionMembers, setDistributionMembers] = useState([]);
  const [distributionForm, setDistributionForm] = useState({ recipients: {}, scheduledAt: "" });
  const [proposalForm, setProposalForm] = useState(newProposal);
  const [registrationForm, setRegistrationForm] = useState(newRegistration);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [showBusinessRequestForm] = useState(false);
  const [history, setHistory] = useState({});
  const [expenseFor, setExpenseFor] = useState(null);
  const [incomeFor, setIncomeFor] = useState(null);
  const [fundingFor, setFundingFor] = useState(null);
  const [transactionForm, setTransactionForm] = useState({ amount: "", collectionMethod: "cash", description: "" });
  const [acquisitionFor, setAcquisitionFor] = useState(null);
  const [acquisitionForm, setAcquisitionForm] = useState({ collectionMethod: "bank", settlementReference: "" });
  const [flagFor, setFlagFor] = useState(null); // { assetId, transactionId }
  const [flagReason, setFlagReason] = useState("");
  const [flagRefresh, setFlagRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialAction === "proposal") {
      setShowProposalForm(true);
      setShowRegistrationForm(false);
    } else if (initialAction === "register" && canManage) {
      setShowRegistrationForm(true);
      setShowProposalForm(false);
    }
    if (initialAction) onActionHandled?.();
  }, [initialAction, canManage, onActionHandled]);

  const loadProposals = useCallback(async () => {
    if (!chamaId) return;
    try {
      const { data } = await chamaAssetsApi.proposals(chamaId);
      setProposals(data?.data?.proposals || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load investment proposals.");
    }
  }, [chamaId]);

  const loadDistributions = useCallback(async () => {
    if (!chamaId) return;
    try {
      const { data } = await chamaAssetsApi.listDistributions(chamaId);
      setDistributions(data?.data?.distributions || []);
    } catch (err) { 
      setError(err.response?.data?.message || "Could not load business distributions."); 
    }
  }, [chamaId]);

  useEffect(() => { loadProposals(); }, [loadProposals]);
  useEffect(() => { loadDistributions(); }, [loadDistributions]);

  const run = async (action, successMessage) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      if (successMessage) setNotice(successMessage);
      await Promise.all([refetch(), loadProposals(), loadDistributions()]);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || err.message || "The request could not be completed.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const loadHistory = async (assetId) => {
    setError("");
    try {
      const { data } = await chamaAssetsApi.transactions(chamaId, assetId);
      setHistory((current) => ({ ...current, [assetId]: data?.data?.transactions || [] }));
    } catch (err) {
      setError(err.response?.data?.message || "Could not load the asset statement.");
    }
  };

  const submitFlag = async (event) => {
    event.preventDefault();
    if (!flagFor) return;
    const ok = await run(() => chamaAssetsApi.flagTransaction(chamaId, flagFor.assetId, flagFor.transactionId, flagReason.trim()), "Flagged. Leadership has been asked to review this entry.");
    if (ok) {
      await loadHistory(flagFor.assetId);
      setFlagFor(null);
      setFlagReason("");
      setFlagRefresh((value) => value + 1);
    }
  };

  const submitRegistration = (event) => {
    event.preventDefault();
    const documents = registrationForm.file_url ? [{ type: registrationForm.document_type, file_url: registrationForm.file_url }] : [];
    const payload = {
      asset_type: registrationForm.asset_type,
      name: registrationForm.name,
      description: registrationForm.description,
      expected_monthly_income: registrationForm.expected_monthly_income ? Number(registrationForm.expected_monthly_income) : null,
      acquisition: { purchase_price: Number(registrationForm.purchase_price || 0), method: "other" },
      management: registrationForm.manager_id ? { manager_type: "member", manager_id: registrationForm.manager_id } : {},
      documents,
    };
    run(async () => {
      await chamaAssetsApi.request(chamaId, payload);
      setRegistrationForm(newRegistration);
      setShowRegistrationForm(false);
    }, "Asset submitted for approval.");
  };

  const submitProposal = (event) => {
    event.preventDefault();
    const payload = {
      title: proposalForm.title,
      asset_type: proposalForm.asset_type,
      proposal: {
        purchase_price: Number(proposalForm.purchase_price),
        acquisition_costs: Number(proposalForm.acquisition_costs || 0),
        funding_source: proposalForm.funding_source,
        expected_monthly_income: proposalForm.expected_monthly_income ? Number(proposalForm.expected_monthly_income) : null,
        risk_notes: proposalForm.risk_notes,
      },
    };
    run(async () => {
      await chamaAssetsApi.createProposal(chamaId, payload);
      setProposalForm(newProposal);
      setShowProposalForm(false);
    }, "Investment proposal submitted for approval.");
  };

  const beginDistribution = async (assetId) => {
    try {
      const { data } = await chamaApi.listMembers(chamaId);
      const members = data?.data?.members || data?.data || [];
      const active = members.filter((member) => member.status === "active");
      setDistributionMembers(active);
      setDistributionForm({ recipients: Object.fromEntries(active.map((m) => [m._id, { amount: "", method: "wallet", phone_number: m.user_id?.phone || "" }])), scheduledAt: "" });
      setDistributionAsset(assetId);
    } catch (err) { 
      setError(err.response?.data?.message || "Could not load active members."); 
    }
  };

  const submitDistribution = (event) => {
    event.preventDefault();
    const recipients = distributionMembers.map((member) => ({ member_id: member._id, ...distributionForm.recipients[member._id], amount: Number(distributionForm.recipients[member._id]?.amount) }));
    run(async () => {
      await chamaAssetsApi.createDistribution(chamaId, distributionAsset, { recipients, scheduledAt: new Date(distributionForm.scheduledAt).toISOString() });
      setDistributionAsset(null);
    }, "Members have been notified. The distribution will release only after everyone accepts and the scheduled date arrives.");
  };

  if (loading && proposals.length === 0) {
    return (
      <p role="status" className="py-6 text-sm text-slate-500 dark:text-mist-muted">
        Loading assets and proposals…
      </p>
    );
  }

  const showAssets = activeTab !== "investments";
  const showInvestments = activeTab !== "portfolio";
  const showAssetSummary = showAssets && assets.length > 0;
  const showEmptyPortfolio = showAssets && assets.length === 0;

  return (
    <div className="space-y-5">
      {(notice || error) && (
        <p role={error ? "alert" : "status"} className={`text-sm ${error ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>
          {error || notice}
        </p>
      )}

      {showAssets && assets.length > 0 && (
        <AssetDiscrepancyQueue
          chamaId={chamaId}
          canReview={canApprove}
          currentUserId={currentUserId}
          refreshKey={flagRefresh}
          onChanged={() => Object.keys(history).forEach((assetId) => loadHistory(assetId))}
          notify={(message, isError) => (isError ? setError(message) : setNotice(message))}
        />
      )}

      {showAssets && canManage && (
        <AssetReconciliationQueue chamaId={chamaId} notify={(message, isError) => (isError ? setError(message) : setNotice(message))} />
      )}

      {showAssetSummary ? (
        <StatStrip>
          {assets.map((asset) => (
            <Stat key={asset._id} label={asset.name} value={asset.status === "active" ? KES(asset.expected_monthly_income) : "Under review"} sub={asset.status === "active" ? asset.income_pattern : "Awaiting approval"} tone={asset.status === "active" ? "text-emerald-700" : "text-amber-700"} />
          ))}
        </StatStrip>
      ) : null}

      {showEmptyPortfolio ? (
        <p className="border-t border-slate-200 pt-4 text-sm text-slate-500 dark:border-obsidian-border dark:text-mist-muted">
          No assets have been registered yet.
        </p>
      ) : null}

      {showAssets && assets.map((asset) => (
        <div key={asset._id} className="border-t border-slate-200 pt-4 dark:border-obsidian-border">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-mist">{asset.name}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-mist-muted">{asset.description || asset.asset_type} · {String(asset.status || "unknown").replaceAll("_", " ")}</p>
              {asset.management?.manager_id && <p className="mt-1 text-xs text-slate-500 dark:text-mist-muted">Manager assigned</p>}
              {asset.operations_ref?.business_id && <Link className="mt-2 inline-flex text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400" to={`/workspace/${asset.operations_ref.business_id._id || asset.operations_ref.business_id}`}>Open business operations</Link>}
              {asset.documents?.length > 0 && <div className="mt-2 flex flex-wrap gap-3">{asset.documents.map((document, index) => document.file_url ? <a key={`${asset._id}-doc-${index}`} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400" href={document.file_url} target="_blank" rel="noreferrer"><FileText size={13} />{String(document.type || "document").replaceAll("_", " ")}</a> : null)}</div>}
            </div>
            <div className="flex flex-wrap gap-2">
              {asset.status === "pending_approval" && canApprove && String(asset.requested_by) !== String(currentUserId) && <>
                <button type="button" className={primaryClass} disabled={busy} onClick={() => run(() => chamaAssetsApi.approve(chamaId, asset._id), "Asset approved.")}><Check size={14} />Approve</button>
                <button type="button" className={actionClass} disabled={busy} onClick={() => run(() => chamaAssetsApi.reject(chamaId, asset._id, "Rejected by chama approver."), "Asset rejected.")}><X size={14} />Reject</button>
              </>}
              {asset.status === "active" && <>
                <button type="button" className={actionClass} onClick={() => loadHistory(asset._id)}><ReceiptText size={14} />{history[asset._id] ? "Refresh statement" : "Statement"}</button>
                {canManage && <button type="button" className={actionClass} onClick={() => { setExpenseFor(expenseFor === asset._id ? null : asset._id); setIncomeFor(null); setFundingFor(null); }}>Record expense</button>}
                {canManage && <button type="button" className={actionClass} onClick={() => { setIncomeFor(incomeFor === asset._id ? null : asset._id); setExpenseFor(null); setFundingFor(null); }}>Record income</button>}
                {canManage && asset.operations_ref?.business_id && <button type="button" className={actionClass} onClick={() => beginDistribution(asset._id)}>Distribute profit</button>}
                {canManage && asset.operations_ref?.business_id && <button type="button" className={actionClass} onClick={() => { setFundingFor(fundingFor === asset._id ? null : asset._id); setExpenseFor(null); setIncomeFor(null); }}>Allocate business capital</button>}
              </>}
            </div>
          </div>

          {distributionAsset === asset._id && (
            <form className="mt-4 space-y-3 border-t border-slate-200 pt-3 dark:border-obsidian-border" onSubmit={submitDistribution}>
              <h4 className="text-sm font-semibold">Proposed profit shares</h4>
              <p className="text-xs text-slate-500">Each active member must accept. M-Pesa payments are sent directly; wallet credits can be withdrawn later by each member.</p>
              <label className="grid max-w-xs gap-1 text-xs text-slate-500">Scheduled release<input className={inputClass} type="datetime-local" required value={distributionForm.scheduledAt} onChange={(event) => setDistributionForm((v) => ({ ...v, scheduledAt: event.target.value }))} /></label>
              <div className="divide-y divide-slate-100 dark:divide-obsidian-border">
                {distributionMembers.map((member) => (
                  <div key={member._id} className="grid grid-cols-1 items-center gap-2 py-2 sm:grid-cols-[1fr_9rem_9rem_11rem]">
                    <span className="text-xs font-medium">{member.user_id?.name || "Member"}</span>
                    <input className={inputClass} type="number" min="0.01" step="0.01" required aria-label={`${member.user_id?.name || "Member"} share amount`} placeholder="Amount (KES)" value={distributionForm.recipients[member._id]?.amount || ""} onChange={(event) => setDistributionForm((v) => ({ ...v, recipients: { ...v.recipients, [member._id]: { ...v.recipients[member._id], amount: event.target.value } } }))} />
                    <select className={inputClass} aria-label="Payout destination" value={distributionForm.recipients[member._id]?.method || "wallet"} onChange={(event) => setDistributionForm((v) => ({ ...v, recipients: { ...v.recipients, [member._id]: { ...v.recipients[member._id], method: event.target.value } } }))}>
                      <option value="wallet">Profit wallet</option>
                      <option value="mpesa">M-Pesa</option>
                    </select>
                    {distributionForm.recipients[member._id]?.method === "mpesa" && (
                      <input className={inputClass} aria-label="M-Pesa number" placeholder="2547XXXXXXXX" value={distributionForm.recipients[member._id]?.phone_number || ""} onChange={(event) => setDistributionForm((v) => ({ ...v, recipients: { ...v.recipients, [member._id]: { ...v.recipients[member._id], phone_number: event.target.value } } }))} required />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button className={primaryClass} type="submit" disabled={busy || !distributionMembers.length}>Notify members for acceptance</button>
                <button className={actionClass} type="button" onClick={() => setDistributionAsset(null)}>Cancel</button>
              </div>
            </form>
          )}

          {(expenseFor === asset._id || incomeFor === asset._id || fundingFor === asset._id) && (
            <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(event) => {
              event.preventDefault();
              const payload = { ...transactionForm, amount: Number(transactionForm.amount) };
              const isExpense = expenseFor === asset._id;
              const isFunding = fundingFor === asset._id;
              
              run(async () => {
                if (isFunding) {
                  await chamaAssetsApi.fundBusiness(chamaId, asset._id, { amount: payload.amount, collectionMethod: payload.collectionMethod, externalReference: payload.description });
                } else if (isExpense) {
                  await chamaAssetsApi.recordExpense(chamaId, asset._id, payload);
                } else {
                  await chamaAssetsApi.recordIncome(chamaId, asset._id, payload);
                }
                setTransactionForm({ amount: "", collectionMethod: "cash", description: "" });
                setExpenseFor(null); 
                setIncomeFor(null); 
                setFundingFor(null);
                await loadHistory(asset._id);
              }, isFunding ? "Business capital allocated and recorded in both financial ledgers." : isExpense ? "Expense posted to the ledger." : "Income posted to the ledger.");
            }}>
              <input aria-label="Amount" className={`${inputClass} w-32`} type="number" min="0.01" step="0.01" placeholder="Amount" value={transactionForm.amount} onChange={(event) => setTransactionForm((value) => ({ ...value, amount: event.target.value }))} required />
              <select aria-label="Account" className={inputClass} value={transactionForm.collectionMethod} onChange={(event) => setTransactionForm((value) => ({ ...value, collectionMethod: event.target.value }))}>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="mpesa">M-Pesa clearing</option>
              </select>
              <input aria-label="Description" className={`${inputClass} min-w-40 flex-1`} placeholder="Description" value={transactionForm.description} onChange={(event) => setTransactionForm((value) => ({ ...value, description: event.target.value }))} />
              <button className={primaryClass} type="submit" disabled={busy}>
                {fundingFor === asset._id ? "Allocate capital" : `Post ${expenseFor === asset._id ? "expense" : "income"}`}
              </button>
            </form>
          )}

          {history[asset._id] && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-xs">
                <thead>
                  <tr className="text-slate-500 dark:text-mist-muted">
                    <th className="py-2">Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th className="text-right">Amount</th>
                    <th className="pl-3">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {history[asset._id].map((entry) => (
                    <React.Fragment key={entry._id}>
                      <tr className="border-t border-slate-100 dark:border-obsidian-border">
                        <td className="py-2">{new Date(entry.occurred_at).toLocaleDateString()}</td>
                        <td className="capitalize">{entry.type}</td>
                        <td>{entry.description || "—"}</td>
                        <td className="text-right tabular-nums">{KES(entry.amount)}</td>
                        <td className="pl-3">
                          {entry.flag_status === "flagged" ? <span className="font-semibold text-amber-700 dark:text-amber-400">Under review</span>
                            : entry.flag_status === "confirmed" ? <span className="font-semibold text-rose-700 dark:text-rose-300">Discrepancy confirmed</span>
                            : entry.flag_status === "dismissed" ? <span className="text-slate-500 dark:text-mist-muted">Reviewed — no issue</span>
                            : ["income", "expense"].includes(entry.type) ? (
                              <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-rose-700 dark:text-mist-muted dark:hover:text-rose-300" onClick={() => { setFlagFor(flagFor?.transactionId === entry._id ? null : { assetId: asset._id, transactionId: entry._id }); setFlagReason(""); }}>
                                <Flag size={12} /> Flag
                              </button>
                            ) : null}
                        </td>
                      </tr>
                      {flagFor?.transactionId === entry._id && (
                        <tr>
                          <td colSpan={5} className="pb-3">
                            <form className="flex flex-wrap items-end gap-2" onSubmit={submitFlag}>
                              <label className="grid min-w-56 flex-1 gap-1 text-xs text-slate-500 dark:text-mist-muted">What looks wrong with this entry?
                                <input className={inputClass} value={flagReason} maxLength={500} onChange={(event) => setFlagReason(event.target.value)} placeholder="e.g. I was told the rent that month was KES 15,000, not 9,000" required autoFocus />
                              </label>
                              <button className={primaryClass} type="submit" disabled={busy || !flagReason.trim()}>Send to leadership</button>
                              <button className={actionClass} type="button" onClick={() => setFlagFor(null)}>Cancel</button>
                            </form>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {asset.status === "active" && (
            <AssetProgressDashboard
              chamaId={chamaId}
              assetId={asset._id}
              canRecordValuation={canManage}
              notify={(message, isError) => (isError ? setError(message) : setNotice(message))}
            />
          )}

          {asset.status === "active" && (
            <AssetManagerReportsSection
              chamaId={chamaId}
              assetId={asset._id}
              currentUserId={currentUserId}
              isLeader={canApprove}
              canConfigure={canManage}
              notify={(message, isError) => (isError ? setError(message) : setNotice(message))}
            />
          )}

          {asset.status === "active" && (
            <AssetLeaseSection
              chamaId={chamaId}
              assetId={asset._id}
              canManage={canManage}
              notify={(message, isError) => (isError ? setError(message) : setNotice(message))}
            />
          )}

          {asset.status === "active" && (
            <AssetComplianceSection
              chamaId={chamaId}
              assetId={asset._id}
              canManage={canManage}
              notify={(message, isError) => (isError ? setError(message) : setNotice(message))}
            />
          )}
        </div>
      ))}

      {distributions.length > 0 && (
        <section className="border-t border-slate-200 pt-4 dark:border-obsidian-border">
          <h3 className="text-sm font-semibold">Profit distributions</h3>
          <div className="mt-2 divide-y divide-slate-100 dark:divide-obsidian-border">
            {distributions.map((distribution) => { 
              const mine = distribution.recipients?.find((recipient) => String(recipient.member_id?._id || recipient.member_id) === String(currentUserId) || String(recipient.member_id?.user_id?._id || "") === String(currentUserId)); 
              return (
                <div key={distribution._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-xs font-semibold">{distribution.asset_id?.name || "Business profit"} · KES {Number(distribution.total_amount || 0).toLocaleString("en-KE")}</p>
                    <p className="text-xs text-slate-500">{String(distribution.status).replaceAll("_", " ")} · Scheduled {new Date(distribution.scheduled_at).toLocaleString()}</p>
                  </div>
                  {mine?.response === "pending" && (
                    <div className="flex gap-2">
                      <button className={primaryClass} disabled={busy} onClick={() => run(() => chamaAssetsApi.respondDistribution(chamaId, distribution._id, "accepted"), "Your acceptance has been recorded.")}>Accept</button>
                      <button className={actionClass} disabled={busy} onClick={() => run(() => chamaAssetsApi.respondDistribution(chamaId, distribution._id, "rejected"), "You rejected this distribution.")}>Reject</button>
                    </div>
                  )}
                </div>
              ); 
            })}
          </div>
        </section>
      )}

      {showInvestments && (
        <div className="border-t border-slate-200 pt-4 dark:border-obsidian-border">
          <h3 className="text-sm font-semibold">Investment proposals</h3>
          {proposals.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-mist-muted">No investment proposals yet.</p>
          ) : (
            <div className="mt-2 divide-y divide-slate-100 dark:divide-obsidian-border">
              {proposals.map((proposal) => {
                const approval = proposal.approval_request_id;
                const signed = approval?.approvals?.filter((item) => item.status === "approved").length || 0;
                const isProposer = String(proposal.proposed_by) === String(currentUserId);
                return (
                  <div key={proposal._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium">{proposal.title}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-mist-muted">{KES(proposal.proposal?.purchase_price)} · {proposal.status.replaceAll("_", " ")}{proposal.status === "under_review" ? ` · ${signed}/${approval?.required_approvals || "?"} approvals` : ""}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {proposal.status === "under_review" && canApprove && !isProposer && <>
                        <button type="button" className={primaryClass} disabled={busy} onClick={() => run(() => chamaAssetsApi.decideProposal(chamaId, proposal._id, "approved"), "Approval recorded.")}><Check size={14} />Approve</button>
                        <button type="button" className={actionClass} disabled={busy} onClick={() => run(() => chamaAssetsApi.decideProposal(chamaId, proposal._id, "rejected", "Rejected by chama approver."), "Proposal rejected.")}><X size={14} />Reject</button>
                      </>}
                      {proposal.status === "approved" && canManage && (
                        <button type="button" className={primaryClass} onClick={() => setAcquisitionFor(acquisitionFor === proposal._id ? null : proposal._id)}>Record acquisition</button>
                      )}
                    </div>
                    {acquisitionFor === proposal._id && (
                      <form className="basis-full flex flex-wrap items-end gap-2" onSubmit={(event) => { 
                        event.preventDefault(); 
                        run(() => chamaAssetsApi.completeAcquisition(chamaId, proposal._id, acquisitionForm), "Acquisition posted and asset activated.").then((succeeded) => { if (succeeded) setAcquisitionFor(null); }); 
                      }}>
                        <select aria-label="Paid from" className={inputClass} value={acquisitionForm.collectionMethod} onChange={(event) => setAcquisitionForm((value) => ({ ...value, collectionMethod: event.target.value }))}>
                          <option value="bank">Bank</option>
                          <option value="cash">Cash</option>
                          <option value="mpesa">M-Pesa</option>
                        </select>
                        <input aria-label="Settlement reference" className={`${inputClass} min-w-52 flex-1`} placeholder="Settlement reference" value={acquisitionForm.settlementReference} onChange={(event) => setAcquisitionForm((value) => ({ ...value, settlementReference: event.target.value }))} required />
                        <button type="submit" className={primaryClass} disabled={busy}>Confirm settlement</button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-obsidian-border">
        {showInvestments && <button type="button" className={actionClass} onClick={() => { setShowProposalForm((value) => !value); setShowRegistrationForm(false); }}><Plus size={14} />Propose investment</button>}
        {showAssets && canManage && <button type="button" className={actionClass} onClick={() => { setShowRegistrationForm((value) => !value); setShowProposalForm(false); }}><Plus size={14} />Register existing asset</button>}
      </div>

      {showAssets && canManage && showBusinessRequestForm && (
        <form className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 dark:border-obsidian-border" onSubmit={submitBusinessWorkspaceRequest}>
          <input className={inputClass} placeholder="Business name" value={businessRequestForm.name} onChange={(event) => setBusinessRequestForm((form) => ({ ...form, name: event.target.value }))} required />
          <select className={inputClass} aria-label="Business category" value={businessRequestForm.category} onChange={(event) => setBusinessRequestForm((form) => ({ ...form, category: event.target.value }))}>
            <option value="retail">Retail</option>
            <option value="rental">Rental</option>
            <option value="restaurant">Restaurant</option>
            <option value="service">Service</option>
            <option value="other">Other</option>
          </select>
          <input className={inputClass} placeholder="Location" value={businessRequestForm.location} onChange={(event) => setBusinessRequestForm((form) => ({ ...form, location: event.target.value }))} />
          <input className={inputClass} type="number" min="0" step="0.01" placeholder="Initial capital requested (KES)" value={businessRequestForm.requestedCapital} onChange={(event) => setBusinessRequestForm((form) => ({ ...form, requestedCapital: event.target.value }))} />
          <textarea className={`${inputClass} sm:col-span-2`} rows={2} placeholder="Business description" value={businessRequestForm.description} onChange={(event) => setBusinessRequestForm((form) => ({ ...form, description: event.target.value }))} />
          <button className={`${primaryClass} sm:col-span-2 sm:justify-self-start`} type="submit" disabled={busy}>Send to Platform Admin</button>
        </form>
      )}

      {showInvestments && showProposalForm && (
        <form className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 dark:border-obsidian-border" onSubmit={submitProposal}>
          <input className={inputClass} placeholder="Investment name" value={proposalForm.title} onChange={(event) => setProposalForm((form) => ({ ...form, title: event.target.value }))} required />
          <select className={inputClass} aria-label="Asset type" value={proposalForm.asset_type} onChange={(event) => setProposalForm((form) => ({ ...form, asset_type: event.target.value }))}>
            <option value="property">Property</option>
            <option value="business">Business</option>
            <option value="vehicle">Vehicle</option>
            <option value="equipment">Equipment</option>
            <option value="investment">Investment</option>
            <option value="other">Other</option>
          </select>
          <input className={inputClass} type="number" min="0.01" step="0.01" placeholder="Purchase price (KES)" value={proposalForm.purchase_price} onChange={(event) => setProposalForm((form) => ({ ...form, purchase_price: event.target.value }))} required />
          <input className={inputClass} type="number" min="0" step="0.01" placeholder="Acquisition costs (KES)" value={proposalForm.acquisition_costs} onChange={(event) => setProposalForm((form) => ({ ...form, acquisition_costs: event.target.value }))} />
          <input className={inputClass} type="number" min="0" step="0.01" placeholder="Expected monthly income (KES)" value={proposalForm.expected_monthly_income} onChange={(event) => setProposalForm((form) => ({ ...form, expected_monthly_income: event.target.value }))} />
          <select className={inputClass} aria-label="Funding source" value={proposalForm.funding_source} onChange={(event) => setProposalForm((form) => ({ ...form, funding_source: event.target.value }))}>
            <option value="chama_funds">Chama funds</option>
            <option value="loan">Loan</option>
            <option value="mixed">Mixed</option>
            <option value="external">External</option>
          </select>
          <textarea className={`${inputClass} sm:col-span-2`} placeholder="Risk notes" value={proposalForm.risk_notes} onChange={(event) => setProposalForm((form) => ({ ...form, risk_notes: event.target.value }))} rows={2} />
          <button type="submit" className={`${primaryClass} sm:col-span-2 sm:justify-self-start`} disabled={busy}>Submit proposal</button>
        </form>
      )}

      {showAssets && showRegistrationForm && (
        <form className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 dark:border-obsidian-border" onSubmit={submitRegistration}>
          <input className={inputClass} placeholder="Asset name" value={registrationForm.name} onChange={(event) => setRegistrationForm((form) => ({ ...form, name: event.target.value }))} required />
          <select className={inputClass} aria-label="Asset type" value={registrationForm.asset_type} onChange={(event) => setRegistrationForm((form) => ({ ...form, asset_type: event.target.value }))}>
            <option value="property">Property</option>
            <option value="business">Business</option>
            <option value="vehicle">Vehicle</option>
            <option value="equipment">Equipment</option>
            <option value="investment">Investment</option>
            <option value="other">Other</option>
          </select>
          <input className={inputClass} placeholder="Description" value={registrationForm.description} onChange={(event) => setRegistrationForm((form) => ({ ...form, description: event.target.value }))} />
          <input className={inputClass} placeholder="Manager user ID (optional)" value={registrationForm.manager_id} onChange={(event) => setRegistrationForm((form) => ({ ...form, manager_id: event.target.value }))} />
          <input className={inputClass} type="number" min="0" step="0.01" placeholder="Monthly income estimate (KES)" value={registrationForm.expected_monthly_income} onChange={(event) => setRegistrationForm((form) => ({ ...form, expected_monthly_income: event.target.value }))} />
          <input className={inputClass} type="number" min="0" step="0.01" placeholder="Historical purchase price (KES)" value={registrationForm.purchase_price} onChange={(event) => setRegistrationForm((form) => ({ ...form, purchase_price: event.target.value }))} />
          <select className={inputClass} aria-label="Document type" value={registrationForm.document_type} onChange={(event) => setRegistrationForm((form) => ({ ...form, document_type: event.target.value }))}>
            <option value="title_deed">Title deed</option>
            <option value="sale_agreement">Sale agreement</option>
            <option value="valuation">Valuation</option>
            <option value="lease">Lease</option>
            <option value="invoice">Invoice</option>
            <option value="other">Other</option>
          </select>
          <input className={inputClass} type="url" placeholder="Document URL (optional)" value={registrationForm.file_url} onChange={(event) => setRegistrationForm((form) => ({ ...form, file_url: event.target.value }))} />
          <button type="submit" className={`${primaryClass} sm:col-span-2 sm:justify-self-start`} disabled={busy}>Submit asset</button>
        </form>
      )}
    </div>
  );
}