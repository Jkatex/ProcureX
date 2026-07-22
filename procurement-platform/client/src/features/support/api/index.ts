/* Wraps support HTTP calls behind typed operations so UI code does not depend on raw endpoints. */
import { apiClient } from '@/shared/api/http';

export type SupportTicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type SupportTicketStatus = 'OPEN' | 'WAITING_ON_SUPPORT' | 'WAITING_ON_USER' | 'RESOLVED' | 'CLOSED';

export type SupportTicket = {
  id: string;
  subject: string;
  category: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export const supportApi = {
  async listTickets() {
    const response = await apiClient.get<{ tickets: SupportTicket[] }>('/api/support/tickets');
    return response.data.tickets;
  },

  async createTicket(input: {
    subject: string;
    category: string;
    priority: SupportTicketPriority;
    description: string;
  }) {
    const response = await apiClient.post<SupportTicket>('/api/support/tickets', input);
    return response.data;
  }
};
