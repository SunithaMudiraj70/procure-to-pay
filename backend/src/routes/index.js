import { Router } from 'express';
import healthRouter from './health.routes.js';
import dashboardRouter from './dashboard.routes.js';
import requestsRouter from './requests.routes.js';
import rfqsRouter from './rfqs.routes.js';
import approvalsRouter from './approvals.routes.js';
import purchaseOrdersRouter from './purchaseOrders.routes.js';
import suppliersRouter from './suppliers.routes.js';
import budgetsRouter from './budgets.routes.js';
import exceptionsRouter from './exceptions.routes.js';
import violationsRouter from './violations.routes.js';
import lookupsRouter from './lookups.routes.js';
import reportsRouter from './reports.routes.js';

const router = Router();

// Health checks
router.use('/health', healthRouter);

// Domain API routes
router.use('/dashboard', dashboardRouter);
router.use('/lookups', lookupsRouter);
router.use('/requests', requestsRouter);
router.use('/rfqs', rfqsRouter);
router.use('/approvals', approvalsRouter);
router.use('/purchase-orders', purchaseOrdersRouter);
router.use('/suppliers', suppliersRouter);
router.use('/budgets', budgetsRouter);
router.use('/exceptions', exceptionsRouter);
router.use('/violations', violationsRouter);
router.use('/reports', reportsRouter);

export default router;
