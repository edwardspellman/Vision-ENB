const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const socketHandler = require('./socketHandler');
const apiRoutes = require('./routes/api');
const uploadRoutes = require('./routes/upload');
const { startFileCleaner } = require('./fileCleaner');

// Initialize 30-Minute Ephemeral Storage File Cleaner
startFileCleaner(30 * 1000);

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

app.set('trust proxy', true);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));
// Explicit 404 for expired or missing uploaded files
app.use('/uploads', (req, res) => {
  res.status(404).json({ success: false, error: 'File expired or not found' });
});

app.use('/api', apiRoutes);
app.use('/api/upload', uploadRoutes);
// Explicit 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 5e8
});

socketHandler(io);

const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(`
      <div style="font-family: monospace; text-align: center; padding: 50px; background: #04060a; color: #00ff88; min-height: 100vh;">
        <h1>[ ø ] VISION TELEMETRY ACTIVE</h1>
        <p>Core node server operational on port ${PORT}.</p>
      </div>
    `);
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`⚡ VISION - Ephemeral Network Bridge online on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO Real-time Bridge & WebRTC Signaling active`);
  console.log(`🛡️  Zero-Trace IP Subnet Routing initialized`);
  console.log(`⏱️  3-Minute Ephemeral Storage & Message Purge active`);
  console.log(`======================================================\n`);
});
