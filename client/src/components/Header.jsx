import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Share2, 
  Plus, 
  Volume2, 
  VolumeX, 
  Wifi, 
  Menu, 
  Shield,
  Film,
  Download
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { getAvatarSvg } from '../utils/avatar';
import { sound } from '../utils/sound';

export default function Header({ 
  onOpenRoomModal, 
  onOpenShareModal, 
  onOpenSettingsModal,
  onOpenGuildModal,
  onOpenWatchPartyModal,
  onToggleSidebar,
  soundMuted,
  setSoundMuted,
  currentGuild
}) {
  const { currentRoom, roomUsers, user } = useSocket();
  const [pwaDeferredPrompt, setPwaDeferredPrompt] = useState(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setPwaDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallPWA = () => {
    if (pwaDeferredPrompt) {
      pwaDeferredPrompt.prompt();
      pwaDeferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted Vision PWA install prompt');
        }
        setPwaDeferredPrompt(null);
      });
    } else {
      alert('To install Vision App on Mobile/Desktop:\n- Tap Share or Browser Menu (...) in Chrome/Safari\n- Select "Add to Home Screen" or "Install App".');
    }
  };

  const handleToggleMute = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    sound.setMuted(next);
  };

  return (
    <header className="h-14 px-3 md:px-5 bg-[#05080f] border-b border-[#161f30] flex items-center justify-between z-30 shrink-0 select-none font-mono">
      {/* Left: Branding & Clean Location Info */}
      <div className="flex items-center space-x-2.5 md:space-x-4 min-w-0">
        {/* Logo */}
        <div className="flex items-center shrink-0">
          <span className="font-black text-base sm:text-lg tracking-wider text-white">
            Vision<span className="text-[#00ff88]">.</span>
          </span>
        </div>

        <span className="text-[#1c283f] text-xs">|</span>

        {/* Current Location Pill */}
        <div className="flex items-center space-x-2 truncate">
          <div className="flex items-center space-x-2 bg-[#080d17] border border-[#1a263d] rounded-xl px-2.5 sm:px-3 py-1 text-xs text-zinc-200">
            {currentGuild ? (
              <Shield className="w-3.5 h-3.5 text-[#00ff88] shrink-0" />
            ) : currentRoom?.hasPassword ? (
              <Lock className="w-3.5 h-3.5 text-[#ffb700] shrink-0" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-[#00ff88] shrink-0" />
            )}
            
            <span className="text-zinc-400 text-xs hidden sm:inline">
              {currentGuild ? 'Guild:' : 'Room:'}
            </span>
            <span className="truncate max-w-[120px] sm:max-w-[200px] md:max-w-[260px] font-semibold text-white">
              {currentGuild ? currentGuild.name : (currentRoom?.name || 'Connecting...')}
            </span>

            {currentRoom?.hasPassword && !currentGuild && (
              <span className="px-1.5 py-0.2 bg-[#ffb700]/10 text-[#ffb700] border border-[#ffb700]/30 text-[10px] font-bold rounded hidden sm:inline">
                Protected
              </span>
            )}
          </div>

          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20 rounded-xl text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
            <span>{currentGuild ? currentGuild.members?.length : roomUsers.length} Online</span>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
        {/* Desktop Quick Action Buttons (Hidden on Mobile for clean top bar) */}
        <div className="hidden md:flex items-center space-x-1.5">
          {/* Watch Party Sync Theater Button */}
          <button
            onClick={onOpenWatchPartyModal}
            className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-bold rounded-xl bg-[#0b101c] hover:bg-[#111827] text-zinc-200 hover:text-[#00ff88] border border-[#1a263d] hover:border-[#00ff88]/40 transition"
            title="Open Synchronized Watch Party Video Theater"
          >
            <Film className="w-3.5 h-3.5 text-[#00ff88]" />
            <span>Watch Party</span>
          </button>

          {/* Permanent Guilds Button */}
          <button
            onClick={onOpenGuildModal}
            className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-bold rounded-xl bg-[#0b101c] hover:bg-[#111827] text-zinc-200 hover:text-[#00ff88] border border-[#1a263d] hover:border-[#00ff88]/40 transition"
            title="Join or Create a Permanent Guild"
          >
            <Shield className="w-3.5 h-3.5 text-[#00ff88]" />
            <span>Guilds</span>
          </button>

          {/* PWA App Install Button */}
          <button
            onClick={handleInstallPWA}
            className="p-1.5 rounded-xl bg-[#0b101c] hover:bg-[#111827] text-[#00ff88] border border-[#1a263d] hover:border-[#00ff88]/40 transition"
            title="Install Vision App on Mobile/Desktop"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Share Room Button */}
          <button
            onClick={onOpenShareModal}
            className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-bold rounded-xl bg-[#0b101c] hover:bg-[#111827] text-zinc-200 hover:text-[#00ff88] border border-[#1a263d] hover:border-[#00ff88]/40 transition"
            title="Share Room / Invite Link"
          >
            <Share2 className="w-3.5 h-3.5 text-[#00ff88]" />
            <span>Share</span>
          </button>

          {/* Audio Mute Toggle */}
          <button
            onClick={handleToggleMute}
            className={`p-1.5 rounded-xl border transition ${
              soundMuted 
                ? 'bg-[#0b101c] border-[#1a263d] text-zinc-500' 
                : 'bg-[#0b101c] border-[#1a263d] text-[#00ff88] hover:border-[#00ff88]/40'
            }`}
            title={soundMuted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {soundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* User Profile Pill */}
          <button
            onClick={onOpenSettingsModal}
            className="flex items-center space-x-1.5 p-1 rounded-xl bg-[#080d17] hover:bg-[#0f1626] border border-[#1a263d] hover:border-[#00ff88]/40 transition group"
            title="Profile & Settings"
          >
            <span className="text-xs font-semibold text-zinc-200 group-hover:text-[#00ff88] max-w-[80px] truncate">
              {user.name}
            </span>
            <div className="w-6 h-6 rounded-lg overflow-hidden border border-[#1a263d] group-hover:border-[#00ff88]/50 transition">
              <img src={getAvatarSvg(user.avatar || user.name)} alt={user.name} className="w-full h-full object-cover" />
            </div>
          </button>
        </div>

        {/* Mobile Sidebar Menu Button (Top Right Header Position) */}
        <button 
          onClick={onToggleSidebar}
          className="px-3 py-1.5 rounded-xl bg-[#00ff88]/10 hover:bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/30 font-bold text-xs flex items-center space-x-1.5 shadow-md transition transform active:scale-95"
          aria-label="Open Vision Menu"
        >
          <Menu className="w-4 h-4 text-[#00ff88]" />
          <span className="md:hidden">Menu</span>
        </button>
      </div>
    </header>
  );
}
