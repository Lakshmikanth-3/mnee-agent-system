# AgentPay OS - Testing Guide ⚖️🧪

To verify the full "Autonomous Agent Economy" functionality, follow these steps to reset the environment and launch the multi-agent system.

### 1. Reset & Prepare Environment
Ensure no stale processes are running and the local blockchain is fresh.

1. **Stop all terminals** (Ctrl+C).
2. **Start the local Node**:
   ```bash
   npm run node
   ```
3. **Deploy the Contracts** (in a new terminal):
   ```bash
   npm run deploy
   ```
   *Note: This will automatically update your contract addresses.*

4. **Build the Agents**:
   ```bash
   npm run build
   ```

---

### 2. Launch the System

#### Option A: Real Workflow (Recommended for Verification)
This launches the actual agents who will interact on-chain.
1. **Start Agents**:
   ```bash
   npm run start:agents
   ```
2. **Launch Dashboard** (in another terminal):
   ```bash
   cd dashboard && npm run dev
   ```
3. **Visit**: [http://localhost:3001](http://localhost:3001)

#### Option B: Demo Simulation
This simulates high-stakes activity (audits, disputes, reputation) for visual verification.
1. **Run Demo**:
   ```bash
   npm run demo
   ```
2. **Visit**: [http://localhost:3001](http://localhost:3001)

---

### 3. What to Look For 🎯

- **Marketplace Tab**: Check if all 7 agents (Startup, Research, Escrow, Budget, Auditor, Judge, Dashboard) are listed with their **On-Chain Reputation**.
- **Milestone bars**: In the Dashboard/Escrow table, watch the progress bars fill as the ResearchAgent completes deliverables.
- **AI Audit Logs**: Watch the terminal/dashboard for "AI Audit PASSED" or "RAISING DISPUTE" messages.
- **Judge Mediation**: If a dispute is raised, look for the "⚖️ MEDIATION" status in the escrow table and wait for the "RESOLVED" decree.
- **Reputation Updates**: Verify that agent reputation scores change after a task is finalized.

---

### 🛠️ Troubleshooting `EADDRINUSE`
If you see a "Port 8080 already in use" error:
1. It means a previous agent session is still running.
2. Run this in PowerShell to clear it:
   ```powershell
   Get-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess | Stop-Process -Force
   ```
3. Then try `npm run start:agents` again.
