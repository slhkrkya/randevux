'use client';
import React, { createContext, useCallback, useContext, useState } from 'react';

type Variant = 'default' | 'success' | 'warning' | 'error';
type Toast = { id: string; title: string; description?: string; variant?: Variant };

type Ctx = {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  remove: (id: string) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, ...t }]);
    // otomatik kapanma
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  return (
    <ToastCtx.Provider value={{ toasts, push, remove }}>
      {children}
      {/* viewport */}
      <div className="fixed right-4 bottom-4 z-[9999] space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              'w-[320px] rounded-2xl px-4 py-3 shadow-xl border backdrop-blur bg-white/80 text-slate-800',
              'dark:bg-slate-900/80 dark:text-slate-100 dark:border-slate-700',
              t.variant === 'success' && 'border-emerald-500/30',
              t.variant === 'warning' && 'border-amber-500/30',
              t.variant === 'error'   && 'border-rose-500/30',
            ].filter(Boolean).join(' ')}>
            <div className="text-sm font-semibold leading-tight">{t.title}</div>
            {t.description && (
              <div className="mt-1 text-xs opacity-80">{t.description}</div>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast() must be used inside <ToastProvider>');
  return ctx;
}