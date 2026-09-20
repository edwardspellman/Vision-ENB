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

  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const activePeerSocketId = useRef(null);

  // Setup WebRTC socket listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming call
    socket.on('webrtc_incoming_call', ({ callerSocketId, callerUser, isVideo }) => {
      if (callState !== 'idle') {
        // Automatically busy reject if already in a call
        socket.emit('webrtc_reject_call', { callerSocketId });
        return;
      }
      activePeerSocketId.current = callerSocketId;
      setCallerInfo({ socketId: callerSocketId, user: callerUser });
      setIsVideoCall(isVideo);
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

    // SDP Offer Received
    socket.on('webrtc_offer', async ({ callerSocketId, sdp }) => {
      try {
        const pc = createPeerConnection(callerSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
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
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      } catch (err) {
        console.error('Failed handling answer:', err);
      }
    });

    // ICE Candidate Received
    socket.on('webrtc_ice_candidate', async ({ senderSocketId, candidate }) => {
      try {
        if (peerConnectionRef.current && candidate) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
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
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote track
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
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
      setCallState('calling');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideo,
        audio: true
      });
      localStreamRef.current = stream;

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

      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoCall,
        audio: true
      });
      localStreamRef.current = stream;

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
    setCallerInfo(null);
    setRemoteUser(null);
    setCallState('idle');
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
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
   * Toggle Screen Sharing / Casting
   */
  const toggleScreenShare = async () => {
    if (!peerConnectionRef.current) return;

    if (!isScreenSharing) {
      try {
        let screenStream = null;

        // 1. Attempt displayMedia screen capture
        if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
          try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                displaySurface: 'monitor',
                logicalSurface: true,
                cursor: 'always'
              },
              audio: false
            });
          } catch (displayErr) {
            console.warn('getDisplayMedia failed or permission denied, trying fallback:', displayErr);
          }
        }

        // 2. Android WebView Fallback: if getDisplayMedia is unsupported or denied, fallback to camera video capture
        if (!screenStream) {
          try {
            screenStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'environment' }
            });
          } catch (cameraErr) {
            throw new Error('Screen cast / camera capture is not supported or permission denied on this device.');
          }
        }

        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) {
          throw new Error('No video track found for screen share.');
        }

        // 3. Attach track to Peer Connection
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        } else {
          // VOICE CALL FIX: Dynamically add video track to peer connection during voice call!
          peerConnectionRef.current.addTrack(screenTrack, screenStream);

          // Renegotiate WebRTC offer so recipient receives screen stream
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
        console.error('Screen sharing error:', err);
        alert(err.message || 'Screen sharing is unavailable on this device.');
      }
    } else {
      stopScreenSharing();
    }
  };

  const stopScreenSharing = async () => {
    if (!peerConnectionRef.current) return;

    const cameraTrack = localStreamRef.current ? localStreamRef.current.getVideoTracks()[0] : null;
    const senders = peerConnectionRef.current.getSenders();
    const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

    if (videoSender && cameraTrack) {
      await videoSender.replaceTrack(cameraTrack);
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current || null;
    }

    setIsScreenSharing(false);
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
        localVideoRef,
        remoteVideoRef,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMic,
        toggleCamera,
        toggleScreenShare
      }}
    >
      {children}
    </WebRTCContext.Provider>
  );
}

export const useWebRTC = () => useContext(WebRTCContext);
