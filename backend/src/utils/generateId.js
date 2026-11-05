import { randomBytes } from 'node:crypto';

export function generateBusinessId(prefix) {
  const randomId = randomBytes(4)
    .toString('hex')
    .toUpperCase();

  return `${prefix}${randomId}`;
}