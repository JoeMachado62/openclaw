/**
 * GoHighLevel Tags and Smart Lists Management
 * Manage tags, create smart lists based on criteria
 */

import { Client } from '@gohighlevel/api-client';
import type { GHLAuth } from './auth.js';

export interface GHLTag {
  id: string;
  name: string;
  locationId: string;
}

export class GHLTags {
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
   * Get all tags for a location
   */
  async getTags(locationId: string): Promise<GHLTag[]> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.locations.getTags(locationId);

      return response.tags.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        locationId: tag.locationId,
      }));
    } catch (error) {
      console.error('Failed to get tags:', error);
      return [];
    }
  }

  /**
   * Add tag to contact
   */
  async addTagToContact(locationId: string, contactId: string, tagName: string): Promise<boolean> {
    try {
      const client = await this.getClient(locationId);
      await client.contacts.addTag(contactId, {
        tags: [tagName],
      });

      console.log(`[GHL Tags] Added tag "${tagName}" to contact ${contactId}`);
      return true;
    } catch (error) {
      console.error('Failed to add tag to contact:', error);
      return false;
    }
  }

  /**
   * Remove tag from contact
   */
  async removeTagFromContact(
    locationId: string,
    contactId: string,
    tagName: string
  ): Promise<boolean> {
    try {
      const client = await this.getClient(locationId);
      await client.contacts.removeTag(contactId, {
        tags: [tagName],
      });

      console.log(`[GHL Tags] Removed tag "${tagName}" from contact ${contactId}`);
      return true;
    } catch (error) {
      console.error('Failed to remove tag from contact:', error);
      return false;
    }
  }

  /**
   * Get contacts by tag (smart list)
   */
  async getContactsByTag(
    locationId: string,
    tagName: string,
    limit?: number
  ): Promise<Array<{ id: string; name: string; email?: string; phone?: string }>> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.contacts.search({
        locationId,
        query: {
          tags: [tagName],
        },
        limit: limit || 100,
      });

      return response.contacts.map((contact: any) => ({
        id: contact.id,
        name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        email: contact.email,
        phone: contact.phone,
      }));
    } catch (error) {
      console.error('Failed to get contacts by tag:', error);
      return [];
    }
  }

  /**
   * Get contacts by multiple tags (AND/OR logic)
   */
  async getContactsByTags(
    locationId: string,
    tags: string[],
    matchAll: boolean = false, // true = AND, false = OR
    limit?: number
  ): Promise<Array<{ id: string; name: string; email?: string; phone?: string }>> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.contacts.search({
        locationId,
        query: {
          tags: tags,
          tagsMatchAll: matchAll,
        },
        limit: limit || 100,
      });

      return response.contacts.map((contact: any) => ({
        id: contact.id,
        name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        email: contact.email,
        phone: contact.phone,
      }));
    } catch (error) {
      console.error('Failed to get contacts by tags:', error);
      return [];
    }
  }

  /**
   * Bulk add tag to multiple contacts
   */
  async bulkAddTag(locationId: string, contactIds: string[], tagName: string): Promise<number> {
    let successCount = 0;

    for (const contactId of contactIds) {
      const success = await this.addTagToContact(locationId, contactId, tagName);
      if (success) successCount++;
    }

    console.log(`[GHL Tags] Bulk added tag "${tagName}" to ${successCount}/${contactIds.length} contacts`);
    return successCount;
  }

  /**
   * Bulk remove tag from multiple contacts
   */
  async bulkRemoveTag(locationId: string, contactIds: string[], tagName: string): Promise<number> {
    let successCount = 0;

    for (const contactId of contactIds) {
      const success = await this.removeTagFromContact(locationId, contactId, tagName);
      if (success) successCount++;
    }

    console.log(`[GHL Tags] Bulk removed tag "${tagName}" from ${successCount}/${contactIds.length} contacts`);
    return successCount;
  }
}
