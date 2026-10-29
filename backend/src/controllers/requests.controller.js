import { z } from 'zod';
import * as requestsService from '../services/requests.service.js';

export const listRequestsQuerySchema = z.object({
  status: z.string().optional(),
  department: z.string().optional(),
  q: z.string().optional(),
  all: z.coerce.boolean().optional(),
  requester_id: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
});

export const previewRequestQuerySchema = z.object({
  total: z.coerce.number().nonnegative().optional(),
  budgetId: z.string().optional(),
  budget_id: z.string().optional()
});

export const createRequestSchema = z.object({
  budgetId: z.string().optional(),
  budget_id: z.string().optional(),
  title: z.string().min(1),
  justification: z.string().optional(),
  procurementType: z.enum(['competitive', 'single_source', 'direct_low_value']).optional(),
  procurement_type: z.enum(['competitive', 'single_source', 'direct_low_value']).optional(),
  singleSourceJustification: z.string().optional(),
  single_source_justification: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  neededByDate: z.string().optional(),
  needed_by_date: z.string().optional(),
  currencyCode: z.string().length(3).optional(),
  currency_code: z.string().length(3).optional(),
  lines: z.array(
    z.object({
      line_no: z.coerce.number().optional(),
      itemCode: z.string().optional(),
      item_code: z.string().optional(),
      description: z.string().min(1),
      category: z.string().min(1),
      quantity: z.coerce.number().positive(),
      uom: z.string().default('EA'),
      estimatedUnitCost: z.coerce.number().nonnegative().optional(),
      estimated_unit_cost: z.coerce.number().nonnegative().optional()
    })
  ).min(1)
}).refine((d) => d.budgetId || d.budget_id, { message: 'budgetId or budget_id is required' })
  .refine((d) => d.procurementType || d.procurement_type, { message: 'procurementType or procurement_type is required' });

export const submitRequestSchema = z.object({
  confirmDuplicate: z.boolean().optional(),
  duplicate_confirmed: z.boolean().optional(),
  overrideReason: z.string().optional(),
  override_reason: z.string().optional()
});

export const createRfqSchema = z.object({
  supplierIds: z.array(z.string().min(1)).min(1),
  closingDate: z.string().min(1),
  notes: z.string().optional()
});

export const singleSourcePoSchema = z.object({
  supplierId: z.string().min(1),
  unitPrices: z.record(z.coerce.number().nonnegative()).optional(),
  justification: z.string().min(1)
});

export const listRequests = async (req, res, next) => {
  try {
    const filters = req.validatedQuery || req.query;
    const result = await requestsService.listRequests(filters, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getRequestPreview = async (req, res, next) => {
  try {
    const { total, budgetId } = req.query;
    const preview = await requestsService.previewRequest({
      total: total ? parseFloat(total) : 0,
      budgetId,
      user: req.user
    });
    res.status(200).json(preview);
  } catch (error) {
    next(error);
  }
};

export const getRequestById = async (req, res, next) => {
  try {
    const prId = req.params.id || req.params.prId;
    const request = await requestsService.getRequestById(prId);
    if (!request) {
      return res.status(404).json({
        status: 'error',
        message: `Purchase request ${prId} not found`
      });
    }
    res.status(200).json(request);
  } catch (error) {
    next(error);
  }
};

export const createRequest = async (req, res, next) => {
  try {
    const pr = await requestsService.createRequest(req.body, req.user);
    res.status(201).json(pr);
  } catch (error) {
    next(error);
  }
};

export const submitRequest = async (req, res, next) => {
  try {
    const prId = req.params.id || req.params.prId;
    const result = await requestsService.submitRequest(prId, req.body, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const createRfqForRequest = async (req, res, next) => {
  try {
    const prId = req.params.id || req.params.prId;
    const result = await requestsService.createRfqForRequest(prId, req.body, req.user);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const createSingleSourcePo = async (req, res, next) => {
  try {
    const prId = req.params.id || req.params.prId;
    const result = await requestsService.createSingleSourcePo(prId, req.body, req.user);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getRequestAudit = async (req, res, next) => {
  try {
    const prId = req.params.id || req.params.prId;
    const audit = await requestsService.getRequestAuditTrail(prId);
    res.status(200).json(audit);
  } catch (error) {
    next(error);
  }
};
