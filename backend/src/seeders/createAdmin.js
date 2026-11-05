import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import { generateBusinessId } from '../utils/generateId.js';

async function seedAdmin() {
  const name = process.env.ADMIN_NAME || 'Hyni Admin';

  const email = process.env.ADMIN_EMAIL
    ?.trim()
    .toLowerCase();

  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env'
    );
  }

  if (password.length < 12) {
    throw new Error(
      'ADMIN_PASSWORD must contain at least 12 characters.'
    );
  }

  await connectDB();

  const existingAdmin = await User.findOne({ email });

  if (existingAdmin) {
    if (existingAdmin.role !== 'admin') {
      throw new Error(
        'This email already belongs to a non-admin account.'
      );
    }

    console.log(`Admin already exists: ${email}`);

    return;
  }

  const admin = await User.create({
    userId: generateBusinessId('ADM'),

    name,

    email,

    password: await bcrypt.hash(password, 12),

    role: 'admin',

    status: 'active'
  });

  console.log('Admin created successfully!');
  console.log('Admin ID:', admin.userId);
  console.log('Admin Email:', admin.email);
}

seedAdmin()
  .catch(error => {
    console.error('Admin seeding failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });