import { BaseAgent } from './BaseAgent';
import { Message, MessageType, DisputeResolution } from '../communication/types';

/**
 * JudgeAgent - Automated AI Mediator for dispute resolution.
 */
export class JudgeAgent extends BaseAgent {
    constructor(privateKey: string, rpcUrl: string) {
        super('JudgeAgent', privateKey, rpcUrl);
        this.log('JudgeAgent initialized - Monitoring for system disputes');
    }

    protected async handleMessage(message: Message): Promise<void> {
        switch (message.type) {
            case MessageType.DISPUTE_RAISED:
                await this.handleDispute(message);
                break;
            default:
                break;
        }
    }

    private async handleDispute(message: Message): Promise<void> {
        const { taskId, raiser } = message.payload;

        this.log(`Dispute detected for task ${taskId} (Raised by: ${raiser})`);
        this.log(`Reviewing task history, communications, and output quality...`);

        // Simulate complex AI mediation delay
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Simulated Legal/AI logic
        const roll = Math.random();
        let resolution: 'FULL' | 'PARTIAL' | 'REFUND' = 'PARTIAL';
        let reason = 'AI Judge found merits on both sides. Split resolution advised.';

        if (roll > 0.7) {
            resolution = 'FULL';
            reason = 'AI Review confirms work meets 100% of requirements. Full payment mandated.';
        } else if (roll < 0.3) {
            resolution = 'REFUND';
            reason = 'AI Review confirms critical failures in task execution. Full refund mandated.';
        }

        this.log(`Mediation Complete. DECREE: ${resolution}. Reason: ${reason}`);

        const payload: DisputeResolution = {
            taskId,
            resolution
        };

        // Notify EscrowAgent to execute the resolution
        this.sendMessage('EscrowAgent', MessageType.RESOLVE_DISPUTE, payload);
    }
}
