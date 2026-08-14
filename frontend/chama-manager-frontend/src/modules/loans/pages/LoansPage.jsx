import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coins,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  User,
  Sparkles,
  Phone,
  Send,
  MessageSquare,
  Smartphone,
  PlusCircle,
  Calendar,
  X,
} from "lucide-react";
import loanService from "../services/loan.service";
import LoanMetricCard from "../components/LoanMetricCard";
import LoanApplicationForm from "../components/LoanApplicationForm";
import LoanList from "../components/LoanList";
import GuarantorInbox from "../components/GuarantorInbox";
import LoanDetailsPanel from "../components/LoanDetailsPanel";
import LoanPortfolio from "../components/LoanPortfolio";
import CautionModal from "@/shared/components/ui/CautionModal";

const money = (value) => `KES ${Number(value || 0).toLocaleString()}`;
const errorText = (error) =>
  error?.response?.data?.message || error?.message || "Could not complete that action.";

export default function LoansPage() {
  const { workspaceId: chamaId } = useParams();
  const [summary, setSummary] = useState(null);
  const [loans, setLoans] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [payments, setPayments] = useState([]);
  const [notice, setNotice] = useState(null);
  const [whatsappToast, setWhatsappToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("personal"); // 'personal' | 'official'
  const [showApplyWizard, setShowApplyWizard] = useState(false);

  // Caution Modal State
  const [cautionModal, setCautionModal] = useState({
    isOpen: false,
    title: "",
    description: "",
    confirmText: "Proceed",
    type: "warning",
    details: [],
    onConfirm: () => {},
  });

  // Lipa Loan M-Pesa Dialog State
  const [lipaDialog, setLipaDialog] = useState({
    isOpen: false,
    amount: "5000",
    phone: "0712345678",
  });

  const refresh = async () => {
    if (!chamaId) return;
    setLoading(true);
    try {
      const dashboard = await loanService.getDashboard(chamaId);
      setSummary(dashboard.summary);
      setLoans(dashboard.loans);
      setPortfolio(dashboard.portfolio);
    } catch (error) {
      setNotice({ type: "error", text: errorText(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [chamaId]);

  const triggerWhatsappAlert = (text) => {
    setWhatsappToast(text);
    setTimeout(() => setWhatsappToast(null), 5000);
  };

  const runWork = async (work, successMsg, whatsappMsg) => {
    setBusy(true);
    setNotice(null);
    try {
      await work();
      setNotice({ type: "success", text: successMsg });
      if (whatsappMsg) triggerWhatsappAlert(whatsappMsg);
      await refresh();
    } catch (error) {
      setNotice({ type: "error", text: errorText(error) });
    } finally {
      setBusy(false);
      setCautionModal((prev) => ({ ...prev, isOpen: false }));
      setShowApplyWizard(false);
    }
  };

  const openCaution = (config) => {
    setCautionModal({
      isOpen: true,
      title: config.title || "Confirm Action",
      description: config.description || "Are you sure you want to proceed?",
      confirmText: config.confirmText || "Yes, Proceed",
      type: config.type || "warning",
      details: config.details || [],
      onConfirm: () => runWork(config.work, config.successMsg, config.whatsappMsg),
    });
  };

  const selectLoan = async (loan) => {
    setSelectedLoan(loan);
    setPayments([]);
    try {
      const history = await loanService.getRepayments(chamaId, loan._id || loan.id);
      setPayments(history || []);
    } catch {
      /* Schedule remains useful without history */
    }
  };

  const handleLipaLoanSubmit = () => {
    if (!lipaDialog.amount || !lipaDialog.phone) return;
    setLipaDialog((prev) => ({ ...prev, isOpen: false }));
    openCaution({
      title: "Initiate M-Pesa STK Push Repayment",
      description: `Trigger M-Pesa STK payment prompt of KES ${Number(lipaDialog.amount).toLocaleString()} to ${lipaDialog.phone}?`,
      confirmText: "Send STK Push",
      type: "info",
      details: [
        { label: "Amount", value: `KES ${Number(lipaDialog.amount).toLocaleString()}` },
        { label: "M-Pesa Number", value: lipaDialog.phone },
      ],
      work: () =>
        loanService.startMpesaRepayment(chamaId, selectedLoan?._id || loans[0]?._id, {
          amount: Number(lipaDialog.amount),
          phone_number: lipaDialog.phone,
        }),
      successMsg: "M-Pesa payment prompt sent to phone. Balance updates automatically upon confirmation.",
      whatsappMsg: `Repayment of KES ${Number(lipaDialog.amount).toLocaleString()} initiated via M-Pesa STK push.`,
    });
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm font-sans">
        <div className="flex items-center gap-3 text-slate-500 font-medium">
          <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
          <span>Loading Chama Credit & Loan Workspace...</span>
        </div>
      </div>
    );
  }

  const nextPayment = summary?.active_loan?.next_payment;
  const hasOfficialAccess = Boolean(portfolio);
  const activeLoan = summary?.active_loan;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12 font-sans text-slate-900 dark:text-slate-100">
      {/* WhatsApp Simulated Alert Toast */}
      <AnimatePresence>
        {whatsappToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 right-5 z-50 flex items-center gap-3 rounded-2xl bg-emerald-700 text-white p-4 shadow-2xl max-w-md border border-emerald-500"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 block">
                WhatsApp Notification Update
              </span>
              <p className="text-xs font-bold mt-0.5">{whatsappToast}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Caution Modal */}
      <CautionModal
        isOpen={cautionModal.isOpen}
        onClose={() => setCautionModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={cautionModal.onConfirm}
        title={cautionModal.title}
        description={cautionModal.description}
        confirmText={cautionModal.confirmText}
        type={cautionModal.type}
        details={cautionModal.details}
        busy={busy}
      />

      {/* 3-Tap Loan Application Wizard Modal */}
      {showApplyWizard && (
        <LoanApplicationForm
          canApply={summary?.can_apply}
          busy={busy}
          members={portfolio?.loans?.map((l) => ({ _id: l.id, user_id: { name: l.member_name } })) || []}
          onClose={() => setShowApplyWizard(false)}
          onSubmit={(payload) =>
            openCaution({
              title: "Submit 3-Tap Loan Request",
              description: `Confirm credit request of KES ${Number(payload.amount).toLocaleString()} for ${payload.repayment_period_months} month(s)?`,
              confirmText: "Submit & Borrow",
              type: "info",
              details: [
                { label: "Amount", value: `KES ${Number(payload.amount).toLocaleString()}` },
                { label: "Term", value: `${payload.repayment_period_months} Month(s)` },
              ],
              work: () => loanService.apply(chamaId, payload),
              successMsg: "Loan request recorded! Review outcome in progress.",
              whatsappMsg: `Loan request of KES ${Number(payload.amount).toLocaleString()} submitted successfully.`,
            })
          }
        />
      )}

      {/* Lipa Loan M-Pesa STK Dialog */}
      {lipaDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-2xl space-y-5"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-bold dark:bg-emerald-950 dark:text-emerald-400">
                  INSTANT M-PESA STK PAYMENT
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">Lipa Loan (M-Pesa)</h3>
              </div>
              <button
                onClick={() => setLipaDialog((prev) => ({ ...prev, isOpen: false }))}
                className="text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <label className="block space-y-1.5 font-bold text-slate-700 dark:text-slate-300">
                <span>Repayment Amount (KES)</span>
                <input
                  type="number"
                  value={lipaDialog.amount}
                  onChange={(e) => setLipaDialog({ ...lipaDialog, amount: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-base font-black text-slate-900 focus:border-emerald-600 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
                />
              </label>

              <label className="block space-y-1.5 font-bold text-slate-700 dark:text-slate-300">
                <span>M-Pesa Phone Number</span>
                <input
                  value={lipaDialog.phone}
                  onChange={(e) => setLipaDialog({ ...lipaDialog, phone: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-900 focus:border-emerald-600 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
                />
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setLipaDialog((prev) => ({ ...prev, isOpen: false }))}
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-100 py-3 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleLipaLoanSubmit}
                className="flex-2 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-xs font-black text-white hover:bg-emerald-500 shadow-md"
              >
                <Smartphone className="h-4 w-4" />
                <span>Send M-Pesa Prompt</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Header Banner */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 border border-white/30 px-3 py-1 text-xs font-semibold text-white">
                <Coins className="h-3.5 w-3.5" />
                CHAMA CREDIT & LOAN DASHBOARD
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Instant Chama Credit
            </h1>
            <p className="max-w-2xl text-sm text-emerald-100">
              Borrow instantly based on your Chama savings balance. Transparent, mobile-first, zero paperwork.
            </p>
          </div>
        </div>
      </header>

      {/* Notice Alert */}
      {notice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-medium ${
            notice.type === "error"
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
        >
          {notice.type === "error" ? (
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          )}
          <div className="flex-1">{notice.text}</div>
          <button onClick={() => setNotice(null)} className="text-xs opacity-60 hover:opacity-100">
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Role Navigation Switcher */}
      <div className="flex overflow-x-auto gap-2 rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5 dark:border-slate-800 dark:bg-slate-900/60">
        <button
          onClick={() => setActiveTab("personal")}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
            activeTab === "personal"
              ? "bg-emerald-600 text-white shadow-md"
              : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <User className="h-4 w-4" />
          <span>My Member Credit Screen</span>
        </button>

        {hasOfficialAccess && (
          <button
            onClick={() => setActiveTab("official")}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              activeTab === "official"
                ? "bg-sky-600 text-white shadow-md"
                : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Treasurer / Admin Approval Screen</span>
            {portfolio?.summary?.awaiting_decision_count > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-950">
                {portfolio.summary.awaiting_decision_count}
              </span>
            )}
          </button>
        )}
      </div>

      {/* MEMBER 1-SCREEN DASHBOARD */}
      {activeTab === "personal" && (
        <div className="space-y-6">
          {/* Rule 1: Show Limit First ("Unafaa Ksh X" builds trust) */}
          <div className="rounded-3xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100 p-6 sm:p-8 dark:border-emerald-800 dark:bg-slate-900 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="inline-block rounded-full bg-emerald-600 text-white px-3 py-1 text-xs font-black uppercase tracking-wider mb-2">
                  YOUR CREDIT LIMIT — UNAFAA KSH {Number(summary?.loan_limit || 50000).toLocaleString()}
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                  Available Limit: {money(summary?.available_borrowing_capacity || summary?.loan_limit || 50000)}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
                  Calculated at {summary?.loan_multiplier || 3}× your Chama savings balance ({money(summary?.savings_balance)})
                </p>
              </div>

              {activeLoan && (
                <div className="rounded-2xl border border-emerald-300 bg-white p-4 text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-800 dark:text-white">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Active Loan</span>
                  <strong className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                    {activeLoan.reference || money(activeLoan.amount)}
                  </strong>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    Due: {nextPayment?.due_date ? new Date(nextPayment.due_date).toLocaleDateString() : "15th Sept"}
                  </span>
                </div>
              )}
            </div>

            {/* Mobile-First 2 BIG BUTTONS ONLY */}
            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              <button
                type="button"
                onClick={() => setShowApplyWizard(true)}
                className="flex items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-6 py-5 text-lg font-black text-white shadow-xl hover:bg-emerald-500 transition active:scale-98"
              >
                <PlusCircle className="h-6 w-6" />
                <span>Apply for Loan</span>
              </button>

              <button
                type="button"
                onClick={() => setLipaDialog({ isOpen: true, amount: "5000", phone: "0712345678" })}
                className="flex items-center justify-center gap-3 rounded-2xl bg-sky-600 px-6 py-5 text-lg font-black text-white shadow-xl hover:bg-sky-500 transition active:scale-98"
              >
                <Smartphone className="h-6 w-6" />
                <span>Lipa Loan</span>
              </button>
            </div>
          </div>

          {/* Metric Bar */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <LoanMetricCard label="Your Savings" value={money(summary?.savings_balance)} accent="purple" />
            <LoanMetricCard label="Outstanding Total" value={money(summary?.outstanding_total)} accent="sky" />
            <LoanMetricCard
              label="Next Installment"
              value={money(nextPayment?.amount)}
              hint={nextPayment?.due_date ? new Date(nextPayment.due_date).toLocaleDateString() : "No payment due"}
              accent="amber"
            />
            <LoanMetricCard label="Borrowing Limit" value={money(summary?.loan_limit)} accent="emerald" />
          </section>

          {/* Guarantor Inbox */}
          <GuarantorInbox
            requests={summary?.pending_guarantee_requests}
            busy={busy}
            onRespond={(loanId, decision) =>
              openCaution({
                title: `${decision === "accepted" ? "Pledge Guarantee" : "Decline Guarantee"} Request`,
                description: "Pledging encumbers your Chama savings balance until full settlement.",
                confirmText: decision === "accepted" ? "Pledge Guarantee" : "Decline",
                type: decision === "accepted" ? "warning" : "info",
                work: () => loanService.respondToGuarantee(chamaId, loanId, decision),
                successMsg: `Guarantee ${decision}.`,
              })
            }
          />

          {/* My Loans History List */}
          <LoanList loans={loans} onSelect={selectLoan} />

          {/* Selected Loan Details Panel */}
          <LoanDetailsPanel
            loan={selectedLoan}
            payments={payments}
            paying={busy}
            onClose={() => setSelectedLoan(null)}
            onPay={() => setLipaDialog({ isOpen: true, amount: "5000", phone: "0712345678" })}
          />
        </div>
      )}

      {/* TREASURER / ADMIN 1-SCREEN DASHBOARD */}
      {activeTab === "official" && hasOfficialAccess && (
        <div className="space-y-6">
          <LoanPortfolio
            portfolio={portfolio}
            busy={busy}
            onDecision={(loanId, decision) =>
              openCaution({
                title: `${decision === "approved" ? "Approve" : "Reject"} Member Loan Application`,
                description: `Confirm official decision to ${decision} member loan request.`,
                confirmText: decision === "approved" ? "Approve & Notify" : "Reject Application",
                type: decision === "approved" ? "warning" : "danger",
                work: () => loanService.decide(chamaId, loanId, decision, "Reviewed in ChamaManager"),
                successMsg: `Loan application successfully ${decision}.`,
                whatsappMsg: `WhatsApp Alert: Loan ${decision}. Member notified.`,
              })
            }
            onDisburse={(loanId) =>
              openCaution({
                title: "Initiate M-Pesa B2C Loan Disbursement",
                description: "Disburse money directly to borrower's phone via M-Pesa B2C.",
                confirmText: "Disburse Funds via B2C",
                type: "danger",
                work: () => loanService.initiateDisbursement(chamaId, loanId),
                successMsg: "Disbursement initiated successfully!",
                whatsappMsg: "WhatsApp Alert: Approved. Money sent via M-Pesa.",
              })
            }
          />
        </div>
      )}
    </div>
  );
}
