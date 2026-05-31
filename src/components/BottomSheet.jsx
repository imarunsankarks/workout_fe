import React, { useEffect } from 'react';

/**
 * Reusable glassy bottom-sheet shell. Provides the fixed overlay, glass card,
 * slide-in animation, and dismiss-on-backdrop / Escape behaviour. Page-specific
 * headers, bodies, and footers go in `children`.
 *
 * Props:
 *  - open         : boolean — visibility.
 *  - onClose      : () => void — backdrop click + Escape + your own close UI.
 *  - children     : ReactNode — full sheet body content.
 *  - maxHeight    : string — Tailwind value or CSS string for the inner card's
 *                   max-height. Default "85vh".
 *  - padding      : string — Tailwind padding class for the inner card. Default "p-8".
 *  - zIndex       : string — Tailwind z-index class. Default "z-[300]".
 *  - dismissible  : boolean — backdrop click + Escape close. Default true.
 *  - backdropClass: string — overrides the default backdrop look.
 */
const BottomSheet = ({
  open,
  onClose,
  children,
  maxHeight = '85vh',
  padding = 'p-8',
  zIndex = 'z-[300]',
  dismissible = true,
  backdropClass = 'bg-slate-900/40 backdrop-blur-2xl',
}) => {
  // Escape closes when dismissible.
  useEffect(() => {
    if (!open || !dismissible) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 ${backdropClass} ${zIndex} flex items-end justify-center animate-in fade-in duration-200`}
      onClick={dismissible ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white/70 dark:bg-black/0 backdrop-blur-2xl border border-white/40 dark:border-white/10 w-full max-w-lg rounded-t-[40px] ${padding} overflow-y-auto animate-in slide-in-from-bottom duration-300 shadow-2xl`}
        style={{ maxHeight }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default BottomSheet;
