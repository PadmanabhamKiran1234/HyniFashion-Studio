import express from 'express';

import { subscribe } from '../controllers/newsletter.controller.js';

const router = express.Router();

// PUBLIC - no login required.
router.post('/subscribe', subscribe);

export default router;
