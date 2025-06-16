import { WebClient } from '@slack/web-api';
import { ExtractedMessage } from './types';

export class SlackExtractor {
  private client: WebClient;
  private rateLimitDelay = 1000; // 1 second between requests

  constructor(token: string) {
    this.client = new WebClient(token);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async handleRateLimit(retryAfter: number): Promise<void> {
    console.log(`Rate limited. Waiting ${retryAfter} seconds before retrying...`);
    await this.delay(retryAfter * 1000);
  }

  async getChannels(): Promise<Array<{ id: string; name: string; memberCount?: number }>> {
    try {
      let allChannels: any[] = [];
      let cursor: string | undefined;
      let hasMore = true;
      let pageCount = 0;
      let retryCount = 0;
      const maxRetries = 3;
      const MIN_MEMBERS = 3; // Skip channels with fewer than 3 members
      const startTime = Date.now();

      console.log('\n=== Starting Channel Fetch ===\n');

      while (hasMore) {
        try {
          pageCount++;
          const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
          console.log(`\nFetching page ${pageCount} of channels... (${elapsedMinutes} minutes elapsed)`);
          
          await this.delay(this.rateLimitDelay);
          
          const result = await this.client.conversations.list({
            types: 'public_channel,private_channel',
            exclude_archived: true,
            limit: 100,
            cursor
          });

          if (result.channels) {
            // Filter out channels with very few members
            const validChannels = result.channels.filter(channel => 
              channel.num_members && channel.num_members >= MIN_MEMBERS
            );
            
            allChannels = allChannels.concat(validChannels);
            
            console.log(`✓ Found ${validChannels.length} active channels on page ${pageCount}`);
            if (validChannels.length < result.channels.length) {
              console.log(`  (Skipped ${result.channels.length - validChannels.length} inactive channels)`);
            }
            
            retryCount = 0; // Reset retry count on successful request
          }

          hasMore = result.response_metadata?.next_cursor ? true : false;
          cursor = result.response_metadata?.next_cursor;

          if (!hasMore) {
            const totalTime = Math.floor((Date.now() - startTime) / 60000);
            console.log('\n=== Channel Fetch Complete ===');
            console.log(`Total active channels found: ${allChannels.length}`);
            console.log(`Total pages processed: ${pageCount}`);
            console.log(`Total time: ${totalTime} minutes`);
            console.log('===========================\n');
            break;
          }
        } catch (error: any) {
          if (error.code === 'slack_webapi_platform_error' && error.data?.error === 'ratelimited') {
            if (retryCount >= maxRetries) {
              const totalTime = Math.floor((Date.now() - startTime) / 60000);
              console.log('\n=== Channel Fetch Stopped (Max Retries) ===');
              console.log(`Total active channels found: ${allChannels.length}`);
              console.log(`Pages processed: ${pageCount}`);
              console.log(`Total time: ${totalTime} minutes`);
              console.log('========================================\n');
              break;
            }
            retryCount++;
            const retryAfter = error.data.retry_after || 30;
            console.log(`\n⚠️ Rate limited. Waiting ${retryAfter} seconds before retrying...`);
            await this.handleRateLimit(retryAfter);
            continue;
          }
          throw error;
        }
      }

      // Sort channels by member count
      return allChannels
        .map(channel => ({
          id: channel.id!,
          name: channel.name!,
          memberCount: channel.num_members
        }))
        .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
    } catch (error) {
      console.error('\n❌ Error fetching channels:', error);
      return [];
    }
  }

  async getUsers(): Promise<Map<string, string>> {
    const userMap = new Map<string, string>();
    
    try {
      const result = await this.client.users.list({
        limit: 1000
      });
      
      (result.members || []).forEach(user => {
        if (user.id && user.real_name) {
          userMap.set(user.id, user.real_name);
        }
      });
    } catch (error) {
      console.error('Error fetching users:', error);
    }

    return userMap;
  }

  async extractMessages(
    channelId: string, 
    channelName: string,
    daysBack: number = 30,
    userMap: Map<string, string>
  ): Promise<ExtractedMessage[]> {
    const messages: ExtractedMessage[] = [];
    const oldest = Math.floor((Date.now() - (daysBack * 24 * 60 * 60 * 1000)) / 1000);

    try {
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        await this.delay(this.rateLimitDelay);

        const result = await this.client.conversations.history({
          channel: channelId,
          oldest: oldest.toString(),
          limit: 100,
          cursor
        });

        if (result.messages) {
          for (const message of result.messages) {
            // Skip bot messages and system messages
            if (message.bot_id || message.subtype || !message.text || !message.user) {
              continue;
            }

            // Skip very short messages (likely not knowledge-rich)
            if (message.text.length < 20) {
              continue;
            }

            const extractedMessage: ExtractedMessage = {
              id: message.ts!,
              text: message.text,
              user: message.user,
              username: userMap.get(message.user) || message.user,
              channel: channelId,
              channelName,
              timestamp: new Date(parseFloat(message.ts!) * 1000).toISOString(),
              thread_ts: message.thread_ts,
              reactions: message.reactions?.map(r => r.name || '').filter(Boolean)
            };

            messages.push(extractedMessage);
          }
        }

        hasMore = result.has_more || false;
        cursor = result.response_metadata?.next_cursor;

        if (!hasMore) break;
      }

      console.log(`Extracted ${messages.length} messages from #${channelName}`);
      return messages;

    } catch (error) {
      console.error(`Error extracting messages from ${channelName}:`, error);
      return [];
    }
  }
} 