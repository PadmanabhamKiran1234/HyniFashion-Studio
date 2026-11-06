import mongoose from 'mongoose';

import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import {
  formatEmployeeId,
  syncCounterWithExistingEmployees
} from '../utils/employeeId.js';

// Assigns a sequential `employeeId` to employees created before this feature
// existed. MongoDB ObjectIds and all existing relations are left untouched.
async function backfillEmployeeIds() {
  await connectDB();

  const employees = await User.find({
    role: 'employee',
    $or: [
      { employeeId: { $exists: false } },
      { employeeId: null },
      { employeeId: '' }
    ]
  }).sort({ createdAt: 1 });

  if (employees.length === 0) {
    console.log('All employees already have an Employee ID.');
    await syncCounterWithExistingEmployees();
    return;
  }

  // Existing IDs define the starting point; continue from the highest number.
  await syncCounterWithExistingEmployees();

  const used = new Set(
    (
      await User.find({ employeeId: { $type: 'string', $ne: '' } })
        .select('employeeId')
        .lean()
    ).map(item => item.employeeId)
  );

  let sequence = 0;
  for (const employee of employees) {
    let candidate;
    do {
      sequence += 1;
      candidate = formatEmployeeId(sequence);
    } while (used.has(candidate));

    used.add(candidate);
    employee.employeeId = candidate;
    await employee.save();
    console.log(`Assigned ${candidate} to ${employee.email}`);
  }

  await syncCounterWithExistingEmployees();
  console.log(`Backfilled ${employees.length} employee(s).`);
}

backfillEmployeeIds()
  .catch(error => {
    console.error('Employee ID backfill failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
