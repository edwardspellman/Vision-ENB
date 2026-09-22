import React from 'react';
import { 
  Users, 
  Video, 
  Phone, 
  X, 
  Copy, 
  Check,
  Crown,
  LogOut,
  Shield,
  Plus,
  Share2,
  Settings,
  Download,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../context/WebRTCContext';
import { getAvatarSvg } from '../utils/avatar';
import { sound } from '../utils/sound';

export default function Sidebar({ 
  isOpen, 
  onClose, 
  onOpenRoomModal,
  onOpenShareModal,
  onOpenRoomSettingsModal,
  onOpenSettingsModal,
  soundMuted,
  setSoundMuted
}) {
  const { currentRoom, roomUsers, user, ipInfo, leaveRoom, isHost } = useSocket();
  const { startCall, sendP2PFile } = useWebRTC();
  const [copied, setCopied] = React.useState(false);

  const fileInputRef = React.useRef(null);
  const [p2pTargetSocketId, setP2pTargetSocketId] = React.useState(null);

  const handleCopyRoomId = () => {
    const id = currentRoom?.id;
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const triggerP2PFile = (targetSocketId) => {
    setP2pTargetSocketId(targetSocketId);
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleP2PFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && p2pTargetSocketId) {
      sendP2PFile(p2pTargetSocketId, file);
      setP2pTargetSocketId(null);
    }
  };

  const handleToggleMute = () => {
    const next = !soundMuted;
    setSoundMuted && setSoundMuted(next);
    sound.setMuted(next);
  };

  return (
    <>
      {/* Hidden input for P2P File transfers */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleP2PFileSelect}
        className="hidden"
      />

      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      <aside className={`
        fixed md:static top-0 right-0 bottom-0 z-50 md:z-20
        w-80 sm:w-80 bg-[#05080f] border-l border-[#161f30] flex flex-col font-mono select-none
        transition-transform duration-300 ease-in-out shadow-2xl
        ${isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        {/* Sidebar Header */}
        <div className="min-h-[3.5rem] pt-[env(safe-area-inset-top,0px)] pb-1 px-4 border-b border-[#161f30] flex items-center justify-between shrink-0 bg-[#070b14]">
          <div className="flex items-center space-x-2 text-zinc-200">
            <Shield className="w-4 h-4 text-[#00ff88]" />
            <span className="font-bold text-xs tracking-wide">Vision Menu & Hub</span>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Profile Bar */}
        <div className="p-3 border-b border-[#161f30] bg-[#080d17] flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <img
              src={getAvatarSvg(user.avatar || user.name)}
              alt="Profile"
              className="w-8 h-8 rounded-xl object-cover border border-[#1a263d]"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-[#00ff88] font-semibold">Online</p>
            </div>
          </div>

          <button
            onClick={() => { onClose(); onOpenSettingsModal && onOpenSettingsModal(); }}
            className="p-1.5 bg-[#0b101c] hover:bg-[#111827] text-zinc-300 hover:text-[#00ff88] border border-[#1a263d] rounded-xl transition"
            title="Profile & Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Features & Options Grid */}
        <div className="p-3 border-b border-[#161f30] bg-[#070b14] space-y-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            Platform Features
          </span>

          <div className="grid grid-cols-2 gap-1.5">
            {/* Rooms Hub */}
            <button
              onClick={() => { onClose(); onOpenRoomModal && onOpenRoomModal('create'); }}
              className="flex items-center space-x-2 p-2 rounded-xl bg-[#0b1220] hover:bg-[#111c33] border border-[#162238] hover:border-[#00f0ff]/40 text-left transition group"
            >
              <div className="p-1.5 rounded-lg bg-[#00f0ff]/10 text-[#00f0ff] group-hover:scale-110 transition-transform shrink-0">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-zinc-200 group-hover:text-[#00f0ff] truncate">Rooms</p>
                <p className="text-[9px] text-zinc-500 truncate">Create/Join</p>
              </div>
            </button>

            {/* Share Room / QR */}
            <button
              onClick={() => { onClose(); onOpenShareModal && onOpenShareModal(); }}
              className="flex items-center space-x-2 p-2 rounded-xl bg-[#0b1220] hover:bg-[#111c33] border border-[#162238] hover:border-cyan-400/40 text-left transition group"
            >
              <div className="p-1.5 rounded-lg bg-cyan-400/10 text-cyan-400 group-hover:scale-110 transition-transform shrink-0">
                <Share2 className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-zinc-200 group-hover:text-cyan-400 truncate">Share QR</p>
                <p className="text-[9px] text-zinc-500 truncate">Invite link</p>
              </div>
            </button>

            {/* Room Settings (Host Only) */}
            {isHost && (
              <button
                onClick={() => { onClose(); onOpenRoomSettingsModal && onOpenRoomSettingsModal(); }}
                className="flex items-center space-x-2 p-2 rounded-xl bg-[#0b1220] hover:bg-[#111c33] border border-[#162238] hover:border-[#00ff88]/40 text-left transition group"
              >
                <div className="p-1.5 rounded-lg bg-[#00ff88]/10 text-[#00ff88] group-hover:scale-110 transition-transform shrink-0">
                  <Settings className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-zinc-200 group-hover:text-[#00ff88] truncate">Settings</p>
                  <p className="text-[9px] text-zinc-500 truncate">Governance</p>
                </div>
              </button>
            )}

            {/* Sound FX Toggle */}
            <button
              onClick={handleToggleMute}
              className="flex items-center space-x-2 p-2 rounded-xl bg-[#0b1220] hover:bg-[#111c33] border border-[#162238] hover:border-amber-400/40 text-left transition group"
            >
              <div className="p-1.5 rounded-lg bg-amber-400/10 text-amber-400 group-hover:scale-110 transition-transform shrink-0">
                {soundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-zinc-200 group-hover:text-amber-400 truncate">
                  {soundMuted ? 'Unmute' : 'Mute'}
                </p>
                <p className="text-[9px] text-zinc-500 truncate">Sound FX</p>
              </div>
            </button>

            {/* Install App */}
            <button
              onClick={() => {
                alert('To install Vision App on Mobile/Desktop:\n- Tap Share or Browser Menu (...) in Chrome/Safari\n- Select "Add to Home Screen" or "Install App".');
              }}
              className="flex items-center space-x-2 p-2 rounded-xl bg-[#0b1220] hover:bg-[#111c33] border border-[#162238] hover:border-emerald-400/40 text-left transition group"
            >
              <div className="p-1.5 rounded-lg bg-emerald-400/10 text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
                <Download className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-zinc-200 group-hover:text-emerald-400 truncate">Install App</p>
                <p className="text-[9px] text-zinc-500 truncate">PWA Mobile</p>
              </div>
            </button>
          </div>
        </div>

        {/* Current Active Location Box */}
        <div className="p-3 border-b border-[#161f30] bg-[#080d17]">
          <div className="bg-[#05080f] rounded-xl p-3 border border-[#161f30]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Current Room
              </span>
              <button 
                onClick={handleCopyRoomId}
                className="text-xs text-[#00ff88] hover:underline flex items-center space-x-1 font-semibold"
                title="Copy Unique ID"
              >
                {copied ? <Check className="w-3 h-3 text-[#00ff88]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy ID'}</span>
              </button>
            </div>

            <p className="text-xs font-bold text-zinc-100 truncate">
              {currentRoom?.isCustom ? currentRoom.name : 'Welcome to Local Network'}
            </p>
            {currentRoom?.isCustom && (
              <p className="text-[11px] text-zinc-400 mt-0.5 truncate font-mono">
                Room ID: <span className="text-[#00f0ff]">{currentRoom?.id}</span>
              </p>
            )}
            <p className="text-[11px] text-[#00ff88] mt-0.5 truncate font-mono font-bold">
              IP Address: <span className="text-[#00ff88]">{ipInfo?.lanIp || ipInfo?.rawIp || ipInfo?.ip || '127.0.0.1'}</span>
            </p>

            {currentRoom?.isCustom && (
              <button
                onClick={leaveRoom}
                className="w-full mt-2.5 py-1.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center justify-center space-x-1.5 transition"
                title="Leave custom room and return to Local Wi-Fi"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave Room</span>
              </button>
            )}
          </div>
        </div>

        {/* Member List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          {(() => {
            const uniqueMembersMap = new Map();
            (roomUsers || []).forEach(m => {
              const key = m.id || m.name || m.socketId;
              if (key && !uniqueMembersMap.has(key)) {
                uniqueMembersMap.set(key, m);
              }
            });
            const uniqueMembers = Array.from(uniqueMembersMap.values());

            return (
              <>
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Room Members
                  </span>
                  <span className="text-[10px] text-[#00ff88] font-bold">
                    {uniqueMembers.length} Online
                  </span>
                </div>

                {uniqueMembers.map((member) => {
                  const isMe = member.id === user.id || member.name === user.name;
                  const targetSocketId = member.socketId || member.id;
                  return (
                    <div
                      key={member.id || member.socketId}
                      className={`flex items-center justify-between p-2 rounded-xl border transition ${
                        isMe ? 'bg-[#081220] border-[#00f0ff]/30' : 'bg-[#080d17] border-[#161f30]'
                      }`}
                    >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={getAvatarSvg(member.avatar || member.name)}
                      alt={member.name}
                      className="w-7 h-7 rounded-lg object-cover border border-[#1a263d]"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#00ff88] ring-2 ring-[#05080f]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-200 truncate flex items-center space-x-1">
                      <span>{member.name}</span>
                      {isMe && <span className="text-[10px] text-[#00f0ff] font-bold">(You)</span>}
                    </p>
                    {member.isHost && (
                      <span className="text-[9px] text-[#ffb700] font-bold flex items-center space-x-0.5">
                        <Crown className="w-2.5 h-2.5" />
                        <span>Host</span>
                      </span>
                    )}
                  </div>
                </div>

                {!isMe && member.socketId && (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => startCall && startCall(member.socketId, member, false)}
                      className="p-1 text-zinc-400 hover:text-[#00ff88] hover:bg-[#0b101c] rounded-lg transition"
                      title="Audio Call"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => startCall && startCall(member.socketId, member, true)}
                      className="p-1 text-zinc-400 hover:text-[#00f0ff] hover:bg-[#0b101c] rounded-lg transition"
                      title="Video Call"
                    >
                      <Video className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => triggerP2PFile(member.socketId)}
                      className="p-1 text-zinc-400 hover:text-cyan-400 hover:bg-[#0b101c] rounded-lg transition"
                      title="Direct P2P File Transfer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
            </>
          );
        })()}
        </div>
      </aside>
    </>
  );
}
