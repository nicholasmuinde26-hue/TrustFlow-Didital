import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import chamaApi from "../api/chama.api";

export default function MemberDashboardPage() {
  const { workspaceId } = useParams(); const [data, setData] = useState(null);
  useEffect(() => { chamaApi.getCommandCenter(workspaceId).then((r) => setData(r.data.data)).catch(() => setData({ error: true })); }, [workspaceId]);
  if (!data) return <div>Loading your member dashboard…</div>;
  if (data.error) return <div>Could not load your member dashboard.</div>;
  const activeLoan = data.loans.find((loan) => ["approved", "disbursed", "disbursement_pending"].includes(loan.status));
  const nextDue = activeLoan?.repayment_schedule?.find((item) => item.status === "pending");
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">My Chama</h1><p className="text-slate-500">Your savings, shares, loan position and next payment.</p></div><div className="grid gap-4 md:grid-cols-4"><Card title="Savings" value="View Finance → Savings"/><Card title="Shares" value="Tracked with your contributions"/><Card title="Loan limit" value={`KES ${Number(activeLoan?.eligibility?.loan_limit || 0).toLocaleString()}`}/><Card title="Next due date" value={nextDue?.due_date ? new Date(nextDue.due_date).toLocaleDateString() : "No repayment due"}/></div><section className="rounded-2xl border bg-white p-5 dark:bg-slate-900"><h2 className="font-bold">Digital member card</h2><p className="mt-2">Role: {data.membership.role} · KYC: {data.kyc?.status || "not submitted"}</p><p className="text-sm text-slate-500">Member ID: {String(data.membership._id).slice(-8).toUpperCase()}</p></section></div>;
}
function Card({ title, value }) { return <div className="rounded-2xl border bg-white p-5 dark:bg-slate-900"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 font-bold">{value}</p></div>; }
