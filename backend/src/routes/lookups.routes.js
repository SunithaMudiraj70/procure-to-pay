import { Router } from 'express';
import * as lookupsController from '../controllers/lookups.controller.js';

const router = Router();

router.get('/users', lookupsController.getUsers);
router.get('/', lookupsController.getLookups);

export default router;
