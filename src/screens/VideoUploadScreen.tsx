import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { p2pStreamingEngine } from '../services/webrtcService';
import { compressImage } from '../utils/imageCompressor';
import { playMusicSnippet, stopMusicSnippet } from '../utils/storeAudio';
import {
  UploadCloud,
  Film,
  Check,
  Lock,
  Globe,
  Users,
  ArrowRight,
  ArrowLeft,
  Camera,
  Video,
  RotateCcw,
  Sparkles,
  Play,
  Pause,
  RefreshCw,
  Square,
  Circle,
  Image as ImageIcon,
  CheckCircle2,
  Edit3,
  Music,
  Palette,
  Type,
  X,
  Volume2,
  VolumeX,
  Smile,
  Layers,
} from 'lucide-react';

// Trending Background Music Tracks for Posts
const SAMPLE_MUSIC_TRACKS = [
  { id: 'track_1', title: 'Alpha Vibe (Bass Drop Anthem)', artist: 'DJ Kairo 🔥', genre: 'Trending' },
  { id: 'track_2', title: 'Midnight Acoustic & Strings', artist: 'Hamza Live 🎸', genre: 'Love / Acoustic' },
  { id: 'track_3', title: 'Lahore Sufi Qawwali Beat', artist: 'Ustad Ali 🎙️', genre: 'Sufi / Ghazal' },
  { id: 'track_4', title: 'Neon Sunset Cyberpunk', artist: 'Elena Dance 💃', genre: 'EDM Party' },
  { id: 'track_5', title: 'Lo-Fi Midnight Coffee', artist: 'Chill Beats ☕', genre: 'Relaxed' },
  { id: 'track_6', title: 'Arabic Desert Oud Melody', artist: 'Sultan Sound 👑', genre: 'Royal Oud' },
];

// Canvas Background Presets
const CANVAS_BG_PRESETS = [
  { id: 'royal_velvet', name: 'Royal Velvet', gradient: 'from-[#4C1D95] via-[#2E1065] to-[#1E0836]', textColor: 'text-white' },
  { id: 'sunset_blaze', name: 'Sunset Gold', gradient: 'from-[#EA580C] via-[#B45309] to-[#78350F]', textColor: 'text-white' },
  { id: 'cyber_pink', name: 'Cyber Pink', gradient: 'from-[#DB2777] via-[#9D174D] to-[#500724]', textColor: 'text-white' },
  { id: 'emerald_mint', name: 'Emerald Mint', gradient: 'from-[#059669] via-[#047857] to-[#064E3B]', textColor: 'text-white' },
  { id: 'sapphire_blue', name: 'Sapphire Blue', gradient: 'from-[#2563EB] via-[#1D4ED8] to-[#0F172A]', textColor: 'text-white' },
  { id: 'midnight_carbon', name: 'Midnight Carbon', gradient: 'from-[#27272A] via-[#18181B] to-[#09090B]', textColor: 'text-zinc-100' },
  { id: 'parchment_gold', name: 'Parchment Gold', gradient: 'from-[#FEF08A] via-[#FDE047] to-[#CA8A04]', textColor: 'text-zinc-900' },
];

export const VideoUploadScreen: React.FC = () => {
  const { addVideoPost, currentUser, setActiveTab, setCurrentScreen } = useApp();

  // Mode: 'record' (Record Video) | 'photo' (Snap Photo) | 'gallery' (Upload from device) | 'post' (Write Post ✍️)
  const [activeMode, setActiveMode] = useState<'record' | 'photo' | 'gallery' | 'post'>('post');

  // Camera stream & recording state
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Captured media preview state
  const [capturedVideoUrl, setCapturedVideoUrl] = useState<string | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [customThumbnail, setCustomThumbnail] = useState<string | null>(null);

  // =========================================================================
  // POST MODE STATES (PEN TEXT, PHOTO ATTACHMENT, MUSIC, TEXT-OVER-PHOTO)
  // =========================================================================
  const [postText, setPostText] = useState('');
  const [selectedBgId, setSelectedBgId] = useState('royal_velvet');
  const [fontStyle, setFontStyle] = useState<'sans' | 'serif' | 'script' | 'neon'>('sans');
  const [postAttachedPhoto, setPostAttachedPhoto] = useState<string | null>(null);
  const [isTextOnPhoto, setIsTextOnPhoto] = useState(true);
  const [selectedMusic, setSelectedMusic] = useState<typeof SAMPLE_MUSIC_TRACKS[0] | null>(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [showMusicModal, setShowMusicModal] = useState(false);

  // Post form details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('#AlphaMoments #LiveParty #Trending');
  const [privacy, setPrivacy] = useState<'Public' | 'Friends' | 'Private'>('Public');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const galleryVideoInputRef = useRef<HTMLInputElement>(null);
  const galleryPhotoInputRef = useRef<HTMLInputElement>(null);
  const postPhotoInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const sampleStockVideos = [
    {
      url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-dancing-in-a-neon-room-42468-large.mp4',
      thumb: 'https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&w=600&q=80',
      label: 'Neon Dance Clip',
    },
    {
      url: 'https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-dj-playing-music-on-a-sound-mixer-41666-large.mp4',
      thumb: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80',
      label: 'EDM DJ Set',
    },
    {
      url: 'https://assets.mixkit.co/videos/preview/mixkit-young-woman-singing-into-a-microphone-in-a-studio-41484-large.mp4',
      thumb: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=600&q=80',
      label: 'Studio Vocals',
    },
  ];

  // Initialize or switch live camera stream
  useEffect(() => {
    let isMounted = true;

    // Only activate camera when in 'record' or 'photo' mode and no media is captured yet
    if ((activeMode === 'record' || activeMode === 'photo') && !capturedVideoUrl && !capturedPhotoUrl) {
      const startCamera = async () => {
        try {
          const stream = await p2pStreamingEngine.getLocalMediaStream(facingMode, true);
          if (cameraPreviewRef.current && isMounted) {
            cameraPreviewRef.current.srcObject = stream;
            cameraPreviewRef.current.play().catch(() => {});
          }
        } catch (err) {
          console.warn('Upload camera start error', err);
        }
      };
      startCamera();
    } else {
      // If in gallery/post mode or viewing recorded media, stop live viewfinder
      p2pStreamingEngine.stopLocalMediaStream();
    }

    return () => {
      isMounted = false;
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      stopMusicSnippet();
    };
  }, [activeMode, facingMode, capturedVideoUrl, capturedPhotoUrl]);

  // Flip Camera between front & rear
  const handleFlipCamera = async () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    try {
      const stream = await p2pStreamingEngine.flipCamera();
      if (cameraPreviewRef.current) {
        cameraPreviewRef.current.srcObject = stream;
        cameraPreviewRef.current.play().catch(() => {});
      }
      showToast(nextFacing === 'user' ? 'Switched to Front Camera 🤳' : 'Switched to Rear Camera 📷');
    } catch (err) {
      console.warn('Flip camera error', err);
    }
  };

  // Start Video Recording with MediaRecorder
  const handleStartRecording = () => {
    try {
      const stream = cameraPreviewRef.current?.srcObject as MediaStream;
      if (!stream) {
        showToast('Camera is initializing...');
        return;
      }

      recordedChunksRef.current = [];
      const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? { mimeType: 'video/webm;codecs=vp9,opus' }
        : MediaRecorder.isTypeSupported('video/webm')
        ? { mimeType: 'video/webm' }
        : MediaRecorder.isTypeSupported('video/mp4')
        ? { mimeType: 'video/mp4' }
        : undefined;

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mime = mediaRecorder.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        const videoUrl = URL.createObjectURL(blob);
        setCapturedVideoUrl(videoUrl);
        setCustomThumbnail(currentUser.avatar);
        if (!title) setTitle(`Live Moment ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
        p2pStreamingEngine.stopLocalMediaStream();
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 60) {
            handleStopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);

      showToast('Recording started! 🔴');
    } catch (err) {
      console.warn('MediaRecorder start error', err);
      showToast('Recording not supported on this browser, using sample');
    }
  };

  // Stop Video Recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
    showToast('Recording finished! 🎬');
  };

  // Reset & Re-record video
  const handleResetRecording = () => {
    setCapturedVideoUrl(null);
    setRecordingSeconds(0);
  };

  // Snap photo snapshot from live video feed
  const handleSnapPhoto = () => {
    const video = cameraPreviewRef.current;
    if (!video) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.92);

      setCapturedPhotoUrl(photoDataUrl);
      setCustomThumbnail(photoDataUrl);
      if (!title) setTitle(`Photo Moment ${new Date().toLocaleDateString()}`);
      p2pStreamingEngine.stopLocalMediaStream();
      showToast('Photo captured! 📸');
    } catch (err) {
      console.warn('Snap photo error', err);
    }
  };

  // Reset captured photo
  const handleResetPhoto = () => {
    setCapturedPhotoUrl(null);
  };

  // Gallery File Upload (Video)
  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCapturedVideoUrl(url);
      setCapturedPhotoUrl(null);
      setCustomThumbnail(currentUser.avatar);
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
      showToast('Video selected from gallery! 🎥');
    }
  };

  // Gallery File Upload (Photo)
  const handlePhotoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 800, 800, 0.75);
        setCapturedPhotoUrl(compressed);
        setCapturedVideoUrl(null);
        setCustomThumbnail(compressed);
        if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
        showToast('Photo selected from gallery! 🖼️');
      } catch {
        showToast('Error processing selected photo.');
      }
    }
  };

  // Attach photo inside Post mode
  const handlePostPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 900, 900, 0.8);
        setPostAttachedPhoto(compressed);
        showToast('Photo attached to post! 🖼️');
      } catch {
        showToast('Error attaching photo.');
      }
    }
  };

  // Toggle Background Music Audio Preview
  const handleToggleMusicPlayback = () => {
    if (isPlayingMusic) {
      stopMusicSnippet();
      setIsPlayingMusic(false);
    } else {
      playMusicSnippet(selectedMusic?.genre === 'Love / Acoustic' ? 'acoustic' : 'vibe');
      setIsPlayingMusic(true);
    }
  };

  // Select Music Track
  const handleSelectTrack = (track: typeof SAMPLE_MUSIC_TRACKS[0]) => {
    setSelectedMusic(track);
    setShowMusicModal(false);
    playMusicSnippet(track.genre === 'Love / Acoustic' ? 'acoustic' : 'vibe');
    setIsPlayingMusic(true);
    showToast(`Attached song: ${track.title} 🎵`);
  };

  const handleSelectSample = (sample: typeof sampleStockVideos[0]) => {
    setCapturedVideoUrl(sample.url);
    setCapturedPhotoUrl(null);
    setCustomThumbnail(sample.thumb);
    if (!title) setTitle(sample.label);
    showToast(`Loaded sample: ${sample.label}`);
  };

  // Publish to Moments Feed & User Profile
  const handlePublish = () => {
    if (activeMode === 'post') {
      if (!postText.trim() && !postAttachedPhoto) {
        showToast('Please write some text or attach a photo for your post ✍️');
        return;
      }
    } else {
      if (!title.trim()) {
        showToast('Please enter a title for your moment');
        return;
      }
      if (!capturedVideoUrl && !capturedPhotoUrl) {
        showToast('Please record a video, snap a photo, or choose a file');
        return;
      }
    }

    setIsUploading(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 25;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          stopMusicSnippet();

          if (activeMode === 'post') {
            const chosenBg = CANVAS_BG_PRESETS.find((b) => b.id === selectedBgId) || CANVAS_BG_PRESETS[0];
            const finalTitle = title.trim() || (postText.length > 30 ? `${postText.slice(0, 30)}...` : postText) || 'Moment Post';

            addVideoPost({
              user: currentUser,
              videoUrl: postAttachedPhoto || sampleStockVideos[0].url,
              thumbnail: postAttachedPhoto || currentUser.avatar,
              title: finalTitle,
              description: description.trim() || postText.trim(),
              tags: tags.split(' ').filter(Boolean),
              feedCategory: 'For You',
              postType: 'post',
              textContent: postText.trim(),
              attachedPhotoUrl: postAttachedPhoto || undefined,
              isTextOnPhoto: isTextOnPhoto && !!postAttachedPhoto,
              backgroundColor: chosenBg.gradient,
              musicTitle: selectedMusic?.title,
              musicArtist: selectedMusic?.artist,
              fontStyle,
            });
            showToast('Post published to Moments & Profile! 📝✨');
          } else {
            addVideoPost({
              user: currentUser,
              videoUrl: capturedVideoUrl || sampleStockVideos[0].url,
              thumbnail: capturedPhotoUrl || customThumbnail || currentUser.avatar,
              title: title.trim(),
              description: description.trim() || title.trim(),
              tags: tags.split(' ').filter(Boolean),
              feedCategory: 'For You',
              postType: capturedPhotoUrl ? 'post' : 'video',
            });
            showToast('Moment published successfully! 🚀');
          }

          setIsUploading(false);
          setUploadProgress(0);

          // Route immediately to Moments feed to watch published creation!
          setActiveTab('moments');
          setCurrentScreen('moments');
        }, 350);
      }
    }, 150);
  };

  // Format recording timer
  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const activeBg = CANVAS_BG_PRESETS.find((b) => b.id === selectedBgId) || CANVAS_BG_PRESETS[0];

  return (
    <div className="relative w-full h-full min-h-screen pb-28 bg-[#09070F] text-white overflow-y-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1A1033]/95 border border-[#A855F7]/40 shadow-2xl backdrop-blur-md text-xs font-semibold text-white flex items-center gap-2 animate-bounce pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-[#EC4899]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={galleryVideoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleVideoFileSelect}
      />
      <input
        ref={galleryPhotoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoFileSelect}
      />
      <input
        ref={postPhotoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePostPhotoSelect}
      />

      {/* Top Bar with Back Button */}
      <div className="sticky top-0 z-30 w-full bg-[#09070F]/85 backdrop-blur-md border-b border-[#A855F7]/15 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              p2pStreamingEngine.stopLocalMediaStream();
              stopMusicSnippet();
              setActiveTab('moments');
              setCurrentScreen('moments');
            }}
            className="w-8 h-8 rounded-full bg-[#1A1133] flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-base font-bold text-white">
            {activeMode === 'post' ? 'Create Post' : 'Create Moment'}
          </span>
        </div>

        {/* Flip Camera Button when viewfinder is active */}
        {(activeMode === 'record' || activeMode === 'photo') && !capturedVideoUrl && !capturedPhotoUrl && (
          <button
            onClick={handleFlipCamera}
            className="px-3 py-1.5 rounded-full bg-[#1C1236] border border-[#A855F7]/30 text-xs font-bold text-[#C084FC] flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-md"
            title="Rotate Camera"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{facingMode === 'user' ? 'Front' : 'Rear'}</span>
          </button>
        )}
      </div>

      <div className="p-4 max-w-sm mx-auto">
        {/* =====================================================================
            CREATION MODES: Record | Photo | Gallery | Post (✍️ Pen Option Added)
            ===================================================================== */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-[#140D26] border border-[#A855F7]/20 mb-4">
          {/* 1. Post (✍️ Pen Option as requested) */}
          <button
            type="button"
            onClick={() => {
              setActiveMode('post');
              p2pStreamingEngine.stopLocalMediaStream();
            }}
            className={`py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              activeMode === 'post'
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Post</span>
          </button>

          {/* 2. Record */}
          <button
            type="button"
            onClick={() => {
              setActiveMode('record');
              setCapturedVideoUrl(null);
              setCapturedPhotoUrl(null);
            }}
            className={`py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              activeMode === 'record'
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Record</span>
          </button>

          {/* 3. Photo */}
          <button
            type="button"
            onClick={() => {
              setActiveMode('photo');
              setCapturedVideoUrl(null);
              setCapturedPhotoUrl(null);
            }}
            className={`py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              activeMode === 'photo'
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Photo</span>
          </button>

          {/* 4. Gallery */}
          <button
            type="button"
            onClick={() => {
              setActiveMode('gallery');
              p2pStreamingEngine.stopLocalMediaStream();
            }}
            className={`py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              activeMode === 'gallery'
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Gallery</span>
          </button>
        </div>

        {/* =========================================================================
            SECTION 1: POST MODE (PEN CANVAS, TEXT OVER PHOTO & MUSIC ATTACHMENT)
            ========================================================================= */}
        {activeMode === 'post' && (
          <div className="space-y-4 mb-4 animate-fade-in">
            {/* Live Interactive Canvas Card Preview */}
            <div
              className={`relative rounded-3xl overflow-hidden shadow-2xl p-4 sm:p-5 min-h-[260px] flex flex-col justify-between transition-all ${
                postAttachedPhoto ? 'bg-black' : `bg-gradient-to-br ${activeBg.gradient}`
              }`}
            >
              {/* If Photo is attached as background */}
              {postAttachedPhoto && (
                <div className="absolute inset-0 z-0">
                  <img src={postAttachedPhoto} alt="Attached" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px]" />
                </div>
              )}

              {/* Top Row: User Avatar & Attached Music Pill */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={currentUser.avatar}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover border-2 border-white/40 shadow-sm"
                  />
                  <div>
                    <span className="text-xs font-black text-white drop-shadow block leading-none">
                      {currentUser.displayName}
                    </span>
                    <span className="text-[9.5px] text-zinc-300 drop-shadow">Now</span>
                  </div>
                </div>

                {/* Music Badge if attached */}
                {selectedMusic && (
                  <div
                    onClick={handleToggleMusicPlayback}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-[#EC4899]/50 text-white text-[10px] font-bold cursor-pointer hover:bg-black/80 transition-all shadow-md"
                    title="Click to play / pause track preview"
                  >
                    <Music className={`w-3 h-3 text-[#EC4899] ${isPlayingMusic ? 'animate-bounce' : ''}`} />
                    <span className="truncate max-w-[100px]">{selectedMusic.title}</span>
                    {isPlayingMusic ? <Volume2 className="w-3 h-3 text-emerald-400" /> : <Play className="w-2.5 h-2.5 fill-current" />}
                  </div>
                )}
              </div>

              {/* Main Pen Writing Area (Live WYSIWYG Editor on the Card) */}
              <div className="relative z-10 my-4 flex-1 flex items-center justify-center">
                {postAttachedPhoto && isTextOnPhoto ? (
                  /* Text Over Photo Mode: Frosted Glass Overlay Card */
                  <div className="w-full rounded-2xl bg-black/45 backdrop-blur-md border border-white/20 p-4 shadow-xl text-center">
                    <textarea
                      rows={3}
                      value={postText}
                      onChange={(e) => setPostText(e.target.value)}
                      placeholder="Type text over photo..."
                      className={`w-full bg-transparent text-white placeholder-zinc-300 text-sm sm:text-base text-center font-bold focus:outline-none resize-none leading-relaxed ${
                        fontStyle === 'serif'
                          ? 'font-serif italic'
                          : fontStyle === 'neon'
                          ? 'font-mono text-[#F472B6] drop-shadow-[0_0_10px_#EC4899]'
                          : fontStyle === 'script'
                          ? 'font-serif tracking-wide'
                          : 'font-sans font-black'
                      }`}
                    />
                  </div>
                ) : (
                  /* Canvas Solid / Gradient Text Mode */
                  <textarea
                    rows={4}
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    placeholder="Write your thoughts, status, quotes or announcements..."
                    className={`w-full bg-transparent placeholder-white/60 text-base sm:text-lg text-center font-black focus:outline-none resize-none leading-relaxed drop-shadow ${
                      activeBg.textColor
                    } ${
                      fontStyle === 'serif'
                        ? 'font-serif italic'
                        : fontStyle === 'neon'
                        ? 'font-mono text-[#F472B6] drop-shadow-[0_0_12px_#EC4899]'
                        : fontStyle === 'script'
                        ? 'font-serif tracking-wide'
                        : 'font-sans'
                    }`}
                  />
                )}
              </div>

              {/* Bottom Card Footer: Attached Photo Pill if present */}
              <div className="relative z-10 flex items-center justify-between text-[10px] text-white/80">
                <span className="font-mono">{postText.length} characters</span>
                {postAttachedPhoto && (
                  <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-emerald-300 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Photo Attached
                  </span>
                )}
              </div>
            </div>

            {/* Post Editing Toolbar: Pen Font Styles, Canvas Backgrounds, Attach Photo, Attach Song */}
            <div className="p-3 rounded-2xl bg-[#140E28] border border-[#A855F7]/25 space-y-3">
              {/* Pen Typography Styles */}
              <div>
                <label className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5 mb-1.5">
                  <Type className="w-3.5 h-3.5 text-[#C084FC]" />
                  <span>Pen & Font Style</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'sans', label: 'Classic Bold', class: 'font-sans font-black' },
                    { id: 'serif', label: 'Poetry Serif', class: 'font-serif italic' },
                    { id: 'neon', label: 'Neon Glow', class: 'font-mono text-pink-400' },
                    { id: 'script', label: 'Script', class: 'font-serif tracking-wider' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFontStyle(f.id as any)}
                      className={`py-1.5 rounded-xl text-[10px] border transition-all cursor-pointer ${
                        fontStyle === f.id
                          ? 'bg-[#7928CA] border-[#EC4899] text-white shadow-md'
                          : 'bg-[#1C1236] border-white/5 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span className={f.class}>{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Canvas Color / Gradient Selector (If no photo is attached) */}
              {!postAttachedPhoto && (
                <div>
                  <label className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5 mb-1.5">
                    <Palette className="w-3.5 h-3.5 text-[#C084FC]" />
                    <span>Background Themes</span>
                  </label>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {CANVAS_BG_PRESETS.map((bg) => (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => setSelectedBgId(bg.id)}
                        className={`w-7 h-7 rounded-full bg-gradient-to-br ${bg.gradient} shrink-0 border-2 transition-transform cursor-pointer ${
                          selectedBgId === bg.id ? 'border-white scale-110 shadow-lg shadow-purple-500/50' : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                        title={bg.name}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons: Attach Photo & Attach Music Track */}
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2">
                {/* 1. Attach Photo Button */}
                <button
                  type="button"
                  onClick={() => postPhotoInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-[#231542] hover:bg-[#2F1C58] border border-[#A855F7]/30 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{postAttachedPhoto ? 'Change Photo' : 'Attach Photo 🖼️'}</span>
                </button>

                {/* 2. Attach Music Button */}
                <button
                  type="button"
                  onClick={() => setShowMusicModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#231542] hover:bg-[#2F1C58] border border-[#A855F7]/30 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                >
                  <Music className="w-3.5 h-3.5 text-amber-400" />
                  <span>{selectedMusic ? 'Change Song 🎵' : 'Add Music 🎵'}</span>
                </button>

                {/* Remove photo button if photo exists */}
                {postAttachedPhoto && (
                  <button
                    type="button"
                    onClick={() => setPostAttachedPhoto(null)}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-rose-900/80"
                  >
                    <X className="w-3 h-3" />
                    <span>Remove Photo</span>
                  </button>
                )}
              </div>

              {/* Toggle: Text Overlay on Photo vs Photo with Caption */}
              {postAttachedPhoto && (
                <div className="p-2.5 rounded-xl bg-[#1C1236] border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#C084FC]" />
                    <div>
                      <span className="text-xs font-bold text-white block">Text on Photo</span>
                      <span className="text-[10px] text-zinc-400">Render text directly on top of image</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTextOnPhoto(!isTextOnPhoto)}
                    className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                      isTextOnPhoto ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899]' : 'bg-zinc-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        isTextOnPhoto ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION 2: RECORD VIDEO VIA CAMERA
            ========================================================================= */}
        {activeMode === 'record' && (
          <div className="relative rounded-3xl overflow-hidden bg-black border border-[#A855F7]/30 shadow-2xl mb-4">
            {capturedVideoUrl ? (
              /* Recorded Video Playback Preview */
              <div className="relative w-full h-80 bg-black flex flex-col justify-between">
                <video
                  src={capturedVideoUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleResetRecording}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-xs font-bold text-white flex items-center gap-1.5 shadow-lg cursor-pointer hover:bg-black/90"
                >
                  <RefreshCw className="w-3 h-3 text-[#EC4899]" />
                  <span>Re-record</span>
                </button>
              </div>
            ) : (
              /* Live Camera Viewfinder for Recording */
              <div className="relative w-full h-80 bg-zinc-950 flex items-center justify-center">
                <video
                  ref={cameraPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />

                {/* Recording Timer Badge */}
                {isRecording && (
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-red-600/90 text-white text-xs font-bold flex items-center gap-2 shadow-lg animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    <span>REC {formatTimer(recordingSeconds)} / 01:00</span>
                  </div>
                )}

                {/* Shutter Recording Button Controls */}
                <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-6">
                  {isRecording ? (
                    <button
                      type="button"
                      onClick={handleStopRecording}
                      className="w-16 h-16 rounded-full bg-red-600 border-4 border-white flex items-center justify-center shadow-xl active:scale-95 transition-transform cursor-pointer"
                      title="Stop Recording"
                    >
                      <Square className="w-6 h-6 text-white fill-white" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartRecording}
                      className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#EC4899] to-[#7928CA] border-4 border-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                      title="Start Recording"
                    >
                      <Circle className="w-6 h-6 text-white fill-white" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SECTION 3: SNAP PHOTO VIA CAMERA
            ========================================================================= */}
        {activeMode === 'photo' && (
          <div className="relative rounded-3xl overflow-hidden bg-black border border-[#A855F7]/30 shadow-2xl mb-4">
            {capturedPhotoUrl ? (
              /* Snapped Photo Preview */
              <div className="relative w-full h-80 bg-black flex flex-col justify-between">
                <img src={capturedPhotoUrl} alt="Captured" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={handleResetPhoto}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-xs font-bold text-white flex items-center gap-1.5 shadow-lg cursor-pointer hover:bg-black/90"
                >
                  <RefreshCw className="w-3 h-3 text-[#EC4899]" />
                  <span>Retake</span>
                </button>
              </div>
            ) : (
              /* Live Camera Viewfinder for Photo Snap */
              <div className="relative w-full h-80 bg-zinc-950 flex items-center justify-center">
                <video
                  ref={cameraPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />

                {/* Shutter Snap Photo Button */}
                <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={handleSnapPhoto}
                    className="w-16 h-16 rounded-full bg-white border-4 border-[#A855F7] flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                    title="Snap Photo"
                  >
                    <Camera className="w-7 h-7 text-[#7928CA]" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SECTION 4: GALLERY FILE PICKER
            ========================================================================= */}
        {activeMode === 'gallery' && (
          <div className="space-y-4 mb-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => galleryVideoInputRef.current?.click()}
                className="p-5 rounded-2xl bg-[#140E28] border-2 border-dashed border-[#A855F7]/40 hover:border-[#EC4899] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-[#7928CA]/20 flex items-center justify-center text-[#C084FC] group-hover:scale-110 transition-transform">
                  <Film className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-white">Upload Video</span>
                <span className="text-[10px] text-zinc-400">MP4, WebM, MOV</span>
              </button>

              <button
                type="button"
                onClick={() => galleryPhotoInputRef.current?.click()}
                className="p-5 rounded-2xl bg-[#140E28] border-2 border-dashed border-[#A855F7]/40 hover:border-[#EC4899] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-[#EC4899]/20 flex items-center justify-center text-[#EC4899] group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-white">Upload Photo</span>
                <span className="text-[10px] text-zinc-400">JPG, PNG, WebP</span>
              </button>
            </div>

            {/* Quick Sample Clips */}
            <div className="p-3 rounded-2xl bg-[#140E28] border border-white/5">
              <span className="text-xs font-semibold text-zinc-400 block mb-2">Or test with stock clips:</span>
              <div className="flex flex-wrap gap-2">
                {sampleStockVideos.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSample(sample)}
                    className="px-2.5 py-1 rounded-lg bg-[#21153D] text-[10px] text-[#C084FC] font-semibold hover:bg-[#2F1F56] border border-[#A855F7]/25 cursor-pointer"
                  >
                    + {sample.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION 5: DETAILS FORM (TITLE, CAPTION, HASHTAGS, PRIVACY)
            ========================================================================= */}
        <div className="space-y-3 mb-5">
          {/* Title Input */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Title
            </label>
            <input
              type="text"
              placeholder="Give your moment a catchy title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-[#140E28] border border-[#A855F7]/25 text-white placeholder-zinc-500 text-xs focus:border-[#A855F7] focus:outline-none"
            />
          </div>

          {/* Caption / Description Input */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Caption & Details
            </label>
            <textarea
              rows={2}
              placeholder="Write a caption or details for your moment..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#140E28] border border-[#A855F7]/25 text-white placeholder-zinc-500 text-xs focus:border-[#A855F7] focus:outline-none resize-none"
            />
          </div>

          {/* Hashtags Input & Clickable Quick Tags */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Hashtags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-[#140E28] border border-[#A855F7]/25 text-[#C084FC] text-xs focus:border-[#A855F7] focus:outline-none"
            />
            {/* Quick Hashtag Chips */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {['#AlphaMoments', '#DailyVibe', '#Trending', '#Quote', '#LiveParty', '#Creativity'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    if (!tags.includes(tag)) setTags((prev) => `${prev} ${tag}`.trim());
                  }}
                  className="px-2 py-0.5 rounded-md bg-[#22133D] hover:bg-[#311B57] text-[9.5px] font-bold text-purple-300 border border-purple-500/20 cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Privacy Settings */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">Who Can View</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Public', icon: Globe },
                { label: 'Friends', icon: Users },
                { label: 'Private', icon: Lock },
              ].map((p) => {
                const Icon = p.icon;
                const isSelected = privacy === p.label;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setPrivacy(p.label as any)}
                    className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#7928CA] border-[#EC4899] text-white shadow-md'
                        : 'bg-[#140E28] border-white/5 text-zinc-400'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Upload Progress Bar if active */}
        {isUploading && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-zinc-300 mb-1">
              <span>Publishing to Alpha Moments...</span>
              <span className="font-mono text-[#EC4899] font-bold">{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Publish Action Button */}
        <button
          onClick={handlePublish}
          disabled={
            isUploading ||
            (activeMode === 'post'
              ? !postText.trim() && !postAttachedPhoto
              : !capturedVideoUrl && !capturedPhotoUrl)
          }
          className="w-full h-12 rounded-xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] font-bold text-white text-xs sm:text-sm shadow-lg shadow-[#7928CA]/40 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>{isUploading ? 'Publishing...' : activeMode === 'post' ? 'Publish Post ✍️' : 'Publish to Moments'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* =========================================================================
          BACKGROUND MUSIC SELECTOR MODAL
          ========================================================================= */}
      {showMusicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl bg-[#1A0E30] border border-[#A855F7]/30 shadow-2xl p-5 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 text-[#EC4899]" />
                <h3 className="text-sm font-black text-white">Select Background Music</h3>
              </div>
              <button
                onClick={() => setShowMusicModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-none py-1">
              {SAMPLE_MUSIC_TRACKS.map((track) => (
                <div
                  key={track.id}
                  onClick={() => handleSelectTrack(track)}
                  className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[#A855F7]/40 flex items-center justify-between cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                      <Music className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{track.title}</h4>
                      <p className="text-[10px] text-zinc-400 truncate">{track.artist} • {track.genre}</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#7928CA]/30 text-[#C084FC] border border-[#A855F7]/30 shrink-0">
                    Select
                  </span>
                </div>
              ))}
            </div>

            {selectedMusic && (
              <button
                type="button"
                onClick={() => {
                  setSelectedMusic(null);
                  stopMusicSnippet();
                  setIsPlayingMusic(false);
                  setShowMusicModal(false);
                  showToast('Removed background music');
                }}
                className="w-full mt-3 py-2 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs font-bold hover:bg-rose-900/60 transition-colors"
              >
                Remove Current Music
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
