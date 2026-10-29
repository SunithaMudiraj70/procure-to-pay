import { Router } from 'express';
import * as reportsController from '../controllers/reports.controller.js';
import validateQuery from '../middleware/validateQuery.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get(
  '/summary',
  optionalAuth,
  validateQuery(reportsController.summaryQuerySchema),
  reportsController.getSummary
);

router.get(
  '/export',
  optionalAuth,
  validateQuery(reportsController.exportQuerySchema),
  reportsController.exportCsv
);

export default router;
