import ChamaAsset from "../../models/ChamaAsset.js";
import Business from "../../models/Business.js";
import BusinessTransaction from "../../models/BusinessTransaction.js";
import ChamaBusinessFunding from "../../models/ChamaBusinessFunding.js";
import ChamaAssetDistribution from "../../models/ChamaAssetDistribution.js";
import AssetLease from "../../models/AssetLease.js";
import AssetComplianceObligation from "../../models/AssetComplianceObligation.js";
import AssetManagerReport from "../../models/AssetManagerReport.js";
import AssetTransaction from "../../models/AssetTransaction.js";
import ChamaGoal from "../../models/ChamaGoal.js";
import AppError from "../../utils/AppError.js";

/**
 * ============================================================================
 * PORTFOLIO DASHBOARD SERVICE
 * ============================================================================
 * 
 * Provides unified portfolio analytics across all chama-owned businesses,
 * properties and capital investments.
 * 
 * Aggregates:
 *   - Business sales, expenses, profit, capital invested vs returned, ROI, alerts
 *   - Property occupancy, rent due vs collected, compliance deadlines
 *   - Milestones and targets (ChamaGoal linked to asset)
 *   - Manager accountability and reporting status
 * ============================================================================
 */

export async function getPortfolioDashboard(chamaId) {
  if (!chamaId) {
    throw new AppError("Chama ID is required", 400);
  }

  // 1. Fetch all assets for this Chama
  const assets = await ChamaAsset.find({
    chama_id: chamaId,
    status: { $nin: ["rejected", "disposed"] },
  })
    .populate("operations_ref.business_id")
    .populate("management.manager_id", "name phone email")
    .lean();

  const businessList = [];
  const propertyList = [];
  const otherAssetsList = [];

  let totalCapitalInvested = 0;
  let totalCapitalReturned = 0;
  let totalBusinessSales = 0;
  let totalBusinessExpenses = 0;
  let totalPropertyRentExpected = 0;
  let totalPropertyRentCollected = 0;
  let activeAlertsCount = 0;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 2. Process each asset
  for (const asset of assets) {
    const assetId = asset._id;
    const isBusiness = asset.asset_type === "business" || Boolean(asset.operations_ref?.business_id);
    const isProperty = asset.asset_type === "property" || asset.asset_type === "land" || asset.asset_type === "building";

    // Fetch goals / milestones linked to this asset
    const goals = await ChamaGoal.find({
      chama_id: chamaId,
      asset_id: assetId,
      status: "active",
    }).lean();

    if (isBusiness) {
      const businessDoc = asset.operations_ref?.business_id;
      const businessId = businessDoc?._id || asset.operations_ref?.business_id;

      let sales = 0;
      let expenses = 0;
      let lastTxDate = null;
      let capitalInvested = Number(asset.acquisition?.purchase_price || 0) + Number(asset.acquisition?.acquisition_costs || 0);
      let capitalReturned = 0;
      const alerts = [];

      if (businessId) {
        // Query completed business transactions
        const txs = await BusinessTransaction.find({
          business_id: businessId,
          status: "completed",
        }).lean();

        for (const tx of txs) {
          const amt = Number(tx.amount || 0);
          if (tx.type === "sale" || tx.direction === "cash_in") {
            sales += amt;
          } else if (tx.type === "expense" || tx.direction === "cash_out") {
            expenses += amt;
          }
          const txDate = new Date(tx.createdAt);
          if (!lastTxDate || txDate > lastTxDate) {
            lastTxDate = txDate;
          }
        }

        // Additional capital funding from ChamaBusinessFunding
        const fundings = await ChamaBusinessFunding.find({
          chama_id: chamaId,
          business_id: businessId,
          status: "posted",
        }).lean();

        for (const f of fundings) {
          capitalInvested += Number(f.amount || 0);
        }

        // Capital returned via ChamaAssetDistribution
        const distributions = await ChamaAssetDistribution.find({
          chama_id: chamaId,
          asset_id: assetId,
          status: { $in: ["completed", "processing"] },
        }).lean();

        for (const dist of distributions) {
          capitalReturned += Number(dist.total_amount || 0);
        }
      }

      const netProfit = sales - expenses;
      const roi = capitalInvested > 0 ? ((netProfit / capitalInvested) * 100) : 0;

      // Check alerts
      if (netProfit < 0) {
        alerts.push({ level: "warning", message: "Operating at a loss: expenses exceed sales" });
        activeAlertsCount++;
      }
      if (lastTxDate && lastTxDate < thirtyDaysAgo) {
        alerts.push({ level: "info", message: "No recorded sales in the last 30 days" });
      }

      // Check latest manager report
      const lastReport = await AssetManagerReport.findOne({ asset_id: assetId })
        .sort({ "period.period_end": -1 })
        .lean();

      if (asset.manager_reporting?.enabled && lastReport?.status === "overdue") {
        alerts.push({ level: "danger", message: "Manager report is overdue" });
        activeAlertsCount++;
      }

      totalBusinessSales += sales;
      totalBusinessExpenses += expenses;
      totalCapitalInvested += capitalInvested;
      totalCapitalReturned += capitalReturned;

      businessList.push({
        assetId: String(assetId),
        businessId: businessId ? String(businessId) : null,
        name: asset.name,
        category: businessDoc?.category || "business",
        status: asset.status,
        operationalStatus: asset.operational_status,
        manager: asset.management?.manager_id?.name || asset.management?.external_name || "Unassigned",
        managerType: asset.management?.manager_type || "unassigned",
        sales,
        expenses,
        profit: netProfit,
        capitalInvested,
        capitalReturned,
        roi: Number(roi.toFixed(1)),
        lastReportDate: lastReport?.submitted_at || lastReport?.period?.period_end || lastTxDate,
        alerts,
        goals: goals.map((g) => ({
          id: String(g._id),
          name: g.name,
          targetAmount: g.target_amount,
          savedAmount: g.saved_amount,
          targetDate: g.target_date,
          breakEvenDate: g.break_even_date,
        })),
        canDeepLink: Boolean(businessId),
        workspaceDeepLink: businessId ? `/workspace/${businessId}/business` : null,
      });
    } else if (isProperty) {
      // Property / land asset
      const leases = await AssetLease.find({
        asset_id: assetId,
        status: "active",
      }).lean();

      let rentExpected = 0;
      let rentCollected = 0;

      for (const lease of leases) {
        for (const period of lease.periods || []) {
          rentExpected += Number(period.expected_cash_amount || 0);
        }
      }

      // Read cash collected from AssetTransaction
      const incomeTxs = await AssetTransaction.find({
        asset_id: assetId,
        type: "income",
        status: "posted",
      }).lean();

      for (const tx of incomeTxs) {
        rentCollected += Number(tx.amount || 0);
      }

      // Compliance obligations (land rates, permits, etc.)
      const obligations = await AssetComplianceObligation.find({
        asset_id: assetId,
        active: true,
      }).lean();

      const complianceDeadlines = [];
      for (const ob of obligations) {
        for (const cycle of ob.cycles || []) {
          const due = new Date(cycle.due_date);
          const isOverdue = cycle.status === "overdue" || (due < now && cycle.status !== "paid" && cycle.status !== "waived");
          if (isOverdue) {
            activeAlertsCount++;
          }
          if (cycle.status !== "paid" && cycle.status !== "waived") {
            complianceDeadlines.push({
              obligationType: ob.obligation_type,
              jurisdiction: ob.jurisdiction,
              label: cycle.label,
              dueDate: cycle.due_date,
              amount: cycle.amount_expected,
              status: isOverdue ? "overdue" : "pending",
            });
          }
        }
      }

      const costBasis = Number(asset.acquisition?.purchase_price || 0) + Number(asset.acquisition?.acquisition_costs || 0);
      totalCapitalInvested += costBasis;
      totalPropertyRentExpected += rentExpected;
      totalPropertyRentCollected += rentCollected;

      const lastReport = await AssetManagerReport.findOne({ asset_id: assetId })
        .sort({ "period.period_end": -1 })
        .lean();

      propertyList.push({
        assetId: String(assetId),
        name: asset.name,
        assetType: asset.asset_type,
        customTypeLabel: asset.custom_asset_type_label || null,
        operationalStatus: asset.operational_status,
        occupancy: leases.length > 0 ? (leases.length === 1 ? "1 Active Lease" : `${leases.length} Active Leases`) : "Vacant / Idle",
        activeLeasesCount: leases.length,
        rentExpected,
        rentCollected,
        rentBalance: Math.max(0, rentExpected - rentCollected),
        costBasis,
        currentValuation: asset.current_valuation?.amount || costBasis,
        complianceDeadlines,
        lastReportDate: lastReport?.submitted_at || lastReport?.period?.period_end || null,
        manager: asset.management?.manager_id?.name || asset.management?.external_name || "Unassigned",
        goals: goals.map((g) => ({
          id: String(g._id),
          name: g.name,
          targetAmount: g.target_amount,
          savedAmount: g.saved_amount,
          targetDate: g.target_date,
        })),
      });
    } else {
      // Equipment, vehicles, general investments
      const costBasis = Number(asset.acquisition?.purchase_price || 0) + Number(asset.acquisition?.acquisition_costs || 0);
      totalCapitalInvested += costBasis;

      otherAssetsList.push({
        assetId: String(assetId),
        name: asset.name,
        assetType: asset.asset_type,
        customTypeLabel: asset.custom_asset_type_label || null,
        operationalStatus: asset.operational_status,
        costBasis,
        currentValuation: asset.current_valuation?.amount || costBasis,
        manager: asset.management?.manager_id?.name || asset.management?.external_name || "Unassigned",
        goals: goals.map((g) => ({
          id: String(g._id),
          name: g.name,
          targetAmount: g.target_amount,
          savedAmount: g.saved_amount,
          targetDate: g.target_date,
        })),
      });
    }
  }

  const netBusinessProfit = totalBusinessSales - totalBusinessExpenses;
  const overallRoi = totalCapitalInvested > 0 ? ((netBusinessProfit / totalCapitalInvested) * 100) : 0;

  return {
    summary: {
      totalAssetsCount: assets.length,
      businessesCount: businessList.length,
      propertiesCount: propertyList.length,
      otherAssetsCount: otherAssetsList.length,
      totalCapitalInvested,
      totalCapitalReturned,
      totalBusinessSales,
      totalBusinessExpenses,
      netBusinessProfit,
      totalPropertyRentExpected,
      totalPropertyRentCollected,
      overallRoi: Number(overallRoi.toFixed(1)),
      activeAlertsCount,
    },
    businesses: businessList,
    properties: propertyList,
    otherAssets: otherAssetsList,
  };
}

export default {
  getPortfolioDashboard,
};
