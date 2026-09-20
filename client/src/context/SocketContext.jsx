import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { sound } from '../utils/sound';
import { generateRandomName, getColorForString } from '../utils/avatar';
import { getBackendUrl, discoverLanServer } from '../utils/config';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [ipInfo, setIpInfo] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomUsers, setRoomUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [error, setError] = useState(null);
  
  // Auth & Profile Setup State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('vision_auth') === 'true';
  });
  const [hasCompletedProfile, setHasCompletedProfile] = useState(() => {
    return localStorage.getItem('vision_profile_setup') === 'true';
  });
  const [showProfileSetup, setShowProfileSetup] = useState(false);

  // Password modal state for protected rooms
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingRoomId, setPendingRoomId] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  // Operative Profile
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('vision_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    const initialName = generateRandomName();
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name: initialName,
      avatar: initialName,
      role: 'NETRUNNER',
      tagline: 'Zero-Trace Operative',
      color: getColorForString(initialName).accent,
      device: isMobile ? 'mobile' : 'desktop'
    };
  });

  // Save profile changes
  useEffect(() => {
    localStorage.setItem('vision_user', JSON.stringify(user));
  }, [user]);

  // Connect / Reconnect Socket.IO server
  const initSocket = (customUrl) => {
    if (socket) {
      try {
        socket.disconnect();
      } catch (e) {}
    }
    const serverUrl = customUrl || getBackendUrl();
    const socketInstance = io(serverUrl, {
      reconnectionAttempts: 25,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
    });

    socketInstance.on('connect_error', async (err) => {
      setConnected(false);
      setError('Searching local Wi-Fi network for Vision server...');

      // Attempt LAN server auto-discovery
      const foundUrl = await discoverLanServer();
      if (foundUrl && foundUrl !== serverUrl) {
        initSocket(foundUrl);
      } else {
        setError('Server offline. Tap Settings ⚙️ to set host IP (e.g. http://192.168.x.x:3000)');
      }
    });

    // IP Info & default room
    socketInstance.on('client_ip_info', (data) => {
      setIpInfo(data);
      
      // Auto join if already authenticated
      const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
      const initialRoom = hashParams.get('room');
      const initialPwd = hashParams.get('pwd') || '';

      if (initialRoom) {
        joinRoom(initialRoom, initialPwd, socketInstance);
      } else if (data?.autoRoom?.roomId) {
        joinRoom(data.autoRoom.roomId, '', socketInstance);
      }
    });

    // New Message Received
    socketInstance.on('new_message', (message) => {
      setMessages((prev) => [...prev, message]);
      if (message.type !== 'system') {
        sound.playMessageReceive();
      }
    });

    // User Joined
    socketInstance.on('user_joined', ({ user: joinedUser, users }) => {
      setRoomUsers(users);
      sound.playUserJoin();
    });

    // User Left
    socketInstance.on('user_left', ({ user: leftUser, users }) => {
      setRoomUsers(users);
      sound.playUserLeave();
    });

    // Typing Update
    socketInstance.on('typing_update', (typingList) => {
      setTypingUsers(typingList);
    });

    // Reaction Update
    socketInstance.on('reaction_update', ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, reactions } : msg))
      );
    });

    // Room Settings Updated
    socketInstance.on('room_updated', (updatedRoom) => {
      setCurrentRoom(updatedRoom);
    });

    setSocket(socketInstance);
    return socketInstance;
  };

  useEffect(() => {
    const activeSocket = initSocket();
    return () => {
      if (activeSocket) activeSocket.disconnect();
    };
  }, []);

  const reconnectWithUrl = (newUrl) => {
    return initSocket(newUrl);
  };

  // Automatically purge client messages: all chat history and media removed after 30 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - 30 * 60 * 1000; // 30 minutes
      setMessages((prev) => prev.filter((m) => m.timestamp >= cutoff));
    }, 10 * 1000);

    return () => clearInterval(interval);
  }, []);

  /**
   * AUTHENTICATION HANDLERS
   */
  const loginAsGuest = (customHandle = '') => {
    const handle = customHandle.trim() || user.name;
    const updatedUser = {
      ...user,
      name: handle,
      avatar: handle
    };
    setUser(updatedUser);
    setIsAuthenticated(true);
    localStorage.setItem('vision_auth', 'true');

    // If first time profile setup hasn't been completed, show profile setup
    if (!hasCompletedProfile) {
      setShowProfileSetup(true);
    }

    // Rejoin current room with updated handle
    if (currentRoom) {
      joinRoom(currentRoom.id, '', socket);
    }
  };

  const loginWithPasskey = (handle, passkey) => {
    const cleanHandle = handle.trim() || user.name;
    const updatedUser = {
      ...user,
      name: cleanHandle,
      avatar: cleanHandle
    };
    setUser(updatedUser);
    setIsAuthenticated(true);
    localStorage.setItem('vision_auth', 'true');
    localStorage.setItem('vision_passkey_hash', btoa(passkey));

    if (!hasCompletedProfile) {
      setShowProfileSetup(true);
    }

    if (currentRoom) {
      joinRoom(currentRoom.id, '', socket);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('vision_auth');
    localStorage.removeItem('vision_passkey_hash');
  };

  const completeProfileSetup = (profileUpdates) => {
    const updated = {
      ...user,
      ...profileUpdates
    };
    setUser(updated);
    setHasCompletedProfile(true);
    setShowProfileSetup(false);
    localStorage.setItem('vision_profile_setup', 'true');
    localStorage.setItem('vision_user', JSON.stringify(updated));

    // Rejoin room to broadcast updated presence
    if (currentRoom && socket) {
      joinRoom(currentRoom.id, '', socket);
    }
  };

  /**
   * Join a room (Auto or Custom with optional Password)
   */
  const joinRoom = (roomId, password = '', customSocket = socket) => {
    const s = customSocket || socket;
    if (!s) return;

    setError(null);
    setPasswordError(null);

    s.emit('join_room', { roomId, password, user }, (response) => {
      if (!response) return;

      if (response.success) {
        setCurrentRoom(response.room);
        setRoomUsers(response.users || []);
        setMessages(response.messages || []);
        setPasswordModalOpen(false);
        setPendingRoomId(null);

        if (response.room.isCustom) {
          window.location.hash = `room=${encodeURIComponent(response.room.id)}`;
        } else {
          window.location.hash = '';
        }
      } else {
        if (response.requiresPassword) {
          setPendingRoomId(roomId);
          setPasswordModalOpen(true);
          setPasswordError(password ? 'Access Denied: Invalid Key.' : null);
        } else {
          setError(response.error || 'Connection to room failed.');
        }
      }
    });
  };

  /**
   * Create a new Custom Room
   */
  const createRoom = ({ roomId, name, password, isPrivate, maxUsers, settings }) => {
    return new Promise((resolve) => {
      if (!socket) return resolve({ success: false, error: 'Socket link offline' });

      socket.emit(
        'create_room',
        { roomId, name, password, isPrivate, maxUsers, settings, user },
        (response) => {
          if (response && response.success) {
            setCurrentRoom(response.room);
            setMessages([]);
            setRoomUsers([{ ...user, isHost: true }]);
            window.location.hash = `room=${encodeURIComponent(response.room.id)}`;
            resolve({ success: true, room: response.room });
          } else {
            resolve({ success: false, error: response?.error || 'Room creation failed' });
          }
        }
      );
    });
  };

  /**
   * Update Room Settings (Host only)
   */
  const updateRoomSettings = ({ name, password, maxUsers, settings }) => {
    return new Promise((resolve) => {
      if (!socket || !currentRoom) return resolve({ success: false, error: 'Link offline' });

      socket.emit(
        'update_room_settings',
        { roomId: currentRoom.id, name, password, maxUsers, settings },
        (res) => {
          if (res && res.success) {
            setCurrentRoom(res.room);
            resolve({ success: true, room: res.room });
          } else {
            resolve({ success: false, error: res?.error || 'Failed to update settings' });
          }
        }
      );
    });
  };

  /**
   * Send a message
   */
  const sendMessage = ({ text, type = 'text', fileUrl = null, fileName = null, fileSize = null, audioDuration = null }) => {
    if (!socket || !currentRoom) return;

    socket.emit(
      'send_message',
      {
        roomId: currentRoom.id,
        text,
        type,
        fileUrl,
        fileName,
        fileSize,
        audioDuration
      },
      (res) => {
        if (res && res.success) {
          sound.playMessageSend();
        }
      }
    );
  };

  /**
   * Update Typing Status
   */
  const setTyping = (isTyping) => {
    if (!socket || !currentRoom) return;
    socket.emit('typing', { roomId: currentRoom.id, isTyping });
  };

  /**
   * Toggle Reaction
   */
  const toggleReaction = (messageId, emoji) => {
    if (!socket || !currentRoom) return;
    socket.emit('toggle_reaction', { roomId: currentRoom.id, messageId, emoji });
  };

  /**
   * Leave current custom room and return to default Local Wi-Fi Network room
   */
  const leaveRoom = () => {
    const defaultRoomId = ipInfo?.autoRoom?.roomId;
    joinRoom(defaultRoomId || 'auto');
  };

  /**
   * Update User Profile
   */
  const updateUserProfile = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
  };

  const isHost = Boolean(
    (currentRoom?.hostId && currentRoom.hostId === user?.id) ||
    roomUsers.find((u) => u.id === user?.id || u.socketId === socket?.id)?.isHost
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        ipInfo,
        user,
        currentRoom,
        roomUsers,
        messages,
        typingUsers,
        error,
        isAuthenticated,
        showProfileSetup,
        setShowProfileSetup,
        loginAsGuest,
        loginWithPasskey,
        logout,
        completeProfileSetup,
        joinRoom,
        leaveRoom,
        createRoom,
        updateRoomSettings,
        isHost,
        sendMessage,
        setTyping,
        toggleReaction,
        updateUserProfile,
        reconnectWithUrl,
        passwordModalOpen,
        setPasswordModalOpen,
        pendingRoomId,
        passwordError
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
