// src/hooks/useVoiceChat.ts
// ============================================================================
// WebRTC Voice Chat Hook with Firebase Signaling
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ref,
  onValue,
  set,
  update,
  remove,
  onDisconnect,
  get,
  push,
} from 'firebase/database';
import { db } from '../firebase/config';
import { getOrCreateVoiceName } from '../utils/randomNames';
import type { VoiceChatParticipant, ClientPresence } from '../types';

const MAX_PARTICIPANTS = 8;
const VOICE_ACTIVITY_THRESHOLD = 0.01;
const VOICE_ACTIVITY_CHECK_INTERVAL = 100;

interface PeerConnection {
  connection: RTCPeerConnection;
  remoteStream: MediaStream | null;
}

interface UseVoiceChatOptions {
  roomId: string;
  clientId: string;
  clients: Record<string, ClientPresence>;
}

interface UseVoiceChatReturn {
  isVoiceEnabled: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  voiceName: string;
  participants: VoiceChatParticipant[];
  participantCount: number;
  isRoomFull: boolean;
  error: string | null;
  enableVoice: () => Promise<boolean>;
  disableVoice: () => void;
  toggleMute: () => void;
  muteAll: () => void;
  unmuteAll: () => void;
}

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useVoiceChat({
  roomId,
  clientId,
  clients,
}: UseVoiceChatOptions): UseVoiceChatReturn {
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceName] = useState(() => getOrCreateVoiceName());

  // Refs for WebRTC
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const voiceActivityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio elements for remote streams
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Track processed signaling messages to avoid duplicates
  const processedOffersRef = useRef<Set<string>>(new Set());
  const processedAnswersRef = useRef<Set<string>>(new Set());

  // Calculate participants from clients - filter out entries without voiceName (stale/invalid)
  const participants: VoiceChatParticipant[] = Object.entries(clients)
    .filter(([, presence]) => presence.voiceName) // Only include clients with a valid name
    .map(([id, presence]) => ({
      clientId: id,
      name: presence.voiceName!,
      isVoiceEnabled: presence.isVoiceEnabled || false,
      isMuted: presence.isMuted || false,
      isSpeaking: false, // We'll update this based on audio analysis
      isReady: presence.isReady || false,
    }));

  const voiceEnabledCount = participants.filter((p) => p.isVoiceEnabled).length;
  const isRoomFull = voiceEnabledCount >= MAX_PARTICIPANTS;

  // Update presence with voice info
  const updateVoicePresence = useCallback(
    async (voiceData: Partial<ClientPresence>) => {
      if (!roomId || !clientId) return;
      const presenceRef = ref(db, `rooms/${roomId}/online/${clientId}`);
      await update(presenceRef, voiceData);
    },
    [roomId, clientId]
  );

  // Create peer connection for a remote peer
  const createPeerConnection = useCallback(
    async (remoteClientId: string, isInitiator: boolean) => {
      if (peerConnectionsRef.current.has(remoteClientId)) {
        return peerConnectionsRef.current.get(remoteClientId)!.connection;
      }


      const pc = new RTCPeerConnection(rtcConfig);
      peerConnectionsRef.current.set(remoteClientId, {
        connection: pc,
        remoteStream: null,
      });

      // Add local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle incoming tracks
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        const peerData = peerConnectionsRef.current.get(remoteClientId);
        if (peerData) {
          peerData.remoteStream = remoteStream;
        }

        // Create audio element for playback
        let audioElement = audioElementsRef.current.get(remoteClientId);
        if (!audioElement) {
          audioElement = document.createElement('audio');
          // iOS requirements
          (audioElement as any).playsInline = true;
          (audioElement as any).webkitPlaysInline = true;
          audioElement.autoplay = true;
          audioElement.volume = 1.0;
          // Append to DOM (required for some browsers)
          audioElement.style.display = 'none';
          document.body.appendChild(audioElement);
          audioElementsRef.current.set(remoteClientId, audioElement);
        }

        audioElement.srcObject = remoteStream;

        // Explicitly play (needed for some browsers)
        audioElement.play().catch((e) => {
          console.error('[VoiceChat] Failed to play audio:', e);
        });
      };

      // Handle ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          const candidatesRef = ref(
            db,
            `rooms/${roomId}/voiceSignaling/${clientId}_${remoteClientId}/iceCandidates`
          );
          await push(candidatesRef, event.candidate.toJSON());
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          closePeerConnection(remoteClientId);
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          console.error('[VoiceChat] ICE connection failed');
        }
      };

      // If initiator, create offer
      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const signalingRef = ref(
          db,
          `rooms/${roomId}/voiceSignaling/${clientId}_${remoteClientId}`
        );
        await set(signalingRef, {
          from: clientId,
          to: remoteClientId,
          offer: pc.localDescription?.toJSON(),
        });
      }

      return pc;
    },
    [roomId, clientId]
  );

  // Close peer connection
  const closePeerConnection = useCallback((remoteClientId: string) => {
    const peerData = peerConnectionsRef.current.get(remoteClientId);
    if (peerData) {
      peerData.connection.close();
      peerConnectionsRef.current.delete(remoteClientId);
    }

    const audioElement = audioElementsRef.current.get(remoteClientId);
    if (audioElement) {
      audioElement.pause();
      audioElement.srcObject = null;
      // Remove from DOM
      if (audioElement.parentNode) {
        audioElement.parentNode.removeChild(audioElement);
      }
      audioElementsRef.current.delete(remoteClientId);
    }
  }, []);

  // Start voice activity detection
  const startVoiceActivityDetection = useCallback(() => {
    if (!localStreamRef.current) return;

    try {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      const source = audioContextRef.current.createMediaStreamSource(
        localStreamRef.current
      );
      source.connect(analyserRef.current);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      voiceActivityIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalized = average / 255;

        setIsSpeaking(normalized > VOICE_ACTIVITY_THRESHOLD && !isMuted);
      }, VOICE_ACTIVITY_CHECK_INTERVAL);
    } catch (e) {
      console.warn('Voice activity detection not available:', e);
    }
  }, [isMuted]);

  // Stop voice activity detection
  const stopVoiceActivityDetection = useCallback(() => {
    if (voiceActivityIntervalRef.current) {
      clearInterval(voiceActivityIntervalRef.current);
      voiceActivityIntervalRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsSpeaking(false);
  }, []);

  // Enable voice chat
  const enableVoice = useCallback(async (): Promise<boolean> => {
    if (isRoomFull && !isVoiceEnabled) {
      setError('Room is full (8/8)');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Ensure audio track is enabled
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });

      localStreamRef.current = stream;
      setIsVoiceEnabled(true);
      setError(null);

      // Update Firebase presence
      await updateVoicePresence({
        voiceName,
        isVoiceEnabled: true,
        isMuted: false,
      });

      // Start voice activity detection
      startVoiceActivityDetection();

      return true;
    } catch (e) {
      console.error('[VoiceChat] Failed to enable voice:', e);
      const message =
        e instanceof Error ? e.message : 'Failed to access microphone';
      setError(message);
      return false;
    }
  }, [isRoomFull, isVoiceEnabled, voiceName, updateVoicePresence, startVoiceActivityDetection]);

  // Disable voice chat
  const disableVoice = useCallback(() => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((_, peerId) => {
      closePeerConnection(peerId);
    });

    // Clear processed signaling tracking
    processedOffersRef.current.clear();
    processedAnswersRef.current.clear();
    processedCandidatesRef.current.clear();

    // Stop voice activity detection
    stopVoiceActivityDetection();

    // Update state
    setIsVoiceEnabled(false);
    setIsMuted(false);
    setIsSpeaking(false);

    // Update Firebase presence
    updateVoicePresence({
      isVoiceEnabled: false,
      isMuted: false,
    });

    // Clean up signaling data
    if (roomId && clientId) {
      const signalingRef = ref(db, `rooms/${roomId}/voiceSignaling`);
      get(signalingRef).then((snapshot) => {
        const data = snapshot.val();
        if (data) {
          Object.keys(data).forEach((key) => {
            if (key.includes(clientId)) {
              remove(ref(db, `rooms/${roomId}/voiceSignaling/${key}`));
            }
          });
        }
      });
    }
  }, [roomId, clientId, closePeerConnection, stopVoiceActivityDetection, updateVoicePresence]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      const newMutedState = !isMuted;
      audioTrack.enabled = !newMutedState;
      setIsMuted(newMutedState);

      if (newMutedState) {
        setIsSpeaking(false);
      }

      updateVoicePresence({ isMuted: newMutedState });
    }
  }, [isMuted, updateVoicePresence]);

  // Mute all (for session start)
  const muteAll = useCallback(() => {
    if (!localStreamRef.current || !isVoiceEnabled) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = false;
      setIsMuted(true);
      setIsSpeaking(false);
      updateVoicePresence({ isMuted: true });
    }
  }, [isVoiceEnabled, updateVoicePresence]);

  // Unmute all (for session end)
  const unmuteAll = useCallback(() => {
    if (!localStreamRef.current || !isVoiceEnabled) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = true;
      setIsMuted(false);
      updateVoicePresence({ isMuted: false });
    }
  }, [isVoiceEnabled, updateVoicePresence]);

  // Listen for signaling messages
  useEffect(() => {
    if (!roomId || !clientId || !isVoiceEnabled) return;

    const signalingRef = ref(db, `rooms/${roomId}/voiceSignaling`);

    const unsubscribe = onValue(signalingRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      for (const [key, signaling] of Object.entries(data) as [string, any][]) {
        // Handle incoming offers (I'm the recipient)
        if (signaling.to === clientId && signaling.offer && !signaling.answer) {
          const remoteClientId = signaling.from;

          // Don't connect to ourselves
          if (remoteClientId === clientId) continue;

          // Skip if we've already processed this offer
          if (processedOffersRef.current.has(key)) continue;
          processedOffersRef.current.add(key);

          try {
            const pc = await createPeerConnection(remoteClientId, false);

            await pc.setRemoteDescription(new RTCSessionDescription(signaling.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // Send answer
            await update(ref(db, `rooms/${roomId}/voiceSignaling/${key}`), {
              answer: pc.localDescription?.toJSON(),
            });
          } catch (e) {
            console.error('[VoiceChat] Error handling offer:', e);
          }
        }

        // Handle incoming answers (I'm the initiator)
        if (signaling.from === clientId && signaling.answer) {
          const answerKey = `answer_${key}`;

          // Skip if we've already processed this answer
          if (processedAnswersRef.current.has(answerKey)) continue;

          const pc = peerConnectionsRef.current.get(signaling.to)?.connection;
          if (pc && pc.signalingState !== 'stable') {
            processedAnswersRef.current.add(answerKey);
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(signaling.answer));
            } catch (e) {
              console.error('[VoiceChat] Error handling answer:', e);
            }
          }
        }
      }
    });

    return () => unsubscribe();
  }, [roomId, clientId, isVoiceEnabled, createPeerConnection]);

  // Track processed ICE candidates to avoid duplicates
  const processedCandidatesRef = useRef<Set<string>>(new Set());

  // Listen for ICE candidates
  useEffect(() => {
    if (!roomId || !clientId || !isVoiceEnabled) return;

    const signalingRef = ref(db, `rooms/${roomId}/voiceSignaling`);

    const unsubscribe = onValue(signalingRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      for (const [key, signaling] of Object.entries(data) as [string, any][]) {
        // Key format: client_XXXX_client_YYYY (fromId_toId where each id is client_XXX)
        const parts = key.split('_');
        if (parts.length !== 4 || parts[0] !== 'client' || parts[2] !== 'client') {
          continue;
        }
        const fromId = `${parts[0]}_${parts[1]}`;
        const toId = `${parts[2]}_${parts[3]}`;

        // Only process if this signaling entry involves us
        if (fromId !== clientId && toId !== clientId) continue;

        // Skip our own entry - we need the OTHER peer's ICE candidates
        if (fromId === clientId) continue;

        // This entry is from the other peer (fromId is the remote peer)
        const remoteClientId = fromId;

        if (!signaling.iceCandidates) continue;
        if (!peerConnectionsRef.current.has(remoteClientId)) continue;

        const pc = peerConnectionsRef.current.get(remoteClientId)!.connection;

        for (const [candidateKey, candidate] of Object.entries(signaling.iceCandidates) as [string, RTCIceCandidateInit][]) {
          const candidateId = `${key}_${candidateKey}`;

          if (processedCandidatesRef.current.has(candidateId)) continue;

          try {
            if (pc.remoteDescription) {
              processedCandidatesRef.current.add(candidateId);
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
          } catch (e) {
            console.warn('[VoiceChat] Failed to add ICE candidate:', e);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [roomId, clientId, isVoiceEnabled]);

  // Connect to new peers when voice is enabled
  useEffect(() => {
    if (!isVoiceEnabled || !roomId || !clientId) return;

    // Find other voice-enabled clients
    const otherVoiceClients = Object.entries(clients).filter(
      ([id, presence]) => id !== clientId && presence.isVoiceEnabled
    );

    // Connect to peers we haven't connected to yet
    // Use clientId comparison to determine who initiates
    otherVoiceClients.forEach(([remoteId]) => {
      if (!peerConnectionsRef.current.has(remoteId)) {
        // The client with the "smaller" ID initiates
        const shouldInitiate = clientId < remoteId;
        if (shouldInitiate) {
          createPeerConnection(remoteId, true);
        }
      }
    });

    // Clean up connections to clients that left
    peerConnectionsRef.current.forEach((_, peerId) => {
      if (!clients[peerId] || !clients[peerId].isVoiceEnabled) {
        closePeerConnection(peerId);
      }
    });
  }, [isVoiceEnabled, roomId, clientId, clients, createPeerConnection, closePeerConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disableVoice();
    };
  }, []);

  // Set up onDisconnect cleanup
  useEffect(() => {
    if (!roomId || !clientId) return;

    const presenceRef = ref(db, `rooms/${roomId}/online/${clientId}`);
    onDisconnect(presenceRef).update({
      isVoiceEnabled: false,
      isMuted: false,
    });
  }, [roomId, clientId]);

  return {
    isVoiceEnabled,
    isMuted,
    isSpeaking,
    voiceName,
    participants,
    participantCount: voiceEnabledCount,
    isRoomFull,
    error,
    enableVoice,
    disableVoice,
    toggleMute,
    muteAll,
    unmuteAll,
  };
}
