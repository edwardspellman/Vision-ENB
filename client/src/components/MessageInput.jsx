import React, { useState, useRef, useEffect } from 'react';
import { getBackendUrl } from '../utils/config';
import { 
  Send, 
  Paperclip, 
  Smile, 
  Mic, 
  Loader2, 
  X,
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
  LogOut,
  Clock,
  Zap
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
  setSoundMuted,
  currentGuild,
  onSendGuildMessage
}) {
  const { sendMessage, setTyping, currentRoom, isHost, leaveRoom } = useSocket();
  const [text, setText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPlatformMenu, setShowPlatformMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Host/Admin Expiry Control (30m default, 60m, 1440m, 10080m, -1 for Never)
  const [expiryMinutes, setExpiryMinutes] = useState(30);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const platformMenuRef = useRef(null);
  const expiryPickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
      if (platformMenuRef.current && !platformMenuRef.current.contains(e.target)) {
        setShowPlatformMenu(false);
      }
      if (expiryPickerRef.current && !expiryPickerRef.current.contains(e.target)) {
        setShowExpiryPicker(false);
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
          if (currentGuild && onSendGuildMessage) {
            onSendGuildMessage({
              text: text.trim(),
              type: data.type,
              fileUrl: data.fileUrl,
              fileName: data.fileName,
              fileSize: data.fileSize,
              expiryMinutes
            });
          } else {
            sendMessage({
              text: text.trim(),
              type: data.type,
              fileUrl: data.fileUrl,
              fileName: data.fileName,
              fileSize: data.fileSize
            });
          }
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

    if (currentGuild && onSendGuildMessage) {
      onSendGuildMessage({
        text: text.trim(),
        type: 'text',
        expiryMinutes
      });
    } else {
      sendMessage({ text: text.trim(), type: 'text' });
    }

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
            if (currentGuild && onSendGuildMessage) {
              onSendGuildMessage({
                ...audioData,
                text: '',
                type: 'audio',
                expiryMinutes
              });
            } else {
              sendMessage({
                ...audioData,
                text: '',
                type: 'audio'
              });
            }
            setIsRecordingVoice(false);
          }}
          onCancel={() => setIsRecordingVoice(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 bg-[#05080f] border-t border-[#161f30] shrink-0 relative font-mono select-none">
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

      {/* Host/Admin Expiry Selector Popover */}
      {showExpiryPicker && (
        <div
          ref={expiryPickerRef}
          className="absolute bottom-full right-16 mb-2 bg-[#080d17] border border-[#1a263d] rounded-xl p-2 z-50 shadow-2xl w-44 text-xs font-semibold space-y-1 animate-fade-in"
        >
          <div className="px-2 py-1 text-[10px] text-zinc-400 font-bold border-b border-[#161f30]">
            Set Message Lifetime:
          </div>
          <button
            type="button"
            onClick={() => { setExpiryMinutes(30); setShowExpiryPicker(false); }}
            className={`w-full text-left px-2 py-1.5 rounded-lg transition ${expiryMinutes === 30 ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'text-zinc-300 hover:bg-[#111827]'}`}
          >
            ⏱️ 30 Minutes (Default)
          </button>
          <button
            type="button"
            onClick={() => { setExpiryMinutes(60); setShowExpiryPicker(false); }}
            className={`w-full text-left px-2 py-1.5 rounded-lg transition ${expiryMinutes === 60 ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'text-zinc-300 hover:bg-[#111827]'}`}
          >
            ⌛ 1 Hour
          </button>
          <button
            type="button"
            onClick={() => { setExpiryMinutes(1440); setShowExpiryPicker(false); }}
            className={`w-full text-left px-2 py-1.5 rounded-lg transition ${expiryMinutes === 1440 ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'text-zinc-300 hover:bg-[#111827]'}`}
          >
            📅 24 Hours
          </button>
          <button
            type="button"
            onClick={() => { setExpiryMinutes(10080); setShowExpiryPicker(false); }}
            className={`w-full text-left px-2 py-1.5 rounded-lg transition ${expiryMinutes === 10080 ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'text-zinc-300 hover:bg-[#111827]'}`}
          >
            🗓️ 7 Days
          </button>
          <button
            type="button"
            onClick={() => { setExpiryMinutes(-1); setShowExpiryPicker(false); }}
            className={`w-full text-left px-2 py-1.5 rounded-lg transition ${expiryMinutes === -1 ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-300 hover:bg-[#111827]'}`}
          >
            📌 Permanent / Never
          </button>
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
            placeholder={currentGuild ? `Message ${currentGuild.name}...` : "Type a message or paste code..."}
            className="w-full bg-transparent text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none resize-none max-h-24 overflow-y-auto font-mono"
          />
        </div>

        {/* Action Controls (Right) */}
        <div className="flex items-center space-x-1 pb-1">
          {/* Host/Admin Expiry Selector Button */}
          {isHost && (
            <button
              type="button"
              onClick={() => setShowExpiryPicker(!showExpiryPicker)}
              className={`p-2 rounded-xl border transition ${
                expiryMinutes === -1 
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' 
                  : 'bg-[#080d17] border-[#161f30] text-zinc-400 hover:text-[#00ff88]'
              }`}
              title={`Message Expiry: ${expiryMinutes === -1 ? 'Never / Pinned' : expiryMinutes + 'm'}`}
            >
              <Clock className="w-4 h-4" />
            </button>
          )}

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
