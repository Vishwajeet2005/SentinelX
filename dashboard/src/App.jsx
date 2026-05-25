import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Target, Shield, Users, Map, Play, Square, ChevronRight, ChevronDown, Monitor, Cpu, Database, Server } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';

function App() {
  const [activeTab, setActiveTab] = useState('sessions'); // sessions, modules, bans
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [simMode, setSimMode] = useState(false);
  const [radarData, setRadarData] = useState([]);
  const [logs, setLogs] = useState([]);
  const [banned, setBanned] = useState([]);
  const [connected, setConnected] = useState(false);
  
  const [leftTab, setLeftTab] = useState('outliner'); // 'outliner' or 'log'
  const [rightTab, setRightTab] = useState('details'); // 'details' or 'radar'
  const [bottomTab, setBottomTab] = useState('output'); // 'output' or 'cmd'
  const [cmdInput, setCmdInput] = useState('');

  const [expandedNodes, setExpandedNodes] = useState({ 'US-East-1': true, 'EU-West': true });
  const [expandedCategories, setExpandedCategories] = useState({ transform: true, network: true, heuristics: true });

  const logsRef = useRef(null);

  const logEvent = (msg) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-60));
  };

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  // Radar Data Generator
  useEffect(() => {
    let interval;
    if (selectedAlert) {
      let x = selectedAlert.baseX;
      let y = selectedAlert.baseY;
      interval = setInterval(() => {
        const isSpeedhack = selectedAlert.violation.includes("Speed");
        x += (Math.random() - 0.5) * (isSpeedhack ? 300 : 25);
        y += (Math.random() - 0.5) * (isSpeedhack ? 300 : 25);
        setRadarData(prev => [...prev, { x, y }].slice(-60));
      }, 50);
    } else {
      setRadarData([]);
    }
    return () => clearInterval(interval);
  }, [selectedAlert]);

  // Data Pipeline: Simulation & Real WSS
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
            baseY: Math.random() * 2000 - 1000
          };
          
          setAlerts(prev => [newAlert, ...prev].slice(0, 30));
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
        const matchId = "MATCH-LIVE";
        const steamId = "76561198" + msg.data.client_id;
        const violation = "Aimbot (Pitch Snap)";
        const mapName = "Level_Live";
        const server = "US-East-1";
        const newAlert = {
            id, matchId, steamId, violation, mapName, server,
            ping: 30,
            weapon: "AK-47",
            baseX: 0,
            baseY: 0
        };
        setAlerts(prev => [newAlert, ...prev].slice(0, 30));
        logEvent(`LogSentinX: Live Cheat Detected. Violator: ${id} Score: ${(msg.data.anomaly_score*100).toFixed(1)}%`);
      }
    };
    return () => ws.close();
  }, [simMode]);

  const toggleNode = (node) => setExpandedNodes(p => ({...p, [node]: !p[node]}));
  const toggleCat = (cat) => setExpandedCategories(p => ({...p, [cat]: !p[cat]}));

  const handleBan = () => {
    if (!selectedAlert) return;
    logEvent(`Cmd: DestroyActor ${selectedAlert.id} (Banned)`);
    setBanned(prev => [{ ...selectedAlert, time: new Date().toISOString() }, ...prev]);
    setAlerts(prev => prev.filter(a => a.id !== selectedAlert.id));
    setSelectedAlert(null);
  };

  const handleCommand = (e) => {
    if (e.key === 'Enter') {
      const cmd = cmdInput.trim();
      setCmdInput('');
      if (!cmd) return;
      logEvent(`> ${cmd}`);
      
      const parts = cmd.toLowerCase().split(' ');
      const action = parts[0];
      
      if (action === 'help') {
        logEvent('Available commands: help, clear, status, spectate <id>, shadowban <id>, kick <id>, ban <id>, ban all');
      } else if (action === 'clear') {
        setLogs([]);
      } else if (action === 'status') {
        logEvent(`Engine Sim: ${simMode ? 'ON' : 'OFF'} | WSS: ${connected ? 'CONNECTED' : 'DISCONNECTED'}`);
      } else if (action === 'spectate' && parts[1]) {
        const idToSpectate = parts[1];
        const alertToSpectate = alerts.find(a => a.id.toLowerCase() === idToSpectate);
        if (alertToSpectate) {
          logEvent(`Cmd: Spectate locked onto ${alertToSpectate.id}`);
          setSelectedAlert(alertToSpectate);
          setRightTab('radar');
        } else {
          logEvent(`Error: Actor ${idToSpectate} not found.`);
        }
      } else if (action === 'shadowban' && parts[1]) {
        const idToBan = parts[1];
        const alertToBan = alerts.find(a => a.id.toLowerCase() === idToBan);
        if (alertToBan) {
          logEvent(`Cmd: Shadowban flag applied to ${alertToBan.id}`);
          setAlerts(prev => prev.map(a => a.id === alertToBan.id ? { ...a, shadowbanned: true } : a));
        } else {
          logEvent(`Error: Actor ${idToBan} not found.`);
        }
      } else if (action === 'kick' && parts[1]) {
        const idToKick = parts[1];
        const alertToKick = alerts.find(a => a.id.toLowerCase() === idToKick);
        if (alertToKick) {
          logEvent(`Cmd: Kicked ${alertToKick.id} from session (No HWID Ban)`);
          setAlerts(prev => prev.filter(a => a.id !== alertToKick.id));
          if (selectedAlert?.id === alertToKick.id) setSelectedAlert(null);
        } else {
          logEvent(`Error: Actor ${idToKick} not found.`);
        }
      } else if (action === 'ban' && parts[1]) {
        const idToBan = parts[1];
        if (idToBan === 'all') {
          if (alerts.length === 0) {
            logEvent(`Error: No actors currently tracked in session.`);
          } else {
            logEvent(`Cmd: DestroyActor * (Executing mass ban on ${alerts.length} actors)`);
            const now = new Date().toISOString();
            const newBans = alerts.map(a => ({ ...a, time: now }));
            setBanned(prev => [...newBans, ...prev]);
            setAlerts([]);
            setSelectedAlert(null);
          }
        } else {
          const alertToBan = alerts.find(a => a.id.toLowerCase() === idToBan);
          if (alertToBan) {
            logEvent(`Cmd: DestroyActor ${alertToBan.id} (Banned via Cmd)`);
            setBanned(prev => [{ ...alertToBan, time: new Date().toISOString() }, ...prev]);
            setAlerts(prev => prev.filter(a => a.id !== alertToBan.id));
            if (selectedAlert?.id === alertToBan.id) setSelectedAlert(null);
          } else {
            logEvent(`Error: Actor ${idToBan} not found in current session.`);
          }
        }
      } else {
        logEvent(`Unknown command: '${cmd}'. Type 'help' for a list of commands.`);
      }
    }
  };

  // Organize alerts into World Outliner Tree (Server -> Match -> Player)
  const treeData = useMemo(() => {
    const tree = {};
    alerts.forEach(a => {
      if (!tree[a.server]) tree[a.server] = {};
      if (!tree[a.server][a.matchId]) tree[a.server][a.matchId] = [];
      tree[a.server][a.matchId].push(a);
    });
    return tree;
  }, [alerts]);

  const renderWorldOutliner = () => {
    return Object.keys(treeData).map(server => (
      <div key={server}>
        <div className="tree-node" onClick={() => toggleNode(server)}>
          {expandedNodes[server] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Server size={12} style={{margin: '0 4px', color: '#0066cc'}}/> Server: {server}
        </div>
        {expandedNodes[server] && (
          <div className="tree-indent">
            {Object.keys(treeData[server]).map(match => (
              <div key={match}>
                <div className="tree-node" onClick={() => toggleNode(match)}>
                  {expandedNodes[match] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <Database size={12} style={{margin: '0 4px', color: '#888'}}/> Match: {match}
                </div>
                {expandedNodes[match] && (
                  <div className="tree-indent">
                    {treeData[server][match].map(p => (
                      <div 
                        key={p.id} 
                        className={`tree-node ${selectedAlert?.id === p.id ? 'selected' : ''}`}
                        onClick={() => setSelectedAlert(p)}
                      >
                        <Target size={12} style={{margin: '0 4px', color: p.shadowbanned ? '#b026ff' : 'var(--ue-alert)'}}/>
                        <span style={{color: selectedAlert?.id === p.id ? '#fff' : (p.shadowbanned ? '#b026ff' : 'var(--ue-alert)')}}>{p.id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    ));
  };

  const renderSessionsTab = () => (
    <div className="grid-layout">
      {/* Left Column: Tree View */}
      <div className="viewport" style={{gridColumn: 1}}>
        <div className="tab-bar">
          <div className={`tab ${leftTab === 'outliner' ? 'active' : ''}`} onClick={() => setLeftTab('outliner')}>World Outliner</div>
          <div className={`tab ${leftTab === 'log' ? 'active' : ''}`} onClick={() => setLeftTab('log')}>Log</div>
        </div>
        <div style={{overflowY: 'auto', flex: 1, padding: '5px'}}>
          {leftTab === 'outliner' ? (
            alerts.length === 0 ? <div style={{padding: '10px', color: '#666'}}>World is empty...</div> : renderWorldOutliner()
          ) : (
             <div className="mono" style={{padding: '10px', color: '#ccc'}}>
               {logs.slice(-30).map((l, i) => <div key={i} style={{marginBottom: '4px'}}>{l}</div>)}
             </div>
          )}
        </div>
      </div>

      {/* Right Column: Details & Radar */}
      <div className="details-panel" style={{gridColumn: 2}}>
        <div className="tab-bar">
          <div className={`tab ${rightTab === 'details' ? 'active' : ''}`} onClick={() => setRightTab('details')}>Details Panel</div>
          <div className={`tab ${rightTab === 'radar' ? 'active' : ''}`} onClick={() => setRightTab('radar')}>2D Radar Mapping</div>
        </div>
        
        {!selectedAlert ? (
          <div style={{display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: '#444'}}>
            Select an Actor to inspect properties.
          </div>
        ) : (
          <div style={{display: 'flex', flex: 1}}>
            {rightTab === 'details' ? (
              <div style={{flex: 1, borderRight: '1px solid var(--ue-border)', overflowY: 'auto'}}>
                
                <div className="category-header" onClick={() => toggleCat('transform')}>
                  {expandedCategories.transform ? <ChevronDown size={14}/> : <ChevronRight size={14}/>} Transform (Coordinates)
                </div>
                {expandedCategories.transform && (
                  <div className="category-content prop-grid">
                    <div className="prop-label">Location X</div><div className="prop-value mono">{(radarData[radarData.length-1]?.x || selectedAlert.baseX).toFixed(2)}</div>
                    <div className="prop-label">Location Y</div><div className="prop-value mono">{(radarData[radarData.length-1]?.y || selectedAlert.baseY).toFixed(2)}</div>
                    <div className="prop-label">Velocity</div><div className="prop-value mono">{(Math.random()*400).toFixed(2)} units/s</div>
                  </div>
                )}

                <div className="category-header" onClick={() => toggleCat('network')}>
                  {expandedCategories.network ? <ChevronDown size={14}/> : <ChevronRight size={14}/>} Network & Session
                </div>
                {expandedCategories.network && (
                  <div className="category-content prop-grid">
                    <div className="prop-label">SteamID64</div><div className="prop-value mono">{selectedAlert.steamId}</div>
                    <div className="prop-label">Match Instance</div><div className="prop-value mono">{selectedAlert.matchId}</div>
                    <div className="prop-label">Latency (Ping)</div><div className="prop-value">{selectedAlert.ping} ms</div>
                  </div>
                )}

                <div className="category-header" onClick={() => toggleCat('heuristics')}>
                  {expandedCategories.heuristics ? <ChevronDown size={14}/> : <ChevronRight size={14}/>} Heuristics Profile
                </div>
                {expandedCategories.heuristics && (
                  <div className="category-content prop-grid">
                    <div className="prop-label">Violation Flag</div><div className="prop-value" style={{color: 'var(--ue-alert)', fontWeight: 700}}>{selectedAlert.violation}</div>
                    <div className="prop-label">Confidence</div>
                    <div className="prop-value">
                      <div className="progress-bg"><div className="progress-fill" style={{width: '98%', background: 'var(--ue-alert)'}}></div></div>
                    </div>
                    <div className="prop-label">Equipped</div><div className="prop-value">{selectedAlert.weapon}</div>
                  </div>
                )}

                <div style={{padding: '15px'}}>
                  <button className="ue-btn danger" style={{width: '100%', justifyContent: 'center'}} onClick={handleBan}>
                    <Target size={14} /> Execute Actor (Ban & Kick)
                  </button>
                </div>
              </div>
            ) : (
              <div style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
                <div style={{padding: '5px 10px', fontSize: '11px', background: '#111', color: '#888', borderBottom: '1px solid var(--ue-border)'}}>
                  Viewport: Top-Down Orthographic
                </div>
                <div style={{flex: 1, background: '#0a0a0a', padding: '10px'}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid stroke="#1a1a1a" />
                      <XAxis type="number" dataKey="x" domain={[-1500, 1500]} stroke="#444" tick={false} />
                      <YAxis type="number" dataKey="y" domain={[-1500, 1500]} stroke="#444" tick={false} />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{background: '#111', border: '1px solid #333', fontSize: '12px'}} />
                      <ReferenceArea x1={-300} x2={300} y1={-300} y2={300} fill="rgba(0, 102, 204, 0.05)" strokeOpacity={0.2} />
                      <Scatter name="Path" data={radarData} fill="var(--ue-alert)" line={{stroke: 'var(--ue-alert)', strokeWidth: 1}} shape="cross" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Output Log */}
      <div className="bottom-panel">
        <div className="tab-bar">
          <div className={`tab ${bottomTab === 'output' ? 'active' : ''}`} onClick={() => setBottomTab('output')}>Output Log</div>
          <div className={`tab ${bottomTab === 'cmd' ? 'active' : ''}`} onClick={() => setBottomTab('cmd')}>Cmd</div>
        </div>
        <div ref={logsRef} className="mono" style={{flex: 1, padding: '10px', overflowY: 'auto', background: '#0a0a0a', color: '#ccc'}}>
          {bottomTab === 'output' ? (
            logs.map((l, i) => <div key={i}>{l}</div>)
          ) : (
            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
               <span style={{color: '#0f0'}}>&gt;</span> 
               <input 
                 type="text" 
                 value={cmdInput}
                 onChange={(e) => setCmdInput(e.target.value)}
                 onKeyDown={handleCommand}
                 placeholder="Enter engine command (try 'help')..." 
                 style={{flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontFamily: 'inherit'}}
               />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderModulesTab = () => (
    <div style={{padding: '20px', flex: 1, overflowY: 'auto'}}>
      <h2 style={{color: '#fff', marginBottom: '20px', fontWeight: 500}}>Loaded Anti-Cheat Modules</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{width: '200px'}}>Module Name</th>
            <th style={{width: '100px'}}>Status</th>
            <th style={{width: '150px'}}>Memory Usage</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>SentinX_Kernel.sys</td>
            <td><span className="status-indicator status-green" style={{marginRight: '5px'}}></span> Running</td>
            <td><div className="progress-bg"><div className="progress-fill" style={{width: '45%'}}></div></div> 4.2 MB</td>
            <td>Ring-0 Kernel driver for memory protection and hook detection.</td>
          </tr>
          <tr>
            <td>ONNX_Inference_Engine</td>
            <td><span className="status-indicator status-green" style={{marginRight: '5px'}}></span> Running</td>
            <td><div className="progress-bg"><div className="progress-fill" style={{width: '80%', background: 'var(--ue-warning)'}}></div></div> 1.2 GB</td>
            <td>Machine Learning model evaluating rotational traces in real-time.</td>
          </tr>
          <tr>
            <td>HWID_Spoofer_Check</td>
            <td><span className="status-indicator status-green" style={{marginRight: '5px'}}></span> Running</td>
            <td><div className="progress-bg"><div className="progress-fill" style={{width: '10%'}}></div></div> 0.8 MB</td>
            <td>Validates hardware identifiers against known hypervisors.</td>
          </tr>
          <tr>
            <td>Memory_Dump_Scanner</td>
            <td><span className="status-indicator status-orange" style={{marginRight: '5px'}}></span> Idle</td>
            <td><div className="progress-bg"><div className="progress-fill" style={{width: '0%'}}></div></div> 0.0 MB</td>
            <td>Scheduled heuristic scans of process heap memory.</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const renderBansTab = () => (
    <div style={{padding: '20px', flex: 1, overflowY: 'auto'}}>
      <h2 style={{color: '#fff', marginBottom: '20px', fontWeight: 500}}>Hardware Ban List Execution Registry</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>SteamID64</th>
            <th>PlayerController ID</th>
            <th>Violation Detected</th>
            <th>Timestamp of Ban</th>
          </tr>
        </thead>
        <tbody>
          {banned.length === 0 ? (
            <tr><td colSpan="4" style={{textAlign: 'center', padding: '20px'}}>No bans issued yet.</td></tr>
          ) : (
            banned.map((b, i) => (
              <tr key={i}>
                <td className="mono">{b.steamId}</td>
                <td>{b.id}</td>
                <td style={{color: 'var(--ue-alert)'}}>{b.violation}</td>
                <td className="mono">{b.time}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="app-container">


      {/* Toolbar */}
      <div className="toolbar">
        <button className={`ue-btn ${simMode ? 'danger' : 'primary'}`} onClick={() => setSimMode(!simMode)}>
          {simMode ? <Square size={14} /> : <Play size={14} fill="currentColor" />}
          {simMode ? 'Stop Editor Simulation' : 'Play (Simulate Engine Integration)'}
        </button>
        <div style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px'}}>
          <span>Engine Status:</span>
          <span className={`status-indicator ${simMode || connected ? 'status-green' : 'status-red'}`}></span>
          {simMode ? 'Attached (PID: 10492)' : (connected ? 'Live Data Connected' : 'Detached')}
        </div>
      </div>

      <div className="workspace">
        {/* Outliner / Sidebar */}
        <div className="sidebar">
          <div className="panel-title">Workspace Configuration</div>
          <div className="nav-list">
            <div className={`nav-item ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => setActiveTab('sessions')}><Map size={14}/> Active Sessions Tracking</div>
            <div className={`nav-item ${activeTab === 'modules' ? 'active' : ''}`} onClick={() => setActiveTab('modules')}><Shield size={14}/> Anti-Cheat Modules</div>
            <div className={`nav-item ${activeTab === 'bans' ? 'active' : ''}`} onClick={() => setActiveTab('bans')}><Users size={14}/> Hardware Ban Lists</div>
          </div>
        </div>

        {/* Dynamic Main View */}
        <div className="main-view">
          {activeTab === 'sessions' && renderSessionsTab()}
          {activeTab === 'modules' && renderModulesTab()}
          {activeTab === 'bans' && renderBansTab()}
        </div>
      </div>
    </div>
  );
}

export default App;
