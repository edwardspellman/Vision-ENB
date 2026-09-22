const roomManager = require('./roomManager');
const { getClientIp, getAutoRoomForIp, getServerLanIp } = require('./ipUtils');

module.exports = function socketHandler(io) {
  io.on('connection', (socket) => {
    const clientIp = getClientIp(socket);
    const autoRoom = getAutoRoomForIp(clientIp);
    const lanIp = getServerLanIp();

    // Initial IP and network info
    socket.emit('client_ip_info', {
      ip: clientIp,
      lanIp,
      serverLanUrl: `http://${lanIp}:3000`,
      autoRoom
    });

    /**
     * WEBRTC P2P DIRECT LARGE FILE TRANSFER SIGNALING
     */
    socket.on('webrtc_p2p_file_offer', ({ targetSocketId, offer, fileMetadata }) => {
      io.to(targetSocketId).emit('webrtc_p2p_file_offer', {
        senderSocketId: socket.id,
        offer,
        fileMetadata
      });
    });

    socket.on('webrtc_p2p_file_answer', ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit('webrtc_p2p_file_answer', {
        responderSocketId: socket.id,
        answer
      });
    });

    socket.on('webrtc_p2p_file_ice', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('webrtc_p2p_file_ice', {
        senderSocketId: socket.id,
        candidate
      });
    });

    /**
     * CREATE CUSTOM ROOM
     */
    socket.on('create_room', (data, callback) => {
      try {
        const { roomId, name, password, isPrivate, maxUsers, settings, user } = data;
        
        if (!roomId || !roomId.trim()) {
          return callback && callback({ success: false, error: 'Room ID is required' });
        }

        const result = roomManager.createRoom({
          roomId,
          name: name || roomId,
          password,
          isPrivate,
          hostUser: user,
          maxUsers: maxUsers || 50,
          settings
        });

        if (!result.success) {
          return callback && callback({ success: false, error: result.error });
        }

        // Auto join creator to this room
        const joinRes = roomManager.addUser(socket.id, result.room.id, user || { name: 'Host' }, password);
        if (joinRes.success) {
          socket.join(result.room.id);
        }

        if (callback) {
          callback({
            success: true,
            room: roomManager.getRoomPublicInfo(result.room.id)
          });
        }
      } catch (err) {
        console.error('Error creating room:', err);
        if (callback) callback({ success: false, error: 'Internal server error creating room' });
      }
    });

    /**
     * UPDATE ROOM SETTINGS (Host only)
     */
    socket.on('update_room_settings', (data, callback) => {
      try {
        const { roomId, name, password, maxUsers, settings } = data;
        const result = roomManager.updateRoomSettings(socket.id, roomId, { name, password, maxUsers, settings });
        
        if (result.success) {
          io.to(roomId).emit('room_updated', result.room);
          const sysMsg = roomManager.addMessage(roomId, {
            sender: { name: 'System', avatar: 'bot', color: '#6366f1' },
            text: `Room settings updated by Host.`,
            type: 'system'
          });
          io.to(roomId).emit('new_message', sysMsg);
          if (callback) callback({ success: true, room: result.room });
        } else {
          if (callback) callback({ success: false, error: result.error });
        }
      } catch (err) {
        console.error('Error updating room settings:', err);
        if (callback) callback({ success: false, error: 'Failed to update settings' });
      }
    });

    /**
     * JOIN ROOM (Auto or Custom)
     */
    socket.on('join_room', (data, callback) => {
      try {
        const { roomId, password, user } = data;
        let targetRoomId = roomId;

        // If no roomId provided, use default Auto-Network room
        if (!targetRoomId || targetRoomId === 'auto') {
          const auto = roomManager.getOrCreateAutoRoom(autoRoom);
          targetRoomId = auto.id;
        }

        // Attempt to find or create auto room
        let room = roomManager.rooms.get(targetRoomId);
        if (!room && (targetRoomId.startsWith('LAN-') || targetRoomId.startsWith('IP-'))) {
          room = roomManager.getOrCreateAutoRoom({
            roomId: targetRoomId,
            roomName: autoRoom.roomName,
            isLocal: autoRoom.isLocal,
            networkType: autoRoom.networkType
          });
        }

        if (!room) {
          return callback && callback({
            success: false,
            error: 'Room not found. Check the Room ID or create a new room.'
          });
        }

        // Add user to room
        const joinResult = roomManager.addUser(socket.id, targetRoomId, user || {}, password);

        if (!joinResult.success) {
          return callback && callback({
            success: false,
            error: joinResult.error,
            requiresPassword: joinResult.requiresPassword
          });
        }

        // Leave previous socket rooms and join target room
        Array.from(socket.rooms).forEach(r => {
          if (r !== socket.id) socket.leave(r);
        });
        socket.join(targetRoomId);

        const publicRoom = roomManager.getRoomPublicInfo(targetRoomId);
        const users = roomManager.getUsers(targetRoomId);
        const messages = roomManager.getMessages(targetRoomId);

        // Notify caller of success
        if (callback) {
          callback({
            success: true,
            room: publicRoom,
            user: joinResult.user,
            users,
            messages
          });
        }

        // Broadcast to other users in room
        socket.to(targetRoomId).emit('user_joined', {
          user: joinResult.user,
          users
        });

        // System notification
        const sysMsg = roomManager.addMessage(targetRoomId, {
          sender: { name: 'System', avatar: 'bot', color: '#6366f1' },
          text: `${joinResult.user.name} joined the room.`,
          type: 'system'
        });
        io.to(targetRoomId).emit('new_message', sysMsg);

      } catch (err) {
        console.error('Error joining room:', err);
        if (callback) callback({ success: false, error: 'Internal server error joining room' });
      }
    });

    /**
     * SEND MESSAGE
     */
    socket.on('send_message', (data, callback) => {
      try {
        const { roomId, text, type, fileUrl, fileName, fileSize, audioDuration } = data;
        let mapping = roomManager.socketMap.get(socket.id);

        if (!mapping || mapping.roomId !== roomId) {
          const room = roomManager.rooms.get(roomId) || roomManager.getOrCreateAutoRoom(autoRoom);
          if (room) {
            const sender = data.user || data.sender || { name: 'User', avatar: 'bot' };
            roomManager.addUser(socket.id, room.id, sender);
            socket.join(room.id);
            mapping = roomManager.socketMap.get(socket.id);
          }
        }

        if (!mapping) {
          return callback && callback({ success: false, error: 'Not in this room' });
        }

        const room = roomManager.rooms.get(roomId);
        if (room && room.settings?.onlyHostCanPost) {
          const isHost = (room.hostId && mapping.user.id === room.hostId) || mapping.user.isHost;
          if (!isHost) {
            return callback && callback({ success: false, error: 'Only the room host can post messages in this room.' });
          }
        }

        const safeText = (typeof text === 'string') ? text.slice(0, 10000) : '';
        const allowedTypes = ['text', 'image', 'audio', 'video', 'file'];
        const safeType = allowedTypes.includes(type) ? type : 'text';
        const safeFileUrl = (typeof fileUrl === 'string' && fileUrl.startsWith('/uploads/')) ? fileUrl : null;
        const safeFileName = (typeof fileName === 'string') ? fileName.slice(0, 255) : null;

        const message = roomManager.addMessage(roomId, {
          sender: mapping.user,
          text: safeText,
          type: safeType,
          fileUrl: safeFileUrl,
          fileName: safeFileName,
          fileSize: Number(fileSize) || null,
          audioDuration: Number(audioDuration) || null
        });

        if (message) {
          io.to(roomId).emit('new_message', message);
          roomManager.setTyping(roomId, mapping.user.name, false);
          io.to(roomId).emit('typing_update', Array.from(roomManager.rooms.get(roomId)?.typingUsers || []));
          if (callback) callback({ success: true, message });
        }
      } catch (err) {
        console.error('Error sending message:', err);
        if (callback) callback({ success: false, error: 'Failed to send message' });
      }
    });

    /**
     * TYPING STATUS
     */
    socket.on('typing', ({ roomId, isTyping }) => {
      const mapping = roomManager.socketMap.get(socket.id);
      if (mapping && mapping.roomId === roomId) {
        const typingList = roomManager.setTyping(roomId, mapping.user.name, isTyping);
        socket.to(roomId).emit('typing_update', typingList);
      }
    });

    /**
     * EMOJI REACTION
     */
    socket.on('toggle_reaction', ({ roomId, messageId, emoji }) => {
      const mapping = roomManager.socketMap.get(socket.id);
      if (mapping && mapping.roomId === roomId) {
        const result = roomManager.toggleReaction(roomId, messageId, emoji, mapping.user.name);
        if (result) {
          io.to(roomId).emit('reaction_update', result);
        }
      }
    });

    /**
     * WEBRTC AUDIO/VIDEO CALL SIGNALING
     */
    socket.on('webrtc_call_user', ({ targetSocketId, roomId, isVideo }) => {
      const mapping = roomManager.socketMap.get(socket.id);
      if (mapping) {
        io.to(targetSocketId).emit('webrtc_incoming_call', {
          callerSocketId: socket.id,
          callerUser: mapping.user,
          roomId,
          isVideo
        });
      }
    });

    socket.on('webrtc_accept_call', ({ callerSocketId, isVideo }) => {
      const mapping = roomManager.socketMap.get(socket.id);
      if (mapping) {
        io.to(callerSocketId).emit('webrtc_call_accepted', {
          responderSocketId: socket.id,
          responderUser: mapping.user,
          isVideo
        });
      }
    });

    socket.on('webrtc_reject_call', ({ callerSocketId }) => {
      const mapping = roomManager.socketMap.get(socket.id);
      io.to(callerSocketId).emit('webrtc_call_rejected', {
        responderUser: mapping ? mapping.user : { name: 'User' }
      });
    });

    socket.on('webrtc_offer', ({ targetSocketId, sdp }) => {
      io.to(targetSocketId).emit('webrtc_offer', {
        callerSocketId: socket.id,
        sdp
      });
    });

    socket.on('webrtc_answer', ({ targetSocketId, sdp }) => {
      io.to(targetSocketId).emit('webrtc_answer', {
        responderSocketId: socket.id,
        sdp
      });
    });

    socket.on('webrtc_ice_candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('webrtc_ice_candidate', {
        senderSocketId: socket.id,
        candidate
      });
    });

    socket.on('webrtc_end_call', ({ targetSocketId }) => {
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc_call_ended', {
          senderSocketId: socket.id
        });
      }
    });

    /**
     * DISCONNECT
     */
    socket.on('disconnect', () => {
      const removal = roomManager.removeUser(socket.id);
      if (removal) {
        const { roomId, user, remainingUsers } = removal;
        
        socket.to(roomId).emit('user_left', {
          user,
          users: remainingUsers
        });

        const sysMsg = roomManager.addMessage(roomId, {
          sender: { name: 'System', avatar: 'bot', color: '#6366f1' },
          text: `${user.name} left the room.`,
          type: 'system'
        });
        io.to(roomId).emit('new_message', sysMsg);

        socket.to(roomId).emit('webrtc_call_ended', {
          senderSocketId: socket.id
        });
      }
    });
  });
};
