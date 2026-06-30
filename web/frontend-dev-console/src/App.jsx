import React from 'react';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

function App() {
  const lineData = [
    { name: 'Jan', val: 10 }, { name: 'Feb', val: 30 }, { name: 'Mar', val: 45 },
    { name: 'Apr', val: 30 }, { name: 'May', val: 60 }, { name: 'Jun', val: 50 },
    { name: 'Jul', val: 80 }, { name: 'Aug', val: 100 }, { name: 'Sep', val: 85 },
    { name: 'Oct', val: 120 }
  ];

  const barData = [
    { name: 'M', val: 40 }, { name: 'T', val: 60 }, { name: 'W', val: 100 },
    { name: 'T', val: 30 }, { name: 'F', val: 80 }, { name: 'S', val: 70 }
  ];

  const pieData = [
    { name: 'Aimbot', value: 400, color: '#f97316' },
    { name: 'Wallhack', value: 300, color: '#fb923c' },
    { name: 'Speedhack', value: 300, color: '#fdba74' },
    { name: 'Macro', value: 200, color: '#fed7aa' }
  ];

  const pieData2 = [
    { name: 'Latency', value: 40, color: '#38bdf8' },
    { name: 'Jitter', value: 30, color: '#7dd3fc' },
    { name: 'Packet Loss', value: 20, color: '#bae6fd' },
    { name: 'Other', value: 10, color: '#e0f2fe' }
  ];

  return (
    <div className="dashboard-container">
      
      {/* Top 4 Cards */}
      <div className="top-cards">
        <div className="metric-card solid-blue">
          <div>
            <div className="metric-title" style={{color: '#fff'}}>Total Active Matches</div>
            <div className="metric-value">120</div>
          </div>
          <div className="metric-footer">
            <span className="badge white">&uarr; 3%</span>
            <span>+10 Matches</span>
          </div>
        </div>
        
        <div className="metric-card solid-lightblue">
          <div>
            <div className="metric-title" style={{color: '#fff'}}>Connected Players</div>
            <div className="metric-value">450</div>
          </div>
          <div className="metric-footer">
            <span className="badge white" style={{color: '#dc2626'}}>&darr; -6%</span>
            <span>New: +20</span>
          </div>
        </div>

        <div className="metric-card outline-green">
          <div>
            <div className="metric-title">API Requests</div>
            <div className="metric-value" style={{color: '#10b981'}}>1.2M</div>
          </div>
          <div className="metric-footer">
            <span className="badge green">&uarr; 12%</span>
            <span style={{color: 'var(--text-muted)'}}>Avg: 100K/day</span>
          </div>
        </div>

        <div className="metric-card outline-orange">
          <div>
            <div className="metric-title">Pending Appeals</div>
            <div className="metric-value" style={{color: '#f97316'}}>320</div>
          </div>
          <div className="metric-footer">
            <span className="badge orange">&uarr; 13%</span>
            <span style={{color: 'var(--text-muted)'}}>Resolved: 120</span>
          </div>
        </div>
      </div>

      <div className="main-grid">
        
        {/* Large Line Chart */}
        <div className="chart-card outline-blue" style={{ gridRow: 'span 2' }}>
          <div className="chart-card-title" style={{color: 'var(--primary-blue)'}}>Ban Growth Trajectory</div>
          <div style={{ flex: 1, width: '100%', minHeight: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lineData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary-blue)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary-blue)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" hide />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <Area type="monotone" dataKey="val" stroke="var(--primary-blue)" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{textAlign: 'center', color: 'var(--primary-blue)', fontWeight: 500, marginTop: '10px', fontSize: '0.9rem'}}>Bans &rarr;</div>
        </div>

        {/* Medium Line Chart */}
        <div className="chart-card outline-orange">
          <div className="chart-card-title" style={{color: 'var(--primary-orange)'}}>Autoencoder Confidence</div>
          <div style={{ flex: 1, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <Line type="monotone" dataKey="val" stroke="var(--primary-orange)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Medium Bar Chart */}
        <div className="chart-card outline-navy">
          <div className="chart-card-title">Unique Hardware IDs</div>
          <div style={{ flex: 1, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <Bar dataKey="val" fill="var(--primary-navy)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{textAlign: 'center', color: 'var(--primary-navy)', fontWeight: 500, marginTop: '10px', fontSize: '0.9rem'}}>HWIDs &rarr;</div>
        </div>

        {/* Bottom Left: Pie */}
        <div className="chart-card outline-blue">
          <div className="chart-card-title" style={{color: 'var(--primary-blue)'}}>Violation Types</div>
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <div style={{ width: '120px', height: '120px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData2} innerRadius={0} outerRadius={60} dataKey="value" stroke="none">
                    {pieData2.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ marginLeft: '20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {pieData2.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '12px', height: '12px', background: d.color }}></div>
                  {d.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Center: Donut */}
        <div className="chart-card outline-orange">
          <div className="chart-card-title" style={{color: 'var(--primary-orange)'}}>Cheats by Engine</div>
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <div style={{ flex: 1, height: '150px', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={50} outerRadius={70} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '0.8rem', color: 'var(--primary-orange)', textAlign: 'center' }}>
                Engine<br/>Share
              </div>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><div style={{ width: '12px', height: '12px', background: '#f97316' }}></div> Unreal Engine 5</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><div style={{ width: '12px', height: '12px', background: '#fb923c' }}></div> Unity</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><div style={{ width: '12px', height: '12px', background: '#fdba74' }}></div> Custom</div>
            </div>
          </div>
        </div>

        {/* Bottom Right: Progress */}
        <div className="chart-card outline-navy">
          <div className="chart-card-title">Appeal Resolution Rate</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Total Appeals Resolved &rarr;</span>
            <span style={{color: 'var(--text-main)', fontWeight: 600}}>124</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Average Resolution Time &rarr;</span>
            <span style={{color: 'var(--text-main)', fontWeight: 600}}>3 Hours</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 500 }}>Current Resolution Rate:</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>72%</span>
            <span style={{color: '#cbd5e1'}}>28%</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: '72%' }}></div>
          </div>
        </div>

      </div>

    </div>
  );
}

export default App;
