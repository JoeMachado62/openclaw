/**
 * GoHighLevel Conversations Management
 * Conversation and message history retrieval
 */

import { Client } from '@gohighlevel/api-client';
import type { GHLConversation, GHLMessage } from './types.js';
import type { GHLAuth } from './auth.js';

export class GHLConversations {
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
   * Get conversation by ID
   */
  async getConversation(locationId: string, conversationId: string): Promise<GHLConversation | null> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.conversations.get(conversationId);

      return this.mapConversationResponse(response.conversation);
    } catch (error) {
      console.error('Failed to get conversation:', error);
      return null;
    }
  }

  /**
   * Search conversations by contact ID
   */
  async getConversationsByContact(locationId: string, contactId: string): Promise<GHLConversation[]> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.conversations.search({
        locationId,
        contactId,
      });

      return response.conversations.map((conv: any) => this.mapConversationResponse(conv));
    } catch (error) {
      console.error('Failed to search conversations:', error);
      return [];
    }
  }

  /**
   * Get messages from a conversation
   */
  async getMessages(
    locationId: string,
    conversationId: string,
    options?: {
      limit?: number;
      lastMessageId?: string;
      type?: 'SMS' | 'Email' | 'WhatsApp' | 'GMB' | 'FB' | 'Instagram' | 'Live_Chat';
    }
  ): Promise<GHLMessage[]> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.conversations.getMessages(conversationId, {
        limit: options?.limit || 100,
        lastMessageId: options?.lastMessageId,
        type: options?.type,
      });

      return response.messages.map((msg: any) => this.mapMessageResponse(msg));
    } catch (error) {
      console.error('Failed to get messages:', error);
      return [];
    }
  }

  /**
   * Get all messages for a contact across all conversations
   */
  async getAllContactMessages(locationId: string, contactId: string, limit?: number): Promise<GHLMessage[]> {
    try {
      // First get all conversations for the contact
      const conversations = await this.getConversationsByContact(locationId, contactId);

      // Then get messages from each conversation
      const allMessages: GHLMessage[] = [];

      for (const conversation of conversations) {
        const messages = await this.getMessages(locationId, conversation.id, { limit: limit || 50 });
        allMessages.push(...messages);
      }

      // Sort by date (newest first)
      allMessages.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());

      return allMessages;
    } catch (error) {
      console.error('Failed to get all contact messages:', error);
      return [];
    }
  }

  /**
   * Send a message
   */
  async sendMessage(
    locationId: string,
    conversationId: string,
    message: {
      type: 'SMS' | 'Email' | 'WhatsApp';
      message: string;
      subject?: string; // For email
      attachments?: Array<{ url: string; name: string }>;
    }
  ): Promise<GHLMessage | null> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.conversations.sendMessage(conversationId, {
        type: message.type,
        message: message.message,
        ...(message.subject && { subject: message.subject }),
        ...(message.attachments && { attachments: message.attachments }),
      });

      return this.mapMessageResponse(response.message);
    } catch (error) {
      console.error('Failed to send message:', error);
      return null;
    }
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    locationId: string,
    contactId: string,
    type: 'SMS' | 'Email' | 'WhatsApp'
  ): Promise<GHLConversation | null> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.conversations.create({
        locationId,
        contactId,
        type,
      });

      return this.mapConversationResponse(response.conversation);
    } catch (error) {
      console.error('Failed to create conversation:', error);
      return null;
    }
  }

  /**
   * Build conversation history summary for AI context
   */
  async buildConversationHistory(
    locationId: string,
    contactId: string,
    options?: {
      maxMessages?: number;
      includeSummaries?: boolean;
    }
  ): Promise<string> {
    const messages = await this.getAllContactMessages(locationId, contactId, options?.maxMessages || 50);

    if (messages.length === 0) {
      return 'No previous conversations found.';
    }

    let history = `Conversation history for contact (${messages.length} messages):\n\n`;

    for (const message of messages) {
      const date = new Date(message.dateAdded).toLocaleString();
      const direction = message.direction === 'inbound' ? '👤 Customer' : '🤖 Agent';
      const channel = message.type;

      history += `[${date}] ${direction} (${channel}): ${message.body}\n`;
    }

    return history;
  }

  /**
   * Map GHL API response to our conversation type
   */
  private mapConversationResponse(conversation: any): GHLConversation {
    return {
      id: conversation.id,
      locationId: conversation.locationId,
      contactId: conversation.contactId,
      type: conversation.type,
      lastMessageBody: conversation.lastMessageBody,
      lastMessageDate: conversation.lastMessageDate,
      unreadCount: conversation.unreadCount,
      starred: conversation.starred,
    };
  }

  /**
   * Map GHL API response to our message type
   */
  private mapMessageResponse(message: any): GHLMessage {
    return {
      id: message.id,
      conversationId: message.conversationId,
      type: message.type,
      body: message.body,
      direction: message.direction,
      status: message.status,
      dateAdded: message.dateAdded,
      attachments: message.attachments?.map((att: any) => ({
        id: att.id,
        url: att.url,
        type: att.type,
        name: att.name,
      })),
    };
  }
}
