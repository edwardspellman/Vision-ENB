const express = require('express');
const router = express.Router();
const roomManager = require('../roomManager');
const { getClientIp, getAutoRoomForIp, maskIp, getServerLanIp } = require('../ipUtils');

// GET client IP & network details
router.get('/ip', (req, res) => {
  const ip = getClientIp(req);
  const autoRoom = getAutoRoomForIp(ip);
  const masked = maskIp(ip);
  const lanIp = getServerLanIp();

  res.json({
    ip: masked,
    rawIp: ip,
    lanIp,
    serverLanUrl: `http://${lanIp}:3000`,
    autoRoom,
    serverTime: Date.now()
  });
});

// GET room status / metadata
router.get('/room/:roomId', (req, res) => {
  const roomId = req.params.roomId.trim().toUpperCase();
  const room = roomManager.getRoomPublicInfo(roomId);

  if (!room) {
    return res.status(404).json({ exists: false, message: 'Room not found' });
  }

  res.json({
    exists: true,
    room
  });
});

// POST verify room password
router.post('/room/verify', (req, res) => {
  const { roomId, password } = req.body;
  if (!roomId) {
    return res.status(400).json({ valid: false, error: 'Room ID is required' });
  }

  const room = roomManager.rooms.get(roomId.trim().toUpperCase());
  if (!room) {
    return res.status(404).json({ valid: false, error: 'Room not found' });
  }

  if (!room.hasPassword) {
    return res.json({ valid: true, requiresPassword: false });
  }

  const isValid = roomManager.verifyPassword(room, password);
  if (!isValid) {
    return res.status(401).json({ valid: false, error: 'Invalid password' });
  }

  res.json({ valid: true, requiresPassword: true });
});

module.exports = router;
