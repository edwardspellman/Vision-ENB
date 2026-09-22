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
import P2PTransferModal from './components/P2PTransferModal';

function MainApp() {
  const { connected, currentRoom, isAuthenticated, showProfileSetup } = useSocket();
  const [showSplash, setShowSplash] = useState(true);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [roomModalTab, setRoomModalTab] = useState('create');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isRoomSettingsModalOpen, setIsRoomSettingsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const [soundMuted, setSoundMuted] = useState(() => {
    return localStorage.getItem('vision_sound_muted') === 'true';
  });

  // Ensure Document Title is set to Vision - ENB Ephemeral Network Bridge
  useEffect(() => {
    document.title = 'Vision - ENB Ephemeral Network Bridge';
  }, []);

  // Prompt Room Gateway if no room
  useEffect(() => {
    if (!showSplash && isAuthenticated && !currentRoom) {
      setIsRoomModalOpen(true);
    }
  }, [showSplash, isAuthenticated, currentRoom]);

  const handleOpenRoomModal = (tab = 'create') => {
    setRoomModalTab(tab);
    setIsRoomModalOpen(true);
  };

  return (
    <div className="flex flex-col h-screen h-[100dvh] w-screen bg-[#04060a] text-zinc-300 overflow-hidden font-mono antialiased">
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
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        soundMuted={soundMuted}
        setSoundMuted={setSoundMuted}
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
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <MessageInput
            onOpenShareModal={() => setIsShareModalOpen(true)}
            onOpenRoomModal={(tab) => handleOpenRoomModal(tab)}
            onOpenProfileModal={() => setIsSettingsModalOpen(true)}
            onOpenRoomSettingsModal={() => setIsRoomSettingsModalOpen(true)}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            soundMuted={soundMuted}
            setSoundMuted={setSoundMuted}
          />
        </main>

        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onOpenRoomModal={(tab) => handleOpenRoomModal(tab)}
          onOpenShareModal={() => setIsShareModalOpen(true)}
          onOpenRoomSettingsModal={() => setIsRoomSettingsModalOpen(true)}
          onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
          soundMuted={soundMuted}
          setSoundMuted={setSoundMuted}
        />
      </div>

      {/* Modals & Telemetry Windows */}
      <RoomModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        initialTab={roomModalTab}
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

      <P2PTransferModal />

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
