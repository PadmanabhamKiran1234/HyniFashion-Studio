import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import User from '../models/User.js';
import { env } from '../config/env.js';
import { generateBusinessId } from '../utils/generateId.js';

const ROLE_PREFIX = {
  admin: 'ADM',
  customer: 'CUS',
  wholesale: 'WHO',
  employee: 'EMP'
};

function createToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      userId: user.userId
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn
    }
  );
}

async function createUserId(role) {
  return generateBusinessId(ROLE_PREFIX[role]);
}

// CUSTOMER REGISTRATION
export async function registerCustomer(req, res, next) {
  try {
    const {
      name,
      email,
      password,
      mobile = ''
    } = req.body;

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      userId: await createUserId('customer'),
      name: name.trim(),
      email: normalizedEmail,
      mobile: mobile.trim(),
      password: hashedPassword,
      role: 'customer',
      status: 'active'
    });

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message: 'Customer account created successfully.',
      token,
      user: user.toSafeObject()
    });

  } catch (error) {
    next(error);
  }
}

// WHOLESALE REGISTRATION
export async function registerWholesale(req, res, next) {
  try {
    const {
      name,
      email,
      password,
      mobile = ''
    } = req.body;

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      userId: await createUserId('wholesale'),
      name: name.trim(),
      email: normalizedEmail,
      mobile: mobile.trim(),
      password: hashedPassword,
      role: 'wholesale',
      status: 'pending'
    });

    return res.status(201).json({
      success: true,
      message: 'Wholesale application submitted. Admin approval is required before login.',
      user: user.toSafeObject()
    });

  } catch (error) {
    next(error);
  }
}

// LOGIN FOR ALL FOUR ROLES
export async function login(req, res, next) {
  try {
    const {
      email,
      password
    } = req.body;

    const expectedRole = req.expectedRole;

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      role: expectedRole
    }).select('+password');

    if (
      !user ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your account is awaiting admin approval.'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is suspended. Contact the administrator.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token: createToken(user),
      user: user.toSafeObject()
    });

  } catch (error) {
    next(error);
  }
}

// GET CURRENT LOGGED-IN USER
export async function getMe(req, res) {
  return res.json({
    success: true,
    user: req.user.toSafeObject()
  });
}

// ADMIN CREATES EMPLOYEE
export async function createEmployee(req, res, next) {
  try {
    const {
      name,
      email,
      password,
      mobile = '',
      department = '',
      designation = '',
      joiningDate,
      permissions = []
    } = req.body;

    if (
      typeof name !== 'string' ||
      name.trim().length < 2 ||
      typeof email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== 'string' ||
      password.length < 8
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid name, email and password (minimum 8 characters) are required.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    const employee = await User.create({
      userId: await createUserId('employee'),
      name: name.trim(),
      email: normalizedEmail,
      mobile: String(mobile).trim(),
      password: await bcrypt.hash(password, 12),
      role: 'employee',
      status: 'active',
      permissions: Array.isArray(permissions) ? [...new Set(permissions)] : [],

      employeeDetails: {
        department: String(department).trim(),
        designation: String(designation).trim(),
        joiningDate: joiningDate ? new Date(joiningDate) : new Date()
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Employee login account created.',
      user: employee.toSafeObject()
    });

  } catch (error) {
    next(error);
  }
}

// ADMIN APPROVES WHOLESALE CUSTOMER
export async function approveWholesale(req, res, next) {
  try {
    const user = await User.findOneAndUpdate(
      {
        userId: req.params.id,
        role: 'wholesale',
        status: 'pending'
      },
      {
        $set: {
          status: 'active',
          approvedAt: new Date(),
          approvedBy: req.user._id
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pending wholesale application not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Wholesale account approved.',
      user: user.toSafeObject()
    });

  } catch (error) {
    next(error);
  }
}

// ADMIN VIEWS PENDING WHOLESALE APPLICATIONS
export async function listPendingWholesale(req, res, next) {
  try {
    const users = await User.find({
      role: 'wholesale',
      status: 'pending'
    }).sort({ createdAt: 1 });

    return res.json({
      success: true,
      count: users.length,
      users: users.map(user => user.toSafeObject())
    });

  } catch (error) {
    next(error);
  }
}