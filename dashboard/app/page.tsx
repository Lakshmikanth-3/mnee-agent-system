'use client';

import { useEffect, useState, useRef } from 'react';

interface AgentStatus {
    agentName: string;
    balance: string;
    activeTasks: number;
    totalTasksCompleted: number;
    status: 'active' | 'busy' | 'idle';
    reputation: number;
}

interface Task {
    taskId: string;
    description: string;
    status: string;
    timestamp: number;
}

interface Escrow {
    taskId: string;
    amount: string;
    milestonesTotal: number;
    milestonesCompleted: number;
    status: string;
    disputeStatus: 'NONE' | 'OPEN' | 'RESOLVED';
    timestamp: number;
}

interface Transaction {
    id: string;
    type: string;
    from: string;
    to: string;
    timestamp: number;
    payload?: any;
}

interface DashboardData {
    agents: AgentStatus[];
    activeTasks: Task[];
    escrows: Escrow[];
    transactions: Transaction[];
    marketStats: {
        totalFees: string;
        averageReputation: number;
        activeDisputes: number;
    };
    timestamp: number;
}

interface Stats {
    totalTransactions: number;
    totalVolume: string;
    activeAgents: number;
    successRate: number;
}

interface WorkflowStep {
    id: string;
    label: string;
    status: 'pending' | 'active' | 'completed' | 'error';
    icon: string;
}

export default function Dashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [connected, setConnected] = useState(false);
    const [stats, setStats] = useState<Stats>({ totalTransactions: 0, totalVolume: '0', activeAgents: 0, successRate: 100 });
    const [filter, setFilter] = useState<string>('all');
    const [activeTab, setActiveTab] = useState<'dashboard' | 'marketplace' | 'profile' | 'settings' | 'history'>('dashboard');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Interactive State
    const wsRef = useRef<WebSocket | null>(null);
    const [activeWorkflow, setActiveWorkflow] = useState<string | null>(null);
    const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([
        { id: 'REQUEST', label: 'User Request', status: 'pending', icon: '👤' },
        { id: 'DISCOVERY', label: 'Discovery', status: 'pending', icon: '🔍' },
        { id: 'BUDGET', label: 'Budget Agent', status: 'pending', icon: '💰' },
        { id: 'ESCROW', label: 'Escrow Lock', status: 'pending', icon: '🔒' },
        { id: 'WORK', label: 'Processing', status: 'pending', icon: '⚙️' },
        { id: 'AUDIT', label: 'AI Audit', status: 'pending', icon: '⚖️' },
        { id: 'COMPLETE', label: 'Payment Released', status: 'pending', icon: '✅' },
    ]);
    const [activityFeed, setActivityFeed] = useState<{ msg: string, type: string, time: number }[]>([]);

    useEffect(() => {
        const websocket = new WebSocket('ws://localhost:8080');
        wsRef.current = websocket;

        websocket.onopen = () => {
            console.log('Connected to agent system');
            setConnected(true);
        };

        websocket.onmessage = (event) => {
            const dashboardData = JSON.parse(event.data);
            setData(dashboardData);

            // Update workflow visualization based on latest transactions
            if (dashboardData.transactions && dashboardData.transactions.length > 0) {
                const latest = dashboardData.transactions[dashboardData.transactions.length - 1];
                updateWorkflowProgress(latest);

                // Add to feed if it's new
                const time = Date.now();
                if (latest.type.includes('REQUEST')) addLog(`[${latest.from}] -> [${latest.to}]: ${latest.type}`, 'request');
                else if (latest.type.includes('COMPLETED')) addLog(`[${latest.from}]: Work finished and proof submitted.`, 'success');
                else if (latest.type.includes('DISPUTE')) addLog(`[${latest.from}]: DISPUTE RAISED! Mediator engaged.`, 'error');
                else addLog(`[${latest.from}] performed ${latest.type}`, 'info');
            }

            // Calculate stats
            if (dashboardData.transactions) {
                const escrowTransactions = dashboardData.transactions.filter((t: Transaction) =>
                    t.type.includes('ESCROW')
                );
                const totalVolume = escrowTransactions.reduce((sum: number, t: Transaction) => sum + 10, 0);

                setStats({
                    totalTransactions: dashboardData.transactions.length,
                    totalVolume: totalVolume.toFixed(2),
                    activeAgents: dashboardData.agents?.length || 0,
                    successRate: 98.5
                });
            }
        };

        websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            setConnected(false);
        };

        websocket.onclose = () => {
            console.log('Disconnected from agent system');
            setConnected(false);
        };

        return () => {
            websocket.close();
        };
    }, []);

    const addLog = (msg: string, type: string) => {
        setActivityFeed(prev => [{ msg, type, time: Date.now() }, ...prev].slice(0, 50));
    };

    const updateWorkflowProgress = (tx: Transaction) => {
        setWorkflowSteps(prev => prev.map(step => {
            // Logic to advance steps based on message types
            if (tx.type === 'USER_TASK_REQUEST' && step.id === 'REQUEST') return { ...step, status: 'completed' };
            if (tx.type === 'TASK_REQUEST' && step.id === 'DISCOVERY') return { ...step, status: 'active' };
            if (tx.type === 'TASK_RESPONSE' && step.id === 'DISCOVERY') return { ...step, status: 'completed' };
            if (tx.type === 'BUDGET_CHECK_REQUEST' && step.id === 'BUDGET') return { ...step, status: 'active' };
            if (tx.type === 'BUDGET_APPROVED' && step.id === 'BUDGET') return { ...step, status: 'completed' };
            if (tx.type === 'ESCROW_CREATE_REQUEST' && step.id === 'ESCROW') return { ...step, status: 'active' };
            if (tx.type === 'ESCROW_CREATED' && step.id === 'ESCROW') return { ...step, status: 'completed' };
            if (tx.type === 'TASK_ASSIGNED' && step.id === 'WORK') return { ...step, status: 'active' };
            if (tx.type === 'TASK_COMPLETED' && step.id === 'WORK') return { ...step, status: 'completed' };
            if (tx.type === 'AUDIT_REQUEST' && step.id === 'AUDIT') return { ...step, status: 'active' };
            if (tx.type === 'AUDIT_COMPLETED' && step.id === 'AUDIT') return { ...step, status: 'completed' };
            if (tx.type === 'MILESTONE_RELEASED' && step.id === 'COMPLETE') return { ...step, status: 'completed' };
            return step;
        }));
    };

    const handleHireAgent = (agentName: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            alert('Not connected to backend system');
            return;
        }

        // Reset steps for new flow
        setWorkflowSteps(prev => prev.map(s => ({ ...s, status: s.id === 'REQUEST' ? 'active' : 'pending' })));

        wsRef.current.send(JSON.stringify({
            type: 'HIRE_AGENT',
            agentName: agentName
        }));

        addLog(`Initiating hire request for ${agentName}...`, 'request');
        setActiveWorkflow(agentName);
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString();
    };

    const getStatusClass = (status: string) => {
        if (status.includes('DISPUTE')) return 'status-busy';
        switch (status) {
            case 'active': return 'status-active';
            case 'busy': return 'status-busy';
            case 'idle': return 'status-idle';
            case 'Awaiting Verification': return 'status-busy';
            case 'Awaiting Release': return 'status-active';
            case 'Completed': return 'status-active';
            default: return 'status-idle';
        }
    };

    const getTxTypeClass = (type: string) => {
        if (type.includes('TASK')) return 'tx-task';
        if (type.includes('ESCROW')) return 'tx-escrow';
        if (type.includes('BUDGET')) return 'tx-budget';
        return 'tx-task';
    };

    const filteredTransactions = data?.transactions.filter(tx => {
        if (filter === 'all') return true;
        return tx.type.includes(filter.toUpperCase());
    }) || [];

    const WorkflowVisualizer = () => (
        <div className="card" style={{ marginBottom: '2rem', background: 'rgba(0,0,0,0.4)', borderColor: 'var(--accent-primary)', borderWidth: '1px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="live-badge">LIVE</span>
                    Agent Economy Workflow
                </h3>
                {activeWorkflow && <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>Target: {activeWorkflow}</span>}
            </div>

            <div className="workflow-stepper">
                {workflowSteps.map((step, idx) => (
                    <div key={step.id} className={`workflow-step ${step.status}`}>
                        <div className="step-icon-container">
                            <span className="step-icon">{step.icon}</span>
                            {step.status === 'active' && <div className="pulse-ring"></div>}
                        </div>
                        <div className="step-label">{step.label}</div>
                        {idx < workflowSteps.length - 1 && <div className="step-connector"></div>}
                    </div>
                ))}
            </div>
        </div>
    );

    const ActivityLog = () => (
        <div className="card terminal-card">
            <div className="terminal-header">
                <span>System Message Bus History</span>
                <div className="terminal-controls">
                    <span></span><span></span><span></span>
                </div>
            </div>
            <div className="terminal-body">
                {activityFeed.length === 0 ? (
                    <div className="terminal-line muted">Awaiting system activity...</div>
                ) : (
                    activityFeed.map((log, i) => (
                        <div key={i} className={`terminal-line ${log.type}`}>
                            <span className="time">[{formatTime(log.time)}]</span>
                            <span className="msg">{log.msg}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    const ResolutionCenter = () => {
        const activeDisputes = data?.escrows.filter(e => e.disputeStatus === 'OPEN') || [];
        if (activeDisputes.length === 0) return null;

        return (
            <div className="card" style={{ marginBottom: '2rem', borderColor: 'var(--accent-warning)', background: 'rgba(245, 158, 11, 0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="pulse-dot" style={{ background: 'var(--accent-warning)' }}></div>
                    <h3 style={{ margin: 0, color: 'var(--accent-warning)', fontSize: '1.25rem' }}>Active Resolution Center</h3>
                    <span className="tag" style={{ marginLeft: 'auto', background: 'var(--accent-warning)', color: 'black' }}>
                        Judge Mediation Active
                    </span>
                </div>
                <div className="grid grid-2">
                    {activeDisputes.map(dispute => (
                        <div key={dispute.taskId} className="dispute-item" style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span style={{ fontWeight: 600 }}>Task: {dispute.taskId.substring(0, 8)}</span>
                                <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{dispute.amount} MNEE</span>
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                <strong>Status:</strong> AuditorAgent flagged inconsistency. JudgeAgent mediating.
                            </div>
                            <div className="progress-container" style={{ width: '100%', height: '4px' }}>
                                <div className="progress-bar" style={{ width: '65%', background: 'var(--accent-warning)' }}></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', opacity: 0.7 }}>
                                <span>Evidence Review</span>
                                <span>Final Verdict Pending</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderContent = () => {
        if (!data) {
            return (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                    <div className="loading">Connecting to agent system...</div>
                </div>
            );
        }

        switch (activeTab) {
            case 'dashboard':
                return (
                    <>
                        <ResolutionCenter />
                        <WorkflowVisualizer />

                        <div className="grid grid-2-1" style={{ gap: '2rem' }}>
                            <div>
                                <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>AgentPay Economy Stats</h2>
                                <div className="grid grid-2">
                                    <div className="card">
                                        <div className="card-label">Market Reputation</div>
                                        <div className="card-value">{data.marketStats.averageReputation.toFixed(1)}</div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Confidence Index</div>
                                    </div>
                                    <div className="card">
                                        <div className="card-label">Active Disputes</div>
                                        <div className="card-value" style={{ color: data.marketStats.activeDisputes > 0 ? '#ffb946' : 'inherit' }}>
                                            {data.marketStats.activeDisputes}
                                        </div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Awaiting mediation</div>
                                    </div>
                                    <div className="card">
                                        <div className="card-label">Total Transactions</div>
                                        <div className="card-value">{stats.totalTransactions}</div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>All-time activity</div>
                                    </div>
                                    <div className="card">
                                        <div className="card-label">Protocol Fees</div>
                                        <div className="card-value">{data.marketStats.totalFees}</div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Network revenue</div>
                                    </div>
                                </div>

                                <section style={{ marginTop: '2rem' }}>
                                    <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Escrow Liquidity</h2>
                                    <div className="card">
                                        {data.escrows.length === 0 ? (
                                            <p className="muted" style={{ textAlign: 'center', padding: '1rem' }}>No active escrows</p>
                                        ) : (
                                            <div className="table-container">
                                                <table>
                                                    <thead>
                                                        <tr><th>Task</th><th>Amount</th><th>Status</th></tr>
                                                    </thead>
                                                    <tbody>
                                                        {data.escrows.slice(0, 5).map(e => (
                                                            <tr key={e.taskId}>
                                                                <td style={{ fontFamily: 'monospace' }}>{e.taskId.substring(0, 8)}</td>
                                                                <td style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{e.amount} MNEE</td>
                                                                <td><span className={`status-badge ${getStatusClass(e.status)}`}>{e.status}</span></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>

                            <div>
                                <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Live Bus Activity</h2>
                                <ActivityLog />

                                <div className="card" style={{ marginTop: '2rem' }}>
                                    <h3 style={{ fontSize: '1rem', marginTop: 0 }}>Active Agents</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {data.agents.map(a => (
                                            <div key={a.agentName} className="status-item">
                                                <div className={`status-dot ${getStatusClass(a.status)}`}></div>
                                                <span style={{ fontWeight: 500 }}>{a.agentName}</span>
                                                <span style={{ marginLeft: 'auto', fontSize: '0.875rem', opacity: 0.7 }}>{a.reputation}/100</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                );
            case 'marketplace':
                return (
                    <section>
                        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Agent Marketplace</h2>
                        <div className="grid grid-3">
                            {data.agents.map((agent) => (
                                <div key={agent.agentName} className="card marketplace-card">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                                        <div className="agent-avatar">
                                            {agent.agentName.charAt(0)}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{agent.agentName}</div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Reputation: {agent.reputation}/100</div>
                                        </div>
                                    </div>
                                    <div className="agent-tags">
                                        <span className="tag">AI Research</span>
                                        <span className="tag">Escrow Verified</span>
                                    </div>
                                    <div className="price-tag">
                                        <span className="price">10 MNEE</span>
                                        <span className="label">Base Price</span>
                                    </div>
                                    <button
                                        className="hire-btn"
                                        onClick={() => handleHireAgent(agent.agentName)}
                                        disabled={agent.status === 'busy'}
                                    >
                                        {agent.status === 'busy' ? 'Agent Occupied' : 'Hire Agent'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                );
            case 'history':
                return (
                    <section>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Protocol Logs</h2>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {['all', 'task', 'escrow', 'budget'].map(f => (
                                    <button
                                        key={f}
                                        className={`filter-btn ${filter === f ? 'active' : ''}`}
                                        onClick={() => setFilter(f)}
                                    >
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="card" style={{ padding: 0 }}>
                            <div className="table-container">
                                <table className="history-table">
                                    <thead>
                                        <tr><th>ID</th><th>Action Type</th><th>From</th><th>To</th><th>Time</th></tr>
                                    </thead>
                                    <tbody>
                                        {filteredTransactions.map((tx) => (
                                            <tr key={tx.id}>
                                                <td className="mono">{tx.id.substring(0, 8)}</td>
                                                <td>
                                                    <span className={`tx-type-pill ${getTxTypeClass(tx.type)}`}>
                                                        {tx.type}
                                                    </span>
                                                </td>
                                                <td>{tx.from}</td>
                                                <td>{tx.to}</td>
                                                <td className="muted">{formatTime(tx.timestamp)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                );
            case 'profile':
                return (
                    <section>
                        <div className="profile-header">
                            <div className="profile-avatar">👤</div>
                            <div>
                                <h2 style={{ margin: 0 }}>Startup Coordinator</h2>
                                <p className="muted" style={{ fontFamily: 'monospace' }}>0x70997970C51812dc3A010C7d01b50e0d17dc79C8</p>
                            </div>
                        </div>
                        <div className="grid grid-2">
                            <div className="card">
                                <div className="card-label">Primary Balance</div>
                                <div className="card-value">75,000 MNEE</div>
                                <div className="agent-tags" style={{ marginTop: '1rem' }}>
                                    <span className="tag">Level 8 Coordinator</span>
                                    <span className="tag" style={{ border: '1px solid var(--accent-success)', color: 'var(--accent-success)' }}>KYC Verified</span>
                                </div>
                            </div>
                            <div className="card">
                                <div className="card-label">System Reputation</div>
                                <div className="card-value">98/100</div>
                                <div className="progress-container" style={{ width: '100%', marginTop: '1rem' }}>
                                    <div className="progress-bar" style={{ width: '98%' }}></div>
                                </div>
                            </div>
                        </div>
                        <div className="card" style={{ marginTop: '2rem' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Recent Activity Focus</h3>
                            <div className="grid grid-3">
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎯</div>
                                    <div style={{ fontWeight: 600 }}>12 Active Tasks</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>💰</div>
                                    <div style={{ fontWeight: 600 }}>24k Escrowed</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📈</div>
                                    <div style={{ fontWeight: 600 }}>99.8% Reliability</div>
                                </div>
                            </div>
                        </div>
                    </section>
                );
            case 'settings':
                return (
                    <section>
                        <h2 style={{ marginBottom: '2rem' }}>System Settings</h2>
                        <div className="grid grid-2">
                            <div className="card">
                                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Network Configuration</h3>
                                <div className="settings-group">
                                    <label className="settings-label">WebSocket RPC URL</label>
                                    <input className="settings-input" type="text" defaultValue="ws://localhost:8080" />
                                </div>
                                <div className="settings-group">
                                    <label className="settings-label">Ethereum Chain ID</label>
                                    <input className="settings-input" type="text" defaultValue="1337" />
                                </div>
                                <button className="hire-btn" style={{ width: 'auto', paddingLeft: '2rem', paddingRight: '2rem' }}>Save Config</button>
                            </div>
                            <div className="card">
                                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Agent Preferences</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Auto-release Payment</span>
                                        <div style={{ width: '40px', height: '20px', background: 'var(--accent-primary)', borderRadius: '10px', position: 'relative' }}>
                                            <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', right: '2px', top: '2px' }}></div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Manual Audit Mode</span>
                                        <div style={{ width: '40px', height: '20px', background: 'var(--bg-tertiary)', borderRadius: '10px', position: 'relative' }}>
                                            <div style={{ width: '16px', height: '16px', background: 'var(--text-muted)', borderRadius: '50%', position: 'absolute', left: '2px', top: '2px' }}></div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.5 }}>
                                        <span>Dispute Notifications</span>
                                        <div style={{ width: '40px', height: '20px', background: 'var(--accent-primary)', borderRadius: '10px', position: 'relative' }}>
                                            <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', right: '2px', top: '2px' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                );
            default:
                return <div className="card muted" style={{ textAlign: 'center', padding: '4rem' }}>Feature coming soon...</div>;
        }
    };

    return (
        <div className={`dashboard-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <aside className="sidebar">
                <div className="sidebar-header">
                    {!isSidebarCollapsed && <div className="sidebar-logo">MNEE AGENTS</div>}
                    <button
                        className="sidebar-toggle"
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    >
                        {isSidebarCollapsed ? '→' : '←'}
                    </button>
                </div>

                <nav className="nav-links">
                    <button onClick={() => setActiveTab('dashboard')} className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}>
                        <span className="nav-icon">📊</span>
                        {!isSidebarCollapsed && <span className="nav-label">Live Monitor</span>}
                    </button>
                    <button onClick={() => setActiveTab('marketplace')} className={`nav-link ${activeTab === 'marketplace' ? 'active' : ''}`}>
                        <span className="nav-icon">🛒</span>
                        {!isSidebarCollapsed && <span className="nav-label">Marketplace</span>}
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`nav-link ${activeTab === 'history' ? 'active' : ''}`}>
                        <span className="nav-icon">📜</span>
                        {!isSidebarCollapsed && <span className="nav-label">Ledger</span>}
                    </button>
                </nav>

                <div className="sidebar-footer">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                        <button onClick={() => setActiveTab('profile')} className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`}>
                            <span className="nav-icon">👤</span>
                            {!isSidebarCollapsed && <span className="nav-label">Profile</span>}
                        </button>
                        <button onClick={() => setActiveTab('settings')} className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}>
                            <span className="nav-icon">⚙️</span>
                            {!isSidebarCollapsed && <span className="nav-label">Settings</span>}
                        </button>
                    </div>
                    <div className="connection-status">
                        <div className={`status-dot ${connected ? 'status-active' : 'status-idle'}`}></div>
                        {!isSidebarCollapsed && (connected ? 'System Connected' : 'Syncing...')}
                    </div>
                </div>
            </aside>

            <main className="main-content">
                <header className="page-header">
                    <div>
                        <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
                        <p className="muted">AgentPay OS Execution Environment</p>
                    </div>
                    {data && (
                        <div className="last-updated">
                            Last block: {formatTime(data.timestamp)}
                        </div>
                    )}
                </header>
                {renderContent()}
            </main>
        </div>
    );
}
