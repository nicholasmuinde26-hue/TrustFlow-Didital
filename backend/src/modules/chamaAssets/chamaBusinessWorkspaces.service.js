import Business from "../../models/Business.js";
import ChamaAsset from "../../models/ChamaAsset.js";
import WorkspaceRequest from "../../models/WorkspaceRequest.js";

/**
 * Leadership Desk view of every business workspace the chama owns.
 *
 * One row per Business with owner_type "chama" and owner_id = this chama,
 * joined to its asset so the desk can show who manages it without opening
 * the business workspace itself. Read-only: changing the manager goes
 * through assignAssetManager (POST /assets/:assetId/manager).
 */
export async function listChamaBusinessWorkspaces(chamaId) {
  const businesses = await Business.find({ owner_type: "chama", owner_id: chamaId })
    .select("name category category_label location currency chama_asset_id workspace_request_id workspace_settings marketplace_paused createdAt")
    .sort({ createdAt: -1 })
    .lean();

  if (businesses.length === 0) return [];

  const assetIds = businesses.map((b) => b.chama_asset_id).filter(Boolean);
  const requestIds = businesses.map((b) => b.workspace_request_id).filter(Boolean);

  const [assets, requests] = await Promise.all([
    ChamaAsset.find({ _id: { $in: assetIds }, chama_id: chamaId })
      .select("name status operational_status management")
      .populate("management.manager_id", "name phone")
      .lean(),
    WorkspaceRequest.find({ _id: { $in: requestIds } }).select("requestNumber").lean(),
  ]);

  const assetById = new Map(assets.map((a) => [String(a._id), a]));
  const requestById = new Map(requests.map((r) => [String(r._id), r]));

  return businesses.map((business) => {
    const asset = business.chama_asset_id ? assetById.get(String(business.chama_asset_id)) : null;
    const management = asset?.management || {};
    const managerType = management.manager_type || "unassigned";

    return {
      id: String(business._id),
      name: business.name,
      category: business.category,
      categoryLabel: business.category_label || null,
      location: business.location || null,
      currency: business.currency || "KES",
      marketplacePaused: Boolean(business.marketplace_paused),
      enabledSections: business.workspace_settings?.enabled_sections || [],
      requestNumber: requestById.get(String(business.workspace_request_id))?.requestNumber || null,
      createdAt: business.createdAt,
      asset: asset
        ? { id: String(asset._id), status: asset.status, operationalStatus: asset.operational_status || null }
        : null,
      manager: {
        type: managerType,
        userId: managerType === "member" && management.manager_id ? String(management.manager_id._id || management.manager_id) : null,
        name: managerType === "member" ? management.manager_id?.name || null : management.external_name || null,
        contact: managerType === "external" ? management.external_contact || null : management.manager_id?.phone || null,
        assignedAt: management.assigned_at || null,
      },
    };
  });
}

export default { listChamaBusinessWorkspaces };
