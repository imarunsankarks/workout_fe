import React, { useEffect } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

/**
 * Reusable glassy modal. Defaults to a "confirm destructive action" shape, but
 * supports custom body content via `children` for forms / multi-step flows.
 *
 * Props:
 *  - open            : boolean — controls visibility.
 *  - onClose         : () => void — called on cancel / backdrop / Escape.
 *  - onConfirm       : () => void — called by the primary action button.
 *  - title           : string  — bold heading (e.g. "Delete Workout?").
 *  - subtitle        : string — small uppercase eyebrow above buttons / below title.
 *  - message         : string | ReactNode — supporting copy (ignored if `children`).
 *  - children        : ReactNode — custom body content (replaces `message`).
 *  - confirmLabel    : string — primary button label. Default "Delete".
 *  - cancelLabel     : string — secondary button label. Default "Cancel".
 *  - icon            : lucide icon component, or null to omit the icon header.
 *  - tone            : 'danger' | 'warning' | 'neutral'. Affects icon + primary button.
 *  - extraNote       : string — small red emphasis line below message
 *                      (e.g. "This action is irreversible.").
 *  - loading         : boolean — disables buttons + shows pending state.
 *  - error           : string — error message shown above the buttons.
 *  - hideActions     : boolean — render no buttons (status/indicator modals).
 *  - singleAction    : boolean — render only the primary button (useful for
 *                      OK / acknowledge dialogs such as inline error alerts).
 *  - dismissible     : boolean — backdrop click + Escape close. Default true.
 *  - icon            : lucide component OR a ReactElement. Element is rendered
 *                      as-is (useful for animated icons); component is wrapped
 *                      in the toned circle.
 */
const ConfirmModal = ({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  subtitle,
  message = 'This action cannot be undone.',
  children,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  icon: Icon = Trash2,
  tone = 'danger',
  extraNote,
  loading = false,
  error,
  hideActions = false,
  singleAction = false,
  dismissible = true,
}) => {
  // Escape key closes the modal.
  useEffect(() => {
    if (!open || !dismissible) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose, dismissible]);

  if (!open) return null;

  const toneStyles = {
    danger: {
      iconWrap: 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400',
      confirmBtn: 'bg-red-500 hover:bg-red-600 text-white',
    },
    warning: {
      iconWrap: 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400',
      confirmBtn: 'bg-amber-500 hover:bg-amber-600 text-white',
    },
    neutral: {
      iconWrap: 'bg-slate-100 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300',
      confirmBtn: 'bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white',
    },
    accent: {
      iconWrap: 'bg-accent-100 dark:bg-accent-500/15 text-accent-600 dark:text-accent-400',
      confirmBtn: 'bg-accent-gradient text-white shadow-accent-100',
    },
  };
  const styles = toneStyles[tone] || toneStyles.danger;
  const hasCustomBody = children !== undefined && children !== null;

  const isIconElement = React.isValidElement(Icon);

  return (
    <div
      className="fixed inset-0 bg-black/10 backdrop-blur-md z-[600] flex items-center justify-center p-6 text-center animate-in fade-in duration-200"
      onClick={dismissible ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white/70 dark:bg-black/10 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {Icon && (
          isIconElement ? (
            <div className="mx-auto mb-4 flex items-center justify-center">{Icon}</div>
          ) : (
            <div className={`${styles.iconWrap} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4`}>
              <Icon size={32} />
            </div>
          )
        )}

        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">{title}</h2>

        {subtitle && (
          <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-6">
            {subtitle}
          </p>
        )}

        {hasCustomBody ? (
          <div className="text-left mb-6">{children}</div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-2 leading-relaxed">
            {message}
          </p>
        )}

        {extraNote && (
          <p className="font-bold text-red-400 dark:text-red-300 text-xs uppercase tracking-tighter mb-6 mt-1">
            {extraNote}
          </p>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/30 animate-in fade-in slide-in-from-top-1 duration-200">
            <p className="text-red-500 dark:text-red-300 text-[10px] font-bold uppercase tracking-tight flex items-center justify-center gap-2">
              <AlertTriangle size={14} /> {error}
            </p>
          </div>
        )}

        {!hideActions && (
          <div className={`flex flex-col gap-2 ${(extraNote || hasCustomBody || error) ? '' : 'mt-6'}`}>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`w-full py-4 ${styles.confirmBtn} font-bold rounded-2xl shadow-lg dark:shadow-md active:scale-95 transition-all disabled:opacity-60 disabled:active:scale-100`}
            >
              {loading ? 'Working…' : confirmLabel}
            </button>
            {!singleAction && (
              <button
                onClick={onClose}
                disabled={loading}
                className="w-full py-4 text-slate-400 dark:text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors disabled:opacity-60"
              >
                {cancelLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export { AlertTriangle, Trash2 };
export default ConfirmModal;
