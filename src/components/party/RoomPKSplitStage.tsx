import React from 'react';
import { PartyRoom, PartySeat, User } from '../../types';
import { OpponentRoomCandidate } from './RoomPKInviteModal';
import { VipAvatarFrame } from '../brand/VipAvatarFrame';
import { LevelBadgeIcon } from '../brand/LevelBadgeIcon';
import {
  Swords,
  Crown,
  Flame,
  Mic,
  MicOff,
  Trophy,
  Users,
  Sparkles,
  X,
  Volume2,
} from 'lucide-react';

interface RoomPKSplitStageProps {
  myRoom: PartyRoom;
  opponentRoom: OpponentRoomCandidate;
  mySeats: PartySeat[];
  myPartyLevel: 1 | 2 | 3;
  myRoomScore: number;
  opponentRoomScore: number;
  timeLeft: number; // in seconds
  isHost: boolean;
  onEndPK: () => void;
  onHostMicToggle: () => void;
  isHostMicMuted: boolean;
  onSeatClick: (seat: PartySeat) => void;
}

export const RoomPKSplitStage: React.FC<RoomPKSplitStageProps> = ({
  myRoom,
  opponentRoom,
  mySeats,
  myPartyLevel,
  myRoomScore,
  opponentRoomScore,
  timeLeft,
  isHost,
  onEndPK,
  onHostMicToggle,
  isHostMicMuted,
  onSeatClick,
}) => {
  // Format MM:SS for 5-minute timer
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate Tug-of-war bar percentage
  const totalScore = myRoomScore + opponentRoomScore;
  const myPercent = totalScore > 0 ? Math.round((myRoomScore / totalScore) * 100) : 50;
  const oppPercent = 100 - myPercent;

  // Render seats according to room level (Level 1: 4 seats, Level 2: 8 seats)
  const displaySeatCount = myPartyLevel === 1 ? 4 : 8;
  const leftDisplaySeats = mySeats.slice(0, displaySeatCount);
  const rightDisplaySeats = opponentRoom.seats.slice(0, displaySeatCount);

  const isMyRoomLeading = myRoomScore > opponentRoomScore;
  const isOpponentLeading = opponentRoomScore > myRoomScore;

  return (
    <div className="relative w-full z-10 flex flex-col bg-gradient-to-b from-[#16082A]/90 via-[#0C0418]/95 to-[#07020E] border-b border-[#A855F7]/30 shadow-2xl select-none">
      {/* =========================================================================
          1. TOP PK STATUS & 5-MINUTE COUNTDOWN TIMER BAR
          ========================================================================= */}
      <div className="pt-1.5 px-3 pb-1 flex items-center justify-between bg-black/50 backdrop-blur-md border-b border-white/10">
        {/* Left Team Info & Score */}
        <div className="flex items-center gap-1.5 min-w-0 max-w-[32%]">
          <div className="w-2.5 h-2.5 rounded-full bg-[#EC4899] animate-ping shrink-0" />
          <div className="truncate text-left">
            <span className="text-[11px] font-black text-[#EC4899] truncate block">
              {myRoom.title.slice(0, 14)}
            </span>
            <span className="text-[9px] font-bold text-pink-300 font-mono">
              {myRoomScore.toLocaleString()} Coins
            </span>
          </div>
        </div>

        {/* Center: 5-Minute Timer + Neon PK Badge */}
        <div className="flex flex-col items-center shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#EC4899] via-[#9333EA] to-[#3B82F6] flex items-center gap-1 shadow-md">
              <Swords className="w-3 h-3 text-white animate-pulse" />
              <span className="text-[9px] font-black tracking-widest text-white uppercase">
                ROOM PK
              </span>
            </div>
          </div>
          <div
            className={`mt-0.5 text-xs font-mono font-black tracking-wider ${
              timeLeft <= 30 ? 'text-rose-400 animate-bounce' : 'text-amber-300'
            }`}
          >
            ⏱️ {formatTimer(timeLeft)}
          </div>
        </div>

        {/* Right Team Info & Score + Exit Button */}
        <div className="flex items-center justify-end gap-2 min-w-0 max-w-[32%]">
          <div className="truncate text-right">
            <span className="text-[11px] font-black text-[#38BDF8] truncate block">
              {opponentRoom.title.slice(0, 14)}
            </span>
            <span className="text-[9px] font-bold text-sky-300 font-mono">
              {opponentRoomScore.toLocaleString()} Coins
            </span>
          </div>

          {isHost && (
            <button
              onClick={onEndPK}
              className="w-6 h-6 rounded-full bg-white/10 hover:bg-rose-600/80 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
              title="End PK Battle"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          2. DYNAMIC TUG-OF-WAR SCORE BAR
          ========================================================================= */}
      <div className="px-3 py-1 bg-[#0A0413] flex flex-col gap-0.5">
        <div className="flex items-center justify-between text-[10px] font-black">
          {/* Left Leading Badge */}
          <div className="flex items-center gap-1 text-[#EC4899]">
            <Flame className="w-3 h-3 fill-current" />
            <span>{myRoomScore.toLocaleString()}</span>
            {isMyRoomLeading && (
              <span className="px-1.5 py-0.2 rounded bg-[#EC4899]/30 text-[8px] font-black uppercase tracking-wider text-pink-200 border border-[#EC4899]/50 animate-pulse">
                LEADING
              </span>
            )}
          </div>

          {/* Right Leading Badge */}
          <div className="flex items-center gap-1 text-[#38BDF8]">
            {isOpponentLeading && (
              <span className="px-1.5 py-0.2 rounded bg-[#38BDF8]/30 text-[8px] font-black uppercase tracking-wider text-sky-200 border border-[#38BDF8]/50 animate-pulse">
                LEADING
              </span>
            )}
            <span>{opponentRoomScore.toLocaleString()}</span>
            <Flame className="w-3 h-3 fill-current" />
          </div>
        </div>

        {/* Tug-of-war dual colored bar with sliding knot */}
        <div className="relative w-full h-3 rounded-full overflow-hidden bg-black/70 p-[1.5px] border border-white/15">
          <div className="w-full h-full rounded-full flex overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#7928CA] via-[#EC4899] to-[#F43F5E] transition-all duration-300 shadow-[0_0_12px_#EC4899]"
              style={{ width: `${myPercent}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-[#0284C7] to-[#38BDF8] transition-all duration-300 shadow-[0_0_12px_#38BDF8]"
              style={{ width: `${oppPercent}%` }}
            />
          </div>

          {/* Tug-of-war notch knot */}
          <div
            className="absolute top-0 bottom-0 w-2.5 bg-white rounded-full shadow-[0_0_8px_white] -translate-x-1/2 transition-all duration-300"
            style={{ left: `${myPercent}%` }}
          />
        </div>
      </div>

      {/* =========================================================================
          3. 50/50 SPLIT ARENA (LEFT ROOM vs RIGHT ROOM)
          ========================================================================= */}
      <div className="relative grid grid-cols-2 gap-1.5 p-2 bg-[#080311]">
        {/* Neon Center VS Emblem Overlay */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-[#15072B] border-2 border-[#A855F7] flex items-center justify-center shadow-[0_0_18px_#EC4899] animate-pulse">
            <span className="text-xs font-black italic tracking-tighter bg-gradient-to-r from-[#EC4899] via-white to-[#38BDF8] bg-clip-text text-transparent">
              VS
            </span>
          </div>
        </div>

        {/* ---------------------------------------------------------------------
            LEFT HALF: OUR PARTY ROOM
            --------------------------------------------------------------------- */}
        <div className="relative rounded-2xl bg-gradient-to-b from-[#1C0D33]/90 to-[#120622]/95 border border-[#EC4899]/40 p-2 flex flex-col justify-between overflow-hidden shadow-lg">
          {/* Room Team Tag */}
          <div className="flex items-center justify-between pb-1 border-b border-pink-500/20 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-[#EC4899] text-white text-[8px] font-black uppercase tracking-wider">
              MY ROOM 🛡️
            </span>
            <span className="text-[9px] font-bold text-pink-300 truncate max-w-[85px]">
              {myRoom.title}
            </span>
          </div>

          {/* Host Card */}
          <div className="flex items-center gap-2 mb-2 p-1 rounded-xl bg-black/30 border border-pink-500/15">
            <div
              className="relative shrink-0 cursor-pointer"
              onClick={onHostMicToggle}
              title={isHost ? 'Toggle Mic' : undefined}
            >
              <VipAvatarFrame
                avatarUrl={myRoom.host.avatar}
                vipTier={myRoom.host.vipTier || 3}
                size="xs"
              />
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center border border-black text-[6px] ${
                  isHostMicMuted ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-black'
                }`}
              >
                {isHostMicMuted ? <MicOff className="w-2 h-2" /> : <Mic className="w-2 h-2" />}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <Crown className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />
                <span className="text-[10px] font-black text-white truncate">
                  {myRoom.host.displayName}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[8.5px] text-zinc-400">
                <LevelBadgeIcon level={myRoom.host.level || 30} size="xs" />
                <span className="text-pink-300 font-bold">Host</span>
              </div>
            </div>
          </div>

          {/* Seated Guests Roster (4 or 8 seats) */}
          <div className="text-[8px] font-black tracking-wider uppercase text-zinc-400 mb-1">
            Seats ({leftDisplaySeats.filter((s) => s.user).length}/{displaySeatCount})
          </div>

          <div
            className={`grid gap-1 ${
              displaySeatCount === 4 ? 'grid-cols-2' : 'grid-cols-4'
            }`}
          >
            {leftDisplaySeats.map((seat) => {
              const hasUser = !!seat.user;

              return (
                <div
                  key={seat.seatIndex}
                  onClick={() => onSeatClick(seat)}
                  className={`relative p-1 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all ${
                    hasUser
                      ? 'bg-purple-950/60 border-purple-500/30 hover:border-pink-500'
                      : 'bg-black/40 border-dashed border-white/10 hover:border-white/30'
                  }`}
                >
                  {hasUser ? (
                    <>
                      <div className="relative">
                        <img
                          src={seat.user!.avatar}
                          alt={seat.user!.displayName}
                          className="w-5 h-5 rounded-full object-cover border border-pink-400"
                        />
                        <div
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full flex items-center justify-center text-[5px] ${
                            seat.isMuted ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-black'
                          }`}
                        >
                          {seat.isMuted ? <MicOff className="w-1.5 h-1.5" /> : <Mic className="w-1.5 h-1.5" />}
                        </div>
                      </div>
                      <span className="text-[7.5px] font-bold text-zinc-200 truncate max-w-[40px] mt-0.5">
                        {seat.user!.displayName.split(' ')[0]}
                      </span>
                    </>
                  ) : (
                    <div className="py-1 flex flex-col items-center">
                      <span className="text-[8px] text-zinc-500 font-bold">#{seat.seatIndex + 1}</span>
                      <span className="text-[7px] text-zinc-600">Empty</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------------------------------------------------------------------
            RIGHT HALF: CHALLENGER OPPONENT ROOM
            --------------------------------------------------------------------- */}
        <div className="relative rounded-2xl bg-gradient-to-b from-[#0D1E3A]/90 to-[#071326]/95 border border-[#38BDF8]/40 p-2 flex flex-col justify-between overflow-hidden shadow-lg">
          {/* Room Team Tag */}
          <div className="flex items-center justify-between pb-1 border-b border-sky-500/20 mb-1">
            <span className="text-[9px] font-bold text-sky-300 truncate max-w-[85px]">
              {opponentRoom.title}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#38BDF8] text-black text-[8px] font-black uppercase tracking-wider">
              CHALLENGER ⚔️
            </span>
          </div>

          {/* Opponent Host Card */}
          <div className="flex items-center gap-2 mb-2 p-1 rounded-xl bg-black/30 border border-sky-500/15">
            <div className="relative shrink-0">
              <VipAvatarFrame
                avatarUrl={opponentRoom.host.avatar}
                vipTier={opponentRoom.host.vipTier || 4}
                size="xs"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 text-black flex items-center justify-center border border-black text-[6px]">
                <Mic className="w-2 h-2" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <Crown className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />
                <span className="text-[10px] font-black text-white truncate">
                  {opponentRoom.host.displayName}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[8.5px] text-zinc-400">
                <LevelBadgeIcon level={opponentRoom.host.level || 35} size="xs" />
                <span className="text-sky-300 font-bold">Host</span>
              </div>
            </div>
          </div>

          {/* Opponent Seated Guests Roster */}
          <div className="text-[8px] font-black tracking-wider uppercase text-zinc-400 mb-1">
            Seats ({rightDisplaySeats.filter((s) => s.user).length}/{displaySeatCount})
          </div>

          <div
            className={`grid gap-1 ${
              displaySeatCount === 4 ? 'grid-cols-2' : 'grid-cols-4'
            }`}
          >
            {rightDisplaySeats.map((seat) => {
              const hasUser = !!seat.user;

              return (
                <div
                  key={seat.seatIndex}
                  className="relative p-1 rounded-xl border border-sky-500/20 bg-black/40 flex flex-col items-center justify-center"
                >
                  {hasUser ? (
                    <>
                      <div className="relative">
                        <img
                          src={seat.user!.avatar}
                          alt={seat.user!.displayName}
                          className="w-5 h-5 rounded-full object-cover border border-sky-400"
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 text-black flex items-center justify-center text-[5px]">
                          <Mic className="w-1.5 h-1.5" />
                        </div>
                      </div>
                      <span className="text-[7.5px] font-bold text-zinc-200 truncate max-w-[40px] mt-0.5">
                        {seat.user!.displayName.split(' ')[0]}
                      </span>
                    </>
                  ) : (
                    <div className="py-1 flex flex-col items-center">
                      <span className="text-[8px] text-zinc-500 font-bold">#{seat.seatIndex + 1}</span>
                      <span className="text-[7px] text-zinc-600">Empty</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
