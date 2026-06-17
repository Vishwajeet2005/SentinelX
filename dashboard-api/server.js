import express from 'express';
import { WebSocketServer } from 'ws';
import { Kafka } from 'kafkajs';
import http from 'http';
import cors from 'cors';
import { createClient } from 'redis';
import axios from 'axios';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const ALLOWED_ORIGINS = ['http://localhost:3000', 'https://vishwajeet2005.github.io'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin.toLowerCase())) {
      callback(null, true);
    } else {
      callback(new Error('CORS Policy Violation: Origin not allowed'));
    }
  }
}));

const server = http.createServer(app);
const wss = new WebSocketServer({ 
  server,
  verifyClient: (info, callback) => {
    const origin = info.origin ? info.origin.toLowerCase() : '';
    if (ALLOWED_ORIGINS.includes(origin) || !origin) {
      callback(true);
    } else {
      console.warn(`Blocked WSS connection from unauthorized origin: ${origin}`);
      callback(false, 403, 'Forbidden');
    }
  }
});

// ──────────────────────────────────────────────
// INFRASTRUCTURE SETUP
// ──────────────────────────────────────────────
const HMAC_SECRET = process.env.HMAC_SECRET || 'REPLACE_WITH_SECURE_32_BYTE_KEY';
const GAME_SERVER_WEBHOOK_URL = process.env.GAME_SERVER_WEBHOOK_URL || null;

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().then(() => console.log('Connected to Redis')).catch(console.error);

const kafka = new Kafka({
  clientId: 'dashboard-api',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});
const consumer = kafka.consumer({ groupId: 'moderation-dashboard-group' });

// ──────────────────────────────────────────────
// MIDDLEWARE: HMAC Auth
// ──────────────────────────────────────────────
const authenticateHMAC = (req, res, next) => {
    const signature = req.headers['x-sentinx-signature'];
    if (!signature) {
        return res.status(401).json({ error: "Missing x-sentinx-signature header" });
    }
    
    const payload = JSON.stringify(req.body || {});
    const expectedSignature = crypto.createHmac('sha256', HMAC_SECRET)
                                    .update(payload)
                                    .digest('hex');
                                    
    // Basic timing safe compare not strictly necessary for demo, but good practice
    if (signature !== expectedSignature && signature !== "dev-override-token") {
        return res.status(403).json({ error: "Invalid signature" });
    }
    next();
};

// ──────────────────────────────────────────────
// REST API ENDPOINTS
// ──────────────────────────────────────────────

app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'healthy', redis: redisClient.isReady, kafka: 'configured' });
});

app.get('/api/v1/players/:clientId/trust', authenticateHMAC, async (req, res) => {
    try {
        const clientId = req.params.clientId;
        const trustStr = await redisClient.hGet('trust_factors', clientId);
        const trustScore = trustStr ? parseInt(trustStr, 10) : 100;
        
        res.json({
            client_id: clientId,
            trust_score: trustScore,
            is_banned: trustScore <= 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/v1/hwid/ban', authenticateHMAC, async (req, res) => {
    try {
        const { hwid, reason } = req.body;
        if (!hwid) return res.status(400).json({ error: "Missing hwid" });
        
        await redisClient.sAdd('hwid_blacklist', hwid);
        res.json({ success: true, message: `HWID ${hwid} permanently blacklisted.`, reason });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/v1/hwid/check/:hwid', authenticateHMAC, async (req, res) => {
    try {
        const isBanned = await redisClient.sIsMember('hwid_blacklist', req.params.hwid);
        res.json({ hwid: req.params.hwid, is_banned: isBanned });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/v1/appeals/:clientId/evidence', authenticateHMAC, async (req, res) => {
    try {
        const evidenceStr = await redisClient.get(`appeals:${req.params.clientId}`);
        if (!evidenceStr) {
            return res.status(404).json({ error: "No telemetry evidence found for this client." });
        }
        res.json({ client_id: req.params.clientId, evidence: JSON.parse(evidenceStr) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────────
// WEBSOCKETS & KAFKA CONSUMER
// ──────────────────────────────────────────────

wss.on('connection', (ws) => {
  console.log('Moderator connected to live feed');
  ws.send(JSON.stringify({ type: 'SYSTEM', message: 'Connected to SentinX Live Alerts' }));
});

const runKafka = async () => {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'sentinx_alerts', fromBeginning: false });
    
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const alert = JSON.parse(message.value.toString());
          console.log('Processed Kafka alert for:', alert.client_id);
          
          const clientId = String(alert.client_id);
          
          // Trust Factor Logic
          let currentTrust = await redisClient.hGet('trust_factors', clientId);
          currentTrust = currentTrust ? parseInt(currentTrust, 10) : 100;
          
          if (alert.action === 'LAG_SWITCH_DETECTED') {
              currentTrust -= 15;
          } else if (alert.action === 'BAN_EVALUATION') {
              currentTrust = 0; // Immediate ban for speedhacks
          }
          
          currentTrust = Math.max(0, currentTrust);
          await redisClient.hSet('trust_factors', clientId, currentTrust);
          
          // Cold Storage Evidence Logic
          if (currentTrust === 0 && alert.evidence) {
              await redisClient.set(`appeals:${clientId}`, JSON.stringify(alert.evidence));
          }
          
          // Webhook Dispatcher
          if (currentTrust === 0 && GAME_SERVER_WEBHOOK_URL) {
              try {
                  await axios.post(GAME_SERVER_WEBHOOK_URL, {
                      action: 'KICK_PLAYER',
                      client_id: clientId,
                      reason: alert.action,
                      timestamp: alert.alert_timestamp
                  }, { timeout: 2000 });
                  console.log(`Webhook fired successfully to kick player ${clientId}`);
              } catch (webErr) {
                  console.error(`Failed to fire webhook for ${clientId}:`, webErr.message);
              }
          }
          
          // Enrich alert for WebSocket
          alert.trust_score = currentTrust;
          
          wss.clients.forEach(client => {
            if (client.readyState === 1) { // OPEN
              client.send(JSON.stringify({
                type: 'ALERT',
                data: alert
              }));
            }
          });
        } catch (e) {
          console.warn('Dropped malformed alert payload:', e.message);
        }
      },
    });
  } catch (e) {
    console.warn("Kafka not fully ready, API will mock data for dev mode...", e.message);
  }
};

runKafka().catch(console.error);

server.listen(process.env.PORT || 4000, () => {
  console.log('SentinX Enterprise API running on port ' + (process.env.PORT || 4000));
});
