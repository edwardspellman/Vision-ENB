import React, { useState } from 'react';
import { 
  Shield, 
  Plus, 
  Key, 
  Copy, 
  Check, 
  Crown, 
  UserCheck, 
  UserX, 
  Lock, 
  X, 
  Users,
  Sparkles
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { getAvatarSvg } from '../utils/avatar';

export default function GuildModal({ isOpen, onClose, currentGuild, onSelectGuild }) {
  const { socket, user } = useSocket();
  const [activeTab, setActiveTab] = useState('join'); // 'join' | 'create' | 'manage'
  const [guildIdInput, setGuildIdInput] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  // Create Guild Form
  const [guildName, setGuildName] = useState('');
  const [guildDesc, setGuildDesc] = useState('');
  const [guildPassword, setGuildPassword] = useState('');

  // Status & Feedback
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [createdGuildData, setCreatedGuildData] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  if (!isOpen) return null;

  const isCurrentHost = currentGuild && (currentGuild.hostId === user.id || currentGuild.hostId === user.name);

  // Handle Join Guild by Unique ID
  const handleJoinGuild = (e) => {
    e.preventDefault();
    if (!guildIdInput.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter a Unique Guild ID' });
      return;
    }

    setStatusMsg({ type: 'info', text: 'Joining Guild...' });
    socket.emit('join_guild_by_id', {
      guildId: guildIdInput.trim().toUpperCase(),
      password: joinPassword,
      user
    }, (res) => {
      if (res.success && res.guild) {
        setStatusMsg({ type: 'success', text: `Successfully joined ${res.guild.name}!` });
        if (onSelectGuild) onSelectGuild(res.guild);
        setTimeout(() => {
          onClose();
          setStatusMsg({ type: '', text: '' });
        }, 1000);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to join guild.' });
      }
    });
  };

  // Handle Create Guild
  const handleCreateGuild = (e) => {
    e.preventDefault();
    if (!guildName.trim()) {
      setStatusMsg({ type: 'error', text: 'Guild Name is required' });
      return;
    }

    setStatusMsg({ type: 'info', text: 'Creating Guild...' });
    socket.emit('create_guild', {
      name: guildName.trim(),
      description: guildDesc.trim(),
      password: guildPassword,
      user
    }, (res) => {
      if (res.success && res.guild) {
        setCreatedGuildData(res.guild);
        setStatusMsg({ type: 'success', text: 'Guild created successfully!' });
        if (onSelectGuild) onSelectGuild(res.guild);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to create guild.' });
      }
    });
  };

  // Copy Guild Unique ID
  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Transfer Ownership
  const handleTransferOwnership = (targetUserId) => {
    if (!currentGuild) return;
    if (!window.confirm('Are you sure you want to transfer full Host Adminship to this user?')) return;

    socket.emit('transfer_guild_ownership', {
      guildId: currentGuild.id,
      targetUserId
    }, (res) => {
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Host Adminship transferred successfully!' });
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to transfer ownership.' });
      }
    });
  };

  // Promote/Demote Admin
  const handlePromoteAdmin = (targetUserId, currentRole) => {
    if (!currentGuild) return;
    const newRole = currentRole === 'admin' ? 'member' : 'admin';

    socket.emit('promote_guild_admin', {
      guildId: currentGuild.id,
      targetUserId,
      newRole
    }, (res) => {
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Updated user role to ${newRole}` });
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to update role.' });
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-mono select-none">
      <div className="w-full max-w-md bg-[#080d17] border border-[#161f30] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#161f30] flex items-center justify-between bg-[#04060a]">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-[#00ff88]" />
            <h2 className="text-sm font-bold text-white tracking-wider">Vision Guild Hub</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#161f30] bg-[#05080f] text-xs font-semibold">
          <button
            onClick={() => { setActiveTab('join'); setStatusMsg({ type: '', text: '' }); }}
            className={`flex-1 py-2.5 text-center transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'join'
                ? 'bg-[#080d17] text-[#00ff88] border-b-2 border-[#00ff88]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Join Guild</span>
          </button>

          <button
            onClick={() => { setActiveTab('create'); setStatusMsg({ type: '', text: '' }); setCreatedGuildData(null); }}
            className={`flex-1 py-2.5 text-center transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'create'
                ? 'bg-[#080d17] text-[#00ff88] border-b-2 border-[#00ff88]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Guild</span>
          </button>

          {currentGuild && (
            <button
              onClick={() => { setActiveTab('manage'); setStatusMsg({ type: '', text: '' }); }}
              className={`flex-1 py-2.5 text-center transition flex items-center justify-center space-x-1.5 ${
                activeTab === 'manage'
                  ? 'bg-[#080d17] text-[#00ff88] border-b-2 border-[#00ff88]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Manage</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Status Message */}
          {statusMsg.text && (
            <div className={`p-3 rounded-xl text-xs font-medium border ${
              statusMsg.type === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
              statusMsg.type === 'success' ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30' :
              'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
            }`}>
              {statusMsg.text}
            </div>
          )}

          {/* TAB 1: JOIN GUILD */}
          {activeTab === 'join' && (
            <form onSubmit={handleJoinGuild} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Unique Guild ID / Code:
                </label>
                <input
                  type="text"
                  placeholder="e.g. GUILD-89F2A"
                  value={guildIdInput}
                  onChange={(e) => setGuildIdInput(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-[#0b101c] border border-[#1a263d] rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88] transition tracking-wider uppercase font-bold"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Enter the unique ID shared by your Guild host.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Password (If Protected):
                </label>
                <input
                  type="password"
                  placeholder="Optional Guild password"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0b101c] border border-[#1a263d] rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88] transition"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#00ff88] hover:bg-[#00e67a] text-black font-bold text-xs rounded-xl transition flex items-center justify-center space-x-1.5 shadow-lg"
              >
                <Key className="w-4 h-4" />
                <span>Join Guild</span>
              </button>
            </form>
          )}

          {/* TAB 2: CREATE GUILD */}
          {activeTab === 'create' && (
            <div>
              {!createdGuildData ? (
                <form onSubmit={handleCreateGuild} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Guild Name:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Developers Clan"
                      value={guildName}
                      onChange={(e) => setGuildName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0b101c] border border-[#1a263d] rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Description:
                    </label>
                    <input
                      type="text"
                      placeholder="Brief topic or rules..."
                      value={guildDesc}
                      onChange={(e) => setGuildDesc(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0b101c] border border-[#1a263d] rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Security Password (Optional):
                    </label>
                    <input
                      type="password"
                      placeholder="Leave empty for public join"
                      value={guildPassword}
                      onChange={(e) => setGuildPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0b101c] border border-[#1a263d] rounded-xl text-xs text-white focus:outline-none focus:border-[#00ff88] transition"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#00ff88] hover:bg-[#00e67a] text-black font-bold text-xs rounded-xl transition flex items-center justify-center space-x-1.5 shadow-lg"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Guild</span>
                  </button>
                </form>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#00ff88]/10 border border-[#00ff88]/30 flex items-center justify-center mx-auto text-[#00ff88]">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Guild Created!</h3>
                  <p className="text-xs text-zinc-400">
                    Share this **Unique Guild ID** with your members so they can join:
                  </p>

                  <div className="flex items-center justify-between p-3 bg-[#0b101c] border border-[#00ff88]/40 rounded-xl">
                    <span className="text-sm font-extrabold text-[#00ff88] tracking-widest">
                      {createdGuildData.id}
                    </span>
                    <button
                      onClick={() => handleCopyId(createdGuildData.id)}
                      className="px-3 py-1.5 bg-[#00ff88] hover:bg-[#00e67a] text-black font-bold text-xs rounded-lg transition flex items-center space-x-1"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <button
                    onClick={onClose}
                    className="w-full py-2 bg-[#0b101c] hover:bg-[#111827] text-zinc-300 font-bold text-xs rounded-xl border border-[#1a263d] transition"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MANAGE GUILD */}
          {activeTab === 'manage' && currentGuild && (
            <div className="space-y-4">
              <div className="p-3 bg-[#0b101c] border border-[#1a263d] rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">{currentGuild.name}</h4>
                  <p className="text-[11px] text-[#00ff88] font-bold mt-0.5">ID: {currentGuild.id}</p>
                </div>
                <button
                  onClick={() => handleCopyId(currentGuild.id)}
                  className="p-1.5 text-zinc-400 hover:text-[#00ff88] transition"
                  title="Copy Unique Guild ID"
                >
                  {copiedId ? <Check className="w-4 h-4 text-[#00ff88]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div>
                <h4 className="text-xs font-bold text-zinc-300 mb-2 flex items-center justify-between">
                  <span>Guild Members ({currentGuild.members?.length || 0})</span>
                  {isCurrentHost && <span className="text-[10px] text-amber-400">Host Controls Active</span>}
                </h4>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {currentGuild.members?.map((m) => {
                    const isSelf = m.id === user.id || m.name === user.name;
                    return (
                      <div key={m.id || m.name} className="flex items-center justify-between p-2 bg-[#05080f] border border-[#161f30] rounded-xl text-xs">
                        <div className="flex items-center space-x-2">
                          <img
                            src={getAvatarSvg(m.avatar || m.name)}
                            alt="Avatar"
                            className="w-6 h-6 rounded-md object-cover border border-[#1a263d]"
                          />
                          <span className="font-semibold text-zinc-200">{m.name}</span>
                          {m.role === 'host' && (
                            <span className="px-1.5 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[9px] font-bold rounded flex items-center space-x-1">
                              <Crown className="w-2.5 h-2.5" />
                              <span>Host</span>
                            </span>
                          )}
                          {m.role === 'admin' && (
                            <span className="px-1.5 py-0.2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[9px] font-bold rounded">
                              Admin
                            </span>
                          )}
                        </div>

                        {/* Actions for Host */}
                        {isCurrentHost && !isSelf && (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handlePromoteAdmin(m.id, m.role)}
                              className={`p-1 rounded text-[10px] font-bold border transition ${
                                m.role === 'admin' 
                                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20' 
                                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-cyan-400'
                              }`}
                              title={m.role === 'admin' ? 'Demote to Member' : 'Promote to Admin'}
                            >
                              {m.role === 'admin' ? 'Demote' : 'Make Admin'}
                            </button>

                            <button
                              onClick={() => handleTransferOwnership(m.id)}
                              className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold rounded transition flex items-center space-x-1"
                              title="Transfer Host Ownership to this user"
                            >
                              <Crown className="w-3 h-3" />
                              <span>Transfer</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
