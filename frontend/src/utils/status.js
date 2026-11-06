// Shared status-tone mapping so badges look consistent across customer,
// admin and employee surfaces. Purely presentational; business values are
// passed through untouched.
const SUCCESS = new Set([
  'delivered',
  'paid',
  'success',
  'active',
  'available',
  'confirmed',
  'completed',
  'approved',
  'in_stock',
  'present',
]);

const WARNING = new Set([
  'pending_payment',
  'payment_verification',
  'pending',
  'processing',
  'reserved',
  'low_stock',
  'on_hold',
  'submitted',
  'late',
]);

const DANGER = new Set([
  'cancelled',
  'canceled',
  'failed',
  'rejected',
  'disabled',
  'inactive',
  'out_of_stock',
  'sold',
  'absent',
  'expired',
]);

const INFO = new Set([
  'shipped',
  'in_transit',
  'out_for_delivery',
  'info',
  'packed',
  'on_shift',
]);

export function statusTone(value) {
  const key = String(value || '')
    .trim()
    .toLowerCase()
    .replaceAll(' ', '_')
    .replaceAll('-', '_');
  if (SUCCESS.has(key)) return 'tone-success';
  if (WARNING.has(key)) return 'tone-warning';
  if (DANGER.has(key)) return 'tone-danger';
  if (INFO.has(key)) return 'tone-info';
  return 'tone-neutral';
}

export function statusPillClass(value) {
  return `status-pill ${statusTone(value)}`;
}
