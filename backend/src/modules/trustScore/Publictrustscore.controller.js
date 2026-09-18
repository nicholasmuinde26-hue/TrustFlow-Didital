import { getPublicTrustScoreByToken } from '../../services/Chamatrustscore.service.js';

// ========================================
// GET PUBLIC TRUST SCORE REPORT
// ========================================
//
// GET /api/v1/public/trust-score/:token
//
// No authentication — this is the whole point. A treasurer/chairperson
// shares this URL with a bank, a SACCO federation, or a prospective
// member, and they can view (and print/export) the report without a
// login. See getPublicTrustScoreByToken() for exactly what is and
// isn't included.
//
// ========================================

export const getPublicTrustScoreController = async (req, res, next) => {
  try {
    const { token } = req.params;

    const report = await getPublicTrustScoreByToken(token);

    res.status(200).json({ success: true, data: { report } });
  } catch (error) {
    next(error);
  }
};