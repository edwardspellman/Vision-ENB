import React, { useState } from 'react';
import { 
  X, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Save, 
  Sparkles,
  Smartphone,
  Monitor,
  User,
  LogOut
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { getAvatarSvg, generateRandomName, getColorForString } from '../utils/avatar';
import { sound } from '../utils/sound';
import { getBackendUrl, setBackendUrl } from '../utils/config';

export default function SettingsModal({ isOpen, onClose, soundMuted, setSoundMuted }) {
  const { user, updateUserProfile, logout, reconnectWithUrl } = useSocket();
  const [name, setName] = useState(user.name);
  const [avatarSeed, setAvatarSeed] = useState(user.avatar || user.name);
  const [device, setDevice] = useState(user.device || 'desktop');
  const [serverUrl, setServerUrl] = useState(() => getBackendUrl());

  if (!isOpen) return null;

  const handleRandomize = () => {
    const newName = generateRandomName();
    setName(newName);
    setAvatarSeed(newName);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setBackendUrl(serverUrl);
    if (reconnectWithUrl) {
      reconnectWithUrl(serverUrl);
    }
    updateUserProfile({
      name: name.trim(),
      avatar: avatarSeed.trim(),
      color: getColorForString(name.trim()).accent,
      device
    });
    onClose();
  };

  const handleLogout = () => {
    logout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in font-mono select-none">
      <div className="w-full max-w-sm bg-[#080d17] rounded-2xl border border-[#1a263d] shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#161f30] mb-5">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-[#00ff88]" />
            <h3 className="font-bold text-sm text-zinc-100">
              Profile & Settings
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Avatar Preview */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative mb-2 group">
              <div className="w-16 h-16 rounded-xl border border-[#00ff88]/50 overflow-hidden shadow-lg">
                <img
                  src={getAvatarSvg(avatarSeed)}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={handleRandomize}
                className="absolute -bottom-1 -right-1 p-1.5 bg-[#00ff88] text-black rounded-full shadow transition"
                title="Randomize Avatar"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleRandomize}
              className="text-xs text-[#00ff88] hover:underline flex items-center space-x-1 font-semibold"
            >
              <Sparkles className="w-3 h-3" />
              <span>Randomize Avatar</span>
            </button>
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setAvatarSeed(e.target.value);
              }}
              placeholder="Your name"
              className="w-full bg-[#05080f] border border-[#1a263d] focus:border-[#00ff88] rounded-xl px-4 py-2.5 text-xs text-zinc-100 font-bold focus:outline-none"
              required
            />
          </div>

          {/* Device Profile */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">
              Device Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDevice('desktop')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition ${
                  device === 'desktop'
                    ? 'bg-[#00ff88]/10 border-[#00ff88] text-[#00ff88]'
                    : 'bg-[#05080f] border-[#161f30] text-zinc-400'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>Desktop</span>
              </button>

              <button
                type="button"
                onClick={() => setDevice('mobile')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-2 transition ${
                  device === 'mobile'
                    ? 'bg-[#00f0ff]/10 border-[#00f0ff] text-[#00f0ff]'
                    : 'bg-[#05080f] border-[#161f30] text-zinc-400'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Mobile</span>
              </button>
            </div>
          </div>

          {/* Audio Notifications */}
          <div className="p-3 bg-[#05080f] rounded-xl border border-[#161f30] flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-zinc-200">
              {soundMuted ? <VolumeX className="w-4 h-4 text-zinc-500" /> : <Volume2 className="w-4 h-4 text-[#00ff88]" />}
              <span>Sound Effects</span>
            </div>
            <input
              type="checkbox"
              checked={!soundMuted}
              onChange={(e) => {
                const muted = !e.target.checked;
                setSoundMuted(muted);
                sound.setMuted(muted);
              }}
              className="w-4 h-4 accent-[#00ff88] cursor-pointer"
            />
          </div>

          {/* Server Connection URL Configurator */}
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center justify-between">
              <span>Backend Server Address</span>
              <span className="text-[10px] text-zinc-500 font-normal">LAN / Local Host</span>
            </label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="e.g. http://192.168.1.100:3000"
              className="w-full bg-[#05080f] border border-[#1a263d] focus:border-[#00ff88] rounded-xl px-4 py-2 text-xs text-zinc-100 font-bold focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="submit"
              className="w-full py-2.5 bg-[#00ff88] hover:bg-[#00e67a] text-black font-bold text-xs rounded-xl transition shadow-lg flex items-center justify-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2 bg-transparent hover:bg-rose-500/10 text-rose-400 font-bold text-xs rounded-xl transition flex items-center justify-center space-x-1.5 border border-rose-500/20"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out / Switch User</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
