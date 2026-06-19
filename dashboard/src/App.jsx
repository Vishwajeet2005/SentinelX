import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { Target, Shield, Users, Map, Play, Square, ChevronRight, ChevronDown, Monitor, Cpu, Database, Server, Terminal } from 'lucide-react';
import axios from 'axios';

function App() {
  const sparklineData = Array.from({length: 20}, () => ({ val: Math.random() * 100 }));
  const trafficData = Array.from({length: 24}, (_, i) => ({ time: `${i}:00`, pc: 20000 + Math.random()*2000, console: 5000 + Math.random()*500 }));
  
  const horizontalBars = [
    { name: 'N California', aimbot: 80, wallhack: 60, speedhack: 40 },
    { name: 'London', aimbot: 70, wallhack: 50, speedhack: 30 },
    { name: 'Paris', aimbot: 60, wallhack: 45, speedhack: 25 },
    { name: 'Amsterdam', aimbot: 55, wallhack: 40, speedhack: 20 },
  ];

  const cpuData = [
    { name: 'Auth', user: 50, sys: 30, idle: 20 },
    { name: 'CDN', user: 60, sys: 20, idle: 20 },
    { name: 'Database', user: 40, sys: 40, idle: 20 },
    { name: 'Web', user: 45, sys: 35, idle: 20 },
  ];

  // --- Dynamic State Logic ---
  const [alertsMap, setAlertsMap] = useState({});
  const alerts = useMemo(() => Object.values(alertsMap).slice(0, 15), [alertsMap]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [simMode, setSimMode] = useState(true); // Default to true for impressive live demo
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
            setAlertsMap({});
            setSelectedAlert(null);
        } else {
            logEvent(`Cmd: DestroyActor ${parts[1]} (Banned via Cmd)`);
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

  // WebSocket & Simulation logic
  useEffect(() => {
    if (simMode) {
      logEvent("LogInit: SentinX SDK Bound to Engine Simulation Loop");
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
        <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
            <div style={{fontSize: '12px', fontWeight: 600, color: connected ? '#38a169' : '#e53e3e', display: 'flex', alignItems: 'center', gap: '6px'}}>
                <div style={{width: '8px', height: '8px', borderRadius: '50%', background: connected ? '#38a169' : '#e53e3e'}}></div>
                {connected ? 'LIVE NETWORK CONNECTED' : 'DISCONNECTED'}
            </div>
            <button 
                onClick={() => setSimMode(!simMode)}
                style={{
                    background: simMode ? '#e53e3e' : '#3182ce', color: '#fff', border: 'none', padding: '8px 16px', 
                    borderRadius: '4px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
            >
                {simMode ? <Square size={14}/> : <Play size={14}/>} {simMode ? 'Stop Simulation' : 'Simulate Engine Detections'}
            </button>
        </div>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px'}}>
        {/* Top left incidents */}
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

        {/* Top Right Cmd Log */}
        <div className="card" style={{display: 'flex', flexDirection: 'column'}}>
            <div className="card-title" style={{display: 'flex', alignItems: 'center', gap: '6px'}}><Terminal size={14}/> SOC Command Interface</div>
            <div ref={logsRef} style={{flex: 1, background: '#1a202c', color: '#a0aec0', fontFamily: 'monospace', fontSize: '11px', padding: '12px', borderRadius: '4px', overflowY: 'auto', maxHeight: '120px'}}>
                {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', background: '#edf2f7', padding: '4px 12px', borderRadius: '4px'}}>
                <span style={{color: '#4a5568', fontWeight: 700}}>&gt;</span>
                <input 
                    type="text" 
                    value={cmdInput} 
                    onChange={e => setCmdInput(e.target.value)} 
                    onKeyDown={handleCommand}
                    placeholder="Enter command (e.g. 'help')..."
                    style={{background: 'transparent', border: 'none', outline: 'none', flex: 1, fontSize: '12px', color: '#2d3748', fontFamily: 'monospace'}}
                />
            </div>
        </div>
      </div>

      <div className="chart-row">
        {/* Live Detections Feed (Replaces static Banned Processes table) */}
        <div className="card" style={{gridColumn: 'span 2'}}>
            <div className="card-title" style={{display: 'flex', justifyContent: 'space-between'}}>
                <span>Live ML Detections Feed</span>
                <span style={{color: '#e53e3e', fontSize: '11px'}}>{alerts.length} Active Alerts</span>
            </div>
            
            <div style={{display: 'flex', gap: '16px'}}>
                {/* Table */}
                <div style={{flex: 1, maxHeight: '250px', overflowY: 'auto'}}>
                    <table className="data-table">
                        <thead style={{position: 'sticky', top: 0, background: '#fff'}}>
                            <tr><th>Time</th><th>Player ID</th><th>Match ID</th><th>Violation</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                            {alerts.length === 0 ? (
                                <tr><td colSpan="5" style={{textAlign: 'center', padding: '20px', color: '#a0aec0'}}>No live detections currently active.</td></tr>
                            ) : (
                                alerts.map(a => (
                                    <tr key={a.id} style={{background: selectedAlert?.id === a.id ? '#edf2f7' : 'transparent', cursor: 'pointer'}} onClick={() => setSelectedAlert(a)}>
                                        <td>{a.time}</td>
                                        <td style={{fontWeight: 600}}>{a.id}</td>
                                        <td style={{color: '#718096'}}>{a.matchId}</td>
                                        <td style={{color: '#e53e3e', fontWeight: 600}}>{a.violation}</td>
                                        <td>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); logEvent(`Cmd: Ban execution for ${a.id}`); setAlertsMap(p=>{const n={...p};delete n[a.id];return n;}); if(selectedAlert?.id===a.id)setSelectedAlert(null);}}
                                                style={{background: '#e53e3e', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer'}}
                                            >BAN</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Evidence Panel */}
                <div style={{width: '350px', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '12px', display: 'flex', flexDirection: 'column'}}>
                    <div style={{fontSize: '11px', fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', marginBottom: '8px'}}>Cold Storage Evidence</div>
                    {selectedAlert ? (
                        <>
                            <div style={{fontSize: '12px', marginBottom: '12px'}}>
                                <span style={{fontWeight: 600}}>Target:</span> {selectedAlert.id} <br/>
                                <span style={{fontWeight: 600}}>SteamID:</span> {selectedAlert.steamId} <br/>
                                <span style={{fontWeight: 600}}>Server:</span> {selectedAlert.server}
                            </div>
                            <div style={{flex: 1, background: '#1a202c', color: '#a3e635', fontFamily: 'monospace', fontSize: '10px', padding: '8px', borderRadius: '4px', overflowY: 'auto', whiteSpace: 'pre-wrap'}}>
                                {evidence ? JSON.stringify(evidence, null, 2) : 'Fetching tensor data...'}
                            </div>
                        </>
                    ) : (
                        <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', fontSize: '12px', textAlign: 'center'}}>
                            Select a row to view associated PyTorch Tensor evidence.
                        </div>
                    )}
                </div>
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
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}><div style={{width: '12px', height:'12px', background:'#d69e2e'}}></div> Appeal</div>
                </div>
            </div>
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
