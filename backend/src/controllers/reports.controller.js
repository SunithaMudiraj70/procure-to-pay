import { z } from 'zod';
import * as reportsService from '../services/reports.service.js';

export const summaryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional()
});

export const exportQuerySchema = z.object({
  type: z.enum(['requests', 'pos', 'exceptions'])
});

export const getSummary = async (req, res, next) => {
  try {
    const filters = req.validatedQuery || req.query;
    const summary = await reportsService.getSummaryReport(filters);
    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
};

export const exportCsv = async (req, res, next) => {
  try {
    const { type } = req.validatedQuery || req.query;
    const { filename, csv } = await reportsService.exportReportCsv(type);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};
