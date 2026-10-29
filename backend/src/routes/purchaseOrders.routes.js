import { Router } from 'express';
import * as poController from '../controllers/purchaseOrders.controller.js';
import validateQuery from '../middleware/validateQuery.js';
import validateBody from '../middleware/validateBody.js';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Read routes (open to all roles)
router.get(
  '/',
  optionalAuth,
  validateQuery(poController.listPoQuerySchema),
  poController.listPurchaseOrders
);

router.get('/:id', optionalAuth, poController.getPurchaseOrderById);
router.get('/:poId', optionalAuth, poController.getPurchaseOrderById);

// Write routes
router.post(
  '/:id/deliveries',
  authenticate,
  requireRole('operations_analyst'),
  validateBody(poController.recordDeliverySchema),
  poController.recordDelivery
);

router.post(
  '/:id/cancel',
  authenticate,
  requireRole('process_owner'),
  validateBody(poController.cancelPoSchema),
  poController.cancelPurchaseOrder
);

export default router;
