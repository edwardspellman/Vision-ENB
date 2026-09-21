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
  Zap
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../context/WebRTCContext';
import { getAvatarSvg } from '../utils/avatar';

export default function Sidebar({ 
  isOpen, 
  onClose, 
  onOpenGuildModal, 
  joinedGuilds = [], 
  currentGuild, 
  onSelectGuild 
}) {
  const { currentRoom, roomUsers, user, ipInfo, leaveRoom } = useSocket();
  const { startCall, sendP2PFile } = useWebRTC();
  const [copied, setCopied] = React.useState(false);

  const fileInputRef = React.useRef(null);
  const [p2pTargetSocketId, setP2pTargetSocketId] = React.useState(null);

  const handleCopyRoomId = () => {
    const id = currentGuild ? currentGuild.id : currentRoom?.id;
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
        w-72 bg-[#05080f] border-l border-[#161f30] flex flex-col font-mono select-none
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        {/* Sidebar Header */}
        <div className="h-14 px-4 border-b border-[#161f30] flex items-center justify-between shrink-0 bg-[#070b14]">
          <div className="flex items-center space-x-2 text-zinc-200">
            <Users className="w-4 h-4 text-[#00ff88]" />
            <span className="font-bold text-xs tracking-wide">
              {currentGuild ? 'Guild Members' : 'Room Members'}
            </span>
            <span className="text-xs bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 px-2 py-0.5 rounded-full font-bold">
              {currentGuild ? currentGuild.members?.length : roomUsers.length}
            </span>
          </div>

          <button 
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded md:hidden transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Permanent Guilds Hub Section */}
        <div className="p-3 border-b border-[#161f30] bg-[#070b14]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center space-x-1">
              <Shield className="w-3 h-3 text-[#00ff88]" />
              <span>Joined Guilds</span>
            </span>
            <button
              onClick={onOpenGuildModal}
              className="px-2 py-0.5 bg-[#00ff88]/10 hover:bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/30 text-[10px] font-bold rounded-lg transition flex items-center space-x-1"
              title="Join or Create a Permanent Guild"
            >
              <Plus className="w-3 h-3" />
              <span>Guild Hub</span>
            </button>
          </div>

          <div className="space-y-1 max-h-28 overflow-y-auto pr-0.5">
            {joinedGuilds.length === 0 ? (
              <p className="text-[11px] text-zinc-500 italic p-1">No joined guilds yet.</p>
            ) : (
              joinedGuilds.map((g) => {
                const isActive = currentGuild && currentGuild.id === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => onSelectGuild(g)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition border ${
                      isActive 
                        ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/40 font-bold' 
                        : 'bg-[#080d17] text-zinc-300 hover:bg-[#0d1526] border-[#161f30]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs truncate">{g.name}</p>
                      <p className="text-[9px] text-zinc-500 font-mono truncate">{g.id}</p>
                    </div>
                    {isActive && <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Current Active Location Box */}
        <div className="p-3 border-b border-[#161f30] bg-[#080d17]">
          <div className="bg-[#05080f] rounded-lg p-3 border border-[#161f30]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                {currentGuild ? 'Active Guild' : 'Current Room'}
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
              {currentGuild ? currentGuild.name : (currentRoom?.name || 'Local Network')}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5 truncate font-mono">
              ID: <span className="text-[#00f0ff]">{currentGuild ? currentGuild.id : currentRoom?.id}</span>
            </p>

            {currentGuild ? (
              <button
                onClick={() => onSelectGuild(null)}
                className="w-full mt-2.5 py-1.5 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-bold flex items-center justify-center space-x-1.5 transition"
                title="Return to Local Wi-Fi Room"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Return to Wi-Fi Room</span>
              </button>
            ) : (
              currentRoom?.isCustom && (
                <button
                  onClick={leaveRoom}
                  className="w-full mt-2.5 py-1.5 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center justify-center space-x-1.5 transition"
                  title="Leave custom room and return to Local Wi-Fi"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Leave Room</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Member List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          {(currentGuild ? currentGuild.members : roomUsers).map((member) => {
            const isMe = member.id === user.id || member.socketId === user.socketId;
            return (
              <div
                key={member.socketId || member.id}
                className={`flex items-center justify-between p-2 rounded-lg border transition ${
                  isMe 
                    ? 'bg-[#0b1424] border-[#1d3557]' 
                    : 'bg-[#080c14] hover:bg-[#0d1422] border-[#141d2e]'
                }`}
              >
                {/* User Info */}
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#1c2638]">
                      <img
                        src={getAvatarSvg(member.avatar || member.name)}
                        alt={member.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <p className="text-xs font-bold text-zinc-100 truncate">
                        {member.name}
                      </p>
                      {(member.isHost || member.role === 'host') && (
                        <Crown className="w-3 h-3 text-amber-400 shrink-0" title="Host" />
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 block">
                      {isMe ? 'You' : 'Online'}
                    </span>
                  </div>
                </div>

                {/* Direct Actions: Calls + P2P Large File Transfer */}
                {!isMe && member.socketId && (
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => triggerP2PFile(member.socketId)}
                      className="p-1.5 text-zinc-400 hover:text-[#00ff88] hover:bg-[#00ff88]/10 rounded-lg transition"
                      title="Send File P2P (Unlimited Size)"
                    >
                      <Zap className="w-3.5 h-3.5 text-[#00ff88]" />
                    </button>
                    <button
                      onClick={() => startCall(member.socketId, member, false)}
                      className="p-1.5 text-zinc-400 hover:text-[#00ff88] hover:bg-[#00ff88]/10 rounded-lg transition"
                      title="Audio Call"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => startCall(member.socketId, member, true)}
                      className="p-1.5 text-zinc-400 hover:text-[#00f0ff] hover:bg-[#00f0ff]/10 rounded-lg transition"
                      title="Video Call"
                    >
                      <Video className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-[#161f30] bg-[#04060a] shrink-0 text-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span>Network Status</span>
            <span className="text-[#00ff88] flex items-center space-x-1 font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-ping" />
              <span>Connected</span>
            </span>
          </div>
          <p className="text-zinc-300 truncate font-semibold">
            {ipInfo?.autoRoom?.roomName || 'Local Wi-Fi Network'}
          </p>
          <p className="text-zinc-500 truncate text-[11px] mt-0.5">
            IP: {ipInfo?.ip || '127.0.0.1'}
          </p>
        </div>
      </aside>
    </>
  );
}
