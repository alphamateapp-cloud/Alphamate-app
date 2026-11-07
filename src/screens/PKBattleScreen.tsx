import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { VIRTUAL_GIFTS } from '../data/mockData';
import { X, Flame, Swords, Crown, Heart, Gift as GiftIcon, Send, Sparkles } from 'lucide-react';

export const PKBattleScreen: React.FC = () => {
  const {
    activePKBattle,
    closeLiveStream,
    pkScores,
    supportPKHost,
    coins,
    currentUser,
    setCurrentScreen,
  } = useApp();

  const [timeLeft, setTimeLeft] = useState(165); // 2 mins 45 secs
  const [battleComments, setBattleComments] = useState<Array<{ id: string; user: string; text: string; side: 'left' | 'right' }>>([
    { id: '1', user: 'RoyalAlpha', text: 'Dropping 500 on Luna! 🔥', side: 'left' },
    { id: '2', user: 'BassLover', text: 'DJ Kairo drop that bass drop!', side: 'right' },
    { id: '3', user: 'QueenStar', text: 'Alpha Mate battle of the century 👑', side: 'left' },
  ]);
  const [inputComment, setInputComment] = useState('');
  const [showGiftModal, setShowGiftModal] = useState<'left' | 'right' | null>(null);

  // PK Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);

    const eventTimer = setInterval(() => {
      const sides: ('left' | 'right')[] = ['left', 'right'];
      const chosenSide = sides[Math.floor(Math.random() * sides.length)];
      const points = [100, 250, 500, 1000][Math.floor(Math.random() * 4)];
      // Random simulated audience gift
      supportPKHost(chosenSide, 0); // trigger animation without consuming user coins
    }, 6000);

    return () => {
      clearInterval(timer);
      clearInterval(eventTimer);
    };
  }, []);

  const formatTimer = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const totalScore = pkScores.left + pkScores.right;
  const leftPercent = totalScore > 0 ? Math.round((pkScores.left / totalScore) * 100) : 50;
  const rightPercent = 100 - leftPercent;

  const leftHost = activePKBattle?.host;
  const rightHost = activePKBattle?.pkOpponent || activePKBattle?.host;

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputComment.trim()) return;
    setBattleComments((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        user: currentUser.displayName,
        text: inputComment.trim(),
        side: 'left',
      },
    ]);
    setInputComment('');
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-[#07040D] text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Top PK Battle Bar */}
      <div className="relative z-30 pt-3 px-4 flex items-center justify-between bg-black/40 backdrop-blur-md border-b border-[#A855F7]/20">
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-full bg-gradient-to-r from-[#EC4899] to-[#7928CA] flex items-center gap-1.5 shadow-md">
            <Swords className="w-3.5 h-3.5 text-white animate-pulse" />
            <span className="text-[10px] font-black tracking-widest uppercase">1v1 PK BATTLE</span>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#180E2E] border border-[#A855F7]/30 text-xs font-mono font-bold text-amber-300">
            <span>⏱️ {formatTimer(timeLeft)}</span>
          </div>
        </div>

        <button
          onClick={closeLiveStream}
          className="w-8 h-8 rounded-full bg-[#1E1238] border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* PK Tug-of-War Score Bar with Leading Status */}
      <div className="relative z-30 px-4 py-2 bg-[#0E081F] flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs font-black">
          {/* Left Host Score */}
          <div className="flex items-center gap-1.5 text-[#EC4899]">
            <Flame className="w-4 h-4 fill-[#EC4899]" />
            <span className="font-mono text-sm tracking-wider">{pkScores.left.toLocaleString()}</span>
            {pkScores.left >= pkScores.right && (
              <span className="px-1.5 py-0.2 rounded bg-[#EC4899]/30 text-[9px] uppercase font-bold text-white border border-[#EC4899]/50">
                WINNING
              </span>
            )}
          </div>

          {/* Right Host Score */}
          <div className="flex items-center gap-1.5 text-[#3B82F6]">
            {pkScores.right > pkScores.left && (
              <span className="px-1.5 py-0.2 rounded bg-[#3B82F6]/30 text-[9px] uppercase font-bold text-white border border-[#3B82F6]/50">
                WINNING
              </span>
            )}
            <span className="font-mono text-sm tracking-wider">{pkScores.right.toLocaleString()}</span>
            <Flame className="w-4 h-4 fill-[#3B82F6]" />
          </div>
        </div>

        {/* Dual Color Progress Bar with glowing Tug knot in center */}
        <div className="relative w-full h-3.5 rounded-full overflow-hidden bg-black/60 p-[1.5px] border border-white/15">
          <div className="w-full h-full rounded-full flex overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#7928CA] via-[#EC4899] to-[#F43F5E] transition-all duration-300 shadow-[0_0_12px_#EC4899]"
              style={{ width: `${leftPercent}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-[#0284C7] to-[#3B82F6] transition-all duration-300 shadow-[0_0_12px_#3B82F6]"
              style={{ width: `${rightPercent}%` }}
            />
          </div>

          {/* Tug-of-war glowing notch */}
          <div
            className="absolute top-0 bottom-0 w-2.5 bg-white rounded-full shadow-[0_0_10px_white] -translate-x-1/2 transition-all duration-300"
            style={{ left: `${leftPercent}%` }}
          />
        </div>
      </div>

      {/* Center 1v1 Split Arena Video Area */}
      <div className="relative flex-1 grid grid-cols-2 gap-1 p-2 bg-[#07030F]">
        {/* Left Host Arena */}
        <div className="relative rounded-2xl overflow-hidden bg-[#160E2E] border border-[#EC4899]/30 flex flex-col justify-between p-3">
          <img
            src={leftHost?.avatar}
            alt={leftHost?.displayName}
            className="absolute inset-0 w-full h-full object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 pointer-events-none" />

          {/* Left Top Info */}
          <div className="relative z-10 flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-[#EC4899] text-[9px] font-black text-white">RED TEAM</span>
            <span className="text-xs font-bold text-white drop-shadow truncate">{leftHost?.displayName}</span>
          </div>

          {/* Left Gift Boost Button */}
          <div className="relative z-10 pt-2 flex flex-col items-center">
            <button
              onClick={() => setShowGiftModal('left')}
              className="w-full py-2 rounded-xl bg-gradient-to-r from-[#EC4899] to-[#F43F5E] text-white font-extrabold text-xs shadow-lg shadow-[#EC4899]/50 hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <GiftIcon className="w-3.5 h-3.5" />
              <span>Support Red</span>
            </button>
          </div>
        </div>

        {/* Center Neon "VS" Badge */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="w-13 h-13 rounded-full bg-[#120722] border-2 border-[#A855F7] flex items-center justify-center shadow-[0_0_20px_#A855F7] animate-pulse">
            <span className="text-base font-black italic tracking-tighter bg-gradient-to-r from-[#EC4899] via-white to-[#3B82F6] bg-clip-text text-transparent">
              VS
            </span>
          </div>
        </div>

        {/* Right Host Arena */}
        <div className="relative rounded-2xl overflow-hidden bg-[#160E2E] border border-[#3B82F6]/30 flex flex-col justify-between p-3">
          <img
            src={rightHost?.avatar}
            alt={rightHost?.displayName}
            className="absolute inset-0 w-full h-full object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 pointer-events-none" />

          {/* Right Top Info */}
          <div className="relative z-10 flex items-center justify-end gap-1.5">
            <span className="text-xs font-bold text-white drop-shadow truncate">{rightHost?.displayName}</span>
            <span className="px-2 py-0.5 rounded-md bg-[#3B82F6] text-[9px] font-black text-white">BLUE TEAM</span>
          </div>

          {/* Right Gift Boost Button */}
          <div className="relative z-10 pt-2 flex flex-col items-center">
            <button
              onClick={() => setShowGiftModal('right')}
              className="w-full py-2 rounded-xl bg-gradient-to-r from-[#0284C7] to-[#3B82F6] text-white font-extrabold text-xs shadow-lg shadow-[#3B82F6]/50 hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <GiftIcon className="w-3.5 h-3.5" />
              <span>Support Blue</span>
            </button>
          </div>
        </div>
      </div>

      {/* PK Battle Comments & Cheer Feed */}
      <div className="relative z-30 px-4 py-3 bg-[#0B0617] border-t border-[#A855F7]/15">
        <div className="max-h-28 overflow-y-auto space-y-1.5 mb-2 scrollbar-none">
          {battleComments.map((c) => (
            <div
              key={c.id}
              className={`flex items-center gap-2 text-xs px-2.5 py-1 rounded-xl bg-black/40 border ${
                c.side === 'left' ? 'border-[#EC4899]/30 text-rose-200' : 'border-[#3B82F6]/30 text-sky-200'
              }`}
            >
              <span className="font-bold">{c.user}:</span>
              <span>{c.text}</span>
            </div>
          ))}
        </div>

        {/* Comment input row */}
        <form onSubmit={handleSendComment} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Cheer on your favorite host..."
            value={inputComment}
            onChange={(e) => setInputComment(e.target.value)}
            className="flex-1 h-10 px-3.5 rounded-full bg-[#180E2E] border border-white/10 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-[#EC4899]"
          />
          <button
            type="submit"
            className="w-10 h-10 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Gift Support Modal */}
      {showGiftModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#160E2C] border border-[#A855F7]/30 p-5 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">
                Boost {showGiftModal === 'left' ? 'Red Host' : 'Blue Host'}
              </h3>
              <button onClick={() => setShowGiftModal(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 mb-3">
              Each coin sent boosts their battle score and lights up the arena!
            </p>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { name: '100 Score', coins: 100, icon: '🔥' },
                { name: '500 Score', coins: 500, icon: '⚡' },
                { name: '2,000 Score', coins: 2000, icon: '👑' },
              ].map((pack) => (
                <button
                  key={pack.name}
                  onClick={() => {
                    supportPKHost(showGiftModal, pack.coins);
                    setShowGiftModal(null);
                  }}
                  className="p-3 rounded-2xl bg-[#20153D] border border-[#A855F7]/25 hover:border-[#EC4899] flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95"
                >
                  <span className="text-2xl mb-1">{pack.icon}</span>
                  <span className="text-xs font-bold text-white">{pack.name}</span>
                  <span className="text-[10px] text-amber-400 font-semibold">{pack.coins} Coins</span>
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400">Your Balance:</span>
              <span className="text-amber-400 font-bold">💰 {coins.toLocaleString()} Coins</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
