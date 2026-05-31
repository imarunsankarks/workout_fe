import React from 'react';
import { Activity } from 'lucide-react';

/**
 * Glassy loading / progress screen used across pages.
 *
 * Variants:
 *  - "page"    : full-screen self-contained loader (use as an early return).
 *  - "overlay" : fixed positioned overlay with backdrop blur, sits on top of
 *                the existing page content (use for transient success / busy
 *                states like "Exercise Added").
 *
 * Props:
 *  - icon     : lucide-react icon component. Defaults to Activity.
 *  - title    : top label, rendered uppercase wide-tracked.
 *  - caption  : bouncing helper line below the progress bar.
 *  - variant  : "page" | "overlay". Default "page".
 */
const LoadingScreen = ({
  icon: Icon = Activity,
  title = 'Loading',
  caption = 'Please wait...',
  variant = 'page',
}) => {
  const inner = (
    <>
      <div className="relative mb-8">
        <div className="absolute inset-0 rounded-full bg-accent-500/20 animate-ping duration-[2000ms]"></div>
        <div className="relative bg-white/40 dark:bg-slate-800/30 backdrop-blur-xl p-8 rounded-full shadow-xl dark:shadow-md border border-white/40 dark:border-white/10">
          <Icon size={48} className="text-accent-500 animate-pulse" />
        </div>
      </div>
      <div className="w-full max-w-[220px] text-center">
        <h2 className="text-slate-800 dark:text-slate-100 font-bold text-sm uppercase tracking-[0.3em] mb-4">
          {title}
        </h2>
        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-accent-500 rounded-full animate-progress-loading"></div>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-4 animate-bounce">
          {caption}
        </p>
      </div>
    </>
  );

  if (variant === 'overlay') {
    return (
      <div className="fixed inset-0 bg-black/20 backdrop-blur-xl z-[300] flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
        {inner}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6">
      {inner}
    </div>
  );
};

export default LoadingScreen;
