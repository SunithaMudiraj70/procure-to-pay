import { z } from 'zod';
import * as suppliersService from '../services/suppliers.service.js';

export const listSuppliersQuerySchema = z.object({
  status: z.string().optional(),
  risk: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
});

export const createSupplierSchema = z.object({
  supplier_code: z.string().min(3).max(10),
  name: z.string().min(2),
  country_code: z.string().length(2).default('US'),
  default_currency: z.string().length(3).default('USD'),
  payment_terms_days: z.coerce.number().int().min(0).max(180).default(30),
  status: z.enum(['onboarding', 'active', 'inactive', 'blacklisted']).default('active'),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
  risk_flag: z.boolean().default(false),
  risk_reason: z.string().nullable().optional(),
  categories: z.array(z.string()).optional().default([])
});

export const listSuppliers = async (req, res, next) => {
  try {
    const filters = req.validatedQuery || req.query;
    const result = await suppliersService.listSuppliers(filters);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const createSupplier = async (req, res, next) => {
  try {
    const data = req.validatedBody || req.body;
    const supplier = await suppliersService.createSupplier(data);
    res.status(201).json(supplier);
  } catch (error) {
    next(error);
  }
};
