import mongoose from 'mongoose';

import Attendance from '../models/Attendance.js';
import User from '../models/User.js';

const BUSINESS_TIMEZONE = process.env.ATTENDANCE_TIMEZONE || 'Asia/Kolkata';

// Server-side business date (never trusted from the client).
export const getBusinessDate = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);

const serialize = (record) => {
  const item = record.toObject ? record.toObject() : record;
  const employee = item.employee;

  return {
    id: item._id,
    date: item.date,
    checkInAt: item.checkInAt,
    checkOutAt: item.checkOutAt,
    totalMinutes: item.totalMinutes,
    status: item.status,
    employeeId:
      employee && typeof employee === 'object' ? employee._id : item.employee,
    employeeObjectId:
      employee && typeof employee === 'object' ? employee._id : item.employee,
    employeeCode:
      (employee && typeof employee === 'object' ? employee.employeeId : '') ||
      item.employeeCode ||
      '',
    employeeName:
      employee && typeof employee === 'object' ? employee.name : undefined,
    employeeEmail:
      employee && typeof employee === 'object' ? employee.email : undefined,
  };
};

// EMPLOYEE: check in for today. Identity comes only from the JWT.
export async function checkIn(req, res) {
  try {
    const employee = req.user;
    const date = getBusinessDate();
    const now = new Date();

    const existing = await Attendance.findOne({
      employee: employee._id,
      date
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'You have already checked in today.'
      });
    }

    let record;
    try {
      record = await Attendance.create({
        employee: employee._id,
        employeeCode: employee.employeeId || '',
        date,
        checkInAt: now,
        status: 'checked_in'
      });
    } catch (error) {
      // Duplicate-key race: another request created today's record first.
      if (error && error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'You have already checked in today.'
        });
      }
      throw error;
    }

    return res.status(201).json({
      success: true,
      message: 'Checked in successfully.',
      attendance: serialize(record)
    });
  } catch (error) {
    console.error('Attendance check-in error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to record check-in.'
    });
  }
}

// EMPLOYEE: check out for today.
export async function checkOut(req, res) {
  try {
    const employee = req.user;
    const date = getBusinessDate();

    const record = await Attendance.findOne({
      employee: employee._id,
      date
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'You must check in before checking out.'
      });
    }

    if (record.checkOutAt) {
      return res.status(409).json({
        success: false,
        message: 'You have already checked out today.'
      });
    }

    const now = new Date();
    const totalMinutes = Math.max(
      0,
      Math.round((now.getTime() - record.checkInAt.getTime()) / 60000)
    );

    record.checkOutAt = now;
    record.totalMinutes = totalMinutes;
    record.status = 'completed';
    await record.save();

    return res.status(200).json({
      success: true,
      message: 'Checked out successfully.',
      attendance: serialize(record)
    });
  } catch (error) {
    console.error('Attendance check-out error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to record check-out.'
    });
  }
}

// EMPLOYEE: own attendance history (today plus recent records).
export async function getMyAttendance(req, res) {
  try {
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 30)
    );
    const date = getBusinessDate();

    const [today, history] = await Promise.all([
      Attendance.findOne({ employee: req.user._id, date }),
      Attendance.find({ employee: req.user._id })
        .sort({ date: -1 })
        .limit(limit)
    ]);

    return res.status(200).json({
      success: true,
      today: today ? serialize(today) : null,
      history: history.map(serialize)
    });
  } catch (error) {
    console.error('Get my attendance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch attendance.'
    });
  }
}

// ADMIN: attendance for all employees.
export async function getAdminAttendance(req, res) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      200,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 50)
    );
    const filter = {};

    if (req.query.date) {
      filter.date = String(req.query.date);
    }

    if (req.query.employeeId) {
      if (!mongoose.isValidObjectId(req.query.employeeId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid employee ID.'
        });
      }
      filter.employee = req.query.employeeId;
    }

    if (req.query.search) {
      const regex = new RegExp(
        req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );
      const matching = await User.find({
        role: 'employee',
        $or: [{ name: regex }, { email: regex }, { employeeId: regex }]
      })
        .select('_id')
        .lean();
      filter.employee = { $in: matching.map(item => item._id) };
    }

    const [records, total] = await Promise.all([
      Attendance.find(filter)
        .populate('employee', 'name email employeeId')
        .sort({ date: -1, checkInAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Attendance.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      count: records.length,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      attendance: records.map(serialize)
    });
  } catch (error) {
    console.error('Get admin attendance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch attendance.'
    });
  }
}
