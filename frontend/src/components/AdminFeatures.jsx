import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Check, Download, RefreshCw, Search, X } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { money } from './ProductCard';
import { api } from '../config/api';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';

const shortDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '—');
const dateTime = (value) => (value ? new Date(value).toLocaleString('en-IN') : '—');
const statusLabel = (value) => String(value || '—').replaceAll('_', ' ');

function Notice({ error, notice }) {
  return (
    <>
      {notice && <p className="employee-success" role="status">{notice}</p>}
      {error && <p className="employee-error" role="alert">{error}</p>}
    </>
  );
}

/* ------------------------------- ORDERS ------------------------------- */

const nextStatusFor = (status) => ({
  confirmed: 'processing',
  processing: 'shipped',
  shipped: 'delivered',
}[status] || '');

export function AdminOrders() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await api.adminOrders({ status, search: query });
      setOrders(result.orders || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [status, query]);

  useEffect(() => { load(); }, [load]);

  const act = async (action, success) => {
    setError(''); setNotice('');
    try { await action(); setNotice(success); toast.success(success); await load(); }
    catch (e) { setError(e.message); toast.error(e.message); }
  };

  const verify = async (order) => {
    const ok = await toast.confirm({
      title: 'Verify payment',
      message: `Confirm that the UTR and screenshot for ${order.orderId} are valid?`,
      confirmText: 'Verify payment',
    });
    if (!ok) return;
    await act(() => api.verifyPayment(order.orderId), `Payment verified for ${order.orderId}.`);
  };

  const reject = (order) => toast.prompt({
    title: 'Reject payment proof',
    message: `Tell the customer why the proof for ${order.orderId} was rejected.`,
    confirmText: 'Reject proof',
    danger: true,
    fields: [{ name: 'reason', label: 'Reason', type: 'textarea', minLength: 3, maxLength: 300, placeholder: 'Explain what is wrong with the payment proof' }],
    onSubmit: async ({ reason }) => {
      await api.rejectPayment(order.orderId, reason);
      setNotice(`Payment proof rejected for ${order.orderId}.`);
      toast.success(`Payment proof rejected for ${order.orderId}.`);
      await load();
    },
  });

  const manualVerify = (order) => toast.prompt({
    title: 'Manual payment verification',
    message: `Record the verification note for ${order.orderId}.`,
    confirmText: 'Verify manually',
    fields: [{ name: 'note', label: 'Verification note', type: 'textarea', minLength: 5, maxLength: 300, placeholder: 'Reference or note confirming the UPI credit' }],
    onSubmit: async ({ note }) => {
      await api.manualVerifyPayment(order.orderId, note);
      setNotice(`Payment manually verified for ${order.orderId}.`);
      toast.success(`Payment manually verified for ${order.orderId}.`);
      await load();
    },
  });

  const advance = async (order) => {
    const next = nextStatusFor(order.status);
    if (!next) return;

    if (next === 'shipped') {
      // Shipment is only recorded after the backend accepts the courier
      // details. If the API fails the modal stays open with the error.
      await toast.prompt({
        title: 'Ship order',
        message: `Enter courier details for ${order.orderId}. The order will be marked shipped only after they are saved.`,
        confirmText: 'Confirm shipment',
        fields: [
          { name: 'courierName', label: 'Courier name', defaultValue: order.courierName || '', minLength: 2, maxLength: 100 },
          { name: 'trackingId', label: 'Tracking ID', defaultValue: order.trackingId || '', minLength: 2, maxLength: 100 },
        ],
        onSubmit: async ({ courierName, trackingId }) => {
          await api.updateOrderStatus(order.orderId, { status: next, courierName, trackingId });
          setNotice(`Order ${order.orderId} moved to ${next}.`);
          toast.success(`Order ${order.orderId} is now shipped.`);
          await load();
        },
      });
      return;
    }

    const ok = await toast.confirm({
      title: 'Update order status',
      message: `Move ${order.orderId} from ${statusLabel(order.status)} to ${next}?`,
      confirmText: 'Update status',
    });
    if (!ok) return;
    await act(() => api.updateOrderStatus(order.orderId, { status: next }), `Order ${order.orderId} moved to ${next}.`);
  };

  const updateTracking = (order) => toast.prompt({
    title: 'Update tracking details',
    message: `Edit courier information for ${order.orderId}.`,
    confirmText: 'Save tracking',
    fields: [
      { name: 'courierName', label: 'Courier name', defaultValue: order.courierName || '', minLength: 2, maxLength: 100 },
      { name: 'trackingId', label: 'Tracking ID', defaultValue: order.trackingId || '', minLength: 2, maxLength: 100 },
    ],
    onSubmit: async ({ courierName, trackingId }) => {
      await api.updateOrderTracking(order.orderId, { courierName, trackingId });
      setNotice(`Tracking details updated for ${order.orderId}.`);
      toast.success(`Tracking details updated for ${order.orderId}.`);
      await load();
    },
  });

  return (
    <AdminLayout>
      <div className="admin-content">
        <div className="admin-welcome">
          <div>
            <span className="eyebrow">ONLINE ORDERS</span>
            <h1>Order management</h1>
            <p>Review payments, verify UPI proof and move verified orders through dispatch.</p>
          </div>
          <button className="button outline" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
        <div className="employee-filters">
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {['pending_payment', 'payment_verification', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
            </select>
          </label>
          <form className="search-form" onSubmit={(e) => { e.preventDefault(); setQuery(search); }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order ID, name, email or mobile" aria-label="Search orders" />
            <button aria-label="Search"><Search size={16} /></button>
          </form>
        </div>
        <Notice error={error} notice={notice} />
        <section className="admin-card table-card">
          <div className="admin-card-heading"><div><span className="eyebrow">ALL ORDERS</span><h3>{orders.length} orders</h3></div></div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Order status</th><th>Payment</th><th>Placed</th><th>Actions</th></tr></thead>
              <tbody>
                {orders.map((order) => {
                  const next = nextStatusFor(order.status);
                  const canVerify = order.status === 'payment_verification' && order.payment?.status === 'submitted';
                  const canManual = ['pending_payment', 'cancelled'].includes(order.status) && ['pending', 'rejected', 'expired'].includes(order.payment?.status);
                  return (
                    <React.Fragment key={order.orderId}>
                      <tr>
                        <td><button className="link-button" onClick={() => setExpanded(expanded === order.orderId ? '' : order.orderId)}>{order.orderId}</button><small>{order.items?.length || 0} line(s)</small></td>
                        <td>{order.customerDetails?.name || order.customerId?.name || '—'}<small>{order.customerDetails?.email || order.customerId?.email || ''}</small></td>
                        <td>{money(order.pricing?.finalAmount || 0)}</td>
                        <td><span className="status-pill">{statusLabel(order.status)}</span></td>
                        <td><span className="status-pill">{statusLabel(order.payment?.status)}</span>{order.payment?.utrNumber && <small>UTR {order.payment.utrNumber}</small>}</td>
                        <td>{shortDate(order.createdAt)}</td>
                        <td>
                          <div className="table-actions">
                            {canVerify && <button onClick={() => verify(order)}><Check size={13} /> Verify</button>}
                            {canVerify && <button className="delete-action" onClick={() => reject(order)}><X size={13} /> Reject</button>}
                            {canManual && <button onClick={() => manualVerify(order)}>Manual verify</button>}
                            {next && <button onClick={() => advance(order)}>{next === 'shipped' ? 'Ship' : next === 'delivered' ? 'Deliver' : 'Process'}</button>}
                            {order.status === 'shipped' && <button onClick={() => updateTracking(order)}>Tracking</button>}
                          </div>
                        </td>
                      </tr>
                      {expanded === order.orderId && (
                        <tr>
                          <td colSpan={7}>
                            <div className="order-detail-inline">
                              <div>
                                <b>Items</b>
                                {(order.items || []).map((item, index) => <p key={`${item.productCode}-${index}`}>{item.productName} · {item.productCode} × {item.quantity} · {money(item.itemSubtotal)}{item.size ? ` · ${item.size}` : ''}</p>)}
                              </div>
                              <div>
                                <b>Delivery</b>
                                <p>{order.shippingAddress?.fullName}, {order.shippingAddress?.addressLine1}, {order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.pincode}</p>
                                <p>Mobile: {order.shippingAddress?.mobile || '—'}</p>
                                {order.courierName && <p>Courier: {order.courierName} · {order.trackingId || 'No tracking ID'}</p>}
                                {order.payment?.screenshotUrl && <a href={order.payment.screenshotUrl} target="_blank" rel="noreferrer">Open payment screenshot</a>}
                                {order.payment?.rejectionReason && <p>Rejection: {order.payment.rejectionReason}</p>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {!orders.length && <p className="employee-empty">{loading ? 'Loading orders…' : 'No orders match these filters.'}</p>}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

/* ---------------------------- PAYMENT PROOFS ---------------------------- */

export function AdminPayments() {
  const toast = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await api.pendingPayments({ limit: 50 }); setPayments(result.orders || []); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const verify = async (order) => {
    const ok = await toast.confirm({
      title: 'Verify payment',
      message: `Confirm that the UTR and screenshot for ${order.orderId} are valid?`,
      confirmText: 'Verify payment',
    });
    if (!ok) return;
    setError(''); setNotice('');
    try {
      await api.verifyPayment(order.orderId);
      setNotice(`Payment verified for ${order.orderId}.`);
      toast.success(`Payment verified for ${order.orderId}.`);
      await load();
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    }
  };
  const reject = (order) => toast.prompt({
    title: 'Reject payment proof',
    message: `Tell the customer why the proof for ${order.orderId} was rejected.`,
    confirmText: 'Reject proof',
    danger: true,
    fields: [{ name: 'reason', label: 'Reason', type: 'textarea', minLength: 3, maxLength: 300, placeholder: 'Explain what is wrong with the payment proof' }],
    onSubmit: async ({ reason }) => {
      await api.rejectPayment(order.orderId, reason);
      setNotice(`Payment proof rejected for ${order.orderId}.`);
      toast.success(`Payment proof rejected for ${order.orderId}.`);
      await load();
    },
  });

  return (
    <AdminLayout>
      <div className="admin-content">
        <div className="admin-welcome">
          <div><span className="eyebrow">UPI PAYMENT CHECKS</span><h1>Payment verification</h1><p>Verify the UTR and screenshot before confirming the order.</p></div>
          <button className="button outline" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
        <Notice error={error} notice={notice} />
        {!payments.length && !loading ? <div className="empty-state"><h2>No payments waiting.</h2><p>New UPI proof submissions will appear here.</p></div> : (
          <div className="payment-review-grid">
            {payments.map((order) => (
              <article className="admin-card payment-review-card" key={order.orderId}>
                <div className="admin-card-heading"><div><span className="eyebrow">{order.orderId}</span><h3>{money(order.pricing?.finalAmount || 0)}</h3></div><span className="status-pill">{statusLabel(order.status)}</span></div>
                <p><b>{order.customerDetails?.name || order.customerId?.name}</b><br />{order.customerDetails?.email || order.customerId?.email}<br />{order.customerDetails?.mobile || order.customerId?.mobile}</p>
                <p>UTR: <b>{order.payment?.utrNumber || '—'}</b><br />Submitted: {dateTime(order.payment?.submittedAt)}</p>
                {order.payment?.screenshotUrl && <a href={order.payment.screenshotUrl} target="_blank" rel="noreferrer"><img className="payment-proof" src={order.payment.screenshotUrl} alt={`Payment proof for ${order.orderId}`} /></a>}
                <div className="table-actions">
                  <button onClick={() => verify(order)}><Check size={13} /> Verify payment</button>
                  <button className="delete-action" onClick={() => reject(order)}><X size={13} /> Reject</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

/* ----------------------------- CATEGORIES ----------------------------- */

const emptyCategory = { name: '', description: '', displayOrder: '0', status: 'active' };

export function AdminCategories() {
  const toast = useToast();
  const { refreshCategories, refreshProducts } = useStore();
  const [adminCategories, setAdminCategories] = useState([]);
  const [form, setForm] = useState(emptyCategory);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadCategories = useCallback(async () => {
    const result = await api.adminCategories();
    setAdminCategories(result.categories || []);
  }, []);
  useEffect(() => {
    loadCategories().catch((e) => setError(e.message));
  }, [loadCategories]);

  const save = async (event) => {
    event.preventDefault(); setError(''); setNotice('');
    try {
      const payload = { name: form.name.trim(), description: form.description || '', displayOrder: Number(form.displayOrder) || 0, status: form.status || 'active' };
      if (editing) await api.updateCategory(editing.categoryId, payload);
      else await api.createCategory(payload);
      setForm(emptyCategory); setEditing(null);
      await Promise.all([loadCategories(), refreshCategories(), refreshProducts()]);
      setNotice(editing ? 'Category updated.' : 'Category created.');
      toast.success(editing ? 'Category updated.' : 'Category created.');
    } catch (e) { setError(e.message); toast.error(e.message); }
  };
  const edit = (category) => {
    setEditing(category);
    setForm({ name: category.name || '', description: category.description || '', displayOrder: String(category.displayOrder || 0), status: category.status || 'active' });
  };
  const remove = async (category) => {
    const ok = await toast.confirm({
      title: 'Delete category',
      message: `Delete ${category.name}? Products using it may need to be reassigned.`,
      confirmText: 'Delete category',
      danger: true,
    });
    if (!ok) return;
    setError(''); setNotice('');
    try {
      await api.deleteCategory(category.categoryId);
      await Promise.all([loadCategories(), refreshCategories()]);
      setNotice('Category deleted.');
      toast.success('Category deleted.');
    } catch (e) { setError(e.message); toast.error(e.message); }
  };

  return (
    <AdminLayout>
      <div className="admin-content">
        <div className="admin-welcome"><div><span className="eyebrow">CATALOGUE STRUCTURE</span><h1>Categories</h1><p>These categories drive the storefront filters and product form.</p></div></div>
        <section className="admin-card">
          <form className="admin-form-grid" onSubmit={save}>
            <h3 style={{ gridColumn: '1 / -1' }}>{editing ? `Edit ${editing.name}` : 'Add category'}</h3>
            <label>Name<input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Display order<input type="number" min="0" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} /></label>
            <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            <label className="span-2">Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
              <button className="button dark">{editing ? 'Save category' : 'Create category'}</button>
              {editing && <button type="button" className="button outline" onClick={() => { setEditing(null); setForm(emptyCategory); }}>Cancel</button>}
            </div>
          </form>
          <Notice error={error} notice={notice} />
        </section>
        <section className="admin-card table-card">
          <div className="admin-card-heading"><div><span className="eyebrow">ALL CATEGORIES</span><h3>{adminCategories.length} categories</h3></div></div>
          <div className="table-scroll"><table><thead><tr><th>Name</th><th>Slug</th><th>Display order</th><th>Status</th><th>Products</th><th>Actions</th></tr></thead>
            <tbody>{adminCategories.map((category) => <tr key={category.categoryId || category._id}>
              <td><b>{category.name}</b><small>{category.description}</small></td>
              <td>{category.slug}</td><td>{category.displayOrder}</td><td><span className="status-pill">{category.status}</span></td>
              <td>{category.productCount ?? '—'}</td>
              <td><div className="table-actions"><button onClick={() => edit(category)}>Edit</button><button className="delete-action" onClick={() => remove(category)}>Delete</button></div></td>
            </tr>)}</tbody>
          </table>{!adminCategories.length && <p className="employee-empty">No categories yet.</p>}</div>
        </section>
      </div>
    </AdminLayout>
  );
}

/* ----------------------------- INVENTORY ----------------------------- */

export function AdminInventory() {
  const { products, refreshProducts } = useStore();
  const [summary, setSummary] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [records, setRecords] = useState([]);
  const [productId, setProductId] = useState('');
  const [change, setChange] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [summaryResult, lowResult, inventoryResult] = await Promise.all([api.inventorySummary(), api.lowStock(), api.inventory({ limit: 100 })]);
      setSummary(summaryResult); setLowStock(lowResult.products || []); setRecords(inventoryResult.inventory || []);
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const adjust = async (event) => {
    event.preventDefault(); setError(''); setNotice('');
    const product = products.find((item) => item.mongoId === productId || item.id === productId);
    if (!product) { setError('Choose a product.'); return; }
    try {
      const result = await api.adjustInventory(product.mongoId, Number(change), reason.trim());
      setNotice(`${result.message} ${product.name} now has ${result.product.availableStock} units.`);
      setChange(''); setReason('');
      await Promise.all([refreshProducts(), load()]);
    } catch (e) { setError(e.message); }
  };

  return (
    <AdminLayout>
      <div className="admin-content">
        <div className="admin-welcome"><div><span className="eyebrow">STOCK CONTROL</span><h1>Inventory</h1><p>Stock is tracked as individual units in the backend. Adjustments update both units and product stock.</p></div><button className="button outline" onClick={load}><RefreshCw size={15} /> Refresh</button></div>
        <div className="kpi-grid">
          {[['Available units', summary?.summary?.available], ['Reserved units', summary?.summary?.reserved], ['Sold units', summary?.summary?.sold], ['Removed units', summary?.summary?.removed], ['Low stock products', summary?.summary?.lowStockCount]].map(([label, value]) => <div className="kpi-card" key={label}><span>{label}</span><b>{value ?? '—'}</b></div>)}
        </div>
        <section className="admin-card">
          <h3>Adjust stock</h3>
          <form className="admin-form-grid" onSubmit={adjust}>
            <label>Product<select required value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Select a product</option>{products.map((product) => <option value={product.mongoId} key={product.mongoId}>{product.code} · {product.name} · {product.stock} in stock</option>)}</select></label>
            <label>Quantity change<input required type="number" value={change} onChange={(e) => setChange(e.target.value)} placeholder="Use a negative number to remove stock" /></label>
            <label>Reason<input required minLength={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Restock, damage, stock count correction…" /></label>
            <div className="form-actions"><button className="button dark">Apply adjustment</button></div>
          </form>
          <Notice error={error} notice={notice} />
        </section>
        <section className="admin-card table-card">
          <div className="admin-card-heading"><div><span className="eyebrow">LOW STOCK</span><h3>{lowStock.length} products at or below threshold</h3></div></div>
          <div className="table-scroll"><table><thead><tr><th>Product</th><th>Code</th><th>Stock</th><th>Threshold</th></tr></thead>
            <tbody>{lowStock.map((product) => <tr key={product._id}><td>{product.name}</td><td>{product.code}</td><td>{product.stock}</td><td>{product.lowStockThreshold}</td></tr>)}</tbody>
          </table>{!lowStock.length && <p className="employee-empty">All products are above their low-stock threshold.</p>}</div>
        </section>
        <section className="admin-card table-card">
          <div className="admin-card-heading"><div><span className="eyebrow">INVENTORY UNITS</span><h3>Latest {records.length} units</h3></div></div>
          <div className="table-scroll"><table><thead><tr><th>Inventory ID</th><th>Product</th><th>Status</th><th>Note</th><th>Created</th></tr></thead>
            <tbody>{records.map((unit) => <tr key={unit._id}><td>{unit.inventoryId}</td><td>{unit.productId?.name || '—'}<small>{unit.productId?.code || ''}</small></td><td><span className="status-pill">{unit.status}</span></td><td>{unit.note || '—'}</td><td>{shortDate(unit.createdAt)}</td></tr>)}</tbody>
          </table>{!records.length && <p className="employee-empty">No inventory units recorded yet.</p>}</div>
        </section>
      </div>
    </AdminLayout>
  );
}

/* ----------------------------- CUSTOMERS ----------------------------- */

export function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [pending, setPending] = useState([]);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('customers');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [customerResult, pendingResult] = await Promise.all([
        api.adminCustomers({ role, status, search: query, limit: 100 }),
        api.pendingWholesale(),
      ]);
      setCustomers(customerResult.customers || []);
      setPending(pendingResult.users || []);
    } catch (e) { setError(e.message); }
  }, [role, status, query]);
  useEffect(() => { load(); }, [load]);

  const approve = async (user) => {
    setError(''); setNotice('');
    try { await api.approveWholesale(user.userId); setNotice(`${user.name} approved for wholesale access.`); await load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <AdminLayout>
      <div className="admin-content">
        <div className="admin-welcome"><div><span className="eyebrow">CUSTOMER ACCOUNTS</span><h1>Customers</h1><p>View retail and wholesale accounts, and approve pending wholesale applications.</p></div><button className="button outline" onClick={load}><RefreshCw size={15} /> Refresh</button></div>
        <div className="employee-filters">
          <label>View<select value={tab} onChange={(e) => setTab(e.target.value)}><option value="customers">Customer directory</option><option value="wholesale">Wholesale approvals ({pending.length})</option></select></label>
          {tab === 'customers' && <>
            <label>Role<select value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option><option value="customer">Customer</option><option value="wholesale">Wholesale</option></select></label>
            <label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select></label>
            <form className="search-form" onSubmit={(e) => { e.preventDefault(); setQuery(search); }}><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, mobile or ID" aria-label="Search customers" /><button aria-label="Search"><Search size={16} /></button></form>
          </>}
        </div>
        <Notice error={error} notice={notice} />
        {tab === 'customers' ? (
          <section className="admin-card table-card">
            <div className="admin-card-heading"><div><span className="eyebrow">DIRECTORY</span><h3>{customers.length} accounts</h3></div></div>
            <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Contact</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead>
              <tbody>{customers.map((customer) => <tr key={customer._id}><td><b>{customer.name}</b><small>{customer.userId}</small></td><td>{customer.email}<small>{customer.mobile || '—'}</small></td><td>{customer.role === 'wholesale' ? 'Wholesale' : 'Customer'}</td><td><span className="status-pill">{customer.status}</span></td><td>{shortDate(customer.createdAt)}</td></tr>)}</tbody>
            </table>{!customers.length && <p className="employee-empty">No customers match these filters.</p>}</div>
          </section>
        ) : (
          <section className="admin-card table-card">
            <div className="admin-card-heading"><div><span className="eyebrow">PENDING APPLICATIONS</span><h3>{pending.length} waiting for approval</h3></div></div>
            <div className="table-scroll"><table><thead><tr><th>Applicant</th><th>Contact</th><th>Applied</th><th>Action</th></tr></thead>
              <tbody>{pending.map((user) => <tr key={user.id}><td><b>{user.name}</b><small>{user.userId}</small></td><td>{user.email}<small>{user.mobile || '—'}</small></td><td>{shortDate(user.createdAt)}</td><td><button className="button dark" onClick={() => approve(user)}><Check size={14} /> Approve</button></td></tr>)}</tbody>
            </table>{!pending.length && <p className="employee-empty">No wholesale applications are waiting.</p>}</div>
          </section>
        )}
      </div>
    </AdminLayout>
  );
}

/* ----------------------------- DISCOUNTS ----------------------------- */

export function AdminDiscounts() {
  const { products, refreshProducts } = useStore();
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const filtered = useMemo(() => products.filter((product) => `${product.name} ${product.code} ${product.category}`.toLowerCase().includes(search.toLowerCase())), [products, search]);

  const save = async (product) => {
    setError(''); setNotice('');
    const value = draft[product.id] ?? product.discount;
    try {
      await api.updateProduct(product.id, { discount: Number(value) });
      await refreshProducts();
      setNotice(`${product.name} discount updated to ${value}%.`);
    } catch (e) { setError(e.message); }
  };
  const toggle = async (product, field) => {
    setError(''); setNotice('');
    try {
      await api.updateProduct(product.id, { [field]: !product[field] });
      await refreshProducts();
      setNotice(`${product.name} updated.`);
    } catch (e) { setError(e.message); }
  };

  return (
    <AdminLayout>
      <div className="admin-content">
        <div className="admin-welcome"><div><span className="eyebrow">OFFERS & DISCOUNTS</span><h1>Discounts</h1><p>Update product discounts and storefront badges. Prices are recalculated by the backend.</p></div></div>
        <div className="employee-filters"><label>Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Product, code or category" /></label></div>
        <Notice error={error} notice={notice} />
        <section className="admin-card table-card">
          <div className="table-scroll"><table><thead><tr><th>Product</th><th>MRP</th><th>Discount</th><th>Selling price</th><th>Badges</th><th>Action</th></tr></thead>
            <tbody>{filtered.map((product) => {
              const value = draft[product.id] ?? product.discount;
              const selling = Number((product.price || product.sellingPrice || 0) * (1 - Number(value) / 100));
              return <tr key={product.id}>
                <td><b>{product.name}</b><small>{product.code} · {product.category}</small></td>
                <td>{money(product.price)}</td>
                <td><input className="inline-input" type="number" min="0" max="100" value={value} onChange={(e) => setDraft({ ...draft, [product.id]: e.target.value })} /></td>
                <td>{money(selling)}</td>
                <td><div className="table-actions"><button onClick={() => toggle(product, 'hotSale')}>{product.hotSale ? 'hot ✓' : 'hot'}</button><button onClick={() => toggle(product, 'isNew')}>{product.isNew ? 'new ✓' : 'new'}</button><button onClick={() => toggle(product, 'featured')}>{product.featured ? 'featured ✓' : 'featured'}</button></div></td>
                <td><button className="button dark" onClick={() => save(product)}>Save</button></td>
              </tr>;
            })}</tbody>
          </table>{!filtered.length && <p className="employee-empty">No products match this search.</p>}</div>
        </section>
      </div>
    </AdminLayout>
  );
}

/* ------------------------------ REPORTS ------------------------------ */

export function AdminReportsLive() {
  const [days, setDays] = useState('30');
  const [trend, setTrend] = useState([]);
  const [summary, setSummary] = useState(null);
  const [offline, setOffline] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [trendResult, summaryResult, offlineResult] = await Promise.all([
        api.salesTrend(Number(days)),
        api.dashboard(),
        api.offlineSalesSummary(),
      ]);
      setTrend(trendResult.data?.trend || []);
      setSummary(summaryResult.data);
      setOffline(offlineResult.summary);
      setNotice(`Live sales data for the last ${days} days.`);
    } catch (e) { setError(e.message); }
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const chartData = trend.map((row) => ({ name: row.date.slice(5), online: row.onlineRevenue, offline: row.offlineRevenue, total: row.totalRevenue }));
  const totals = trend.reduce((sum, row) => ({
    online: sum.online + row.onlineRevenue,
    offline: sum.offline + row.offlineRevenue,
    total: sum.total + row.totalRevenue,
    onlineOrders: sum.onlineOrders + row.onlineOrders,
    offlineSales: sum.offlineSales + row.offlineSales,
  }), { online: 0, offline: 0, total: 0, onlineOrders: 0, offlineSales: 0 });

  return (
    <AdminLayout>
      <div className="admin-content">
        <div className="admin-welcome"><div><span className="eyebrow">THE NUMBERS, LIVE</span><h1>Sales reports</h1><p>Revenue comes from verified online orders and completed offline sales.</p></div><button className="button outline" onClick={() => { const blob = new Blob([['Date', 'Online revenue', 'Offline revenue', 'Total', 'Online orders', 'Offline sales'].join(','), ...trend.map((row) => [row.date, row.onlineRevenue, row.offlineRevenue, row.totalRevenue, row.onlineOrders, row.offlineSales].join(','))].join('\n'), { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hyni-sales-report.csv'; a.click(); URL.revokeObjectURL(a.href); }}><Download size={15} /> Export CSV</button></div>
        <div className="employee-filters"><label>Period<select value={days} onChange={(e) => setDays(e.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label></div>
        <Notice error={error} notice={notice} />
        <div className="kpi-grid">
          {[['Verified online revenue', money(summary?.sales?.onlineRevenue || 0)], ['Offline sale revenue', money(summary?.sales?.offlineRevenue || 0)], ['Total revenue', money(summary?.sales?.totalRevenue || 0)], ['Online orders', totals.onlineOrders], ['Offline sales', totals.offlineSales], ['Period revenue', money(totals.total)]].map(([label, value]) => <div className="kpi-card" key={label}><span>{label}</span><b>{value}</b></div>)}
        </div>
        <div className="admin-card">
          <div className="admin-card-heading"><div><span className="eyebrow">SALES TREND</span><h3>Online vs offline</h3></div><span>Last {days} days</span></div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee7df" />
              <XAxis dataKey="name" /><YAxis tickFormatter={(v) => `₹${v / 1000}k`} /><Tooltip formatter={(v) => money(v)} /><Legend />
              <Bar dataKey="online" name="Online" fill="#915ba4" radius={[4, 4, 0, 0]} /><Bar dataKey="offline" name="Offline" fill="#6e1f2c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="admin-card">
          <span className="eyebrow">DAILY BREAKDOWN</span><h3>Revenue by day</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#eee7df" /><XAxis dataKey="name" /><YAxis tickFormatter={(v) => `₹${v / 1000}k`} /><Tooltip formatter={(v) => money(v)} /><Line type="monotone" dataKey="total" name="Total" stroke="#915ba4" strokeWidth={3} dot={false} /></LineChart>
          </ResponsiveContainer>
        </div>
        <div className="admin-card table-card">
          <div className="admin-card-heading"><div><span className="eyebrow">DETAIL</span><h3>Day-by-day totals</h3></div></div>
          <div className="table-scroll"><table><thead><tr><th>Date</th><th>Online revenue</th><th>Offline revenue</th><th>Total</th><th>Online orders</th><th>Offline sales</th></tr></thead>
            <tbody>{[...trend].reverse().map((row) => <tr key={row.date}><td>{shortDate(row.date)}</td><td>{money(row.onlineRevenue)}</td><td>{money(row.offlineRevenue)}</td><td>{money(row.totalRevenue)}</td><td>{row.onlineOrders}</td><td>{row.offlineSales}</td></tr>)}</tbody>
          </table></div>
          <p className="employee-empty">Offline lifetime total: {money(offline?.overall?.totalRevenue || 0)} across {offline?.overall?.totalSales || 0} sales.</p>
        </div>
      </div>
    </AdminLayout>
  );
}
