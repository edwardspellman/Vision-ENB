import React, { useState, useEffect } from 'react';
import { 
  X, 
  LogIn, 
  Wifi, 
  PlusCircle, 
  Sparkles, 
  ArrowRight,
  KeyRound,
  Shield,
  Upload,
  PhoneCall,
  Mic,
  Users,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function RoomModal({ isOpen, onClose, initialTab = 'create' }) {
  const { createRoom, joinRoom, ipInfo } = useSocket();
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Create Room State
  const [createId, setCreateId] = useState('');
  const [createName, setCreateName] = useState('');
  const [enablePassword, setEnablePassword] = useState(false);
  const [createPassword, setCreatePassword] = useState('');
  const [maxUsers, setMaxUsers] = useState('50');

  // Room Permissions State
  const [allowFileUploads, setAllowFileUploads] = useState(true);
  const [allowCalls, setAllowCalls] = useState(true);
  const [allowVoiceNotes, setAllowVoiceNotes] = useState(true);
  const [onlyHostCanPost, setOnlyHostCanPost] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);

  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Join Room State
  const [joinId, setJoinId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  if (!isOpen) return null;

  const handleGenerateRandomId = () => {
    const chars = '0123456789ABCDEF';
    let hex = '';
    for (let i = 0; i < 4; i++) {
      hex += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCreateId(`ROOM-${hex}`);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createId.trim()) {
      setCreateError('Please enter a Room ID.');
      return;
    }

    setIsCreating(true);
    setCreateError('');

    const res = await createRoom({
      roomId: createId.trim(),
      name: createName.trim() || createId.trim(),
      password: enablePassword ? createPassword.trim() : '',
      isPrivate: true,
      maxUsers: Number(maxUsers) || 50,
      settings: {
        allowFileUploads,
        allowCalls,
        allowVoiceNotes,
        onlyHostCanPost
      }
    });

    setIsCreating(false);

    if (res.success) {
      onClose();
    } else {
      setCreateError(res.error || 'Failed to create room.');
    }
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (!joinId.trim()) return;

    joinRoom(joinId.trim().toUpperCase(), joinPassword.trim());
    onClose();
  };

  const handleJoinLocalNetwork = () => {
    if (ipInfo?.autoRoom?.roomId) {
      joinRoom(ipInfo.autoRoom.roomId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in font-mono select-none">
      <div className="w-full max-w-md bg-[#080d17] rounded-2xl border border-[#1a263d] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#161f30] flex items-center justify-between bg-[#0a1120] shrink-0">
          <div className="flex items-center space-x-2">
            <PlusCircle className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm text-zinc-100">
              Rooms
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="p-3 pb-0 flex space-x-2 border-b border-[#161f30] bg-[#0a1120] shrink-0">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 pb-3 text-xs font-bold border-b-2 transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'create'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Create Room</span>
          </button>

          <button
            onClick={() => setActiveTab('join')}
            className={`flex-1 pb-3 text-xs font-bold border-b-2 transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'join'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Join with ID</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 bg-[#0d0d0d]">
          {activeTab === 'create' ? (
            <form onSubmit={handleCreateSubmit} className="uiverse-form">
              <h2 className="uiverse-heading flex items-center justify-center space-x-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <span>Create Custom Room</span>
              </h2>

              {createError && (
                <div className="p-2.5 bg-[#ff3366]/10 border border-[#ff3366]/30 rounded-xl text-xs text-[#ff3366]">
                  {createError}
                </div>
              )}

              {/* Room ID */}
              <div>
                <div className="flex items-center justify-between mb-1.5 px-2">
                  <label className="text-xs font-bold text-zinc-300">
                    Room ID / Code
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomId}
                    className="text-xs text-cyan-400 hover:underline font-semibold flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto Generate</span>
                  </button>
                </div>
                <div className="uiverse-field">
                  <PlusCircle className="uiverse-input-icon" />
                  <input
                    type="text"
                    value={createId}
                    onChange={(e) => setCreateId(e.target.value.toUpperCase())}
                    placeholder="Enter Room ID"
                    className="uiverse-input-field font-bold uppercase"
                    required
                  />
                </div>
              </div>

              {/* Room Name */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5 px-2">
                  Room Name (Optional)
                </label>
                <div className="uiverse-field">
                  <Sparkles className="uiverse-input-icon text-cyan-400" />
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Enter Room Name"
                    className="uiverse-input-field"
                  />
                </div>
              </div>

              {/* Password Protection */}
              <div className="p-3.5 bg-[#121212] rounded-[20px] border border-[#252525] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <KeyRound className="w-4 h-4 text-[#ffb700]" />
                    <span className="text-xs font-bold text-zinc-200">Password Protection</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={enablePassword}
                    onChange={(e) => setEnablePassword(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400 cursor-pointer"
                  />
                </div>

                {enablePassword && (
                  <div className="animate-fade-in pt-1">
                    <div className="uiverse-field">
                      <KeyRound className="uiverse-input-icon text-[#ffb700]" />
                      <input
                        type="text"
                        value={createPassword}
                        onChange={(e) => setCreatePassword(e.target.value)}
                        placeholder="Enter room password or PIN"
                        className="uiverse-input-field text-[#ffb700]"
                        required={enablePassword}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1.5 px-2">
                      Anyone joining will need to enter this password.
                    </p>
                  </div>
                )}
              </div>

              {/* Room Permissions & Settings Section */}
              <div className="p-3.5 bg-[#121212] rounded-[20px] border border-[#252525] space-y-3">
                <button
                  type="button"
                  onClick={() => setShowPermissions(!showPermissions)}
                  className="w-full flex items-center justify-between text-xs font-bold text-zinc-200 focus:outline-none"
                >
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-[#00f0ff]" />
                    <span>Room Permissions & Rules</span>
                  </div>
                  {showPermissions ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                </button>

                {showPermissions && (
                  <div className="space-y-2.5 pt-2 border-t border-[#222222] animate-fade-in">
                    {/* Announcement Mode */}
                    <div className="flex items-center justify-between py-1">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-zinc-300 block">Announcement Mode</span>
                        <span className="text-[10px] text-zinc-500 block">Only host can send chat messages</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={onlyHostCanPost}
                        onChange={(e) => setOnlyHostCanPost(e.target.checked)}
                        className="w-4 h-4 accent-[#00f0ff] cursor-pointer shrink-0"
                      />
                    </div>

                    {/* File Uploads */}
                    <div className="flex items-center justify-between py-1 border-t border-[#1e1e1e]">
                      <div className="flex items-center space-x-2">
                        <Upload className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs font-semibold text-zinc-300">Allow File Sharing</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowFileUploads}
                        onChange={(e) => setAllowFileUploads(e.target.checked)}
                        className="w-4 h-4 accent-cyan-400 cursor-pointer shrink-0"
                      />
                    </div>

                    {/* Calls */}
                    <div className="flex items-center justify-between py-1 border-t border-[#1e1e1e]">
                      <div className="flex items-center space-x-2">
                        <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-xs font-semibold text-zinc-300">Allow Audio / Video Calls</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowCalls}
                        onChange={(e) => setAllowCalls(e.target.checked)}
                        className="w-4 h-4 accent-[#00f0ff] cursor-pointer shrink-0"
                      />
                    </div>

                    {/* Voice Notes */}
                    <div className="flex items-center justify-between py-1 border-t border-[#1e1e1e]">
                      <div className="flex items-center space-x-2">
                        <Mic className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-semibold text-zinc-300">Allow Voice Notes</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowVoiceNotes}
                        onChange={(e) => setAllowVoiceNotes(e.target.checked)}
                        className="w-4 h-4 accent-[#ffb700] cursor-pointer shrink-0"
                      />
                    </div>

                    {/* Max Capacity */}
                    <div className="pt-1.5 border-t border-[#1e1e1e] flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Users className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-xs font-semibold text-zinc-300">Max Member Capacity</span>
                      </div>
                      <select
                        value={maxUsers}
                        onChange={(e) => setMaxUsers(e.target.value)}
                        className="bg-[#1e1e1e] border border-[#2c2c2c] text-zinc-200 text-xs rounded-lg px-2 py-1 font-mono focus:outline-none focus:border-[#00f0ff]"
                      >
                        <option value="5">5 Members</option>
                        <option value="10">10 Members</option>
                        <option value="25">25 Members</option>
                        <option value="50">50 Members</option>
                        <option value="100">100 Members</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Uiverse Action Button */}
              <div className="uiverse-btn-row">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="uiverse-button1 w-full flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <span>{isCreating ? 'Creating Room...' : 'Create & Join Room'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleJoinSubmit} className="uiverse-form">
              <h2 className="uiverse-heading flex items-center justify-center space-x-2">
                <LogIn className="w-5 h-5 text-[#00f0ff]" />
                <span>Join Existing Room</span>
              </h2>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5 px-2">
                  Room ID
                </label>
                <div className="uiverse-field">
                  <LogIn className="uiverse-input-icon text-[#00f0ff]" />
                  <input
                    type="text"
                    value={joinId}
                    onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                    placeholder="Enter Room ID"
                    className="uiverse-input-field text-[#00f0ff] font-bold uppercase"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5 px-2">
                  Password (if required)
                </label>
                <div className="uiverse-field">
                  <KeyRound className="uiverse-input-icon text-zinc-400" />
                  <input
                    type="password"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="Leave blank if no password"
                    className="uiverse-input-field"
                  />
                </div>
              </div>

              <div className="uiverse-btn-row">
                <button
                  type="submit"
                  className="uiverse-button2 w-full flex items-center justify-center space-x-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Join Room</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
