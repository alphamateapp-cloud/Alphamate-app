import React, { useEffect, useState, useRef } from 'react';
import {
  Disc3,
  X,
  Search,
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Repeat,
  Radio,
  ListMusic,
  Loader2,
  Send,
  Headphones,
  Square,
  Sparkles,
  Check,
} from 'lucide-react';
import type { PartyMusicTrack, PartyMusicRequest } from '../../types';
import {
  searchPartyMusic,
  fetchTrendingPartyMusic,
  formatMusicDuration,
  PartyMusicCategory,
  PartyMusicSearchMode,
} from '../../services/partyMusicService';
import {
  partyMusicPlayer,
  PartyMusicPlaybackSnapshot,
} from '../../services/partyMusicPlayer';

interface PartyMusicPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  canControlRoomMusic: boolean;
  isRoomMusicPlaying: boolean;
  currentTrack: PartyMusicTrack | null;
  musicQueue: PartyMusicTrack[];
  musicLoop: boolean;
  musicUpdatedBy?: string;
  songRequests: PartyMusicRequest[];
  isSpeakerOn: boolean;
  onPlayTrackForRoom: (track: PartyMusicTrack) => void;
  onToggleRoomPlayPause: () => void;
  onStopRoomMusic: () => void;
  onSkipNext: () => void;
  onToggleLoop: () => void;
  onAddToQueue: (track: PartyMusicTrack) => void;
  onRemoveFromQueue: (trackId: string, index: number) => void;
  onRequestTrack: (track: PartyMusicTrack) => void;
  onDismissRequest: (requestId: string) => void;
}

const CATEGORY_CHIPS: Array<{ id: PartyMusicCategory; label: string }> = [
  { id: 'all', label: 'Trending' },
  { id: 'full', label: 'Full Songs' },
  { id: 'urdu', label: 'Urdu / Sufi' },
  { id: 'bollywood', label: 'Bollywood' },
  { id: 'punjabi', label: 'Punjabi' },
  { id: 'lofi', label: 'Lo-Fi Chill' },
  { id: 'pop', label: 'English Pop' },
];

export const PartyMusicPlayerModal: React.FC<PartyMusicPlayerModalProps> = ({
  isOpen,
  onClose,
  canControlRoomMusic,
  isRoomMusicPlaying,
  currentTrack,
  musicQueue,
  musicLoop,
  musicUpdatedBy,
  songRequests,
  isSpeakerOn,
  onPlayTrackForRoom,
  onToggleRoomPlayPause,
  onStopRoomMusic,
  onSkipNext,
  onToggleLoop,
  onAddToQueue,
  onRemoveFromQueue,
  onRequestTrack,
  onDismissRequest,
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'queue' | 'requests'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<PartyMusicSearchMode>('all');
  const [selectedCategory, setSelectedCategory] = useState<PartyMusicCategory>('all');
  const [results, setResults] = useState<PartyMusicTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [recentlyQueuedIds, setRecentlyQueuedIds] = useState<Set<string>>(new Set());
  const [recentlyRequestedIds, setRecentlyRequestedIds] = useState<Set<string>>(new Set());
  const [playback, setPlayback] = useState<PartyMusicPlaybackSnapshot>(() =>
    partyMusicPlayer.getSnapshot()
  );

  const searchRequestSeqRef = useRef(0);

  // Subscribe to live audio engine playback state (progress, volume, ducking, preview)
  useEffect(() => {
    if (!isOpen) return;
    const unsub = partyMusicPlayer.subscribe(setPlayback);
    return () => {
      unsub();
      // Stop any private preview when closing modal so room music resumes cleanly
      partyMusicPlayer.stopPreview();
    };
  }, [isOpen]);

  // Fetch trending or debounced live search results
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = searchQuery.trim();
    const seq = ++searchRequestSeqRef.current;

    if (!trimmed) {
      setIsSearching(true);
      setSearchError(null);
      fetchTrendingPartyMusic(selectedCategory, 18)
        .then((tracks) => {
          if (searchRequestSeqRef.current !== seq) return;
          setResults(tracks);
          if (tracks.length === 0) {
            setSearchError('No songs loaded right now. Try searching by song or artist name.');
          }
        })
        .catch(() => {
          if (searchRequestSeqRef.current !== seq) return;
          setSearchError('Could not load songs. Check your internet connection.');
        })
        .finally(() => {
          if (searchRequestSeqRef.current === seq) {
            setIsSearching(false);
          }
        });
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    const timer = window.setTimeout(() => {
      searchPartyMusic(trimmed, searchMode, 22)
        .then((tracks) => {
          if (searchRequestSeqRef.current !== seq) return;
          setResults(tracks);
          if (tracks.length === 0) {
            setSearchError(`No tracks found for "${trimmed}". Try another spelling or artist.`);
          }
        })
        .catch(() => {
          if (searchRequestSeqRef.current !== seq) return;
          setSearchError('Search failed. Please try again.');
        })
        .finally(() => {
          if (searchRequestSeqRef.current === seq) {
            setIsSearching(false);
          }
        });
    }, 360);

    return () => window.clearTimeout(timer);
  }, [isOpen, searchQuery, searchMode, selectedCategory]);

  if (!isOpen) return null;

  const progressPct =
    playback.durationSec > 0
      ? Math.min(100, Math.max(0, (playback.currentTimeSec / playback.durationSec) * 100))
      : 0;

  const handleQueueClick = (track: PartyMusicTrack) => {
    onAddToQueue(track);
    setRecentlyQueuedIds((prev) => new Set(prev).add(track.id));
    window.setTimeout(() => {
      setRecentlyQueuedIds((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }, 1500);
  };

  const handleRequestClick = (track: PartyMusicTrack) => {
    onRequestTrack(track);
    setRecentlyRequestedIds((prev) => new Set(prev).add(track.id));
    window.setTimeout(() => {
      setRecentlyRequestedIds((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }, 2500);
  };

  const handleTogglePreview = (track: PartyMusicTrack) => {
    partyMusicPlayer.unlock();
    if (playback.isPreviewMode && playback.previewTrackId === track.id) {
      partyMusicPlayer.stopPreview();
    } else {
      partyMusicPlayer.startPreview(track);
    }
  };

  const volumePercent = Math.round(playback.localVolume * 100);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[88vh] rounded-t-3xl sm:rounded-3xl bg-[#130A24] border-t sm:border border-[#A855F7]/30 shadow-[0_20px_70px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden"
      >
        {/* Top Header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#7928CA] to-[#EC4899] flex items-center justify-center shadow-lg shrink-0">
              <Disc3
                className={`w-5 h-5 text-white ${
                  isRoomMusicPlaying && currentTrack ? 'animate-spin-slow' : ''
                }`}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black text-white tracking-tight truncate">
                  Party Music DJ
                </h3>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-[9px] font-bold text-emerald-300 shrink-0">
                  Voice Clear
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 truncate">
                {canControlRoomMusic
                  ? 'Plays live for Host, Seated Guests & Viewers'
                  : 'Live synced room audio • Adjust your own music volume'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close music player"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Now Playing Deck & Personal Voice/Music Balance */}
        <div className="px-4 pt-3 pb-3 bg-gradient-to-b from-[#20103D]/90 to-[#130A24] border-b border-white/10 shrink-0 space-y-2.5">
          {currentTrack ? (
            <div className="p-2.5 rounded-2xl bg-black/35 border border-[#A855F7]/25">
              <div className="flex items-center gap-2.5">
                {currentTrack.artworkUrl ? (
                  <img
                    src={currentTrack.artworkUrl}
                    alt={currentTrack.title}
                    className="w-11 h-11 rounded-xl object-cover border border-white/15 shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#7928CA] to-[#EC4899] flex items-center justify-center shrink-0">
                    <Disc3 className="w-5 h-5 text-white" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white truncate">
                      {currentTrack.title}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase shrink-0 ${
                        currentTrack.isFullTrack
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                          : 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                      }`}
                    >
                      {currentTrack.isFullTrack ? 'Full' : '30s'}
                    </span>
                  </div>
                  <div className="text-[10.5px] text-zinc-300 truncate">
                    {currentTrack.artist}
                    {musicUpdatedBy ? ` • DJ ${musicUpdatedBy}` : ''}
                  </div>
                </div>

                {canControlRoomMusic ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        partyMusicPlayer.unlock();
                        onToggleRoomPlayPause();
                      }}
                      className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                      title={isRoomMusicPlaying ? 'Pause for everyone' : 'Resume for everyone'}
                    >
                      {playback.isLoading && isRoomMusicPlaying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isRoomMusicPlaying ? (
                        <Pause className="w-4 h-4 fill-white" />
                      ) : (
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onSkipNext}
                      disabled={musicQueue.length === 0}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-35 flex items-center justify-center text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
                      title="Skip to next queued song"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={onToggleLoop}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                        musicLoop
                          ? 'bg-[#EC4899]/30 text-[#F472B6] border border-[#EC4899]/50'
                          : 'bg-white/5 text-zinc-400 hover:text-white'
                      }`}
                      title={musicLoop ? 'Repeat track ON' : 'Repeat track OFF'}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={onStopRoomMusic}
                      className="w-8 h-8 rounded-full bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 flex items-center justify-center transition-colors cursor-pointer"
                      title="Stop room music"
                    >
                      <Square className="w-3 h-3 fill-current" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-[10px] font-bold text-emerald-300 shrink-0">
                    <Radio className="w-3 h-3 animate-pulse" />
                    <span>{isRoomMusicPlaying ? 'Live' : 'Paused'}</span>
                  </div>
                )}
              </div>

              {/* Live Progress Bar */}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[9.5px] font-mono text-zinc-400 w-7 text-right">
                  {formatMusicDuration(playback.currentTimeSec)}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#A855F7] to-[#EC4899] transition-all duration-200"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-[9.5px] font-mono text-zinc-400 w-7">
                  {formatMusicDuration(playback.durationSec || currentTrack.durationSec)}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-2xl bg-black/30 border border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-zinc-300 text-xs">
                <Radio className="w-4 h-4 text-[#C084FC]" />
                <span>
                  {canControlRoomMusic
                    ? 'Search any song below to play live in this party!'
                    : 'No background song playing yet. Request a song below!'}
                </span>
              </div>
            </div>
          )}

          {/* Autoplay Unlock Notice (if mobile browser blocked background audio before tap) */}
          {playback.isAutoplayBlocked && (
            <button
              type="button"
              onClick={() => partyMusicPlayer.unlock()}
              className="w-full py-2 px-3 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-amber-500/30"
            >
              <Volume2 className="w-4 h-4" />
              <span>Tap here to unlock room background music</span>
            </button>
          )}

          {/* Preview Banner */}
          {playback.isPreviewMode && (
            <div className="px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-400/35 flex items-center justify-between text-[11px] text-cyan-200">
              <div className="flex items-center gap-1.5 font-semibold">
                <Headphones className="w-3.5 h-3.5" />
                <span>Private Preview (only you hear this)</span>
              </div>
              <button
                type="button"
                onClick={() => partyMusicPlayer.stopPreview()}
                className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-cyan-500/25 hover:bg-cyan-500/40 text-white cursor-pointer"
              >
                Stop
              </button>
            </div>
          )}

          {/* Error Notice */}
          {playback.errorMessage && (
            <div className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-[11px] text-rose-200">
              {playback.errorMessage}
            </div>
          )}

          {/* Personal Background Volume + Auto Voice Ducking Controls (Available to Host, Seated & Viewers) */}
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white/[0.04] border border-white/10">
            <button
              type="button"
              onClick={() => partyMusicPlayer.setLocalMuted(!playback.localMuted)}
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                playback.localMuted || !isSpeakerOn
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'bg-[#7928CA]/30 text-[#E9D5FF]'
              }`}
              title={playback.localMuted ? 'Unmute background music' : 'Mute background music (keep voice on)'}
            >
              {playback.localMuted || !isSpeakerOn ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-zinc-300 font-semibold">
                  My Music Volume {!isSpeakerOn ? '(Room Speaker Off)' : ''}
                </span>
                <span className="font-mono text-[#E9D5FF] font-bold">
                  {playback.localMuted ? 'Muted' : `${volumePercent}%`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={playback.localMuted ? 0 : volumePercent}
                onChange={(e) => partyMusicPlayer.setLocalVolume(Number(e.target.value) / 100)}
                className="w-full h-1.5 accent-[#EC4899] cursor-pointer"
                aria-label="Personal background music volume"
              />
            </div>
            <button
              type="button"
              onClick={() => partyMusicPlayer.setVoiceDuckingEnabled(!playback.voiceDuckingEnabled)}
              className={`px-2 py-1 rounded-lg text-[9.5px] font-bold border shrink-0 transition-colors cursor-pointer ${
                playback.voiceDuckingEnabled
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-zinc-400'
              }`}
              title="Automatically lowers music softly when anyone speaks so voices stay crystal clear"
            >
              {playback.voiceDuckingEnabled ? 'Auto-Duck ON' : 'Auto-Duck OFF'}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 pt-2.5 flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`flex-1 h-8 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'search'
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow'
                : 'bg-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Songs</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`flex-1 h-8 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow'
                : 'bg-white/5 text-zinc-400 hover:text-white'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>Up Next ({musicQueue.length})</span>
          </button>
          {(songRequests.length > 0 || !canControlRoomMusic) && (
            <button
              type="button"
              onClick={() => setActiveTab('requests')}
              className={`px-3 h-8 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                activeTab === 'requests'
                  ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Req ({songRequests.length})</span>
            </button>
          )}
        </div>

        {/* Main Tab Content */}
        {activeTab === 'search' && (
          <div className="flex-1 min-h-0 flex flex-col px-4 pt-2.5 pb-4 overflow-hidden">
            {/* Search Input */}
            <div className="relative shrink-0">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any song (Atif Aslam, Arijit, Punjabi, Lo-Fi...)"
                className="w-full h-10 pl-9 pr-9 rounded-xl bg-black/45 border border-white/15 text-xs text-white placeholder-zinc-400 focus:outline-none focus:border-[#EC4899]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Bar: Mode toggles when typing, Category chips when browsing */}
            {searchQuery.trim() ? (
              <div className="mt-2 flex items-center gap-1.5 shrink-0">
                {(
                  [
                    { id: 'all', label: 'All Results' },
                    { id: 'full', label: 'Full Songs Only' },
                    { id: 'popular', label: 'Bollywood / Desi / Pop' },
                  ] as Array<{ id: PartyMusicSearchMode; label: string }>
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSearchMode(m.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition-colors cursor-pointer ${
                      searchMode === m.id
                        ? 'bg-[#7928CA]/40 border-[#EC4899] text-white'
                        : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 shrink-0">
                {CATEGORY_CHIPS.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border whitespace-nowrap transition-colors cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-[#7928CA]/45 border-[#EC4899] text-white'
                        : 'bg-white/5 border-white/10 text-zinc-300 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}

            {/* Results List */}
            <div className="mt-2 flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
              {isSearching ? (
                <div className="py-10 flex flex-col items-center justify-center text-zinc-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#EC4899]" />
                  <span className="text-xs">Searching free music library...</span>
                </div>
              ) : searchError && results.length === 0 ? (
                <div className="py-10 text-center text-xs text-zinc-400 px-4">
                  {searchError}
                </div>
              ) : (
                results.map((track) => {
                  const isCurrent = currentTrack?.id === track.id;
                  const isPreviewing = playback.isPreviewMode && playback.previewTrackId === track.id;
                  const wasQueued = recentlyQueuedIds.has(track.id);
                  const wasRequested = recentlyRequestedIds.has(track.id);

                  return (
                    <div
                      key={track.id}
                      className={`p-2 rounded-xl border flex items-center gap-2.5 transition-all ${
                        isCurrent
                          ? 'bg-[#7928CA]/30 border-[#EC4899]/80'
                          : 'bg-white/[0.03] border-white/8 hover:border-white/20'
                      }`}
                    >
                      {track.artworkUrl ? (
                        <img
                          src={track.artworkUrl}
                          alt={track.title}
                          loading="lazy"
                          className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#7928CA]/70 to-[#EC4899]/70 flex items-center justify-center shrink-0">
                          <Disc3 className="w-4 h-4 text-white" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">
                          {track.title}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10.5px] text-zinc-400 truncate">
                            {track.artist}
                          </span>
                          <span className="text-[9.5px] font-mono text-zinc-500 shrink-0">
                            {formatMusicDuration(track.durationSec)}
                          </span>
                          <span
                            className={`px-1 py-0.2 rounded text-[8.5px] font-extrabold uppercase shrink-0 ${
                              track.isFullTrack
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-amber-500/15 text-amber-200'
                            }`}
                          >
                            {track.isFullTrack ? 'Full' : '30s'}
                          </span>
                        </div>
                      </div>

                      {/* Track Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {canControlRoomMusic ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                partyMusicPlayer.unlock();
                                partyMusicPlayer.stopPreview();
                                onPlayTrackForRoom(track);
                              }}
                              className="h-8 px-2.5 rounded-lg bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-[10.5px] font-bold flex items-center gap-1 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                              title="Play live for everyone in room"
                            >
                              <Play className="w-3 h-3 fill-white" />
                              <span>{isCurrent && isRoomMusicPlaying ? 'Playing' : 'Play'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQueueClick(track)}
                              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                                wasQueued
                                  ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-300'
                                  : 'bg-white/5 border-white/10 text-zinc-300 hover:text-white hover:bg-white/15'
                              }`}
                              title="Add to room Up Next queue"
                            >
                              {wasQueued ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTogglePreview(track)}
                              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                                isPreviewing
                                  ? 'bg-cyan-500/30 border-cyan-400 text-white'
                                  : 'bg-white/5 border-white/10 text-zinc-300 hover:text-white'
                              }`}
                              title={isPreviewing ? 'Stop private preview' : 'Listen privately (only you)'}
                            >
                              {isPreviewing ? (
                                <Square className="w-3 h-3 fill-white" />
                              ) : (
                                <Headphones className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRequestClick(track)}
                              className={`h-8 px-2.5 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                wasRequested
                                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                                  : 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white hover:brightness-110'
                              }`}
                              title="Request Host to play this song for everyone"
                            >
                              {wasRequested ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>Sent</span>
                                </>
                              ) : (
                                <>
                                  <Send className="w-3 h-3" />
                                  <span>Request</span>
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-4 space-y-2">
            {musicQueue.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-400">
                Queue is empty. {canControlRoomMusic ? 'Tap + on any searched song to queue it up!' : 'Host has not queued extra songs yet.'}
              </div>
            ) : (
              musicQueue.map((track, idx) => (
                <div
                  key={`${track.id}_${idx}`}
                  className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-2.5"
                >
                  <span className="text-[11px] font-mono text-[#C084FC] w-5 text-center shrink-0">
                    {idx + 1}
                  </span>
                  {track.artworkUrl ? (
                    <img
                      src={track.artworkUrl}
                      alt={track.title}
                      className="w-9 h-9 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-[#7928CA]/40 flex items-center justify-center shrink-0">
                      <Disc3 className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">{track.title}</div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      {track.artist} • {formatMusicDuration(track.durationSec)}
                    </div>
                  </div>
                  {canControlRoomMusic && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onPlayTrackForRoom(track);
                          onRemoveFromQueue(track.id, idx);
                        }}
                        className="w-7 h-7 rounded-lg bg-[#7928CA]/40 hover:bg-[#7928CA]/70 text-white flex items-center justify-center cursor-pointer"
                        title="Play now"
                      >
                        <Play className="w-3 h-3 fill-white" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveFromQueue(track.id, idx)}
                        className="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 flex items-center justify-center cursor-pointer"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-4 space-y-2">
            {songRequests.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-400">
                No song requests yet. Guests and viewers can request songs from Search!
              </div>
            ) : (
              songRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-2.5"
                >
                  {req.track.artworkUrl ? (
                    <img
                      src={req.track.artworkUrl}
                      alt={req.track.title}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[#7928CA]/40 flex items-center justify-center shrink-0">
                      <Disc3 className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">{req.track.title}</div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      {req.track.artist} • Req by <span className="text-[#E9D5FF] font-semibold">{req.requesterName}</span>
                    </div>
                  </div>
                  {canControlRoomMusic && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onPlayTrackForRoom({ ...req.track, requestedBy: req.requesterName });
                          onDismissRequest(req.id);
                        }}
                        className="h-7 px-2 rounded-lg bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>Play</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onAddToQueue({ ...req.track, requestedBy: req.requesterName });
                          onDismissRequest(req.id);
                        }}
                        className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                        title="Add to queue"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDismissRequest(req.id)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-rose-500/25 text-zinc-400 hover:text-rose-300 flex items-center justify-center cursor-pointer"
                        title="Dismiss"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
