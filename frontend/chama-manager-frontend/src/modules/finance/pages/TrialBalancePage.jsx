import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import TrustFlowReportHeader from "../components/TrustFlowReportHeader";
import ChamaReportTemplate from "../components/ChamaReportTemplate";
import BusinessReportTemplate from "../components/BusinessReportTemplate";
import financeService from "../services/finance.service";
import { Loader2 } from "lucide-react";

export default function TrialBalancePage() {
  const { workspaceId } = useParams();
  const [mode, setMode] = useState("CHAMA"); // 'CHAMA' | 'BUSINESS'
  const [asAtDate, setAsAtDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await financeService.getReport(workspaceId, "TRIAL_BALANCE", mode, asAtDate);
        if (mounted) setReportData(data);
      } catch (err) {
        console.error("Failed to fetch Trial Balance report:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (workspaceId) {
      fetchReport();
    }
    return () => { mounted = false; };
  }, [workspaceId, mode, asAtDate]);

  const handleExportCsv = () => {
    const items = reportData?.items || [];
    let csvRows = "Account,Debit (KES),Credit (KES)\n";
    items.forEach((item) => {
      csvRows += `"${item.account}",${item.debit || 0},${item.credit || 0}\n`;
    });
    csvRows += `TOTAL,${reportData?.totalDebit || 0},${reportData?.totalCredit || 0}\n`;

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `Trial_Balance_${asAtDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <TrustFlowReportHeader
        title="Trial Balance Ledger Audit"
        subtitle="Verification of equal debit and credit journal balances across Chama and Business accounts."
        mode={mode}
        onModeChange={setMode}
        asAtDate={asAtDate}
        onDateChange={setAsAtDate}
        onExportExcel={handleExportCsv}
      />

      {loading ? (
        <div className="flex items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="ml-3 text-sm text-slate-500">Calculating trial balance ledger...</span>
        </div>
      ) : mode === "CHAMA" ? (
        <ChamaReportTemplate reportType="TRIAL_BALANCE" data={reportData || {}} asAtDate={asAtDate} />
      ) : (
        <BusinessReportTemplate reportType="TRIAL_BALANCE" data={reportData || {}} asAtDate={asAtDate} />
      )}
    </div>
  );
}