/**
 * Represents a message extracted from Slack
 */
export interface ExtractedMessage {
    id: string;
    text: string;
    user: string;
    username?: string;
    channel: string;
    channelName?: string;
    timestamp: string;
    thread_ts?: string;
    reactions?: string[];
    permalink?: string;
}

/**
 * Represents processed knowledge extracted from messages
 */
export interface ProcessedKnowledge {
    id: string;
    originalMessage: ExtractedMessage;
    category: 'decisions' | 'discussions' | 'resources' | 'processes' | 'announcements';
    summary: string;
    keyPoints: string[];
    actionItems: string[];
    relevantContext: string;
    confidence: number;
    extractedAt: string;
}

/**
 * Represents statistics about the knowledge base
 */
export interface KnowledgeStats {
    totalMessages: number;
    totalKnowledgeItems: number;
    categoryCounts: Record<string, number>;
    topContributors: Array<{ user: string; count: number }>;
    channelStats: Record<string, number>;
} 