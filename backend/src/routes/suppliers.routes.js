import { Router } from 'express';
import * as suppliersController from '../controllers/suppliers.controller.js';
import validateQuery from '../middleware/validateQuery.js';
import validateBody from '../middleware/validateBody.js';

const router = Router();

router.get(
  '/',
  validateQuery(suppliersController.listSuppliersQuerySchema),
  suppliersController.listSuppliers
);

router.post(
  '/',
  validateBody(suppliersController.createSupplierSchema),
  suppliersController.createSupplier
);

export default router;
