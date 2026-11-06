import mongoose from 'mongoose';

// Generic atomic sequence counter. Each document is keyed by a sequence
// name (for example `employeeId`) and holds the last issued number.
const counterSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    seq: {
      type: Number,
      required: true,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

const Counter = mongoose.model('Counter', counterSchema);

export default Counter;
