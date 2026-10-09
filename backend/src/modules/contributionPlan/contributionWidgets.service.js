import MgrRound from '../../models/MgrRound.js';
import SavingsShareout from '../../models/SavingsShareout.js';
import ChamaMembership from '../../models/ChamaMembership.js';

/**
 * ============================================================================
 * CONTRIBUTION HUB WIDGETS
 * ============================================================================
 *
 * The hub renders every plan with ONE generic card. Behaviour-specific extras
 * plug in here as small widgets: a provider is registered against a behaviour
 * and returns, for the plans of that behaviour, a list of
 *
 *     { type: 'next_recipient' | 'shareout_status' | ..., data: {...} }
 *
 * A behaviour with no provider simply gets no widgets - it still appears with
 * its figures. To add an extra for a new behaviour, add one entry to
 * WIDGET_PROVIDERS; nothing else (route, card, hub) changes.
 *
 * Providers are batch functions (all plans of the behaviour at once) so the
 * dashboard costs a constant number of queries however many plans exist.
 * ============================================================================
 */

const num = (v) => Number(v?.toString?.() ?? v ?? 0) || 0;

const OPEN_ROUND_STATUSES = [
  'upcoming',
  'collecting',
  'target_reached',
  'eligibility_checking',
  'payout_proposed',
  'pending_approval',
  'approved',
  'disbursing',
  'on_hold',
];

/** rotation -> the next MGR recipient. */
const rotationProvider = async ({ chamaId, plans }) => {
  const planIds = plans.map((p) => p._id);
  const rounds = await MgrRound.find({ chama_id: chamaId, status: { $in: OPEN_ROUND_STATUSES } })
    .sort({ round_number: 1 })
    .lean();
  if (!rounds.length) return new Map();

  // A round can point at the plan that collects for it. Where it does, match
  // exactly; where the chama runs a single rotation plan and rounds carry no
  // link, the chama's next open round belongs to that plan.
  const linked = new Map();
  for (const r of rounds) {
    const key = r.contribution_plan_id ? String(r.contribution_plan_id) : null;
    if (key && planIds.some((id) => String(id) === key) && !linked.has(key)) linked.set(key, r);
  }
  const fallback = plans.length === 1 && !linked.size ? rounds[0] : null;

  const chosen = plans.map((p) => linked.get(String(p._id)) || fallback);
  const recipientIds = [...new Set(chosen.filter(Boolean).map((r) => String(r.recipient_id)))];
  const members = recipientIds.length
    ? await ChamaMembership.find({ _id: { $in: recipientIds } }).populate('user_id', 'name').lean()
    : [];
  const nameById = new Map(members.map((m) => [String(m._id), m.user_id?.name || 'Member']));

  const out = new Map();
  plans.forEach((plan, i) => {
    const r = chosen[i];
    if (!r) return;
    const expected = num(r.expected_amount);
    const collected = num(r.collected_amount);
    out.set(String(plan._id), [
      {
        type: 'next_recipient',
        data: {
          round_number: r.round_number,
          recipient_id: r.recipient_id,
          recipient_name: nameById.get(String(r.recipient_id)) || 'Member',
          due_date: r.due_date,
          status: r.status,
          expected,
          collected,
          percent: expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : null,
        },
      },
    ]);
  });
  return out;
};

/** savings -> where the latest share-out stands. */
const savingsProvider = async ({ chamaId, plans }) => {
  const latest = await SavingsShareout.findOne({ chama_id: chamaId, status: { $ne: 'cancelled' } })
    .sort({ createdAt: -1 })
    .lean();
  const out = new Map();
  if (!latest) return out;
  const items = latest.items || [];
  const widget = {
    type: 'shareout_status',
    data: {
      shareout_id: latest._id,
      status: latest.status,
      period_label: latest.period_label || null,
      total_amount: num(latest.total_amount),
      recipients: items.length,
      paid: items.filter((i) => i.status === 'paid').length,
    },
  };
  // Share-outs are chama-wide, so every savings plan shows the same status.
  for (const p of plans) out.set(String(p._id), [widget]);
  return out;
};

export const WIDGET_PROVIDERS = Object.freeze({
  rotation: rotationProvider,
  savings: savingsProvider,
});

/** Returns Map<planId, widget[]> for every plan that has any. */
export const buildWidgets = async ({ chamaId, plans }) => {
  const byBehavior = new Map();
  for (const p of plans) {
    if (!byBehavior.has(p.behavior)) byBehavior.set(p.behavior, []);
    byBehavior.get(p.behavior).push(p);
  }
  const result = new Map();
  await Promise.all(
    [...byBehavior.entries()].map(async ([behavior, group]) => {
      const provider = WIDGET_PROVIDERS[behavior];
      if (!provider) return;
      try {
        const map = await provider({ chamaId, plans: group });
        for (const [k, v] of map) result.set(k, v);
      } catch (err) {
        // A widget is decoration: never let one failing take the dashboard down.
        console.error(`[contribution-hub] ${behavior} widget failed:`, err.message);
      }
    })
  );
  return result;
};
