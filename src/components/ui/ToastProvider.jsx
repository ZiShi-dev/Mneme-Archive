import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { t } from "../../i18n/runtime";

const ToastContext = createContext(null);
const TOAST_DURATION_MS = 3600;
const MAX_VISIBLE_TOASTS = 3;

function ToastItem({ toast, onDismiss }) {
  const Icon = toast.type === "success" ? CheckCircle2 : toast.type === "error" ? AlertCircle : Info;

  return (
    <div
      className={`app-toast app-toast--${toast.type}`}
      role={toast.type === "error" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
    >
      <span className="app-toast__icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <p className="app-toast__message">{toast.message}</p>
      <button
        type="button"
        className="app-toast__close"
        onClick={() => onDismiss(toast.id)}
        aria-label={t("toast.close")}
      >
        <X size={15} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(({ type = "info", message }) => {
    if (!message) return null;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, type, message }].slice(-MAX_VISIBLE_TOASTS));
    const timer = setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
    timersRef.current.set(id, timer);
    return id;
  }, [dismissToast]);

  const value = useMemo(() => ({ pushToast, dismissToast }), [pushToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="app-toast-stack" aria-label={t("toast.region")}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast doit être utilisé dans ToastProvider");
  }
  return context;
}
