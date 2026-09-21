import React, { useEffect } from 'react';
import { 
  Phone, 
  PhoneOff, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor, 
  MonitorOff,
  RefreshCw
} from 'lucide-react';
import { useWebRTC } from '../context/WebRTCContext';
import { getAvatarSvg } from '../utils/avatar';

export default function VideoCallModal() {
  const {
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
    acceptCall,
    rejectCall,
    endCall,
    toggleMic,
    toggleCamera,
    switchCamera,
    toggleScreenShare
  } = useWebRTC();

  // Bind remote stream to remote video element whenever stream or state changes
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(err => console.warn('Remote video playback auto-play prevented:', err));
    }
  }, [remoteStream, callState]);

  // Bind local stream to local PIP video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(err => console.warn('Local video playback error:', err));
    }
  }, [localStream, isScreenSharing, callState]);

  if (callState === 'idle') return null;

  // Incoming Call Dialog
  if (callState === 'incoming') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in font-mono select-none">
        <div className="w-full max-w-sm bg-[#080d17] rounded-2xl border border-[#00ff88]/50 shadow-2xl p-6 text-center">
          <div className="w-16 h-16 rounded-xl border border-[#00ff88]/40 overflow-hidden mx-auto mb-3 animate-pulse shadow-lg">
            <img
              src={getAvatarSvg(callerInfo?.user?.avatar || callerInfo?.user?.name || 'caller')}
              alt="Caller"
              className="w-full h-full object-cover"
            />
          </div>

          <h3 className="text-base font-bold text-zinc-100 mb-0.5">
            {callerInfo?.user?.name || 'Someone'}
          </h3>
          <p className="text-xs text-[#00ff88] font-semibold mb-6 flex items-center justify-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-ping" />
            <span>Incoming {isVideoCall ? 'Video' : 'Voice'} Call...</span>
          </p>

          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={rejectCall}
              className="px-5 py-2.5 bg-[#ff3366] hover:bg-[#ff1a53] text-black font-bold text-xs rounded-xl transition flex items-center space-x-1.5 shadow-lg"
              title="Decline"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Decline</span>
            </button>

            <button
              onClick={acceptCall}
              className="px-5 py-2.5 bg-[#00ff88] hover:bg-[#00e67a] text-black font-bold text-xs rounded-xl transition flex items-center space-x-1.5 shadow-lg animate-pulse"
              title="Accept"
            >
              <Phone className="w-4 h-4" />
              <span>Accept</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Outgoing Call Dialog
  if (callState === 'calling') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in font-mono select-none">
        <div className="w-full max-w-sm bg-[#080d17] rounded-2xl border border-[#161f30] p-6 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-xl border border-[#161f30] overflow-hidden mx-auto mb-3">
            <img
              src={getAvatarSvg(remoteUser?.avatar || remoteUser?.name || 'user')}
              alt="User"
              className="w-full h-full object-cover"
            />
          </div>

          <h3 className="text-base font-bold text-zinc-100 mb-0.5">
            {remoteUser?.name || 'User'}
          </h3>
          <p className="text-xs text-zinc-400 font-semibold mb-6 animate-pulse">
            Calling...
          </p>

          <button
            onClick={endCall}
            className="px-5 py-2.5 bg-[#ff3366] hover:bg-[#ff1a53] text-black font-bold text-xs rounded-xl transition mx-auto flex items-center space-x-1.5 shadow-lg"
            title="Cancel"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Cancel Call</span>
          </button>
        </div>
      </div>
    );
  }

  // Active Call Screen
  const hasRemoteVideoTrack = isVideoCall || isScreenSharing;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black font-mono select-none">
      {/* Remote Video Container */}
      <div className="flex-1 relative bg-[#020305] flex items-center justify-center overflow-hidden">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          className={`w-full h-full object-contain ${!hasRemoteVideoTrack ? 'invisible absolute' : 'block'}`}
        />

        {/* Status indicator pill top-left */}
        <div className="absolute top-4 left-4 z-30 flex items-center space-x-2 bg-[#080d17]/80 backdrop-blur border border-[#1a263d] px-3 py-1.5 rounded-full text-xs font-semibold text-zinc-200 shadow-xl">
          <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
          <span>
            {isScreenSharing ? 'Screen Casting' : isVideoCall ? 'Video Call' : 'Voice Call'}
          </span>
        </div>

        {/* Voice Call / Video Off Fallback Overlay */}
        {!hasRemoteVideoTrack && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#05080f]">
            <div className="w-24 h-24 rounded-2xl border border-[#00ff88]/40 overflow-hidden mb-3 shadow-2xl relative">
              <img
                src={getAvatarSvg(remoteUser?.avatar || remoteUser?.name || 'remote')}
                alt="Remote"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-[#00ff88]/10 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-zinc-100">
              {remoteUser?.name || 'Connected User'}
            </h3>
            <p className="text-xs text-[#00ff88] mt-1 font-semibold flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-ping" />
              <span>Voice Call Connected</span>
            </p>
          </div>
        )}

        {/* Local PIP Video */}
        {isVideoCall && (
          <div className="absolute bottom-20 right-4 w-32 sm:w-44 aspect-video bg-[#05080f] rounded-xl overflow-hidden border border-[#00ff88]/40 shadow-2xl z-20">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              webkit-playsinline="true"
              x5-playsinline="true"
              muted
              className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : ''}`}
            />
            {isCameraOff && (
              <div className="w-full h-full flex items-center justify-center bg-[#080d17] text-zinc-400 text-xs font-semibold">
                Camera Off
              </div>
            )}
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="h-16 bg-[#080d17] border-t border-[#161f30] flex items-center justify-center space-x-2 sm:space-x-3 px-3 z-30 shrink-0">
        {/* Mute Mic Button */}
        <button
          onClick={toggleMic}
          className={`p-3 rounded-full border transition ${
            isMuted ? 'bg-[#ff3366] text-black border-[#ff3366]' : 'bg-[#05080f] text-zinc-300 border-[#1a263d] hover:border-[#00ff88]'
          }`}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Camera Toggle Button */}
        {isVideoCall && (
          <button
            onClick={toggleCamera}
            className={`p-3 rounded-full border transition ${
              isCameraOff ? 'bg-[#ff3366] text-black border-[#ff3366]' : 'bg-[#05080f] text-zinc-300 border-[#1a263d] hover:border-[#00ff88]'
            }`}
            title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isCameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>
        )}

        {/* Camera Flip / Switch Button (Mobile) */}
        {isVideoCall && !isCameraOff && (
          <button
            onClick={switchCamera}
            className="p-3 rounded-full border bg-[#05080f] text-zinc-300 border-[#1a263d] hover:border-[#00ff88] transition"
            title={`Switch Camera (Currently: ${facingMode})`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {/* Screen Share / Mobile Screen Cast Button */}
        <button
          onClick={toggleScreenShare}
          className={`p-3 rounded-full border transition ${
            isScreenSharing ? 'bg-[#00f0ff] text-black border-[#00f0ff]' : 'bg-[#05080f] text-zinc-300 border-[#1a263d] hover:border-[#00f0ff]'
          }`}
          title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen / Cast'}
        >
          {isScreenSharing ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
        </button>

        {/* End Call Button */}
        <button
          onClick={endCall}
          className="p-3 bg-[#ff3366] hover:bg-[#ff1a53] text-black rounded-full font-bold transition flex items-center space-x-1"
          title="End Call"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
