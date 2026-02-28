import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Show our custom button
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if the app is already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsVisible(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the browser install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // We've used the prompt, and can't use it again
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[100] animate-in slide-in-from-bottom-10 duration-500">
      <div className="bg-slate-900 text-white p-5 rounded-[32px] shadow-2xl border border-white/10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-500 p-3 rounded-2xl shadow-lg shadow-emerald-500/20">
            <Smartphone size={24} />
          </div>
          <div>
            <h4 className="font-black text-sm uppercase tracking-tight">Install GainsAI</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Add to your apps for better tracking</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleInstallClick}
            className="bg-emerald-500 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          >
            Install
          </button>
          <button 
            onClick={() => setIsVisible(false)}
            className="p-2 text-slate-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;