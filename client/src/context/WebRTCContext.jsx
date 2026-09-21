import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useSocket } from './SocketContext';

const WebRTCContext = createContext();

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export function WebRTCProvider({ children }) {
  const { socket } = useSocket();
  const [callState, setCallState] = useState('idle'); // 'idle' | 'calling' | 'incoming' | 'connected'
  const [isVideoCall, setIsVideoCall] = useState(true);
  const [callerInfo, setCallerInfo] = useState(null);
  const [remoteUser, setRemoteUser] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);

  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const activePeerSocketId = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const wasVoiceCallRef = useRef(false);

  // Setup WebRTC socket listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming call
    socket.on('webrtc_incoming_call', ({ callerSocketId, callerUser, isVideo }) => {
      if (callState !== 'idle') {
        // Automatically reject with busy state if already in a call
        socket.emit('webrtc_reject_call', { callerSocketId });
        return;
      }
      activePeerSocketId.current = callerSocketId;
      setCallerInfo({ socketId: callerSocketId, user: callerUser });
      setIsVideoCall(isVideo);
      wasVoiceCallRef.current = !isVideo;
      setCallState('incoming');
    });

    // Call Accepted by peer
    socket.on('webrtc_call_accepted', async ({ responderSocketId, responderUser, isVideo }) => {
      setRemoteUser(responderUser);
      setCallState('connected');
      
      // Create and send SDP Offer
      try {
        const pc = createPeerConnection(responderSocketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc_offer', { targetSocketId: responderSocketId, sdp: offer });
      } catch (err) {
        console.error('Failed creating offer:', err);
      }
    });

    // Call Rejected
    socket.on('webrtc_call_rejected', ({ responderUser }) => {
      alert(`${responderUser?.name || 'User'} declined the call.`);
      cleanupCall();
    });

    // SDP Offer Received (Supports initial offer + renegotiation for mobile screen casting)
    socket.on('webrtc_offer', async ({ callerSocketId, sdp }) => {
      try {
        let pc = peerConnectionRef.current;
        if (!pc || pc.signalingState === 'closed') {
          pc = createPeerConnection(callerSocketId);
        }
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        // Flush any queued ICE candidates
        while (pendingIceCandidatesRef.current.length > 0) {
          const cand = pendingIceCandidatesRef.current.shift();
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(e => console.warn('ICE add error:', e));
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_answer', { targetSocketId: callerSocketId, sdp: answer });
      } catch (err) {
        console.error('Failed handling offer:', err);
      }
    });

    // SDP Answer Received
    socket.on('webrtc_answer', async ({ responderSocketId, sdp }) => {
      try {
        const pc = peerConnectionRef.current;
        if (pc && pc.signalingState !== 'closed') {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));

          // Flush queued ICE candidates
          while (pendingIceCandidatesRef.current.length > 0) {
            const cand = pendingIceCandidatesRef.current.shift();
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(e => console.warn('ICE add error:', e));
          }
        }
      } catch (err) {
        console.error('Failed handling answer:', err);
      }
    });

    // ICE Candidate Received
    socket.on('webrtc_ice_candidate', async ({ senderSocketId, candidate }) => {
      try {
        const pc = peerConnectionRef.current;
        if (candidate) {
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            pendingIceCandidatesRef.current.push(candidate);
          }
        }
      } catch (err) {
        console.error('Failed adding ICE candidate:', err);
      }
    });

    // Call Ended by Remote
    socket.on('webrtc_call_ended', () => {
      cleanupCall();
    });

    return () => {
      socket.off('webrtc_incoming_call');
      socket.off('webrtc_call_accepted');
      socket.off('webrtc_call_rejected');
      socket.off('webrtc_offer');
      socket.off('webrtc_answer');
      socket.off('webrtc_ice_candidate');
      socket.off('webrtc_call_ended');
    };
  }, [socket, callState]);

  /**
   * Helper to create RTCPeerConnection and bind media streams
   */
  const createPeerConnection = (targetSocketId) => {
    if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'closed') {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;
    pendingIceCandidatesRef.current = [];

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle incoming remote track
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc_ice_candidate', {
          targetSocketId,
          candidate: event.candidate
        });
      }
    };

    return pc;
  };

  /**
   * Start an outgoing call
   */
  const startCall = async (targetSocketId, targetUser, isVideo = true) => {
    try {
      activePeerSocketId.current = targetSocketId;
      setRemoteUser(targetUser);
      setIsVideoCall(isVideo);
      wasVoiceCallRef.current = !isVideo;
      setFacingMode('user');
      setCallState('calling');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideo ? { facingMode: 'user' } : false,
        audio: true
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      socket.emit('webrtc_call_user', {
        targetSocketId,
        roomId: 'call',
        isVideo
      });
    } catch (err) {
      console.error('Media devices access failed:', err);
      alert('Could not access camera or microphone. Please check permissions.');
      cleanupCall();
    }
  };

  /**
   * Accept an incoming call
   */
  const acceptCall = async () => {
    try {
      setCallState('connected');
      setRemoteUser(callerInfo.user);
      setFacingMode('user');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoCall ? { facingMode: 'user' } : false,
        audio: true
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      socket.emit('webrtc_accept_call', {
        callerSocketId: callerInfo.socketId,
        isVideo: isVideoCall
      });
    } catch (err) {
      console.error('Accept call failed:', err);
      alert('Could not access camera/mic to accept the call.');
      cleanupCall();
    }
  };

  /**
   * Reject an incoming call
   */
  const rejectCall = () => {
    if (callerInfo && socket) {
      socket.emit('webrtc_reject_call', {
        callerSocketId: callerInfo.socketId
      });
    }
    cleanupCall();
  };

  /**
   * End the current call
   */
  const endCall = () => {
    if (activePeerSocketId.current && socket) {
      socket.emit('webrtc_end_call', {
        targetSocketId: activePeerSocketId.current
      });
    }
    cleanupCall();
  };

  /**
   * Full cleanup of media streams and state
   */
  const cleanupCall = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    activePeerSocketId.current = null;
    pendingIceCandidatesRef.current = [];
    wasVoiceCallRef.current = false;
    setCallerInfo(null);
    setRemoteUser(null);
    setCallState('idle');
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
    setFacingMode('user');
    setRemoteStream(null);
    setLocalStream(null);
  };

  /**
   * Toggle Microphone Mute
   */
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  /**
   * Toggle Camera On/Off
   */
  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  };

  /**
   * Mobile Camera Switch (Front <-> Rear Camera)
   */
  const switchCamera = async () => {
    if (!localStreamRef.current || !peerConnectionRef.current) return;
    const newMode = facingMode === 'user' ? 'environment' : 'user';

    try {
      let newCamStream = null;
      try {
        newCamStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: newMode } },
          audio: false
        });
      } catch (exactErr) {
        newCamStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newMode },
          audio: false
        });
      }

      const newTrack = newCamStream.getVideoTracks()[0];
      if (newTrack) {
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');

        if (videoSender) {
          await videoSender.replaceTrack(newTrack);
        }

        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldTrack) oldTrack.stop();

        localStreamRef.current.removeTrack(oldTrack);
        localStreamRef.current.addTrack(newTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        setFacingMode(newMode);
      }
    } catch (err) {
      console.error('Failed switching camera on mobile:', err);
    }
  };

  /**
   * Toggle Screen Sharing / Mobile Screen Cast
   */
  const toggleScreenShare = async () => {
    if (!peerConnectionRef.current) return;

    if (!isScreenSharing) {
      try {
        let screenStream = null;

        // 1. Mobile & Desktop displayMedia screen capture (No desktop-only constraints)
        if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
          try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: false
            });
          } catch (displayErr) {
            console.warn('getDisplayMedia primary failed, trying secondary fallback:', displayErr);
            try {
              screenStream = await navigator.mediaDevices.getDisplayMedia({ video: {} });
            } catch (err2) {
              console.warn('getDisplayMedia secondary failed:', err2);
            }
          }
        }

        // 2. Mobile WebView / Camera Cast Fallback: If getDisplayMedia is unsupported or denied by OS, fallback to rear camera environment cast
        if (!screenStream) {
          try {
            screenStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: 'environment' } },
              audio: false
            });
          } catch (cameraErr) {
            screenStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            });
          }
        }

        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) {
          throw new Error('No video track found for screen share.');
        }

        // Attach track to Peer Connection
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        } else {
          // Voice Call Fix: Add video track dynamically to peer connection
          peerConnectionRef.current.addTrack(screenTrack, screenStream);

          // Trigger SDP offer renegotiation so recipient receives screen stream
          if (socket && activePeerSocketId.current) {
            const offer = await peerConnectionRef.current.createOffer();
            await peerConnectionRef.current.setLocalDescription(offer);
            socket.emit('webrtc_offer', {
              targetSocketId: activePeerSocketId.current,
              sdp: offer
            });
          }
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = () => {
          stopScreenSharing();
        };

        setIsVideoCall(true);
        setIsScreenSharing(true);
      } catch (err) {
        console.error('Screen sharing / mobile cast error:', err);
        alert(err.message || 'Screen sharing is unavailable on this device.');
      }
    } else {
      stopScreenSharing();
    }
  };

  /**
   * Stop Screen Sharing / Mobile Cast and revert state
   */
  const stopScreenSharing = async () => {
    if (!peerConnectionRef.current) return;

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    const cameraTrack = localStreamRef.current ? localStreamRef.current.getVideoTracks()[0] : null;
    const senders = peerConnectionRef.current.getSenders();
    const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

    if (videoSender) {
      if (cameraTrack) {
        await videoSender.replaceTrack(cameraTrack);
      } else {
        await videoSender.replaceTrack(null);
      }
    }

    if (wasVoiceCallRef.current) {
      setIsVideoCall(false);
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current || null;
    }

    setIsScreenSharing(false);

    // Send updated SDP offer to peer so screen cast stops on remote side
    if (socket && activePeerSocketId.current) {
      try {
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        socket.emit('webrtc_offer', {
          targetSocketId: activePeerSocketId.current,
          sdp: offer
        });
      } catch (err) {
        console.warn('Renegotiation after stop screen share failed:', err);
      }
    }
  };

  return (
    <WebRTCContext.Provider
      value={{
        callState,
        isVideoCall,
        callerInfo,
        remoteUser,
        isMuted,
        isCameraOff,
        isScreenSharing,
        facingMode,
        remoteStream,
        localStream,
        localVideoRef,
        remoteVideoRef,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMic,
        toggleCamera,
        switchCamera,
        toggleScreenShare
      }}
    >
      {children}
    </WebRTCContext.Provider>
  );
}

export const useWebRTC = () => useContext(WebRTCContext);
