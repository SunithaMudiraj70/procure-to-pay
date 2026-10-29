import { Router } from 'express';
import * as rfqsController from '../controllers/rfqs.controller.js';
import validateQuery from '../middleware/validateQuery.js';
import validateBody from '../middleware/validateBody.js';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Read routes (open to all roles)
router.get(
  '/',
  optionalAuth,
  validateQuery(rfqsController.listRfqsQuerySchema),
  rfqsController.listRfqs
);

router.get('/:id/comparison', optionalAuth, rfqsController.getRfqComparison);
router.get('/:rfqId/comparison', optionalAuth, rfqsController.getRfqComparison);

// Write routes (process_owner)
router.post(
  '/:id/quotes',
  authenticate,
  requireRole('process_owner'),
  validateBody(rfqsController.addQuoteSchema),
  rfqsController.addQuote
);

router.post(
  '/:id/evaluate',
  authenticate,
  requireRole('process_owner'),
  rfqsController.evaluateRfq
);

router.post(
  '/:id/award',
  authenticate,
  requireRole('process_owner'),
  validateBody(rfqsController.awardRfqSchema),
  rfqsController.awardRfq
);

router.post(
  '/:id/purchase-order',
  authenticate,
  requireRole('process_owner'),
  rfqsController.createPurchaseOrder
);

export default router;
