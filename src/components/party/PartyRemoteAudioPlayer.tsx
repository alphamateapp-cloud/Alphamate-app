import React, { useEffect, useRef } from 'react';

interface PartyRemoteAudioPlayerProps {
  peerId: string;
  stream: MediaStream;
  isSpeakerOn: boolean;
  onRegisterAudioEl: (peerId: string, el: HTMLAudioElement | null) => void;
  onAutoplayStateChange: (blocked: boolean) => void;
}

export const PartyRemoteAudioPlayer: React.FC<PartyRemoteAudioPlayerProps> = React.memo(
  ({ peerId, stream, isSpeakerOn, onRegisterAudioEl, onAutoplayStateChange }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const isSpeakerOnRef = useRef<boolean>(isSpeakerOn);
    isSpeakerOnRef.current = isSpeakerOn;

    useEffect(() => {
      const el = audioRef.current;
      onRegisterAudioEl(peerId, el);
      return () => {
        onRegisterAudioEl(peerId, null);
      };
    }, [peerId, onRegisterAudioEl]);

    useEffect(() => {
      const el = audioRef.current;
      if (!el) return;

      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }

      const attemptPlay = () => {
        el.muted = !isSpeakerOnRef.current;
        el.volume = 1;
        // Receiver tracks are controlled by the publisher's microphone state. Do not
        // override MediaStreamTrack.enabled here; only control this output element.
        const playPromise = el.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise
            .then(() => {
              onAutoplayStateChange(false);
            })
            .catch(() => {
              onAutoplayStateChange(true);
            });
        }
      };

      const handleCanPlay = () => {
        if (isSpeakerOnRef.current && el.paused) {
          attemptPlay();
        }
      };

      const handlePlaying = () => {
        onAutoplayStateChange(false);
      };
      const handleUnmute = () => {
        if (isSpeakerOnRef.current) {
          attemptPlay();
        }
      };
      const handleStalled = () => {
        if (isSpeakerOnRef.current && stream.getAudioTracks().some((t) => t.readyState === 'live')) {
          attemptPlay();
        }
      };
      const bindTrackListeners = (track: MediaStreamTrack) => {
        track.addEventListener('unmute', handleUnmute);
      };
      const unbindTrackListeners = (track: MediaStreamTrack) => {
        track.removeEventListener('unmute', handleUnmute);
      };
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach(bindTrackListeners);

      const handleAddTrack = (e: MediaStreamTrackEvent) => {
        if (e.track?.kind === 'audio') {
          bindTrackListeners(e.track);
          // Re-assign srcObject cleanly if element stalled on an earlier dead track
          if (el.srcObject === stream) {
            el.srcObject = null;
            el.srcObject = stream;
          }
          attemptPlay();
        }
      };
      const handleRemoveTrack = (e: MediaStreamTrackEvent) => {
        if (e.track?.kind === 'audio') {
          unbindTrackListeners(e.track);
        }
      };
      stream.addEventListener('addtrack', handleAddTrack);
      stream.addEventListener('removetrack', handleRemoveTrack);
      el.addEventListener('canplay', handleCanPlay);
      el.addEventListener('loadedmetadata', handleCanPlay);
      el.addEventListener('playing', handlePlaying);
      el.addEventListener('stalled', handleStalled);
      attemptPlay();

      return () => {
        stream.removeEventListener('addtrack', handleAddTrack);
        stream.removeEventListener('removetrack', handleRemoveTrack);
        el.removeEventListener('canplay', handleCanPlay);
        el.removeEventListener('loadedmetadata', handleCanPlay);
        el.removeEventListener('playing', handlePlaying);
        el.removeEventListener('stalled', handleStalled);
        stream.getAudioTracks().forEach(unbindTrackListeners);
      };
    }, [stream, onAutoplayStateChange]);

    useEffect(() => {
      const el = audioRef.current;
      if (!el) return;
      el.muted = !isSpeakerOn;
      el.volume = 1;
      if (isSpeakerOn && el.srcObject && el.paused) {
        el.play()
          .then(() => onAutoplayStateChange(false))
          .catch(() => onAutoplayStateChange(true));
      }
    }, [isSpeakerOn, onAutoplayStateChange]);

    return (
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        data-peer-id={peerId}
        preload="auto"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
    );
  }
);

PartyRemoteAudioPlayer.displayName = 'PartyRemoteAudioPlayer';
