import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

const ToastContext = createContext(null);

let toastSequence = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);
  const resolverRef = useRef(null);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (type, message, options = {}) => {
      const id = ++toastSequence;
      const duration = options.duration ?? (type === 'error' ? 6000 : 4000);
      const text = typeof message === 'string' ? message : message?.message || '';
      setToasts((current) => [...current, { id, type, message: text, title: options.title }]);
      if (duration > 0) {
        window.setTimeout(() => removeToast(id), duration);
      }
      return id;
    },
    [removeToast],
  );

  const closeModal = useCallback((value) => {
    setModal(null);
    if (resolverRef.current) {
      resolverRef.current(value);
      resolverRef.current = null;
    }
  }, []);

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        resolverRef.current = resolve;
        setModal({
          mode: 'confirm',
          title: options.title || 'Are you sure?',
          message: options.message || '',
          confirmText: options.confirmText || 'Confirm',
          cancelText: options.cancelText || 'Cancel',
          danger: Boolean(options.danger),
          submit: options.onSubmit,
        });
      }),
    [],
  );

  const prompt = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        resolverRef.current = resolve;
        setModal({
          mode: 'prompt',
          title: options.title || 'Enter details',
          message: options.message || '',
          confirmText: options.confirmText || 'Save',
          cancelText: options.cancelText || 'Cancel',
          danger: Boolean(options.danger),
          fields: options.fields || [],
          submit: options.onSubmit,
        });
      }),
    [],
  );

  const value = useMemo(
    () => ({
      toast: push,
      success: (message, options) => push('success', message, options),
      error: (message, options) => push('error', message, options),
      warning: (message, options) => push('warning', message, options),
      info: (message, options) => push('info', message, options),
      confirm,
      prompt,
      dismiss: removeToast,
    }),
    [push, confirm, prompt, removeToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((item) => (
          <Toast key={item.id} toast={item} onClose={() => removeToast(item.id)} />
        ))}
      </div>
      {modal && (
        <ConfirmModal
          {...modal}
          onCancel={() => closeModal(modal.mode === 'confirm' ? false : null)}
          onConfirm={async (payload) => {
            if (typeof modal.submit === 'function') {
              await modal.submit(payload);
            }
            closeModal(modal.mode === 'confirm' ? true : payload);
          }}
        />
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
