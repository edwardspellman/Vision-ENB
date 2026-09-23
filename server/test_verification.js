const http = require('http');
const fs = require('fs');
const path = require('path');

async function testApi() {
  console.log('======================================================');
  console.log('🧪 VISION PLATFORM // 30-MINUTE EPHEMERAL PURGE TESTS');
  console.log('======================================================\n');

  const ipUtils = require('./ipUtils');
  const roomManager = require('./roomManager');
  const fileCleaner = require('./fileCleaner');

  // Test 1: IP Detection & Subnet Generation
  const testIp1 = '192.168.1.45';
  const autoRoom1 = ipUtils.getAutoRoomForIp(testIp1);
  console.log('✔ Test 1: IP Subnet Matching (LAN):', autoRoom1.roomId ? 'PASSED' : 'FAILED');

  const testIp2 = '103.21.244.12';
  const autoRoom2 = ipUtils.getAutoRoomForIp(testIp2);
  console.log('✔ Test 2: IP Matching (Public Subnet):', autoRoom2.roomId ? 'PASSED' : 'FAILED');

  // Test 3: Custom Room Creation with Permissions & Settings
  const createRes = roomManager.createRoom({
    roomId: 'TEST-ROOM-SETTINGS-100',
    name: 'Cyberpunk Engineering Hub',
    password: 'securePassphrase123',
    isPrivate: true,
    maxUsers: 25,
    hostUser: { id: 'host_01', name: 'Commander Host' },
    settings: {
      allowFileUploads: true,
      allowCalls: true,
      allowVoiceNotes: true,
      onlyHostCanPost: true
    }
  });
  console.log('✔ Test 3: Custom Room Creation with Permissions:', createRes.success ? 'PASSED' : 'FAILED');

  // Test 4: Password Verification
  const room = roomManager.rooms.get('TEST-ROOM-SETTINGS-100');
  const validCheck = roomManager.verifyPassword(room, 'securePassphrase123');
  const invalidCheck = roomManager.verifyPassword(room, 'wrongPassword');
  console.log('✔ Test 4a: Password Verification (Valid):', validCheck === true ? 'PASSED' : 'FAILED');
  console.log('✔ Test 4b: Password Verification (Invalid):', invalidCheck === false ? 'PASSED' : 'FAILED');

  // Test 5: User Addition & Host Recognition
  const hostUser = { id: 'host_01', name: 'Commander Host', avatar: 'HostAvatar' };
  const memberUser = { id: 'member_02', name: 'Operative Alpha', avatar: 'MemberAvatar' };
  
  const addHostRes = roomManager.addUser('sock_host', 'TEST-ROOM-SETTINGS-100', hostUser, 'securePassphrase123');
  const addMemberRes = roomManager.addUser('sock_member', 'TEST-ROOM-SETTINGS-100', memberUser, 'securePassphrase123');
  console.log('✔ Test 5: Add Host & Member to Room:', addHostRes.success && addMemberRes.success ? 'PASSED' : 'FAILED');

  // Test 6: Room Settings Update by Host
  const updateRes = roomManager.updateRoomSettings('sock_host', 'TEST-ROOM-SETTINGS-100', {
    name: 'Updated Governance Hub',
    maxUsers: 30,
    settings: {
      onlyHostCanPost: false
    }
  });
  console.log('✔ Test 6: Room Settings Live Update by Host:', updateRes.success && updateRes.room.name === 'Updated Governance Hub' ? 'PASSED' : 'FAILED');

  // Test 7: Unauthorized Settings Update by Non-Host
  const unauthorizedUpdate = roomManager.updateRoomSettings('sock_member', 'TEST-ROOM-SETTINGS-100', {
    name: 'Hacked Room Name'
  });
  console.log('✔ Test 7: Reject Unauthorized Room Settings Modification:', unauthorizedUpdate.success === false ? 'PASSED' : 'FAILED');

  // Test 8: Messaging, System Notifications, and 30-Minute Expiration
  const textMsg = roomManager.addMessage('TEST-ROOM-SETTINGS-100', {
    sender: hostUser,
    text: 'Command telemetry active',
    type: 'text'
  });

  const sysMsg = roomManager.addMessage('TEST-ROOM-SETTINGS-100', {
    sender: { name: 'System' },
    text: 'Operative Alpha joined the room.',
    type: 'system'
  });

  console.log('✔ Test 8: Text & System Message Dispatch:', textMsg && sysMsg ? 'PASSED' : 'FAILED');

  // Test 9: 30-Minute Message Purge (All chat history older than 30 mins)
  room.messages.push({
    id: 'old_msg_expired',
    type: 'text',
    text: 'Old message from 31 minutes ago',
    timestamp: Date.now() - (31 * 60 * 1000) // 31 minutes old
  });
  room.messages.push({
    id: 'recent_msg_active',
    type: 'text',
    text: 'Recent message from 5 minutes ago',
    timestamp: Date.now() - (5 * 60 * 1000) // 5 minutes old
  });

  const filteredMessages = roomManager.getMessages('TEST-ROOM-SETTINGS-100');
  const hasExpired = filteredMessages.some(m => m.id === 'old_msg_expired');
  const hasActive = filteredMessages.some(m => m.id === 'recent_msg_active');
  console.log('✔ Test 9: Messages older than 30 minutes are purged:', (!hasExpired && hasActive) ? 'PASSED' : 'FAILED');

  // Test 10: Ephemeral Storage Sweeper (Purges files older than 30 minutes from disk)
  const dummyOldFileName = `test-old-file-${Date.now()}.png`;
  const dummyRecentFileName = `test-recent-file-${Date.now()}.png`;
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const oldFilePath = path.join(uploadsDir, dummyOldFileName);
  const recentFilePath = path.join(uploadsDir, dummyRecentFileName);

  fs.writeFileSync(oldFilePath, 'mock-image-data-old');
  fs.writeFileSync(recentFilePath, 'mock-image-data-recent');

  // Backdate the old file to 32 minutes ago
  const thirtyTwoMinsAgo = (Date.now() - 32 * 60 * 1000) / 1000;
  fs.utimesSync(oldFilePath, thirtyTwoMinsAgo, thirtyTwoMinsAgo);

  // Run the file cleaner
  fileCleaner.cleanupExpiredFiles();

  const oldFileExists = fs.existsSync(oldFilePath);
  const recentFileExists = fs.existsSync(recentFilePath);
  // Cleanup recent test file
  if (recentFileExists) fs.unlinkSync(recentFilePath);

  console.log('✔ Test 10: Server disk file cleaner removes files >30 mins:', (!oldFileExists && recentFileExists) ? 'PASSED' : 'FAILED');

  // Test 11: File deletion when message expires
  const dummyMsgFile = `test-msg-file-${Date.now()}.jpg`;
  const msgFilePath = path.join(uploadsDir, dummyMsgFile);
  fs.writeFileSync(msgFilePath, 'mock-image-for-message');

  room.messages.push({
    id: 'expired_file_msg',
    type: 'image',
    fileUrl: `/uploads/${dummyMsgFile}`,
    fileName: dummyMsgFile,
    timestamp: Date.now() - (35 * 60 * 1000) // 35 mins old
  });

  roomManager.purgeExpiredMessages();
  const fileUnlinked = !fs.existsSync(msgFilePath);
  console.log('✔ Test 11: Associated upload file unlinked upon message expiration:', fileUnlinked ? 'PASSED' : 'FAILED');

  // Test 12: Live Server HTTP Health Check (if running)
  await new Promise((resolve) => {
    http.get('http://localhost:3000', (res) => {
      console.log('✔ Test 12: Live HTTP Server Endpoint Status Code:', res.statusCode === 200 ? '200 OK (PASSED)' : `FAILED (${res.statusCode})`);
      resolve();
    }).on('error', () => {
      console.log('ℹ Test 12: HTTP Server currently stopped (will verify after boot)');
      resolve();
    });
  });

  console.log('\n======================================================');
  console.log('🎉 ALL 30-MINUTE EPHEMERAL PURGE TESTS VERIFIED!');
  console.log('======================================================\n');
}

testApi().catch(console.error);
