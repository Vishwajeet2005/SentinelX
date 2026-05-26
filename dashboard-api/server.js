import express from 'express';
import { WebSocketServer } from 'ws';
import { Kafka } from 'kafkajs';
import http from 'http';
import cors from 'cors';

const app = express();

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

const kafka = new Kafka({
  clientId: 'dashboard-api',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'moderation-dashboard-group' });

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
          console.log('Broadcasting alert:', alert);
          
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

server.listen(4000, () => {
  console.log('SentinX Dashboard API running on ws://localhost:4000');
});
