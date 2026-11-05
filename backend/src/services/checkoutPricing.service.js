
const roundMoney = (value) => Number(value.toFixed(2));

const getShippingConfig = () => {
  const baseCharge = Number(process.env.SHIPPING_BASE_CHARGE);
  const perKgCharge = Number(process.env.SHIPPING_PER_KG);

  if (
    !Number.isFinite(baseCharge) ||
    baseCharge < 0 ||
    !Number.isFinite(perKgCharge) ||
    perKgCharge < 0
  ) {
    throw new Error('Invalid shipping configuration in .env.');
  }

  return { baseCharge, perKgCharge };
};

// Convert product weight into kilograms.
const convertToKg = (weight, unit) => {
  return unit === 'g' ? weight / 1000 : weight;
};

export const calculateCheckoutPricing = (cart) => {
  if (!cart || !cart.items || cart.items.length === 0) {
    throw new Error('Your shopping cart is empty.');
  }

  const shippingConfig = getShippingConfig();

  let subtotal = 0;
  let totalWeightKg = 0;
  let totalPackingCost = 0;

  const items = cart.items.map((item) => {
    const product = item.productId;

    if (!product) {
      throw new Error('A product in your cart no longer exists.');
    }

    if (product.status !== 'Active') {
      throw new Error(`${product.name} is currently unavailable.`);
    }

    const quantity = Number(item.quantity);
    const mrp = Number(product.price);
    const discount = Number(product.discount || 0);
    const weight = Number(product.weight);
    const packingCost = Number(product.packingCost || 0);

    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      !Number.isFinite(mrp) ||
      mrp < 0 ||
      !Number.isFinite(discount) ||
      discount < 0 ||
      discount > 100 ||
      !Number.isFinite(weight) ||
      weight <= 0 ||
      !Number.isFinite(packingCost) ||
      packingCost < 0
    ) {
      throw new Error(`Invalid pricing or weight details for ${product.name}.`);
    }

    // Apply discount to the product MRP.
    const unitPrice = roundMoney(
      mrp * (1 - discount / 100)
    );

    const itemSubtotal = roundMoney(unitPrice * quantity);

    // Packing cost is charged per unit.
    const itemPackingCost = roundMoney(
      packingCost * quantity
    );

    const itemWeightKg =
      convertToKg(weight, product.weightUnit) * quantity;

    subtotal += itemSubtotal;
    totalPackingCost += itemPackingCost;
    totalWeightKg += itemWeightKg;

    return {
      productId: product._id,
      productName: product.name,
      productCode: product.code,
      quantity,
      mrp,
      discount,
      unitPrice,
      itemSubtotal,
      packingCost: itemPackingCost,
      weightKg: roundMoney(itemWeightKg),
      size: item.size,
      color: item.color
    };
  });

  subtotal = roundMoney(subtotal);
  totalPackingCost = roundMoney(totalPackingCost);
  totalWeightKg = roundMoney(totalWeightKg);

  // Charge for every started kilogram.
  const chargeableWeightKg = Math.ceil(totalWeightKg);

  const shippingCharge = roundMoney(
    shippingConfig.baseCharge +
    chargeableWeightKg * shippingConfig.perKgCharge
  );

  const finalAmount = roundMoney(
    subtotal + totalPackingCost + shippingCharge
  );

  return {
    items,
    summary: {
      subtotal,
      totalWeightKg,
      chargeableWeightKg,
      packingCost: totalPackingCost,
      shippingCharge,
      finalAmount,
      currency: 'INR'
    }
  };
};
