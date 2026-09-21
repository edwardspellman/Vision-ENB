import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Film, 
  X, 
  Volume2, 
  VolumeX, 
  Maximize, 
  RotateCcw,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function WatchPartyModal({ isOpen, onClose, currentRoom, currentGuild }) {
  const { socket } = useSocket();
  const [videoSource, setVideoSource] = useState('');
  const [activeSource, setActiveSource] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const videoRef = useRef(null);
  const targetId = currentRoom?.id || currentGuild?.id;

  // Listen for synchronized watch party socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('watchparty_sync', ({ action, currentTime, sourceUrl, senderSocketId }) => {
      if (senderSocketId === socket.id) return; // Ignore self

      if (action === 'change_source' && sourceUrl) {
        setActiveSource(sourceUrl);
        setVideoSource(sourceUrl);
      } else if (videoRef.current) {
        if (action === 'play') {
          videoRef.current.currentTime = currentTime || videoRef.current.currentTime;
          videoRef.current.play().catch(e => console.warn('Sync play error:', e));
          setIsPlaying(true);
        } else if (action === 'pause') {
          videoRef.current.pause();
          setIsPlaying(false);
        } else if (action === 'seek') {
          videoRef.current.currentTime = currentTime;
        }
      }
    });

    return () => {
      socket.off('watchparty_sync');
    };
  }, [socket]);

  if (!isOpen) return null;

  // Emit synchronized action
  const emitAction = (action, currentTime, sourceUrl) => {
    if (socket && targetId) {
      socket.emit('watchparty_action', {
        roomId: currentRoom?.id,
        guildId: currentGuild?.id,
        action,
        currentTime: currentTime !== undefined ? currentTime : (videoRef.current ? videoRef.current.currentTime : 0),
        sourceUrl
      });
    }
  };

  // Change video source
  const handleLoadSource = (e) => {
    e.preventDefault();
    if (!videoSource.trim()) return;
    setActiveSource(videoSource.trim());
    emitAction('change_source', 0, videoSource.trim());
  };

  // Play / Pause toggle
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      emitAction('pause');
    } else {
      videoRef.current.play().catch(e => console.warn(e));
      setIsPlaying(true);
      emitAction('play');
    }
  };

  // Seek
  const handleSeek = (e) => {
    if (!videoRef.current) return;
    const time = parseFloat(e.target.value);
    videoRef.current.currentTime = time;
    emitAction('seek', time);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-fade-in font-mono select-none">
      <div className="w-full max-w-4xl bg-[#080d17] border border-[#00ff88]/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-[#161f30] flex items-center justify-between bg-[#04060a]">
          <div className="flex items-center space-x-2">
            <Film className="w-5 h-5 text-[#00ff88]" />
            <h2 className="text-sm font-bold text-white tracking-wider flex items-center space-x-1.5">
              <span>Synchronized Watch Party</span>
              <span className="px-2 py-0.5 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 text-[10px] font-bold rounded-full animate-pulse">
                Live Sync Active
              </span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Player */}
        <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden min-h-[260px] sm:min-h-[400px]">
          {activeSource ? (
            <video
              ref={videoRef}
              src={activeSource}
              playsInline
              webkit-playsinline="true"
              x5-playsinline="true"
              className="w-full h-full object-contain max-h-[60vh]"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          ) : (
            <div className="text-center p-6 text-zinc-400">
              <Film className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-xs font-semibold">No video loaded yet.</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Enter a video URL or server media link below to stream together in sync!
              </p>
            </div>
          )}
        </div>

        {/* Video Source Input & Controls */}
        <div className="p-3 sm:p-4 border-t border-[#161f30] bg-[#05080f] space-y-3">
          <form onSubmit={handleLoadSource} className="flex items-center space-x-2">
            <div className="relative flex-1">
              <LinkIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Paste video URL (e.g. MP4, HLS, or server /uploads/ link)..."
                value={videoSource}
                onChange={(e) => setVideoSource(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-[#0b101c] border border-[#1a263d] rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88] transition"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#00ff88] hover:bg-[#00e67a] text-black font-bold text-xs rounded-xl transition shrink-0"
            >
              Load Video
            </button>
          </form>

          {/* Sync Playback Controls */}
          {activeSource && (
            <div className="flex items-center justify-between space-x-3 text-xs pt-1">
              <button
                onClick={togglePlay}
                className="p-2.5 bg-[#00ff88] text-black hover:bg-[#00e67a] rounded-xl font-bold transition flex items-center space-x-1"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              {/* Progress Slider */}
              <input
                type="range"
                min={0}
                max={videoRef.current?.duration || 100}
                value={videoRef.current?.currentTime || 0}
                onChange={handleSeek}
                className="flex-1 accent-[#00ff88] h-1.5 bg-[#161f30] rounded-lg cursor-pointer"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
