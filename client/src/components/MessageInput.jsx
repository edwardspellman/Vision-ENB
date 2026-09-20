import React, { useState, useRef, useEffect } from 'react';
import { getBackendUrl } from '../utils/config';
import { 
  Send, 
  Paperclip, 
  Smile, 
  Mic, 
  Loader2, 
  X,
  CornerDownLeft,
  Lock,
  Menu,
  Share2,
  Plus,
  LogIn,
  Settings,
  User,
  Users,
  Volume2,
  VolumeX,
  LogOut
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { sound } from '../utils/sound';
import VoiceRecorder from './VoiceRecorder';

const EMOJI_LIST = [
  '😀', '😂', '😍', '🔥', '👍', '🎉', '🚀', '❤️', '👀', '💯',
  '😎', '🥳', '🤔', '🙌', '✨', '⚡', '💀', '🛡️', '🎯', '✅'
];

export default function MessageInput({
  onOpenShareModal,
  onOpenRoomModal,
  onOpenProfileModal,
  onOpenRoomSettingsModal,
  onToggleSidebar,
  soundMuted,
  setSoundMuted
}) {
  const { sendMessage, setTyping, currentRoom, isHost, leaveRoom } = useSocket();
  const [text, setText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPlatformMenu, setShowPlatformMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const platformMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
      if (platformMenuRef.current && !platformMenuRef.current.contains(e.target)) {
        setShowPlatformMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

    setTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 1500);
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();

    if (selectedFile) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      try {
        const res = await fetch(`${getBackendUrl()}/api/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        if (data.success) {
          sendMessage({
            text: text.trim(),
            type: data.type,
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileSize: data.fileSize
          });
          clearFileSelection();
          setText('');
        }
      } catch (err) {
        console.error('File upload error:', err);
        alert('File upload failed.');
      } finally {
        setIsUploading(false);
      }
      return;
    }

    if (!text.trim()) return;

    sendMessage({ text: text.trim(), type: 'text' });
    setText('');
    setTyping(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const clearFileSelection = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddEmoji = (emoji) => {
    setText((prev) => prev + emoji);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const onlyHostCanPost = currentRoom?.settings?.onlyHostCanPost && !isHost;
  const allowFileUploads = isHost || (currentRoom?.settings?.allowFileUploads ?? true);
  const allowVoiceNotes = isHost || (currentRoom?.settings?.allowVoiceNotes ?? true);

  if (onlyHostCanPost) {
    return (
      <div className="p-3.5 bg-[#05080f] border-t border-[#161f30] shrink-0 font-mono text-center select-none">
        <div className="inline-flex items-center space-x-2 px-4 py-2 bg-[#080d17] border border-[#00f0ff]/30 text-[#00f0ff] rounded-xl text-xs font-bold shadow-md">
          <Lock className="w-4 h-4 text-[#00f0ff]" />
          <span>Announcement Mode Active — Only Room Host Can Post Messages</span>
        </div>
      </div>
    );
  }

  if (isRecordingVoice) {
    return (
      <div className="p-3 bg-[#05080f] border-t border-[#161f30] shrink-0 font-mono">
        <VoiceRecorder
          onSendAudio={(audioData) => {
            sendMessage({
              ...audioData,
              text: '',
              type: 'audio'
            });
            setIsRecordingVoice(false);
          }}
          onCancel={() => setIsRecordingVoice(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 bg-[#05080f] border-t border-[#161f30] shrink-0 relative font-mono">
      {/* File Attachment Preview */}
      {selectedFile && (
        <div className="mb-2 p-2 bg-[#080d17] border border-[#1a263d] rounded-xl flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2.5 min-w-0">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="w-9 h-9 object-cover rounded-lg border border-[#161f30]" />
            ) : (
              <div className="p-2 rounded-lg bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30">
                <Paperclip className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-zinc-200 truncate">{selectedFile.name}</p>
              <p className="text-[10px] text-zinc-500 font-mono">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            onClick={clearFileSelection}
            className="p-1 text-zinc-400 hover:text-white rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji Popover */}
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          className="absolute bottom-full left-4 mb-2 p-2.5 bg-[#080d17] border border-[#1a263d] rounded-xl w-64 max-h-56 overflow-y-auto grid grid-cols-5 gap-1.5 z-40 shadow-2xl animate-fade-in"
        >
          {EMOJI_LIST.map((emoji, idx) => (
            <button
              key={idx}
              onClick={() => handleAddEmoji(emoji)}
              className="p-2 hover:bg-[#111827] rounded-lg text-lg flex items-center justify-center hover:scale-125 transition"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Platform Functions Menu Popover */}
      {showPlatformMenu && (
        <div
          ref={platformMenuRef}
          className="absolute bottom-full right-2 sm:right-4 mb-2 w-72 sm:w-80 bg-[#080d17]/95 backdrop-blur-md border border-[#1a263d] rounded-2xl shadow-2xl p-3 z-50 animate-fade-in font-mono select-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#161f30]">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 rounded-md bg-[#00ff88]/10 border border-[#00ff88]/30 flex items-center justify-center">
                <Menu className="w-3 h-3 text-[#00ff88]" />
              </div>
              <span className="text-xs font-bold text-white tracking-wide">Platform Functions</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPlatformMenu(false)}
              className="p-1 text-zinc-400 hover:text-white rounded-lg transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Access List */}
          <div className="grid grid-cols-2 gap-1.5 max-h-[320px] overflow-y-auto pr-0.5">
            {/* Share / QR */}
            <button
              type="button"
              onClick={() => {
                setShowPlatformMenu(false);
                onOpenShareModal && onOpenShareModal();
              }}
              className="flex items-center space-x-2 p-2 rounded-xl bg-[#0b1220] hover:bg-[#111c33] border border-[#162238] hover:border-[#00ff88]/40 text-left transition group"
            >
              <div className="p-1.5 rounded-lg bg-[#00ff88]/10 text-[#00ff88] group-hover:scale-110 transition-transform shrink-0">
                <Share2 className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-zinc-200 group-hover:text-[#00ff88] truncate">Share</p>
                <p className="text-[9px] text-zinc-500 truncate">QR & Invite</p>
              </div>
            </button>

            {/* Create Room */}
            <button
              type="button"
              onClick={() => {
                setShowPlatformMenu(false);
                onOpenRoomModal && onOpenRoomModal('create');
              }}
              className="flex items-center space-x-2 p-2 rounded-xl bg-[#0b1220] hover:bg-[#111c33] border border-[#162238] hover:border-[#00f0ff]/40 text-left transition group"
            >
              <div className="p-1.5 rounded-lg bg-[#00f0ff]/10 text-[#00f0ff] group-hover:scale-110 transition-transform shrink-0">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-zinc-200 group-hover:text-[#00f0ff] truncate">Create Room</p>
                <p className="text-[9px] text-zinc-500 truncate">New room</p>
              </div>
            </button>

            {/* Join Room */}
            <button
              type="button"
              onClick={() => {
                setShowPlatformMenu(false);
                onOpenRoomModal && onOpenRoomModal('join');
              }}
              className="flex items-center space-x-2 p-2 rounded-xl bg-[#0b1220] hover:bg-[#111c33] border border-[#162238] hover:border-cyan-400/40 text-left transition group"
            >
              <div className="p-1.5 rounded-lg bg-cyan-400/10 text-cyan-400 group-hover:scale-110 transition-transform shrink-0">
                <LogIn className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-zinc-200 group-hover:text-cyan-400 truncate">Join Room</p>
                <p className="text-[9px] text-zinc-500 truncate">Enter ID</p>
              </div>
            </button>

            {/* Room Settings (Host Only) */}
            {isHost && (
              <button
                type="button"
                onClick={() => {
                  setShowPlatformMenu(false);
                  onOpenRoomSettingsModal && onOpenRoomSettingsModal();
                }}
                className="flex items-center space-x-2 p-2 rounded-xl bg-[#0b1220] hover:bg-[#111c33] border border-[#162238] hover:border-[#00ff88]/40 text-left transition group"
              >
                <div className="p-1.5 rounded-lg bg-[#00ff88]/10 text-[#00ff88] group-hover:rotate-45 transition-transform shrink-0">
                  <Settings className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-zinc-200 group-hover:text-[#00ff88] truncate">Setting</p>
                  <p className="text-[9px] text-zinc-500 truncate">Host control</p>
                </div>
              </button>
            )}

            {/* Profile */}
            <button
              type="button"
              onClick={() => {
                setShowPlatformMenu(false);
                onOpenProfileModal && onOpenProfileModal();
              }}
              className="flex items-center space-x-2 p-2 rounded-xl bg-[#0b1220] hover:bg-[#111c33] border border-[#162238] hover:border-[#00ff88]/40 text-left transition group"
            >
              <div className="p-1.5 rounded-lg bg-[#00ff88]/10 text-[#00ff88] group-hover:scale-110 transition-transform shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-zinc-200 group-hover:text-[#00ff88] truncate">Profile</p>
                <p className="text-[9px] text-zinc-500 truncate">Avatar & name</p>
              </div>
            </button>

            {/* Members & Calls */}
            <button
              type="button"
              onClick={() => {
                setShowPlatformMenu(false);
                onToggleSidebar && onToggleSidebar();
              }}
              className="flex items-center space-x-2 p-2 rounded-xl bg-[#0b1220] hover:bg-[#111c33] border border-[#162238] hover:border-violet-400/40 text-left transition group"
            >
              <div className="p-1.5 rounded-lg bg-violet-400/10 text-violet-400 group-hover:scale-110 transition-transform shrink-0">
                <Users className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-zinc-200 group-hover:text-violet-400 truncate">Members</p>
                <p className="text-[9px] text-zinc-500 truncate">Calls & users</p>
              </div>
            </button>

            {/* Attach File */}
            {allowFileUploads && (
              <button
                type="button"
                onClick={() => {
                  setShowPlatformMenu(false);
                  fileInputRef.current?.click();
                }}
                className="flex items-center space-x-2 p-2 rounded-xl bg-[#0b1220] hover:bg-[#111c33] border border-[#162238] hover:border-emerald-400/40 text-left transition group"
              >
                <div className="p-1.5 rounded-lg bg-emerald-400/10 text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
                  <Paperclip className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-zinc-200 group-hover:text-emerald-400 truncate">Send File</p>
                  <p className="text-[9px] text-zinc-500 truncate">Upload doc</p>
                </div>
              </button>
            )}

            {/* Voice Note */}
            {allowVoiceNotes && (
              <button
                type="button"
                onClick={() => {
                  setShowPlatformMenu(false);
                  setIsRecordingVoice(true);
                }}
                className="flex items-center space-x-2 p-2 rounded-xl bg-[#0b1220] hover:bg-[#111c33] border border-[#162238] hover:border-rose-400/40 text-left transition group"
              >
                <div className="p-1.5 rounded-lg bg-rose-400/10 text-rose-400 group-hover:scale-110 transition-transform shrink-0">
                  <Mic className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-zinc-200 group-hover:text-rose-400 truncate">Voice Note</p>
                  <p className="text-[9px] text-zinc-500 truncate">Record audio</p>
                </div>
              </button>
            )}

            {/* Sound FX Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !soundMuted;
                setSoundMuted && setSoundMuted(next);
                sound.setMuted(next);
              }}
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

            {/* Leave Room (Custom Room only) */}
            {currentRoom?.isCustom && (
              <button
                type="button"
                onClick={() => {
                  setShowPlatformMenu(false);
                  leaveRoom();
                }}
                className="flex items-center space-x-2 p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-left transition group"
              >
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 group-hover:-translate-x-0.5 transition-transform shrink-0">
                  <LogOut className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-rose-400 truncate">Leave</p>
                  <p className="text-[9px] text-rose-500/80 truncate">Back to Wi-Fi</p>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Input Row */}
      <form onSubmit={handleSend} className="flex items-end space-x-2">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip,.txt,.json,.js,.py,.rs"
        />

        {/* Action Controls (Left) */}
        <div className="flex items-center space-x-1 pb-1">
          {allowFileUploads && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-zinc-400 hover:text-[#00f0ff] rounded-xl bg-[#080d17] border border-[#161f30] hover:border-[#00f0ff]/40 transition"
              title="Attach file or image"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-zinc-400 hover:text-[#ffb700] rounded-xl bg-[#080d17] border border-[#161f30] hover:border-[#ffb700]/40 transition"
            title="Add emoji"
          >
            <Smile className="w-4 h-4" />
          </button>
        </div>

        {/* Text Input Box */}
        <div className="flex-1 bg-[#080d17] border border-[#1a263d] focus-within:border-[#00ff88] rounded-xl px-3.5 py-2.5 transition">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Type a message or paste a code snippet..."
            className="w-full bg-transparent text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none resize-none max-h-24 overflow-y-auto font-mono"
          />
        </div>

        {/* Action Controls (Right) */}
        <div className="flex items-center space-x-1 pb-1">
          {/* Small Bar Icon on bottom side of mic button to access every function of platform */}
          <button
            type="button"
            onClick={() => setShowPlatformMenu(!showPlatformMenu)}
            className={`p-2 rounded-xl border transition ${
              showPlatformMenu
                ? 'bg-[#00ff88]/20 border-[#00ff88] text-[#00ff88]'
                : 'bg-[#080d17] border-[#161f30] text-zinc-400 hover:text-[#00ff88] hover:border-[#00ff88]/40'
            }`}
            title="All Platform Functions"
            aria-label="Platform functions menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          {!text.trim() && !selectedFile ? (
            allowVoiceNotes && (
              <button
                type="button"
                onClick={() => setIsRecordingVoice(true)}
                className="p-2 text-zinc-400 hover:text-[#ff3366] rounded-xl bg-[#080d17] border border-[#161f30] hover:border-[#ff3366]/40 transition"
                title="Record voice note"
              >
                <Mic className="w-4 h-4" />
              </button>
            )
          ) : (
            <button
              type="submit"
              disabled={isUploading}
              className="p-2 bg-[#00ff88] hover:bg-[#00e67a] text-black font-bold rounded-xl transition shadow-md flex items-center justify-center disabled:opacity-50"
              title="Send"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
