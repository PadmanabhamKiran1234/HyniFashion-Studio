
import mongoose from 'mongoose';
import User from '../models/User.js';
import { EMPLOYEE_PERMISSIONS } from '../middleware/employeePermission.js';

const VALID_STATUSES = ['active', 'pending', 'suspended'];

const escapeRegex = value =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ADMIN: Get all employees
export const getAllEmployees = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10)
    );

    const filter = {
      role: 'employee'
    };

    if (req.query.status) {
      if (!VALID_STATUSES.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid employee status.'
        });
      }

      filter.status = req.query.status;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(
        escapeRegex(req.query.search.trim()),
        'i'
      );

      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { mobile: searchRegex },
        { employeeId: searchRegex }
      ];
    }

    const [employees, total] = await Promise.all([
      User.find(filter)
        .select('userId employeeId name email mobile role status permissions employeeDetails createdAt updatedAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      User.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      count: employees.length,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      employees
    });
  } catch (error) {
    console.error('Get employees error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch employees.'
    });
  }
};

// ADMIN: Get one employee
export const getEmployeeDetails = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.employeeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID.'
      });
    }

    const employee = await User.findOne({
      _id: req.params.employeeId,
      role: 'employee'
    })
      .select('userId employeeId name email mobile role status permissions employeeDetails createdAt updatedAt')
      .lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.'
      });
    }

    return res.status(200).json({
      success: true,
      employee
    });
  } catch (error) {
    console.error('Get employee details error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch employee details.'
    });
  }
};

// ADMIN: Update employee details, status and permissions
export const updateEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { name, mobile, status, permissions, department, designation, joiningDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID.'
      });
    }

    const employee = await User.findOne({
      _id: employeeId,
      role: 'employee'
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.'
      });
    }

    const update = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Employee name must contain at least 2 characters.'
        });
      }

      update.name = name.trim();
    }

    if (mobile !== undefined) {
      if (typeof mobile !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Mobile number must be a string.'
        });
      }

      update.mobile = mobile.trim();
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be active, pending or suspended.'
        });
      }

      update.status = status;
    }

    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) {
        return res.status(400).json({
          success: false,
          message: 'Permissions must be an array.'
        });
      }

      const invalidPermissions = permissions.filter(
        permission => !EMPLOYEE_PERMISSIONS.includes(permission)
      );

      if (invalidPermissions.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'One or more permissions are invalid.',
          invalidPermissions
        });
      }

      update.permissions = [...new Set(permissions)];
    }

    if (department !== undefined || designation !== undefined || joiningDate !== undefined) {
      if (department !== undefined && typeof department !== 'string') {
        return res.status(400).json({ success: false, message: 'Department must be a string.' });
      }
      if (designation !== undefined && typeof designation !== 'string') {
        return res.status(400).json({ success: false, message: 'Designation must be a string.' });
      }
      if (joiningDate !== undefined && Number.isNaN(new Date(joiningDate).getTime())) {
        return res.status(400).json({ success: false, message: 'Joining date is invalid.' });
      }
      if (department !== undefined) update['employeeDetails.department'] = department.trim();
      if (designation !== undefined) update['employeeDetails.designation'] = designation.trim();
      if (joiningDate !== undefined) update['employeeDetails.joiningDate'] = new Date(joiningDate);
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one field to update.'
      });
    }

    const updatedEmployee = await User.findByIdAndUpdate(
      employeeId,
      { $set: update },
      { new: true, runValidators: true }
    )
      .select('userId employeeId name email mobile role status permissions employeeDetails createdAt updatedAt')
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Employee updated successfully.',
      employee: updatedEmployee
    });
  } catch (error) {
    console.error('Update employee error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to update employee.',
      error: error.message
    });
  }
};

// ADMIN: Get the list of permissions available to employees
export const getAvailableEmployeePermissions = async (req, res) => {
  return res.status(200).json({
    success: true,
    permissions: EMPLOYEE_PERMISSIONS
  });
};

// EMPLOYEE: Get own profile
export const getMyEmployeeProfile = async (req, res) => {
  try {
    const employee = await User.findOne({
      _id: req.user._id,
      role: 'employee'
    })
      .select('userId employeeId name email mobile role status permissions employeeDetails createdAt updatedAt')
      .lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee profile not found.'
      });
    }

    return res.status(200).json({
      success: true,
      employee
    });
  } catch (error) {
    console.error('Get own employee profile error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch employee profile.'
    });
  }
};

// EMPLOYEE: Update own basic profile
export const updateMyEmployeeProfile = async (req, res) => {
  try {
    const { name, mobile } = req.body;

    const update = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Name must contain at least 2 characters.'
        });
      }

      update.name = name.trim();
    }

    if (mobile !== undefined) {
      if (typeof mobile !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Mobile number must be a string.'
        });
      }

      update.mobile = mobile.trim();
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide a name or mobile number to update.'
      });
    }

    const employee = await User.findOneAndUpdate(
      {
        _id: req.user._id,
        role: 'employee',
        status: 'active'
      },
      { $set: update },
      { new: true, runValidators: true }
    )
      .select('userId employeeId name email mobile role status permissions employeeDetails createdAt updatedAt')
      .lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Active employee profile not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      employee
    });
  } catch (error) {
    console.error('Update own employee profile error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to update employee profile.'
    });
  }
};
