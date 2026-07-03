/**
 * Service d'authentification
 * Centralise tous les appels API d'authentification
 */

const API_URL = 'http://localhost:5000/api/auth';

export const authAPI = {
  // Login
  async login(email: string, password: string) {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  },

  // Signup
  async signup(email: string, password: string) {
    const response = await fetch(`${API_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  },

  // Logout
  async logout() {
    const response = await fetch(`${API_URL}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  },

  // Create Profile
  async createProfile(profileData: any, accessToken: string) {
    const response = await fetch(`${API_URL}/create-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(profileData),
    });
    return response.json();
  },

  // Check Profile
  async checkProfile(accessToken: string) {
    const response = await fetch(`${API_URL}/check-profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    return response.json();
  },

  // Get User
  async getUser(accessToken: string) {
    const response = await fetch(`${API_URL}/user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    return response.json();
  },

  // Refresh Token
  async refreshToken(refreshToken: string) {
    const response = await fetch(`${API_URL}/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    return response.json();
  },

  // Forgot Password
  async forgotPassword(email: string) {
    const response = await fetch(`${API_URL}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return response.json();
  },

  // Reset Password
  async resetPassword(newPassword: string, accessToken: string) {
    const response = await fetch(`${API_URL}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ new_password: newPassword }),
    });
    return response.json();
  },

  // Confirm Email
  async confirmEmail(tokenHash: string, type: string) {
    const response = await fetch(`${API_URL}/confirm-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token_hash: tokenHash, type }),
    });
    return response.json();
  },

  // Get organization/event skills
  async getSkills(accessToken: string) {
    const response = await fetch(`${API_URL}/skills`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return response.json();
  },

  // Save profile skills (accepts existing skill IDs and optional custom skills)
  async saveProfileSkills(skillIds: number[] | null, customSkills: string[] | null, accessToken: string) {
    const body: any = {};
    if (Array.isArray(skillIds)) body.skill_ids = skillIds;
    if (Array.isArray(customSkills)) body.custom_skills = customSkills;
    const response = await fetch(`${API_URL}/profile-skills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    return response.json();
  },

  // Create organization
  async createOrganization(name: string, accessToken: string) {
    const response = await fetch(`${API_URL}/create-organization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name }),
    });
    return response.json();
  },

  // Join organization via code
  async joinOrganization(code: string, accessToken: string) {
    const response = await fetch(`${API_URL}/join-organization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ code }),
    });
    return response.json();
  },

  // Create event
  async createEvent(eventData: any, accessToken: string) {
    const response = await fetch(`${API_URL}/create-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(eventData),
    });
    return response.json();
  },

  // Apply to event
  async applyEvent(eventId: string, accessToken: string) {
    const response = await fetch(`${API_URL}/apply-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ event_id: eventId }),
    });
    return response.json();
  },

  // Get event staff applications (admin)
  async getEventApplications(eventId: string, accessToken: string, status: string = 'en_attente') {
    const response = await fetch(`${API_URL}/event-staff?event_id=${encodeURIComponent(eventId)}&status=${encodeURIComponent(status)}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const data = await response.json();
    if (data && Array.isArray(data.applications)) {
      return { ...data, staff: data.applications };
    }
    return data;
  },

  async getEventLandingPage(eventId: string, accessToken: string) {
    const response = await fetch(`${API_URL}/events/${encodeURIComponent(eventId)}/landing-page`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return response.json();
  },

  async getPublicEventLandingPage(eventId: string) {
    const response = await fetch(`${API_URL}/events/${encodeURIComponent(eventId)}/public-landing-page`, {
      method: 'GET',
    });
    return response.json();
  },

  async getPublicEvents() {
    const response = await fetch(`${API_URL}/events/public`, {
      method: 'GET',
    });
    return response.json();
  },

  async saveEventLandingPage(eventId: string, landingPageData: any, accessToken: string) {
    const response = await fetch(`${API_URL}/events/${encodeURIComponent(eventId)}/landing-page`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(landingPageData),
    });
    return response.json();
  },

  async uploadLandingImage(eventId: string, filePath: string, base64Data: string, accessToken: string, contentType: string) {
    const response = await fetch(`${API_URL}/events/${encodeURIComponent(eventId)}/landing-page/upload-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ filePath, data: base64Data, contentType }),
    });
    return response.json();
  },

  // Get organization members (with optional search and filter)
  async getOrganizationMembers(organizationId: string, query: string, filter: string, accessToken: string) {
    const params = new URLSearchParams();
    params.append('organization_id', organizationId);
    if (query) params.append('q', query);
    if (filter) params.append('filter', filter);
    const response = await fetch(`${API_URL}/organization-members?${params.toString()}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return response.json();
  },

  // Update organization member
  async updateOrganizationMember(memberId: number, payload: any, accessToken: string) {
    const response = await fetch(`${API_URL}/organization-members/${memberId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  // Delete organization member
  async deleteOrganizationMember(memberId: number, accessToken: string) {
    const response = await fetch(`${API_URL}/organization-members/${memberId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return response.json();
  },

  // Get my organization (if any)
  async getMyOrganization(accessToken: string) {
    const response = await fetch(`${API_URL}/my-organization`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return response.json();
  },

  // Get events for an organization
  async getEvents(organizationId: string, accessToken: string) {
    const response = await fetch(`${API_URL}/events?organization_id=${encodeURIComponent(organizationId)}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return response.json();
  },

  // Get event category options
  async getEventCategories(accessToken: string) {
    const response = await fetch(`${API_URL}/event-categories`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return response.json();
  },

  // Get publications (landing pages) for an organization
  async getEventLandingPages(organizationId: string, accessToken: string) {
    const response = await fetch(`${API_URL}/events/landing-pages?organization_id=${encodeURIComponent(organizationId)}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return response.json();
  },

  // Set landing page publish status
  async setEventLandingPagePublished(eventId: string, isPublished: boolean, accessToken: string) {
    const response = await fetch(`${API_URL}/events/${encodeURIComponent(eventId)}/landing-page/publish`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ is_published: isPublished }),
    });
    return response.json();
  },

  // Get transaction categories for a type
  async getTransactionCategories(type: 'entree' | 'sortie' | null, accessToken: string) {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    const response = await fetch(`${API_URL}/transactions-categories?${params.toString()}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return response.json();
  },

  // Create a transaction category
  async createTransactionCategory(payload: { title: string; type: 'entree' | 'sortie'; pcg?: string | null }, accessToken: string) {
    const response = await fetch(`${API_URL}/transactions-categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  // Get transactions for an organization/event
  async getTransactions(organizationId: string | null, eventId: string | null, accessToken: string) {
    const params = new URLSearchParams();
    if (organizationId) params.append('organization_id', organizationId);
    if (eventId) params.append('event_id', eventId);
    const response = await fetch(`${API_URL}/transactions?${params.toString()}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return response.json();
  },

  // Create a transaction
  async createTransaction(payload: any, accessToken: string) {
    const response = await fetch(`${API_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  // Update a transaction
  async updateTransaction(id: string | number, payload: any, accessToken: string) {
    const response = await fetch(`${API_URL}/transactions/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  // Delete a transaction
  async deleteTransaction(id: string | number, accessToken: string) {
    const response = await fetch(`${API_URL}/transactions/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return response.json();
  },

  // Get staff members for a specific event (validated staff by default)
  async getEventStaff(eventId: string, accessToken: string, status: string = 'valide') {
    const response = await fetch(`${API_URL}/event-staff?event_id=${encodeURIComponent(eventId)}&status=${encodeURIComponent(status)}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const data = await response.json();
    if (data && Array.isArray(data.applications)) {
      const normalizedApplications = data.applications.map((app: any) => ({
        ...app,
        profile: app.profile || app.profiles || null,
      }));
      return { ...data, staff: normalizedApplications };
    }
    return data;
  },

  // Ticket-type: list for an event
  async getTicketTypes(eventId: string, accessToken: string) {
    const response = await fetch(`${API_URL}/ticket-type?event_id=${encodeURIComponent(eventId)}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return response.json();
  },

  // Ticket-type: create
  async createTicketType(eventId: string, name: string, accessToken: string) {
    const response = await fetch(`${API_URL}/ticket-type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ event_id: eventId, name }),
    });
    return response.json();
  },

  // Validate application
  async validateApplication(applicationId: number, action: 'accept' | 'reject', accessToken: string) {
    const url = `${API_URL}/event-staff/${applicationId}/validate`;
    console.debug('validateApplication', { url, action, applicationId });
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action }),
    });
    return response.json();
  },
  // Delete event_staff application
  async deleteEventStaff(applicationId: number, accessToken: string) {
    const url = `${API_URL}/event-staff/${applicationId}`;
    console.debug('deleteEventStaff', { url, applicationId });
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    return response.json();
  },
  // Update ticket types is_active status
  async updateTicketTypesActive(eventId: string, activeTicketNames: string[], accessToken: string) {
    const response = await fetch(`${API_URL}/events/${encodeURIComponent(eventId)}/ticket-types-active`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ activeTicketNames }),
    });
    return response.json();
  },

  // Public active payment methods (Mobile Money)
  async getPaymentMethods() {
    const response = await fetch(`${API_URL}/payment-methods`, {
      method: 'GET',
    });
    return response.json();
  },

  // Public ticket purchase via Mobile Money (no auth required)
  async purchaseEventTicket(eventId: string, payload: {
    ticket_type_id: string;
    quantity: number;
    buyer_name: string;
    buyer_phone: string;
    buyer_email: string | null;
    buyer_address: string | null;
    transaction_id: string;
    total_amount: number;
    payment_method: number;
  }) {
    const response = await fetch(`${API_URL}/events/${encodeURIComponent(eventId)}/purchase-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  async getEventOrders(eventId: string, accessToken: string, paymentStatus: 'all' | 'pending' | 'validated' | 'rejected' = 'all') {
    const params = new URLSearchParams();
    if (paymentStatus !== 'all') params.set('payment_status', paymentStatus);
    const query = params.toString();
    const response = await fetch(
      `${API_URL}/events/${encodeURIComponent(eventId)}/orders${query ? `?${query}` : ''}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.json();
  },

  async validateOrder(orderId: string, accessToken: string) {
    const response = await fetch(`${API_URL}/orders/${encodeURIComponent(orderId)}/validate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.json();
  },

  async deleteOrder(orderId: string, accessToken: string) {
    const response = await fetch(`${API_URL}/orders/${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.json();
  },
};
