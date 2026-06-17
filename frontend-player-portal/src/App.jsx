import React, { useState } from 'react';
import { Search, ShieldAlert, CheckCircle, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';

function App() {
  const [clientId, setClientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // 'clean' | 'banned'
  const [evidence, setEvidence] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!clientId) return;
    setLoading(true);
    setResult(null);
    
    try {
      // Fetch Trust Score
      const res = await axios.get(`http://localhost:4000/api/v1/players/${clientId}/trust`, {
        headers: { 'x-sentinx-signature': 'dev-override-token' }
      });
      
      const isBanned = res.data.is_banned;
      setResult(isBanned ? 'banned' : 'clean');
      
      if (isBanned) {
        // Fetch Evidence
        try {
          const evRes = await axios.get(`http://localhost:4000/api/v1/appeals/${clientId}/evidence`, {
            headers: { 'x-sentinx-signature': 'dev-override-token' }
          });
          setEvidence(evRes.data.evidence);
        } catch (e) {
          setEvidence("Error retrieving cold storage data.");
        }
      }
    } catch (err) {
      // If player not found, assume clean for the portal
      setResult('clean');
    }
    setLoading(false);
  };

  return (
    <div className="portal-container">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: '40px' }}>
        <ShieldAlert size={48} color="var(--accent)" style={{ marginBottom: '20px' }} />
        <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '10px', letterSpacing: '-1px' }}>Ban Appeal Portal</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>Enter your SteamID or Hardware ID to check your standing.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="glass-box">
        <form onSubmit={handleSearch}>
          <input 
            type="text" 
            className="search-input" 
            placeholder="e.g. 76561198..." 
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Scanning Database...' : 'Check Status'}
          </button>
        </form>

        {result === 'clean' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ marginTop: '30px', textAlign: 'center' }}>
            <CheckCircle size={48} color="#00e676" style={{ margin: '0 auto 15px' }} />
            <h2 style={{ color: '#00e676', marginBottom: '10px' }}>No Bans Detected</h2>
            <p style={{ color: 'var(--text-muted)' }}>Your account is in good standing across all SentinelX protected titles.</p>
          </motion.div>
        )}

        {result === 'banned' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ marginTop: '30px' }}>
            <div style={{ textAlign: 'center', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
              <ShieldAlert size={48} color="var(--accent)" style={{ margin: '0 auto 15px' }} />
              <h2 style={{ color: 'var(--accent)', marginBottom: '10px' }}>Account Permanently Suspended</h2>
              <p style={{ color: 'var(--text-muted)' }}>
                The SentinelX Neural Network detected anomalous rotational velocities indicative of memory manipulation.
              </p>
            </div>
            
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}><FileText size={20}/> Cold Storage Evidence</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>This is the exact 60-frame telemetry tensor that triggered your ban.</p>
              <div className="evidence-box">
                {evidence ? JSON.stringify(evidence, null, 2) : "Fetching tensor..."}
              </div>
            </div>

            <button className="primary-btn" style={{ background: '#333', border: '1px solid #444', color: '#fff' }}>Submit Formal Appeal</button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default App;
