const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const GUILDS_FILE = path.join(DATA_DIR, 'guilds.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed creating data directory:', err);
  }
}

class GuildManager {
  constructor() {
    this.guilds = new Map();
    this.loadGuilds();

    // Background timer to purge expired messages every 60 seconds
    setInterval(() => {
      this.purgeExpiredMessages();
    }, 60000);
  }

  /**
   * Load guilds from disk
   */
  loadGuilds() {
    try {
      if (fs.existsSync(GUILDS_FILE)) {
        const raw = fs.readFileSync(GUILDS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((g) => {
            this.guilds.set(g.id, {
              ...g,
              members: g.members || [],
              messages: g.messages || []
            });
          });
        }
      }
    } catch (err) {
      console.error('Error loading guilds.json:', err);
    }
  }

  /**
   * Save guilds to disk
   */
  saveGuilds() {
    try {
      const data = Array.from(this.guilds.values());
      fs.writeFileSync(GUILDS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving guilds.json:', err);
    }
  }

  /**
   * Generate unique Guild ID (e.g. GUILD-A89F2)
   */
  generateGuildId() {
    let id;
    do {
      const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
      id = `GUILD-${rand}`;
    } while (this.guilds.has(id));
    return id;
  }

  /**
   * Create a new Permanent Guild
   */
  createGuild({ name, description, password, hostUser }) {
    if (!name || !name.trim()) {
      return { success: false, error: 'Guild name is required' };
    }

    const guildId = this.generateGuildId();
    const newGuild = {
      id: guildId,
      name: name.trim(),
      description: description ? description.trim() : '',
      password: password || null,
      hostId: hostUser.id || hostUser.name,
      hostName: hostUser.name || 'Host',
      createdAt: Date.now(),
      members: [
        {
          id: hostUser.id || hostUser.name,
          name: hostUser.name || 'Host',
          avatar: hostUser.avatar || 'bot',
          role: 'host', // 'host' | 'admin' | 'member'
          joinedAt: Date.now()
        }
      ],
      messages: []
    };

    this.guilds.set(guildId, newGuild);
    this.saveGuilds();

    return {
      success: true,
      guild: this.getGuildPublicInfo(guildId)
    };
  }

  /**
   * Join an existing Guild by unique ID
   */
  joinGuild({ guildId, password, user }) {
    const guild = this.guilds.get(guildId);
    if (!guild) {
      return { success: false, error: 'Guild not found. Please check the Unique Guild ID.' };
    }

    if (guild.password && guild.password !== password) {
      return { success: false, error: 'Incorrect Guild password', requiresPassword: true };
    }

    const userId = user.id || user.name;
    let member = guild.members.find((m) => m.id === userId || m.name === user.name);

    if (!member) {
      member = {
        id: userId,
        name: user.name,
        avatar: user.avatar || 'bot',
        role: 'member',
        joinedAt: Date.now()
      };
      guild.members.push(member);
      this.saveGuilds();
    }

    return {
      success: true,
      guild: this.getGuildPublicInfo(guildId),
      member
    };
  }

  /**
   * Leave a Guild
   */
  leaveGuild({ guildId, userId }) {
    const guild = this.guilds.get(guildId);
    if (!guild) return { success: false, error: 'Guild not found' };

    guild.members = guild.members.filter((m) => m.id !== userId && m.name !== userId);

    // If host leaves and members remain, assign host to first member
    if (guild.hostId === userId && guild.members.length > 0) {
      guild.members[0].role = 'host';
      guild.hostId = guild.members[0].id;
      guild.hostName = guild.members[0].name;
    }

    this.saveGuilds();
    return { success: true };
  }

  /**
   * Transfer Guild Host Ownership / Adminship
   */
  transferOwnership({ guildId, currentHostId, targetUserId }) {
    const guild = this.guilds.get(guildId);
    if (!guild) return { success: false, error: 'Guild not found' };

    if (guild.hostId !== currentHostId) {
      const currentMember = guild.members.find(m => m.id === currentHostId || m.name === currentHostId);
      if (!currentMember || currentMember.role !== 'host') {
        return { success: false, error: 'Only the Guild Host can transfer ownership.' };
      }
    }

    const targetMember = guild.members.find((m) => m.id === targetUserId || m.name === targetUserId);
    if (!targetMember) {
      return { success: false, error: 'Target user is not a member of this Guild.' };
    }

    // Demote current host to admin
    const prevHost = guild.members.find((m) => m.id === guild.hostId || m.name === guild.hostName);
    if (prevHost) {
      prevHost.role = 'admin';
    }

    // Promote target member to host
    targetMember.role = 'host';
    guild.hostId = targetMember.id;
    guild.hostName = targetMember.name;

    this.saveGuilds();

    return {
      success: true,
      guild: this.getGuildPublicInfo(guildId)
    };
  }

  /**
   * Promote or demote member admin role
   */
  promoteAdmin({ guildId, requesterId, targetUserId, newRole }) {
    const guild = this.guilds.get(guildId);
    if (!guild) return { success: false, error: 'Guild not found' };

    const requester = guild.members.find((m) => m.id === requesterId || m.name === requesterId);
    if (!requester || (requester.role !== 'host' && requester.role !== 'admin')) {
      return { success: false, error: 'Only Hosts or Admins can change member roles.' };
    }

    const target = guild.members.find((m) => m.id === targetUserId || m.name === targetUserId);
    if (!target) return { success: false, error: 'Member not found' };

    if (target.role === 'host') {
      return { success: false, error: 'Cannot change host role via promotion. Use transfer ownership.' };
    }

    target.role = newRole === 'admin' ? 'admin' : 'member';
    this.saveGuilds();

    return {
      success: true,
      guild: this.getGuildPublicInfo(guildId)
    };
  }

  /**
   * Add a message to a Guild with custom expiration
   */
  addGuildMessage(guildId, messageData) {
    const guild = this.guilds.get(guildId);
    if (!guild) return null;

    // Expiry in minutes (default: 30 minutes, or custom host override: 60, 1440, 10080, -1 for Never)
    const expiryMinutes = messageData.expiryMinutes !== undefined ? messageData.expiryMinutes : 30;
    const expiresAt = expiryMinutes === -1 ? null : Date.now() + (expiryMinutes * 60 * 1000);

    const message = {
      id: 'gmsg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      sender: messageData.sender,
      text: messageData.text,
      type: messageData.type || 'text',
      fileUrl: messageData.fileUrl || null,
      fileName: messageData.fileName || null,
      fileSize: messageData.fileSize || null,
      audioDuration: messageData.audioDuration || null,
      createdAt: Date.now(),
      expiresAt,
      reactions: {}
    };

    guild.messages.push(message);
    this.saveGuilds();
    return message;
  }

  /**
   * Background task to clean up expired messages and associated files
   */
  purgeExpiredMessages() {
    const now = Date.now();
    let hasChanges = false;

    this.guilds.forEach((guild) => {
      const initialCount = guild.messages.length;
      guild.messages = guild.messages.filter((msg) => {
        if (msg.expiresAt && msg.expiresAt <= now) {
          // Delete file from disk if present
          if (msg.fileUrl && msg.fileUrl.startsWith('/uploads/')) {
            const relPath = msg.fileUrl.replace('/uploads/', '');
            const filePath = path.join(__dirname, 'uploads', relPath);
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
              } catch (err) {
                console.error('Error deleting expired file:', filePath, err);
              }
            }
          }
          return false; // Remove expired message
        }
        return true;
      });

      if (guild.messages.length !== initialCount) {
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.saveGuilds();
    }
  }

  /**
   * Get public Guild info
   */
  getGuildPublicInfo(guildId) {
    const guild = this.guilds.get(guildId);
    if (!guild) return null;

    return {
      id: guild.id,
      name: guild.name,
      description: guild.description,
      hostId: guild.hostId,
      hostName: guild.hostName,
      hasPassword: Boolean(guild.password),
      createdAt: guild.createdAt,
      members: guild.members,
      messages: guild.messages.filter((m) => !m.expiresAt || m.expiresAt > Date.now())
    };
  }

  /**
   * Get user's joined guilds
   */
  getUserGuilds(userGuildIds = []) {
    const result = [];
    userGuildIds.forEach((id) => {
      const info = this.getGuildPublicInfo(id);
      if (info) result.push(info);
    });
    return result;
  }
}

module.exports = new GuildManager();
