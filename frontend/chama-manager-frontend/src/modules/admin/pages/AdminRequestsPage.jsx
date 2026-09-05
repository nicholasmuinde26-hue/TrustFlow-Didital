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

const emptyPerson = () => ({ fullName: "", phone: "", email: "", idNumber: "" });

// Build the editable form state straight from the request the user already
// submitted, so the admin never has to retype what's already there — they
// only touch the fields they want to correct or add.
function buildFormFromRequest(req) {
  return {
    name: req.name || "",
    category: req.category || "standard",
    monthlySavings: req.monthlySavings ?? 1000,
    description: req.description || "",
    chairperson: { ...emptyPerson(), ...(req.chairperson || {}) },
    treasurer: { ...emptyPerson(), ...(req.treasurer || {}) },
    secretary: { ...emptyPerson(), ...(req.secretary || {}) },
    committeeMembers: (req.committeeMembers || []).map((cm) => ({ ...emptyPerson(), role: "Committee Member", ...cm })),
    adminNotes: req.adminNotes || "",
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

  return (
    <div className="space-y-6">
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
                    <Field label="Category">
                      <input
                        className="input"
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      />
                    </Field>
                    <Field label="Monthly Savings (KES)">
                      <input
                        type="number"
                        className="input"
                        value={form.monthlySavings}
                        onChange={(e) => setForm((f) => ({ ...f, monthlySavings: e.target.value }))}
                      />
                    </Field>
                  </div>
                  <Field label="Description / Purpose">
                    <textarea
                      className="input min-h-[70px]"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </Field>

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

                  <Field label="Admin notes (internal)">
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/40">
                    <div>
                      <span className="text-slate-400 block">Type</span>
                      <span className="font-bold uppercase text-slate-900 dark:text-white">
                        {selectedRequest.entityType}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Category</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {form.category}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Monthly Savings</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        KES {Number(form.monthlySavings || 1000).toLocaleString()}
                      </span>
                    </div>
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
