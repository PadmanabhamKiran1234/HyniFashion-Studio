import cron from 'node-cron';
import { expireUnpaidOrders } from '../services/orderExpiry.service.js';

let isRunning = false;

export const startOrderExpiryJob = () => {
  console.log('Order expiry job started. Checking every minute.');

  cron.schedule('* * * * *', async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      const result = await expireUnpaidOrders();

      if (result.expired > 0) {
        console.log(
          `Order expiry completed. Checked: ${result.checked}, Expired: ${result.expired}`
        );
      }
    } catch (error) {
      console.error('Order expiry job failed:', error.message);
    } finally {
      isRunning = false;
    }
  });
};