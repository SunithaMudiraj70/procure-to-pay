import { Router } from 'express';
import * as requestsController from '../controllers/requests.controller.js';
import validateQuery from '../middleware/validateQuery.js';
import validateBody from '../middleware/validateBody.js';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Preview before creation
router.get(
  '/preview',
  optionalAuth,
  validateQuery(requestsController.previewRequestQuerySchema),
  requestsController.getRequestPreview
);

// List requests
router.get(
  '/',
  optionalAuth,
  validateQuery(requestsController.listRequestsQuerySchema),
  requestsController.listRequests
);

// Create request (requester only)
router.post(
  '/',
  authenticate,
  requireRole('requester'),
  validateBody(requestsController.createRequestSchema),
  requestsController.createRequest
);

// Get request audit trail
router.get('/:id/audit', optionalAuth, requestsController.getRequestAudit);

// Get request by ID
router.get('/:id', optionalAuth, requestsController.getRequestById);

// Submit request (requester who owns it)
router.post(
  '/:id/submit',
  authenticate,
  requireRole('requester'),
  validateBody(requestsController.submitRequestSchema),
  requestsController.submitRequest
);

// Create RFQ for approved request (process_owner)
router.post(
  '/:id/rfq',
  authenticate,
  requireRole('process_owner'),
  validateBody(requestsController.createRfqSchema),
  requestsController.createRfqForRequest
);

// Create single-source / direct PO for approved request (process_owner)
router.post(
  '/:id/single-source-po',
  authenticate,
  requireRole('process_owner'),
  validateBody(requestsController.singleSourcePoSchema),
  requestsController.createSingleSourcePo
);

export default router;
