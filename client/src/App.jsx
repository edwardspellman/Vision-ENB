import React, { useState, useEffect } from 'react';
import { SocketProvider, useSocket } from './context/SocketContext';
import { WebRTCProvider } from './context/WebRTCContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import MessageInput from './components/MessageInput';
import RoomModal from './components/RoomModal';
import ShareModal from './components/ShareModal';
import PasswordModal from './components/PasswordModal';
import SettingsModal from './components/SettingsModal';
import VideoCallModal from './components/VideoCallModal';
import ImageLightbox from './components/ImageLightbox';
import InitialLoader from './components/InitialLoader';
import AuthModal from './components/AuthModal';
import ProfileSetupModal from './components/ProfileSetupModal';
import RoomSettingsModal from './components/RoomSettingsModal';
import GuildModal from './components/GuildModal';
import WatchPartyModal from './components/WatchPartyModal';

function MainApp() {
  const { socket, connected, currentRoom, isAuthenticated, showProfileSetup } = useSocket();
  const [showSplash, setShowSplash] = useState(true);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [roomModalTab, setRoomModalTab] = useState('create');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isRoomSettingsModalOpen, setIsRoomSettingsModalOpen] = useState(false);
  const [isGuildModalOpen, setIsGuildModalOpen] = useState(false);
  const [isWatchPartyModalOpen, setIsWatchPartyModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  
  // Permanent Guilds State & Persistence
  const [joinedGuilds, setJoinedGuilds] = useState(() => {
    try {
      const saved = localStorage.getItem('vision_joined_guilds');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [currentGuild, setCurrentGuild] = useState(null);

  const [soundMuted, setSoundMuted] = useState(() => {
    return localStorage.getItem('vision_sound_muted') === 'true';
  });

  // Fetch Joined Guilds Data on Connect
  useEffect(() => {
    if (!socket || !connected) return;

    const guildIds = joinedGuilds.map((g) => g.id);
    if (guildIds.length > 0) {
      socket.emit('get_my_guilds', { guildIds }, (res) => {
        if (res.success && Array.isArray(res.guilds)) {
          setJoinedGuilds(res.guilds);
          try {
            localStorage.setItem('vision_joined_guilds', JSON.stringify(res.guilds));
          } catch (e) {
            console.warn('LocalStorage save error:', e);
          }
        }
      });
    }

    // Guild Socket Listeners
    socket.on('new_guild_message', ({ guildId, message }) => {
      setJoinedGuilds((prev) => prev.map((g) => {
        if (g.id === guildId) {
          return {
            ...g,
            messages: [...(g.messages || []), message]
          };
        }
        return g;
      }));

      if (currentGuild && currentGuild.id === guildId) {
        setCurrentGuild((prev) => prev ? {
          ...prev,
          messages: [...(prev.messages || []), message]
        } : null);
      }
    });

    socket.on('guild_updated', (updatedGuild) => {
      setJoinedGuilds((prev) => prev.map((g) => g.id === updatedGuild.id ? updatedGuild : g));
      if (currentGuild && currentGuild.id === updatedGuild.id) {
        setCurrentGuild(updatedGuild);
      }
    });

    return () => {
      socket.off('new_guild_message');
      socket.off('guild_updated');
    };
  }, [socket, connected]);

  // Save joined guilds to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('vision_joined_guilds', JSON.stringify(joinedGuilds));
    } catch (e) {
      console.warn(e);
    }
  }, [joinedGuilds]);

  // Prompt Room Gateway if no room or guild
  useEffect(() => {
    if (!showSplash && isAuthenticated && !currentRoom && !currentGuild) {
      setIsRoomModalOpen(true);
    }
  }, [showSplash, isAuthenticated, currentRoom, currentGuild]);

  const handleOpenRoomModal = (tab = 'create') => {
    setRoomModalTab(tab);
    setIsRoomModalOpen(true);
  };

  const handleSelectGuild = (guild) => {
    setCurrentGuild(guild);
    if (guild && !joinedGuilds.some((g) => g.id === guild.id)) {
      setJoinedGuilds((prev) => [...prev, guild]);
    }
  };

  const handleSendGuildMessage = (msgData) => {
    if (!currentGuild || !socket) return;
    socket.emit('send_guild_message', {
      guildId: currentGuild.id,
      ...msgData
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#04060a] text-zinc-300 overflow-hidden font-mono antialiased">
      {/* 1. Initial Wormhole Splash Screen */}
      {showSplash && (
        <InitialLoader
          isReady={connected}
          onFinish={() => setShowSplash(false)}
        />
      )}

      {/* 2. Authentication Gateway */}
      {!showSplash && !isAuthenticated && (
        <AuthModal />
      )}

      {/* 3. Post-Login Profile Setup Pop-up */}
      {!showSplash && isAuthenticated && showProfileSetup && (
        <ProfileSetupModal />
      )}

      {/* Top Header Navigation */}
      <Header
        onOpenRoomModal={() => handleOpenRoomModal('create')}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenRoomSettingsModal={() => setIsRoomSettingsModalOpen(true)}
        onOpenGuildModal={() => setIsGuildModalOpen(true)}
        onOpenWatchPartyModal={() => setIsWatchPartyModalOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        soundMuted={soundMuted}
        setSoundMuted={setSoundMuted}
        currentGuild={currentGuild}
      />

      {/* Main Terminal Chat & Peer Grid */}
      <div className="flex-1 flex min-h-0 relative">
        <main className="flex-1 flex flex-col min-w-0 h-full relative">
          <ChatArea
            onOpenShareModal={() => setIsShareModalOpen(true)}
            onOpenRoomModal={(tab) => handleOpenRoomModal(tab)}
            onOpenProfileModal={() => setIsSettingsModalOpen(true)}
            onOpenRoomSettingsModal={() => setIsRoomSettingsModalOpen(true)}
            onImageClick={(url) => setPreviewImage(url)}
            currentGuild={currentGuild}
          />
          <MessageInput
            onOpenShareModal={() => setIsShareModalOpen(true)}
            onOpenRoomModal={(tab) => handleOpenRoomModal(tab)}
            onOpenProfileModal={() => setIsSettingsModalOpen(true)}
            onOpenRoomSettingsModal={() => setIsRoomSettingsModalOpen(true)}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            soundMuted={soundMuted}
            setSoundMuted={setSoundMuted}
            currentGuild={currentGuild}
            onSendGuildMessage={handleSendGuildMessage}
          />
        </main>

        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onOpenShareModal={() => setIsShareModalOpen(true)}
          onOpenRoomSettingsModal={() => setIsRoomSettingsModalOpen(true)}
          onOpenGuildModal={() => setIsGuildModalOpen(true)}
          joinedGuilds={joinedGuilds}
          currentGuild={currentGuild}
          onSelectGuild={handleSelectGuild}
        />
      </div>

      {/* Modals & Telemetry Windows */}
      <RoomModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        initialTab={roomModalTab}
      />

      <GuildModal
        isOpen={isGuildModalOpen}
        onClose={() => setIsGuildModalOpen(false)}
        currentGuild={currentGuild}
        onSelectGuild={handleSelectGuild}
      />

      <WatchPartyModal
        isOpen={isWatchPartyModalOpen}
        onClose={() => setIsWatchPartyModalOpen(false)}
        currentRoom={currentRoom}
        currentGuild={currentGuild}
      />

      <RoomSettingsModal
        isOpen={isRoomSettingsModalOpen}
        onClose={() => setIsRoomSettingsModalOpen(false)}
      />

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      <PasswordModal />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        soundMuted={soundMuted}
        setSoundMuted={setSoundMuted}
      />

      <VideoCallModal />

      <ImageLightbox
        imageUrl={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <SocketProvider>
      <WebRTCProvider>
        <MainApp />
      </WebRTCProvider>
    </SocketProvider>
  );
}
