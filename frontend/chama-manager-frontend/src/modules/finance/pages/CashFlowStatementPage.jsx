import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import TrustFlowReportHeader from "../components/TrustFlowReportHeader";
import ChamaReportTemplate from "../components/ChamaReportTemplate";
import BusinessReportTemplate from "../components/BusinessReportTemplate";
import financeService from "../services/finance.service";
import { Loader2 } from "lucide-react";

export default function CashFlowStatementPage() {
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
        const data = await financeService.getReport(workspaceId, "CASH_FLOW", mode, asAtDate);
        if (mounted) setReportData(data);
      } catch (err) {
        console.error("Failed to fetch Cash Flow report:", err);
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
    let csvRows = "Cash Flow Activity,Amount (KES)\n";
    if (mode === "CHAMA") {
      csvRows += `Cash In (Mchango),${reportData?.cashIn || 0}\n`;
      csvRows += `Cash Out (MGR + Admin),-${reportData?.cashOut || 0}\n`;
      csvRows += `Net Cash Movement,${reportData?.netCashMovement || 0}\n`;
      csvRows += `Opening Balance,${reportData?.openingBalance || 0}\n`;
      csvRows += `Closing Balance,${reportData?.closingBalance || 0}\n`;
    } else {
      csvRows += `Net Operating Cash Flow,${reportData?.netOperating || 0}\n`;
      csvRows += `Net Investing Cash Flow,${reportData?.netInvesting || 0}\n`;
      csvRows += `Net Financing Cash Flow,${reportData?.netFinancing || 0}\n`;
      csvRows += `Net Cash Change,${reportData?.netCashChange || 0}\n`;
    }

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `Cash_Flow_${asAtDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <TrustFlowReportHeader
        title={mode === "CHAMA" ? "Harakati za Fedha (Cash Movements)" : "Statement of Cash Flows"}
        subtitle={
          mode === "CHAMA"
            ? "Simple 3-line cash breakdown: M-Pesa & Bank Cash In vs Cash Out."
            : "Full 3-tier cash flow statement: Operating, Investing, and Financing activities."
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
          <span className="ml-3 text-sm text-slate-500">Calculating cash flow statement...</span>
        </div>
      ) : mode === "CHAMA" ? (
        <ChamaReportTemplate reportType="CASH_FLOW" data={reportData || {}} asAtDate={asAtDate} />
      ) : (
        <BusinessReportTemplate reportType="CASH_FLOW" data={reportData || {}} asAtDate={asAtDate} />
      )}
    </div>
  );
}