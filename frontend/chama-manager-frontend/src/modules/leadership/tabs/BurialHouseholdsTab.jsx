import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Users, UserRound, Trash2 } from "lucide-react";
import api from "@/app/services/api";
import membersApi from "@/modules/members/api/members.api";
import Dialog from "@/shared/components/ui/Dialog";
import { EmptyState, Notice, SectionCard } from "../components/DeskUI";

const freshForm = () => ({ household_number: "", household_name: "", primary_phone: "", residence: "", primary_member_id: "", member_ids: [], method: "single_primary", split: [] });
const memberId = (member) => String(member.membership_id || member._id || "");
const personName = (member) => [member.first_name || member.user?.first_name, member.last_name || member.user?.last_name].filter(Boolean).join(" ") || member.name || "Member";

export default function BurialHouseholdsTab({ workspaceId, role }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(freshForm);
  const [notice, setNotice] = useState(null);
  const canManage = ["chairperson", "treasurer"].includes(role);
  const householdsQuery = useQuery({
    queryKey: ["burial-households", workspaceId],
    queryFn: async () => (await api.get(`/burial-chama/chama/${workspaceId}/households`)).data?.data,
    enabled: Boolean(workspaceId),
  });
  const membersQuery = useQuery({
    queryKey: ["burial-household-members", workspaceId],
    queryFn: async () => (await membersApi.list("burial-chama", workspaceId)).data?.data?.members || [],
    enabled: Boolean(workspaceId && canManage),
  });
  const members = membersQuery.data || [];
  const memberById = useMemo(() => new Map(members.map((member) => [memberId(member), member])), [members]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["burial-households", workspaceId] });
  const mutation = useMutation({
    mutationFn: async () => {
      const chosen = [...new Set([form.primary_member_id, ...form.member_ids].filter(Boolean))];
      const payload = {
        household_number: form.household_number.trim(), household_name: form.household_name.trim(),
        primary_phone: form.primary_phone.trim(), residence: form.residence.trim(), primary_member_id: form.primary_member_id,
        members: chosen.map((id) => ({ membership_id: id, role_in_household: id === form.primary_member_id ? "head" : "other", is_primary_contributor: id === form.primary_member_id })),
        contribution_config: { method: form.method, primary_contributor_id: form.primary_member_id,
          contribution_split: form.method === "split_members" ? form.split.filter((item) => chosen.includes(item.membership_id)).map((item) => ({ membership_id: item.membership_id, percentage: Number(item.percentage) })) : [] },
      };
      if (editing) return api.patch(`/burial-chama/households/${editing._id}`, payload);
      return api.post(`/burial-chama/chama/${workspaceId}/households`, payload);
    },
    onSuccess: () => { setNotice({ message: editing ? "Household updated." : "Household created." }); setDialogOpen(false); setEditing(null); setForm(freshForm()); refresh(); },
    onError: (error) => setNotice({ message: error.response?.data?.message || "Could not save household.", isError: true }),
  });
  const dissolveMutation = useMutation({
    mutationFn: (household) => api.post(`/burial-chama/households/${household._id}/dissolve`),
    onSuccess: () => { setNotice({ message: "Household dissolved." }); refresh(); },
    onError: (error) => setNotice({ message: error.response?.data?.message || "Could not dissolve household.", isError: true }),
  });

  const openCreate = () => { setEditing(null); setForm(freshForm()); setDialogOpen(true); };
  const openEdit = (household) => {
    const memberIds = (household.members || []).map((item) => String(item.membership_id?._id || item.membership_id));
    setEditing(household);
    setForm({ household_number: household.household_number || "", household_name: household.household_name || "", primary_phone: household.primary_phone || "", residence: household.residence || "", primary_member_id: String(household.primary_member_id?._id || household.primary_member_id || ""), member_ids: memberIds, method: household.contribution_config?.method || "single_primary", split: (household.contribution_config?.contribution_split || []).map((item) => ({ membership_id: String(item.membership_id?._id || item.membership_id), percentage: item.percentage })) });
    setDialogOpen(true);
  };
  const toggleMember = (id) => setForm((current) => ({ ...current, member_ids: current.member_ids.includes(id) ? current.member_ids.filter((item) => item !== id) : [...current.member_ids, id] }));
  const setMember = (id) => setForm((current) => ({ ...current, primary_member_id: id, member_ids: current.member_ids.includes(id) ? current.member_ids : [...current.member_ids, id] }));

  if (householdsQuery.isLoading) return <SectionCard title="Households" description="Loading household records…"><div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" /></SectionCard>;
  if (householdsQuery.data?.membership_model === "individual") return <EmptyState icon={Users} title="Households are not enabled" detail="This chama uses individual membership. Switch to a household or hybrid model in Burial Configuration setup to manage households." />;
  const households = householdsQuery.data?.households || [];
  const label = (id) => { const person = memberById.get(String(id)); return person ? personName(person) : "Chama member"; };

  return <div className="space-y-4">
    {notice && <Notice tone={notice.isError ? "error" : "success"}>{notice.message}</Notice>}
    <SectionCard icon={Users} title="Households" description="Manage household members, heads and contribution arrangements." action={canManage && <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500"><Plus size={15} />Create household</button>}>
      {householdsQuery.isError ? <p className="text-sm text-rose-600">{householdsQuery.error?.response?.data?.message || "Could not load households."}</p> : households.length === 0 ? <EmptyState icon={Users} title="No households yet" detail="Create a household and select its head and members from the active member list." /> : <div className="grid gap-3 md:grid-cols-2">{households.map((household) => {
        const ids = (household.members || []).map((item) => String(item.membership_id?._id || item.membership_id));
        const headId = String(household.primary_member_id?._id || household.primary_member_id);
        return <article key={household._id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{household.household_number}</p><h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">{household.household_name}</h3><p className="mt-1 text-xs text-slate-500">{household.residence}</p></div>{canManage && <div className="flex gap-1"><button type="button" title="Edit household" onClick={() => openEdit(household)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil size={15} /></button><button type="button" title="Dissolve household" onClick={() => { if (window.confirm(`Dissolve ${household.household_name}?`)) dissolveMutation.mutate(household); }} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"><Trash2 size={15} /></button></div>}</div>
          <div className="mt-4 flex flex-wrap gap-2">{ids.map((id) => <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"><UserRound size={12} />{label(id)}{id === headId && <b className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] uppercase text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Head</b>}</span>)}</div>
          <p className="mt-3 text-[11px] capitalize text-slate-500">Contribution: {(household.contribution_config?.method || "single_primary").replace(/_/g, " ")}</p>
        </article>;
      })}</div>}
    </SectionCard>
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? "Edit household" : "Create household"} description="Choose active chama members. A member can belong to one active household." icon={Users} size="lg" footer={<div className="flex justify-end gap-2"><button type="button" onClick={() => setDialogOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold dark:border-slate-700">Cancel</button><button type="button" disabled={mutation.isPending || !form.primary_member_id} onClick={() => mutation.mutate()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{mutation.isPending ? "Saving…" : editing ? "Save changes" : "Create household"}</button></div>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Household number"><input value={form.household_number} onChange={(e) => setForm({ ...form, household_number: e.target.value })} className={inputClass} required /></Field>
        <Field label="Household name"><input value={form.household_name} onChange={(e) => setForm({ ...form, household_name: e.target.value })} className={inputClass} required /></Field>
        <Field label="Primary phone"><input type="tel" value={form.primary_phone} onChange={(e) => setForm({ ...form, primary_phone: e.target.value })} className={inputClass} required /></Field>
        <Field label="Residence"><input value={form.residence} onChange={(e) => setForm({ ...form, residence: e.target.value })} className={inputClass} required /></Field>
        <Field label="Household head"><select value={form.primary_member_id} onChange={(e) => setMember(e.target.value)} className={inputClass}><option value="">Select member</option>{members.map((person) => <option key={memberId(person)} value={memberId(person)}>{personName(person)}</option>)}</select></Field>
        <Field label="Contribution method"><select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={inputClass}><option value="single_primary">Single primary contributor</option><option value="combined">Combined household contribution</option><option value="split_members">Split between members</option></select></Field>
      </div>
      <Field label="Household members"><div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">{members.map((person) => { const id = memberId(person); const checked = form.member_ids.includes(id) || form.primary_member_id === id; return <label key={id} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><input type="checkbox" checked={checked} disabled={form.primary_member_id === id} onChange={() => toggleMember(id)} />{personName(person)}{form.primary_member_id === id && <span className="text-[10px] font-bold uppercase text-emerald-700">Head</span>}</label>; })}</div></Field>
      {form.method === "split_members" && <div className="mt-4 space-y-2"><p className="text-xs font-bold text-slate-700 dark:text-slate-200">Contribution split (must total 100%)</p>{form.member_ids.filter((id) => id !== form.primary_member_id).concat(form.primary_member_id ? [form.primary_member_id] : []).map((id) => <label key={id} className="flex items-center justify-between gap-3 text-sm"><span>{label(id)}</span><input type="number" min="0" max="100" value={form.split.find((item) => item.membership_id === id)?.percentage ?? ""} onChange={(e) => setForm((current) => ({ ...current, split: [...current.split.filter((item) => item.membership_id !== id), { membership_id: id, percentage: e.target.value }] }))} className={`${inputClass} w-24`} placeholder="%" /></label>)}</div>}
      {membersQuery.isLoading && <p className="mt-2 text-xs text-slate-500">Loading members…</p>}
    </Dialog>
  </div>;
}

const inputClass = "mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
function Field({ label, children }) { return <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}{children}</label>; }
