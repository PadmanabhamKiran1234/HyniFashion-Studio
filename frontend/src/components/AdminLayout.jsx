import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Boxes,
  ChartNoAxesCombined,
  ClipboardList,
  CreditCard,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  ShoppingBag,
  Tag,
  Users,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';

const links = [
  ['/admin', 'Overview', LayoutDashboard],
  ['/admin/reports', 'Sales reports', ChartNoAxesCombined],
  ['/admin/payments', 'Payment verification', CreditCard],
  ['/admin/employee-reports', 'Employee reports', ClipboardList],
  ['/admin/employees', 'Employees', Users],
  ['/admin/attendance', 'Attendance', ClipboardList],
  ['/admin/employee-sales', 'Employee sales', IndianRupee],
  ['/admin/performance', 'Performance', ChartNoAxesCombined],
  ['/admin/products', 'Products', ShoppingBag],
  ['/admin/categories', 'Categories', Tag],
  ['/admin/inventory', 'Inventory', Boxes],
  ['/admin/orders', 'Orders', ClipboardList],
  ['/admin/customers', 'Customers', Users],
  ['/admin/discounts', 'Discounts', IndianRupee],
];

export default function AdminLayout({ children }) {
  const { logout } = useStore();
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Link to="/admin" className="admin-logo">
          <img src="/images/hyni-logo.png" alt="Hyni Fashion Studio" />
          <span>Studio Admin</span>
        </Link>
        <span className="admin-label">WORKSPACE</span>
        {links.map(([to, label, Icon]) => (
          <Link key={to} to={to}>
            <Icon size={17} /> {label}
          </Link>
        ))}
        <div className="admin-bottom">
          <Link to="/">
            <ArrowUpRight size={16} /> View storefront
          </Link>
          <button onClick={() => { logout(); window.location.href = '/login'; }}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <section className="admin-main">
        <header className="admin-top">
          <div>
            <span className="eyebrow">H Y N I / ADMIN</span>
            <h2>Studio dashboard</h2>
          </div>
          <span className="demo-chip">LIVE BACKEND</span>
        </header>
        {children}
      </section>
    </div>
  );
}
