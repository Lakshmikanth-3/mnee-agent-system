# Quick Start Guide

## Prerequisites
- Node.js 18+
- npm

## Installation
```bash
npm install
cd dashboard && npm install && cd ..
```

## Running the System

### Terminal 1: Start Blockchain
```bash
npm run node
```

### Terminal 2: Deploy Contracts
```bash
npm run deploy
```

Copy the contract addresses from the output and create a `.env` file:
```env
RPC_URL=http://127.0.0.1:8545
MNEE_TOKEN_ADDRESS=<MNEE address from deployment>
ESCROW_CONTRACT_ADDRESS=<Escrow address from deployment>
STARTUP_AGENT_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
RESEARCH_AGENT_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
ESCROW_AGENT_PRIVATE_KEY=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
BUDGET_AGENT_PRIVATE_KEY=0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
DASHBOARD_AGENT_PRIVATE_KEY=0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
TOTAL_BUDGET=10000
DAILY_LIMIT=1000
PER_TASK_LIMIT=100
WEBSOCKET_PORT=8080
```

### Terminal 3: Start Agents
```bash
npm run start:agents
```

### Terminal 4: Start Dashboard
```bash
cd dashboard
npm run dev
```

Open http://localhost:3001 in your browser

## What You'll See

1. **Console**: Real-time logs of agent interactions
2. **Dashboard**: Visual monitoring of all activity
3. **Demo Task**: Automatic execution of a research task

## Architecture

- **5 Agents**: Startup, Research, Escrow, Budget, Dashboard
- **2 Smart Contracts**: MNEE token + Escrow
- **Message Bus**: Inter-agent communication
- **WebSocket**: Real-time dashboard updates

Enjoy exploring the autonomous agent system!
