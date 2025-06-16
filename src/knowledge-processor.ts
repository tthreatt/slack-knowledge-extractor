import { ExtractedMessage, ProcessedKnowledge } from './types';
import fetch from 'node-fetch';

interface ClaudeResponse {
  category: ProcessedKnowledge['category'];
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  relevantContext: string;
  confidence: number;
}

interface ClaudeAPIResponse {
  content: Array<{
    text: string;
  }>;
}

export class KnowledgeProcessor {
  private claudeApiKey: string;
  private readonly CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
  private readonly MODEL = 'claude-3-sonnet-20240229';

  constructor(claudeApiKey: string) {
    this.claudeApiKey = claudeApiKey;
  }

  async processMessage(message: ExtractedMessage): Promise<ProcessedKnowledge | null> {
    try {
      // Skip very short messages or those without meaningful content
      if (message.text.length < 20 || this.isLowValueMessage(message.text)) {
        return null;
      }

      const prompt = this.buildPrompt(message);
      const response = await this.callClaudeAPI(prompt);
      
      if (!response) {
        // Fallback to simple processing if Claude API fails
        return this.simpleProcessing(message);
      }

      return {
        id: `knowledge_${message.id}`,
        originalMessage: message,
        category: response.category,
        summary: response.summary,
        keyPoints: response.keyPoints,
        actionItems: response.actionItems,
        relevantContext: response.relevantContext,
        confidence: response.confidence,
        extractedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error processing message:', error);
      // Fallback to simple processing on error
      return this.simpleProcessing(message);
    }
  }

  private async callClaudeAPI(prompt: string): Promise<ClaudeResponse | null> {
    try {
      const response = await fetch(this.CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.MODEL,
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.statusText}`);
      }

      const result = await response.json() as ClaudeAPIResponse;
      const content = result.content[0].text;
      
      try {
        const parsed = JSON.parse(content) as ClaudeResponse;
        // Validate required fields
        if (!this.isValidClaudeResponse(parsed)) {
          throw new Error('Invalid response format from Claude');
        }
        return parsed;
      } catch (e) {
        console.error('Failed to parse Claude response:', e);
        return null;
      }
    } catch (error) {
      console.error('Claude API call failed:', error);
      return null;
    }
  }

  private isValidClaudeResponse(response: any): response is ClaudeResponse {
    return (
      typeof response === 'object' &&
      response !== null &&
      typeof response.category === 'string' &&
      ['decisions', 'discussions', 'resources', 'processes', 'announcements'].includes(response.category) &&
      typeof response.summary === 'string' &&
      Array.isArray(response.keyPoints) &&
      response.keyPoints.every((point: any) => typeof point === 'string') &&
      Array.isArray(response.actionItems) &&
      response.actionItems.every((item: any) => typeof item === 'string') &&
      typeof response.relevantContext === 'string' &&
      typeof response.confidence === 'number' &&
      response.confidence >= 0 &&
      response.confidence <= 1
    );
  }

  private buildPrompt(message: ExtractedMessage): string {
    return `Analyze this Slack message for organizational knowledge. Extract key information and categorize it.

Message: "${message.text}"
Channel: #${message.channelName}
Author: ${message.username}
Date: ${message.timestamp}

Please analyze and respond with a JSON object containing:
- category: one of "decisions", "discussions", "resources", "processes", "announcements"
- summary: brief summary of the main point (max 100 chars)
- keyPoints: array of 2-4 key points extracted from the message
- actionItems: array of any action items or tasks mentioned
- relevantContext: why this might be important organizationally
- confidence: number 0-1 indicating how confident you are this contains valuable knowledge

Guidelines for categorization:
- "decisions": Final decisions, approvals, or policy changes
- "discussions": Ongoing debates, considerations, or brainstorming
- "resources": Links, documents, tools, or helpful information
- "processes": How-to information, workflows, or procedures
- "announcements": Important updates, news, or notifications

Only respond with the JSON object, no other text.`;
  }

  private isLowValueMessage(text: string): boolean {
    const lowValuePatterns = [
      /^thanks/i,
      /^thank you/i,
      /^\+1$/,
      /^lgtm$/i,
      /^ok$/i,
      /^yes$/i,
      /^no$/i,
      /^👍$/,
      /^👎$/,
      /^🙏$/,
      /^🙌$/,
      /^🎉$/,
      /^🎊$/,
      /^🎯$/,
      /^✅$/,
      /^❌$/
    ];

    return lowValuePatterns.some(pattern => pattern.test(text.trim()));
  }

  private simpleProcessing(message: ExtractedMessage): ProcessedKnowledge {
    const text = message.text.toLowerCase();
    let category: ProcessedKnowledge['category'] = 'discussions';
    let confidence = 0.5;

    // Enhanced rule-based categorization
    if (text.includes('decided') || text.includes('decision') || text.includes('approved') || 
        text.includes('final') || text.includes('policy') || text.includes('change')) {
      category = 'decisions';
      confidence = 0.8;
    } else if (text.includes('http') || text.includes('document') || text.includes('link') || 
               text.includes('resource') || text.includes('tool') || text.includes('guide')) {
      category = 'resources';
      confidence = 0.7;
    } else if (text.includes('process') || text.includes('how to') || text.includes('steps') || 
               text.includes('workflow') || text.includes('procedure') || text.includes('guide')) {
      category = 'processes';
      confidence = 0.7;
    } else if (text.includes('announce') || text.includes('important') || text.includes('everyone') || 
               text.includes('update') || text.includes('news') || text.includes('notice')) {
      category = 'announcements';
      confidence = 0.8;
    }

    // Extract potential action items
    const actionItems: string[] = [];
    const actionWords = [
      'todo', 'action item', 'need to', 'should', 'must', 'will do',
      'task', 'assign', 'deadline', 'due', 'schedule', 'plan'
    ];
    
    const sentences = message.text.split(/[.!?]/);
    sentences.forEach(sentence => {
      if (actionWords.some(word => sentence.toLowerCase().includes(word))) {
        actionItems.push(sentence.trim());
      }
    });

    // Extract key points
    const keyPoints = sentences
      .filter(s => s.length > 20 && s.length < 200)
      .slice(0, 3)
      .map(s => s.trim());

    return {
      id: `knowledge_${message.id}`,
      originalMessage: message,
      category,
      summary: message.text.substring(0, 100) + (message.text.length > 100 ? '...' : ''),
      keyPoints: keyPoints.length > 0 ? keyPoints : [message.text.substring(0, 50) + '...'],
      actionItems,
      relevantContext: `Discussion in #${message.channelName} by ${message.username}`,
      confidence,
      extractedAt: new Date().toISOString()
    };
  }

  filterHighConfidenceKnowledge(items: ProcessedKnowledge[], minConfidence = 0.6): ProcessedKnowledge[] {
    return items.filter(item => item.confidence >= minConfidence);
  }
} 