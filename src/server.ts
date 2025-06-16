import express, { Request, Response } from 'express';
import cors from 'cors';
import * as path from 'path';
import { SlackExtractor } from './slack-client';
import { KnowledgeProcessor } from './knowledge-processor';
import { KnowledgeStore } from './knowledge-store';
import { extractValidation, searchValidation } from './validation';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize services
const slackExtractor = new SlackExtractor(process.env.SLACK_BOT_TOKEN!);
const knowledgeProcessor = new KnowledgeProcessor(process.env.CLAUDE_API_KEY!);
const knowledgeStore = new KnowledgeStore();

// API Routes
app.get('/api/channels', async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const channels = await slackExtractor.getChannels(forceRefresh);
    res.json(channels);
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

app.post('/api/extract', extractValidation, async (req: Request, res: Response) => {
  const { channelIds, daysBack = 30 } = req.body;
  
  if (!channelIds || !Array.isArray(channelIds)) {
    return res.status(400).json({ error: 'Invalid channelIds parameter' });
  }
  
  try {
    console.log('Starting extraction...');
    const channels = await slackExtractor.getChannels();
    const userMap = await slackExtractor.getUsers();
    
    const selectedChannels = channels.filter(c => channelIds.includes(c.id));
    const allKnowledge = [];
    
    for (const channel of selectedChannels) {
      console.log(`Processing #${channel.name}...`);
      
      const messages = await slackExtractor.extractMessages(
        channel.id, 
        channel.name, 
        daysBack, 
        userMap
      );
      
      console.log(`Processing ${messages.length} messages for knowledge...`);
      
      for (const message of messages) {
        const knowledge = await knowledgeProcessor.processMessage(message);
        if (knowledge) {
          allKnowledge.push(knowledge);
        }
      }
    }
    
    // Filter high-confidence knowledge
    const highConfidenceKnowledge = knowledgeProcessor.filterHighConfidenceKnowledge(allKnowledge);
    
    await knowledgeStore.saveKnowledge(highConfidenceKnowledge);
    
    res.json({
      success: true,
      totalMessages: allKnowledge.length,
      knowledgeItems: highConfidenceKnowledge.length,
      channels: selectedChannels.map(c => c.name)
    });
    
  } catch (error) {
    console.error('Extraction error:', error);
    res.status(500).json({ error: 'Extraction failed' });
  }
});

app.get('/api/search', searchValidation, async (req: Request, res: Response) => {
  const { q: query, category } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }
  
  try {
    const results = await knowledgeStore.searchKnowledge(
      query as string, 
      category as string
    );
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/stats', async (req: Request, res: Response) => {
  try {
    const stats = await knowledgeStore.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

app.get('/api/knowledge', async (req: Request, res: Response) => {
  try {
    const knowledge = await knowledgeStore.loadKnowledge();
    res.json(knowledge);
  } catch (error) {
    console.error('Knowledge load error:', error);
    res.status(500).json({ error: 'Failed to load knowledge' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 