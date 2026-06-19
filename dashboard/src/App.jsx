import React from 'react';
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, CartesianGrid } from 'recharts';

function App() {
  const sparklineData = Array.from({length: 20}, () => ({ val: Math.random() * 100 }));
  const trafficData = Array.from({length: 24}, (_, i) => ({ time: `${i}:00`, pc: 20000 + Math.random()*2000, console: 5000 + Math.random()*500 }));
  
  const horizontalBars = [
    { name: 'N California', aimbot: 80, wallhack: 60, speedhack: 40 },
    { name: 'London', aimbot: 70, wallhack: 50, speedhack: 30 },
    { name: 'Paris', aimbot: 60, wallhack: 45, speedhack: 25 },
    { name: 'Amsterdam', aimbot: 55, wallhack: 40, speedhack: 20 },
    { name: 'Frankfurt', aimbot: 50, wallhack: 35, speedhack: 15 },
    { name: 'N Virginia', aimbot: 40, wallhack: 30, speedhack: 10 },
  ];

  const cpuData = [
    { name: 'Auth', user: 50, sys: 30, idle: 20 },
    { name: 'CDN', user: 60, sys: 20, idle: 20 },
    { name: 'Database', user: 40, sys: 40, idle: 20 },
    { name: 'Load Balancer', user: 70, sys: 10, idle: 20 },
    { name: 'Network', user: 55, sys: 25, idle: 20 },
    { name: 'Security', user: 80, sys: 15, idle: 5 },
    { name: 'Storage', user: 30, sys: 50, idle: 20 },
    { name: 'Web Server', user: 45, sys: 35, idle: 20 },
  ];

  return (
    <div className="dashboard-layout">
      <h1 className="dashboard-title">Monitoring & Performance</h1>

      <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px'}}>
        <div className="card">
            <div className="card-title">Anti-Cheat Incident Management (last 24 hours)</div>
            <div className="top-incidents">
                <div className="incident-box">
                    <div className="header">Moderate</div>
                    <div className="val-row"><span className="value">93</span><span className="sub">&darr; 71%</span></div>
                    <div style={{height: '40px', marginTop: '10px'}}><ResponsiveContainer width="100%" height="100%"><LineChart data={sparklineData}><Line type="monotone" dataKey="val" stroke="#2d3748" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
                </div>
                <div className="incident-box">
                    <div className="header">High</div>
                    <div className="val-row"><span className="value">7</span><span className="sub">&darr; 53%</span></div>
                    <div style={{height: '40px', marginTop: '10px'}}><ResponsiveContainer width="100%" height="100%"><LineChart data={sparklineData}><Line type="monotone" dataKey="val" stroke="#2d3748" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
                </div>
                <div className="incident-box">
                    <div className="header">Critical</div>
                    <div className="val-row"><span className="value">0</span><span className="sub" style={{color: '#38a169'}}>&darr; 1</span></div>
                    <div style={{height: '40px', marginTop: '10px'}}><ResponsiveContainer width="100%" height="100%"><LineChart data={sparklineData}><Line type="step" dataKey="val" stroke="#2d3748" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
                </div>
                <div className="incident-box">
                    <div className="header">Resolved</div>
                    <div className="val-row"><span className="value">1,520</span><span className="sub">&darr; 281</span></div>
                    <div style={{height: '40px', marginTop: '10px'}}><ResponsiveContainer width="100%" height="100%"><LineChart data={sparklineData}><Line type="monotone" dataKey="val" stroke="#2d3748" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
                </div>
            </div>
        </div>

        <div className="card">
            <div className="card-title">Performance Metrics (last 24 hours)</div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <div>
                    <div style={{fontSize: '11px', fontWeight: 600, color: '#a0aec0', marginBottom: '8px'}}>Latency</div>
                    <div style={{fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'baseline', gap: '4px'}}>Web <span style={{fontSize: '24px', fontWeight: 700}}>0</span><span style={{fontSize: '12px'}}>ms</span></div>
                    <div style={{fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'baseline', gap: '4px'}}>Mobile <span style={{fontSize: '20px', fontWeight: 700}}>11</span><span style={{fontSize: '12px'}}>ms</span></div>
                </div>
                <div>
                    <div style={{fontSize: '11px', fontWeight: 600, color: '#a0aec0', marginBottom: '8px'}}>Response Time</div>
                    <div style={{fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'baseline', gap: '4px'}}>Web <span style={{fontSize: '20px', fontWeight: 700}}>418</span><span style={{fontSize: '12px'}}>ms</span></div>
                    <div style={{fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'baseline', gap: '4px'}}>Mobile <span style={{fontSize: '20px', fontWeight: 700}}>418</span><span style={{fontSize: '12px'}}>ms</span></div>
                </div>
                <div style={{textAlign: 'center'}}>
                    <div style={{fontSize: '11px', fontWeight: 600, color: '#a0aec0', marginBottom: '8px'}}>False Positives</div>
                    <div style={{fontSize: '32px', fontWeight: 700, lineHeight: 1}}>93<span style={{fontSize: '11px', color: '#e53e3e', marginLeft: '4px'}}>&darr; 226</span></div>
                </div>
                <div style={{textAlign: 'center'}}>
                    <div style={{fontSize: '11px', fontWeight: 600, color: '#a0aec0', marginBottom: '8px'}}>Hardware Bans</div>
                    <div style={{fontSize: '32px', fontWeight: 700, lineHeight: 1}}>418<span style={{fontSize: '11px', color: '#a0aec0', marginLeft: '4px'}}>&uarr; 418</span></div>
                </div>
            </div>
        </div>
      </div>

      <div className="chart-row">
        <div className="card">
            <div className="card-title">Unique Players (by hour)</div>
            <div style={{height: '200px'}}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trafficData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <YAxis tick={{fontSize: 10}} width={40} />
                        <Line type="step" dataKey="pc" stroke="#e53e3e" strokeWidth={2} dot={{r: 2}} />
                        <Line type="step" dataKey="console" stroke="#3182ce" strokeWidth={2} dot={{r: 2}} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div style={{display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '11px'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}><div style={{width:'8px',height:'8px',background:'#3182ce',borderRadius:'50%'}}></div> PC Traffic</div>
                <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}><div style={{width:'8px',height:'8px',background:'#e53e3e',borderRadius:'50%'}}></div> Console Traffic</div>
            </div>
        </div>

        <div className="card">
            <div className="card-title">Account Management & Appeals (Last Hour)</div>
            <div style={{marginTop: '40px', padding: '0 20px'}}>
                <div style={{height: '40px', display: 'flex', background: '#edf2f7', position: 'relative'}}>
                    <div style={{width: '75%', background: '#38a169', height: '100%'}}></div>
                    <div style={{width: '15%', background: '#e53e3e', height: '100%'}}></div>
                    <div style={{width: '10%', background: '#d69e2e', height: '100%'}}></div>
                    
                    <div style={{position: 'absolute', right: '10%', top: '-30px', background: '#2d3748', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700}}>89.00%</div>
                    <div style={{position: 'absolute', right: '10%', top: '-4px', bottom: '-4px', width: '2px', background: '#2d3748'}}></div>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: '#a0aec0'}}>
                    <span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span>
                </div>
                <div style={{display: 'flex', gap: '16px', marginTop: '24px', fontSize: '11px', fontWeight: 600}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><div style={{width: '12px', height:'12px', background:'#38a169'}}></div> Successful Login</div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><div style={{width: '12px', height:'12px', background:'#e53e3e'}}></div> HWID Blocked</div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><div style={{width: '12px', height:'12px', background:'#d69e2e'}}></div> Appeal Submitted</div>
                </div>
            </div>
        </div>

        <div className="card">
            <div className="card-title">Currently Banned Processes</div>
            <table className="data-table">
                <thead>
                    <tr><th>ID</th><th>Application</th><th>Process</th><th>Last Seen</th><th>Progress</th></tr>
                </thead>
                <tbody>
                    {['ID-001','ID-002','ID-003','ID-004','ID-005'].map(id => (
                        <tr key={id}>
                            <td>{id}</td>
                            <td style={{fontWeight: 600}}>GAME_CLIENT</td>
                            <td>engine.exe</td>
                            <td>2026-06-19 14:00</td>
                            <td>
                                <div className="progress-bar">
                                    <div className={`progress-segment ${Math.random()>0.5?'active':''}`}></div>
                                    <div className={`progress-segment ${Math.random()>0.5?'active':''}`}></div>
                                    <div className={`progress-segment ${Math.random()>0.5?'active':''}`}></div>
                                    <div className={`progress-segment ${Math.random()>0.5?'active':''}`}></div>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      <div className="bottom-row">
        <div className="card" style={{gridColumn: 'span 2'}}>
            <div className="card-title">Detection Distribution Network Health</div>
            <div style={{display: 'flex'}}>
                <div style={{flex: 1}}>
                    {horizontalBars.map(row => (
                        <div className="horizontal-bar-row" key={row.name}>
                            <div className="h-bar-label">{row.name}</div>
                            <div className="h-bar-track">
                                <div className="h-bar-fill" style={{width: `${row.aimbot}%`, background: '#fc8181'}}></div>
                                <div className="h-bar-fill" style={{width: `${row.wallhack}%`, background: '#f6ad55'}}></div>
                                <div className="h-bar-fill" style={{width: `${row.speedhack}%`, background: '#63b3ed'}}></div>
                            </div>
                        </div>
                    ))}
                    <div style={{marginLeft: '92px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#a0aec0', marginTop: '4px'}}>
                        <span>0</span><span>50</span><span>100</span><span>150</span><span>200</span><span>250</span><span>300</span><span>350</span><span>400</span>
                    </div>
                </div>
                <div style={{width: '120px', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px', fontWeight: 600}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}><div style={{width:'8px',height:'8px',background:'#fc8181'}}></div> Aimbot</div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}><div style={{width:'8px',height:'8px',background:'#f6ad55'}}></div> Wallhack</div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}><div style={{width:'8px',height:'8px',background:'#63b3ed'}}></div> Speedhack</div>
                </div>
            </div>
        </div>

        <div className="card">
            <div className="card-title">Infrastructure CPU Usage</div>
            <div style={{height: '180px'}}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cpuData} margin={{top:0,right:0,left:-20,bottom:0}}>
                        <YAxis tick={{fontSize: 10}} width={30} />
                        <XAxis dataKey="name" tick={{fontSize: 9}} interval={0} angle={-30} textAnchor="end" />
                        <Bar dataKey="user" stackId="a" fill="#ed8936" />
                        <Bar dataKey="sys" stackId="a" fill="#fbd38d" />
                        <Bar dataKey="idle" stackId="a" fill="#fc8181" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

    </div>
  );
}

export default App;
