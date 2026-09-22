import React, { useEffect, useRef, useState } from 'react';
import { 
  Wifi, 
  Lock, 
  Share2, 
  PlusCircle, 
  User, 
  Settings, 
  ChevronDown, 
  Upload,
  Menu
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { getBackendUrl } from '../utils/config';
import MessageItem from './MessageItem';

export default function ChatArea({ 
  onOpenShareModal, 
  onOpenRoomModal, 
  onOpenProfileModal, 
  onOpenRoomSettingsModal, 
  onImageClick,
  onToggleSidebar
}) {
  const { currentRoom, messages, typingUsers, sendMessage, isHost } = useSocket();
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, typingUsers]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 150;
    setShowScrollBottom(isUp);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch(`${getBackendUrl()}/api/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        if (data.success) {
          sendMessage({
            text: '',
            type: data.type,
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileSize: data.fileSize
          });
        }
      } catch (err) {
        console.error('File drop error:', err);
      }
    }
  };

  return (
    <div
      className="flex-1 flex flex-col min-w-0 bg-[#030508] relative overflow-hidden font-mono select-none"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* File Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-30 bg-black/90 border-2 border-dashed border-[#00ff88] m-4 rounded-2xl flex flex-col items-center justify-center text-center p-6 pointer-events-none animate-fade-in">
          <Upload className="w-12 h-12 text-[#00ff88] mb-2 animate-bounce" />
          <h3 className="text-sm font-bold text-[#00ff88]">Drop files to share</h3>
          <p className="text-xs text-zinc-400 mt-1">Images, audio notes, and documents will be shared instantly</p>
        </div>
      )}

      {/* Messages Feed */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-8 py-5 space-y-1"
      >
        {/* Welcome Banner */}
        <div className="max-w-xl mx-auto my-5 p-5 sm:p-6 rounded-2xl bg-[#080d17] border border-[#161f30] text-center shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#00ff88]/5 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#00f0ff]/5 rounded-full blur-2xl pointer-events-none" />

          <div className="w-11 h-11 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] mx-auto flex items-center justify-center mb-3 shadow-inner">
            {currentRoom?.hasPassword ? (
              <Lock className="w-5 h-5 text-[#ffb700]" />
            ) : (
              <Wifi className="w-5 h-5 text-[#00ff88]" />
            )}
          </div>

          <h2 className="text-base font-extrabold text-white mb-1 tracking-wide">
            Welcome to {currentRoom?.isCustom ? currentRoom.name : 'Local Network'}
          </h2>
          
          <p className="text-xs text-zinc-400 mb-4 max-w-md mx-auto leading-relaxed">
            {currentRoom?.isCustom 
              ? 'This is a private room. Share the Room ID or QR code with peers to connect.'
              : 'You are connected to your local network subnet. Anyone on the same Wi-Fi joins automatically.'}
          </p>

          {/* Quick Action Buttons Suite */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 pt-3 border-t border-[#161f30]/80">
            {/* 1. Share */}
            <button
              onClick={onOpenShareModal}
              className="flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl bg-[#00ff88]/10 hover:bg-[#00ff88]/20 border border-[#00ff88]/30 text-[#00ff88] text-xs font-bold transition-all transform active:scale-95 shadow-md group/btn"
              title="Share Room link & QR Code"
            >
              <Share2 className="w-4 h-4 shrink-0 group-hover/btn:scale-110 transition-transform text-[#00ff88]" />
              <span className="truncate">Share</span>
            </button>

            {/* 2. Create Room */}
            <button
              onClick={() => onOpenRoomModal && onOpenRoomModal('create')}
              className="flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 border border-[#00f0ff]/30 text-[#00f0ff] text-xs font-bold transition-all transform active:scale-95 shadow-md group/btn"
              title="Join an existing room or create a new room"
            >
              <PlusCircle className="w-4 h-4 shrink-0 group-hover/btn:rotate-90 transition-transform text-[#00f0ff]" />
              <span className="truncate">Create Room</span>
            </button>

            {/* 3. Menu (Mobile Android & iOS Only) */}
            <button
              onClick={onToggleSidebar}
              className="md:hidden flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 border border-[#00f0ff]/30 text-[#00f0ff] text-xs font-bold transition-all transform active:scale-95 shadow-md group/btn"
              title="Open Navigation & Member Menu"
            >
              <Menu className="w-4 h-4 shrink-0 group-hover/btn:scale-110 transition-transform text-[#00f0ff]" />
              <span className="truncate">Menu</span>
            </button>

            {/* 4. Setting/Profile */}
            {isHost ? (
              <button
                onClick={onOpenRoomSettingsModal}
                className="flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl bg-[#00ff88]/10 hover:bg-[#00ff88]/20 border border-[#00ff88]/30 text-[#00ff88] text-xs font-bold transition-all transform active:scale-95 shadow-md group/btn"
                title="Room Settings & Governance"
              >
                <Settings className="w-4 h-4 shrink-0 group-hover/btn:rotate-45 transition-transform text-[#00ff88]" />
                <span className="truncate">Setting</span>
              </button>
            ) : (
              <button
                onClick={onOpenProfileModal}
                className="flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl bg-[#00ff88]/10 hover:bg-[#00ff88]/20 border border-[#00ff88]/30 text-[#00ff88] text-xs font-bold transition-all transform active:scale-95 shadow-md group/btn"
                title="Edit avatar & display profile"
              >
                <User className="w-4 h-4 shrink-0 group-hover/btn:scale-110 transition-transform text-[#00ff88]" />
                <span className="truncate">Profile</span>
              </button>
            )}
          </div>
        </div>

        {/* Message Stream */}
        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            onImageClick={onImageClick}
          />
        ))}

        {/* Live Typing */}
        {typingUsers.length > 0 && (
          <div className="flex items-center space-x-2 py-1.5 text-xs text-[#00ff88] animate-pulse">
            <div className="flex space-x-1">
              <span className="w-1.5 h-1.5 bg-[#00ff88] rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-[#00ff88] rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-[#00ff88] rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
            <span>
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll-to-Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-4 right-6 p-2.5 bg-[#0a0e17] hover:bg-[#121826] text-[#00ff88] border border-[#1c283f] rounded-full shadow-xl transition z-20"
          title="Jump to latest messages"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
