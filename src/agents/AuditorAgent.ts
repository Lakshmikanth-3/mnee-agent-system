import { BaseAgent } from './BaseAgent';
import { Message, MessageType, AuditRequest, AuditResult } from '../communication/types';

/**
 * AuditorAgent - Specialized AI that verifies work quality and completeness.
 */
export class AuditorAgent extends BaseAgent {
    constructor(privateKey: string, rpcUrl: string) {
        super('AuditorAgent', privateKey, rpcUrl);
        this.log('AuditorAgent initialized and ready to verify work integrity');
    }

    protected async handleMessage(message: Message): Promise<void> {
        switch (message.type) {
            case MessageType.AUDIT_REQUEST:
                await this.handleAuditRequest(message);
                break;
            default:
                break;
        }
    }

    private async handleAuditRequest(message: Message): Promise<void> {
        const { taskId, milestoneIndex, content } = message.payload as AuditRequest;

        this.log(`Received audit request for task ${taskId}, milestone ${milestoneIndex}`);
        this.log(`Analyzing content for quality and completeness...`);

        // Simulate AI analysis delay
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Simulated AI Logic: Reject if content is too short or missing keywords
        let passed = true;
        let reason = 'Work quality meets AgentPay OS standards.';

        if (!content || JSON.stringify(content).length < 50) {
            passed = false;
            reason = 'Insufficient detail or low quality results detected by AI analysis.';
        } else if (Math.random() < 0.1) { // 10% chance of random failure for demo variability
            passed = false;
            reason = 'AI verification detected inconsistencies in the research data.';
        }

        const result: AuditResult = {
            taskId,
            milestoneIndex,
            passed,
            reason
        };

        this.log(`Audit completed: ${passed ? 'PASSED' : 'FAILED'}. Reason: ${reason}`);
        this.sendMessage(message.from, MessageType.AUDIT_COMPLETED, result);
    }
}
