import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/kpis', dashboardController.getKpis);
router.get('/spend-by-dept', dashboardController.getSpendByDept);
router.get('/pipeline', dashboardController.getPipeline);

export default router;
