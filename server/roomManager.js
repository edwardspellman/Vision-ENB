const crypto = require('crypto');
const { deleteUploadFile } = require('./fileCleaner');

class RoomManager {
  constructor() {
    // Map of roomId -> room object
    this.rooms = new Map();
    // Map of socketId -> { roomId, user }
    this.socketMap = new Map();
    // Maximum messages cached per room
    this.maxMessagesPerRoom = 200;
    // Auto-purge all chat history (messages, photos, files, system notifications) older than 30 minutes
    this.messageTtl = 30 * 60 * 1000;
    this.systemMessageTtl = 30 * 60 * 1000;

    // Background interval to clean up expired messages and associated files every 30 seconds
    const purgeTimer = setInterval(() => {
      this.purgeExpiredMessages();
    }, 30 * 1000);
    if (purgeTimer.unref) {
      purgeTimer.unref();
    }
  }

  /**
   * Purge messages: automatically remove every chat message and delete physical files from disk after 30 minutes
   */
  purgeExpiredMessages() {
    const cutoff = Date.now() - this.messageTtl;
    for (const room of this.rooms.values()) {
      if (room.messages && room.messages.length > 0) {
        const keptMessages = [];
        for (const m of room.messages) {
          if (m.timestamp >= cutoff) {
            keptMessages.push(m);
          } else {
            // Message expired (> 30 mins): if it contains an uploaded file, delete it from disk
            if (m.fileUrl) {
              deleteUploadFile(m.fileUrl);
            }
          }
        }
        room.messages = keptMessages;
      }
    }
  }

  /**
   * Hashes a room password with salt
   */
  hashPassword(password) {
    if (!password) return null;
    return crypto.createHash('sha256').update(password.trim()).digest('hex');
  }

  /**
   * Verify a provided password against the room's stored password hash
   */
  verifyPassword(room, password) {
    if (!room.hasPassword) return true;
    if (!password) return false;
    const inputHash = this.hashPassword(password);
    if (!room.passwordHash || !inputHash) return false;
    try {
      const bufA = Buffer.from(room.passwordHash, 'hex');
      const bufB = Buffer.from(inputHash, 'hex');
      return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }

  /**
   * Create or retrieve a custom room
   */
  createRoom({ roomId, name, password, isPrivate = false, hostUser = null, maxUsers = 50, settings = {} }) {
    const cleanId = roomId.trim().replace(/[^a-zA-Z0-9_-]/g, '-').toUpperCase();
    
    if (this.rooms.has(cleanId)) {
      const existing = this.rooms.get(cleanId);
      return { success: false, error: 'Room ID already exists. Please choose a different ID or join it directly.', room: existing };
    }

    const hasPassword = Boolean(password && password.trim().length > 0);
    const passwordHash = hasPassword ? this.hashPassword(password) : null;

    const room = {
      id: cleanId,
      name: name || cleanId,
      hasPassword,
      passwordHash,
      isCustom: true,
      isPrivate,
      maxUsers,
      createdAt: Date.now(),
      hostId: hostUser ? hostUser.id : null,
      hostName: hostUser ? hostUser.name : null,
      settings: {
        allowFileUploads: settings.allowFileUploads ?? true,
        allowCalls: settings.allowCalls ?? true,
        allowVoiceNotes: settings.allowVoiceNotes ?? true,
        onlyHostCanPost: settings.onlyHostCanPost ?? false
      },
      users: new Map(),
      messages: [],
      typingUsers: new Set()
    };

    this.rooms.set(cleanId, room);
    return { success: true, room };
  }

  /**
   * Get an existing room or create an auto-network room
   */
  getOrCreateAutoRoom(autoRoomData) {
    const { roomId, roomName, isLocal, networkType } = autoRoomData;
    
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        name: roomName,
        hasPassword: false,
        passwordHash: null,
        isCustom: false,
        isLocal,
        networkType,
        createdAt: Date.now(),
        settings: {
          allowFileUploads: true,
          allowCalls: true,
          allowVoiceNotes: true,
          onlyHostCanPost: false
        },
        users: new Map(),
        messages: [],
        typingUsers: new Set()
      });
    }

    return this.rooms.get(roomId);
  }

  /**
   * Update room settings (Only by host or creator)
   */
  updateRoomSettings(socketId, roomId, updates) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Room not found' };

    const mapping = this.socketMap.get(socketId);
    const isHost = (room.hostId && mapping && mapping.user.id === room.hostId) || room.users.get(socketId)?.isHost;
    
    if (!isHost) {
      return { success: false, error: 'Only the room host can modify settings.' };
    }

    if (updates.name !== undefined) room.name = updates.name.trim() || room.name;
    if (updates.maxUsers !== undefined) room.maxUsers = Number(updates.maxUsers) || 50;
    
    if (updates.password !== undefined) {
      const hasPwd = Boolean(updates.password && updates.password.trim());
      room.hasPassword = hasPwd;
      room.passwordHash = hasPwd ? this.hashPassword(updates.password) : null;
    }

    if (updates.settings) {
      room.settings = {
        ...room.settings,
        ...updates.settings
      };
    }

    return { success: true, room: this.getRoomPublicInfo(roomId) };
  }

  /**
   * Get room metadata safe for client consumption
   */
  getRoomPublicInfo(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      id: room.id,
      name: room.name,
      hasPassword: room.hasPassword,
      isCustom: room.isCustom || false,
      userCount: room.users.size,
      maxUsers: room.maxUsers || 50,
      createdAt: room.createdAt,
      hostName: room.hostName,
      hostId: room.hostId,
      settings: room.settings || {
        allowFileUploads: true,
        allowCalls: true,
        allowVoiceNotes: true,
        onlyHostCanPost: false
      }
    };
  }

  /**
   * Add a user to a room
   */
  addUser(socketId, roomId, user, password = '') {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room does not exist' };
    }

    if (room.hasPassword && !this.verifyPassword(room, password)) {
      return { success: false, error: 'Incorrect room password', requiresPassword: true };
    }

    if (room.maxUsers && room.users.size >= room.maxUsers) {
      return { success: false, error: 'Room is full' };
    }

    this.removeUser(socketId);

    // Remove any existing stale socket in this room for the same user ID or name
    const targetUserId = user.id || socketId;
    const targetUserName = user.name;
    for (const [existingSocketId, existingUser] of room.users.entries()) {
      if (existingSocketId !== socketId && (existingUser.id === targetUserId || (targetUserName && existingUser.name === targetUserName))) {
        room.users.delete(existingSocketId);
        this.socketMap.delete(existingSocketId);
      }
    }

    const userData = {
      socketId,
      id: user.id || socketId,
      name: user.name || 'Operative',
      avatar: user.avatar || user.name || 'avatar',
      color: user.color || '#3b82f6',
      device: user.device || 'desktop',
      isHost: room.hostId === (user.id || socketId),
      joinedAt: Date.now()
    };

    room.users.set(socketId, userData);
    this.socketMap.set(socketId, { roomId, user: userData });

    return { success: true, room, user: userData };
  }

  /**
   * Remove user by socket ID
   */
  removeUser(socketId) {
    const mapping = this.socketMap.get(socketId);
    if (!mapping) return null;

    const { roomId, user } = mapping;
    const room = this.rooms.get(roomId);

    if (room) {
      room.users.delete(socketId);
      room.typingUsers.delete(user.name);

      if (room.isCustom && room.users.size === 0) {
        setTimeout(() => {
          const current = this.rooms.get(roomId);
          if (current && current.users.size === 0) {
            if (current.messages) {
              for (const m of current.messages) {
                if (m.fileUrl) deleteUploadFile(m.fileUrl);
              }
            }
            this.rooms.delete(roomId);
          }
        }, 10 * 60 * 1000);
      }
    }

    this.socketMap.delete(socketId);
    return { roomId, user, remainingUsers: room ? Array.from(room.users.values()) : [] };
  }

  /**
   * Add a message to a room
   */
  addMessage(roomId, message) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const fullMessage = {
      id: message.id || crypto.randomUUID(),
      roomId,
      sender: message.sender,
      text: message.text || '',
      type: message.type || 'text',
      fileUrl: message.fileUrl || null,
      fileName: message.fileName || null,
      fileSize: message.fileSize || null,
      audioDuration: message.audioDuration || null,
      reactions: {},
      timestamp: Date.now()
    };

    room.messages.push(fullMessage);
    if (room.messages.length > this.maxMessagesPerRoom) {
      room.messages.shift();
    }

    return fullMessage;
  }

  /**
   * Toggle Pin Message in Room (Host only)
   */
  togglePinMessage(socketId, roomId, messageId) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Room not found' };

    const mapping = this.socketMap.get(socketId);
    const isHost = (room.hostId && mapping && mapping.user.id === room.hostId) || room.users.get(socketId)?.isHost;
    if (!isHost) {
      return { success: false, error: 'Only the room host can pin messages.' };
    }

    const msg = room.messages.find(m => m.id === messageId);
    if (!msg) return { success: false, error: 'Message not found' };

    msg.isPinned = !msg.isPinned;
    msg.pinnedBy = msg.isPinned ? (mapping?.user?.name || 'Host') : null;

    return {
      success: true,
      messageId,
      isPinned: msg.isPinned,
      pinnedBy: msg.pinnedBy,
      room: this.getRoomPublicInfo(roomId)
    };
  }

  /**
   * Add or toggle emoji reaction
   */
  toggleReaction(roomId, messageId, emoji, userName) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const msg = room.messages.find(m => m.id === messageId);
    if (!msg) return null;

    if (!msg.reactions[emoji]) {
      msg.reactions[emoji] = [];
    }

    const idx = msg.reactions[emoji].indexOf(userName);
    if (idx > -1) {
      msg.reactions[emoji].splice(idx, 1);
      if (msg.reactions[emoji].length === 0) {
        delete msg.reactions[emoji];
      }
    } else {
      msg.reactions[emoji].push(userName);
    }

    return { messageId, reactions: msg.reactions };
  }

  /**
   * Typing state updates
   */
  setTyping(roomId, userName, isTyping) {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    if (isTyping) {
      room.typingUsers.add(userName);
    } else {
      room.typingUsers.delete(userName);
    }

    return Array.from(room.typingUsers);
  }

  /**
   * Get users in room
   */
  getUsers(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    
    const uniqueUsersMap = new Map();
    for (const u of room.users.values()) {
      const key = u.id || u.name;
      if (!uniqueUsersMap.has(key)) {
        uniqueUsersMap.set(key, u);
      }
    }
    return Array.from(uniqueUsersMap.values());
  }

  /**
   * Get messages in room (filtering out all messages and files older than 30 mins)
   */
  getMessages(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    const cutoff = Date.now() - this.messageTtl;
    const keptMessages = [];
    for (const m of room.messages) {
      if (m.timestamp >= cutoff) {
        keptMessages.push(m);
      } else {
        if (m.fileUrl) {
          deleteUploadFile(m.fileUrl);
        }
      }
    }
    room.messages = keptMessages;
    return room.messages;
  }
}

module.exports = new RoomManager();
