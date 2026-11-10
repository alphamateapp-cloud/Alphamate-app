import React from 'react';
import { Trophy, Swords, X, Sparkles, RotateCcw, Heart, Flame } from 'lucide-react';

interface RoomPKVictoryModalProps {
  isOpen: boolean;
  myRoomTitle: string;
  opponentRoomTitle: string;
  myScore: number;
  opponentScore: number;
  onRematch: () => void;
  onClose: () => void;
}

export const RoomPKVictoryModal: React.FC<RoomPKVictoryModalProps> = ({
  isOpen,
  myRoomTitle,
  opponentRoomTitle,
  myScore,
  opponentScore,
  onRematch,
  onClose,
}) => {
  if (!isOpen) return null;

  const isMyRoomWinner = myScore > opponentScore;
  const isDraw = myScore === opponentScore;
  const winningTitle = isMyRoomWinner ? myRoomTitle : opponentRoomTitle;
  const losingTitle = isMyRoomWinner ? opponentRoomTitle : myRoomTitle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#25103E] via-[#140826] to-[#0B0316] border-2 border-amber-400 shadow-[0_0_50px_rgba(245,158,11,0.4)] p-6 text-white text-center overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-56 h-28 bg-amber-500/25 blur-3xl rounded-full pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Celebration Visual: Trophy or Swords */}
        <div className="relative inline-flex items-center justify-center my-3">
          {isDraw ? (
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center shadow-2xl">
              <Swords className="w-10 h-10 text-white animate-pulse" />
            </div>
          ) : (
            <div className="w-22 h-22 rounded-3xl bg-gradient-to-tr from-amber-400 via-yellow-500 to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/50 animate-bounce">
              <Trophy className="w-12 h-12 text-black fill-black" />
            </div>
          )}
        </div>

        {/* Victory Headline */}
        {isDraw ? (
          <>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>HONORABLE DRAW!</span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight mb-1">
              Tie Match!
            </h2>
            <p className="text-xs text-zinc-300 mb-5">
              Both rooms scored equally with legendary support from their audiences!
            </p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-black tracking-wider uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>ROOM BATTLE CHAMPION</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 tracking-tight mb-1">
              {winningTitle} WINS! 🏆🎉
            </h2>

            <p className="text-xs text-zinc-300 mb-4">
              {isMyRoomWinner
                ? 'Your room conquered the arena with victorious gifting support!'
                : `${winningTitle} claimed victory in this 5-minute Room Battle!`}
            </p>
          </>
        )}

        {/* Winner vs Loser Comparison Box with User-Specified Emojis */}
        <div className="grid grid-cols-2 gap-2 text-left mb-5">
          {/* Winner Side */}
          <div className="p-3 rounded-2xl bg-gradient-to-b from-amber-950/40 to-black/60 border border-amber-400/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black uppercase text-amber-300 tracking-wider">
                  WINNER
                </span>
                <span className="text-base animate-pulse">👑🎉</span>
              </div>
              <h4 className="text-xs font-black text-white truncate mb-1">
                {isMyRoomWinner ? myRoomTitle : opponentRoomTitle}
              </h4>
            </div>
            <div className="mt-2 text-amber-300 font-mono font-bold text-xs flex items-center gap-1">
              <Flame className="w-3 h-3 fill-current" />
              <span>{(isMyRoomWinner ? myScore : opponentScore).toLocaleString()} Coins</span>
            </div>
          </div>

          {/* Loser Side with Crying Emojis */}
          <div className="p-3 rounded-2xl bg-gradient-to-b from-rose-950/30 to-black/60 border border-rose-500/30 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black uppercase text-rose-300 tracking-wider">
                  DEFEATED
                </span>
                <span className="text-base animate-bounce">😭💔</span>
              </div>
              <h4 className="text-xs font-black text-zinc-300 truncate mb-1">
                {isMyRoomWinner ? opponentRoomTitle : myRoomTitle}
              </h4>
            </div>
            <div className="mt-2 text-rose-300 font-mono font-bold text-xs flex items-center gap-1">
              <Flame className="w-3 h-3 fill-current" />
              <span>{(isMyRoomWinner ? opponentScore : myScore).toLocaleString()} Coins</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={onRematch}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 stroke-[3]" />
            <span>Rematch 5-Min Battle ⚔️</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Back to Normal Party Room
          </button>
        </div>
      </div>
    </div>
  );
};
