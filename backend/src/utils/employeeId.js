import Counter from '../models/Counter.js';
import User from '../models/User.js';

const COUNTER_KEY = 'employeeId';
const PREFIX = 'EMP ';

const formatEmployeeId = (value) =>
  `${PREFIX}${String(value).padStart(3, '0')}`;

const parseEmployeeId = (value) => {
  const match = String(value || '').match(/^EMP\s*(\d+)$/i);
  return match ? Number.parseInt(match[1], 10) : 0;
};

// Align the counter with any employee IDs that already exist. This makes the
// migration safe to run repeatedly and prevents a new employee from reusing an
// existing number.
async function syncCounterWithExistingEmployees() {
  const existing = await User.find({
    role: 'employee',
    employeeId: { $type: 'string', $ne: '' }
  })
    .select('employeeId')
    .lean();

  const highest = existing.reduce(
    (max, item) => Math.max(max, parseEmployeeId(item.employeeId)),
    0
  );

  await Counter.updateOne(
    { key: COUNTER_KEY },
    { $max: { seq: highest } },
    { upsert: true }
  );
}

// Reserve the next counter value, retrying if two concurrent requests race to
// create the counter document for the first time.
async function nextCounterValue() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await Counter.findOneAndUpdate(
        { key: COUNTER_KEY },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
    } catch (error) {
      if (error && error.code === 11000 && attempt < 4) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('Unable to allocate an employee ID. Please retry.');
}

// Atomically reserve the next sequential number and return the formatted ID.
// Using findOneAndUpdate with $inc keeps concurrent employee creation safe.
export async function generateEmployeeId() {
  const existingCounter = await Counter.findOne({ key: COUNTER_KEY });

  if (!existingCounter) {
    // First use on a database that may already contain employees (or on a
    // brand-new database). Realign before issuing any number.
    await syncCounterWithExistingEmployees();
  }

  let counter = await nextCounterValue();

  // If this is a fresh counter but employees already exist (for example a
  // database created before this feature), realign and retry once.
  if (!counter) {
    await syncCounterWithExistingEmployees();
    counter = await Counter.findOneAndUpdate(
      { key: COUNTER_KEY },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
  }

  let candidate = formatEmployeeId(counter.seq);

  // Defensive: if the number is already taken (legacy data), keep advancing.
  // eslint-disable-next-line no-await-in-loop
  while (await User.exists({ employeeId: candidate })) {
    // eslint-disable-next-line no-await-in-loop
    counter = await Counter.findOneAndUpdate(
      { key: COUNTER_KEY },
      { $inc: { seq: 1 } },
      { new: true }
    );
    candidate = formatEmployeeId(counter.seq);
  }

  return candidate;
}

export { formatEmployeeId, parseEmployeeId, syncCounterWithExistingEmployees };
