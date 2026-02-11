/**
 * GoHighLevel Workflows Management
 * Trigger workflows, manage automations
 */

import { Client } from '@gohighlevel/api-client';
import type { GHLAuth } from './auth.js';

export interface GHLWorkflow {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'draft';
  locationId: string;
}

export class GHLWorkflows {
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
   * List all workflows for a location
   */
  async listWorkflows(locationId: string): Promise<GHLWorkflow[]> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.workflows.getAll(locationId);

      return response.workflows.map((wf: any) => ({
        id: wf.id,
        name: wf.name,
        status: wf.status,
        locationId: wf.locationId,
      }));
    } catch (error) {
      console.error('Failed to list workflows:', error);
      return [];
    }
  }

  /**
   * Add contact to a workflow
   */
  async addContactToWorkflow(
    locationId: string,
    workflowId: string,
    contactId: string
  ): Promise<boolean> {
    try {
      const client = await this.getClient(locationId);
      await client.workflows.addContact(workflowId, {
        contactId,
      });

      console.log(`[GHL Workflows] Added contact ${contactId} to workflow ${workflowId}`);
      return true;
    } catch (error) {
      console.error('Failed to add contact to workflow:', error);
      return false;
    }
  }

  /**
   * Remove contact from a workflow
   */
  async removeContactFromWorkflow(
    locationId: string,
    workflowId: string,
    contactId: string
  ): Promise<boolean> {
    try {
      const client = await this.getClient(locationId);
      await client.workflows.removeContact(workflowId, {
        contactId,
      });

      console.log(`[GHL Workflows] Removed contact ${contactId} from workflow ${workflowId}`);
      return true;
    } catch (error) {
      console.error('Failed to remove contact from workflow:', error);
      return false;
    }
  }
}
