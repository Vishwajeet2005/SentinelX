import React, { useState } from 'react';
import { Key, Globe, ShieldCheck, Copy, RefreshCw, BarChart2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function App() {
  const [apiKey, setApiKey] = useState('sentinx_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  const [webhook, setWebhook] = useState('https://api.mygame.com/anti-cheat/webhook');
  
  const mockData = [
    { name: 'Mon', bans: 400 },
    { name: 'Tue', bans: 300 },
    { name: 'Wed', bans: 550 },
    { name: 'Thu', bans: 200 },
    { name: 'Fri', bans: 700 },
    { name: 'Sat', bans: 900 },
    { name: 'Sun', bans: 850 },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div style={{ width: '260px', background: 'var(--panel-bg)', borderRight: '1px solid var(--border-color)', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
          <ShieldCheck color="var(--accent)" size={28} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>SentinelX</h2>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ padding: '10px', background: 'var(--bg-color)', borderRadius: '8px', color: 'var(--accent)', fontWeight: 500, display: 'flex', gap: '10px' }}>
            <Key size={18} /> API Keys
          </div>
          <div style={{ padding: '10px', borderRadius: '8px', color: 'var(--text-muted)', display: 'flex', gap: '10px', cursor: 'pointer' }}>
            <Globe size={18} /> Webhooks
          </div>
          <div style={{ padding: '10px', borderRadius: '8px', color: 'var(--text-muted)', display: 'flex', gap: '10px', cursor: 'pointer' }}>
            <BarChart2 size={18} /> Global Analytics
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '40px', maxWidth: '1000px' }}>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '8px' }}>Developer Console</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '40px' }}>Manage your game studio's integration with SentinelX.</p>
        </motion.div>

        <div style={{ display: 'grid', gap: '30px' }}>
          
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="saas-panel">
            <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}><Key size={20}/> Secret API Key</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '15px' }}>
              Use this key to authenticate requests from your Game Servers to the SentinelX Enterprise API. Do not expose this in client binaries.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="password" value={apiKey} readOnly className="saas-input" style={{ marginTop: 0 }} />
              <button className="saas-btn secondary"><Copy size={16}/></button>
              <button className="saas-btn secondary"><RefreshCw size={16}/></button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="saas-panel">
            <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}><Globe size={20}/> Webhook Endpoint</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '15px' }}>
              When the PyTorch Autoencoder detects a zero-day speedhack, SentinelX will send a cryptographically signed POST request to this URL to kick the player.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="text" value={webhook} onChange={(e) => setWebhook(e.target.value)} className="saas-input" style={{ marginTop: 0 }} />
              <button className="saas-btn">Save</button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="saas-panel" style={{ height: '400px' }}>
            <h3 style={{ marginBottom: '20px' }}>Blocked Cheaters (7 Days)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" />
                <Tooltip contentStyle={{ background: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                <Line type="monotone" dataKey="bans" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

        </div>
      </div>
    </div>
  );
}

export default App;
