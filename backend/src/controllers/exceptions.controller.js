import { z } from 'zod';
import * as exceptionsService from '../services/exceptions.service.js';

export const listExceptionsQuerySchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
});

export const listViolationsQuerySchema = z.object({
  type: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
});

export const resolveExceptionSchema = z.object({
  status: z.enum(['resolved', 'waived']),
  note: z.string().min(1)
});

export const listExceptions = async (req, res, next) => {
  try {
    const filters = req.validatedQuery || req.query;
    const result = await exceptionsService.listExceptions(filters);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const listViolations = async (req, res, next) => {
  try {
    const filters = req.validatedQuery || req.query;
    const result = await exceptionsService.listViolations(filters);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const resolveException = async (req, res, next) => {
  try {
    const exceptionId = req.params.id;
    const result = await exceptionsService.resolveException(exceptionId, req.body, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
