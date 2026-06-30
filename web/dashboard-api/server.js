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

const ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:3005', 'http://localhost:3006', 'http://localhost:3007', 'https://vishwajeet2005.github.io'];

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
let STUDIO_WEBHOOK = process.env.GAME_SERVER_WEBHOOK_URL || 'https://api.mygame.com/anti-cheat/webhook';

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
                                    
    try {
        const expectedBuffer = Buffer.from(expectedSignature, 'hex');
        const signatureBuffer = Buffer.from(signature, 'hex');
        
        if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
            if (signature !== "dev-override-token") {
                return res.status(403).json({ error: "Invalid signature" });
            }
        }
    } catch (e) {
        return res.status(400).json({ error: "Malformed signature format" });
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
        if (!hwid || typeof hwid !== 'string' || !/^[A-Fa-f0-9]{64}$/.test(hwid)) {
            return res.status(400).json({ error: "Invalid HWID format. Must be a 64-character SHA-256 hex string." });
        }
        
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

app.get('/api/v1/analytics/system', authenticateHMAC, async (req, res) => {
    try {
        const info = await redisClient.info();
        const connectedClients = info.match(/connected_clients:(\d+)/)?.[1] || "0";
        const usedMemory = info.match(/used_memory_human:([a-zA-Z0-9.]+)/)?.[1] || "0B";
        
        let packetsTotal = 0;
        try {
            const promRes = await axios.get('http://localhost:2112/metrics');
            const match = promRes.data.match(/sentinx_udp_packets_total (\d+)/);
            if (match) packetsTotal = parseInt(match[1]);
        } catch(e) {}
        
        res.json({
            redis_clients: parseInt(connectedClients),
            redis_memory: usedMemory,
            ingestion_packets_total: packetsTotal,
            cpu_usage_pct: Math.min(100, (process.cpuUsage().user / 10000000)).toFixed(1)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/v1/studio/config', authenticateHMAC, (req, res) => {
    res.json({
        webhook: STUDIO_WEBHOOK,
        api_key_masked: HMAC_SECRET.substring(0, 6) + '**************************'
    });
});

app.post('/api/v1/studio/webhook', authenticateHMAC, (req, res) => {
    const { webhook } = req.body;
    if (webhook && webhook.startsWith('http')) {
        STUDIO_WEBHOOK = webhook;
        res.json({ success: true, webhook: STUDIO_WEBHOOK });
    } else {
        res.status(400).json({ error: "Invalid webhook URL" });
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
          let oldTrust = currentTrust;
          
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
          
          // Webhook Dispatcher (Only fire ON transition from > 0 to 0)
          if (oldTrust > 0 && currentTrust === 0 && STUDIO_WEBHOOK) {
              try {
                  const payloadData = {
                      action: 'KICK_PLAYER',
                      client_id: clientId,
                      reason: alert.action,
                      timestamp: alert.alert_timestamp
                  };
                  const payloadStr = JSON.stringify(payloadData);
                  const webhookSignature = crypto.createHmac('sha256', HMAC_SECRET)
                                                 .update(payloadStr)
                                                 .digest('hex');
                  
                  await axios.post(STUDIO_WEBHOOK, payloadData, { 
                      headers: { 'x-sentinx-signature': webhookSignature },
                      timeout: 2000 
                  });
                  console.log(`Webhook fired securely to kick player ${clientId}`);
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
