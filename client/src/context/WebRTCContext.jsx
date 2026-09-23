import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useSocket } from './SocketContext';

const WebRTCContext = createContext();

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10
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

  // P2P Large File Transfer State
  const [p2pTransfer, setP2pTransfer] = useState(null); // { fileName, fileSize, progress, status, speedMBs, isSender }

  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const activePeerSocketId = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const wasVoiceCallRef = useRef(false);

  // P2P DataChannel Refs & Disk Streaming Engine
  const p2pPeerRef = useRef(null);
  const p2pPendingIceRef = useRef([]);
  const dataChannelRef = useRef(null);
  const receivedChunksRef = useRef([]);
  const receivedSizeRef = useRef(0);
  const pendingP2pOfferRef = useRef(null);
  const activeFileWriterRef = useRef(null);
  const isSendingRef = useRef(false);
  const p2pTargetSocketIdRef = useRef(null);
  const p2pStartTimeRef = useRef(0);

  // Setup WebRTC socket listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming call
    socket.on('webrtc_incoming_call', ({ callerSocketId, callerUser, isVideo }) => {
      if (callState !== 'idle') {
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
        let pc = peerConnectionRef.current;
        if (!pc || pc.signalingState === 'closed') {
          pc = createPeerConnection(callerSocketId);
        }
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

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

    /**
     * WEBRTC P2P DIRECT LARGE FILE TRANSFER SOCKET LISTENERS
     */
    socket.on('webrtc_p2p_file_offer', async ({ senderSocketId, offer, fileMetadata }) => {
      try {
        pendingP2pOfferRef.current = { senderSocketId, offer, fileMetadata };
        p2pTargetSocketIdRef.current = senderSocketId;

        setP2pTransfer({
          fileName: fileMetadata.fileName,
          fileSize: fileMetadata.fileSize,
          transferredBytes: 0,
          progress: 0,
          status: 'Incoming Direct P2P Transfer Request',
          speedMBs: '0.0',
          etaSeconds: 0,
          isSender: false,
          isPendingAccept: true,
          senderSocketId
        });
      } catch (err) {
        console.error('Failed receiving P2P file offer:', err);
        setP2pTransfer(null);
      }
    });

    socket.on('webrtc_p2p_file_answer', async ({ responderSocketId, answer }) => {
      try {
        if (p2pPeerRef.current) {
          await p2pPeerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          while (p2pPendingIceRef.current.length > 0) {
            const candidate = p2pPendingIceRef.current.shift();
            try { await p2pPeerRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e){}
          }
        }
      } catch (err) {
        console.error('Failed setting P2P file answer:', err);
      }
    });

    socket.on('webrtc_p2p_file_ice', async ({ senderSocketId, candidate }) => {
      try {
        if (p2pPeerRef.current && candidate) {
          if (p2pPeerRef.current.remoteDescription && p2pPeerRef.current.remoteDescription.type) {
            await p2pPeerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            p2pPendingIceRef.current.push(candidate);
          }
        }
      } catch (err) {
        console.error('Failed adding P2P file ICE candidate:', err);
      }
    });

    socket.on('webrtc_p2p_file_cancel', () => {
      isSendingRef.current = false;
      if (activeFileWriterRef.current) {
        try { activeFileWriterRef.current.abort(); } catch(e){}
        activeFileWriterRef.current = null;
      }
      if (p2pPeerRef.current) {
        try { p2pPeerRef.current.close(); } catch(e){}
        p2pPeerRef.current = null;
      }
      dataChannelRef.current = null;
      receivedChunksRef.current = [];
      receivedSizeRef.current = 0;
      pendingP2pOfferRef.current = null;
      p2pTargetSocketIdRef.current = null;
      setP2pTransfer(null);
    });

    return () => {
      socket.off('webrtc_incoming_call');
      socket.off('webrtc_call_accepted');
      socket.off('webrtc_call_rejected');
      socket.off('webrtc_offer');
      socket.off('webrtc_answer');
      socket.off('webrtc_ice_candidate');
      socket.off('webrtc_call_ended');
      socket.off('webrtc_p2p_file_offer');
      socket.off('webrtc_p2p_file_answer');
      socket.off('webrtc_p2p_file_ice');
      socket.off('webrtc_p2p_file_cancel');
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

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      }
    };

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
   * Accept an incoming P2P direct file transfer (Zero-RAM Disk Stream)
   */
  const acceptP2PTransfer = async () => {
    const pending = pendingP2pOfferRef.current;
    if (!pending || !socket) return;

    let fileWriter = null;

    if (window.showSaveFilePicker) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: pending.fileMetadata.fileName
        });
        fileWriter = await fileHandle.createWritable();
      } catch (err) {
        if (err.name === 'AbortError') {
          // User closed/cancelled file picker
          cancelP2PTransfer();
          return;
        }
        console.warn('showSaveFilePicker unavailable or rejected:', err);
      }
    }

    if (!fileWriter && navigator.storage && navigator.storage.getDirectory) {
      try {
        const root = await navigator.storage.getDirectory();
        const handle = await root.getFileHandle(`p2p_file_${Date.now()}_${pending.fileMetadata.fileName}`, { create: true });
        if (handle.createWritable) {
          fileWriter = await handle.createWritable();
        }
      } catch (opfsErr) {
        console.warn('OPFS createWritable fallback failed:', opfsErr);
      }
    }

    activeFileWriterRef.current = fileWriter;

    setP2pTransfer({
      fileName: pending.fileMetadata.fileName,
      fileSize: pending.fileMetadata.fileSize,
      transferredBytes: 0,
      progress: 0,
      status: 'Establishing P2P Stream...',
      speedMBs: '0.0',
      etaSeconds: 0,
      isSender: false,
      isPendingAccept: false
    });

    if (p2pPeerRef.current) {
      try { p2pPeerRef.current.close(); } catch(e){}
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    p2pPeerRef.current = pc;
    p2pPendingIceRef.current = [];
    receivedChunksRef.current = [];
    receivedSizeRef.current = 0;
    p2pStartTimeRef.current = Date.now();

    let lastTime = Date.now();
    let lastBytes = 0;

    pc.ondatachannel = (event) => {
      const dc = event.channel;
      dc.binaryType = 'arraybuffer';
      dataChannelRef.current = dc;

      dc.onmessage = async (msgEvent) => {
        const chunkSize = msgEvent.data.byteLength;
        receivedSizeRef.current += chunkSize;

        if (activeFileWriterRef.current) {
          try {
            await activeFileWriterRef.current.write(msgEvent.data);
          } catch (writeErr) {
            console.error('Disk stream write error:', writeErr);
          }
        } else {
          receivedChunksRef.current.push(msgEvent.data);
        }

        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;

        if (timeDiff >= 0.25 || receivedSizeRef.current >= pending.fileMetadata.fileSize) {
          const bytesSinceLast = receivedSizeRef.current - lastBytes;
          const speedBytes = bytesSinceLast / (timeDiff || 0.001);
          const speedMBs = speedBytes / (1024 * 1024);
          const remainingBytes = pending.fileMetadata.fileSize - receivedSizeRef.current;
          const etaSeconds = speedBytes > 0 ? Math.ceil(remainingBytes / speedBytes) : 0;

          lastTime = now;
          lastBytes = receivedSizeRef.current;

          const progress = Math.min(100, Math.round((receivedSizeRef.current / pending.fileMetadata.fileSize) * 100));

          setP2pTransfer((prev) => prev ? {
            ...prev,
            progress,
            transferredBytes: receivedSizeRef.current,
            speedMBs: speedMBs.toFixed(1),
            etaSeconds,
            status: progress === 100 ? 'Transfer Complete! 🎉' : `Receiving... ${progress}%`
          } : null);
        }

        if (receivedSizeRef.current >= pending.fileMetadata.fileSize) {
          if (activeFileWriterRef.current) {
            try {
              await activeFileWriterRef.current.close();
              activeFileWriterRef.current = null;
            } catch(e){}
          } else {
            try {
              const blob = new Blob(receivedChunksRef.current);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = pending.fileMetadata.fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              receivedChunksRef.current = [];
            } catch (blobErr) {
              console.error('Fallback Blob download error:', blobErr);
            }
          }

          setTimeout(() => setP2pTransfer(null), 5000);
        }
      };
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit('webrtc_p2p_file_ice', { targetSocketId: pending.senderSocketId, candidate: e.candidate });
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(pending.offer));

    while (p2pPendingIceRef.current.length > 0) {
      const candidate = p2pPendingIceRef.current.shift();
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e){}
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('webrtc_p2p_file_answer', { targetSocketId: pending.senderSocketId, answer });
  };

  /**
   * Cancel an ongoing P2P direct file transfer
   */
  const cancelP2PTransfer = () => {
    isSendingRef.current = false;

    if (socket && p2pTargetSocketIdRef.current) {
      socket.emit('webrtc_p2p_file_cancel', { targetSocketId: p2pTargetSocketIdRef.current });
    }

    if (activeFileWriterRef.current) {
      try { activeFileWriterRef.current.abort(); } catch(e){}
      activeFileWriterRef.current = null;
    }

    if (p2pPeerRef.current) {
      try { p2pPeerRef.current.close(); } catch(e){}
      p2pPeerRef.current = null;
    }

    dataChannelRef.current = null;
    receivedChunksRef.current = [];
    receivedSizeRef.current = 0;
    pendingP2pOfferRef.current = null;
    p2pTargetSocketIdRef.current = null;
    setP2pTransfer(null);
  };

  /**
   * Send a file P2P via WebRTC DataChannel (Unlimited 3GB - 100GB+ file transfer with 0 server storage load)
   */
  const sendP2PFile = async (targetSocketId, file) => {
    if (!socket || !targetSocketId || !file) return;

    try {
      p2pTargetSocketIdRef.current = targetSocketId;
      isSendingRef.current = true;

      setP2pTransfer({
        fileName: file.name,
        fileSize: file.size,
        transferredBytes: 0,
        progress: 0,
        status: 'Connecting P2P DataChannel...',
        speedMBs: '0.0',
        etaSeconds: 0,
        isSender: true,
        isPendingAccept: false,
        targetSocketId
      });

      if (p2pPeerRef.current) {
        try { p2pPeerRef.current.close(); } catch(e){}
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      p2pPeerRef.current = pc;
      p2pPendingIceRef.current = [];

      const dc = pc.createDataChannel('fileTransfer');
      dc.binaryType = 'arraybuffer';
      dc.bufferedAmountLowThreshold = 1024 * 1024; // 1 MB backpressure limit
      dataChannelRef.current = dc;

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('webrtc_p2p_file_ice', { targetSocketId, candidate: e.candidate });
        }
      };

      dc.onopen = async () => {
        const chunkSize = 65536; // 64 KB WebRTC chunk size
        let offset = 0;
        p2pStartTimeRef.current = Date.now();
        let lastTime = Date.now();
        let lastBytes = 0;

        const sendLoop = async () => {
          while (offset < file.size && dc.readyState === 'open' && isSendingRef.current) {
            // Dynamic WebRTC backpressure: pause if buffer exceeds 1 MB
            if (dc.bufferedAmount > dc.bufferedAmountLowThreshold) {
              await new Promise((resolve) => {
                dc.onbufferedamountlow = () => {
                  dc.onbufferedamountlow = null;
                  resolve();
                };
              });
            }

            if (!isSendingRef.current || dc.readyState !== 'open') break;

            const end = Math.min(offset + chunkSize, file.size);
            const slice = file.slice(offset, end);
            const buffer = await slice.arrayBuffer();

            dc.send(buffer);
            offset += buffer.byteLength;

            const now = Date.now();
            const timeDiff = (now - lastTime) / 1000;

            if (timeDiff >= 0.25 || offset >= file.size) {
              const bytesSinceLast = offset - lastBytes;
              const speedBytes = bytesSinceLast / (timeDiff || 0.001);
              const speedMBs = speedBytes / (1024 * 1024);
              const remainingBytes = file.size - offset;
              const etaSeconds = speedBytes > 0 ? Math.ceil(remainingBytes / speedBytes) : 0;

              lastTime = now;
              lastBytes = offset;

              const progress = Math.min(100, Math.round((offset / file.size) * 100));

              setP2pTransfer((prev) => prev ? {
                ...prev,
                progress,
                transferredBytes: offset,
                speedMBs: speedMBs.toFixed(1),
                etaSeconds,
                status: progress === 100 ? 'File Sent Successfully! 🎉' : `Sending... ${progress}%`
              } : null);
            }

            if (offset >= file.size) {
              setTimeout(() => setP2pTransfer(null), 5000);
            }
          }
        };

        sendLoop();
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('webrtc_p2p_file_offer', {
        targetSocketId,
        offer,
        fileMetadata: { fileName: file.name, fileSize: file.size }
      });
    } catch (err) {
      console.error('Error sending P2P file:', err);
      alert('Failed to initiate P2P file transfer.');
      setP2pTransfer(null);
    }
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

        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        } else {
          peerConnectionRef.current.addTrack(screenTrack, screenStream);

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
        p2pTransfer,
        localVideoRef,
        remoteVideoRef,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMic,
        toggleCamera,
        switchCamera,
        toggleScreenShare,
        sendP2PFile,
        acceptP2PTransfer,
        cancelP2PTransfer
      }}
    >
      {children}
    </WebRTCContext.Provider>
  );
}

export const useWebRTC = () => useContext(WebRTCContext);
