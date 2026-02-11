/**
 * GoHighLevel Tasks Management
 * Task creation, management, and auto-generation from conversations
 */

import { Client } from '@gohighlevel/api-client';
import type { GHLTask } from './types.js';
import type { GHLAuth } from './auth.js';

export class GHLTasks {
  private auth: GHLAuth;
  private apiVersion: string = '2021-07-28';

  constructor(auth: GHLAuth) {
    this.auth = auth;
  }

  /**
   * Get GHL API client with valid authentication
   */
  private async getClient(locationId: string): Promise<Client> {
    const accessToken = await this.auth.getValidAccessToken(locationId);

    return new Client({
      accessToken,
      version: this.apiVersion,
    });
  }

  /**
   * Create a task
   */
  async createTask(
    locationId: string,
    taskData: {
      contactId: string;
      title: string;
      body?: string;
      dueDate?: string;
      assignedTo?: string;
    }
  ): Promise<GHLTask | null> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.contacts.createTask(taskData.contactId, {
        title: taskData.title,
        body: taskData.body,
        dueDate: taskData.dueDate,
        assignedTo: taskData.assignedTo,
      });

      return {
        id: response.task.id,
        title: response.task.title,
        body: response.task.body,
        contactId: response.task.contactId,
        assignedTo: response.task.assignedTo,
        dueDate: response.task.dueDate,
        completed: response.task.completed,
      };
    } catch (error) {
      console.error('Failed to create task:', error);
      return null;
    }
  }

  /**
   * Update a task
   */
  async updateTask(
    locationId: string,
    taskId: string,
    updates: {
      title?: string;
      body?: string;
      dueDate?: string;
      completed?: boolean;
    }
  ): Promise<GHLTask | null> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.tasks.update(taskId, updates);

      return {
        id: response.task.id,
        title: response.task.title,
        body: response.task.body,
        contactId: response.task.contactId,
        assignedTo: response.task.assignedTo,
        dueDate: response.task.dueDate,
        completed: response.task.completed,
        completedAt: response.task.completedAt,
      };
    } catch (error) {
      console.error('Failed to update task:', error);
      return null;
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(locationId: string, taskId: string): Promise<boolean> {
    try {
      const client = await this.getClient(locationId);
      await client.tasks.delete(taskId);
      return true;
    } catch (error) {
      console.error('Failed to delete task:', error);
      return false;
    }
  }

  /**
   * Get tasks for a contact
   */
  async getContactTasks(locationId: string, contactId: string): Promise<GHLTask[]> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.contacts.getTasks(contactId);

      return response.tasks.map((task: any) => ({
        id: task.id,
        title: task.title,
        body: task.body,
        contactId: task.contactId,
        assignedTo: task.assignedTo,
        dueDate: task.dueDate,
        completed: task.completed,
        completedAt: task.completedAt,
      }));
    } catch (error) {
      console.error('Failed to get contact tasks:', error);
      return [];
    }
  }

  /**
   * Extract action items from conversation transcript
   * This is called by the bridge layer after a conversation ends
   */
  async extractAndCreateTasks(
    locationId: string,
    contactId: string,
    transcript: string,
    conversationSummary?: string
  ): Promise<GHLTask[]> {
    // TODO: This will be integrated with the AI model router later
    // For now, we'll create tasks based on simple keyword extraction
    const createdTasks: GHLTask[] = [];

    // Extract explicit commitments
    const commitmentPatterns = [
      /(?:I'll|I will|let me|I can)\s+(.+?)(?:\.|$)/gi,
      /(?:call|email|send|follow up|schedule|book)\s+(.+?)(?:\.|$)/gi,
    ];

    for (const pattern of commitmentPatterns) {
      const matches = transcript.matchAll(pattern);
      for (const match of matches) {
        const commitment = match[1]?.trim();
        if (commitment && commitment.length > 5 && commitment.length < 100) {
          const task = await this.createTask(locationId, {
            contactId,
            title: `Follow up: ${commitment}`,
            body: `Action item extracted from conversation\n\nContext: ${conversationSummary || 'N/A'}`,
            dueDate: this.getDefaultDueDate(),
          });

          if (task) {
            createdTasks.push(task);
          }
        }
      }
    }

    return createdTasks;
  }

  /**
   * Get default due date (3 business days from now)
   */
  private getDefaultDueDate(): string {
    const date = new Date();
    let daysAdded = 0;

    while (daysAdded < 3) {
      date.setDate(date.getDate() + 1);
      const dayOfWeek = date.getDay();
      // Skip weekends
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysAdded++;
      }
    }

    return date.toISOString();
  }
}
