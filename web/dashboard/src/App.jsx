import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { Target, Shield, Users, Map, Play, Square, ChevronRight, ChevronDown, Monitor, Cpu, Database, Server, Terminal, Activity } from 'lucide-react';
import axios from 'axios';

function App() {
  // --- Graph State Logic ---
  const [sparklineData, setSparklineData] = useState(Array.from({length: 20}, () => ({ val: 50 + Math.random() * 20 })));
  const [trafficData, setTrafficData] = useState(Array.from({length: 24}, (_, i) => ({ time: `${i}:00`, pc: 20000 + Math.random()*2000, console: 5000 + Math.random()*500 })));
  const [cpuData, setCpuData] = useState([
    { name: 'Auth', user: 50, sys: 30, idle: 20 },
    { name: 'CDN', user: 60, sys: 20, idle: 20 },
    { name: 'Database', user: 40, sys: 40, idle: 20 },
    { name: 'Web', user: 45, sys: 35, idle: 20 },
  ]);
  const [horizontalBars, setHorizontalBars] = useState([
    { name: 'N California', aimbot: 80, wallhack: 60, speedhack: 40 },
    { name: 'London', aimbot: 70, wallhack: 50, speedhack: 30 },
    { name: 'Paris', aimbot: 60, wallhack: 45, speedhack: 25 },
    { name: 'Amsterdam', aimbot: 55, wallhack: 40, speedhack: 20 },
  ]);

  const [metrics, setMetrics] = useState({
    hardwareBans: 418,
    incidentsMod: 93,
    incidentsHigh: 7,
    incidentsCrit: 0,
    incidentsRes: 1520
  });

  const [latency, setLatency] = useState({ web: 0, mobile: 11 });

  // --- Dynamic Tracking Logic ---
  const [alertsMap, setAlertsMap] = useState({});
  const alerts = useMemo(() => Object.values(alertsMap).slice(0, 15), [alertsMap]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [simMode, setSimMode] = useState(true);
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [cmdInput, setCmdInput] = useState('');
  const [evidence, setEvidence] = useState(null);

  const logsRef = useRef(null);

  const logEvent = (msg) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-40));
  };

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  // Command handling
  const handleCommand = (e) => {
    if (e.key === 'Enter') {
      const cmd = cmdInput.trim();
      setCmdInput('');
      if (!cmd) return;
      logEvent(`> ${cmd}`);
      
      const parts = cmd.toLowerCase().split(' ');
      const action = parts[0];
      
      if (action === 'help') {
        logEvent('Available commands: help, clear, status, ban <id>, ban all');
      } else if (action === 'clear') {
        setLogs([]);
      } else if (action === 'status') {
        logEvent(`Engine Sim: ${simMode ? 'ON' : 'OFF'} | WSS: ${connected ? 'CONNECTED' : 'DISCONNECTED'}`);
      } else if (action === 'ban' && parts[1]) {
        if (parts[1] === 'all') {
            logEvent(`Cmd: Mass ban executed.`);
            setMetrics(p => ({...p, hardwareBans: p.hardwareBans + alerts.length}));
            setAlertsMap({});
            setSelectedAlert(null);
        } else {
            logEvent(`Cmd: DestroyActor ${parts[1]} (Banned via Cmd)`);
            setMetrics(p => ({...p, hardwareBans: p.hardwareBans + 1}));
            setAlertsMap(prev => {
                const next = {...prev};
                delete next[parts[1]];
                return next;
            });
            if (selectedAlert?.id.toLowerCase() === parts[1]) setSelectedAlert(null);
        }
      } else {
        logEvent(`Unknown command: '${cmd}'. Type 'help' for a list of commands.`);
      }
    }
  };

  // Evidence fetching
  useEffect(() => {
    if (selectedAlert) {
      const clientId = selectedAlert.id.replace('PlayerController_', '');
      axios.get(`http://localhost:4000/api/v1/appeals/${clientId}/evidence`, {
        headers: { 'x-sentinx-signature': 'dev-override-token' }
      }).then(res => setEvidence(res.data.evidence)).catch(() => setEvidence(null));
    } else {
      setEvidence(null);
    }
  }, [selectedAlert]);

  // Graph Jitter Simulation
  useEffect(() => {
    if (!simMode) return;
    const interval = setInterval(() => {
        setSparklineData(prev => {
            const next = [...prev.slice(1)];
            next.push({ val: 50 + Math.random() * 30 });
            return next;
        });

        setTrafficData(prev => {
            const next = [...prev.slice(1)];
            const lastHour = parseInt(prev[prev.length-1].time.split(':')[0]);
            const nextHour = (lastHour + 1) % 24;
            next.push({ time: `${nextHour}:00`, pc: 20000 + Math.random()*5000, console: 5000 + Math.random()*1500 });
            return next;
        });

        setCpuData(prev => prev.map(c => {
            const user = Math.max(10, Math.min(80, c.user + (Math.random() * 20 - 10)));
            const sys = Math.max(10, Math.min(50, c.sys + (Math.random() * 10 - 5)));
            return { ...c, user, sys, idle: Math.max(0, 100 - user - sys) };
        }));

        setHorizontalBars(prev => prev.map(b => {
            return {
                ...b,
                aimbot: Math.max(10, b.aimbot + (Math.random() * 6 - 3)),
                wallhack: Math.max(10, b.wallhack + (Math.random() * 6 - 3)),
                speedhack: Math.max(10, b.speedhack + (Math.random() * 6 - 3))
            };
        }));
        
        setLatency({
            web: Math.floor(Math.random() * 3),
            mobile: Math.floor(Math.random() * 15 + 5)
        });
        
    }, 2000);
    return () => clearInterval(interval);
  }, [simMode]);

  // WebSocket & Alert Simulation logic
  useEffect(() => {
    if (simMode) {
      if (alertsMap && Object.keys(alertsMap).length === 0) logEvent("LogInit: SentinX SDK Bound to Engine Simulation Loop");
      const simInterval = setInterval(() => {
        if (Math.random() > 0.4) {
          const id = "PlayerController_" + Math.floor(Math.random() * 9000);
          const matchId = "MATCH-" + Math.floor(Math.random() * 9999).toString(16).toUpperCase();
          const steamId = "76561198" + Math.floor(Math.random() * 99999999);
          const violations = ["Aimbot (Pitch Snap)", "Speedhack (Tickrate x2.5)", "Wallhack (ESP Read)", "NoRecoil (Memory Patch)"];
          const violation = violations[Math.floor(Math.random() * violations.length)];
          const mapName = ["Map_Dust", "Level_Erangel", "Arena_01", "Level_Shipment"][Math.floor(Math.random() * 4)];
          const server = ["US-East-1", "EU-West", "AP-South"][Math.floor(Math.random() * 3)];
          
          const newAlert = {
            id, matchId, steamId, violation, mapName, server,
            ping: Math.floor(Math.random() * 80) + 10,
            weapon: ["AK-47", "AWP Sniper", "M4A1", "Combat Knife"][Math.floor(Math.random() * 4)],
            baseX: Math.random() * 2000 - 1000,
            baseY: Math.random() * 2000 - 1000,
            time: new Date().toLocaleTimeString()
          };
          
          setMetrics(p => ({
              ...p,
              incidentsMod: p.incidentsMod + (violation.includes('Wallhack') || violation.includes('Recoil') ? 1 : 0),
              incidentsHigh: p.incidentsHigh + (violation.includes('Aimbot') || violation.includes('Speed') ? 1 : 0)
          }));
          
          setAlertsMap(prev => {
            const next = {...prev};
            next[id] = newAlert;
            return next;
          });
          logEvent(`LogSentinX: Cheat Detected in ${matchId}. Violator: ${id}`);
        }
      }, 1500);
      return () => clearInterval(simInterval);
    }

    logEvent("LogInit: Attempting connection to WSS broker...");
    const ws = new WebSocket('ws://localhost:4000');
    ws.onopen = () => { setConnected(true); logEvent("LogSentinX: WSS CONNECTED to Broker"); };
    ws.onclose = () => { setConnected(false); logEvent("LogSentinX: WSS DISCONNECTED"); };
    
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'ALERT') {
        const id = "PlayerController_" + msg.data.client_id;
        const newAlert = {
            id, matchId: "MATCH-LIVE", steamId: "76561198" + msg.data.client_id, 
            violation: "Aimbot (Pitch Snap)", mapName: "Level_Live", server: "US-East-1",
            ping: 30, weapon: "AK-47", baseX: 0, baseY: 0, time: new Date().toLocaleTimeString()
        };
        setAlertsMap(prev => {
            const next = {...prev};
            next[id] = newAlert;
            return next;
        });
        logEvent(`LogSentinX: Live Cheat Event. Violator: ${id}`);
      }
    };
    return () => ws.close();
  }, [simMode]);

  return (
    <div className="dashboard-layout">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1 className="dashboard-title">Monitoring & Performance</h1>
        <div style={{display: 'flex', alignItems: 'center', gap: '24px'}}>
            <div style={{fontSize: '12px', fontWeight: 600, color: connected ? 'var(--accent-green)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.05em'}}>
                <Activity size={14} />
                {connected ? 'WSS CONNECTED' : 'DISCONNECTED'}
            </div>
            <button className="btn-minimal" onClick={() => setSimMode(!simMode)} style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                {simMode ? <Square size={12}/> : <Play size={12}/>} {simMode ? 'Stop Simulation' : 'Simulate Engine Detections'}
            </button>
        </div>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px'}}>
        {/* Top left incidents */}
        <div className="card">
            <div className="card-title">Incident Velocity (Last 24h)</div>
            <div className="top-incidents">
                <div className="incident-box">
                    <div className="header">Moderate</div>
                    <div className="val-row"><span className="value">{metrics.incidentsMod}</span><span className="sub down">&darr; 71%</span></div>
                    <div style={{height: '32px', marginTop: '16px'}}><ResponsiveContainer width="100%" height="100%"><LineChart data={sparklineData}><Line type="step" dataKey="val" stroke="var(--text-muted)" strokeWidth={1} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
                </div>
                <div className="incident-box">
                    <div className="header">High</div>
                    <div className="val-row"><span className="value">{metrics.incidentsHigh}</span><span className="sub down">&darr; 53%</span></div>
                    <div style={{height: '32px', marginTop: '16px'}}><ResponsiveContainer width="100%" height="100%"><LineChart data={sparklineData}><Line type="step" dataKey="val" stroke="var(--text-muted)" strokeWidth={1} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
                </div>
                <div className="incident-box">
                    <div className="header">Critical</div>
                    <div className="val-row"><span className="value">{metrics.incidentsCrit}</span><span className="sub down">&darr; 1</span></div>
                    <div style={{height: '32px', marginTop: '16px'}}><ResponsiveContainer width="100%" height="100%"><LineChart data={sparklineData}><Line type="step" dataKey="val" stroke="var(--text-main)" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
                </div>
                <div className="incident-box">
                    <div className="header">Resolved</div>
                    <div className="val-row"><span className="value">{metrics.incidentsRes}</span><span className="sub up">&uarr; 281</span></div>
                    <div style={{height: '32px', marginTop: '16px'}}><ResponsiveContainer width="100%" height="100%"><LineChart data={sparklineData}><Line type="step" dataKey="val" stroke="var(--text-muted)" strokeWidth={1} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
                </div>
            </div>
        </div>

        {/* Top Right Cmd Log */}
        <div className="card" style={{display: 'flex', flexDirection: 'column'}}>
            <div className="card-title" style={{display: 'flex', alignItems: 'center', gap: '6px', borderBottom: 'none', marginBottom: '8px'}}><Terminal size={14}/> SOC Command Interface</div>
            <div className="terminal-block" ref={logsRef} style={{flex: 1, maxHeight: '140px'}}>
                {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
            <div className="terminal-input-wrapper">
                <span style={{color: 'var(--text-muted)', fontWeight: 700}}>&gt;</span>
                <input 
                    type="text" 
                    value={cmdInput} 
                    onChange={e => setCmdInput(e.target.value)} 
                    onKeyDown={handleCommand}
                    placeholder="Enter command (e.g. 'help')..."
                />
            </div>
        </div>
      </div>

      <div className="chart-row">
        {/* Live Detections Feed */}
        <div className="card" style={{gridColumn: 'span 2'}}>
            <div className="card-title" style={{display: 'flex', justifyContent: 'space-between', borderBottom: 'none'}}>
                <span>Live ML Detections Feed</span>
                <span style={{color: 'var(--ue-alert)', fontSize: '11px', fontWeight: 600}}>{alerts.length} Active Alerts</span>
            </div>
            
            <div style={{display: 'flex', gap: '24px'}}>
                {/* Table */}
                <div style={{flex: 1, maxHeight: '250px', overflowY: 'auto'}}>
                    <table className="data-table">
                        <thead style={{position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10}}>
                            <tr><th>Time</th><th>Player ID</th><th>Match ID</th><th>Violation</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                            {alerts.length === 0 ? (
                                <tr><td colSpan="5" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>No active anomalies detected.</td></tr>
                            ) : (
                                alerts.map(a => (
                                    <tr key={a.id} className={selectedAlert?.id === a.id ? 'selected' : ''} style={{cursor: 'pointer'}} onClick={() => setSelectedAlert(a)}>
                                        <td>{a.time}</td>
                                        <td style={{fontWeight: 500}}>{a.id}</td>
                                        <td style={{color: 'var(--text-muted)'}}>{a.matchId}</td>
                                        <td style={{color: 'var(--ue-alert)', fontWeight: 600}}>{a.violation}</td>
                                        <td>
                                            <button 
                                                className="btn-danger"
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    logEvent(`Cmd: Ban execution for ${a.id}`); 
                                                    setMetrics(p => ({...p, hardwareBans: p.hardwareBans + 1}));
                                                    setAlertsMap(p=>{const n={...p};delete n[a.id];return n;}); 
                                                    if(selectedAlert?.id===a.id)setSelectedAlert(null);
                                                }}
                                            >BAN</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Evidence Panel */}
                <div style={{width: '320px', display: 'flex', flexDirection: 'column'}}>
                    <div style={{fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px'}}>Cold Storage Evidence</div>
                    {selectedAlert ? (
                        <>
                            <div style={{fontSize: '12px', marginBottom: '12px', lineHeight: 1.6}}>
                                <span style={{fontWeight: 600, color: 'var(--text-muted)'}}>Target:</span> {selectedAlert.id} <br/>
                                <span style={{fontWeight: 600, color: 'var(--text-muted)'}}>SteamID:</span> {selectedAlert.steamId} <br/>
                                <span style={{fontWeight: 600, color: 'var(--text-muted)'}}>Server:</span> {selectedAlert.server}
                            </div>
                            <div className="terminal-block" style={{flex: 1, padding: '12px'}}>
                                {evidence ? JSON.stringify(evidence, null, 2) : 'Fetching tensor data...'}
                            </div>
                        </>
                    ) : (
                        <div style={{flex: 1, border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', padding: '24px'}}>
                            Select a row to view associated PyTorch Tensor evidence.
                        </div>
                    )}
                </div>
            </div>
        </div>

        <div className="card">
            <div className="card-title">Real-time Telemetry</div>
            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '32px'}}>
                <div>
                    <div style={{fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '12px'}}>Ingestion Latency</div>
                    <div style={{fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'baseline', gap: '8px'}}>Web <span style={{fontSize: '24px', fontWeight: 400, color: 'var(--text-main)'}}>{latency.web}</span><span style={{fontSize: '11px', color: 'var(--text-muted)'}}>ms</span></div>
                    <div style={{fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px'}}>Mobile <span style={{fontSize: '20px', fontWeight: 400, color: 'var(--text-main)'}}>{latency.mobile}</span><span style={{fontSize: '11px', color: 'var(--text-muted)'}}>ms</span></div>
                </div>
                <div style={{textAlign: 'right'}}>
                    <div style={{fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '12px'}}>Hardware Bans</div>
                    <div style={{fontSize: '48px', fontWeight: 300, lineHeight: 1, color: 'var(--text-main)', letterSpacing: '-0.05em'}}>{metrics.hardwareBans}</div>
                </div>
            </div>
        </div>
      </div>

      <div className="bottom-row">
        <div className="card" style={{gridColumn: 'span 2'}}>
            <div className="card-title">Threat Distribution Heatmap</div>
            <div style={{display: 'flex', marginTop: '16px'}}>
                <div style={{flex: 1}}>
                    {horizontalBars.map(row => (
                        <div className="horizontal-bar-row" key={row.name}>
                            <div className="h-bar-label">{row.name}</div>
                            <div className="h-bar-track">
                                <div className="h-bar-fill" style={{width: `${row.aimbot}%`, background: '#374151', transition: 'width 1.5s ease'}}></div>
                                <div className="h-bar-fill" style={{width: `${row.wallhack}%`, background: '#9CA3AF', transition: 'width 1.5s ease'}}></div>
                                <div className="h-bar-fill" style={{width: `${row.speedhack}%`, background: '#D1D5DB', transition: 'width 1.5s ease'}}></div>
                            </div>
                        </div>
                    ))}
                    <div style={{marginLeft: '116px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px'}}>
                        <span>0</span><span>50</span><span>100</span><span>150</span><span>200</span><span>250</span><span>300</span><span>350</span><span>400</span>
                    </div>
                </div>
                <div style={{width: '140px', paddingLeft: '32px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}><div style={{width:'8px',height:'8px',background:'#374151'}}></div> Aimbot</div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}><div style={{width:'8px',height:'8px',background:'#9CA3AF'}}></div> Wallhack</div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}><div style={{width:'8px',height:'8px',background:'#D1D5DB'}}></div> Speedhack</div>
                </div>
            </div>
        </div>

        <div className="card">
            <div className="card-title" style={{display: 'flex', justifyContent: 'space-between'}}>
                <span>Compute Allocation</span>
            </div>
            <div style={{height: '160px'}}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cpuData} margin={{top:0,right:0,left:-20,bottom:0}}>
                        <YAxis tick={{fontSize: 10, fill: 'var(--text-muted)'}} width={30} axisLine={false} tickLine={false} />
                        <XAxis dataKey="name" tick={{fontSize: 10, fill: 'var(--text-muted)'}} axisLine={false} tickLine={false} />
                        <Bar dataKey="user" stackId="a" fill="var(--graph-user)" isAnimationActive={false} />
                        <Bar dataKey="sys" stackId="a" fill="var(--graph-sys)" isAnimationActive={false} />
                        <Bar dataKey="idle" stackId="a" fill="var(--graph-idle)" isAnimationActive={false} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

    </div>
  );
}

export default App;
