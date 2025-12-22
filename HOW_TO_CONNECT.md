# How to Connect Agents to Dashboard

## Current Status ✅

Your dashboard is **RUNNING** and accessible at:
- **Dashboard UI**: http://localhost:3001
- **WebSocket Server**: ws://localhost:8080 (DashboardAgent running)
- **Blockchain**: Local Hardhat network on http://127.0.0.1:8545

## What's Connected

✅ **Dashboard UI** - Next.js app running on port 3001  
✅ **DashboardAgent** - WebSocket server running on port 8080  
✅ **Hardhat Node** - Local blockchain running  
✅ **Smart Contracts** - Deployed and verified

## Quick Start - See It Working Now!

The dashboard is already connected! Open your browser:

```
http://localhost:3001
```

You should see:
- "Connected" status in the top right (green)
- Agent status cards (currently showing registered agents)
- Empty tables for tasks, escrows, and transactions

## To Start Full Agent System

The full agent system (with all 5 agents) has a contract interaction issue. Here's how to run it when fixed:

### Option 1: Run All Agents (Currently has issues)
```bash
npm run start:agents
```

### Option 2: Run Dashboard Agent Only (Currently Running)
```bash
node dist/start-dashboard.js
```
This is what's running now - it provides the WebSocket connection for the dashboard.

## What Each Component Does

1. **Hardhat Node** (`npm run node`)
   - Local Ethereum blockchain
   - Running on port 8545
   - ✅ Currently running

2. **Dashboard UI** (`cd dashboard && npm run dev`)
   - Next.js web interface
   - Running on port 3001
   - ✅ Currently running

3. **DashboardAgent** (`node dist/start-dashboard.js`)
   - WebSocket server on port 8080
   - Aggregates and broadcasts agent data
   - ✅ Currently running

4. **Full Agent System** (`npm run start:agents`)
   - StartupAgent, ResearchAgent, EscrowAgent, BudgetAgent, DashboardAgent
   - ⚠️ Has contract interaction issues

## Troubleshooting

### Dashboard shows "Disconnected"
- Check if DashboardAgent is running: `node dist/start-dashboard.js`
- Check WebSocket port 8080 is not blocked

### Dashboard shows "Connecting..."
- The WebSocket server (port 8080) is not running
- Start it with: `node dist/start-dashboard.js`

### No data showing
- This is normal if only DashboardAgent is running
- Full agent system needs to be started for task/escrow data

## Architecture

```
Browser (localhost:3001)
    ↓ WebSocket
DashboardAgent (port 8080)
    ↓ Message Bus
Other Agents (Startup, Research, Escrow, Budget)
    ↓ Ethereum RPC
Hardhat Node (port 8545)
    ↓
Smart Contracts (MNEE + Escrow)
```

## Next Steps

1. **View Dashboard**: Open http://localhost:3001
2. **See Connection**: Check green "Connected" status
3. **Wait for Fix**: Full agent system needs contract interaction debugging

The dashboard UI is fully functional and will automatically update when agents start sending data!
