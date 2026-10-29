import { z } from 'zod';
import * as approvalsService from '../services/approvals.service.js';

export const listApprovalsQuerySchema = z.object({
  decision: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
});

export const decisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comments: z.string().optional()
});

export const listApprovals = async (req, res, next) => {
  try {
    const filters = req.validatedQuery || req.query;
    const result = await approvalsService.listApprovals(filters, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const decideApproval = async (req, res, next) => {
  try {
    const approvalId = req.params.id;
    const result = await approvalsService.decideApproval(approvalId, req.body, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
