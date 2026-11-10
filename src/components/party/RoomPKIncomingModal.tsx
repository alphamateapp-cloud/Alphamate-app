import React from 'react';
import { OpponentRoomCandidate } from './RoomPKInviteModal';
import { VipAvatarFrame } from '../brand/VipAvatarFrame';
import { Swords, X, Sparkles, Check, Clock, Trophy } from 'lucide-react';

interface RoomPKIncomingModalProps {
  isOpen: boolean;
  challengerRoom: OpponentRoomCandidate;
  onAccept: () => void;
  onDecline: () => void;
}

export const RoomPKIncomingModal: React.FC<RoomPKIncomingModalProps> = ({
  isOpen,
  challengerRoom,
  onAccept,
  onDecline,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#240D3A] via-[#140726] to-[#0A0314] border-2 border-[#EC4899] shadow-[0_0_40px_rgba(236,72,153,0.4)] p-6 text-white text-center overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-20 bg-[#EC4899]/30 blur-2xl rounded-full pointer-events-none" />

        {/* Pulsing Crossed Swords Visual */}
        <div className="relative inline-flex items-center justify-center my-2">
          <div className="w-18 h-18 rounded-3xl bg-gradient-to-tr from-[#EC4899] via-[#9333EA] to-[#3B82F6] flex items-center justify-center shadow-xl shadow-[#EC4899]/50 animate-bounce">
            <Swords className="w-9 h-9 text-white stroke-[2.5]" />
          </div>
          <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-[#F59E0B] text-black font-black text-[9px] uppercase tracking-wider shadow">
            5 MINS PK
          </span>
        </div>

        {/* Title Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EC4899]/20 border border-[#EC4899]/40 text-[#EC4899] text-xs font-bold my-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>INCOMING ROOM BATTLE!</span>
        </div>

        <h3 className="text-lg font-black text-white tracking-tight mb-1">
          Room vs Room Challenge!
        </h3>

        <p className="text-xs text-zinc-300 leading-relaxed mb-4">
          Another host has challenged your room to a 5-minute split-screen battle!
        </p>

        {/* Challenger Card */}
        <div className="p-3.5 rounded-2xl bg-[#1B0D30]/90 border border-[#EC4899]/40 flex items-center gap-3 text-left mb-5 shadow-inner">
          <div className="relative shrink-0">
            <VipAvatarFrame
              avatarUrl={challengerRoom.host.avatar}
              vipTier={challengerRoom.host.vipTier || 4}
              size="sm"
            />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-pink-400 font-bold uppercase tracking-wider block">
              Challenging Room
            </span>
            <h4 className="text-xs font-black text-white truncate">
              {challengerRoom.title}
            </h4>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-400">
              <span className="text-zinc-300 font-semibold truncate">{challengerRoom.host.displayName}</span>
              <span>•</span>
              <span className="text-amber-300 font-bold">
                {challengerRoom.level === 1 ? '4-Seat Room' : '8-Seat Room'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Highlights */}
        <div className="grid grid-cols-2 gap-2 text-left mb-5">
          <div className="p-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="text-[10px] leading-tight">
              <span className="font-bold text-white block">5 Mins</span>
              <span className="text-zinc-400">Tug-of-war timer</span>
            </div>
          </div>
          <div className="p-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="text-[10px] leading-tight">
              <span className="font-bold text-white block">Gifting Wars</span>
              <span className="text-zinc-400">Top room wins</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={onAccept}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#EC4899] via-[#9333EA] to-[#7928CA] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#EC4899]/40 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Accept Room PK Battle ⚔️</span>
          </button>

          <button
            onClick={onDecline}
            className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Decline Challenge
          </button>
        </div>
      </div>
    </div>
  );
};
