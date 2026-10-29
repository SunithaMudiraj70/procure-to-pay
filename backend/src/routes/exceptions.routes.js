import { Router } from 'express';
import * as exceptionsController from '../controllers/exceptions.controller.js';
import validateQuery from '../middleware/validateQuery.js';
import validateBody from '../middleware/validateBody.js';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Read exceptions
router.get(
  '/',
  optionalAuth,
  validateQuery(exceptionsController.listExceptionsQuerySchema),
  exceptionsController.listExceptions
);

// Resolve exception (operations_analyst, process_owner, system_admin)
router.post(
  '/:id/resolve',
  authenticate,
  requireRole('operations_analyst', 'process_owner', 'system_admin'),
  validateBody(exceptionsController.resolveExceptionSchema),
  exceptionsController.resolveException
);

export default router;
