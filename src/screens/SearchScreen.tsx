import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Search, Flame, Radio, Users, Video } from 'lucide-react';

export const SearchScreen: React.FC = () => {
  const {
    liveStreams,
    partyRooms,
    videos,
    openLiveStream,
    openPartyRoom,
    navigateBack,
  } = useApp();

  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Hosts' | 'Parties' | 'Videos'>('All');

  const trendingTags = ['#PKBattle', '#AlphaKings', '#LateNightSinging', '#EDMDrop', '#DanceRoutine', '#VIPPrestige'];

  // Match live streams
  const matchedStreams = liveStreams.filter(
    (s) =>
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.host.displayName.toLowerCase().includes(query.toLowerCase()) ||
      s.category.toLowerCase().includes(query.toLowerCase())
  );

  // Match party rooms
  const matchedParties = partyRooms.filter(
    (p) =>
      p.title.toLowerCase().includes(query.toLowerCase()) ||
      p.host.displayName.toLowerCase().includes(query.toLowerCase()) ||
      p.category.toLowerCase().includes(query.toLowerCase())
  );

  // Match videos
  const matchedVideos = videos.filter(
    (v) =>
      v.title.toLowerCase().includes(query.toLowerCase()) ||
      v.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="relative w-full h-full min-h-screen pb-24 bg-[#09070F] text-white overflow-y-auto">
      {/* Search Header */}
      <div className="sticky top-0 z-30 w-full bg-[#09070F]/85 backdrop-blur-md border-b border-[#A855F7]/15 px-4 py-3 flex items-center gap-3">
        <button
          onClick={navigateBack}
          className="w-8 h-8 rounded-full bg-[#1A1133] flex items-center justify-center text-zinc-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search hosts, parties, videos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-[#140E28] border border-[#A855F7]/25 text-white placeholder-zinc-500 text-xs focus:border-[#EC4899] focus:outline-none"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none border-b border-white/5">
        {(['All', 'Hosts', 'Parties', 'Videos'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
              activeFilter === tab
                ? 'bg-gradient-to-r from-[#7928CA] to-[#A855F7] text-white shadow-md'
                : 'bg-[#150F2C] text-zinc-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {!query && (
          <div>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
              Trending Hashtags
            </span>
            <div className="flex flex-wrap gap-2">
              {trendingTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setQuery(tag)}
                  className="px-3 py-1.5 rounded-xl bg-[#150D28] hover:bg-[#20143D] border border-[#A855F7]/20 text-xs font-semibold text-[#C084FC] transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Live Streams Section */}
        {(activeFilter === 'All' || activeFilter === 'Hosts') && matchedStreams.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
              <Radio className="w-3.5 h-3.5 text-[#EC4899]" />
              <span>Live Streams ({matchedStreams.length})</span>
            </div>
            <div className="space-y-2">
              {matchedStreams.map((stream) => (
                <div
                  key={stream.id}
                  onClick={() => openLiveStream(stream)}
                  className="p-3 rounded-2xl bg-[#140D26] border border-white/5 flex items-center justify-between cursor-pointer hover:border-[#A855F7]/40"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={stream.host.avatar}
                      alt={stream.host.displayName}
                      className="w-10 h-10 rounded-full object-cover border border-[#EC4899]"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-white">{stream.title}</h4>
                      <p className="text-[10px] text-zinc-400">{stream.host.displayName} • {stream.category}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#EC4899] font-bold">LIVE</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audio Party Rooms */}
        {(activeFilter === 'All' || activeFilter === 'Parties') && matchedParties.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
              <Users className="w-3.5 h-3.5 text-[#A855F7]" />
              <span>Audio Lounges ({matchedParties.length})</span>
            </div>
            <div className="space-y-2">
              {matchedParties.map((party) => (
                <div
                  key={party.id}
                  onClick={() => openPartyRoom(party)}
                  className="p-3 rounded-2xl bg-[#140D26] border border-white/5 flex items-center justify-between cursor-pointer hover:border-[#A855F7]/40"
                >
                  <div>
                    <h4 className="text-xs font-bold text-white">{party.title}</h4>
                    <p className="text-[10px] text-zinc-400">Host: {party.host.displayName}</p>
                  </div>
                  <span className="text-[10px] text-[#C084FC] font-semibold">{party.activeViewers} in room</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
