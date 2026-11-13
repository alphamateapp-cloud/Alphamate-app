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
        stream.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
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

      el.addEventListener('canplay', handleCanPlay);
      el.addEventListener('playing', handlePlaying);

      attemptPlay();

      const audioTracks = stream.getAudioTracks();
      const handleUnmute = () => {
        attemptPlay();
      };
      audioTracks.forEach((track) => {
        track.addEventListener('unmute', handleUnmute);
      });

      return () => {
        el.removeEventListener('canplay', handleCanPlay);
        el.removeEventListener('playing', handlePlaying);
        audioTracks.forEach((track) => {
          track.removeEventListener('unmute', handleUnmute);
        });
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
      />
    );
  }
);

PartyRemoteAudioPlayer.displayName = 'PartyRemoteAudioPlayer';
