import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    // Authenticated employee (MongoDB ObjectId used for relations).
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // Snapshot of the human-readable employee ID at the time of attendance.
    employeeCode: {
      type: String,
      default: ''
    },

    // Local business date in YYYY-MM-DD form so one record exists per day.
    date: {
      type: String,
      required: true,
      index: true
    },

    checkInAt: {
      type: Date,
      required: true
    },

    checkOutAt: {
      type: Date,
      default: null
    },

    totalMinutes: {
      type: Number,
      default: 0,
      min: 0
    },

    status: {
      type: String,
      enum: ['checked_in', 'completed'],
      default: 'checked_in',
      index: true
    }
  },
  {
    timestamps: true
  }
);

attendanceSchema.index(
  { employee: 1, date: 1 },
  { unique: true }
);

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
