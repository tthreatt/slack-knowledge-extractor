import * as fs from 'fs/promises';
import * as path from 'path';
import { ProcessedKnowledge, KnowledgeStats, ExtractedMessage } from './types';

export class KnowledgeStore {
  private dataDir: string;

  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.ensureDataDir();
  }

  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('Error creating data directory:', error);
    }
  }

  async saveKnowledge(knowledge: ProcessedKnowledge[]): Promise<void> {
    const filePath = path.join(this.dataDir, 'knowledge.json');
    
    try {
      // Load existing knowledge
      let existingKnowledge: ProcessedKnowledge[] = [];
      try {
        const existingData = await fs.readFile(filePath, 'utf-8');
        existingKnowledge = JSON.parse(existingData);
      } catch {
        // File doesn't exist yet, start fresh
      }

      // Merge and deduplicate
      const allKnowledge = [...existingKnowledge];
      const existingIds = new Set(existingKnowledge.map(k => k.id));

      knowledge.forEach(item => {
        if (!existingIds.has(item.id)) {
          allKnowledge.push(item);
        }
      });

      await fs.writeFile(filePath, JSON.stringify(allKnowledge, null, 2));
      console.log(`Saved ${allKnowledge.length} knowledge items`);
    } catch (error) {
      console.error('Error saving knowledge:', error);
    }
  }

  async loadKnowledge(): Promise<ProcessedKnowledge[]> {
    const filePath = path.join(this.dataDir, 'knowledge.json');
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async searchKnowledge(query: string, category?: string): Promise<ProcessedKnowledge[]> {
    const knowledge = await this.loadKnowledge();
    const searchTerm = query.toLowerCase();

    return knowledge.filter(item => {
      const matchesQuery = 
        item.summary.toLowerCase().includes(searchTerm) ||
        item.keyPoints.some(point => point.toLowerCase().includes(searchTerm)) ||
        item.originalMessage.text.toLowerCase().includes(searchTerm);

      const matchesCategory = !category || item.category === category;

      return matchesQuery && matchesCategory;
    });
  }

  async getStats(): Promise<KnowledgeStats> {
    const knowledge = await this.loadKnowledge();
    
    const categoryCounts: Record<string, number> = {};
    const contributorCounts: Record<string, number> = {};
    const channelCounts: Record<string, number> = {};

    knowledge.forEach(item => {
      // Category counts
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      
      // Contributor counts
      const user = item.originalMessage.username || item.originalMessage.user;
      contributorCounts[user] = (contributorCounts[user] || 0) + 1;
      
      // Channel counts
      const channel = item.originalMessage.channelName || item.originalMessage.channel;
      channelCounts[channel] = (channelCounts[channel] || 0) + 1;
    });

    const topContributors = Object.entries(contributorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([user, count]) => ({ user, count }));

    return {
      totalMessages: knowledge.length,
      totalKnowledgeItems: knowledge.length,
      categoryCounts,
      topContributors,
      channelStats: channelCounts
    };
  }
} 