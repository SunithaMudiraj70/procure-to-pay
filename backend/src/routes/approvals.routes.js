import { Router } from 'express';
import * as approvalsController from '../controllers/approvals.controller.js';
import validateQuery from '../middleware/validateQuery.js';
import validateBody from '../middleware/validateBody.js';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get(
  '/',
  optionalAuth,
  validateQuery(approvalsController.listApprovalsQuerySchema),
  approvalsController.listApprovals
);

router.post(
  '/:id/decision',
  authenticate,
  requireRole('approver'),
  validateBody(approvalsController.decisionSchema),
  approvalsController.decideApproval
);

export default router;
