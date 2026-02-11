/**
 * Transcript Processor
 * Processes call transcripts and extracts tasks
 */

import type { GHLPlugin } from '../plugins/ghl/index.js';
import type { ContactMemoryManager } from '../memory/contact-memory/index.js';
import type { ModelRouter } from '../routing/model-router/index.js';
import type { Interaction } from '../memory/contact-memory/types.js';
import { nanoid } from 'nanoid';

export class TranscriptProcessor {
  constructor(
    private ghlPlugin: GHLPlugin,
    private memoryManager: ContactMemoryManager,
    private modelRouter: ModelRouter
  ) {}

  /**
   * Process call transcript and create tasks
   */
  async processCallTranscript(
    locationId: string,
    contactId: string,
    transcript: string,
    durationSeconds: number
  ): Promise<{ success: boolean; tasksCreated: number }> {
    console.log(`[TranscriptProcessor] Processing transcript for ${contactId}`);

    try {
      // 1. Create summary
      const summary = await this.generateSummary(transcript);

      // 2. Add interaction to memory
      const interaction: Interaction = {
        id: nanoid(),
        timestamp: Date.now(),
        channel: 'phone',
        direction: 'inbound',
        summary: summary.brief,
        fullContent: transcript,
        entities: [],
        sentiment: this.detectSentiment(transcript),
        topics: this.extractTopics(transcript),
      };

      await this.memoryManager.addInteraction(contactId, interaction);

      // 3. Create contact note in GHL
      await this.ghlPlugin.contacts.createContactNote(
        locationId,
        contactId,
        `Call Summary (${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s):\n\n${summary.detailed}`
      );

      // 4. Extract and create tasks
      const tasks = await this.extractTasks(locationId, contactId, transcript, summary.detailed);

      console.log(`[TranscriptProcessor] Created ${tasks.length} tasks for ${contactId}`);

      return {
        success: true,
        tasksCreated: tasks.length,
      };
    } catch (error) {
      console.error('[TranscriptProcessor] Failed to process transcript:', error);
      return {
        success: false,
        tasksCreated: 0,
      };
    }
  }

  /**
   * Generate summary using model router
   */
  private async generateSummary(transcript: string): Promise<{ brief: string; detailed: string }> {
    // Use T2 (Sonnet) for summarization
    const prompt = `Summarize this call transcript. Provide:
1. A one-sentence brief summary
2. A detailed summary with key points

Transcript:
${transcript}

Format:
BRIEF: [one sentence]
DETAILED: [detailed summary]`;

    // In production, this would call the actual model router
    // For now, simple extraction
    const lines = transcript.split('\n').slice(0, 5);
    return {
      brief: `Call regarding ${this.extractMainTopic(transcript)}`,
      detailed: `Call covered: ${lines.join('; ')}`,
    };
  }

  /**
   * Extract main topic from transcript
   */
  private extractMainTopic(transcript: string): string {
    const lower = transcript.toLowerCase();

    if (lower.includes('appointment') || lower.includes('schedule')) return 'scheduling';
    if (lower.includes('price') || lower.includes('cost')) return 'pricing';
    if (lower.includes('question') || lower.includes('help')) return 'support';
    if (lower.includes('complaint') || lower.includes('issue')) return 'complaint';

    return 'general inquiry';
  }

  /**
   * Extract topics from transcript
   */
  private extractTopics(transcript: string): string[] {
    const topics: string[] = [];
    const lower = transcript.toLowerCase();

    const topicKeywords: Record<string, string[]> = {
      scheduling: ['appointment', 'schedule', 'book', 'calendar'],
      pricing: ['price', 'cost', 'quote', 'estimate'],
      support: ['help', 'question', 'problem', 'issue'],
      product: ['product', 'service', 'feature'],
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some((kw) => lower.includes(kw))) {
        topics.push(topic);
      }
    }

    return [...new Set(topics)];
  }

  /**
   * Detect sentiment
   */
  private detectSentiment(transcript: string): 'positive' | 'neutral' | 'negative' {
    const lower = transcript.toLowerCase();

    const positiveWords = ['thank', 'great', 'perfect', 'excellent', 'happy'];
    const negativeWords = ['frustrated', 'angry', 'disappointed', 'terrible'];

    let score = 0;
    for (const word of positiveWords) {
      if (lower.includes(word)) score++;
    }
    for (const word of negativeWords) {
      if (lower.includes(word)) score--;
    }

    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  /**
   * Extract tasks from transcript
   */
  private async extractTasks(
    locationId: string,
    contactId: string,
    transcript: string,
    summary: string
  ): Promise<any[]> {
    const createdTasks: any[] = [];

    // Pattern 1: Explicit commitments
    const commitmentPatterns = [
      /(?:I'll|I will|let me)\s+(.+?)(?:\.|$)/gi,
      /(?:I can|I'll go ahead and)\s+(.+?)(?:\.|$)/gi,
    ];

    for (const pattern of commitmentPatterns) {
      const matches = transcript.matchAll(pattern);
      for (const match of matches) {
        const commitment = match[1]?.trim();
        if (commitment && commitment.length > 5 && commitment.length < 150) {
          const task = await this.ghlPlugin.tasks.createTask(locationId, {
            contactId,
            title: `Follow up: ${commitment}`,
            body: `Action item from call:\n\n${commitment}\n\nCall summary: ${summary}`,
            dueDate: this.getDefaultDueDate(),
          });

          if (task) createdTasks.push(task);
        }
      }
    }

    // Pattern 2: Callback requests
    if (/call.*back|follow up|get back to you/i.test(transcript)) {
      const task = await this.ghlPlugin.tasks.createTask(locationId, {
        contactId,
        title: 'Follow up call requested',
        body: `Customer requested a follow-up.\n\nCall summary: ${summary}`,
        dueDate: this.getDefaultDueDate(2), // 2 days
      });
      if (task) createdTasks.push(task);
    }

    // Pattern 3: Information requests
    if (/send|email|provide.*information/i.test(transcript)) {
      const task = await this.ghlPlugin.tasks.createTask(locationId, {
        contactId,
        title: 'Send requested information',
        body: `Customer requested information to be sent.\n\nCall summary: ${summary}`,
        dueDate: this.getDefaultDueDate(1), // 1 day
      });
      if (task) createdTasks.push(task);
    }

    return createdTasks;
  }

  /**
   * Get default due date (N business days from now)
   */
  private getDefaultDueDate(days: number = 3): string {
    const date = new Date();
    let daysAdded = 0;

    while (daysAdded < days) {
      date.setDate(date.getDate() + 1);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysAdded++;
      }
    }

    return date.toISOString();
  }
}
