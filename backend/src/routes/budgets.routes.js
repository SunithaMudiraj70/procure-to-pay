import { Router } from 'express';
import * as budgetsController from '../controllers/budgets.controller.js';
import validateQuery from '../middleware/validateQuery.js';

const router = Router();

router.get(
  '/',
  validateQuery(budgetsController.listBudgetsQuerySchema),
  budgetsController.listBudgets
);

export default router;
