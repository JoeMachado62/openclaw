/**
 * GoHighLevel Opportunities Management
 * Manage pipeline opportunities, stages, and deals
 */

import { Client } from '@gohighlevel/api-client';
import type { GHLAuth } from './auth.js';

export interface GHLOpportunity {
  id: string;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  contactId: string;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  monetaryValue?: number;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GHLPipeline {
  id: string;
  name: string;
  locationId: string;
  stages: GHLPipelineStage[];
}

export interface GHLPipelineStage {
  id: string;
  name: string;
  position: number;
}

export class GHLOpportunities {
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
   * List all pipelines for a location
   */
  async listPipelines(locationId: string): Promise<GHLPipeline[]> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.pipelines.getAll(locationId);

      return response.pipelines.map((pipeline: any) => ({
        id: pipeline.id,
        name: pipeline.name,
        locationId: pipeline.locationId,
        stages: pipeline.stages.map((stage: any) => ({
          id: stage.id,
          name: stage.name,
          position: stage.position,
        })),
      }));
    } catch (error) {
      console.error('Failed to list pipelines:', error);
      return [];
    }
  }

  /**
   * Get opportunity by ID
   */
  async getOpportunity(locationId: string, opportunityId: string): Promise<GHLOpportunity | null> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.opportunities.get(opportunityId);

      return this.mapOpportunityResponse(response.opportunity);
    } catch (error) {
      console.error('Failed to get opportunity:', error);
      return null;
    }
  }

  /**
   * Search opportunities by contact
   */
  async getContactOpportunities(locationId: string, contactId: string): Promise<GHLOpportunity[]> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.opportunities.search({
        locationId,
        contactId,
      });

      return response.opportunities.map((opp: any) => this.mapOpportunityResponse(opp));
    } catch (error) {
      console.error('Failed to search opportunities:', error);
      return [];
    }
  }

  /**
   * Create a new opportunity
   */
  async createOpportunity(
    locationId: string,
    data: {
      pipelineId: string;
      pipelineStageId: string;
      contactId: string;
      name: string;
      status: 'open' | 'won' | 'lost' | 'abandoned';
      monetaryValue?: number;
      assignedTo?: string;
    }
  ): Promise<GHLOpportunity | null> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.opportunities.create({
        locationId,
        ...data,
      });

      console.log(`[GHL Opportunities] Created opportunity: ${response.opportunity.id}`);
      return this.mapOpportunityResponse(response.opportunity);
    } catch (error) {
      console.error('Failed to create opportunity:', error);
      return null;
    }
  }

  /**
   * Update an opportunity
   */
  async updateOpportunity(
    locationId: string,
    opportunityId: string,
    updates: {
      name?: string;
      pipelineStageId?: string;
      status?: 'open' | 'won' | 'lost' | 'abandoned';
      monetaryValue?: number;
      assignedTo?: string;
    }
  ): Promise<GHLOpportunity | null> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.opportunities.update(opportunityId, updates);

      console.log(`[GHL Opportunities] Updated opportunity: ${opportunityId}`);
      return this.mapOpportunityResponse(response.opportunity);
    } catch (error) {
      console.error('Failed to update opportunity:', error);
      return null;
    }
  }

  /**
   * Delete an opportunity
   */
  async deleteOpportunity(locationId: string, opportunityId: string): Promise<boolean> {
    try {
      const client = await this.getClient(locationId);
      await client.opportunities.delete(opportunityId);

      console.log(`[GHL Opportunities] Deleted opportunity: ${opportunityId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete opportunity:', error);
      return false;
    }
  }

  /**
   * Move opportunity to different stage
   */
  async moveOpportunityToStage(
    locationId: string,
    opportunityId: string,
    pipelineStageId: string
  ): Promise<GHLOpportunity | null> {
    return this.updateOpportunity(locationId, opportunityId, { pipelineStageId });
  }

  /**
   * Map GHL API response to our opportunity type
   */
  private mapOpportunityResponse(opportunity: any): GHLOpportunity {
    return {
      id: opportunity.id,
      name: opportunity.name,
      pipelineId: opportunity.pipelineId,
      pipelineStageId: opportunity.pipelineStageId,
      contactId: opportunity.contactId,
      status: opportunity.status,
      monetaryValue: opportunity.monetaryValue,
      assignedTo: opportunity.assignedTo,
      createdAt: opportunity.createdAt,
      updatedAt: opportunity.updatedAt,
    };
  }
}
