import React from 'react';
import { useApp } from '../../context/AppContext';
import { Smartphone, Monitor, ShieldAlert, Wifi, Battery, Signal } from 'lucide-react';

interface DeviceFrameProps {
  children: React.ReactNode;
}

export const DeviceFrame: React.FC<DeviceFrameProps> = ({ children }) => {
  const { deviceMode, setDeviceMode, currentScreen } = useApp();

  // Public legal & account deletion pages (/privacy, /terms, /delete-account) render cleanly as full responsive web/mobile pages
  if (currentScreen === 'privacy_policy' || currentScreen === 'terms_conditions' || currentScreen === 'delete_account') {
    return <div className="w-full h-[100dvh] min-h-[100dvh] bg-[#09070F] overflow-hidden flex flex-col">{children}</div>;
  }

  // If in admin dashboard mode, the AdminDashboard screen handles the full layout
  if (deviceMode === 'admin') {
    return <div className="w-full min-h-screen bg-[#07040D]">{children}</div>;
  }

  // If responsive mode on desktop
  if (deviceMode === 'responsive') {
    return (
      <div className="w-full h-[100dvh] bg-[#09070F] flex flex-col overflow-hidden">
        {/* Top Desktop Helper Toolbar */}
        <div className="h-10 bg-[#0E081D] border-b border-[#A855F7]/20 px-4 flex items-center justify-between text-xs text-zinc-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-semibold text-white">ALPHA MATE Responsive Mobile Shell</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDeviceMode('mobile')}
              className="px-2.5 py-1 rounded-lg bg-[#1F1338] text-white hover:bg-[#2C1C4E] flex items-center gap-1.5 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile Frame</span>
            </button>
            <button
              onClick={() => setDeviceMode('admin')}
              className="px-2.5 py-1 rounded-lg bg-[#7928CA]/30 text-[#C084FC] hover:bg-[#7928CA]/50 flex items-center gap-1.5 cursor-pointer font-bold"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Admin Web Dashboard</span>
            </button>
          </div>
        </div>

        <div className="flex-1 w-full max-w-[420px] mx-auto overflow-hidden flex flex-col h-full min-h-0 relative">
          {children}
        </div>
      </div>
    );
  }

  // Default 'mobile' frame view (Sleek smartphone frame with dynamic island & status bar)
  return (
    <div className="h-[100dvh] min-h-[100dvh] w-full bg-[#05030A] flex flex-col items-center justify-center sm:py-4 p-0 overflow-hidden">
      {/* Top Floating View Switcher (Visible ONLY on desktop viewports) */}
      <div className="hidden sm:flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full bg-[#120B24]/90 border border-[#A855F7]/30 shadow-xl backdrop-blur-md">
        <button
          onClick={() => setDeviceMode('mobile')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
            deviceMode === 'mobile'
              ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Mobile Device</span>
        </button>

        <button
          onClick={() => setDeviceMode('responsive')}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer text-zinc-400 hover:text-white"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Full Responsive</span>
        </button>

        <button
          onClick={() => setDeviceMode('admin')}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-amber-300 hover:text-amber-200 transition-all cursor-pointer"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Admin Console</span>
        </button>
      </div>

      {/* Smartphone Outer Chassis — 100% full height & width on real mobile, constrained mockup on desktop */}
      <div className="relative w-full sm:w-[412px] h-[100dvh] sm:h-[844px] sm:max-h-[94vh] sm:rounded-[44px] bg-[#09070F] sm:border-[8px] sm:border-[#1E1438] sm:ring-1 sm:ring-[#A855F7]/40 shadow-[0_20px_60px_-15px_rgba(121,40,202,0.4)] flex flex-col overflow-hidden">
        {/* Hardware Status Bar (Only visible on desktop simulator frame, hidden on real phones to prevent double status bar) */}
        <div className="hidden sm:flex h-9 shrink-0 w-full bg-[#09070F] px-7 items-center justify-between text-[11px] font-bold text-zinc-300 select-none z-50">
          <span>9:41</span>

          {/* Dynamic Island Pill */}
          <div className="w-24 h-4.5 rounded-full bg-black border border-white/10 flex items-center justify-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#7928CA]/80 animate-pulse" />
            <span className="text-[8px] text-zinc-400 font-mono">AM</span>
          </div>

          <div className="flex items-center gap-1.5 text-zinc-400">
            <Signal className="w-3 h-3" />
            <Wifi className="w-3 h-3" />
            <Battery className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Screen Content — strictly overflow-hidden so individual screens control their scroll zones */}
        <div className="flex-1 w-full overflow-hidden relative flex flex-col h-full min-h-0">
          {children}
        </div>

        {/* Bottom Touch Bar / Home Indicator (Only visible on desktop mockup) */}
        <div className="hidden sm:flex h-3.5 shrink-0 w-full bg-[#09070F] items-center justify-center pointer-events-none z-50">
          <div className="w-28 h-1 rounded-full bg-zinc-600/70" />
        </div>
      </div>
    </div>
  );
};
