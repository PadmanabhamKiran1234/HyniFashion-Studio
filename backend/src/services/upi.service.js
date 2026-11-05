
import QRCode from 'qrcode';

const getUpiConfig = () => {
  const upiId = process.env.ADMIN_UPI_ID;
  const upiName = process.env.ADMIN_UPI_NAME;

  if (!upiId || !upiName) {
    throw new Error('Admin UPI configuration is missing.');
  }

  if (!/^[^\s@]+@[^\s@]+$/.test(upiId)) {
    throw new Error('Invalid Admin UPI ID.');
  }

  return { upiId, upiName };
};

export const generateUpiPaymentQR = async ({
  amount,
  orderReference,
  note = 'Hyni Fashion Studio Order'
}) => {
  const paymentAmount = Number(amount);

  if (
    !Number.isFinite(paymentAmount) ||
    paymentAmount <= 0
  ) {
    throw new Error('Payment amount must be greater than zero.');
  }

  if (!orderReference || typeof orderReference !== 'string') {
    throw new Error('A valid order reference is required.');
  }

  if (orderReference.length > 50) {
    throw new Error('Order reference is too long.');
  }

  const { upiId, upiName } = getUpiConfig();

  const formattedAmount = paymentAmount.toFixed(2);

  const upiParams = new URLSearchParams({
    pa: upiId,
    pn: upiName,
    am: formattedAmount,
    cu: 'INR',
    tn: note.slice(0, 80),
    tr: orderReference
  });

  const upiPaymentUrl = `upi://pay?${upiParams.toString()}`;

  const qrCode = await QRCode.toDataURL(upiPaymentUrl, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    width: 400,
    margin: 2
  });

  return {
    upiId,
    receiverName: upiName,
    amount: Number(formattedAmount),
    currency: 'INR',
    orderReference,
    qrCode
  };
};
