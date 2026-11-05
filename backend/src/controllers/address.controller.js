
import mongoose from 'mongoose';
import Address from '../models/Address.js';

const allowedLabels = ['Home', 'Work', 'Other'];

function validateAddress(data, partial = false) {
  const requiredFields = [
    'fullName',
    'mobile',
    'addressLine1',
    'city',
    'state',
    'pincode'
  ];

  if (!partial) {
    for (const field of requiredFields) {
      if (
        typeof data[field] !== 'string' ||
        !data[field].trim()
      ) {
        return `${field} is required.`;
      }
    }
  }

  if (data.mobile !== undefined &&
      !/^[0-9]{10,15}$/.test(data.mobile.trim())) {
    return 'Please provide a valid mobile number.';
  }

  if (data.pincode !== undefined &&
      !/^[0-9]{6}$/.test(data.pincode.trim())) {
    return 'Please provide a valid 6-digit pincode.';
  }

  if (data.label !== undefined &&
      !allowedLabels.includes(data.label)) {
    return 'Label must be Home, Work or Other.';
  }

  const limits = {
    fullName: 100,
    addressLine1: 200,
    addressLine2: 200,
    landmark: 100,
    city: 100,
    state: 100,
    country: 100
  };

  for (const [field, max] of Object.entries(limits)) {
    if (data[field] !== undefined) {
      if (typeof data[field] !== 'string' ||
          data[field].trim().length > max) {
        return `${field} must be a string with at most ${max} characters.`;
      }
    }
  }

  return null;
}

const addressFields = [
  'label',
  'fullName',
  'mobile',
  'addressLine1',
  'addressLine2',
  'landmark',
  'city',
  'state',
  'pincode',
  'country'
];

function pickAddressFields(data) {
  const result = {};

  for (const field of addressFields) {
    if (data[field] !== undefined) {
      result[field] =
        typeof data[field] === 'string'
          ? data[field].trim()
          : data[field];
    }
  }

  return result;
}

// ADD ADDRESS
export async function addAddress(req, res, next) {
  try {
    const validationError = validateAddress(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const customerId = req.user._id;

    const addressCount = await Address.countDocuments({
      customerId
    });

    if (addressCount >= 20) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 20 delivery addresses are allowed.'
      });
    }

    const data = pickAddressFields(req.body);

    const makeDefault =
      req.body.isDefault === true || addressCount === 0;

    if (req.body.isDefault !== undefined &&
        typeof req.body.isDefault !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isDefault must be a boolean.'
      });
    }

    if (makeDefault) {
      await Address.updateMany(
        { customerId },
        { $set: { isDefault: false } }
      );
    }

    const address = await Address.create({
      ...data,
      customerId,
      isDefault: makeDefault
    });

    return res.status(201).json({
      success: true,
      message: 'Delivery address added successfully.',
      address
    });

  } catch (error) {
    next(error);
  }
}

// GET ALL CUSTOMER ADDRESSES
export async function getAddresses(req, res, next) {
  try {
    const addresses = await Address.find({
      customerId: req.user._id
    }).sort({
      isDefault: -1,
      createdAt: -1
    });

    return res.json({
      success: true,
      count: addresses.length,
      addresses
    });

  } catch (error) {
    next(error);
  }
}

// GET SINGLE ADDRESS
export async function getAddressById(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid address ID.'
      });
    }

    const address = await Address.findOne({
      _id: req.params.id,
      customerId: req.user._id
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found.'
      });
    }

    return res.json({
      success: true,
      address
    });

  } catch (error) {
    next(error);
  }
}

// UPDATE ADDRESS
export async function updateAddress(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid address ID.'
      });
    }

    const data = pickAddressFields(req.body);

    if (Object.keys(data).length === 0 &&
        req.body.isDefault === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide fields to update.'
      });
    }

    const validationError = validateAddress(data, true);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    if (req.body.isDefault !== undefined &&
        typeof req.body.isDefault !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isDefault must be a boolean.'
      });
    }

    const address = await Address.findOne({
      _id: req.params.id,
      customerId: req.user._id
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found.'
      });
    }

    if (req.body.isDefault === true) {
      await Address.updateMany(
        { customerId: req.user._id },
        { $set: { isDefault: false } }
      );

      address.isDefault = true;
    }

    Object.assign(address, data);

    await address.save();

    return res.json({
      success: true,
      message: 'Address updated successfully.',
      address
    });

  } catch (error) {
    next(error);
  }
}

// DELETE ADDRESS
export async function deleteAddress(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid address ID.'
      });
    }

    const address = await Address.findOne({
      _id: req.params.id,
      customerId: req.user._id
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found.'
      });
    }

    const wasDefault = address.isDefault;

    await address.deleteOne();

    if (wasDefault) {
      const nextAddress = await Address.findOne({
        customerId: req.user._id
      }).sort({ createdAt: -1 });

      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }

    return res.json({
      success: true,
      message: 'Delivery address deleted successfully.'
    });

  } catch (error) {
    next(error);
  }
}

// SET DEFAULT ADDRESS
export async function setDefaultAddress(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid address ID.'
      });
    }

    const address = await Address.findOne({
      _id: req.params.id,
      customerId: req.user._id
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found.'
      });
    }

    await Address.updateMany(
      { customerId: req.user._id },
      { $set: { isDefault: false } }
    );

    address.isDefault = true;
    await address.save();

    return res.json({
      success: true,
      message: 'Default delivery address updated.',
      address
    });

  } catch (error) {
    next(error);
  }
}
