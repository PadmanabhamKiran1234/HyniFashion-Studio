import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { api, getToken } from '../config/api';

const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

const normalizeRole = (role) => ({ admin: 'Admin', customer: 'Customer', wholesale: 'Wholesale Customer', employee: 'Employee' }[role] || role);
const normalizeProduct = (p) => ({
  ...p,
  id: p.id || p._id,
  mongoId: p._id,
  categoryId: p.categoryId,
  price: Number(p.price ?? p.sellingPrice ?? 0),
  discount: Number(p.discount || 0),
  stock: Number(p.stock || 0),
  sizes: p.sizes || [],
  colors: p.colors || [],
  images: p.images || [],
  image: p.image || p.images?.[0] || '',
});
const normalizeCart = (data) => (data?.items || []).map((entry) => ({
  ...normalizeProduct(entry.product || {}),
  id: entry.product?.id || entry.product?._id,
  mongoId: entry.product?._id,
  quantity: entry.quantity,
  size: entry.size || '',
  color: entry.color || '',
  cartItemId: entry.cartItemId,
  itemTotal: entry.itemTotal,
  price: Number(entry.product?.price || 0),
  discount: Number(entry.product?.discount || 0),
  stock: Number(entry.product?.stock || 0),
}));

const saleLinesFromSales = (sales = []) => sales.flatMap((sale) => (sale.items || []).map((item, index) => ({
  id: `${sale.saleId}-${index + 1}`,
  saleId: sale.saleId,
  employeeId: sale.soldBy?._id || sale.soldBy || '',
  employeeCode: sale.soldBy?.userId || sale.soldBy?.name || '—',
  employeeName: sale.soldBy?.name || '—',
  productId: item.productId?._id || item.productId || '',
  productCode: item.productCode || '',
  productName: item.productName || '',
  category: item.category || '',
  quantity: Number(item.quantity || 0),
  sellingPrice: Number(item.unitPrice ?? item.sellingPrice ?? 0),
  totalAmount: Number(item.subtotal ?? item.totalAmount ?? 0),
  paymentMethod: sale.payment?.method || '',
  customerName: sale.customer?.name || '',
  customerMobile: sale.customer?.mobile || '',
  soldAt: sale.createdAt,
})));

export function StoreProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('hyni_user')) || null; } catch { return null; } });
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [attendance] = useState([]);
  const [employeeSales, setEmployeeSales] = useState([]);
  const [auditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');

  const refreshProducts = useCallback(async () => {
    const result = user?.apiRole === 'admin' ? await api.adminProducts() : await api.products();
    setProducts((result.products || []).map(normalizeProduct));
  }, [user]);
  const refreshCategories = useCallback(async () => {
    const result = await api.categories();
    setCategories(result.categories || []);
  }, []);
  const refreshCart = useCallback(async () => {
    if (!getToken() || !['customer', 'wholesale'].includes(user?.apiRole)) { setCart([]); return; }
    const result = await api.cart(); setCart(normalizeCart(result.data));
  }, [user]);
  const refreshWishlist = useCallback(async () => {
    if (!getToken() || !['customer', 'wholesale'].includes(user?.apiRole)) { setWishlist([]); return; }
    const result = await api.wishlist(); setWishlist((result.data?.products || []).map(normalizeProduct));
  }, [user]);
  const refreshOrders = useCallback(async () => {
    if (!getToken() || !['customer', 'wholesale'].includes(user?.apiRole)) { setOrders([]); return; }
    const result = await api.myOrders();
    setOrders((result.orders || []).map((o) => ({
      ...o,
      id: o.orderId,
      total: o.pricing?.finalAmount || 0,
      date: o.createdAt,
      payment: o.payment?.status,
    })));
  }, [user]);
  const refreshAddresses = useCallback(async () => {
    if (!getToken() || !['customer', 'wholesale'].includes(user?.apiRole)) { setAddresses([]); return; }
    const result = await api.addresses(); setAddresses(result.addresses || []);
  }, [user]);
  const refreshEmployeeSales = useCallback(async () => {
    if (!getToken() || !['admin', 'employee'].includes(user?.apiRole)) { setEmployeeSales([]); return; }
    const result = await api.offlineSales();
    setEmployeeSales(saleLinesFromSales(result.sales || []));
  }, [user]);
  const refreshEmployeeProfile = useCallback(async () => {
    if (!getToken() || user?.apiRole !== 'employee') { setEmployeeProfile(null); return; }
    const result = await api.myEmployeeProfile(); setEmployeeProfile(result.employee || null);
  }, [user]);

  useEffect(() => {
    api.products()
      .then((r) => setProducts((r.products || []).map(normalizeProduct)))
      .catch((e) => setApiError(e.message))
      .finally(() => setLoading(false));
    refreshCategories().catch((e) => setApiError(e.message));
  }, [refreshCategories]);

  useEffect(() => {
    if (!getToken() || !user) return;
    api.me()
      .then((result) => {
        const current = result.user;
        setUser((old) => old ? {
          ...old,
          ...current,
          id: current.id,
          role: normalizeRole(current.role),
          apiRole: current.role,
          employeeId: current.role === 'employee' ? current.id : undefined,
        } : old);
      })
      .catch((error) => {
        if ([401, 403].includes(error.status)) {
          localStorage.removeItem('hyni_token');
          localStorage.removeItem('hyni_user');
          setUser(null);
        } else {
          setApiError(error.message);
        }
      });
    // Validate the stored session once on startup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('hyni_user', JSON.stringify(user));
    if (!user || !getToken()) {
      setCart([]); setWishlist([]); setOrders([]); setEmployees([]); setAddresses([]);
      setEmployeeSales([]); setEmployeeProfile(null);
      if (user && !getToken()) setUser(null);
      return;
    }
    if (user.apiRole === 'admin') {
      loadEmployees().catch((e) => setApiError(e.message));
      refreshProducts().catch((e) => setApiError(e.message));
      refreshEmployeeSales().catch((e) => setApiError(e.message));
    }
    if (user.apiRole === 'employee') {
      setEmployees([{ id: user.id, code: user.userId, name: user.name, email: user.email, status: 'Active', designation: user.employeeDetails?.designation || 'Employee', permissions: user.permissions || [] }]);
      refreshEmployeeSales().catch((e) => setApiError(e.message));
      refreshEmployeeProfile().catch((e) => setApiError(e.message));
    }
    refreshCart().catch((e) => setApiError(e.message));
    refreshWishlist().catch((e) => { if (e.status !== 403) setApiError(e.message); });
    refreshOrders().catch((e) => setApiError(e.message));
    refreshAddresses().catch((e) => { if (e.status !== 403) setApiError(e.message); });
  }, [user, refreshCart, refreshWishlist, refreshOrders, refreshAddresses, refreshEmployeeSales, refreshEmployeeProfile, refreshProducts]);

  const authenticateUser = async (identifier, password, roleHint) => {
    const email = String(identifier).trim().toLowerCase();
    const roles = roleHint ? [roleHint] : ['customer', 'wholesale', 'employee', 'admin'];
    let lastError;
    for (const role of roles) {
      try {
        const result = await api.login(role, email, password);
        localStorage.setItem('hyni_token', result.token);
        const nextUser = {
          ...result.user,
          id: result.user.id,
          role: normalizeRole(result.user.role),
          apiRole: result.user.role,
          employeeId: result.user.role === 'employee' ? result.user.id : undefined,
        };
        setUser(nextUser); setApiError(''); return nextUser;
      } catch (error) { lastError = error; if (![401, 403].includes(error.status)) throw error; }
    }
    throw lastError || new Error('Invalid email or password.');
  };
  const logout = () => {
    localStorage.removeItem('hyni_token');
    localStorage.removeItem('hyni_user');
    setUser(null); setCart([]); setWishlist([]); setOrders([]); setAddresses([]);
    setEmployeeSales([]); setEmployeeProfile(null);
  };
  const addToCart = async (product, quantity = 1, size, color) => {
    if (!getToken()) throw new Error('Please sign in before adding items to your cart.');
    await api.addCart({ productId: product.mongoId || product.id, quantity, size: size || '', color: color || '' });
    await refreshCart();
  };
  const updateQty = async (id, quantity, size, color) => {
    const item = cart.find((x) => x.id === id && (x.size || '') === (size || '') && (x.color || '') === (color || ''));
    if (!item) return;
    await api.updateCart(item.id, { quantity, cartItemId: item.cartItemId });
    await refreshCart();
  };
  const removeCart = async (id, size, color) => {
    const item = cart.find((x) => x.id === id && (x.size || '') === (size || '') && (x.color || '') === (color || ''));
    if (!item?.cartItemId) return;
    await api.removeCart(item.cartItemId);
    await refreshCart();
  };
  const toggleWishlist = async (product) => {
    if (!getToken()) throw new Error('Please sign in to use your wishlist.');
    const exists = wishlist.some((x) => x.id === product.id);
    if (exists) await api.removeWishlist(product.mongoId || product.id);
    else await api.addWishlist(product.mongoId || product.id);
    await refreshWishlist();
  };
  const clearCart = async () => { await api.clearCart(); setCart([]); };
  const updateProfile = async (data) => {
    const result = await api.updateProfile(data);
    setUser((old) => ({ ...old, ...result.customer, role: normalizeRole(result.customer.role), apiRole: result.customer.role }));
    return result.customer;
  };
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + Number(item.customerPrice ?? ((item.sellingPrice || item.price) * (1 - item.discount / 100))) * item.quantity, 0);

  const checkIn = async () => { throw new Error('Attendance check-in is not available because the backend does not expose attendance endpoints.'); };
  const checkOut = async () => { throw new Error('Attendance check-out is not available because the backend does not expose attendance endpoints.'); };
  const recordEmployeeSale = async (productId, quantity, options = {}) => {
    const product = products.find((p) => p.id === productId);
    if (!product?.mongoId) throw new Error('This product is missing its database ID. Refresh the product list.');
    const count = Number(quantity);
    const result = await api.createOfflineSale({
      customerName: options.customerName || '',
      customerMobile: options.customerMobile || '',
      items: [{ productId: product.mongoId, quantity: count, size: options.size || '', color: options.color || '' }],
      paymentMethod: options.paymentMethod || 'cash',
      ...(options.amountReceived !== undefined ? { amountReceived: options.amountReceived } : {}),
      paymentReference: options.paymentReference || '',
    });
    await Promise.all([refreshProducts(), refreshEmployeeSales()]);
    return { ...result.sale, totalAmount: result.sale.pricing.totalAmount, productName: product.name };
  };
  const addEmployee = async (details) => {
    const r = await api.createEmployee({
      name: details.name,
      email: details.email,
      password: details.password,
      mobile: details.phone || details.mobile || '',
      department: details.department || '',
      designation: details.designation || '',
      joiningDate: details.joiningDate || undefined,
      permissions: details.permissions || [],
    });
    await loadEmployees();
    return r.user;
  };
  const loadEmployees = async () => {
    const r = await api.employees();
    setEmployees((r.employees || []).map((e) => ({
      ...e,
      id: e._id,
      code: e.userId || e._id,
      phone: e.mobile,
      designation: e.employeeDetails?.designation || 'Employee',
      department: e.employeeDetails?.department || '',
      joiningDate: e.employeeDetails?.joiningDate?.slice(0, 10) || e.createdAt?.slice(0, 10),
      status: e.status === 'active' ? 'Active' : e.status === 'pending' ? 'Pending' : 'Disabled',
      permissions: e.permissions || [],
    })));
  };
  const updateEmployee = async (id, details) => {
    await api.updateEmployee(id, {
      ...(details.name ? { name: details.name } : {}),
      ...(details.phone || details.mobile ? { mobile: details.phone || details.mobile } : {}),
      ...(details.status ? { status: details.status.toLowerCase() === 'disabled' ? 'suspended' : details.status.toLowerCase() } : {}),
      ...(details.permissions ? { permissions: details.permissions } : {}),
      ...(details.department !== undefined ? { department: details.department } : {}),
      ...(details.designation ? { designation: details.designation } : {}),
      ...(details.joiningDate ? { joiningDate: details.joiningDate } : {}),
    });
    await loadEmployees();
  };
  const setEmployeeStatus = async (id, status) => updateEmployee(id, { status: status === 'Active' ? 'active' : 'suspended' });
  const resetEmployeePassword = async () => { throw new Error('Password reset is not supported by the backend API.'); };
  const addAuditEvent = () => {};

  const value = useMemo(() => ({
    products, setProducts, categories, setCategories, cart, setCart, wishlist, setWishlist,
    addresses, setAddresses, user, setUser, orders, setOrders, employees, setEmployees,
    employeeProfile, attendance, employeeSales, auditLog,
    authenticateUser, logout, checkIn, checkOut, recordEmployeeSale, addEmployee,
    updateEmployee, setEmployeeStatus, resetEmployeePassword, addToCart, updateQty,
    removeCart, toggleWishlist, clearCart, updateProfile, cartCount, subtotal, loading,
    apiError, refreshProducts, refreshCategories, refreshCart, refreshWishlist,
    refreshOrders, refreshAddresses, refreshEmployeeSales, refreshEmployeeProfile,
  }), [products, categories, cart, wishlist, addresses, user, orders, employees, employeeProfile, employeeSales, cartCount, subtotal, loading, apiError, refreshProducts, refreshCategories, refreshCart, refreshWishlist, refreshOrders, refreshAddresses, refreshEmployeeSales, refreshEmployeeProfile]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
