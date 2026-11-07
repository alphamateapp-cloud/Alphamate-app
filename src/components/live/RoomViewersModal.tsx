import React, { useState, useMemo } from 'react';
import { User } from '../../types';
import { VipAvatarFrame } from '../brand/VipAvatarFrame';
import {
  X,
  Users,
  Search,
  Crown,
  ShieldCheck,
  Sparkles,
  Mic,
  ChevronRight,
  UserPlus,
} from 'lucide-react';

export interface RoomViewersModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewers: User[];
  hostUser: User;
  moderatorIds?: string[];
  totalViewerCount: number;
  onSelectUser: (user: User) => void;
  // Party Room seat invite capability
  isPartyRoom?: boolean;
  canInviteToSeat?: boolean;
  onInviteToSeat?: (user: User) => void;
}

export const RoomViewersModal: React.FC<RoomViewersModalProps> = ({
  isOpen,
  onClose,
  viewers,
  hostUser,
  moderatorIds = [],
  totalViewerCount,
  onSelectUser,
  isPartyRoom = false,
  canInviteToSeat = false,
  onInviteToSeat,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'vip' | 'mods'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Combine host + viewers list ensuring no duplicates
  const allAudience = useMemo(() => {
    const list: User[] = [];
    // Ensure host is at the very top
    if (hostUser) {
      list.push({ ...hostUser, isHost: true });
    }
    viewers.forEach((v) => {
      if (!list.some((existing) => existing.id === v.id)) {
        list.push(v);
      }
    });
    return list;
  }, [viewers, hostUser]);

  // Filter list by tab and search query
  const filteredList = useMemo(() => {
    return allAudience.filter((u) => {
      // Tab filter
      if (activeTab === 'vip') {
        if (!u.vipTier || u.vipTier === 0) return false;
      }
      if (activeTab === 'mods') {
        const isMod = moderatorIds.includes(u.id);
        const isHost = u.id === hostUser.id;
        if (!isMod && !isHost) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.displayName.toLowerCase().includes(q);
        const matchesId = (u.uniqueId || u.id).toLowerCase().includes(q);
        if (!matchesName && !matchesId) return false;
      }

      return true;
    });
  }, [allAudience, activeTab, searchQuery, moderatorIds, hostUser]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Background click dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#130B24] border border-[#A855F7]/30 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Top ambient glow bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#7928CA] via-[#EC4899] to-[#38BDF8]" />

        {/* Modal Header */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-white/10 bg-[#170E2C]/80">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#C084FC]" />
            <h2 className="text-sm font-black text-white tracking-wide">
              LIVE VIEWERS & AUDIENCE
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-[#7928CA]/30 text-[#C084FC] text-[10px] font-black border border-[#A855F7]/30">
              {totalViewerCount.toLocaleString()}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search viewer by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#A855F7]"
            />
          </div>
        </div>

        {/* Audience Category Tabs */}
        <div className="flex items-center gap-2 px-4 pb-2 border-b border-white/10">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                : 'bg-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            All Viewers ({allAudience.length})
          </button>
          <button
            onClick={() => setActiveTab('vip')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'vip'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md'
                : 'bg-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            <span>👑 VIPs</span>
          </button>
          <button
            onClick={() => setActiveTab('mods')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'mods'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'bg-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            <span>🛡️ Mods ({moderatorIds.length}/10)</span>
          </button>
        </div>

        {/* Viewers List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-none">
          {filteredList.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs">
              No viewers found matching your criteria.
            </div>
          ) : (
            filteredList.map((viewer) => {
              const isHost = viewer.id === hostUser.id;
              const isMod = moderatorIds.includes(viewer.id);

              return (
                <div
                  key={viewer.id}
                  onClick={() => onSelectUser(viewer)}
                  className="p-2.5 rounded-2xl bg-white/5 border border-white/5 hover:border-[#A855F7]/40 hover:bg-white/10 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <VipAvatarFrame
                        avatarUrl={viewer.avatar}
                        vipTier={viewer.vipTier || 0}
                        size="sm"
                        showCrownBadge={isHost}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate max-w-[120px] sm:max-w-[160px]">
                          {viewer.displayName}
                        </span>
                        {viewer.countryFlag && (
                          <span className="text-[10px]">{viewer.countryFlag}</span>
                        )}
                        {isHost && (
                          <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[8px] font-black border border-amber-400/30 flex items-center gap-0.5">
                            <Crown className="w-2 h-2" /> Host
                          </span>
                        )}
                        {isMod && !isHost && (
                          <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[8px] font-black border border-cyan-400/30 flex items-center gap-0.5">
                            <ShieldCheck className="w-2 h-2" /> MOD
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9.5px] font-mono text-zinc-400">
                          ID: {viewer.uniqueId || viewer.id}
                        </span>
                        <span className="text-[8.5px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                          Lv.{viewer.level || 1}
                        </span>
                        {viewer.vipTier && viewer.vipTier > 0 ? (
                          <span className="text-[8.5px] px-1 py-0.2 rounded bg-[#7928CA]/30 text-[#C084FC] font-bold">
                            VIP {viewer.vipTier}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Actions / Trigger */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isPartyRoom && canInviteToSeat && !isHost && onInviteToSeat && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onInviteToSeat(viewer);
                        }}
                        className="px-2 py-1 rounded-lg bg-[#7928CA]/30 hover:bg-[#7928CA] text-purple-200 hover:text-white text-[9.5px] font-bold border border-[#A855F7]/30 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Invite to an open seat"
                      >
                        <Mic className="w-2.5 h-2.5 text-pink-400" />
                        <span>Invite (بلائیں)</span>
                      </button>
                    )}

                    <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
