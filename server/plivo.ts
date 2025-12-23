const PLIVO_AUTH_ID = process.env.PLIVO_AUTH_ID;
const PLIVO_AUTH_TOKEN = process.env.PLIVO_AUTH_TOKEN;
const PLIVO_API_URL = "https://api.plivo.com/v1";

if (!PLIVO_AUTH_ID || !PLIVO_AUTH_TOKEN) {
  console.warn("⚠️  Plivo credentials are not set. Set PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN to use Plivo features.");
}

interface PlivoPhoneNumber {
  number: string;
  alias: string;
  sub_account: string | null;
  added_on: string;
  resource_uri: string;
  api_id: string;
  voice_enabled: boolean;
  sms_enabled: boolean;
  mms_enabled: boolean;
  fax_enabled: boolean;
  number_type: string;
  monthly_rental_rate: string;
  region: string;
  country_iso: string;
  voice_rate: string;
  sms_rate: string;
  mms_rate: string;
  fax_rate: string;
}

interface PlivoAvailableNumber {
  number: string;
  rate: string;
  type: string;
  region: string;
  voice_enabled: boolean;
  sms_enabled: boolean;
  mms_enabled: boolean;
  fax_enabled: boolean;
  monthly_rental_rate: string;
  country_iso: string;
  voice_rate: string;
  sms_rate: string;
  mms_rate: string;
  fax_rate: string;
}

interface PlivoSearchResponse {
  objects: PlivoAvailableNumber[];
  meta: {
    previous: string | null;
    total_count: number;
    offset: number;
    limit: number;
    next: string | null;
  };
}

export class PlivoClient {
  private authId: string | null;
  private authToken: string | null;
  private baseUrl: string;
  private isConfigured: boolean;

  constructor() {
    this.authId = PLIVO_AUTH_ID || null;
    this.authToken = PLIVO_AUTH_TOKEN || null;
    this.baseUrl = PLIVO_API_URL;
    this.isConfigured = !!(PLIVO_AUTH_ID && PLIVO_AUTH_TOKEN);
    
    if (!this.isConfigured) {
      console.warn("⚠️  Plivo API is not configured. Phone number management will be disabled.");
      console.warn("   Set PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN environment variables to enable Plivo features.");
    }
  }
  
  private ensureConfigured(): void {
    if (!this.isConfigured || !this.authId || !this.authToken) {
      throw new Error("Plivo API is not configured. Set PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN to use Plivo features.");
    }
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.authId}:${this.authToken}`).toString("base64");
    return `Basic ${credentials}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "Authorization": this.getAuthHeader(),
      "Content-Type": "application/json",
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Plivo API error (${response.status}): ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Plivo API request failed:", error);
      throw error;
    }
  }

  /**
   * Search for available phone numbers
   */
  async searchAvailablePhoneNumbers(params?: {
    country_iso?: string;
    type?: "local" | "tollfree" | "any";
    pattern?: string;
    region?: string;
    services?: string; // comma-separated: voice,sms,mms,fax
    limit?: number;
    offset?: number;
  }): Promise<PlivoSearchResponse> {
    this.ensureConfigured();
    
    const queryParams = new URLSearchParams();
    if (params?.country_iso) queryParams.append('country_iso', params.country_iso);
    if (params?.type) queryParams.append('type', params.type);
    if (params?.pattern) queryParams.append('pattern', params.pattern);
    if (params?.region) queryParams.append('region', params.region);
    if (params?.services) queryParams.append('services', params.services);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    
    const queryString = queryParams.toString();
    // Plivo API endpoint format: /Account/{auth_id}/PhoneNumber/
    const endpoint = `/Account/${this.authId}/PhoneNumber/${queryString ? `?${queryString}` : ''}`;
    
    return await this.request<PlivoSearchResponse>(endpoint);
  }

  /**
   * Get all phone numbers in your Plivo account
   */
  async getPhoneNumbers(): Promise<PlivoPhoneNumber[]> {
    this.ensureConfigured();
    
    const response = await this.request<{ objects: PlivoPhoneNumber[] }>(
      `/Account/${this.authId}/Number/`
    );
    
    return response.objects || [];
  }

  /**
   * Get details of a specific phone number
   */
  async getPhoneNumber(number: string): Promise<PlivoPhoneNumber> {
    this.ensureConfigured();
    
    return await this.request<PlivoPhoneNumber>(
      `/Account/${this.authId}/Number/${number}/`
    );
  }

  /**
   * Buy/rent a phone number
   */
  async buyPhoneNumber(number: string): Promise<PlivoPhoneNumber> {
    this.ensureConfigured();
    
    return await this.request<PlivoPhoneNumber>(
      `/Account/${this.authId}/Number/${number}/`,
      {
        method: "POST",
      }
    );
  }

  /**
   * Unrent/release a phone number
   */
  async releasePhoneNumber(number: string): Promise<void> {
    this.ensureConfigured();
    
    await this.request(
      `/Account/${this.authId}/Number/${number}/`,
      {
        method: "DELETE",
      }
    );
  }

  /**
   * Update phone number settings
   */
  async updatePhoneNumber(
    number: string,
    updates: {
      alias?: string;
      application_id?: string;
      sub_account?: string;
    }
  ): Promise<PlivoPhoneNumber> {
    this.ensureConfigured();
    
    return await this.request<PlivoPhoneNumber>(
      `/Account/${this.authId}/Number/${number}/`,
      {
        method: "POST",
        body: JSON.stringify(updates),
      }
    );
  }
}

export const plivoClient = new PlivoClient();

