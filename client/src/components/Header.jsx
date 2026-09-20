import React from 'react';
import { 
  Lock, 
  Share2, 
  Plus, 
  Volume2, 
  VolumeX, 
  Wifi, 
  Users,
  Menu,
  LogOut,
  Settings
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { getAvatarSvg } from '../utils/avatar';
import { sound } from '../utils/sound';

export default function Header({ 
  onOpenRoomModal, 
  onOpenShareModal, 
  onOpenSettingsModal,
  onOpenRoomSettingsModal,
  onToggleSidebar,
  soundMuted,
  setSoundMuted
}) {
  const { currentRoom, roomUsers, user, leaveRoom, isHost } = useSocket();
  const [isMobileDevice, setIsMobileDevice] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      const isMobileUA = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isSmallScreen = window.innerWidth < 768;
      setIsMobileDevice(isMobileUA || isSmallScreen);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleToggleMute = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    sound.setMuted(next);
  };

  return (
    <header className="h-14 px-3 md:px-5 bg-[#05080f] border-b border-[#161f30] flex items-center justify-between z-30 shrink-0 select-none font-mono">
      {/* Left: Branding & Current Room Info */}
      <div className="flex items-center space-x-3 md:space-x-4 min-w-0">
        <button 
          onClick={onToggleSidebar}
          className="md:hidden p-1.5 text-zinc-400 hover:text-emerald-400 rounded bg-[#0b101c] border border-[#161f30] transition"
          aria-label="Toggle user list"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Logo */}
        <div className="flex items-center shrink-0">
          <span className="font-black text-base tracking-wider text-white">
            Vision<span className="text-[#00ff88]">.</span>
          </span>
        </div>

        <span className="text-[#1c283f] text-xs hidden sm:inline">|</span>

        {/* Current Room Pill */}
        <div className="flex items-center space-x-2 truncate">
          <div className="flex items-center space-x-2 bg-[#080d17] border border-[#1a263d] rounded-lg px-3 py-1 text-xs text-zinc-200">
            {currentRoom?.hasPassword ? (
              <Lock className="w-3.5 h-3.5 text-[#ffb700] shrink-0" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-[#00ff88] shrink-0" />
            )}
            
            <span className="text-zinc-400 text-xs hidden md:inline">Room:</span>
            <span className="truncate max-w-[140px] sm:max-w-[200px] md:max-w-[260px] font-semibold text-white">
              {currentRoom?.name || 'Connecting...'}
            </span>

            {currentRoom?.hasPassword && (
              <span className="px-1.5 py-0.2 bg-[#ffb700]/10 text-[#ffb700] border border-[#ffb700]/30 text-[10px] font-bold rounded">
                Protected
              </span>
            )}
          </div>

          {/* Leave Room Button in Header for Custom Rooms */}
          {currentRoom?.isCustom && (
            <button
              onClick={leaveRoom}
              className="flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition shadow-sm"
              title="Leave custom room and return to Local Wi-Fi"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          )}

          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20 rounded-lg text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
            <span>{roomUsers.length} Online</span>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
        {/* Switch / Create Room Button */}
        <button
          onClick={onOpenRoomModal}
          className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-[#0b101c] hover:bg-[#111827] text-zinc-200 hover:text-[#00ff88] border border-[#1a263d] hover:border-[#00ff88]/40 transition"
          title="Create or Join Room"
        >
          <Plus className="w-3.5 h-3.5 text-[#00ff88]" />
          <span className="hidden sm:inline">Room</span>
        </button>

        {/* Share Room Button */}
        <button
          onClick={onOpenShareModal}
          className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-[#0b101c] hover:bg-[#111827] text-zinc-200 hover:text-[#00ff88] border border-[#1a263d] hover:border-[#00ff88]/40 transition"
          title="Share Room / Invite Link"
        >
          <Share2 className="w-3.5 h-3.5 text-[#00ff88]" />
          <span className="hidden sm:inline">Share</span>
        </button>

        {/* Audio Mute Toggle */}
        <button
          onClick={handleToggleMute}
          className={`p-1.5 rounded-lg border transition ${
            soundMuted 
              ? 'bg-[#0b101c] border-[#1a263d] text-zinc-500' 
              : 'bg-[#0b101c] border-[#1a263d] text-[#00ff88] hover:border-[#00ff88]/40'
          }`}
          title={soundMuted ? 'Unmute sounds' : 'Mute sounds'}
        >
          {soundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {/* User Profile / Settings Pill */}
        <button
          onClick={onOpenSettingsModal}
          className="flex items-center space-x-1.5 p-1 rounded-lg bg-[#080d17] hover:bg-[#0f1626] border border-[#1a263d] hover:border-[#00ff88]/40 transition group"
          title="Profile & Settings"
        >
          <span className="text-xs font-semibold text-zinc-200 group-hover:text-[#00ff88] max-w-[80px] truncate hidden md:inline">
            {user.name}
          </span>
          <div className="w-6 h-6 rounded-md overflow-hidden border border-[#1a263d] group-hover:border-[#00ff88]/50 transition">
            <img src={getAvatarSvg(user.avatar || user.name)} alt={user.name} className="w-full h-full object-cover" />
          </div>
        </button>
      </div>
    </header>
  );
}
