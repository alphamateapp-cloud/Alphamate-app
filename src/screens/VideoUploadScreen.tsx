import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { p2pStreamingEngine } from '../services/webrtcService';
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
} from 'lucide-react';

export const VideoUploadScreen: React.FC = () => {
  const { addVideoPost, currentUser, setActiveTab, setCurrentScreen } = useApp();

  // Mode: 'record' (Record Video) | 'photo' (Snap Photo) | 'gallery' (Upload from device)
  const [activeMode, setActiveMode] = useState<'record' | 'photo' | 'gallery'>('record');

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
      // If in gallery mode or viewing recorded media, stop live viewfinder
      p2pStreamingEngine.stopLocalMediaStream();
    }

    return () => {
      isMounted = false;
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
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

      mediaRecorder.start(250); // Slice chunks every 250ms
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

      // Handle front camera mirror in saved photo
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
  const handlePhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCapturedPhotoUrl(reader.result);
          setCapturedVideoUrl(null);
          setCustomThumbnail(reader.result);
          if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
          showToast('Photo selected from gallery! 🖼️');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectSample = (sample: typeof sampleStockVideos[0]) => {
    setCapturedVideoUrl(sample.url);
    setCapturedPhotoUrl(null);
    setCustomThumbnail(sample.thumb);
    if (!title) setTitle(sample.label);
    showToast(`Loaded sample: ${sample.label}`);
  };

  // Publish to Moments Feed
  const handlePublish = () => {
    if (!title.trim()) {
      showToast('Please enter a title for your moment');
      return;
    }

    if (!capturedVideoUrl && !capturedPhotoUrl) {
      showToast('Please record a video, snap a photo, or choose a file');
      return;
    }

    setIsUploading(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 25;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
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
          setIsUploading(false);
          setUploadProgress(0);
          showToast('Moment published successfully! 🚀');

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

  return (
    <div className="relative w-full h-full min-h-screen pb-28 bg-[#09070F] text-white overflow-y-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1A1033]/95 border border-[#A855F7]/40 shadow-2xl backdrop-blur-md text-xs font-semibold text-white flex items-center gap-2 animate-bounce pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-[#EC4899]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hidden Gallery File Inputs */}
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

      {/* Top Bar with Back Button */}
      <div className="sticky top-0 z-30 w-full bg-[#09070F]/85 backdrop-blur-md border-b border-[#A855F7]/15 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              p2pStreamingEngine.stopLocalMediaStream();
              setActiveTab('moments');
              setCurrentScreen('moments');
            }}
            className="w-8 h-8 rounded-full bg-[#1A1133] flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-base font-bold text-white">Create Moment</span>
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
        {/* Creation Modes Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-[#140D26] border border-[#A855F7]/20 mb-4">
          <button
            type="button"
            onClick={() => {
              setActiveMode('record');
              setCapturedVideoUrl(null);
              setCapturedPhotoUrl(null);
            }}
            className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeMode === 'record'
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Record</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode('photo');
              setCapturedVideoUrl(null);
              setCapturedPhotoUrl(null);
            }}
            className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeMode === 'photo'
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Photo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode('gallery');
            }}
            className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
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
            SECTION 1: RECORD VIDEO VIA CAMERA
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
                <div className="absolute top-3 right-3 z-20">
                  <button
                    onClick={handleResetRecording}
                    className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-xs font-bold text-rose-300 flex items-center gap-1.5 hover:bg-black/80 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-record</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Live Camera Viewfinder & Recording Controls */
              <div className="relative w-full h-80 bg-zinc-950 flex items-center justify-center overflow-hidden">
                <video
                  ref={cameraPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${
                    facingMode === 'user' ? 'scale-x-[-1]' : 'scale-x-100'
                  }`}
                />

                {/* Dark gradient overlay for HUD */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

                {/* Recording Timer Badge */}
                {isRecording && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-rose-600/90 text-white text-xs font-black tracking-widest flex items-center gap-2 shadow-lg animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    <span>REC {formatTimer(recordingSeconds)} / 01:00</span>
                  </div>
                )}

                {/* Viewfinder Grid Marks */}
                <div className="absolute inset-4 border border-white/10 rounded-2xl pointer-events-none" />

                {/* Camera Record Shutter Button at bottom */}
                <div className="absolute bottom-4 inset-x-0 z-20 flex items-center justify-around px-8">
                  <div className="w-10" />

                  {isRecording ? (
                    <button
                      onClick={handleStopRecording}
                      className="w-16 h-16 rounded-full bg-rose-600 border-4 border-white flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer animate-pulse"
                      title="Stop Recording"
                    >
                      <Square className="w-6 h-6 fill-white" />
                    </button>
                  ) : (
                    <button
                      onClick={handleStartRecording}
                      className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#7928CA] to-[#EC4899] border-4 border-white flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      title="Start Recording"
                    >
                      <Circle className="w-6 h-6 fill-white" />
                    </button>
                  )}

                  {/* Quick rotate camera button */}
                  <button
                    onClick={handleFlipCamera}
                    disabled={isRecording}
                    className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/80 active:scale-90 transition-all cursor-pointer disabled:opacity-40"
                    title="Flip Camera"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SECTION 2: SNAP PHOTO VIA CAMERA
            ========================================================================= */}
        {activeMode === 'photo' && (
          <div className="relative rounded-3xl overflow-hidden bg-black border border-[#A855F7]/30 shadow-2xl mb-4">
            {capturedPhotoUrl ? (
              /* Captured Photo Preview */
              <div className="relative w-full h-80 bg-black flex items-center justify-center">
                <img
                  src={capturedPhotoUrl}
                  alt="Captured Moment"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 z-20">
                  <button
                    onClick={handleResetPhoto}
                    className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-xs font-bold text-rose-300 flex items-center gap-1.5 hover:bg-black/80 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retake</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Live Camera Photo Viewfinder */
              <div className="relative w-full h-80 bg-zinc-950 flex items-center justify-center overflow-hidden">
                <video
                  ref={cameraPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${
                    facingMode === 'user' ? 'scale-x-[-1]' : 'scale-x-100'
                  }`}
                />

                {/* Dark gradient overlay for HUD */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

                {/* Shutter Button */}
                <div className="absolute bottom-4 inset-x-0 z-20 flex items-center justify-around px-8">
                  <div className="w-10" />

                  <button
                    onClick={handleSnapPhoto}
                    className="w-16 h-16 rounded-full bg-white border-4 border-[#7928CA] flex items-center justify-center text-[#7928CA] shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    title="Take Photo"
                  >
                    <Camera className="w-7 h-7" />
                  </button>

                  <button
                    onClick={handleFlipCamera}
                    className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/80 active:scale-90 transition-all cursor-pointer"
                    title="Flip Camera"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SECTION 3: UPLOAD FROM GALLERY
            ========================================================================= */}
        {activeMode === 'gallery' && (
          <div className="mb-4 space-y-3">
            {capturedVideoUrl || capturedPhotoUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-[#A855F7]/30 bg-black h-48 flex items-center justify-center">
                {capturedVideoUrl ? (
                  <video src={capturedVideoUrl} controls className="w-full h-full object-cover" />
                ) : (
                  <img src={capturedPhotoUrl!} alt="" className="w-full h-full object-cover" />
                )}
                <button
                  onClick={() => {
                    setCapturedVideoUrl(null);
                    setCapturedPhotoUrl(null);
                  }}
                  className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-black/70 text-xs font-bold text-white hover:bg-black"
                >
                  Change Media
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {/* Pick Video from Gallery */}
                <button
                  type="button"
                  onClick={() => galleryVideoInputRef.current?.click()}
                  className="p-5 rounded-2xl bg-[#140D26] hover:bg-[#1E1238] border border-[#A855F7]/30 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group shadow-lg"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#7928CA] to-[#9333EA] flex items-center justify-center text-white mb-2 shadow-md group-hover:scale-105 transition-transform">
                    <Video className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-white block">Video Gallery</span>
                  <span className="text-[10px] text-zinc-400 mt-0.5">MP4, MOV, WEBM</span>
                </button>

                {/* Pick Photo from Gallery */}
                <button
                  type="button"
                  onClick={() => galleryPhotoInputRef.current?.click()}
                  className="p-5 rounded-2xl bg-[#140D26] hover:bg-[#1E1238] border border-[#EC4899]/30 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group shadow-lg"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#EC4899] to-[#F59E0B] flex items-center justify-center text-white mb-2 shadow-md group-hover:scale-105 transition-transform">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-white block">Photo Gallery</span>
                  <span className="text-[10px] text-zinc-400 mt-0.5">JPG, PNG, WebP</span>
                </button>
              </div>
            )}

            {/* Quick stock video pickers */}
            <div className="p-3 rounded-2xl bg-[#140D26]/70 border border-white/5">
              <span className="text-[10px] text-zinc-400 font-semibold block mb-1.5 uppercase tracking-wider">
                Or select demo clip:
              </span>
              <div className="flex flex-wrap gap-1.5">
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
            SECTION 4: PUBLISH DETAILS FORM
            ========================================================================= */}
        <div className="space-y-3 mb-5">
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">Title</label>
            <input
              type="text"
              placeholder="Give your moment a catchy title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-[#140E28] border border-[#A855F7]/25 text-white placeholder-zinc-500 text-xs focus:border-[#A855F7] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Caption / Description
            </label>
            <textarea
              rows={2}
              placeholder="Write a caption for your moment..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#140E28] border border-[#A855F7]/25 text-white placeholder-zinc-500 text-xs focus:border-[#A855F7] focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">Hashtags</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-[#140E28] border border-[#A855F7]/25 text-[#C084FC] text-xs focus:border-[#A855F7] focus:outline-none"
            />
          </div>

          {/* Privacy Settings */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">Who Can Watch</label>
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
          disabled={isUploading || (!capturedVideoUrl && !capturedPhotoUrl)}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] font-bold text-white text-xs sm:text-sm shadow-lg shadow-[#7928CA]/40 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>{isUploading ? 'Publishing...' : 'Publish to Moments'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
