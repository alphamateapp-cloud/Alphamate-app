import React, { useState } from 'react';
import { PartyRoom, User, PartySeat } from '../../types';
import { VipAvatarFrame } from '../brand/VipAvatarFrame';
import { Swords, X, Users, Sparkles, Shield, Send, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export interface OpponentRoomCandidate {
  id: string;
  title: string;
  host: User;
  seats: PartySeat[];
  level: 1 | 2;
  activeViewers: number;
  totalGiftCoins: number;
}

interface RoomPKInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoom: PartyRoom;
  activePartyRooms: PartyRoom[];
  onSendChallenge: (opponent: OpponentRoomCandidate) => void;
  onSimulateIncoming?: () => void;
}

// Default eligible active rooms (4-Seat and 8-Seat) to challenge
const DEFAULT_OPPONENT_CANDIDATES: OpponentRoomCandidate[] = [
  {
    id: 'room_opp_01',
    title: 'Desi Anthems & Qawwali 🎶',
    level: 2, // 8 seats
    activeViewers: 86,
    totalGiftCoins: 14200,
    host: {
      id: 'opp_host_kairo',
      uniqueId: 'AM_482910',
      username: 'DJ_Kairo',
      displayName: 'DJ Kairo 🎧',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
      bio: 'Music Broadcaster & Remixer',
      followersCount: 28000,
      followingCount: 150,
      likesCount: 190000,
      level: 42,
      xp: 45000,
      nextLevelXp: 55000,
      vipTier: 5,
      coins: 15000,
      diamonds: 6000,
      isVerified: true,
    },
    seats: [
      { seatIndex: 0, user: null, isMuted: false, isSpeaking: true, receivedCoins: 800 },
      { seatIndex: 1, user: null, isMuted: false, isSpeaking: false, receivedCoins: 450 },
      { seatIndex: 2, user: null, isMuted: false, isSpeaking: false, receivedCoins: 300 },
      { seatIndex: 3, user: null, isMuted: false, isSpeaking: false, receivedCoins: 150 },
      { seatIndex: 4, user: null, isMuted: false, isSpeaking: false, receivedCoins: 0 },
      { seatIndex: 5, user: null, isMuted: false, isSpeaking: false, receivedCoins: 0 },
      { seatIndex: 6, user: null, isMuted: false, isSpeaking: false, receivedCoins: 0 },
      { seatIndex: 7, user: null, isMuted: false, isSpeaking: false, receivedCoins: 0 },
    ],
  },
  {
    id: 'room_opp_02',
    title: 'Acoustic Guitar Sessions 🎸',
    level: 1, // 4 seats
    activeViewers: 54,
    totalGiftCoins: 8900,
    host: {
      id: 'opp_host_stargazer',
      uniqueId: 'AM_771920',
      username: 'StarGazer',
      displayName: 'StarGazer 💫',
      avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
      bio: 'Acoustic singer & writer',
      followersCount: 18000,
      followingCount: 95,
      likesCount: 120000,
      level: 35,
      xp: 32000,
      nextLevelXp: 40000,
      vipTier: 3,
      coins: 8500,
      diamonds: 3200,
      isVerified: true,
    },
    seats: [
      { seatIndex: 0, user: null, isMuted: false, isSpeaking: true, receivedCoins: 600 },
      { seatIndex: 1, user: null, isMuted: false, isSpeaking: false, receivedCoins: 200 },
      { seatIndex: 2, user: null, isMuted: false, isSpeaking: false, receivedCoins: 0 },
      { seatIndex: 3, user: null, isMuted: false, isSpeaking: false, receivedCoins: 0 },
    ],
  },
  {
    id: 'room_opp_03',
    title: 'Neon Cyber Lounge ⚡',
    level: 2, // 8 seats
    activeViewers: 112,
    totalGiftCoins: 23400,
    host: {
      id: 'opp_host_cyberwolf',
      uniqueId: 'AM_339182',
      username: 'CyberWolf',
      displayName: 'CyberWolf 🐺',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=400&q=80',
      bio: 'Night Owl EDM host',
      followersCount: 34000,
      followingCount: 210,
      likesCount: 280000,
      level: 48,
      xp: 52000,
      nextLevelXp: 65000,
      vipTier: 6,
      coins: 24000,
      diamonds: 9800,
      isVerified: true,
    },
    seats: [
      { seatIndex: 0, user: null, isMuted: false, isSpeaking: true, receivedCoins: 1200 },
      { seatIndex: 1, user: null, isMuted: false, isSpeaking: false, receivedCoins: 900 },
      { seatIndex: 2, user: null, isMuted: false, isSpeaking: false, receivedCoins: 500 },
      { seatIndex: 3, user: null, isMuted: false, isSpeaking: false, receivedCoins: 350 },
      { seatIndex: 4, user: null, isMuted: false, isSpeaking: false, receivedCoins: 0 },
      { seatIndex: 5, user: null, isMuted: false, isSpeaking: false, receivedCoins: 0 },
      { seatIndex: 6, user: null, isMuted: false, isSpeaking: false, receivedCoins: 0 },
      { seatIndex: 7, user: null, isMuted: false, isSpeaking: false, receivedCoins: 0 },
    ],
  },
  {
    id: 'room_opp_04',
    title: 'Chai & Late Night Chitchat ☕',
    level: 1, // 4 seats
    activeViewers: 42,
    totalGiftCoins: 6500,
    host: {
      id: 'opp_host_zainab',
      uniqueId: 'AM_991820',
      username: 'Zainab_Live',
      displayName: 'Zainab Live 🌸',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
      bio: 'Late night poetry and stories',
      followersCount: 22000,
      followingCount: 140,
      likesCount: 145000,
      level: 38,
      xp: 39000,
      nextLevelXp: 48000,
      vipTier: 4,
      coins: 9200,
      diamonds: 3800,
      isVerified: true,
    },
    seats: [
      { seatIndex: 0, user: null, isMuted: false, isSpeaking: true, receivedCoins: 400 },
      { seatIndex: 1, user: null, isMuted: false, isSpeaking: false, receivedCoins: 150 },
      { seatIndex: 2, user: null, isMuted: false, isSpeaking: false, receivedCoins: 0 },
      { seatIndex: 3, user: null, isMuted: false, isSpeaking: false, receivedCoins: 0 },
    ],
  },
];

export const RoomPKInviteModal: React.FC<RoomPKInviteModalProps> = ({
  isOpen,
  onClose,
  currentRoom,
  activePartyRooms,
  onSendChallenge,
  onSimulateIncoming,
}) => {
  const [selectedOpponent, setSelectedOpponent] = useState<OpponentRoomCandidate | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen) return null;

  // Build eligible rooms: 4-seat (level 1) and 8-seat (level 2) only. 16-seat rooms are strictly excluded.
  const eligibleRooms: OpponentRoomCandidate[] = [
    ...DEFAULT_OPPONENT_CANDIDATES,
    ...activePartyRooms
      .filter((r) => r.id !== currentRoom.id && (r.level === 1 || r.level === 2))
      .map((r) => ({
        id: r.id,
        title: r.title,
        host: r.host,
        seats: r.seats,
        level: (r.level as 1 | 2) || 1,
        activeViewers: r.activeViewers || 25,
        totalGiftCoins: r.totalGiftCoins || 5000,
      })),
  ];

  const handleSend = () => {
    if (!selectedOpponent) return;
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setSentSuccess(true);
      setTimeout(() => {
        onSendChallenge(selectedOpponent);
        onClose();
        setSentSuccess(false);
      }, 700);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#1C0E34] via-[#120822] to-[#0A0414] border border-[#EC4899]/30 shadow-2xl overflow-hidden text-white flex flex-col max-h-[88vh]">
        {/* Top Glowing Header Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#EC4899] via-[#9333EA] to-[#38BDF8]" />

        {/* Modal Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#EC4899] to-[#7928CA] flex items-center justify-center shadow-lg shadow-[#EC4899]/30">
              <Swords className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                <span>Room vs Room PK</span>
                <span className="px-2 py-0.2 rounded-full bg-[#EC4899]/20 text-[#EC4899] text-[9.5px] font-bold border border-[#EC4899]/30">
                  5 Mins
                </span>
              </h3>
              <p className="text-[10px] text-zinc-400">
                Invite an active 4-Seat or 8-Seat Room to battle
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Information Banner */}
        <div className="mx-4 mt-3 px-3 py-2 rounded-2xl bg-[#1B0F33] border border-purple-500/20 flex items-center gap-2 text-xs">
          <Clock className="w-4 h-4 text-[#F59E0B] shrink-0" />
          <span className="text-[10.5px] text-zinc-300 leading-snug">
            Battle duration is <strong>5 minutes</strong>. All viewer gifting in each room counts towards their room's score bar!
          </span>
        </div>

        {/* Room Capacity Eligibility Notice */}
        <div className="mx-4 mt-2 px-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-500/20 flex items-center justify-between text-[10px]">
          <span className="text-zinc-400">Supported Room Tiers:</span>
          <div className="flex items-center gap-1.5 font-bold">
            <span className="px-2 py-0.5 rounded-md bg-purple-600/30 text-purple-300 border border-purple-500/30">
              Lv.1 (4 Seats)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-purple-600/30 text-purple-300 border border-purple-500/30">
              Lv.2 (8 Seats)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-500 line-through">
              16 Seats
            </span>
          </div>
        </div>

        {/* Active Opponents List */}
        <div className="px-4 py-3 flex-1 overflow-y-auto space-y-2 scrollbar-none max-h-64 sm:max-h-72">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1 mb-1">
            Active Rooms Ready For PK ({eligibleRooms.length})
          </div>

          {eligibleRooms.map((opp) => {
            const isSelected = selectedOpponent?.id === opp.id;

            return (
              <div
                key={opp.id}
                onClick={() => setSelectedOpponent(opp)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#7928CA]/30 via-[#EC4899]/25 to-[#1A0B2E] border-[#EC4899] shadow-lg shadow-[#EC4899]/20'
                    : 'bg-white/5 border-white/5 hover:border-purple-500/30 hover:bg-white/8'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Host Avatar */}
                  <div className="relative shrink-0">
                    <VipAvatarFrame
                      avatarUrl={opp.host.avatar}
                      vipTier={opp.host.vipTier || 2}
                      size="sm"
                    />
                    <span className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded bg-purple-900 border border-purple-400/50 text-[8px] font-mono font-bold text-amber-300">
                      Lv.{opp.level}
                    </span>
                  </div>

                  {/* Room Details */}
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-white truncate max-w-[170px] sm:max-w-[210px] group-hover:text-pink-300 transition-colors">
                      {opp.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-zinc-400">
                      <span className="truncate text-zinc-300 font-semibold">{opp.host.displayName}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 text-cyan-300">
                        <Users className="w-3 h-3" />
                        <span>{opp.activeViewers}</span>
                      </span>
                      <span>•</span>
                      <span className="px-1.5 py-0.2 rounded bg-white/10 text-white font-bold text-[9px]">
                        {opp.level === 1 ? '4 Seats' : '8 Seats'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Selection Radio / Checkmark */}
                <div className="shrink-0 ml-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                      isSelected
                        ? 'bg-gradient-to-tr from-[#EC4899] to-[#7928CA] border-[#EC4899] text-white shadow-md'
                        : 'border-white/20 bg-white/5 text-transparent'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-white/10 bg-[#0F071B]/80 space-y-2">
          <button
            onClick={handleSend}
            disabled={!selectedOpponent || isSending || sentSuccess}
            className={`w-full h-12 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
              sentSuccess
                ? 'bg-emerald-600 text-white'
                : selectedOpponent
                ? 'bg-gradient-to-r from-[#EC4899] via-[#9333EA] to-[#7928CA] text-white hover:opacity-95 shadow-[#EC4899]/30 active:scale-[0.98]'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            {isSending ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-pink-300" />
                <span>Sending PK Challenge...</span>
              </>
            ) : sentSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Challenge Accepted! Launching Arena ⚔️</span>
              </>
            ) : (
              <>
                <Swords className="w-4 h-4 text-white" />
                <span>
                  {selectedOpponent
                    ? `Send Challenge to ${selectedOpponent.title.slice(0, 15)}...`
                    : 'Select a Room to Challenge'}
                </span>
              </>
            )}
          </button>

          {/* Quick Demo Test Trigger: Simulate Incoming Invite */}
          {onSimulateIncoming && (
            <button
              onClick={() => {
                onClose();
                onSimulateIncoming();
              }}
              className="w-full py-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/40 border border-purple-500/25 text-purple-300 hover:text-white text-[10.5px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>⚡ Simulate Incoming PK Challenge From Another Room</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
