const FAMILY_LABELS = { chama: 'Chama', sacco: 'SACCO', cooperative: 'Cooperative' };

export function organizationLabel(organizationFamily = 'chama', terminology = {}) {
  const configured = typeof terminology?.workspace === 'string' ? terminology.workspace.trim() : '';
  if (configured && !(configured === 'Chama' && organizationFamily !== 'chama')) return configured;
  return FAMILY_LABELS[organizationFamily] || 'Organization';
}

export function organizationPlural(label, family) {
  if (family === 'sacco') return 'SACCOs';
  if (family === 'cooperative') return 'Cooperatives';
  if (family === 'chama') return 'Chamas';
  return /s$/i.test(label) ? label : `${label}s`;
}

export function localizeOrganizationTerms(value, label, plural = `${label}s`) {
  if (typeof value !== 'string' || !value) return value;
  return value.replace(/\bchamas?\b/gi, (match) => match.toLowerCase().endsWith('s') ? plural : label);
}
