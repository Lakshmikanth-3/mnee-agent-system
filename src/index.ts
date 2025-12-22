import * as dotenv from 'dotenv';
import { StartupAgent } from './agents/StartupAgent';
import { ResearchAgent } from './agents/ResearchAgent';
import { EscrowAgent } from './agents/EscrowAgent';
import { BudgetAgent } from './agents/BudgetAgent';
import { DashboardAgent } from './agents/DashboardAgent';
import { AuditorAgent } from './agents/AuditorAgent';
import { JudgeAgent } from './agents/JudgeAgent';
import { ethers } from 'ethers';

// Load environment variables
dotenv.config();

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const MNEE_TOKEN_ADDRESS = process.env.MNEE_TOKEN_ADDRESS || '';
const ESCROW_CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS || '';

async function main() {
    console.log('=== MNEE Multi-Agent System Starting ===\n');

    if (!MNEE_TOKEN_ADDRESS || !ESCROW_CONTRACT_ADDRESS) {
        console.error('ERROR: Contract addresses not set in .env file');
        console.error('Please deploy contracts first and update .env');
        process.exit(1);
    }

    // Initialize agents
    console.log('Initializing agents...\n');

    const budgetAgent = new BudgetAgent(
        process.env.BUDGET_AGENT_PRIVATE_KEY!,
        RPC_URL,
        MNEE_TOKEN_ADDRESS,
        {
            totalBudget: ethers.parseEther(process.env.TOTAL_BUDGET || '10000'),
            dailyLimit: ethers.parseEther(process.env.DAILY_LIMIT || '1000'),
            perTaskLimit: ethers.parseEther(process.env.PER_TASK_LIMIT || '100')
        }
    );

    const escrowAgent = new EscrowAgent(
        process.env.ESCROW_AGENT_PRIVATE_KEY!,
        RPC_URL,
        ESCROW_CONTRACT_ADDRESS,
        MNEE_TOKEN_ADDRESS
    );

    const researchAgent = new ResearchAgent(
        process.env.RESEARCH_AGENT_PRIVATE_KEY!,
        RPC_URL,
        MNEE_TOKEN_ADDRESS,
        '10' // 10 MNEE base price
    );

    const startupAgent = new StartupAgent(
        process.env.STARTUP_AGENT_PRIVATE_KEY!,
        RPC_URL,
        MNEE_TOKEN_ADDRESS
    );

    const dashboardAgent = new DashboardAgent(
        process.env.DASHBOARD_AGENT_PRIVATE_KEY!,
        RPC_URL,
        parseInt(process.env.WEBSOCKET_PORT || '8080')
    );

    const auditorAgent = new AuditorAgent(
        process.env.AUDITOR_AGENT_PRIVATE_KEY || '0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e',
        RPC_URL
    );

    const judgeAgent = new JudgeAgent(
        process.env.JUDGE_AGENT_PRIVATE_KEY || '0xde9be85859411c49423129eac10405102a7445b026107f910d2d81dd938159ad',
        RPC_URL
    );

    console.log('\n=== All Agents Initialized ===\n');

    // Display agent addresses
    console.log('Agent Addresses:');
    console.log(`StartupAgent: ${startupAgent.getAddress()}`);
    console.log(`ResearchAgent: ${researchAgent.getAddress()}`);
    console.log(`EscrowAgent: ${escrowAgent.getAddress()}`);
    console.log(`BudgetAgent: ${budgetAgent.getAddress()}`);
    console.log(`DashboardAgent: ${dashboardAgent.getAddress()}`);
    console.log(`AuditorAgent: ${auditorAgent.getAddress()}`);
    console.log(`JudgeAgent: ${judgeAgent.getAddress()}`);

    // Display budget status
    const budgetStatus = await budgetAgent.getBudgetStatus();
    console.log('\nBudget Status:');
    console.log(`Current Balance: ${budgetStatus.currentBalance} MNEE`);
    console.log(`Total Budget Limit: ${budgetStatus.limits.total} MNEE`);
    console.log(`Daily Limit: ${budgetStatus.limits.daily} MNEE`);
    console.log(`Per-Task Limit: ${budgetStatus.limits.perTask} MNEE`);

    console.log('\n=== System Ready ===');
    console.log('Dashboard WebSocket: ws://localhost:8080');
    console.log('\nDemo: Hiring ResearchAgent for a task...\n');

    // Demo: Hire research agent
    await delay(2000);
    await startupAgent.hireAgent(
        'Analyze Ethereum DeFi protocols',
        ['Research top 10 DeFi protocols', 'Compare TVL and security', 'Provide recommendations']
    );

    // Keep the process running
    console.log('\nSystem running... Press Ctrl+C to exit\n');

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\nShutting down agents...');
        startupAgent.shutdown();
        researchAgent.shutdown();
        escrowAgent.shutdown();
        budgetAgent.shutdown();
        dashboardAgent.shutdown();
        auditorAgent.shutdown();
        judgeAgent.shutdown();
        console.log('Goodbye!');
        process.exit(0);
    });
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
