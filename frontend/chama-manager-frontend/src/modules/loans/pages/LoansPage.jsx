import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import loanService from '../services/loan.service';
import LoanMetricCard from '../components/LoanMetricCard';
import LoanApplicationForm from '../components/LoanApplicationForm';
import LoanList from '../components/LoanList';
import GuarantorInbox from '../components/GuarantorInbox';
import LoanDetailsPanel from '../components/LoanDetailsPanel';
import LoanPortfolio from '../components/LoanPortfolio';

const money = (value) => `KES ${Number(value || 0).toLocaleString()}`;
const errorText = (error) => error?.response?.data?.message || error?.message || 'We could not complete that action.';

export default function LoansPage() {
  const { workspaceId: chamaId } = useParams();
  const [summary, setSummary] = useState(null);
  const [loans, setLoans] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [payments, setPayments] = useState([]);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!chamaId) return;
    setLoading(true);
    try {
      const dashboard = await loanService.getDashboard(chamaId);
      setSummary(dashboard.summary); setLoans(dashboard.loans); setPortfolio(dashboard.portfolio);
    } catch (error) { setNotice({ type: 'error', text: errorText(error) }); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, [chamaId]);

  const run = async (work, success) => {
    setBusy(true); setNotice(null);
    try { await work(); setNotice({ type: 'success', text: success }); await refresh(); }
    catch (error) { setNotice({ type: 'error', text: errorText(error) }); }
    finally { setBusy(false); }
  };
  const selectLoan = async (loan) => {
    setSelectedLoan(loan); setPayments([]);
    try { setPayments((await loanService.getRepayments(chamaId, loan._id || loan.id)) || []); } catch { /* the schedule remains useful without payment history */ }
  };
  const pay = () => {
    const amount = window.prompt('How much would you like to repay (KES)?');
    const phoneNumber = window.prompt('Enter the M-Pesa number to receive the prompt.');
    if (!amount || !phoneNumber) return;
    run(() => loanService.startMpesaRepayment(chamaId, selectedLoan._id || selectedLoan.id, { amount: Number(amount), phone_number: phoneNumber }), 'M-Pesa prompt sent. Your balance will update after payment confirmation.');
  };
  if (loading) return <div className="rounded-2xl border bg-white p-8 text-sm text-slate-500 dark:bg-slate-900">Loading your loan workspace…</div>;

  const nextPayment = summary?.active_loan?.next_payment;
  return <div className="mx-auto max-w-7xl space-y-6 pb-8">
    <header className="rounded-3xl bg-gradient-to-br from-emerald-700 to-teal-800 px-6 py-7 text-white shadow-lg"><p className="text-sm font-semibold text-emerald-100">CHAMA CREDIT</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">Your loans, clearly managed.</h1><p className="mt-2 max-w-2xl text-sm text-emerald-50">Borrow responsibly, track every installment, and respond to guarantee requests in one secure workspace.</p></div>{summary?.active_loan&&<div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur"><p className="text-xs text-emerald-100">Current loan</p><p className="font-bold">{summary.active_loan.reference || money(summary.active_loan.amount)}</p></div>}</div></header>
    {notice&&<div className={`rounded-xl border px-4 py-3 text-sm ${notice.type==='error'?'border-red-200 bg-red-50 text-red-800':'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{notice.text}</div>}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><LoanMetricCard label="Borrowing limit" value={money(summary?.loan_limit)} hint={`${summary?.loan_multiplier || 0}× your savings`} /><LoanMetricCard label="Available to borrow" value={money(summary?.available_borrowing_capacity)} hint="After current exposure" /><LoanMetricCard label="Your savings" value={money(summary?.savings_balance)} /><LoanMetricCard label="Outstanding" value={money(summary?.outstanding_total)} accent="sky" /><LoanMetricCard label="Next installment" value={money(nextPayment?.amount)} hint={nextPayment?.due_date ? new Date(nextPayment.due_date).toLocaleDateString() : 'No payment due'} accent="amber" /></section>
    <div className="grid gap-6 xl:grid-cols-5"><div className="xl:col-span-2"><LoanApplicationForm canApply={summary?.can_apply} busy={busy} onSubmit={(payload)=>run(()=>loanService.apply(chamaId,payload),'Application submitted. We will show its eligibility outcome here.')} /></div><div className="xl:col-span-3"><LoanList loans={loans} onSelect={selectLoan} /></div></div>
    <GuarantorInbox requests={summary?.pending_guarantee_requests} busy={busy} onRespond={(loanId,decision)=>run(()=>loanService.respondToGuarantee(chamaId,loanId,decision),`Guarantee ${decision}.`)} />
    <LoanPortfolio portfolio={portfolio} busy={busy} onDecision={(loanId,decision)=>run(()=>loanService.decide(chamaId,loanId,decision,'Reviewed in ChamaManager'),`Loan ${decision}.`)} onDisburse={(loanId)=>run(()=>loanService.initiateDisbursement(chamaId,loanId),'Disbursement initiated. It will become active after settlement confirmation.')} />
    <LoanDetailsPanel loan={selectedLoan} payments={payments} paying={busy} onClose={()=>setSelectedLoan(null)} onPay={pay} />
  </div>;
}
