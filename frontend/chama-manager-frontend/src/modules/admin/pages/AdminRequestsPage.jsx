import { useState, useEffect } from "react";
import {
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import adminService from "../services/admin.service";
import Spinner from "@/shared/components/ui/Spinner";
import { WorkspaceSetupPicker } from '@/modules/workspaces/index.js';
import AdminModuleChangesPanel from "../components/AdminModuleChangesPanel";

function GivingSafetyPanel() {
  const [reports, setReports] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async () => { setBusy(true); try { setReports(await adminService.getPublicGivingReports()); setError(""); } catch (e) { setError(e.response?.data?.message || "Could not load reports."); } finally { setBusy(false); } };
  useEffect(() => { load(); }, []);
  const act = async (report, action) => { setBusy(true); try { await adminService.reviewPublicGivingReports(report.contribution_group_id?._id, action); await load(); } catch (e) { setError(e.response?.data?.message || "Review failed."); } finally { setBusy(false); } };
  return <section className="space-y-3 rounded-2xl border border-amber-200 bg-white p-5 dark:border-amber-900 dark:bg-slate-900"><div className="flex justify-between"><div><h2 className="font-black">Public giving safety</h2><p className="text-xs text-slate-500">Open reports and paused fundraisers</p></div><button className="rounded-lg border px-3 py-1 text-xs" onClick={load}>Refresh</button></div>{error && <p className="text-xs text-red-600">{error}</p>}{busy && <p className="text-xs text-slate-500">Updating…</p>}{!busy && reports.length === 0 && <p className="text-xs text-slate-500">No open reports.</p>}{reports.map((report) => <article key={report._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><strong>{report.contribution_group_id?.name || "Removed fundraiser"}</strong><p className="text-xs">{report.category.replaceAll("_", " ")} · {report.details || "No details"} · {new Date(report.createdAt).toLocaleString()}</p><p className="text-[11px] text-slate-500">Status: {report.contribution_group_id?.status || "unknown"}</p></div><div className="flex gap-2"><button className="rounded-lg border px-2 py-1 text-xs" onClick={() => act(report, "dismiss")}>Dismiss report</button><button className="rounded-lg bg-red-600 px-2 py-1 text-xs text-white" onClick={() => act(report, "suspend")}>Suspend</button>{report.contribution_group_id?.status === "suspended" && <button className="rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white" onClick={() => act(report, "reverify")}>Reverify &amp; reopen</button>}</div></article>)}</section>;
}

const emptyPerson = () => ({ fullName: "", phone: "", email: "", idNumber: "" });

// Build the editable form state straight from the request the user already
// submitted, so the admin never has to retype what's already there — they
// only touch the fields they want to correct or add.
function buildFormFromRequest(req) {
  return {
    name: req.name || "",
    category: req.workspaceConfig?.modules?.includes("burial_welfare") || req.category === "burial" ? "burial" : "standard",
    monthlySavings: req.monthlySavings ?? 1000,
    description: req.description || "",
    chairperson: { ...emptyPerson(), ...(req.chairperson || {}) },
    treasurer: { ...emptyPerson(), ...(req.treasurer || {}) },
    secretary: { ...emptyPerson(), ...(req.secretary || {}) },
    committeeMembers: (req.committeeMembers || []).map((cm) => ({ ...emptyPerson(), role: "Committee Member", ...cm })),
    adminNotes: req.adminNotes || "",
    contributionGroupDetails: {
      type: req.contributionGroupDetails?.type || "other",
      targetAmount: req.contributionGroupDetails?.targetAmount ?? "",
      eventDate: req.contributionGroupDetails?.eventDate ? String(req.contributionGroupDetails.eventDate).slice(0, 10) : "",
      contributionEndDate: req.contributionGroupDetails?.contributionEndDate ? String(req.contributionGroupDetails.contributionEndDate).slice(0, 10) : "",
      beneficiary: req.contributionGroupDetails?.beneficiary || "",
      location: req.contributionGroupDetails?.location || "",
      visibility: req.contributionGroupDetails?.visibility || "invite_only",
      publicGivingRequested: Boolean(req.contributionGroupDetails?.publicGivingRequested),
      evidence: req.contributionGroupDetails?.evidence || [],
      referees: req.contributionGroupDetails?.referees || [],
      nationalIdNumber: req.contributionGroupDetails?.nationalIdNumber || "",
      payout: req.contributionGroupDetails?.payout || {},
    },
    publicGivingEnabled: false,
    // Workspace Setup: what the requester proposed (empty = nothing proposed,
    // the picker then fills in the preset matching the category).
    organizationFamily: req.organizationFamily || "chama",
    organizationType: req.organizationType || "custom",
    workspaceConfig: {
      preset: req.workspaceConfig?.preset || "",
      modules: req.workspaceConfig?.modules || [],
      moduleLabels: req.workspaceConfig?.moduleLabels || {},
      organizationFamily: req.organizationFamily || "chama",
      organizationType: req.organizationType || "custom",
    },
  };
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectPromptId, setRejectPromptId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [alertMsg, setAlertMsg] = useState({ text: "", type: "" });
  // "workspaces" = new workspace requests, "features" = chama module changes.
  const [view, setView] = useState("workspaces");
  const [featureCount, setFeatureCount] = useState(0);

  function refreshFeatureCount() {
    adminService
      .getModuleChangeRequests("pending")
      .then((items) => setFeatureCount(items.length))
      .catch(() => {});
  }
  useEffect(refreshFeatureCount, []);

  async function loadRequests() {
    setLoading(true);
    try {
      const data = await adminService.getWorkspaceRequests(
        filterStatus === "all" ? "" : filterStatus
      );
      setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, [filterStatus]);

  function openRequest(req) {
    setSelectedRequest(req);
    setForm(buildFormFromRequest(req));
    setEditing(false);
  }

  function closeModal() {
    setSelectedRequest(null);
    setForm(null);
    setEditing(false);
  }

  function updatePersonField(role, field, value) {
    setForm((f) => ({ ...f, [role]: { ...f[role], [field]: value } }));
  }

  function updateCommitteeMember(index, field, value) {
    setForm((f) => {
      const next = [...f.committeeMembers];
      next[index] = { ...next[index], [field]: value };
      return { ...f, committeeMembers: next };
    });
  }

  function addCommitteeMember() {
    setForm((f) => ({
      ...f,
      committeeMembers: [...f.committeeMembers, { ...emptyPerson(), role: "Committee Member" }],
    }));
  }

  function removeCommitteeMember(index) {
    setForm((f) => ({
      ...f,
      committeeMembers: f.committeeMembers.filter((_, i) => i !== index),
    }));
  }

  // Approve using whatever is currently in the form — pre-filled from the
  // request, plus any edits/additions the admin just made. One click both
  // saves the corrections and provisions the workspace.
  async function handleApprove(requestId) {
    setActionLoading(true);
    setAlertMsg({ text: "", type: "" });
    try {
      await adminService.approveWorkspaceRequest(requestId, form || {});
      setAlertMsg({
        text: "Workspace created and the requester has been notified they can log in.",
        type: "success",
      });
      closeModal();
      await loadRequests();
    } catch (err) {
      setAlertMsg({
        text: err?.response?.data?.message || "Failed to approve request",
        type: "error",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveEdits(requestId) {
    setActionLoading(true);
    setAlertMsg({ text: "", type: "" });
    try {
      const { data } = await adminService.updateWorkspaceRequest(requestId, form);
      setAlertMsg({ text: "Changes saved.", type: "success" });
      setSelectedRequest(data);
      setEditing(false);
      await loadRequests();
    } catch (err) {
      setAlertMsg({
        text: err?.response?.data?.message || "Failed to save changes",
        type: "error",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(requestId) {
    setActionLoading(true);
    setAlertMsg({ text: "", type: "" });
    try {
      await adminService.rejectWorkspaceRequest(requestId, rejectReason);
      setAlertMsg({
        text: "Request rejected — the requester has been sent the reason.",
        type: "success",
      });
      setRejectPromptId(null);
      setRejectReason("");
      closeModal();
      await loadRequests();
    } catch (err) {
      setAlertMsg({
        text: err?.response?.data?.message || "Failed to reject request",
        type: "error",
      });
    } finally {
      setActionLoading(false);
    }
  }

  if (view === "features") {
    return (
      <div className="space-y-6">
      <div className="flex w-fit items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {[
          { key: "workspaces", label: "New workspaces" },
          { key: "features", label: "Feature changes", count: featureCount },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-bold transition ${
              view === tab.key
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

        <AdminModuleChangesPanel onChanged={refreshFeatureCount} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex w-fit items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {[
          { key: "workspaces", label: "New workspaces" },
          { key: "features", label: "Feature changes", count: featureCount },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-bold transition ${
              view === tab.key
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <GivingSafetyPanel />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Workspace Creation Requests
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Review submitted Chama, Business, and Contribution Group workspaces with leadership contacts
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {["pending", "approved", "rejected", "all"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition ${
                filterStatus === status
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {alertMsg.text && (
        <div
          className={`rounded-2xl p-4 text-xs font-semibold ${
            alertMsg.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              : "border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
          }`}
        >
          {alertMsg.text}
        </div>
      )}

      {/* Requests List */}
      {loading ? (
        <Spinner />
      ) : requests.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Clock className="mx-auto mb-3 text-slate-400" size={32} />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No {filterStatus !== "all" ? filterStatus : ""} requests found
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            When users register and request workspaces, they will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => {
            const status = String(req.status || "").toUpperCase();
            const isPending = status === "PENDING" || status === "UNDER_REVIEW";
            const isApproved = status === "APPROVED";

            return (
              <div
                key={req._id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-violet-200 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {req.requestNumber || "REQ-000000"}
                      </span>
                      <span className="text-lg font-black text-slate-900 dark:text-white">
                        {req.name}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          req.entityType === "chama"
                            ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                            : req.entityType === "business"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        {req.entityType}
                      </span>
                      {req.entityType === "business" && req.ownerType === "chama" && (
                        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                          Chama-owned{req.chamaId?.name ? ` · ${req.chamaId.name}` : ""}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          isPending
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : isApproved
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      {req.details?.county && (
                        <span className="font-semibold text-violet-600 dark:text-violet-400">
                          {req.details.county} {req.details.location ? `• ${req.details.location}` : ""}
                        </span>
                      )}
                      <span>
                        Chairperson:{" "}
                        <strong className="text-slate-800 dark:text-slate-200">
                          {req.chairperson?.fullName || "N/A"}
                        </strong>{" "}
                        ({req.chairperson?.phone || req.chairperson?.email || "No contact"})
                      </span>
                      {req.treasurer?.fullName && (
                        <span>
                          Treasurer:{" "}
                          <strong className="text-slate-800 dark:text-slate-200">
                            {req.treasurer.fullName}
                          </strong>
                        </span>
                      )}
                      {req.secretary?.fullName && (
                        <span>
                          Secretary:{" "}
                          <strong className="text-slate-800 dark:text-slate-200">
                            {req.secretary.fullName}
                          </strong>
                        </span>
                      )}
                      <span>
                        Committee:{" "}
                        <strong className="text-slate-800 dark:text-slate-200">
                          {req.committeeMembers?.length || 0} members
                        </strong>
                      </span>
                    </div>

                    {req.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                        {req.description}
                      </p>
                    )}

                    {status === "REJECTED" && req.rejectionReason && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        Rejection reason sent to requester: {req.rejectionReason}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openRequest(req)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <Eye size={15} />
                      Review
                    </button>

                    {isPending && (
                      <>
                        <button
                          onClick={() => handleApprove(req._id)}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle2 size={15} />
                          Approve & Create
                        </button>
                        <button
                          onClick={() => setRejectPromptId(req._id)}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                        >
                          <XCircle size={15} />
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Reject Reason input if selected */}
                {rejectPromptId === req._id && (
                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Reason for rejection (this is sent to the requester):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="e.g. Incomplete committee contacts..."
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:border-red-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <button
                        onClick={() => handleReject(req._id)}
                        disabled={actionLoading || !rejectReason.trim()}
                        className="rounded-xl bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Confirm Rejection
                      </button>
                      <button
                        onClick={() => setRejectPromptId(null)}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Full Details / Review & Edit Modal */}
      {selectedRequest && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="relative my-8 w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {selectedRequest.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Workspace Creation Request • Status:{" "}
                    <span className="font-bold uppercase">{selectedRequest.status}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {String(selectedRequest.status).toUpperCase() !== "APPROVED" &&
                  String(selectedRequest.status).toUpperCase() !== "REJECTED" && (
                    <button
                      onClick={() => setEditing((e) => !e)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                        editing
                          ? "bg-violet-600 text-white"
                          : "border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <Pencil size={14} />
                      {editing ? "Editing" : "Edit details"}
                    </button>
                  )}
                <button
                  onClick={closeModal}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6 text-xs">
              {editing ? (
                <>
                  {/* Editable overview */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Name">
                      <input
                        className="input"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </Field>
                    <Field label={selectedRequest.entityType === "chama" ? "Chama type" : selectedRequest.entityType === "contribution_group" ? "Contribution group category" : "Category"}>
                      {selectedRequest.entityType === "chama" ? (
                        <select
                          className="input"
                          value={form.category === "burial" ? "burial" : "standard"}
                          onChange={(event) => setForm((f) => ({
                            ...f,
                            category: event.target.value,
                            workspaceConfig: { ...f.workspaceConfig, preset: "", modules: [] },
                          }))}
                        >
                          <option value="standard">Standard Chama</option>
                          <option value="burial">Burial &amp; welfare Chama</option>
                        </select>
                      ) : selectedRequest.entityType === "contribution_group" ? (
                        <select className="input capitalize" value={form.contributionGroupDetails.type} onChange={(e) => setForm((f) => ({ ...f, contributionGroupDetails: { ...f.contributionGroupDetails, type: e.target.value } }))}>
                          {["party", "wedding", "graduation", "funeral", "birthday", "emergency", "medical_emergency", "fundraiser", "community", "other"].map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
                        </select>
                      ) : (
                        <input
                          className="input"
                          value={form.category}
                          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                        />
                      )}
                    </Field>
                    {selectedRequest.entityType === "chama" && <Field label="Monthly Savings (KES)">
                      <input
                        type="number"
                        className="input"
                        value={form.monthlySavings}
                        onChange={(e) => setForm((f) => ({ ...f, monthlySavings: e.target.value }))}
                      />
                    </Field>}
                  </div>
                  <Field label="Description / Purpose">
                    <textarea
                      className="input min-h-[70px]"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </Field>

                  {selectedRequest.entityType === "contribution_group" && <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                    <Field label="Fundraising goal (KES)"><input type="number" min="0" className="input" value={form.contributionGroupDetails.targetAmount} onChange={(e) => setForm((f) => ({ ...f, contributionGroupDetails: { ...f.contributionGroupDetails, targetAmount: e.target.value } }))} /></Field>
                    <Field label="Visibility"><select className="input" value={form.contributionGroupDetails.visibility} onChange={(e) => setForm((f) => ({ ...f, contributionGroupDetails: { ...f.contributionGroupDetails, visibility: e.target.value } }))}><option value="private">Private</option><option value="invite_only">Invite only</option><option value="public">Public</option></select></Field>
                    <Field label="Beneficiary"><input className="input" value={form.contributionGroupDetails.beneficiary} onChange={(e) => setForm((f) => ({ ...f, contributionGroupDetails: { ...f.contributionGroupDetails, beneficiary: e.target.value } }))} /></Field>
                    <Field label="Location"><input className="input" value={form.contributionGroupDetails.location} onChange={(e) => setForm((f) => ({ ...f, contributionGroupDetails: { ...f.contributionGroupDetails, location: e.target.value } }))} /></Field>
                    <Field label="Event date"><input type="date" className="input" value={form.contributionGroupDetails.eventDate} onChange={(e) => setForm((f) => ({ ...f, contributionGroupDetails: { ...f.contributionGroupDetails, eventDate: e.target.value } }))} /></Field>
                    <Field label="Contribution close date"><input type="date" className="input" value={form.contributionGroupDetails.contributionEndDate} onChange={(e) => setForm((f) => ({ ...f, contributionGroupDetails: { ...f.contributionGroupDetails, contributionEndDate: e.target.value } }))} /></Field>
                    {form.contributionGroupDetails.publicGivingRequested && <label className="sm:col-span-2 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[11px] font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><input type="checkbox" checked={form.publicGivingEnabled} onChange={(e) => setForm((f) => ({ ...f, publicGivingEnabled: e.target.checked }))} className="mt-0.5" />Enable public giving only after strict evidence, referee, identity, and payout verification has been completed.</label>}
                  </div>}

                  {/* Editable leadership */}
                  <div className="space-y-3">
                    <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Governance & Executive Contacts
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <PersonEditor
                        label="Chairperson"
                        color="violet"
                        person={form.chairperson}
                        onChange={(field, value) => updatePersonField("chairperson", field, value)}
                      />
                      <PersonEditor
                        label="Treasurer"
                        color="blue"
                        person={form.treasurer}
                        onChange={(field, value) => updatePersonField("treasurer", field, value)}
                      />
                      <PersonEditor
                        label="Secretary"
                        color="emerald"
                        person={form.secretary}
                        onChange={(field, value) => updatePersonField("secretary", field, value)}
                      />
                    </div>
                  </div>

                  {/* Editable committee members */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Committee Members ({form.committeeMembers.length})
                      </h4>
                      <button
                        onClick={addCommitteeMember}
                        className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300"
                      >
                        <Plus size={13} /> Add member
                      </button>
                    </div>
                    <div className="space-y-2">
                      {form.committeeMembers.map((cm, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-800"
                        >
                          <input
                            className="input"
                            placeholder="Role"
                            value={cm.role}
                            onChange={(e) => updateCommitteeMember(i, "role", e.target.value)}
                          />
                          <input
                            className="input"
                            placeholder="Full name"
                            value={cm.fullName}
                            onChange={(e) => updateCommitteeMember(i, "fullName", e.target.value)}
                          />
                          <input
                            className="input"
                            placeholder="Phone"
                            value={cm.phone}
                            onChange={(e) => updateCommitteeMember(i, "phone", e.target.value)}
                          />
                          <input
                            className="input"
                            placeholder="Email"
                            value={cm.email}
                            onChange={(e) => updateCommitteeMember(i, "email", e.target.value)}
                          />
                          <button
                            onClick={() => removeCommitteeMember(i)}
                            className="flex items-center justify-center rounded-lg bg-red-50 px-2 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      {form.committeeMembers.length === 0 && (
                        <p className="text-slate-400 italic">No committee members yet — add one above.</p>
                      )}
                    </div>
                  </div>

                  <Field label={selectedRequest.entityType === "contribution_group" ? "Message to requester (save to request more information)" : "Admin notes (internal)"}>
                    <textarea
                      className="input min-h-[50px]"
                      value={form.adminNotes}
                      onChange={(e) => setForm((f) => ({ ...f, adminNotes: e.target.value }))}
                    />
                  </Field>
                </>
              ) : (
                <>
                  {/* Read-only overview */}
                  {selectedRequest.entityType === "business" && selectedRequest.ownerType === "chama" && (
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
                      <p className="font-black">
                        Chama-owned business{selectedRequest.chamaId?.name ? ` for ${selectedRequest.chamaId.name}` : ""}
                      </p>
                      <p className="mt-1">
                        Requested by the chama&apos;s {selectedRequest.requestedByRole || "leadership"}
                        {selectedRequest.requestedBy?.name ? ` (${selectedRequest.requestedBy.name})` : ""}. On approval the
                        chama becomes the owner and the business is registered in its portfolio. The requester does not own
                        it. Requested starting capital: KES {Number(selectedRequest.requestedCapital || 0).toLocaleString()}
                        (not transferred automatically).
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/40">
                    <div>
                      <span className="text-slate-400 block">Type</span>
                      <span className="font-bold uppercase text-slate-900 dark:text-white">
                        {selectedRequest.entityType}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{selectedRequest.entityType === "chama" ? "Chama type" : "Category"}</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedRequest.entityType === "chama" ? (form.category === "burial" ? "Burial & welfare" : "Standard") : selectedRequest.entityType === "contribution_group" ? form.contributionGroupDetails.type.replaceAll("_", " ") : form.category}
                      </span>
                    </div>
                    {selectedRequest.entityType === "chama" && <div>
                      <span className="text-slate-400 block">Monthly Savings</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        KES {Number(form.monthlySavings || 1000).toLocaleString()}
                      </span>
                    </div>}
                    <div>
                      <span className="text-slate-400 block">Submitted</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {new Date(selectedRequest.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {form.description && (
                    <div>
                      <h4 className="font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Description / Purpose
                      </h4>
                      <p className="rounded-xl bg-slate-50 p-3 text-slate-800 dark:bg-slate-800/40 dark:text-slate-200">
                        {form.description}
                      </p>
                    </div>
                  )}

                  {selectedRequest.entityType === "contribution_group" && <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                    <div><h4 className="font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">Fundraiser verification materials</h4><p className="mt-1 text-[11px] text-amber-800 dark:text-amber-300">Sensitive details submitted by the organizer. Confirm identity and destination before approval.</p></div>
                    <div className="grid gap-3 sm:grid-cols-2 text-slate-700 dark:text-slate-200"><div><span className="block text-slate-400">Organizer ID number</span><strong>{form.contributionGroupDetails.nationalIdNumber || "Not supplied"}</strong></div><div><span className="block text-slate-400">Payout destination</span><strong>{form.contributionGroupDetails.payout?.method || "Not supplied"} · {form.contributionGroupDetails.payout?.accountName || ""} {form.contributionGroupDetails.payout?.phone || form.contributionGroupDetails.payout?.paybill || ""}</strong></div></div>
                    <div><span className="block text-slate-400">Evidence links</span>{form.contributionGroupDetails.evidence.length ? <div className="mt-1 flex flex-wrap gap-2">{form.contributionGroupDetails.evidence.map((item, index) => <a key={`${item.url}-${index}`} href={item.url} target="_blank" rel="noreferrer" className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold text-blue-700 underline dark:bg-slate-900 dark:text-blue-300">{item.kind || "Document"} · Open evidence</a>)}</div> : <strong>None attached</strong>}</div>
                    <div><span className="block text-slate-400">Referees</span><div className="mt-1 grid gap-2 sm:grid-cols-2">{form.contributionGroupDetails.referees.map((referee, index) => <div key={`${referee.phone}-${index}`} className="rounded-xl bg-white p-3 dark:bg-slate-900"><strong>{referee.name}</strong><p>{referee.phone} · {referee.relationship || "Relationship not supplied"}</p></div>)}</div></div>
                    {!!selectedRequest.riskFlags?.length && <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><strong>Duplicate risk flags</strong><ul className="mt-1 list-inside list-disc">{selectedRequest.riskFlags.map((flag, index) => <li key={`${flag.code || flag}-${index}`}>{flag.message || flag.code || String(flag)}</li>)}</ul><p className="mt-1 text-[10px]">Resolve these before granting public giving.</p></div>}
                    {form.contributionGroupDetails.publicGivingRequested && <label className="flex items-start gap-2 rounded-xl border border-amber-300 bg-white p-3 text-[11px] font-semibold text-amber-900 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200"><input type="checkbox" checked={form.publicGivingEnabled} onChange={(e) => setForm((f) => ({ ...f, publicGivingEnabled: e.target.checked }))} className="mt-0.5" />Grant public giving after strict review. If unchecked, approval creates a verified members-only contribution group.</label>}
                  </section>}

                  <div className="space-y-3">
                    <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Governance & Executive Contacts
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <PersonView label="Chairperson" color="violet" person={form.chairperson} />
                      <PersonView label="Treasurer" color="blue" person={form.treasurer} />
                      <PersonView label="Secretary" color="emerald" person={form.secretary} />
                    </div>
                  </div>

                  {form.committeeMembers.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Member Committee Contacts ({form.committeeMembers.length})
                      </h4>
                      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800 overflow-hidden">
                        {form.committeeMembers.map((cm, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                          >
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {cm.fullName || `Committee Member #${i + 1}`}
                              </span>
                              <span className="ml-2 text-slate-400">({cm.role || "Member"})</span>
                            </div>
                            <div className="flex items-center gap-4 text-slate-500">
                              {cm.phone && <span>{cm.phone}</span>}
                              {cm.email && <span>{cm.email}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedRequest.applicantNotes && (
                    <div>
                      <h4 className="font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Requester Notes
                      </h4>
                      <p className="rounded-xl bg-slate-50 p-3 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                        {selectedRequest.applicantNotes}
                      </p>
                    </div>
                  )}

                  {selectedRequest.rejectionReason && (
                    <div>
                      <h4 className="font-bold text-red-500 uppercase tracking-wider mb-1">
                        Rejection Reason (sent to requester)
                      </h4>
                      <p className="rounded-xl bg-red-50 p-3 text-red-800 dark:bg-red-950/40 dark:text-red-300">
                        {selectedRequest.rejectionReason}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Workspace Setup - preset picker, then module checklist. Chamas only.
                  Whatever is selected here is what the approved workspace is created with. */}
              {selectedRequest.entityType === "chama" && form?.workspaceConfig && (
                <div className="space-y-2 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <h4 className="font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    Workspace Setup
                  </h4>
                  <WorkspaceSetupPicker
                    value={form.workspaceConfig}
                    onChange={(workspaceConfig) => setForm((f) => ({
                      ...f,
                      category: workspaceConfig.modules.includes("burial_welfare") ? "burial" : "standard",
                      organizationFamily: workspaceConfig.organizationFamily || f.organizationFamily,
                      organizationType: workspaceConfig.organizationType || f.organizationType,
                      workspaceConfig,
                    }))}
                    readOnly={["APPROVED", "REJECTED"].includes(String(selectedRequest.status).toUpperCase())}
                    defaultPreset={form.category === "burial" ? "burial" : "standard"}
                    showOrganization
                    allowRename
                  />
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 p-6 dark:border-slate-800">
              <button
                onClick={closeModal}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                Close
              </button>

              {String(selectedRequest.status).toUpperCase() !== "APPROVED" &&
                String(selectedRequest.status).toUpperCase() !== "REJECTED" && (
                  <>
                    {editing && (
                      <button
                        onClick={() => handleSaveEdits(selectedRequest._id)}
                        disabled={actionLoading}
                        className="rounded-xl border border-violet-200 bg-violet-50 px-5 py-2.5 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300"
                      >
                        Save Changes
                      </button>
                    )}
                    <button
                      onClick={() => setRejectPromptId(selectedRequest._id)}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                    >
                      <XCircle size={16} />
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(selectedRequest._id)}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 size={16} />
                      {editing ? "Save & Approve" : "Approve & Create Workspace Now"}
                    </button>
                  </>
                )}
            </div>

            {rejectPromptId === selectedRequest._id && (
              <div className="border-t border-slate-100 p-6 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for rejection (this is sent to the requester):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Incomplete committee contacts..."
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:border-red-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    onClick={() => handleReject(selectedRequest._id)}
                    disabled={actionLoading || !rejectReason.trim()}
                    className="rounded-xl bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirm Rejection
                  </button>
                  <button
                    onClick={() => setRejectPromptId(null)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shared input styling for the edit form (scoped via className `input`) */}
      <style>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(226 232 240);
          background: rgb(248 250 252);
          padding: 0.5rem 0.75rem;
          font-size: 0.75rem;
          outline: none;
        }
        .input:focus {
          border-color: rgb(124 58 237);
        }
        .dark .input {
          border-color: rgb(51 65 85);
          background: rgb(30 41 59);
          color: white;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block font-bold text-slate-500 dark:text-slate-400">{label}</label>
      {children}
    </div>
  );
}

const colorMap = {
  violet: "border-violet-100 bg-violet-50/50 text-violet-700 dark:border-violet-950 dark:bg-violet-950/20 dark:text-violet-300",
  blue: "border-blue-100 bg-blue-50/50 text-blue-700 dark:border-blue-950 dark:bg-blue-950/20 dark:text-blue-300",
  emerald: "border-emerald-100 bg-emerald-50/50 text-emerald-700 dark:border-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-300",
};

function PersonView({ label, color, person }) {
  return (
    <div className={`rounded-2xl border p-3 ${colorMap[color]}`}>
      <span className="text-[10px] font-black uppercase">{label}</span>
      <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
        {person?.fullName || "N/A"}
      </p>
      <p className="text-slate-600 dark:text-slate-400">{person?.phone || "No phone"}</p>
      {person?.email && <p className="text-slate-500">{person.email}</p>}
    </div>
  );
}

function PersonEditor({ label, color, person, onChange }) {
  return (
    <div className={`space-y-1.5 rounded-2xl border p-3 ${colorMap[color]}`}>
      <span className="text-[10px] font-black uppercase">{label}</span>
      <input
        className="input"
        placeholder="Full name"
        value={person.fullName}
        onChange={(e) => onChange("fullName", e.target.value)}
      />
      <input
        className="input"
        placeholder="Phone"
        value={person.phone}
        onChange={(e) => onChange("phone", e.target.value)}
      />
      <input
        className="input"
        placeholder="Email"
        value={person.email}
        onChange={(e) => onChange("email", e.target.value)}
      />
    </div>
  );
}
