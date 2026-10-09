/**
 * ============================================================================
 * CHAMA TEMPLATE LIBRARY
 * ============================================================================
 *
 * Starting points for the contributions a Kenyan chama usually runs. A
 * template only PRE-FILLS the contribution wizard. Nothing here is special once
 * the plan exists:
 *
 *   - the name is the chama's own (English, Kiswahili, Sheng, anything);
 *     `name_en` / `name_sw` are just two suggestions to start from;
 *   - amounts are left blank on purpose, every chama sets its own;
 *   - the system reasons about `behavior`, never about the name.
 *
 * Fields
 *   key            stable id (stored on the plan as template_key)
 *   behavior       one of CONTRIBUTION_BEHAVIORS
 *   category       legacy schedule.category (registration / annual_fee keep
 *                  their own label under behaviour `fee`)
 *   frequency      monthly | quarterly | yearly (calendar contributions).
 *                  NOTE: a quarterly/yearly period is due in its FIRST month
 *                  (the engine's rule), so yearly = due at the start of the
 *                  financial year.
 *   one_time       true = charged once: a single monthly period, so the wizard
 *                  sets end month = start month and the due day is that month's.
 *   amount_mode    fixed | minimum | member_chooses
 *   due_day/grace_days   suggested timings
 *   late_penalty   suggested rule, or null when a penalty makes no sense
 *   needs_target   show the target amount field (project funds, harambee)
 * ============================================================================
 */

export const CHAMA_TEMPLATES = Object.freeze([
  {
    key: 'table_banking',
    name_en: 'Table Banking',
    name_sw: 'Benki ya Mezani',
    description_en: 'Members contribute every month into the pool that is lent out to members.',
    description_sw: 'Wanachama huchangia kila mwezi kwenye mfuko unaokopeshwa wanachama.',
    behavior: 'dues',
    category: 'other',
    frequency: 'monthly',
    one_time: false,
    amount_mode: 'minimum',
    due_day: 5,
    grace_days: 3,
    needs_target: false,
    icon: 'banknote',
    color: '#059669',
    late_penalty: { enabled: true, type: 'fixed', amount: 100, interval: 'weekly', max_amount: 0 },
  },
  {
    key: 'welfare',
    name_en: 'Welfare / Bereavement Fund',
    name_sw: 'Mfuko wa Matanga',
    description_en: 'A pooled fund that supports members in bereavement, sickness and other emergencies.',
    description_sw: 'Mfuko wa pamoja wa kusaidia wanachama wakati wa msiba, ugonjwa au dharura.',
    behavior: 'welfare',
    category: 'welfare',
    frequency: 'monthly',
    one_time: false,
    amount_mode: 'fixed',
    due_day: 5,
    grace_days: 3,
    needs_target: false,
    icon: 'heart-handshake',
    color: '#7c3aed',
    late_penalty: { enabled: true, type: 'fixed', amount: 50, interval: 'once', max_amount: 0 },
  },
  {
    key: 'shares',
    name_en: 'Shares',
    name_sw: 'Hisa',
    description_en: 'Members buy into a shared investment. A member holding half a share can be given a custom amount.',
    description_sw: 'Wanachama hununua hisa kwenye uwekezaji wa pamoja. Mwanachama mwenye nusu hisa anaweza kupewa kiasi tofauti.',
    behavior: 'shares',
    category: 'shares',
    frequency: 'monthly',
    one_time: false,
    amount_mode: 'fixed',
    due_day: 5,
    grace_days: 3,
    needs_target: false,
    icon: 'pie-chart',
    color: '#0284c7',
    late_penalty: { enabled: true, type: 'percentage_of_due', amount: 5, interval: 'monthly', max_amount: 0 },
  },
  {
    key: 'registration_fee',
    name_en: 'Registration Fee',
    name_sw: 'Ada ya Usajili',
    description_en: 'A one-time joining fee charged to members.',
    description_sw: 'Ada ya mara moja ya kujiunga inayotozwa wanachama.',
    behavior: 'fee',
    category: 'registration',
    frequency: 'monthly',
    one_time: true,
    amount_mode: 'fixed',
    due_day: 15,
    grace_days: 7,
    needs_target: false,
    icon: 'clipboard-list',
    color: '#d97706',
    late_penalty: null,
  },
  {
    key: 'annual_subscription',
    name_en: 'Annual Subscription',
    name_sw: 'Ada ya Mwaka',
    description_en: 'A yearly membership fee that keeps the chama running (AGM costs, admin).',
    description_sw: 'Ada ya kila mwaka ya uanachama ya kugharamia shughuli za chama (AGM, utawala).',
    behavior: 'fee',
    category: 'annual_fee',
    frequency: 'yearly',
    one_time: false,
    amount_mode: 'fixed',
    due_day: 15,
    grace_days: 14,
    needs_target: false,
    icon: 'calendar-check',
    color: '#db2777',
    late_penalty: { enabled: true, type: 'fixed', amount: 200, interval: 'once', max_amount: 0 },
  },
  {
    key: 'land_project_fund',
    name_en: 'Land / Project Fund',
    name_sw: 'Mfuko wa Ardhi / Mradi',
    description_en: 'Regular contributions toward buying land or funding a chama project, with a target to reach.',
    description_sw: 'Michango ya kila mwezi ya kununua ardhi au kufadhili mradi wa chama, yenye lengo la kufikia.',
    behavior: 'target',
    category: 'other',
    frequency: 'monthly',
    one_time: false,
    amount_mode: 'minimum',
    due_day: 5,
    grace_days: 3,
    needs_target: true,
    icon: 'landmark',
    color: '#65a30d',
    late_penalty: { enabled: true, type: 'fixed', amount: 100, interval: 'monthly', max_amount: 0 },
  },
  {
    key: 'harambee',
    name_en: 'Harambee',
    name_sw: 'Harambee',
    description_en: 'A one-off fundraising drive. Members give what they can; the amount shown is only a suggestion.',
    description_sw: 'Mchango wa mara moja. Wanachama hutoa wawezavyo; kiasi kinachoonyeshwa ni pendekezo tu.',
    behavior: 'target',
    category: 'other',
    frequency: 'monthly',
    one_time: true,
    amount_mode: 'member_chooses',
    due_day: 28,
    grace_days: 0,
    needs_target: true,
    icon: 'hand-heart',
    color: '#ea580c',
    late_penalty: null,
  },
]);

export const templateByKey = (key) => CHAMA_TEMPLATES.find((t) => t.key === key) || null;
