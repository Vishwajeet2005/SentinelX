import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, ExternalLink, Zap } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';

function App() {
  const [data, setData] = useState([]);
  const [totalRequests, setTotalRequests] = useState(0);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await axios.get('http://localhost:4000/api/v1/analytics/system', {
          headers: { 'x-sentinx-signature': 'dev-override-token' }
        });
        const total = res.data.ingestion_packets_total || 58573;
        
        const history = [];
        for (let i = 7; i >= 0; i--) {
            history.push({
                date: `Dec ${17 - i}`,
                success: Math.floor(total / 8) - Math.floor(Math.random() * 500),
                errors: Math.floor(Math.random() * 100),
                rateLimited: Math.floor(Math.random() * 20)
            });
        }
        setData(history);
        setTotalRequests(total);
      } catch (e) {
        console.error("Failed to fetch metrics", e);
        // Fallback mock
        const history = [];
        for (let i = 7; i >= 0; i--) {
            history.push({
                date: `Dec ${17 - i}`,
                success: 15000 + Math.floor(Math.random() * 5000),
                errors: Math.floor(Math.random() * 1000),
                rateLimited: Math.floor(Math.random() * 200)
            });
        }
        setData(history);
        setTotalRequests(120485);
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const donutData = [
    { name: 'Success', value: totalRequests * 0.984, color: '#c4b5fd' },
    { name: 'Errors', value: totalRequests * 0.014, color: '#fde047' },
    { name: 'Rate-limited', value: totalRequests * 0.002, color: '#f87171' }
  ];

  return (
    <div>
      <div className="dashboard-header">
        <div className="brand-title">Company <span style={{fontWeight: 400}}>/</span> Developers</div>
        <button style={{background: '#fff', border: '1px solid #eaeaea', padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'}}>
            Developer documentation <ExternalLink size={14} />
        </button>
      </div>
      
      <div className="nav-tabs">
          <div className="nav-tab">All apps</div>
          <div className="nav-tab">API tokens</div>
          <div className="nav-tab active">API analytics</div>
      </div>

      <div className="container">
        <div className="top-bar">
          <div className="date-picker">
            <Calendar size={14} /> Dec 10, 2026 &rarr; Dec 17, 2026
          </div>
          <div style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>Last updated just now</div>
        </div>

        <div className="alert-banner">
            <AlertCircle size={16} /> 
            <span style={{flex: 1}}>Some of your API requests failed because you exceeded your plan's rate limit of 200 requests per minute. Upgrade to a higher limit to avoid disruptions.</span>
            <a href="#" style={{color: '#7b52cc', fontWeight: 600, textDecoration: 'none'}}>Get add-on</a>
            <a href="#" style={{color: '#7b52cc', fontWeight: 600, textDecoration: 'none'}}>Learn more</a>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginBottom: '20px' }}>
          
          {/* Left Panel: Donut Chart */}
          <div className="glass-panel">
            <div className="chart-title">API requests</div>
            <div style={{ position: 'relative', width: '100%', height: '250px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} innerRadius={70} outerRadius={100} paddingAngle={2} dataKey="value" stroke="none">
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <div className="donut-label">Total requests</div>
                <div className="donut-value">{totalRequests.toLocaleString()}</div>
              </div>
            </div>

            <div style={{marginTop: '20px'}}>
                {donutData.map(d => (
                    <div key={d.name} style={{display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.85rem'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <div style={{width: '8px', height: '8px', background: d.color, borderRadius: '2px'}}></div>
                            <span style={{color: 'var(--text-muted)'}}>{d.name}</span>
                        </div>
                        <div>
                            <span style={{fontWeight: 500, marginRight: '8px'}}>{Math.floor(d.value).toLocaleString()}</span>
                            <span style={{color: 'var(--text-muted)'}}>{((d.value/totalRequests)*100).toFixed(1)}%</span>
                        </div>
                    </div>
                ))}
            </div>
          </div>
          
          {/* Right Panel: Bar Chart */}
          <div className="glass-panel">
            <div className="chart-title">API requests over time</div>
            <div style={{ width: '100%', height: '320px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} tickFormatter={(v) => v >= 1000 ? `${v/1000}K` : v} />
                  <Tooltip cursor={{fill: '#f9f9f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="success" stackId="a" fill="#c4b5fd" radius={[0,0,4,4]} />
                  <Bar dataKey="errors" stackId="a" fill="#fde047" />
                  <Bar dataKey="rateLimited" stackId="a" fill="#f87171" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{display: 'flex', gap: '16px', marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><div style={{width: '8px', height: '8px', background: '#c4b5fd', borderRadius: '2px'}}></div> Success</div>
                <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><div style={{width: '8px', height: '8px', background: '#fde047', borderRadius: '2px'}}></div> Errors</div>
                <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><div style={{width: '8px', height: '8px', background: '#f87171', borderRadius: '2px'}}></div> Rate-limited</div>
            </div>
          </div>

        </div>

        {/* Bottom Panel: Table */}
        <div className="glass-panel">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div className="chart-title" style={{marginBottom: 0}}>Endpoint breakdown</div>
                <input type="text" placeholder="Search" style={{padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.85rem', outline: 'none'}} />
            </div>
            <table className="stat-table">
                <thead>
                    <tr>
                        <th>Route</th>
                        <th>Method</th>
                        <th>Total requests &darr;</th>
                        <th>Rate-limited</th>
                        <th>Success</th>
                        <th>Client errors</th>
                        <th>Server errors</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style={{color: 'var(--text-main)', fontWeight: 500}}>/api/v1/telemetry/ingest</td>
                        <td>POST</td>
                        <td>18,900</td>
                        <td>15</td>
                        <td>18,875</td>
                        <td>10</td>
                        <td>0</td>
                    </tr>
                    <tr>
                        <td style={{color: 'var(--text-main)', fontWeight: 500}}>/api/v1/analytics/system</td>
                        <td>GET</td>
                        <td>15,426</td>
                        <td>21</td>
                        <td>15,405</td>
                        <td>0</td>
                        <td>0</td>
                    </tr>
                    <tr>
                        <td style={{color: 'var(--text-main)', fontWeight: 500}}>/api/v1/players/:clientId/trust</td>
                        <td>GET</td>
                        <td>15,417</td>
                        <td>13</td>
                        <td>15,404</td>
                        <td>0</td>
                        <td>0</td>
                    </tr>
                </tbody>
            </table>
        </div>

      </div>
    </div>
  );
}

export default App;
