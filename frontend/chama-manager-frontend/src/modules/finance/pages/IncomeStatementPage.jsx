import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import TrustFlowReportHeader from "../components/TrustFlowReportHeader";
import ChamaReportTemplate from "../components/ChamaReportTemplate";
import BusinessReportTemplate from "../components/BusinessReportTemplate";
import financeService from "../services/finance.service";
import { Loader2 } from "lucide-react";

export default function IncomeStatementPage() {
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
        const data = await financeService.getReport(workspaceId, "INCOME_STATEMENT", mode, asAtDate);
        if (mounted) setReportData(data);
      } catch (err) {
        console.error("Failed to fetch Income Statement report:", err);
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
      csvRows += `Mchango ya Wanachama,${reportData?.contributions || 0}\n`;
      csvRows += `Faini na Penalties,${reportData?.fines || 0}\n`;
      csvRows += `MGR Payouts,-${reportData?.mgrPayouts || 0}\n`;
      csvRows += `Admin & Mkutano Costs,-${reportData?.adminCosts || 0}\n`;
      csvRows += `Net Surplus,${reportData?.surplus || 0}\n`;
    } else {
      csvRows += `Gross Revenue,${reportData?.revenue || 0}\n`;
      csvRows += `Cost of Goods Sold (COGS),-${reportData?.cogs || 0}\n`;
      csvRows += `Gross Profit,${reportData?.grossProfit || 0}\n`;
      csvRows += `Operating Expenses,-${reportData?.totalOpex || 0}\n`;
      csvRows += `Net Profit,${reportData?.netProfit || 0}\n`;
    }

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `Income_Statement_${asAtDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <TrustFlowReportHeader
        title={mode === "CHAMA" ? "Mapato na Matumizi (Income & Expenditure)" : "Income Statement (Profit & Loss)"}
        subtitle={
          mode === "CHAMA"
            ? "Transparent summary of Chama contributions, fines, payouts, and net group surplus."
            : "Corporate revenue, cost of goods sold, operating expenses, and net profit margin."
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
          <span className="ml-3 text-sm text-slate-500">Calculating income statement...</span>
        </div>
      ) : mode === "CHAMA" ? (
        <ChamaReportTemplate reportType="INCOME_STATEMENT" data={reportData || {}} asAtDate={asAtDate} />
      ) : (
        <BusinessReportTemplate reportType="INCOME_STATEMENT" data={reportData || {}} asAtDate={asAtDate} />
      )}
    </div>
  );
}