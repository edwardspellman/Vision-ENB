import React, { useState, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Download, 
  FileText, 
  Smile, 
  Check, 
  Copy, 
  ExternalLink 
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { getAvatarSvg } from '../utils/avatar';

const POPULAR_EMOJIS = ['👍', '❤️', '🔥', '😂', '🎉', '🚀', '👀'];

export default function MessageItem({ message, onImageClick }) {
  const { user, toggleReaction } = useSocket();
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [mediaExpired, setMediaExpired] = useState(false);
  const audioRef = useRef(null);

  const isMe = message.sender?.id === user.id || message.sender?.name === user.name;
  const isSystem = message.type === 'system';

  const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleToggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleCopyCode = (codeText) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // System Message (Aligned to Left)
  if (isSystem) {
    return (
      <div className="flex items-center space-x-2 my-1.5 py-0.5 px-2 text-xs text-zinc-400 font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
        <span>{message.text}</span>
        <span className="text-[10px] text-zinc-500">({formatTime(message.timestamp)})</span>
      </div>
    );
  }

  // Render text with code block / link detection
  const renderMessageContent = (text) => {
    if (!text) return null;

    if (text.startsWith('```') && text.endsWith('```')) {
      const codeContent = text.slice(3, -3).trim();
      return (
        <div className="my-1.5 rounded-lg bg-[#030508] border border-[#161f30] p-3 font-mono text-xs overflow-x-auto text-[#00ff88] relative group">
          <button
            onClick={() => handleCopyCode(codeContent)}
            className="absolute top-2 right-2 p-1 rounded bg-[#0b101c] hover:bg-[#161f30] text-zinc-400 opacity-0 group-hover:opacity-100 transition"
            title="Copy code"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-[#00ff88]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <pre className="whitespace-pre-wrap">{codeContent}</pre>
        </div>
      );
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#00f0ff] hover:underline break-all inline-flex items-center space-x-0.5"
          >
            <span>{part}</span>
            <ExternalLink className="w-3 h-3 inline ml-0.5" />
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div className={`flex items-start space-x-3 group my-2.5 font-mono ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
      {/* Sender Avatar */}
      <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#1a2337] shrink-0 mt-0.5">
        <img
          src={getAvatarSvg(message.sender?.avatar || message.sender?.name || 'user')}
          alt={message.sender?.name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Message Bubble Container */}
      <div className={`max-w-[85%] sm:max-w-[75%] md:max-w-[65%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        {/* Sender Name & Time */}
        <div className={`flex items-center space-x-2 text-[11px] mb-1 px-1 text-zinc-500 ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
          <span className="font-semibold text-zinc-300">
            {isMe ? 'You' : message.sender?.name}
          </span>
          <span className="text-zinc-500">{formatTime(message.timestamp)}</span>
        </div>

        {/* Message Bubble */}
        <div
          className={`relative p-3 rounded-xl text-xs leading-relaxed border transition ${
            isMe
              ? 'bg-[#0d1524] text-zinc-100 border-[#1d3557] rounded-tr-none'
              : 'bg-[#080d17] text-zinc-200 border-[#151f33] rounded-tl-none'
          }`}
        >
          {/* Text Content */}
          {message.type === 'text' && (
            <div className="whitespace-pre-wrap break-words">{renderMessageContent(message.text)}</div>
          )}

          {/* Image Content */}
          {message.type === 'image' && (
            <div className="space-y-1.5">
              {mediaExpired ? (
                <div className="p-3 rounded-lg bg-[#04060a] border border-[#161f30] text-zinc-500 text-xs font-mono">
                  <span>⏱️ File expired (30m Ephemeral Purge)</span>
                </div>
              ) : (
                <div 
                  onClick={() => onImageClick && onImageClick(message.fileUrl)}
                  className="rounded-lg overflow-hidden cursor-pointer max-w-sm max-h-72 border border-[#161f30] hover:border-[#00ff88]/50 transition"
                >
                  <img
                    src={message.fileUrl}
                    alt={message.fileName || 'Shared Image'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={() => setMediaExpired(true)}
                  />
                </div>
              )}
              {message.text && (
                <p className="text-xs text-zinc-400 mt-1">{message.text}</p>
              )}
            </div>
          )}

          {/* Voice Note */}
          {message.type === 'audio' && (
            mediaExpired ? (
              <div className="py-1 px-2 text-zinc-500 text-xs font-mono">
                <span>⏱️ Audio expired (30m Ephemeral Purge)</span>
              </div>
            ) : (
              <div className="flex items-center space-x-3 py-1 pr-2 min-w-[210px]">
                <button
                  onClick={handleToggleAudio}
                  className="w-8 h-8 rounded-lg bg-[#00ff88]/10 hover:bg-[#00ff88]/20 border border-[#00ff88]/40 text-[#00ff88] flex items-center justify-center transition shrink-0"
                >
                  {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>

                <audio
                  ref={audioRef}
                  src={message.fileUrl}
                  onEnded={() => setIsPlayingAudio(false)}
                  onError={() => setMediaExpired(true)}
                  className="hidden"
                />

                {/* Audio Wave Bars */}
                <div className="flex-1 flex items-center space-x-1 h-5">
                  {[8, 14, 6, 18, 12, 8, 16, 10, 14, 6, 10].map((h, i) => (
                    <div
                      key={i}
                      style={{ height: `${isPlayingAudio ? h : 4}px` }}
                      className={`w-1 rounded-sm transition-all duration-300 ${
                        isPlayingAudio ? 'bg-[#00ff88]' : 'bg-[#1e293b]'
                      }`}
                    />
                  ))}
                </div>

                <span className="text-[11px] text-zinc-400 shrink-0 font-mono">
                  {message.audioDuration ? `${Math.round(message.audioDuration)}s` : 'Voice'}
                </span>
              </div>
            )
          )}

          {/* Video Content */}
          {message.type === 'video' && (
            <div className="space-y-1.5">
              {mediaExpired ? (
                <div className="p-3 rounded-lg bg-[#04060a] border border-[#161f30] text-zinc-500 text-xs font-mono">
                  <span>⏱️ Video expired (30m Ephemeral Purge)</span>
                </div>
              ) : (
                <div className="rounded-lg overflow-hidden max-w-sm border border-[#161f30] bg-[#020408]">
                  <video
                    src={message.fileUrl}
                    controls
                    preload="metadata"
                    onError={() => setMediaExpired(true)}
                    className="w-full max-h-72 rounded-lg object-contain"
                  />
                  {message.fileName && (
                    <div className="p-2 flex items-center justify-between text-[11px] text-zinc-400 bg-[#05080f] border-t border-[#161f30]">
                      <span className="truncate max-w-[200px] font-semibold">{message.fileName}</span>
                      <a
                        href={message.fileUrl}
                        download={message.fileName || 'video'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#00ff88] hover:underline flex items-center space-x-1 shrink-0 ml-2"
                      >
                        <Download className="w-3 h-3" />
                        <span>Save</span>
                      </a>
                    </div>
                  )}
                </div>
              )}
              {message.text && (
                <p className="text-xs text-zinc-400 mt-1">{message.text}</p>
              )}
            </div>
          )}

          {/* File Attachment */}
          {message.type === 'file' && (
            <a
              href={message.fileUrl}
              download={message.fileName || 'file'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-3 p-2 rounded-lg bg-[#04060a] hover:bg-[#090e1a] border border-[#161f30] transition text-zinc-200"
            >
              <div className="p-2 rounded-lg bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate text-zinc-200">{message.fileName}</p>
                <p className="text-[10px] text-zinc-500">{formatBytes(message.fileSize)}</p>
              </div>
              <Download className="w-4 h-4 text-zinc-400 shrink-0" />
            </a>
          )}

          {/* Reactions */}
          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(message.reactions).map(([emoji, users]) => {
                const hasReacted = users.includes(user.name);
                return (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(message.id, emoji)}
                    className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs border transition ${
                      hasReacted
                        ? 'bg-[#00ff88]/10 border-[#00ff88]/40 text-[#00ff88]'
                        : 'bg-[#05080f] border-[#161f30] text-zinc-400 hover:text-zinc-200'
                    }`}
                    title={users.join(', ')}
                  >
                    <span>{emoji}</span>
                    <span className="text-[10px]">{users.length}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Hover Quick Reaction Trigger */}
        <div className="relative mt-0.5 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1 text-zinc-500 hover:text-[#00ff88] transition"
            title="Add reaction"
          >
            <Smile className="w-3.5 h-3.5" />
          </button>

          {showEmojiPicker && (
            <div className={`absolute bottom-full mb-1 z-30 flex items-center space-x-1 p-1 bg-[#05080f] border border-[#1a263d] rounded-full shadow-2xl ${isMe ? 'right-0' : 'left-0'}`}>
              {POPULAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    toggleReaction(message.id, emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="p-1 hover:scale-125 transition text-sm"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
