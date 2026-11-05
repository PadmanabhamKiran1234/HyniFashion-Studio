import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardCheck,
  Download,
  LayoutDashboard,
  LogOut,
  Package,
  Plus,
  UserRound,
  Users,
} from "lucide-react";
import { money } from "./ProductCard";
import { api } from "../config/api";
import { useStore } from "../context/StoreContext";

const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const today = () => localDate();
const dateValue = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const timeLabel = (value) =>
  value
    ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";
const dateTimeLabel = (value) =>
  value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
const saleDate = (sale) => localDate(new Date(sale.soldAt));
const sellingPriceOf = (product) =>
  Number(product?.customerPrice ?? ((product?.sellingPrice || product?.price || 0) * (1 - (product?.discount || 0) / 100)));
const hoursLabel = (hours) => (Number.isFinite(hours) ? `${hours.toFixed(2)} hrs` : "—");
const hoursFor = (record) =>
  record.totalWorkingHours ??
  (record.checkInAt ? (Date.now() - new Date(record.checkInAt).getTime()) / 3600000 : 0);
const makeCsv = (filename, headers, rows) => {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const content = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const within = (value, start, end) => value >= start && value <= end;
const rangeFor = (period, startInput, endInput) => {
  const end = today();
  if (period === "Today") return { start: end, end };
  if (period === "This week") {
    const startDate = dateValue(end);
    startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));
    return { start: localDate(startDate), end };
  }
  if (period === "This month") return { start: `${end.slice(0, 7)}-01`, end };
  return { start: startInput || end, end: endInput && endInput <= end ? endInput : end };
};
const weekdaysInRange = (start, end) => {
  if (end < start) return 0;
  let count = 0;
  for (const date = dateValue(start); localDate(date) <= end; date.setDate(date.getDate() + 1)) {
    if (date.getDay() !== 0 && date.getDay() !== 6) count += 1;
  }
  return count;
};
const expectedWorkEnd = (employee, end) => {
  if (employee.status !== "Disabled") return end;
  const disabledAt = employee.disabledAt || today();
  return disabledAt < end ? disabledAt : end;
};
const periodControls = (period, setPeriod, start, setStart, end, setEnd, employees, employee, setEmployee) => (
  <div className="employee-filters">
    <label>
      Period
      <select value={period} onChange={(event) => setPeriod(event.target.value)}>
        {["Today", "This week", "This month", "Custom"].map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
    {period === "Custom" && (
      <>
        <label>
          From
          <input type="date" max={today()} value={start} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label>
          To
          <input type="date" max={today()} value={end} onChange={(event) => setEnd(event.target.value)} />
        </label>
      </>
    )}
    <label>
      Employee
      <select value={employee} onChange={(event) => setEmployee(event.target.value)}>
        <option value="all">All employees</option>
        {employees.map((item) => (
          <option value={item.id} key={item.id}>{item.code} · {item.name}</option>
        ))}
      </select>
    </label>
  </div>
);

export function EmployeeDashboard() {
  const {
    user,
    setUser,
    logout,
    employees,
    attendance,
    employeeSales,
    products,
    checkIn,
    checkOut,
    recordEmployeeSale,
  } = useStore();
  const navigate = useNavigate();
  const [, setClock] = useState(Date.now());
  const employee = employees.find((item) => item.id === user?.employeeId);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saleForm, setSaleForm] = useState({ customerName: "", customerMobile: "", size: "", color: "", paymentMethod: "cash", amountReceived: "", paymentReference: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [profileForm, setProfileForm] = useState({ name: "", mobile: "" });
  const [profileNotice, setProfileNotice] = useState("");
  const [profileError, setProfileError] = useState("");
  const date = today();
  const todaysAttendance = attendance.find(
    (item) => item.employeeId === employee?.id && item.date === date,
  );
  const myAttendance = attendance
    .filter((item) => item.employeeId === employee?.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const mySales = employeeSales
    .filter((item) => item.employeeId === employee?.id)
    .sort((a, b) => b.soldAt.localeCompare(a.soldAt));
  const selected = products.find((item) => item.id === selectedProduct);
  const weekStart = rangeFor("This week").start;
  const monthStart = `${date.slice(0, 7)}-01`;
  const todaySales = mySales.filter((item) => saleDate(item) === date);
  const weeklySales = mySales.filter((item) => within(saleDate(item), weekStart, date));
  const monthlySales = mySales.filter((item) => within(saleDate(item), monthStart, date));
  const totalSold = mySales.reduce((sum, item) => sum + item.quantity, 0);
  const presentDays = new Set(myAttendance.map((item) => item.date)).size;
  const thisMonthWorkDays = weekdaysInRange(monthStart, date);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (employee) setProfileForm({ name: employee.name || "", mobile: employee.phone || employee.mobile || "" });
  }, [employee?.id]);

  if (!employee || employee.status !== "Active") {
    return (
      <main className="employee-page container">
        <div className="empty-state">
          <h1>Employee account unavailable</h1>
          <p>Ask your administrator to enable your account.</p>
          <button className="button dark" onClick={() => { logout(); navigate("/login"); }}>
            Return to login
          </button>
        </div>
      </main>
    );
  }

  const notifyAction = async (action) => {
    setNotice(""); setError("");
    try { await action(); setNotice("Attendance updated successfully."); }
    catch (actionError) { setError(actionError.message); }
  };
  const submitSale = async (event) => {
    event.preventDefault();
    setNotice("");
    setError("");
    try {
      const sale = await recordEmployeeSale(selectedProduct, quantity, {
        customerName: saleForm.customerName,
        customerMobile: saleForm.customerMobile,
        size: saleForm.size,
        color: saleForm.color,
        paymentMethod: saleForm.paymentMethod,
        amountReceived: saleForm.amountReceived === "" ? undefined : Number(saleForm.amountReceived),
        paymentReference: saleForm.paymentReference,
      });
      setNotice(`${sale.productName} recorded · ${money(sale.totalAmount)} total.`);
      setSelectedProduct("");
      setQuantity("1");
      setSaleForm({ customerName: "", customerMobile: "", size: "", color: "", paymentMethod: "cash", amountReceived: "", paymentReference: "" });
    } catch (actionError) {
      setError(actionError.message);
    }
  };
  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileNotice("");
    setProfileError("");
    try {
      const result = await api.updateMyEmployeeProfile(profileForm);
      setUser((current) => ({ ...current, name: result.employee.name, mobile: result.employee.mobile }));
      setProfileNotice("Profile updated successfully.");
    } catch (actionError) {
      setProfileError(actionError.message);
    }
  };

  return (
    <main className="employee-page">
      <header className="employee-topbar">
        <Link className="brand" to="/"><img src="/images/hyni-logo.png" alt="Hyni Fashion Studio" /></Link>
        <div><span className="eyebrow">TEAM DASHBOARD</span><b>{employee.code}</b></div>
        <button className="employee-signout" onClick={() => { logout(); navigate("/login"); }}>
          <LogOut size={16} /> Sign out
        </button>
      </header>
      <div className="employee-content">
        <section className="employee-welcome">
          <span className="eyebrow">YOUR H Y N I WORKSPACE</span>
          <h1>Welcome, {employee.name}</h1>
          <p>{employee.designation} · {new Date().toLocaleDateString([], { dateStyle: "full" })}</p>
        </section>
        <section className="employee-card employee-attendance-card">
          <div className="employee-section-heading">
            <div><span className="eyebrow">TODAY'S ATTENDANCE</span><h2>Make today count.</h2></div>
            <CalendarDays />
          </div>
          <div className="employee-attendance-facts">
            <div><small>Check in</small><b>{timeLabel(todaysAttendance?.checkInAt)}</b></div>
            <div><small>Check out</small><b>{timeLabel(todaysAttendance?.checkOutAt)}</b></div>
            <div><small>Working hours</small><b>{todaysAttendance ? hoursLabel(hoursFor(todaysAttendance)) : "—"}</b></div>
            <div><small>Status</small><b>{todaysAttendance?.checkOutAt ? "Completed" : todaysAttendance ? "On shift" : "Not checked in"}</b></div>
          </div>
          <div className="employee-action-row">
            <button className="button dark" disabled={Boolean(todaysAttendance)} onClick={() => notifyAction(checkIn)}>
              CHECK IN
            </button>
            <button className="button outline" disabled={!todaysAttendance || Boolean(todaysAttendance.checkOutAt)} onClick={() => notifyAction(checkOut)}>
              CHECK OUT
            </button>
          </div>
        </section>
        <section className="employee-card">
          <div className="employee-section-heading">
            <div><span className="eyebrow">MY PROFILE</span><h2>Your account details</h2></div>
            <UserRound />
          </div>
          <form className="employee-sale-form" onSubmit={saveProfile}>
            <label>Name<input required minLength={2} value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} /></label>
            <label>Mobile<input type="tel" value={profileForm.mobile} onChange={(event) => setProfileForm({ ...profileForm, mobile: event.target.value })} /></label>
            <label>Email<input value={employee.email || "—"} readOnly /></label>
            <label>Employee ID<input value={employee.code || "—"} readOnly /></label>
            <button className="button dark">Save profile</button>
          </form>
          {profileNotice && <p className="employee-success" role="status">{profileNotice}</p>}
          {profileError && <p className="employee-error" role="alert">{profileError}</p>}
        </section>
        <section className="employee-card">
          <div className="employee-section-heading">
            <div><span className="eyebrow">SALES ENTRY</span><h2>Record a product sale</h2></div>
            <Package />
          </div>
          <form className="employee-sale-form" onSubmit={submitSale}>
            <label>
              Product
              <select value={selectedProduct} onChange={(event) => { setSelectedProduct(event.target.value); setSaleForm({ ...saleForm, size: "", color: "" }); }} required>
                <option value="">Select a product</option>
                {products.map((product) => (
                  <option value={product.id} key={product.id} disabled={product.stock < 1}>
                    {product.code} · {product.name} · {product.stock} in stock
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantity
              <input type="number" min="1" max={selected?.stock || 1} value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
            </label>
            {selected?.sizes?.length > 0 && (
              <label>
                Size
                <select value={saleForm.size} onChange={(event) => setSaleForm({ ...saleForm, size: event.target.value })}>
                  <option value="">Not specified</option>
                  {selected.sizes.map((size) => <option key={size}>{size}</option>)}
                </select>
              </label>
            )}
            {selected?.colors?.length > 0 && (
              <label>
                Colour
                <select value={saleForm.color} onChange={(event) => setSaleForm({ ...saleForm, color: event.target.value })}>
                  <option value="">Not specified</option>
                  {selected.colors.map((color) => <option key={color}>{color}</option>)}
                </select>
              </label>
            )}
            <label>
              Selling price
              <input value={selected ? money(sellingPriceOf(selected)) : "Select a product"} readOnly />
            </label>
            <label>
              Total
              <input value={selected ? money(sellingPriceOf(selected) * Number(quantity || 0)) : "—"} readOnly />
            </label>
            <label>
              Customer name
              <input value={saleForm.customerName} onChange={(event) => setSaleForm({ ...saleForm, customerName: event.target.value })} placeholder="Walk-in Customer" />
            </label>
            <label>
              Customer mobile
              <input type="tel" value={saleForm.customerMobile} onChange={(event) => setSaleForm({ ...saleForm, customerMobile: event.target.value })} placeholder="Optional" />
            </label>
            <label>
              Payment method
              <select value={saleForm.paymentMethod} onChange={(event) => setSaleForm({ ...saleForm, paymentMethod: event.target.value })}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Amount received
              <input type="number" min="0" step="0.01" value={saleForm.amountReceived} onChange={(event) => setSaleForm({ ...saleForm, amountReceived: event.target.value })} placeholder={selected ? `Defaults to ${money(sellingPriceOf(selected) * Number(quantity || 0))}` : "Optional"} />
            </label>
            {saleForm.paymentMethod !== "cash" && (
              <label>
                Payment reference
                <input value={saleForm.paymentReference} onChange={(event) => setSaleForm({ ...saleForm, paymentReference: event.target.value })} placeholder="UPI / card reference" />
              </label>
            )}
            <p className="employee-identity"><UserRound size={15} /> Sale will be attached to <b>{employee.code} · {employee.name}</b></p>
            <button className="button dark" disabled={!selected || selected.stock < 1}>RECORD SALE</button>
          </form>
          {notice && <p className="employee-success" role="status">{notice}</p>}
          {error && <p className="employee-error" role="alert">{error}</p>}
        </section>
        <section className="employee-sales-summary">
          {[["Today's sales", todaySales], ["This week's sales", weeklySales], ["This month's sales", monthlySales]].map(([label, sales]) => (
            <div className="employee-card employee-stat" key={label}>
              <small>{label}</small><b>{money(sales.reduce((sum, item) => sum + item.totalAmount, 0))}</b>
              <span>{sales.reduce((sum, item) => sum + item.quantity, 0)} products sold</span>
            </div>
          ))}
        </section>
        <section className="employee-card">
          <div className="employee-section-heading"><div><span className="eyebrow">MY PERFORMANCE</span><h2>Your progress</h2></div><BarChart3 /></div>
          <div className="employee-performance-grid">
            <div><small>Total sales</small><b>{money(mySales.reduce((sum, item) => sum + item.totalAmount, 0))}</b></div>
            <div><small>Products sold</small><b>{totalSold}</b></div>
            <div><small>Attendance this month</small><b>{!myAttendance.length ? "—" : thisMonthWorkDays ? `${Math.round((myAttendance.filter((item) => item.date >= monthStart && item.date <= date).length / thisMonthWorkDays) * 100)}%` : "—"}</b></div>
          </div>
        </section>
        <section className="employee-card">
          <div className="employee-section-heading"><div><span className="eyebrow">MY SALES</span><h2>Recent sales</h2></div><Link to="/employee/dashboard#sales-history">View history</Link></div>
          <div className="employee-table-wrap" id="sales-history">
            <table><thead><tr><th>Date & time</th><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
              <tbody>{mySales.slice(0, 10).map((sale) => <tr key={sale.id}><td>{dateTimeLabel(sale.soldAt)}</td><td>{sale.productCode}<small>{sale.productName}</small></td><td>{sale.quantity}</td><td>{money(sale.sellingPrice)}</td><td>{money(sale.totalAmount)}</td></tr>)}</tbody>
            </table>
            {!mySales.length && <p className="employee-empty">Your sales will appear here after you record them.</p>}
          </div>
        </section>
        <section className="employee-card">
          <div className="employee-section-heading"><div><span className="eyebrow">MY ATTENDANCE</span><h2>Attendance history</h2></div><ClipboardCheck /></div>
          <div className="employee-table-wrap">
            <table><thead><tr><th>Date</th><th>Check in</th><th>Check out</th><th>Working hours</th><th>Status</th></tr></thead>
              <tbody>{myAttendance.slice(0, 15).map((record) => <tr key={record.id}><td>{record.date}</td><td>{timeLabel(record.checkInAt)}</td><td>{timeLabel(record.checkOutAt)}</td><td>{hoursLabel(hoursFor(record))}</td><td>{record.checkOutAt ? "Completed" : "On shift"}</td></tr>)}</tbody>
            </table>
            {!myAttendance.length && <p className="employee-empty">Check in to start your attendance history.</p>}
          </div>
        </section>
        <p className="employee-privacy-note">Sales are recorded in the backend. Attendance actions are unavailable because the supplied backend has no attendance endpoints yet.</p>
      </div>
    </main>
  );
}

function AdminFeatureLayout({ title, children }) {
  const { logout } = useStore();
  const navigate = useNavigate();
  const links = [
    ["/admin", "Overview", LayoutDashboard],
    ["/admin/employees", "Employees", Users],
    ["/admin/attendance", "Attendance", ClipboardCheck],
    ["/admin/employee-sales", "Sales analysis", ChartNoAxesCombined],
    ["/admin/performance", "Performance", BarChart3],
    ["/admin/employee-reports", "Reports", Download],
  ];
  return (
    <div className="employee-admin-layout">
      <aside className="employee-admin-sidebar">
        <Link to="/admin" className="admin-logo"><img src="/images/hyni-logo.png" alt="Hyni Fashion Studio" /><span>Studio Admin</span></Link>
        <span className="admin-label">TEAM MANAGEMENT</span>
        {links.map(([to, label, Icon]) => <Link key={to} to={to}><Icon size={17} />{label}</Link>)}
        <Link to="/admin/products"><Package size={17} />Products</Link>
        <Link to="/" className="employee-admin-store">View storefront</Link>
        <button className="employee-admin-signout" onClick={() => { logout(); navigate("/login"); }}><LogOut size={17} />Sign out</button>
      </aside>
      <section className="employee-admin-main">
        <header className="employee-admin-top"><div><span className="eyebrow">H Y N I / ADMIN</span><h2>{title}</h2></div><span className="demo-chip">BACKEND CONNECTED</span></header>
        <div className="employee-admin-content">{children}</div>
      </section>
    </div>
  );
}

const emptyEmployeeForm = {
  code: "",
  name: "",
  phone: "",
  email: "",
  designation: "",
  department: "",
  joiningDate: today(),
  password: "",
  permissions: [],
};

export function AdminEmployees() {
  const { employees, addEmployee, updateEmployee, setEmployeeStatus, resetEmployeePassword } = useStore();
  const [form, setForm] = useState(emptyEmployeeForm);
  const [editing, setEditing] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [permissionOptions, setPermissionOptions] = useState([]);
  useEffect(() => {
    api.employeePermissions()
      .then((result) => setPermissionOptions(result.permissions || []))
      .catch(() => setPermissionOptions([]));
  }, []);
  const visibleEmployees = employees.filter((item) =>
    `${item.code} ${item.name} ${item.email} ${item.designation}`.toLowerCase().includes(search.toLowerCase()),
  );
  const submit = async (event) => {
    event.preventDefault();
    setNotice("");
    setError("");
    try {
      if (editing) {
        const { password, ...details } = form;
        await updateEmployee(editing, details);
        setNotice("Employee details updated.");
      } else {
        if (!form.password || form.password.length < 8) throw new Error("Set a password with at least 8 characters.");
        await addEmployee(form);
        setNotice("Employee account created. The backend generated the employee ID; use the employee email to sign in.");
      }
      setForm(emptyEmployeeForm);
      setEditing("");
    } catch (formError) {
      setError(formError.message);
    }
  };
  return (
    <AdminFeatureLayout title="Employee management">
      <div className="employee-admin-intro"><div><span className="eyebrow">TEAM DIRECTORY</span><h1>Employees</h1><p>Add and maintain employee accounts. Employee codes must be unique.</p></div><span>{employees.length} team members</span></div>
      <section className="employee-admin-card">
        <h2>{editing ? "Edit employee" : "Add employee"}</h2>
        <form className="employee-admin-form" onSubmit={submit}>
          <label>Employee ID (assigned by backend)<input value={form.code} disabled placeholder="Generated after account creation" /></label>
          <label>Full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Phone<input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <label>Email<input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Role / designation<input required value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} placeholder="Boutique Associate" /></label>
          <label>Department<input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} placeholder="Sales, Operations, Studio" /></label>
          <label>Joining date<input type="date" required value={form.joiningDate} onChange={(event) => setForm({ ...form, joiningDate: event.target.value })} /></label>
          <fieldset className="permission-fieldset">
            <legend>Employee permissions</legend>
            {permissionOptions.length ? permissionOptions.map((permission) => (
              <label key={permission}>
                <input
                  type="checkbox"
                  checked={(form.permissions || []).includes(permission)}
                  onChange={(event) => setForm({
                    ...form,
                    permissions: event.target.checked
                      ? [...(form.permissions || []), permission]
                      : (form.permissions || []).filter((item) => item !== permission),
                  })}
                />
                {permission}
              </label>
            )) : <small>Permissions could not be loaded from the backend.</small>}
          </fieldset>
          {!editing && <label>Initial password<input type="password" minLength="8" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" /></label>}
          <div className="employee-form-actions"><button className="button dark"><Plus size={16} />{editing ? "Save changes" : "Add employee"}</button>{editing && <button className="button outline" type="button" onClick={() => { setEditing(""); setForm(emptyEmployeeForm); }}>Cancel</button>}</div>
        </form>
        {notice && <p className="employee-success" role="status">{notice}</p>}{error && <p className="employee-error" role="alert">{error}</p>}
      </section>
      <section className="employee-admin-card">
        <div className="employee-admin-table-heading"><h2>Employee list</h2><input className="table-search" placeholder="Search employees..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="employee-table-wrap"><table><thead><tr><th>Employee</th><th>Contact</th><th>Role</th><th>Joining date</th><th>Account</th><th>Actions</th></tr></thead>
          <tbody>{visibleEmployees.map((employee) => <tr key={employee.id}>
            <td><b>{employee.code}</b><small>{employee.name}</small></td><td>{employee.phone || "—"}<small>{employee.email || "—"}</small></td><td>{employee.designation}<small>{employee.department || ""}</small></td><td>{employee.joiningDate}</td><td><span className={`employee-status ${employee.status === "Active" ? "is-active" : "is-disabled"}`}>{employee.status}</span><small>{(employee.permissions || []).length} permissions</small></td>
            <td><div className="employee-row-actions">
              <button onClick={() => { setEditing(employee.id); setForm({ ...emptyEmployeeForm, ...employee, password: "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
              <button onClick={async () => { try { await setEmployeeStatus(employee.id, employee.status === "Active" ? "Disabled" : "Active"); setNotice(`${employee.code} account status updated.`); setError(""); } catch (e) { setError(e.message); } }}>{employee.status === "Active" ? "Disable" : "Enable"}</button>
              <button disabled title="Password reset endpoint is not included in the backend">Password reset unavailable</button>
            </div></td>
          </tr>)}</tbody>
        </table>{!visibleEmployees.length && <p className="employee-empty">No employees match this search.</p>}</div>
      </section>
    </AdminFeatureLayout>
  );
}

export function AdminAttendanceAnalysis() {
  const { attendance, employees } = useStore();
  const [period, setPeriod] = useState("This month");
  const [start, setStart] = useState(`${today().slice(0, 7)}-01`);
  const [end, setEnd] = useState(today());
  const [employeeId, setEmployeeId] = useState("all");
  const range = rangeFor(period, start, end);
  const included = employeeId === "all" ? employees : employees.filter((item) => item.id === employeeId);
  const records = attendance.filter((item) => within(item.date, range.start, range.end) && included.some((employee) => employee.id === item.employeeId));
  const activeIncluded = included.filter((employee) => employee.status === "Active");
  const todayRecords = attendance.filter((item) => item.date === today() && included.some((employee) => employee.id === item.employeeId));
  const presentToday = todayRecords.filter((item) => activeIncluded.some((employee) => employee.id === item.employeeId));
  const absentToday = attendance.length ? activeIncluded.filter((employee) => !presentToday.some((item) => item.employeeId === employee.id)) : [];
  const loggedIn = presentToday.filter((item) => !item.checkOutAt);
  const summaries = included.map((employee) => {
    const employeeRecords = records.filter((item) => item.employeeId === employee.id);
    const eligibleStart = employee.joiningDate > range.start ? employee.joiningDate : range.start;
    const workDays = weekdaysInRange(eligibleStart, expectedWorkEnd(employee, range.end));
    const presentDays = new Set(employeeRecords.map((item) => item.date)).size;
    return {
      employee,
      presentDays,
      absentDays: employee.status === "Active" ? Math.max(0, workDays - presentDays) : 0,
      totalHours: employeeRecords.reduce((sum, item) => sum + hoursFor(item), 0),
      workDays,
    };
  });
  const lateRecords = records.filter((item) => new Date(item.checkInAt).getHours() * 60 + new Date(item.checkInAt).getMinutes() > 600);
  const earlyRecords = records.filter((item) => item.checkOutAt && (new Date(item.checkOutAt).getHours() * 60 + new Date(item.checkOutAt).getMinutes() < 1080));
  const exportRows = records.map((item) => [item.employeeCode, item.employeeName, item.date, dateTimeLabel(item.checkInAt), dateTimeLabel(item.checkOutAt), hoursFor(item).toFixed(2), item.status]);
  return (
    <AdminFeatureLayout title="Attendance analysis">
      <div className="employee-admin-intro"><div><span className="eyebrow">PRESENCE & WORKING HOURS</span><h1>Attendance</h1><p>Late arrivals are check-ins after 10:00; early logouts are check-outs before 18:00.</p></div><button className="button outline" onClick={() => makeCsv("hyni-attendance.csv", ["Employee code", "Employee name", "Date", "Check in", "Check out", "Working hours", "Status"], exportRows)}><Download size={15} /> Export CSV</button></div>
      <p className="employee-error" role="status">Attendance data is unavailable because the supplied backend has no attendance model or endpoints. The figures below remain empty until attendance APIs are added.</p>
      {periodControls(period, setPeriod, start, setStart, end, setEnd, employees, employeeId, setEmployeeId)}
      <div className="employee-kpi-grid">
        {[["Present today", presentToday.length], ["Absent today", absentToday.length], ["Currently logged in", loggedIn.length], ["Late arrivals in range", lateRecords.length], ["Early logouts in range", earlyRecords.length]].map(([label, value]) => <div className="employee-admin-card employee-admin-kpi" key={label}><small>{label}</small><b>{value}</b></div>)}
      </div>
      <section className="employee-admin-card"><div className="employee-admin-table-heading"><h2>Today's attendance</h2><span>{today()}</span></div>
        <div className="employee-table-wrap"><table><thead><tr><th>Employee</th><th>Check in</th><th>Check out</th><th>Working hours</th><th>Status</th><th>Arrival</th><th>Logout</th></tr></thead><tbody>
          {included.filter((employee) => todayRecords.some((item) => item.employeeId === employee.id)).map((employee) => {
            const record = todayRecords.find((item) => item.employeeId === employee.id);
            return <tr key={employee.id}><td><b>{employee.code}</b><small>{employee.name}</small></td><td>{timeLabel(record.checkInAt)}</td><td>{timeLabel(record.checkOutAt)}</td><td>{hoursLabel(hoursFor(record))}</td><td>{record.checkOutAt ? "Completed" : "Logged in"}</td><td>{new Date(record.checkInAt).getHours() * 60 + new Date(record.checkInAt).getMinutes() > 600 ? "Late" : "On time"}</td><td>{record.checkOutAt && new Date(record.checkOutAt).getHours() * 60 + new Date(record.checkOutAt).getMinutes() < 1080 ? "Early" : record.checkOutAt ? "On time" : "—"}</td></tr>;
          })}
        </tbody></table>
          {absentToday.map((employee) => <p className="employee-absence" key={employee.id}><b>{employee.code} · {employee.name}</b> — Absent today</p>)}
        </div>
      </section>
      <section className="employee-admin-card"><div className="employee-admin-table-heading"><h2>Attendance summary</h2><span>{range.start} to {range.end}</span></div>
        <div className="employee-table-wrap"><table><thead><tr><th>Employee</th><th>Present days</th><th>Absent days</th><th>Total working hours</th><th>Average working hours</th></tr></thead><tbody>{summaries.map((summary) => <tr key={summary.employee.id}><td><b>{summary.employee.code}</b><small>{summary.employee.name}</small></td><td>{summary.presentDays}</td><td>{summary.absentDays}</td><td>{hoursLabel(summary.totalHours)}</td><td>{hoursLabel(summary.presentDays ? summary.totalHours / summary.presentDays : 0)}</td></tr>)}</tbody></table>{!summaries.length && <p className="employee-empty">No active employees to show.</p>}</div>
      </section>
      <section className="employee-admin-card"><h2>Attendance history</h2><div className="employee-table-wrap"><table><thead><tr><th>Employee</th><th>Date</th><th>Check in</th><th>Check out</th><th>Working hours</th><th>Status</th></tr></thead><tbody>{records.slice().sort((a, b) => b.date.localeCompare(a.date)).map((item) => <tr key={item.id}><td><b>{item.employeeCode}</b><small>{item.employeeName}</small></td><td>{item.date}</td><td>{timeLabel(item.checkInAt)}</td><td>{timeLabel(item.checkOutAt)}</td><td>{hoursLabel(hoursFor(item))}</td><td>{item.checkOutAt ? "Completed" : "Logged in"}</td></tr>)}</tbody></table>{!records.length && <p className="employee-empty">No attendance for this date range.</p>}</div></section>
    </AdminFeatureLayout>
  );
}

export function AdminSalesAnalysis() {
  const { employeeSales, employees, products } = useStore();
  const [period, setPeriod] = useState("This month");
  const [start, setStart] = useState(`${today().slice(0, 7)}-01`);
  const [end, setEnd] = useState(today());
  const [employeeId, setEmployeeId] = useState("all");
  const [productId, setProductId] = useState("all");
  const [category, setCategory] = useState("all");
  const range = rangeFor(period, start, end);
  const rows = employeeSales.filter((item) =>
    within(saleDate(item), range.start, range.end) &&
    (employeeId === "all" || item.employeeId === employeeId) &&
    (productId === "all" || item.productId === productId) &&
    (category === "all" || item.category === category),
  );
  const total = rows.reduce((sum, item) => sum + item.totalAmount, 0);
  const units = rows.reduce((sum, item) => sum + item.quantity, 0);
  const byEmployee = Object.values(rows.reduce((groups, item) => {
    groups[item.employeeId] ||= { id: item.employeeId, code: item.employeeCode, name: item.employeeName, sales: 0, units: 0 };
    groups[item.employeeId].sales += item.totalAmount;
    groups[item.employeeId].units += item.quantity;
    return groups;
  }, {})).sort((a, b) => b.sales - a.sales);
  const byDimension = (key, label) => Object.values(rows.reduce((groups, item) => {
    const id = item[key];
    groups[id] ||= { label: item[label], sales: 0, units: 0 };
    groups[id].sales += item.totalAmount;
    groups[id].units += item.quantity;
    return groups;
  }, {})).sort((a, b) => b.sales - a.sales);
  const byProduct = byDimension("productId", "productName");
  const byCategory = byDimension("category", "category");
  const byDate = Object.values(rows.reduce((groups, item) => {
    const day = saleDate(item);
    groups[day] ||= { label: day, sales: 0, units: 0 };
    groups[day].sales += item.totalAmount;
    groups[day].units += item.quantity;
    return groups;
  }, {})).sort((a, b) => a.label.localeCompare(b.label));
  const exportRows = rows.map((item) => [item.employeeCode, item.employeeName, item.productCode, item.productName, item.category, item.quantity, item.sellingPrice, item.totalAmount, item.paymentMethod, item.customerName, item.customerMobile, dateTimeLabel(item.soldAt)]);
  const salesTable = (heading, data) => (
    <section className="employee-admin-card"><h2>{heading}</h2><div className="employee-table-wrap"><table><thead><tr><th>Name</th><th>Products sold</th><th>Total sales</th></tr></thead><tbody>{data.map((item) => <tr key={item.id || item.label}><td>{item.code ? <><b>{item.code}</b><small>{item.name}</small></> : item.label}</td><td>{item.units}</td><td>{money(item.sales)}</td></tr>)}</tbody></table>{!data.length && <p className="employee-empty">No sales in this date range.</p>}</div></section>
  );
  return (
    <AdminFeatureLayout title="Sales analysis">
      <div className="employee-admin-intro"><div><span className="eyebrow">EMPLOYEE SALES</span><h1>Sales analysis</h1><p>Sales are linked automatically to the signed-in employee and reduce product stock.</p></div><button className="button outline" onClick={() => makeCsv("hyni-employee-sales.csv", ["Employee code", "Employee name", "Product code", "Product", "Category", "Quantity", "Unit price", "Total", "Payment method", "Customer", "Customer mobile", "Date & time"], exportRows)}><Download size={15} /> Export CSV</button></div>
      {periodControls(period, setPeriod, start, setStart, end, setEnd, employees, employeeId, setEmployeeId)}
      <div className="employee-filters employee-extra-filters"><label>Product<select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="all">All products</option>{products.map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{[...new Set(products.map((item) => item.category))].map((item) => <option key={item}>{item}</option>)}</select></label></div>
      <div className="employee-kpi-grid"><div className="employee-admin-card employee-admin-kpi"><small>Total sales</small><b>{money(total)}</b></div><div className="employee-admin-card employee-admin-kpi"><small>Products sold</small><b>{units}</b></div><div className="employee-admin-card employee-admin-kpi"><small>Transactions</small><b>{rows.length}</b></div></div>
      <div className="employee-ranking"><div className="employee-admin-card"><h2>Top performing employees</h2>{byEmployee.slice(0, 10).map((item, index) => <div className="employee-ranking-row" key={item.id}><b>{index + 1}</b><span>{item.code}<small>{item.name}</small></span><strong>{money(item.sales)}</strong></div>)}{!byEmployee.length && <p className="employee-empty">No recorded sales yet.</p>}</div><div>{salesTable("Sales by product", byProduct)}{salesTable("Sales by category", byCategory)}</div></div>
      {salesTable("Daily sales", byDate)}
      <section className="employee-admin-card"><h2>All employee sales</h2><div className="employee-table-wrap"><table><thead><tr><th>Date & time</th><th>Employee</th><th>Product</th><th>Category</th><th>Quantity</th><th>Unit price</th><th>Total</th><th>Payment</th><th>Customer</th></tr></thead><tbody>{rows.slice().sort((a, b) => b.soldAt.localeCompare(a.soldAt)).map((item) => <tr key={item.id}><td>{dateTimeLabel(item.soldAt)}</td><td><b>{item.employeeCode}</b><small>{item.employeeName}</small></td><td>{item.productCode}<small>{item.productName}</small></td><td>{item.category || "—"}</td><td>{item.quantity}</td><td>{money(item.sellingPrice)}</td><td>{money(item.totalAmount)}</td><td>{item.paymentMethod || "—"}</td><td>{item.customerName || "Walk-in"}<small>{item.customerMobile || ""}</small></td></tr>)}</tbody></table>{!rows.length && <p className="employee-empty">No sales for the selected filters.</p>}</div></section>
    </AdminFeatureLayout>
  );
}

export function AdminEmployeePerformance() {
  const { employees, attendance, employeeSales } = useStore();
  const [period, setPeriod] = useState("This month");
  const [start, setStart] = useState(`${today().slice(0, 7)}-01`);
  const [end, setEnd] = useState(today());
  const [employeeId, setEmployeeId] = useState("all");
  const range = rangeFor(period, start, end);
  const visible = employeeId === "all" ? employees : employees.filter((item) => item.id === employeeId);
  const rows = visible.map((employee) => {
    const sales = employeeSales.filter((item) => item.employeeId === employee.id && within(saleDate(item), range.start, range.end));
    const records = attendance.filter((item) => item.employeeId === employee.id && within(item.date, range.start, range.end));
    const units = sales.reduce((sum, item) => sum + item.quantity, 0);
    const totalSales = sales.reduce((sum, item) => sum + item.totalAmount, 0);
    const hours = records.reduce((sum, item) => sum + hoursFor(item), 0);
    const days = new Set(records.map((item) => item.date)).size;
    const eligibleStart = employee.joiningDate > range.start ? employee.joiningDate : range.start;
    const workDays = weekdaysInRange(eligibleStart, expectedWorkEnd(employee, range.end));
    return { employee, sales, units, totalSales, hours, days, workDays, attendancePercent: workDays ? Math.min(100, (days / workDays) * 100) : 0 };
  }).sort((a, b) => b.totalSales - a.totalSales);
  const csvRows = rows.map((item) => [item.employee.code, item.employee.name, item.totalSales, item.units, item.days ? item.totalSales / item.days : 0, item.hours.toFixed(2), `${item.attendancePercent.toFixed(1)}%`, item.days ? item.totalSales / item.days : 0]);
  return (
    <AdminFeatureLayout title="Employee performance">
      <div className="employee-admin-intro"><div><span className="eyebrow">SALES MEETS ATTENDANCE</span><h1>Employee performance</h1><p>Compare sales, attendance and working hours for the selected period.</p></div><button className="button outline" onClick={() => makeCsv("hyni-monthly-employee-performance.csv", ["Employee code", "Name", "Total sales", "Products sold", "Average daily sales", "Working hours", "Attendance", "Sales per working day"], csvRows)}><Download size={15} /> Export CSV</button></div>
      {periodControls(period, setPeriod, start, setStart, end, setEnd, employees, employeeId, setEmployeeId)}
      <section className="employee-admin-card"><div className="employee-admin-table-heading"><h2>Performance summary</h2><span>{range.start} to {range.end}</span></div><div className="employee-table-wrap"><table><thead><tr><th>Employee</th><th>Total sales</th><th>Products sold</th><th>Average daily sales</th><th>Working hours</th><th>Attendance</th><th>Sales / working day</th></tr></thead><tbody>
        {rows.map((item) => <tr key={item.employee.id}><td><b>{item.employee.code}</b><small>{item.employee.name}</small></td><td>{money(item.totalSales)}</td><td>{item.units}</td><td>{money(item.days ? item.totalSales / item.days : 0)}</td><td>{hoursLabel(item.hours)}</td><td>{item.attendancePercent.toFixed(1)}%</td><td>{money(item.days ? item.totalSales / item.days : 0)}</td></tr>)}
      </tbody></table>{!rows.length && <p className="employee-empty">No employees match this filter.</p>}</div></section>
      <div className="employee-ranking">{rows.slice(0, 3).map((item, index) => <div className="employee-admin-card employee-admin-kpi" key={item.employee.id}><small>#{index + 1} · {item.employee.name}</small><b>{money(item.totalSales)}</b><span>{item.units} products sold</span></div>)}</div>
    </AdminFeatureLayout>
  );
}

export function AdminEmployeeReports() {
  const { employees, attendance, employeeSales } = useStore();
  const reportEmployees = employees;
  const monthStart = `${today().slice(0, 7)}-01`;
  const attendanceRows = attendance.map((item) => [item.employeeCode, item.employeeName, item.date, dateTimeLabel(item.checkInAt), dateTimeLabel(item.checkOutAt), hoursFor(item).toFixed(2), item.status]);
  const salesRows = employeeSales.map((item) => [item.employeeCode, item.employeeName, item.productCode, item.productName, item.category, item.quantity, item.sellingPrice, item.totalAmount, dateTimeLabel(item.soldAt)]);
  const productRows = Object.values(employeeSales.reduce((groups, item) => {
    groups[item.productId] ||= { code: item.productCode, name: item.productName, category: item.category, quantity: 0, total: 0 };
    groups[item.productId].quantity += item.quantity;
    groups[item.productId].total += item.totalAmount;
    return groups;
  }, {})).map((item) => [item.code, item.name, item.category, item.quantity, item.total]);
  const performanceRows = reportEmployees.map((employee) => {
    const sales = employeeSales.filter((item) => item.employeeId === employee.id && within(saleDate(item), monthStart, today()));
    const records = attendance.filter((item) => item.employeeId === employee.id && within(item.date, monthStart, today()));
    const totalSales = sales.reduce((sum, item) => sum + item.totalAmount, 0);
    const days = new Set(records.map((item) => item.date)).size;
    const eligibleStart = employee.joiningDate > monthStart ? employee.joiningDate : monthStart;
    const workDays = weekdaysInRange(eligibleStart, expectedWorkEnd(employee, today()));
    const hours = records.reduce((sum, item) => sum + hoursFor(item), 0);
    return [employee.code, employee.name, totalSales, sales.reduce((sum, item) => sum + item.quantity, 0), days ? totalSales / days : 0, hours.toFixed(2), workDays ? `${Math.min(100, Math.round((days / workDays) * 100))}%` : "0%", days ? totalSales / days : 0];
  });
  const reports = [
    ["Employee attendance", "Attendance records with check-in, checkout and hours", "hyni-employee-attendance.csv", ["Employee code", "Employee name", "Date", "Check in", "Check out", "Working hours", "Status"], attendanceRows],
    ["Employee sales", "Every employee sale with product, quantity and amount", "hyni-employee-sales.csv", ["Employee code", "Employee name", "Product code", "Product", "Category", "Quantity", "Unit price", "Total", "Sale date"], salesRows],
    ["Product sales", "Sales quantities and revenue grouped by product", "hyni-product-sales.csv", ["Product code", "Product", "Category", "Quantity sold", "Total sales"], productRows],
    ["Monthly employee performance", "Current-month-to-date sales and attendance summary", "hyni-employee-performance.csv", ["Employee code", "Name", "Total sales", "Products sold", "Average daily sales", "Working hours", "Attendance", "Sales per working day"], performanceRows],
    ["Overall sales performance", "Employee sales ledger for Excel-compatible analysis", "hyni-overall-sales-performance.csv", ["Employee code", "Employee name", "Product code", "Product", "Category", "Quantity", "Unit price", "Total", "Sale date"], salesRows],
  ];
  return (
    <AdminFeatureLayout title="Employee reports">
      <div className="employee-admin-intro"><div><span className="eyebrow">DOWNLOADABLE REPORTS</span><h1>Reports</h1><p>Export CSV files that open in Excel or other spreadsheet applications.</p></div></div>
      <p className="employee-error" role="status">Attendance and audit reports stay empty because the backend has no attendance or audit-log endpoints. Sales and performance reports use live backend records.</p>
      <div className="employee-report-grid">{reports.map(([title, description, filename, headers, rows]) => <section className="employee-admin-card employee-report-card" key={title}><span className="eyebrow">CSV REPORT</span><h2>{title}</h2><p>{description}</p><small>{rows.length} records</small><button className="button dark" onClick={() => makeCsv(filename, headers, rows)}><Download size={15} /> Download CSV</button></section>)}</div>
      <section className="employee-admin-card"><h2>Audit log</h2><p>Employee sign-ins, attendance, sales and account changes are not exposed by the backend as an audit-log endpoint. Only server-backed data shown elsewhere on this page is available.</p></section>
    </AdminFeatureLayout>
  );
}
