import { Router } from 'express';
import * as exceptionsController from '../controllers/exceptions.controller.js';
import validateQuery from '../middleware/validateQuery.js';

const router = Router();

router.get(
  '/',
  validateQuery(exceptionsController.listViolationsQuerySchema),
  exceptionsController.listViolations
);

export default router;
