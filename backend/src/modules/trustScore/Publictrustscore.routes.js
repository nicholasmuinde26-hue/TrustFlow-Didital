import express from 'express';

import { getPublicTrustScoreController } from './Publictrustscore.controller.js';

// NOTE: intentionally no `protect` middleware anywhere in this file —
// mirrors modules/business/storefront.public.routes.js. A bank, SACCO
// federation, or prospective member only ever gets a share link; they
// never touch the authenticated app.
const router = express.Router();

router.get('/:token', getPublicTrustScoreController);

export default router;