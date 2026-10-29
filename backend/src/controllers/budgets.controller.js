import { z } from 'zod';
import * as budgetsService from '../services/budgets.service.js';

export const listBudgetsQuerySchema = z.object({
  department: z.string().optional(),
  fiscalYear: z.coerce.number().int().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
});

export const listBudgets = async (req, res, next) => {
  try {
    const filters = req.validatedQuery || req.query;
    const result = await budgetsService.listBudgets(filters);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
