import { z } from 'zod';
import * as rfqsService from '../services/rfqs.service.js';

export const listRfqsQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
});

export const addQuoteSchema = z.object({
  supplierId: z.string().min(1),
  quoteDate: z.string().min(1),
  validUntil: z.string().min(1),
  currencyCode: z.string().length(3).optional(),
  fxRateToBase: z.coerce.number().positive().optional(),
  freightCost: z.coerce.number().nonnegative().optional(),
  dutyCost: z.coerce.number().nonnegative().optional(),
  otherCharges: z.coerce.number().nonnegative().optional(),
  deliveryDays: z.coerce.number().int().positive(),
  paymentTermsDays: z.coerce.number().int().nonnegative().optional(),
  lines: z.array(
    z.object({
      requestLineId: z.string().min(1),
      unitPrice: z.coerce.number().nonnegative(),
      quantity: z.coerce.number().positive()
    })
  ).min(1)
});

export const awardRfqSchema = z.object({
  quoteId: z.string().min(1),
  rationale: z.string().optional()
});

export const listRfqs = async (req, res, next) => {
  try {
    const filters = req.validatedQuery || req.query;
    const result = await rfqsService.listRfqs(filters);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getRfqComparison = async (req, res, next) => {
  try {
    const rfqId = req.params.rfqId || req.params.id;
    const comparison = await rfqsService.getRfqComparison(rfqId);
    if (!comparison) {
      return res.status(404).json({
        status: 'error',
        message: `RFQ ${rfqId} not found`
      });
    }
    res.status(200).json(comparison);
  } catch (error) {
    next(error);
  }
};

export const addQuote = async (req, res, next) => {
  try {
    const rfqId = req.params.id || req.params.rfqId;
    const result = await rfqsService.addQuote(rfqId, req.body, req.user);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const evaluateRfq = async (req, res, next) => {
  try {
    const rfqId = req.params.id || req.params.rfqId;
    const result = await rfqsService.evaluateRfq(rfqId, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const awardRfq = async (req, res, next) => {
  try {
    const rfqId = req.params.id || req.params.rfqId;
    const result = await rfqsService.awardRfq(rfqId, req.body, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const createPurchaseOrder = async (req, res, next) => {
  try {
    const rfqId = req.params.id || req.params.rfqId;
    const result = await rfqsService.createPurchaseOrderForRfq(rfqId, req.user);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};
