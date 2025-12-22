import { EventEmitter } from 'events';
import { Message, MessageType } from './types';

/**
 * MessageBus - Pub/Sub system for inter-agent communication
 */
export class MessageBus extends EventEmitter {
    private agents: Map<string, boolean> = new Map();
    private messageHistory: Message[] = [];
    private maxHistorySize: number = 1000;

    constructor() {
        super();
        this.setMaxListeners(50); // Support many agents
    }

    /**
     * Register an agent with the message bus
     */
    registerAgent(agentName: string): void {
        if (this.agents.has(agentName)) {
            console.warn(`Agent ${agentName} is already registered`);
            return;
        }
        this.agents.set(agentName, true);
        console.log(`[MessageBus] Agent registered: ${agentName}`);
    }

    /**
     * Unregister an agent
     */
    unregisterAgent(agentName: string): void {
        this.agents.delete(agentName);
        console.log(`[MessageBus] Agent unregistered: ${agentName}`);
    }

    /**
     * Send a message to a specific agent
     */
    sendMessage(message: Message): void {
        if (!this.agents.has(message.to)) {
            console.error(`[MessageBus] Target agent not found: ${message.to}`);
            return;
        }

        // Store in history
        this.messageHistory.push(message);
        if (this.messageHistory.length > this.maxHistorySize) {
            this.messageHistory.shift();
        }

        // Emit to specific agent
        this.emit(`message:${message.to}`, message);

        // Also emit globally for monitoring
        this.emit('message', message);

        console.log(`[MessageBus] Message sent: ${message.type} from ${message.from} to ${message.to}`);
    }

    /**
     * Broadcast a message to all agents
     */
    broadcast(message: Omit<Message, 'to'>): void {
        this.agents.forEach((_, agentName) => {
            if (agentName !== message.from) {
                this.sendMessage({ ...message, to: agentName } as Message);
            }
        });
    }

    /**
     * Subscribe to messages for a specific agent
     */
    subscribe(agentName: string, callback: (message: Message) => void): void {
        this.on(`message:${agentName}`, callback);
    }

    /**
     * Unsubscribe from messages
     */
    unsubscribe(agentName: string, callback: (message: Message) => void): void {
        this.off(`message:${agentName}`, callback);
    }

    /**
     * Get message history
     */
    getHistory(filter?: { from?: string; to?: string; type?: MessageType }): Message[] {
        if (!filter) return [...this.messageHistory];

        return this.messageHistory.filter(msg => {
            if (filter.from && msg.from !== filter.from) return false;
            if (filter.to && msg.to !== filter.to) return false;
            if (filter.type && msg.type !== filter.type) return false;
            return true;
        });
    }

    /**
     * Get list of registered agents
     */
    getRegisteredAgents(): string[] {
        return Array.from(this.agents.keys());
    }
}

// Singleton instance
export const messageBus = new MessageBus();
