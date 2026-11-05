const WHOLESALE_MINIMUM_ORDER = 5000;

export const validateWholesaleMinimum = (subtotal) => {
  const amount = Number(subtotal);

  if (!Number.isFinite(amount) || amount < 0) {
    return {
      eligible: false,
      minimumOrder: WHOLESALE_MINIMUM_ORDER,
      subtotal: 0,
      remainingAmount: WHOLESALE_MINIMUM_ORDER,
      message: 'Invalid order subtotal.'
    };
  }

  const roundedSubtotal = Number(amount.toFixed(2));

  if (roundedSubtotal < WHOLESALE_MINIMUM_ORDER) {
    return {
      eligible: false,
      minimumOrder: WHOLESALE_MINIMUM_ORDER,
      subtotal: roundedSubtotal,
      remainingAmount: Number(
        (WHOLESALE_MINIMUM_ORDER - roundedSubtotal).toFixed(2)
      ),
      message: `Wholesale orders require a minimum subtotal of Rs. ${WHOLESALE_MINIMUM_ORDER}. Add Rs. ${(WHOLESALE_MINIMUM_ORDER - roundedSubtotal).toFixed(2)} more to continue.`
    };
  }

  return {
    eligible: true,
    minimumOrder: WHOLESALE_MINIMUM_ORDER,
    subtotal: roundedSubtotal,
    remainingAmount: 0,
    message: 'Wholesale minimum order requirement satisfied.'
  };
};