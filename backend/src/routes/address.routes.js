
import express from 'express';

import { protect, authorize } from '../middleware/auth.js';

import {
  addAddress,
  getAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
  setDefaultAddress
} from '../controllers/address.controller.js';

const router = express.Router();

router.use(protect, authorize('customer', 'wholesale'));

router.post('/', addAddress);

router.get('/', getAddresses);

router.get('/:id', getAddressById);

router.patch('/:id', updateAddress);

router.delete('/:id', deleteAddress);

router.patch('/:id/default', setDefaultAddress);

export default router;
