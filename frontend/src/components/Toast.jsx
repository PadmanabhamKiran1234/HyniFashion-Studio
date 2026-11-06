import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export default function Toast({ toast, onClose }) {
  const Icon = icons[toast.type] || Info;
  return (
    <div className={`toast toast-${toast.type}`} role="status">
      <span className="toast-icon">
        <Icon size={18} />
      </span>
      <div className="toast-copy">
        {toast.title && <b>{toast.title}</b>}
        <span>{toast.message}</span>
      </div>
      <button type="button" className="toast-close" onClick={onClose} aria-label="Dismiss notification">
        <X size={14} />
      </button>
    </div>
  );
}
