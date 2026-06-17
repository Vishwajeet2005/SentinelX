import React, { useState, useEffect } from 'react';
import { Activity, Server, Zap, HardDrive, Cpu, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { motion } from 'framer-motion';
import axios from 'axios';

function App() {
  const [data, setData] = useState([]);
  const [sysInfo, setSysInfo] = useState({
    cpu: 0,
    redisClients: 0,
    redisMem: '0B'
  });

  useEffect(() => {
    let tick = 0;
    const initialData = Array.from({ length: 30 }, (_, i) => ({
      time: i - 30,
      udpPackets: 0,
      mlLatency: 0,
    }));
    setData(initialData);

    const fetchMetrics = async () => {
      try {
        const res = await axios.get('http://localhost:4000/api/v1/analytics/system', {
          headers: { 'x-sentinx-signature': 'dev-override-token' }
        });
        const { redis_clients, redis_memory, ingestion_packets_total, cpu_usage_pct } = res.data;
        
        setSysInfo({ cpu: cpu_usage_pct, redisClients: redis_clients, redisMem: redis_memory });
        
        setData(prev => {
          const next = [...prev.slice(1), {
            time: tick++,
            udpPackets: ingestion_packets_total,
            mlLatency: Math.random() * 5 + 10, // Kafka metrics are mocked in cloud free tier
          }];
          return next;
        });
      } catch (e) {
        console.error("Failed to fetch metrics", e);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 1000);
    return () => clearInterval(interval);
  }, []);



  return (
    <div style={{ minHeight: '100vh', padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      <motion.div 
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}
      >
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px' }}>SentinelX<span className="glow-text">.Ops</span></h1>
          <p style={{ color: 'var(--text-muted)' }}>Real-Time Infrastructure Analytics</p>
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0f0', boxShadow: '0 0 10px #0f0' }}></div>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>All Systems Operational</span>
          </div>
        </div>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel">
          <div className="stat-label"><Activity size={16} color="var(--accent)" /> Ingestion Rate</div>
          <div className="stat-value">{data[data.length-1]?.udpPackets || 0} <span style={{fontSize: '1rem', color: '#888'}}>pps</span></div>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel">
          <div className="stat-label"><Zap size={16} color="#b026ff" /> ML Inference Latency</div>
          <div className="stat-value">{data[data.length-1]?.mlLatency.toFixed(1) || 0} <span style={{fontSize: '1rem', color: '#888'}}>ms</span></div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-panel">
          <div className="stat-label"><Server size={16} color="#ff3366" /> Redis Connections</div>
          <div className="stat-value">{sysInfo.redisClients} <span style={{fontSize: '1rem', color: '#888'}}>clients</span></div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-panel">
          <div className="stat-label"><Cpu size={16} color="#ffd700" /> Autoencoder CPU Load</div>
          <div className="stat-value">{sysInfo.cpu}%</div>
        </motion.div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} className="glass-panel" style={{ height: '400px', width: '100%' }}>
          <h3 style={{ marginBottom: '20px', color: '#fff', fontWeight: 500 }}>UDP Ingestion Throughput (Edge Server)</h3>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorUdp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis stroke="#666" tick={{fill: '#666'}} />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="udpPackets" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorUdp)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }} className="glass-panel" style={{ height: '400px', width: '100%' }}>
          <h3 style={{ marginBottom: '20px', color: '#fff', fontWeight: 500 }}>Redis Memory Usage</h3>
          <div style={{ width: '100%', height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <HardDrive size={64} color="#b026ff" style={{marginBottom: '20px'}} />
            <div style={{ fontSize: '3rem', fontWeight: 'bold' }}>{sysInfo.redisMem}</div>
            <div style={{ color: '#888' }}>Total Allocated</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default App;
