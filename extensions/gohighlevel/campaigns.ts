/**
 * GoHighLevel Bulk Campaigns and Outreach
 * Manage bulk calling campaigns, SMS campaigns, and sequential outreach
 */

import { Client } from '@gohighlevel/api-client';
import type { GHLAuth } from './auth.js';

export interface CampaignContact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
  attempts?: number;
  lastAttempt?: string;
  result?: string;
}

export interface OutreachCampaign {
  id: string;
  name: string;
  type: 'call' | 'sms' | 'email';
  script?: string;
  contacts: CampaignContact[];
  status: 'draft' | 'active' | 'paused' | 'completed';
  createdAt: string;
  completedCount: number;
  totalCount: number;
}

export class GHLCampaigns {
  private auth: GHLAuth;
  private apiVersion: string = '2021-07-28';
  private campaigns: Map<string, OutreachCampaign> = new Map();

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
   * Create a new outreach campaign
   */
  async createCampaign(
    locationId: string,
    data: {
      name: string;
      type: 'call' | 'sms' | 'email';
      contactIds: string[];
      script?: string;
      tags?: string[]; // If provided, fetch contacts by tags
    }
  ): Promise<OutreachCampaign> {
    const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Fetch contact details
    const client = await this.getClient(locationId);
    const contacts: CampaignContact[] = [];

    // If tags provided, get contacts by tags
    if (data.tags && data.tags.length > 0) {
      const response = await client.contacts.search({
        locationId,
        query: {
          tags: data.tags,
        },
      });

      for (const contact of response.contacts) {
        contacts.push({
          id: contact.id,
          name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
          phone: contact.phone,
          email: contact.email,
          status: 'pending',
          attempts: 0,
        });
      }
    } else {
      // Use provided contact IDs
      for (const contactId of data.contactIds) {
        try {
          const contactResponse = await client.contacts.get(contactId);
          const contact = contactResponse.contact;

          contacts.push({
            id: contact.id,
            name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
            phone: contact.phone,
            email: contact.email,
            status: 'pending',
            attempts: 0,
          });
        } catch (error) {
          console.error(`Failed to fetch contact ${contactId}:`, error);
        }
      }
    }

    const campaign: OutreachCampaign = {
      id: campaignId,
      name: data.name,
      type: data.type,
      script: data.script,
      contacts,
      status: 'draft',
      createdAt: new Date().toISOString(),
      completedCount: 0,
      totalCount: contacts.length,
    };

    this.campaigns.set(campaignId, campaign);

    console.log(`[GHL Campaigns] Created campaign "${data.name}" with ${contacts.length} contacts`);
    return campaign;
  }

  /**
   * Start a campaign
   */
  async startCampaign(campaignId: string): Promise<boolean> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      console.error(`Campaign ${campaignId} not found`);
      return false;
    }

    campaign.status = 'active';
    console.log(`[GHL Campaigns] Started campaign "${campaign.name}"`);
    return true;
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(campaignId: string): Promise<boolean> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      console.error(`Campaign ${campaignId} not found`);
      return false;
    }

    campaign.status = 'paused';
    console.log(`[GHL Campaigns] Paused campaign "${campaign.name}"`);
    return true;
  }

  /**
   * Get campaign by ID
   */
  getCampaign(campaignId: string): OutreachCampaign | null {
    return this.campaigns.get(campaignId) || null;
  }

  /**
   * List all campaigns
   */
  listCampaigns(): OutreachCampaign[] {
    return Array.from(this.campaigns.values());
  }

  /**
   * Get next contact in campaign for outreach
   */
  getNextContact(campaignId: string): CampaignContact | null {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign || campaign.status !== 'active') {
      return null;
    }

    // Find first pending contact
    const nextContact = campaign.contacts.find((c) => c.status === 'pending');
    return nextContact || null;
  }

  /**
   * Mark contact attempt in campaign
   */
  async markContactAttempt(
    campaignId: string,
    contactId: string,
    result: 'completed' | 'failed' | 'no_answer',
    notes?: string
  ): Promise<boolean> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return false;

    const contact = campaign.contacts.find((c) => c.id === contactId);
    if (!contact) return false;

    contact.attempts = (contact.attempts || 0) + 1;
    contact.lastAttempt = new Date().toISOString();
    contact.result = notes || result;

    if (result === 'completed') {
      contact.status = 'completed';
      campaign.completedCount++;
    } else if (result === 'failed') {
      contact.status = 'failed';
      campaign.completedCount++;
    } else {
      // no_answer - keep as pending for retry
      contact.status = 'pending';
    }

    // Check if campaign completed
    if (campaign.completedCount >= campaign.totalCount) {
      campaign.status = 'completed';
      console.log(`[GHL Campaigns] Campaign "${campaign.name}" completed`);
    }

    return true;
  }

  /**
   * Bulk send SMS to campaign contacts
   */
  async sendBulkSMS(
    locationId: string,
    campaignId: string,
    message: string
  ): Promise<{ sent: number; failed: number }> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign || campaign.type !== 'sms') {
      return { sent: 0, failed: 0 };
    }

    const client = await this.getClient(locationId);
    let sent = 0;
    let failed = 0;

    for (const contact of campaign.contacts) {
      if (contact.status !== 'pending' || !contact.phone) {
        failed++;
        continue;
      }

      try {
        // Get or create conversation
        const convResponse = await client.conversations.search({
          locationId,
          contactId: contact.id,
        });

        let conversationId = convResponse.conversations[0]?.id;
        if (!conversationId) {
          const newConv = await client.conversations.create({
            locationId,
            contactId: contact.id,
            type: 'SMS',
          });
          conversationId = newConv.conversation.id;
        }

        // Send message
        await client.conversations.sendMessage(conversationId, {
          type: 'SMS',
          message: message,
        });

        await this.markContactAttempt(campaignId, contact.id, 'completed', 'SMS sent');
        sent++;
      } catch (error) {
        console.error(`Failed to send SMS to contact ${contact.id}:`, error);
        await this.markContactAttempt(campaignId, contact.id, 'failed', 'SMS send failed');
        failed++;
      }

      // Rate limiting - wait 200ms between sends
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(`[GHL Campaigns] Bulk SMS complete: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }
}
