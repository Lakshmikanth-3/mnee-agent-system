import { BaseAgent } from './BaseAgent';
import { Message } from '../communication/types';
import { messageBus } from '../communication/MessageBus';
import WebSocket from 'ws';

export class DashboardAgent extends BaseAgent {
    private static server: WebSocket.Server | null = null;
    private static clients = new Set<WebSocket>();

    constructor(privateKey: string, rpcUrl: string, port = 8080) {
        super('DashboardAgent', privateKey, rpcUrl);

        if (!DashboardAgent.server) {
            this.startServer(port);
        }

        messageBus.on('message', this.handleMessage.bind(this));
    }

    private startServer(port: number) {
        DashboardAgent.server = new WebSocket.Server({ port });

        DashboardAgent.server.on('connection', (ws) => {
            DashboardAgent.clients.add(ws);
            ws.on('close', () => DashboardAgent.clients.delete(ws));
        });

        console.log(`Dashboard WebSocket running on ws://localhost:${port}`);
    }

    protected async handleMessage(message: Message): Promise<void> {
        await this.broadcastUpdate();
    }

    public async broadcastUpdate(): Promise<void> {
        const payload = JSON.stringify({ timestamp: Date.now() });
        for (const client of DashboardAgent.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        }
    }
}
