/**
 * GoHighLevel Contacts Management
 * Contact data retrieval and search using @gohighlevel/api-client
 */

import { Client } from '@gohighlevel/api-client';
import type { GHLContact, GHLNote, GHLTask, GHLAppointment } from './types.js';
import type { GHLAuth } from './auth.js';

export class GHLContacts {
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
   * Get contact by ID
   */
  async getContact(locationId: string, contactId: string): Promise<GHLContact | null> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.contacts.get(contactId);

      return this.mapContactResponse(response.contact);
    } catch (error) {
      console.error('Failed to get contact:', error);
      return null;
    }
  }

  /**
   * Search contacts by email or phone
   */
  async searchContacts(
    locationId: string,
    query: { email?: string; phone?: string; query?: string }
  ): Promise<GHLContact[]> {
    try {
      const client = await this.getClient(locationId);

      const searchParams: any = {
        locationId,
      };

      if (query.email) {
        searchParams.email = query.email;
      }
      if (query.phone) {
        searchParams.phone = query.phone;
      }
      if (query.query) {
        searchParams.query = query.query;
      }

      const response = await client.contacts.search(searchParams);

      return response.contacts.map((contact: any) => this.mapContactResponse(contact));
    } catch (error) {
      console.error('Failed to search contacts:', error);
      return [];
    }
  }

  /**
   * Create or update contact
   */
  async upsertContact(locationId: string, contactData: Partial<GHLContact>): Promise<GHLContact | null> {
    try {
      const client = await this.getClient(locationId);

      // Check if contact exists
      if (contactData.id) {
        // Update existing contact
        const response = await client.contacts.update(contactData.id, {
          firstName: contactData.firstName,
          lastName: contactData.lastName,
          email: contactData.email,
          phone: contactData.phone,
          tags: contactData.tags,
          customFields: contactData.customFields,
        });
        return this.mapContactResponse(response.contact);
      } else {
        // Create new contact
        const response = await client.contacts.create({
          locationId,
          firstName: contactData.firstName || '',
          lastName: contactData.lastName,
          email: contactData.email,
          phone: contactData.phone,
          tags: contactData.tags,
          customFields: contactData.customFields,
          source: contactData.source || 'AIME-Agent',
        });
        return this.mapContactResponse(response.contact);
      }
    } catch (error) {
      console.error('Failed to upsert contact:', error);
      return null;
    }
  }

  /**
   * Get contact notes
   */
  async getContactNotes(locationId: string, contactId: string): Promise<GHLNote[]> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.contacts.getNotes(contactId);

      return response.notes.map((note: any) => ({
        id: note.id,
        contactId: note.contactId,
        body: note.body,
        userId: note.userId,
        dateAdded: note.dateAdded,
      }));
    } catch (error) {
      console.error('Failed to get contact notes:', error);
      return [];
    }
  }

  /**
   * Create contact note
   */
  async createContactNote(locationId: string, contactId: string, body: string): Promise<GHLNote | null> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.contacts.createNote(contactId, { body });

      return {
        id: response.note.id,
        contactId: response.note.contactId,
        body: response.note.body,
        userId: response.note.userId,
        dateAdded: response.note.dateAdded,
      };
    } catch (error) {
      console.error('Failed to create contact note:', error);
      return null;
    }
  }

  /**
   * Get contact tasks
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
   * Create contact task
   */
  async createContactTask(
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
      console.error('Failed to create contact task:', error);
      return null;
    }
  }

  /**
   * Get contact appointments
   */
  async getContactAppointments(locationId: string, contactId: string): Promise<GHLAppointment[]> {
    try {
      const client = await this.getClient(locationId);
      const response = await client.contacts.getAppointments(contactId);

      return response.appointments.map((apt: any) => ({
        id: apt.id,
        locationId: apt.locationId,
        contactId: apt.contactId,
        calendarId: apt.calendarId,
        title: apt.title,
        startTime: apt.startTime,
        endTime: apt.endTime,
        status: apt.status,
        notes: apt.notes,
      }));
    } catch (error) {
      console.error('Failed to get contact appointments:', error);
      return [];
    }
  }

  /**
   * Map GHL API response to our contact type
   */
  private mapContactResponse(contact: any): GHLContact {
    return {
      id: contact.id,
      locationId: contact.locationId,
      contactName: contact.contactName,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      tags: contact.tags,
      customFields: contact.customFields,
      source: contact.source,
      dateAdded: contact.dateAdded,
      dateUpdated: contact.dateUpdated,
    };
  }
}
