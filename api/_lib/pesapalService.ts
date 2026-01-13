interface PesapalAuthResponse {
  token: string;
  expiryDate: string;
  message: string;
}

interface PesapalSubmitOrderResponse {
  order_tracking_id: string;
  merchant_reference: string;
  redirect_url: string;
}

interface PesapalTransactionStatusResponse {
  payment_method: string;
  amount: number;
  created_date: string;
  confirmation_code: string;
  payment_status_description: string;
  description: string;
  message: string;
  payment_account: string;
  call_back_url: string;
  status_code: number;
  merchant_reference: string;
  account_number: string;
  payment_status_code: string;
  currency: string;
}

interface PaymentRequest {
  amount: number;
  description: string;
  callbackUrl: string;
  merchantReference: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
}

export class PesapalService {
  private baseUrl: string;
  private consumerKey: string;
  private consumerSecret: string;
  private ipnId: string;
  private tokenCache: { token: string; expiryDate: Date } | null = null;

  constructor() {
    this.baseUrl = process.env.NODE_ENV === "production"
      ? "https://pay.pesapal.com/v3/api/"
      : "https://cybqa.pesapal.com/pesapalv3/api/";

    this.consumerKey = process.env.PESAPAL_CONSUMER_KEY || "";
    this.consumerSecret = process.env.PESAPAL_CONSUMER_SECRET || "";
    this.ipnId = process.env.PESAPAL_IPN_ID || "";

    if (!this.consumerKey || !this.consumerSecret) {
      console.warn("Pesapal credentials not configured. Payment functionality will be limited.");
    }
  }

  private async authenticate(): Promise<string> {
    // Check if we have a valid cached token
    if (this.tokenCache && this.tokenCache.expiryDate > new Date()) {
      return this.tokenCache.token;
    }

    if (!this.consumerKey || !this.consumerSecret) {
      throw new Error("Pesapal credentials not configured");
    }

    const payload = {
      consumer_key: this.consumerKey,
      consumer_secret: this.consumerSecret,
    };

    const response = await fetch(`${this.baseUrl}Auth/RequestToken`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Pesapal authentication failed: ${response.status} ${response.statusText}`);
    }

    const data: PesapalAuthResponse = await response.json();

    // Cache the token with 5-minute expiry (tokens expire after 5 minutes)
    this.tokenCache = {
      token: data.token,
      expiryDate: new Date(Date.now() + 4 * 60 * 1000), // 4 minutes to be safe
    };

    return data.token;
  }

  async submitOrderRequest(paymentRequest: PaymentRequest): Promise<PesapalSubmitOrderResponse> {
    const token = await this.authenticate();

    const payload = {
      id: paymentRequest.merchantReference,
      currency: "KES",
      amount: paymentRequest.amount,
      description: paymentRequest.description,
      callback_url: paymentRequest.callbackUrl,
      notification_id: this.ipnId,
      billing_address: {
        email_address: paymentRequest.email,
        phone_number: paymentRequest.phone,
        country_code: "KE",
        first_name: paymentRequest.firstName,
        last_name: paymentRequest.lastName,
      },
    };

    const response = await fetch(`${this.baseUrl}Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit order request: ${response.status} ${response.statusText}`);
    }

    const data: PesapalSubmitOrderResponse = await response.json();
    console.log(`[Pesapal Service] Order Request Response Body:`, JSON.stringify(data));
    return data;
  }

  async getTransactionStatus(orderTrackingId: string): Promise<PesapalTransactionStatusResponse> {
    const token = await this.authenticate();

    const response = await fetch(
      `${this.baseUrl}Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get transaction status: ${response.status} ${response.statusText}`);
    }

    const data: PesapalTransactionStatusResponse = await response.json();
    return data;
  }

  async registerIPN(url: string): Promise<{ ipn_id: string }> {
    const token = await this.authenticate();

    const payload = {
      url,
      ipn_notification_type: "GET",
    };

    const response = await fetch(`${this.baseUrl}URLSetup/RegisterIPN`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to register IPN: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  }

  isConfigured(): boolean {
    return !!(this.consumerKey && this.consumerSecret);
  }
}

export const pesapalService = new PesapalService();
