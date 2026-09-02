import loansApi from '../api/loans.api';

const data = async (request) => (await request).data.data;
const loanService = {
  getDashboard: async (chamaId) => {
    const [summary, loans] = await Promise.all([data(loansApi.summary(chamaId)), data(loansApi.mine(chamaId))]);
    let portfolio = null;
    try { portfolio = await data(loansApi.portfolio(chamaId)); } catch { /* portfolio is official-only */ }
    return { summary, loans: loans || [], portfolio };
  },
  getRepayments: (chamaId, loanId) => data(loansApi.repayments(chamaId, loanId)),
  checkEligibility: (chamaId, params) => data(loansApi.checkEligibility(chamaId, params)),
  getMyGuarantees: (chamaId) => data(loansApi.myGuarantees(chamaId)),
  apply: (chamaId, payload) => data(loansApi.apply(chamaId, payload)),
  respondToGuarantee: (chamaId, loanId, decision) => data(loansApi.respondGuarantee(chamaId, loanId, decision)),
  decide: (chamaId, loanId, decision, comment) => data(loansApi.decide(chamaId, loanId, decision, comment)),
  initiateDisbursement: (chamaId, loanId) => data(loansApi.disburse(chamaId, loanId)),
  confirmDisbursement: (chamaId, loanId, payload) => data(loansApi.confirmDisbursement(chamaId, loanId, payload)),
  startMpesaRepayment: (chamaId, loanId, payload) => data(loansApi.payByMpesa(chamaId, loanId, payload)),
};
export default loanService;
