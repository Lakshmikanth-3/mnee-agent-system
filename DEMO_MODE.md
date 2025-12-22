# MNEE Agent System - Live Demo Mode Guide

## 🎬 What is Demo Mode?

Demo Mode is a **live simulation** of the complete multi-agent system that demonstrates realistic agent workflows without requiring actual smart contract deployments or blockchain transactions. Perfect for:

- **Demonstrations** - Show the system in action
- **Testing** - Verify dashboard features
- **Development** - Test new features without blockchain
- **Presentations** - Impressive live demo for stakeholders

## 🚀 Quick Start

### Start Demo Mode

```bash
npm run demo
```

That's it! The demo will:
1. Start the DashboardAgent with WebSocket server
2. Register all 5 agents
3. Begin simulating realistic workflows
4. Send real-time updates to the dashboard

### View the Dashboard

Open your browser to:
```
http://localhost:3001
```

You'll see:
- ✅ **Connected** status (green indicator)
- 📊 **Live statistics** updating in real-time
- 🤖 **5 Active agents** with balances and task counts
- 📝 **Tasks** being created and completed
- 💰 **Escrow transactions** with amounts
- 📜 **Activity feed** showing all messages

## 🎭 What Gets Simulated

### Complete Workflow Cycle

Every 15-25 seconds, the demo runs a complete task workflow:

1. **Task Request** 📋
   - StartupAgent broadcasts task (e.g., "Analyze DeFi protocol security")
   - Random selection from 8 different research topics

2. **Task Response** 💬
   - ResearchAgent responds with pricing (10-50 MNEE)
   - Acceptance confirmation

3. **Budget Check** 💵
   - StartupAgent requests budget approval
   - BudgetAgent validates spending limits

4. **Budget Decision** ✅/❌
   - 90% approval rate (realistic simulation)
   - 10% rejection rate for demonstration

5. **Escrow Creation** 🔒
   - EscrowAgent creates on-chain escrow (simulated)
   - Generates realistic transaction hash

6. **Task Assignment** 📤
   - Task assigned to ResearchAgent
   - Agent status updates to "busy"

7. **Task Execution** ⏳
   - ResearchAgent "works" for 3-5 seconds
   - Simulates actual processing time

8. **Task Completion** ✅
   - ResearchAgent delivers results
   - Completion signal sent

9. **Payment Release** 💸
   - EscrowAgent releases funds
   - Balances updated
   - Transaction recorded

### Realistic Data

- **8 Different Task Types**:
  - Analyze DeFi protocol security
  - Research NFT marketplace trends
  - Evaluate Layer 2 scaling solutions
  - Study DAO governance models
  - Analyze tokenomics of new projects
  - Research cross-chain bridge security
  - Evaluate staking mechanisms
  - Study MEV protection strategies

- **Dynamic Pricing**: 10-50 MNEE per task
- **Budget Rejections**: ~10% for realism
- **Agent Balances**: Update with each transaction
- **Timestamps**: Real-time, accurate timestamps

## 📊 Dashboard Features

### Statistics Overview
- **Total Transactions**: Count of all messages
- **Transaction Volume**: Total MNEE processed
- **Active Agents**: Number of online agents
- **Success Rate**: Task completion percentage

### Agent Cards
Each agent shows:
- Current balance (MNEE)
- Active tasks count
- Completed tasks count
- Status (active/busy/idle)

### Transaction Filtering
Filter activity by type:
- **All** - Show everything
- **Tasks** - Task requests/responses
- **Escrow** - Escrow creation/release
- **Budget** - Budget approvals/rejections

### Real-Time Updates
- WebSocket connection for instant updates
- No page refresh needed
- Smooth animations on new data
- Connection status indicator

## 🎨 Enhanced UI Features

### Visual Enhancements
- ✨ **Fade-in animations** for cards
- 📈 **Count-up animations** for statistics
- 🎨 **Gradient buttons** for filters
- 💫 **Smooth transitions** throughout
- 🌈 **Premium dark mode** theme

### Interactive Elements
- **Filter buttons** with active states
- **Hover effects** on all cards
- **Status badges** with color coding
- **Responsive design** for all screens

## 🔧 Configuration

### Demo Speed
Edit `src/demo-mode.ts` to adjust timing:

```typescript
// Workflow interval (currently 15-25 seconds)
setInterval(async () => {
  await this.simulateTaskWorkflow();
}, 15000 + Math.random() * 10000);

// Task execution time (currently 3 seconds)
await this.delay(3000);
```

### Approval Rate
Adjust budget approval rate:

```typescript
// Currently 90% approval
const approved = Math.random() > 0.1;
```

### Task Descriptions
Add more task types in `taskDescriptions` array.

## 📈 Monitoring

### Console Output
The demo provides detailed console logs:

```
🎬 Demo: Starting task workflow - Analyze DeFi protocol security
  ✓ Task request sent
  ✓ Task accepted for 24.50 MNEE
  ✓ Budget check requested
  ✓ Budget approved
  ✓ Escrow created on-chain
  ✓ Task assigned to ResearchAgent
  ⏳ ResearchAgent working...
  ✓ Task completed
  ✓ Payment released
✅ Workflow completed!
```

### Statistics
Every 30 seconds, see summary stats:
```
📈 Stats: 5 tasks, 4 escrows
```

## 🎯 Use Cases

### 1. Live Demonstrations
Perfect for showing stakeholders how the system works without complex setup.

### 2. Feature Testing
Test dashboard features and UI changes with realistic data flow.

### 3. Development
Develop new features without needing blockchain connection.

### 4. Presentations
Impressive visual demonstration of autonomous agent coordination.

### 5. Training
Help new team members understand the system workflow.

## 🛑 Stopping Demo Mode

Press `Ctrl+C` in the terminal running the demo.

The system will:
- Gracefully shutdown all agents
- Close WebSocket connections
- Display final statistics
- Clean exit

## 🔄 Restarting

Simply run `npm run demo` again. Each session starts fresh with:
- Reset agent balances (10,000 MNEE each)
- Clean transaction history
- New workflow simulations

## 💡 Tips

1. **Keep Dashboard Open**: Watch the dashboard while demo runs for best experience
2. **Use Filters**: Try different transaction filters to see specific activity
3. **Watch Console**: Console shows detailed workflow steps
4. **Multiple Workflows**: Demo runs multiple workflows simultaneously
5. **Realistic Timing**: Workflows have realistic delays for authenticity

## 🎪 What Makes It Realistic?

- ✅ Actual message bus communication
- ✅ Real agent registration
- ✅ Authentic workflow steps
- ✅ Realistic timing delays
- ✅ Budget validation logic
- ✅ Transaction history tracking
- ✅ WebSocket real-time updates
- ✅ Proper event sequencing

## 🚀 Next Steps

After seeing the demo:
1. Explore the code in `src/demo-mode.ts`
2. Customize task descriptions
3. Adjust timing and approval rates
4. Add your own workflow scenarios
5. Integrate with actual smart contracts

---

**Enjoy the demo! 🎉**

The MNEE Agent System demonstrates the future of autonomous AI coordination on blockchain.
