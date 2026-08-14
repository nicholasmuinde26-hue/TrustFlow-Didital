import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import TrustFlowReportHeader from "../components/TrustFlowReportHeader";
import ChamaReportTemplate from "../components/ChamaReportTemplate";
import BusinessReportTemplate from "../components/BusinessReportTemplate";
import financeService from "../services/finance.service";
import { Loader2 } from "lucide-react";

export default function BalanceSheetPage() {
  const { workspaceId } = useParams();
  const [mode, setMode] = useState("CHAMA");
  const [asAtDate, setAsAtDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await financeService.getReport(workspaceId, "BALANCE_SHEET", mode, asAtDate);
        if (mounted) setReportData(data);
      } catch (err) {
        console.error("Failed to fetch Balance Sheet report:", err);
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
    let csvRows = "Category,Amount (KES)\n";
    if (mode === "CHAMA") {
      csvRows += `Mali (Bank + Mpesa),${reportData?.cashBank || 0}\n`;
      csvRows += `Madeni ya Mikopo,${reportData?.loansReceivable || 0}\n`;
      csvRows += `Total Assets,${reportData?.totalAssets || 0}\n`;
      csvRows += `MGR Inayokuja (Payouts Due),${reportData?.payoutsDue || 0}\n`;
      csvRows += `Members Funds,${reportData?.membersFunds || 0}\n`;
    } else {
      csvRows += `Cash & Cash Equivalents,${reportData?.cashEquivalents || 0}\n`;
      csvRows += `Accounts Receivable,${reportData?.accountsReceivable || 0}\n`;
      csvRows += `Total Assets,${reportData?.totalAssets || 0}\n`;
      csvRows += `Accounts Payable,${reportData?.accountsPayable || 0}\n`;
      csvRows += `Share Capital,${reportData?.shareCapital || 0}\n`;
      csvRows += `Retained Earnings,${reportData?.retainedEarnings || 0}\n`;
      csvRows += `Total Equity,${reportData?.totalEquity || 0}\n`;
    }

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `Balance_Sheet_${asAtDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <TrustFlowReportHeader
        title={mode === "CHAMA" ? "Taarifa ya Fedha (Balance Sheet)" : "Statement of Financial Position"}
        subtitle={
          mode === "CHAMA"
            ? "Mali (Assets) vs Madeni (Liabilities) & Mtaji (Members Funds)."
            : "Assets, Liabilities, and Equity compliance per IFRS for SMEs."
        }
        mode={mode}
        onModeChange={setMode}
        asAtDate={asAtDate}
        onDateChange={setAsAtDate}
        onExportExcel={handleExportCsv}
      />

      {loading ? (
        <div className="flex items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="ml-3 text-sm text-slate-500">Calculating balance sheet statement...</span>
        </div>
      ) : mode === "CHAMA" ? (
        <ChamaReportTemplate reportType="BALANCE_SHEET" data={reportData || {}} asAtDate={asAtDate} />
      ) : (
        <BusinessReportTemplate reportType="BALANCE_SHEET" data={reportData || {}} asAtDate={asAtDate} />
      )}
    </div>
  );
}