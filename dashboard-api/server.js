import express from 'express';
import { WebSocketServer } from 'ws';
import { Kafka } from 'kafkajs';
import http from 'http';
import cors from 'cors';

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

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
