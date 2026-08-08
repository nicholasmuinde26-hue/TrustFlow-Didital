const tones = {
  closed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  active: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  partially_repaid: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  overdue: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  defaulted: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  eligibility_failed: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
};
export default function LoanStatusBadge({ status }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tones[status] || 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>{(status || 'draft').replaceAll('_', ' ')}</span>; }
