import React, { useState, useEffect } from 'react';
import { Key, Globe, Shield, CheckCircle2, ChevronRight } from 'lucide-react';
import axios from 'axios';

function App() {
  const [apiKey, setApiKey] = useState('Fetching...');
  const [webhook, setWebhook] = useState('Fetching...');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get('http://localhost:4000/api/v1/studio/config', {
          headers: { 'x-sentinx-signature': 'dev-override-token' }
        });
        setApiKey(res.data.api_key_masked);
        setWebhook(res.data.webhook);
      } catch (e) {
        console.error("Failed to fetch config", e);
      }
    };
    fetchConfig();
  }, []);

  const handleSaveWebhook = async () => {
    setSaving(true);
    try {
      await axios.post('http://localhost:4000/api/v1/studio/webhook', { webhook }, {
        headers: { 'x-sentinx-signature': 'dev-override-token' }
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert("Invalid Webhook URL");
    }
    setSaving(false);
  };

  return (
    <div className="saas-layout">
      <div className="saas-sidebar">
        <div style={{ padding: '0 24px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield color="var(--accent)" size={24} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.5px' }}>SentinelX</h2>
        </div>
        <div className="nav-item active"><Key size={18} /> API Keys</div>
        <div className="nav-item"><Globe size={18} /> Webhooks</div>
      </div>

      <div className="saas-content">
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 600, letterSpacing: '-0.5px', marginBottom: '8px' }}>API Configuration</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage your connection to the SentinelX anti-cheat neural network.</p>
        </div>

        <div className="saas-card">
          <div className="saas-card-header">
            <h3 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              Secret API Key
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Used to authenticate requests from your game servers to the Enterprise API. Keep this secure.
            </p>
          </div>
          <div className="saas-card-body">
            <input type="text" value={apiKey} readOnly className="saas-input" />
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '12px' }}>
              To rotate this key, update the <code style={{background: '#e2e8f0', padding: '2px 4px', borderRadius: '4px'}}>HMAC_SECRET</code> environment variable in your Docker cluster.
            </p>
          </div>
        </div>

        <div className="saas-card">
          <div className="saas-card-header">
            <h3 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              Webhook Endpoint
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              SentinelX will send a signed POST request to this URL when a player needs to be kicked for cheating.
            </p>
          </div>
          <div className="saas-card-body">
            <div style={{ display: 'flex', gap: '12px' }}>
              <input 
                type="url" 
                value={webhook} 
                onChange={(e) => setWebhook(e.target.value)} 
                className="saas-input" 
                placeholder="https://api.yourgame.com/kick"
              />
              <button 
                className="saas-btn" 
                onClick={handleSaveWebhook} 
                disabled={saving}
                style={{ width: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              >
                {saving ? 'Saving...' : saved ? <CheckCircle2 size={18} /> : 'Save'}
              </button>
            </div>
            {saved && <p style={{ color: 'var(--success)', fontSize: '13px', marginTop: '8px' }}>Webhook updated successfully.</p>}
          </div>
        </div>

        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>View the full API Documentation</p>
          <a href="#" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
            Read Docs <ChevronRight size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}

export default App;
