/** Organization families and common starting types. Types are descriptive;
 * capabilities remain independently composed from workspace modules. */
export const ORGANIZATION_TYPES = Object.freeze({
  chama: Object.freeze([
    { key: 'merry_go_round', label: 'Merry-go-round' },
    { key: 'table_banking', label: 'Table banking' },
    { key: 'investment_group', label: 'Investment group' },
    { key: 'welfare', label: 'Welfare / burial' },
    { key: 'housing', label: 'Housing group' },
    { key: 'farmer_group', label: 'Farmer group' },
    { key: 'custom', label: 'Other / custom' },
  ]),
  sacco: Object.freeze([
    { key: 'community_sacco', label: 'Community SACCO' },
    { key: 'employee_sacco', label: 'Employee SACCO' },
    { key: 'farmer_sacco', label: 'Farmer SACCO' },
    { key: 'housing_sacco', label: 'Housing SACCO' },
    { key: 'investment_sacco', label: 'Investment SACCO' },
    { key: 'custom', label: 'Other / custom' },
  ]),
  cooperative: Object.freeze([
    { key: 'agricultural', label: 'Agricultural cooperative' },
    { key: 'consumer', label: 'Consumer cooperative' },
    { key: 'housing', label: 'Housing cooperative' },
    { key: 'worker', label: 'Worker cooperative' },
    { key: 'producer', label: 'Producer cooperative' },
    { key: 'custom', label: 'Other / custom' },
  ]),
});

export const ORGANIZATION_FAMILIES = Object.freeze([
  { key: 'chama', label: 'Chama' },
  { key: 'sacco', label: 'SACCO' },
  { key: 'cooperative', label: 'Cooperative' },
]);

/** Default workspace preset (module set) for each family + type. Family-aware
 * because the same type key (e.g. `housing`) exists in several families. */
export const ORGANIZATION_PRESET_BY_TYPE = Object.freeze({
  chama: Object.freeze({
    merry_go_round: 'merry_go_round',
    table_banking: 'table_banking',
    investment_group: 'investment_group',
    welfare: 'burial_welfare',
    housing: 'housing_group',
    farmer_group: 'farmer_group',
    custom: 'custom',
  }),
  sacco: Object.freeze({
    community_sacco: 'community_sacco',
    employee_sacco: 'employee_sacco',
    farmer_sacco: 'farmer_sacco',
    housing_sacco: 'housing_sacco',
    investment_sacco: 'investment_sacco',
    custom: 'community_sacco',
  }),
  cooperative: Object.freeze({
    agricultural: 'agricultural_cooperative',
    consumer: 'cooperative',
    housing: 'housing_cooperative',
    worker: 'cooperative',
    producer: 'cooperative',
    custom: 'cooperative',
  }),
});

/** What the organization calls itself in the UI. Admin can override per org. */
export const ORGANIZATION_TERMINOLOGY = Object.freeze({
  chama: 'Chama',
  sacco: 'SACCO',
  cooperative: 'Cooperative',
});

export function getOrganizationPresetKey(family, type) {
  return ORGANIZATION_PRESET_BY_TYPE[family]?.[type] || ORGANIZATION_PRESET_BY_TYPE[family]?.custom || 'custom';
}

export function getDefaultTerminology(family) {
  return { workspace: ORGANIZATION_TERMINOLOGY[family] || 'Chama', module_labels: {} };
}

export function isOrganizationTypeValid(family, type) {
  return Boolean(ORGANIZATION_TYPES[family]?.some((item) => item.key === type));
}