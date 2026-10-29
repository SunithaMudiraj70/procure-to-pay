import { z } from 'zod';
import * as poService from '../services/purchaseOrders.service.js';

export const listPoQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
});

export const recordDeliverySchema = z.object({
  scheduledDate: z.string().min(1),
  actualDate: z.string().optional(),
  carrier: z.string().optional(),
  trackingRef: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(
    z.object({
      poLineId: z.string().min(1),
      qtyDelivered: z.coerce.number().positive(),
      qtyRejected: z.coerce.number().nonnegative().optional().default(0)
    })
  ).min(1)
});

export const cancelPoSchema = z.object({
  reason: z.string().min(1)
});

export const listPurchaseOrders = async (req, res, next) => {
  try {
    const filters = req.validatedQuery || req.query;
    const result = await poService.listPurchaseOrders(filters);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getPurchaseOrderById = async (req, res, next) => {
  try {
    const poId = req.params.poId || req.params.id;
    const po = await poService.getPurchaseOrderById(poId);
    if (!po) {
      return res.status(404).json({
        status: 'error',
        message: `Purchase order ${poId} not found`
      });
    }
    res.status(200).json(po);
  } catch (error) {
    next(error);
  }
};

export const recordDelivery = async (req, res, next) => {
  try {
    const poId = req.params.id || req.params.poId;
    const result = await poService.recordDelivery(poId, req.body, req.user);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const cancelPurchaseOrder = async (req, res, next) => {
  try {
    const poId = req.params.id || req.params.poId;
    const result = await poService.cancelPurchaseOrder(poId, req.body, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
