const EXOTEL_API_KEY = process.env.EXOTEL_API_KEY;
const EXOTEL_API_SECRET = process.env.EXOTEL_API_SECRET;
const EXOTEL_SID = process.env.EXOTEL_SID;
const EXOTEL_API_URL = `https://api.exotel.com/v1/Accounts/${EXOTEL_SID}`;
const EXOTEL_CCM_API_URL = `https://ccm-api.exotel.com`;

if (!EXOTEL_API_KEY || !EXOTEL_API_SECRET || !EXOTEL_SID) {
  console.error("Exotel environment variables are not set");
}

interface ExotelCallRequest {
  From: string;
  To: string;
  CallerId: string;
  CallType?: "trans" | "promo";
  TimeLimit?: number;
  TimeOut?: number;
  StatusCallback?: string;
  StatusCallbackEvents?: string[];
  StatusCallbackContentType?: "application/json" | "application/x-www-form-urlencoded";
  Record?: boolean;
  RecordingStatusCallback?: string;
  CustomField?: string;
}

interface ExotelCallResponse {
  Call: {
    Sid: string;
    ParentCallSid: string | null;
    DateCreated: string;
    DateUpdated: string;
    AccountSid: string;
    To: string;
    From: string;
    PhoneNumberSid: string;
    Status: string;
    StartTime: string | null;
    EndTime: string | null;
    Duration: number | null;
    Price: number | null;
    Direction: string;
    AnsweredBy: string | null;
    ForwardedFrom: string | null;
    CallerName: string | null;
    Uri: string;
    RecordingUrl: string | null;
  };
}

interface ExotelPhoneNumber {
  Sid: string;
  AccountSid: string;
  FriendlyName: string;
  PhoneNumber: string;
  VoiceUrl: string;
  VoiceMethod: string;
  VoiceFallbackUrl: string;
  VoiceFallbackMethod: string;
  StatusCallback: string;
  StatusCallbackMethod: string;
  VoiceCallerIdLookup: boolean;
  DateCreated: string;
  DateUpdated: string;
  SmsUrl: string;
  SmsMethod: string;
  SmsFallbackUrl: string;
  SmsFallbackMethod: string;
  Uri: string;
}

interface ExotelCallDetail {
  Sid: string;
  Status: string;
  From: string;
  To: string;
  StartTime: string;
  EndTime: string;
  Duration: number;
  RecordingUrl: string | null;
  Price: number;
}

export class ExotelClient {
  private apiKey: string | null;
  private apiSecret: string | null;
  private sid: string | null;
  private baseUrl: string;
  private isConfigured: boolean;

  constructor() {
    this.apiKey = EXOTEL_API_KEY || null;
    this.apiSecret = EXOTEL_API_SECRET || null;
    this.sid = EXOTEL_SID || null;
    this.baseUrl = EXOTEL_API_URL;
    this.isConfigured = !!(EXOTEL_API_KEY && EXOTEL_API_SECRET && EXOTEL_SID);
    
    if (!this.isConfigured) {
      console.warn("⚠️  Exotel API is not configured. Phone number management and call routing will be disabled.");
      console.warn("   Set EXOTEL_API_KEY, EXOTEL_API_SECRET, and EXOTEL_SID environment variables to enable Exotel features.");
    }
  }
  
  private ensureConfigured(): void {
    if (!this.isConfigured || !this.apiKey || !this.apiSecret || !this.sid) {
      throw new Error("Exotel API is not configured. Set EXOTEL_API_KEY, EXOTEL_API_SECRET, and EXOTEL_SID to use Exotel features.");
    }
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString("base64");
    return `Basic ${credentials}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "Authorization": this.getAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
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
          `Exotel API error (${response.status}): ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Exotel API request failed:", error);
      throw error;
    }
  }

  private buildFormData(data: Record<string, any>): string {
    return Object.entries(data)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return value.map(v => `${encodeURIComponent(key)}[]=${encodeURIComponent(v)}`).join('&');
        }
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      })
      .join('&');
  }

  async makeCall(callData: ExotelCallRequest): Promise<ExotelCallResponse> {
    this.ensureConfigured();
    const formData = this.buildFormData(callData);

    return await this.request<ExotelCallResponse>("/Calls/connect.json", {
      method: "POST",
      body: formData,
    });
  }

  async getCallDetails(callSid: string): Promise<ExotelCallDetail> {
    this.ensureConfigured();
    return await this.request<ExotelCallDetail>(`/Calls/${callSid}.json`);
  }

  async listCalls(params?: {
    StartTime?: string;
    EndTime?: string;
    From?: string;
    To?: string;
    Status?: string;
    PageSize?: number;
    Page?: number;
  }): Promise<{ Calls: ExotelCallDetail[] }> {
    this.ensureConfigured();
    const queryParams = params ? `?${this.buildFormData(params)}` : "";
    return await this.request<{ Calls: ExotelCallDetail[] }>(
      `/Calls.json${queryParams}`
    );
  }

  async getPhoneNumbers(): Promise<ExotelPhoneNumber[]> {
    this.ensureConfigured();
    const response = await this.request<{ IncomingPhoneNumbers?: ExotelPhoneNumber[]; IncomingPhoneNumber?: ExotelPhoneNumber }>(
      "/IncomingPhoneNumbers.json"
    );
    
    // Exotel returns a single object if there's only one number, or an array if multiple
    if (response.IncomingPhoneNumber) {
      return [response.IncomingPhoneNumber];
    }
    
    return response.IncomingPhoneNumbers || [];
  }

  async getPhoneNumber(phoneSid: string): Promise<ExotelPhoneNumber> {
    this.ensureConfigured();
    return await this.request<ExotelPhoneNumber>(
      `/IncomingPhoneNumbers/${phoneSid}.json`
    );
  }

  async updatePhoneNumber(
    phoneSid: string,
    updates: {
      FriendlyName?: string;
      VoiceUrl?: string;
      VoiceMethod?: string;
      StatusCallback?: string;
    }
  ): Promise<ExotelPhoneNumber> {
    this.ensureConfigured();
    const formData = this.buildFormData(updates);

    return await this.request<ExotelPhoneNumber>(
      `/IncomingPhoneNumbers/${phoneSid}.json`,
      {
        method: "POST",
        body: formData,
      }
    );
  }

  async getRecording(callSid: string): Promise<string | null> {
    try {
      const callDetails = await this.getCallDetails(callSid);
      return callDetails.RecordingUrl;
    } catch (error) {
      console.error("Error fetching recording:", error);
      return null;
    }
  }

  // SMS Methods
  async sendSMS(params: {
    From: string;
    To: string;
    Body: string;
    Priority?: "high" | "normal";
    StatusCallback?: string;
  }): Promise<any> {
    this.ensureConfigured();
    const formData = this.buildFormData(params);
    return await this.request("/Sms/send.json", {
      method: "POST",
      body: formData,
    });
  }

  async sendBulkSMS(params: {
    From: string;
    To: string[]; // Comma-separated phone numbers
    Body: string;
    Priority?: "high" | "normal";
  }): Promise<any> {
    this.ensureConfigured();
    const formData = this.buildFormData({
      ...params,
      To: params.To.join(',')
    });
    return await this.request("/Sms/bulksend.json", {
      method: "POST",
      body: formData,
    });
  }

  async getSMSMessages(messageSid?: string): Promise<any> {
    this.ensureConfigured();
    const endpoint = messageSid 
      ? `/Sms/Messages/${messageSid}.json`
      : "/Sms/Messages.json";
    return await this.request(endpoint);
  }

  // Available Phone Numbers
  async getAvailablePhoneNumbers(params?: {
    Country?: string;
    AreaCode?: string;
    Contains?: string;
  }): Promise<any> {
    this.ensureConfigured();
    const queryParams = params ? `?${this.buildFormData(params)}` : "";
    return await this.request(`/AvailablePhoneNumbers.json${queryParams}`);
  }

  // Provision new phone number
  async provisionPhoneNumber(params: {
    PhoneNumber: string;
    FriendlyName?: string;
    VoiceUrl?: string;
    VoiceMethod?: string;
    SmsUrl?: string;
    SmsMethod?: string;
  }): Promise<ExotelPhoneNumber> {
    this.ensureConfigured();
    const formData = this.buildFormData(params);
    return await this.request("/IncomingPhoneNumbers.json", {
      method: "POST",
      body: formData,
    });
  }

  // Release phone number
  async releasePhoneNumber(phoneSid: string): Promise<void> {
    this.ensureConfigured();
    await this.request(`/IncomingPhoneNumbers/${phoneSid}.json`, {
      method: "DELETE",
    });
  }

  // Customer Whitelist Management
  async getCustomerWhitelist(whitelistSid?: string): Promise<any> {
    this.ensureConfigured();
    const endpoint = whitelistSid
      ? `/customerwhitelist/${whitelistSid}.json`
      : "/customerwhitelist.json";
    return await this.request(endpoint);
  }

  async addToCustomerWhitelist(params: {
    Number: string;
    Note?: string;
  }): Promise<any> {
    this.ensureConfigured();
    const formData = this.buildFormData(params);
    return await this.request("/customerwhitelist.json", {
      method: "POST",
      body: formData,
    });
  }

  async removeFromCustomerWhitelist(whitelistSid: string): Promise<void> {
    this.ensureConfigured();
    await this.request(`/customerwhitelist/${whitelistSid}.json`, {
      method: "DELETE",
    });
  }

  // CCM API Methods (using ccm-api.exotel.com)
  private async ccmRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${EXOTEL_CCM_API_URL}${endpoint}`;
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
          `Exotel CCM API error (${response.status}): ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Exotel CCM API request failed:", error);
      throw error;
    }
  }

  // CCM Users Management
  async listCCMUsers(): Promise<any> {
    this.ensureConfigured();
    return await this.ccmRequest("/users");
  }

  async createCCMUser(userData: {
    name: string;
    email: string;
    role?: string;
  }): Promise<any> {
    this.ensureConfigured();
    return await this.ccmRequest("/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async updateCCMUser(userId: string, updates: {
    name?: string;
    email?: string;
    role?: string;
  }): Promise<any> {
    this.ensureConfigured();
    return await this.ccmRequest(`/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  async deleteCCMUser(userId: string): Promise<void> {
    this.ensureConfigured();
    await this.ccmRequest(`/users/${userId}`, {
      method: "DELETE",
    });
  }

  // CCM Calls Management
  async listCCMCalls(params?: {
    from_date?: string;
    to_date?: string;
    user_id?: string;
  }): Promise<any> {
    this.ensureConfigured();
    const queryParams = params ? `?${new URLSearchParams(params as any).toString()}` : "";
    return await this.ccmRequest(`/calls${queryParams}`);
  }

  async makeCCMCall(callData: {
    from: string;
    to: string;
    user_id?: string;
  }): Promise<any> {
    this.ensureConfigured();
    return await this.ccmRequest("/calls", {
      method: "POST",
      body: JSON.stringify(callData),
    });
  }
}

export const exotelClient = new ExotelClient();
