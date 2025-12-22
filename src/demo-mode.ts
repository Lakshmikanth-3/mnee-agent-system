import { DashboardAgent } from './agents/DashboardAgent';
import { messageBus } from './communication/MessageBus';
import { MessageType } from './communication/types';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

/**
 * Demo Mode - Simulates realistic agent activity
 */
class DemoMode {
    private dashboardAgent: DashboardAgent;
    private taskCounter = 0;
    private escrowCounter = 0;
    private agentStats = {
        StartupAgent: { activeTasks: 0, completed: 0, balance: '10000', reputation: 98 },
        ResearchAgent: { activeTasks: 0, completed: 0, balance: '10000', reputation: 95 },
        EscrowAgent: { activeTasks: 0, completed: 0, balance: '10000', reputation: 100 },
        BudgetAgent: { activeTasks: 0, completed: 0, balance: '10000', reputation: 99 },
        AuditorAgent: { activeTasks: 0, completed: 0, balance: '10000', reputation: 100 },
        JudgeAgent: { activeTasks: 0, completed: 0, balance: '10000', reputation: 100 }
    };

    private taskDescriptions = [
        'Analyze DeFi protocol security',
        'Research NFT marketplace trends',
        'Evaluate Layer 2 scaling solutions',
        'Study DAO governance models',
        'Analyze tokenomics of new projects',
        'Research cross-chain bridge security',
        'Evaluate staking mechanisms',
        'Study MEV protection strategies'
    ];

    constructor(dashboardAgent: DashboardAgent) {
        this.dashboardAgent = dashboardAgent;
        this.registerDemoAgents();
    }

    private registerDemoAgents() {
        // Register all agents with message bus
        ['StartupAgent', 'ResearchAgent', 'EscrowAgent', 'BudgetAgent', 'AuditorAgent', 'JudgeAgent'].forEach(agent => {
            messageBus.registerAgent(agent);
        });
    }

    /**
     * Simulate a complete AgentPay OS task workflow
     */
    async simulateTaskWorkflow() {
        const taskId = uuidv4();
        const description = this.taskDescriptions[Math.floor(Math.random() * this.taskDescriptions.length)];
        const price = (20 + Math.random() * 80).toFixed(2); // AgentPay OS tasks are higher value
        const milestones = 2;

        console.log(`\n⚖️ Demo: Starting AgentPay OS workflow - ${description}`);

        // Step 1: Task Request
        messageBus.sendMessage({
            id: uuidv4(),
            type: MessageType.TASK_REQUEST,
            from: 'StartupAgent',
            to: 'ResearchAgent',
            timestamp: Date.now(),
            payload: { taskId, description, requirements: ['Research', 'Analysis', 'Report'] }
        });

        // Step 2: Task Response
        await this.delay(1000);
        messageBus.sendMessage({
            id: uuidv4(),
            type: MessageType.TASK_RESPONSE,
            from: 'ResearchAgent',
            to: 'StartupAgent',
            timestamp: Date.now(),
            payload: { taskId, accepted: true, priceInMNEE: price, milestones }
        });

        // Step 3-4: Budget check (Simplified for demo)
        await this.delay(800);
        messageBus.sendMessage({
            id: uuidv4(),
            type: MessageType.BUDGET_APPROVED,
            from: 'BudgetAgent',
            to: 'StartupAgent',
            timestamp: Date.now(),
            payload: { approved: true, remainingBalance: '9450.00' }
        });

        // Step 5: Escrow Creation (Milestone aware)
        await this.delay(1200);
        const escrowId = `0x${Math.random().toString(16).substr(2, 64)}`;
        messageBus.sendMessage({
            id: uuidv4(),
            type: MessageType.ESCROW_CREATED,
            from: 'EscrowAgent',
            to: 'StartupAgent',
            timestamp: Date.now(),
            payload: { escrowId, taskId, amount: price, milestones, txHash: `0x${Math.random().toString(16).substr(2, 64)}` }
        });
        this.escrowCounter++;

        // Step 6: Task Assignment
        await this.delay(500);
        messageBus.sendMessage({
            id: uuidv4(),
            type: MessageType.TASK_ASSIGNED,
            from: 'StartupAgent',
            to: 'ResearchAgent',
            timestamp: Date.now(),
            payload: { taskId, escrowId }
        });
        this.agentStats.ResearchAgent.activeTasks++;

        // --- MILESTONE LOOP ---
        for (let i = 0; i < milestones; i++) {
            console.log(`  ⏳ Starting Milestone ${i + 1}/${milestones}`);
            await this.delay(3000);

            // 1. Completion Signal
            const milestoneResult = { summary: `Milestone ${i + 1} complete`, milestoneIndex: i };
            messageBus.sendMessage({
                id: uuidv4(),
                type: MessageType.TASK_COMPLETED,
                from: 'ResearchAgent',
                to: 'StartupAgent',
                timestamp: Date.now(),
                payload: { taskId, results: milestoneResult }
            });

            // 2. AI Audit Request
            await this.delay(800);
            messageBus.sendMessage({
                id: uuidv4(),
                type: MessageType.AUDIT_REQUEST,
                from: 'StartupAgent',
                to: 'AuditorAgent',
                timestamp: Date.now(),
                payload: { taskId, milestoneIndex: i, content: milestoneResult }
            });

            // 3. AI Audit Result
            await this.delay(2000);
            const auditPassed = Math.random() > 0.25; // 25% chance of audit failure/dispute for hackathon demo
            const failureReasons = [
                'Inconsistent data points in section 2',
                'Schema mismatch with project requirements',
                'Compliance violation: Restricted jurisdiction reference',
                'Substandard quality: AI generated hallucinations detected',
                'Unverified external links used as primary sources'
            ];
            const reason = auditPassed ? 'Quality Verified' : failureReasons[Math.floor(Math.random() * failureReasons.length)];

            messageBus.sendMessage({
                id: uuidv4(),
                type: MessageType.AUDIT_COMPLETED,
                from: 'AuditorAgent',
                to: 'StartupAgent',
                timestamp: Date.now(),
                payload: { taskId, milestoneIndex: i, passed: auditPassed, reason }
            });

            if (!auditPassed) {
                console.log('  ⚠️ Dispute Raised by Auditor!');
                // Raise Dispute
                messageBus.sendMessage({
                    id: uuidv4(),
                    type: MessageType.DISPUTE_RAISED,
                    from: 'StartupAgent',
                    to: 'EscrowAgent',
                    timestamp: Date.now(),
                    payload: { taskId, raiser: 'AuditorAgent' }
                });

                // Judge Mediation
                await this.delay(4000);
                const resolution = Math.random() > 0.5 ? 'PARTIAL' : 'REFUND';
                messageBus.sendMessage({
                    id: uuidv4(),
                    type: MessageType.DISPUTE_RESOLVED,
                    from: 'JudgeAgent',
                    to: 'EscrowAgent',
                    timestamp: Date.now(),
                    payload: { taskId, resolution }
                });
                console.log(`  ⚖️ Judge Resolution: ${resolution}`);
                break; // End workflow on dispute for demo simplicity
            }

            // 4. Proof Submission & Verification
            await this.delay(1000);
            messageBus.sendMessage({
                id: uuidv4(),
                type: MessageType.WORK_PROOF_SUBMITTED,
                from: 'ResearchAgent',
                to: 'EscrowAgent',
                timestamp: Date.now(),
                payload: { taskId, milestoneIndex: i, workHash: `0x${Math.random().toString(16).substr(2, 64)}` }
            });

            await this.delay(1000);
            messageBus.sendMessage({
                id: uuidv4(),
                type: MessageType.WORK_PROOF_VERIFIED,
                from: 'EscrowAgent',
                to: 'StartupAgent',
                timestamp: Date.now(),
                payload: { taskId, milestoneIndex: i }
            });

            // 5. Milestone Release
            await this.delay(1000);
            messageBus.sendMessage({
                id: uuidv4(),
                type: MessageType.MILESTONE_RELEASED,
                from: 'EscrowAgent',
                to: 'StartupAgent',
                timestamp: Date.now(),
                payload: { taskId, milestoneIndex: i, txHash: `0x${Math.random().toString(16).substr(2, 64)}` }
            });
            console.log(`  ✅ Milestone ${i + 1} Paid!`);
        }

        this.agentStats.ResearchAgent.activeTasks--;
        this.agentStats.ResearchAgent.completed++;
        console.log('🏁 AgentPay OS Workflow complete!\n');
    }

    /**
     * Run continuous demo mode
     */
    async runContinuousDemo() {
        console.log('🎭 Demo Mode: Running continuous simulation...\n');

        // Run initial workflow
        await this.simulateTaskWorkflow();

        // Continue with random intervals
        setInterval(async () => {
            await this.simulateTaskWorkflow();
        }, 15000 + Math.random() * 10000); // Every 15-25 seconds
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStats() {
        return {
            totalTasks: this.taskCounter,
            totalEscrows: this.escrowCounter,
            agents: this.agentStats
        };
    }
}

async function main() {
    console.log('=== MNEE Agent System - Demo Mode ===\n');

    // Start Dashboard Agent
    const dashboardAgent = new DashboardAgent(
        process.env.DASHBOARD_AGENT_PRIVATE_KEY!,
        RPC_URL,
        parseInt(process.env.WEBSOCKET_PORT || '8080')
    );

    console.log('✅ Dashboard Agent initialized');
    console.log('📊 Dashboard UI: http://localhost:3001');
    console.log('🔌 WebSocket: ws://localhost:8080\n');

    // Start Demo Mode
    const demo = new DemoMode(dashboardAgent);

    console.log('🎬 Starting demo mode in 3 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Run continuous demo
    demo.runContinuousDemo();

    // Periodic stats update
    setInterval(() => {
        const stats = demo.getStats();
        console.log(`\n📈 Stats: ${stats.totalTasks} tasks, ${stats.totalEscrows} escrows`);
    }, 30000);

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\n👋 Shutting down demo mode...');
        dashboardAgent.shutdown();
        process.exit(0);
    });
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
