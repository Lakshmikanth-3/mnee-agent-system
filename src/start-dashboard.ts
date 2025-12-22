import * as dotenv from 'dotenv';
import { DashboardAgent } from './agents/DashboardAgent';

// Load environment variables
dotenv.config();

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

async function main() {
    console.log('=== Starting MNEE Dashboard Agent ===\n');

    // Start only the dashboard agent for now
    const dashboardAgent = new DashboardAgent(
        process.env.DASHBOARD_AGENT_PRIVATE_KEY!,
        RPC_URL,
        parseInt(process.env.WEBSOCKET_PORT || '8080')
    );

    console.log('\n=== Dashboard Agent Running ===');
    console.log('WebSocket server: ws://localhost:8080');
    console.log('Dashboard UI: http://localhost:3001');
    console.log('\nPress Ctrl+C to exit\n');

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\nShutting down...');
        dashboardAgent.shutdown();
        console.log('Goodbye!');
        process.exit(0);
    });

    // Keep process alive
    setInterval(() => {
        // Broadcast update every 5 seconds
        dashboardAgent.broadcastUpdate();
    }, 5000);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
