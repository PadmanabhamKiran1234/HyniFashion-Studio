import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

export default function ConfirmModal({
  mode = 'confirm',
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  fields = [],
  onConfirm,
  onCancel,
}) {
  const initialValues = useMemo(() => {
    const values = {};
    fields.forEach((field) => {
      values[field.name] = field.defaultValue ?? '';
    });
    return values;
  }, [fields]);

  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const firstFieldRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    setValues(initialValues);
    setError('');
    setBusy(false);
    const timer = window.setTimeout(() => {
      (firstFieldRef.current || modalRef.current)?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [initialValues]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const submit = (event) => {
    event.preventDefault();
    if (busy) return;

    const payload = {};
    for (const field of fields) {
      const raw = values[field.name];
      const value = field.type === 'number' ? Number(raw) : String(raw ?? '');
      if (field.required !== false && String(value).trim() === '') {
        setError(`${field.label} is required.`);
        return;
      }
      if (field.minLength && String(value).trim().length < field.minLength) {
        setError(`${field.label} must contain at least ${field.minLength} characters.`);
        return;
      }
      if (field.maxLength && String(value).trim().length > field.maxLength) {
        setError(`${field.label} must not exceed ${field.maxLength} characters.`);
        return;
      }
      payload[field.name] = field.type === 'number' ? value : String(value).trim();
    }

    setError('');
    setBusy(true);
    try {
      const result = onConfirm(mode === 'prompt' ? payload : undefined);
      if (result && typeof result.then === 'function') {
        result
          .catch((submitError) => {
            setError(submitError.message || 'Something went wrong.');
          })
          .finally(() => setBusy(false));
      } else {
        setBusy(false);
      }
    } catch (submitError) {
      setError(submitError.message || 'Something went wrong.');
      setBusy(false);
    }
  };

  const trapFocus = (event) => {
    if (event.key !== 'Tab') return;
    const focusable = modalRef.current?.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled])',
    );
    if (!focusable?.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
      <form
        className="modal-card"
        ref={modalRef}
        onSubmit={submit}
        onKeyDown={trapFocus}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        {message && <p className="modal-message">{message}</p>}

        {mode === 'prompt' && (
          <div className="modal-fields">
            {fields.map((field, index) => (
              <label key={field.name} className="modal-field">
                <span>{field.label}</span>
                {field.type === 'textarea' ? (
                  <textarea
                    ref={index === 0 ? firstFieldRef : null}
                    rows={3}
                    value={values[field.name] ?? ''}
                    placeholder={field.placeholder || ''}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [field.name]: event.target.value }))
                    }
                  />
                ) : (
                  <input
                    ref={index === 0 ? firstFieldRef : null}
                    type={field.type || 'text'}
                    value={values[field.name] ?? ''}
                    placeholder={field.placeholder || ''}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [field.name]: event.target.value }))
                    }
                  />
                )}
                {field.help && <small>{field.help}</small>}
              </label>
            ))}
          </div>
        )}

        {error && <p className="modal-error" role="alert">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="button outline" onClick={onCancel} disabled={busy}>
            {cancelText}
          </button>
          <button type="submit" className={`button ${danger ? 'danger' : 'dark'}`} disabled={busy}>
            {busy ? 'Please wait…' : confirmText}
          </button>
        </div>
      </form>
    </div>
  );
}
