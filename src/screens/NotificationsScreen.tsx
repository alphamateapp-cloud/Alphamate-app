import React from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Bell, Gift, Swords, Radio, UserPlus, Info, CheckCheck } from 'lucide-react';

export const NotificationsScreen: React.FC = () => {
  const { notifications, markNotificationRead, navigateBack } = useApp();

  const getIcon = (type: string) => {
    switch (type) {
      case 'gift':
        return <Gift className="w-4 h-4 text-amber-400" />;
      case 'pk_invite':
        return <Swords className="w-4 h-4 text-[#EC4899]" />;
      case 'party_invite':
        return <Radio className="w-4 h-4 text-[#A855F7]" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-emerald-400" />;
      default:
        return <Info className="w-4 h-4 text-sky-400" />;
    }
  };

  return (
    <div className="relative w-full h-full min-h-screen pb-24 bg-[#09070F] text-white overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 w-full bg-[#09070F]/85 backdrop-blur-md border-b border-[#A855F7]/15 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={navigateBack}
            className="w-8 h-8 rounded-full bg-[#1A1133] flex items-center justify-center text-zinc-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-base font-bold text-white">Notifications</span>
        </div>

        <button
          onClick={() => notifications.forEach((n) => markNotificationRead(n.id))}
          className="text-xs text-[#C084FC] hover:underline"
        >
          Mark all read
        </button>
      </div>

      {/* Notifications List */}
      <div className="p-4 space-y-2.5">
        {notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => markNotificationRead(n.id)}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              n.isRead
                ? 'bg-[#120A22] border-white/5 opacity-70'
                : 'bg-[#180E2E] border-[#A855F7]/30 shadow-md'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#231542] flex items-center justify-center shrink-0">
                {getIcon(n.type)}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white">{n.title}</h4>
                  <span className="text-[10px] text-zinc-500">{n.timestamp}</span>
                </div>
                <p className="text-xs text-zinc-300 mt-1 leading-snug">{n.message}</p>
              </div>

              {!n.isRead && (
                <span className="w-2 h-2 rounded-full bg-[#EC4899] shrink-0 mt-1.5" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
