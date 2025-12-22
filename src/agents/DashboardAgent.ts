import { BaseAgent } from './BaseAgent';
import { Message, MessageType, AgentStatus } from '../communication/types';
import { messageBus } from '../communication/MessageBus';
import WebSocket from 'ws';

interface DashboardData {
    agents: any[];
    activeTasks: any[];
    escrows: any[];
    transactions: any[];
    marketStats: {
        totalFees: string;
        averageReputation: number;
        activeDisputes: number;
    };
    timestamp: number;
}

/**
 * DashboardAgent - Aggregates data and provides real-time updates
 */
export class DashboardAgent extends BaseAgent {
    private wsServer: WebSocket.Server | null = null;
    private clients: Set<WebSocket> = new Set();
    private transactions: any[] = [];

    constructor(
        privateKey: string,
        rpcUrl: string,
        websocketPort: number = 8080
    ) {
        super('DashboardAgent', privateKey, rpcUrl);

        // Start WebSocket server
        this.startWebSocketServer(websocketPort);

        // Listen to all messages for monitoring
        messageBus.on('message', this.recordTransaction.bind(this));
    }

    protected async handleMessage(message: Message): Promise<void> {
        // DashboardAgent monitors all messages but doesn't respond
        // Just update dashboard data
        await this.broadcastUpdate();
    }

    /**
     * Start WebSocket server for real-time updates
     */
    private startWebSocketServer(port: number): void {
        this.wsServer = new WebSocket.Server({ port });

        this.wsServer.on('connection', (ws: WebSocket) => {
            this.log(`New dashboard client connected`);
            this.clients.add(ws);

            // Send initial data
            this.sendDashboardData(ws);

            ws.on('message', (messageData: string) => {
                try {
                    const request = JSON.parse(messageData);
                    if (request.type === 'HIRE_AGENT') {
                        this.log(`Received hire request from client for ${request.agentName}`);

                        // Bridge UI request to StartupAgent
                        this.broadcast(MessageType.USER_TASK_REQUEST, {
                            taskDescription: `Direct hire of ${request.agentName} via Dashboard`,
                            requirements: ['automated_execution'],
                            targetAgent: request.agentName
                        });
                    }
                } catch (error) {
                    this.log(`Failed to parse client message: ${error instanceof Error ? error.message : String(error)}`, 'error');
                }
            });

            ws.on('close', () => {
                this.clients.delete(ws);
                this.log(`Dashboard client disconnected`);
            });

            ws.on('error', (error) => {
                this.log(`WebSocket error: ${error.message}`, 'error');
            });
        });

        this.log(`WebSocket server started on port ${port}`);
    }

    /**
     * Record transaction for history
     */
    private recordTransaction(message: Message): void {
        this.transactions.push({
            id: message.id,
            type: message.type,
            from: message.from,
            to: message.to,
            timestamp: message.timestamp,
            payload: message.payload
        });

        // Keep only last 100 transactions
        if (this.transactions.length > 100) {
            this.transactions.shift();
        }
    }

    /**
     * Aggregate dashboard data
     */
    async aggregateDashboardData(): Promise<DashboardData> {
        const agents = messageBus.getRegisteredAgents();
        const agentStatuses: any[] = [];

        // Get status from each agent
        for (const agentName of agents) {
            const repMsg = messageBus.getHistory({ type: MessageType.REPUTATION_UPDATED })
                .filter(m => m.payload.agent === agentName || m.payload.agentName === agentName)
                .pop();

            agentStatuses.push({
                agentName,
                balance: '0',
                activeTasks: 0,
                totalTasksCompleted: 0,
                status: 'active',
                reputation: repMsg ? repMsg.payload.newReputation : 50 // Default
            } as any);
        }

        // Get active tasks from message history
        const taskMessages = messageBus.getHistory({ type: MessageType.TASK_REQUEST });
        const activeTasks = taskMessages.slice(-10).map(msg => ({
            taskId: msg.payload.taskId,
            description: msg.payload.description,
            status: 'active',
            timestamp: msg.timestamp
        }));

        // Get escrow info from message history
        const escrowMessages = messageBus.getHistory({ type: MessageType.ESCROW_CREATED });
        const escrows = escrowMessages.slice(-10).map(msg => {
            const taskId = msg.payload.taskId;
            const milestones = msg.payload.milestones || 1;

            const proofMsgs = messageBus.getHistory({ type: MessageType.WORK_PROOF_SUBMITTED })
                .filter(m => m.payload.taskId === taskId);
            const verifiedMsgs = messageBus.getHistory({ type: MessageType.WORK_PROOF_VERIFIED })
                .filter(m => m.payload.taskId === taskId);
            const releasedMsgs = messageBus.getHistory({ type: MessageType.MILESTONE_RELEASED })
                .filter(m => m.payload.taskId === taskId);
            const disputeMsg = messageBus.getHistory({ type: MessageType.DISPUTE_RAISED })
                .find(m => m.payload.taskId === taskId);
            const resolvedMsg = messageBus.getHistory({ type: MessageType.DISPUTE_RESOLVED })
                .find(m => m.payload.taskId === taskId);

            let status = 'Active';
            if (resolvedMsg) status = `Resolved (${resolvedMsg.payload.resolution})`;
            else if (disputeMsg) status = 'IN DISPUTE';
            else if (releasedMsgs.length === milestones) status = 'Completed';
            else if (verifiedMsgs.length > releasedMsgs.length) status = 'Awaiting Release';
            else if (proofMsgs.length > verifiedMsgs.length) status = 'Awaiting Verification';

            return {
                taskId,
                amount: msg.payload.amount,
                milestonesTotal: milestones,
                milestonesCompleted: releasedMsgs.length,
                status,
                disputeStatus: disputeMsg ? (resolvedMsg ? 'RESOLVED' : 'OPEN') : 'NONE',
                timestamp: msg.timestamp
            };
        });

        return {
            agents: agentStatuses,
            activeTasks,
            escrows,
            transactions: this.transactions.slice(-20),
            marketStats: {
                totalFees: '0.5%',
                averageReputation: agentStatuses.reduce((acc, a: any) => acc + (a.reputation || 0), 0) / (agentStatuses.length || 1),
                activeDisputes: escrows.filter(e => e.disputeStatus === 'OPEN').length
            },
            timestamp: Date.now()
        };
    }

    /**
     * Send dashboard data to a specific client
     */
    private async sendDashboardData(ws: WebSocket): Promise<void> {
        const data = await this.aggregateDashboardData();
        ws.send(JSON.stringify(data));
    }

    /**
     * Broadcast update to all connected clients
     */
    async broadcastUpdate(): Promise<void> {
        const data = await this.aggregateDashboardData();
        const message = JSON.stringify(data);

        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    /**
     * Get current dashboard data
     */
    async getDashboardData(): Promise<DashboardData> {
        return await this.aggregateDashboardData();
    }

    /**
     * Cleanup on shutdown
     */
    override shutdown(): void {
        if (this.wsServer) {
            this.wsServer.close();
            this.log('WebSocket server closed');
        }
        super.shutdown();
    }
}
