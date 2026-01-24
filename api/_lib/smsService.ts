
/**
 * SMS Service for API Functions
 * 
 * Handles sending text messages using Africa's Talking API or Infobip.
 */

export interface SmsOptions {
    to: string;
    message: string;
    metadata?: any;
}

export class SmsService {
    // AT Credentials
    private atUsername: string | undefined;
    private atApiKey: string | undefined;
    private atSenderId: string | undefined;
    private atApiUrl = 'https://api.africastalking.com/version1/messaging';

    // Infobip Credentials
    private infobipApiKey: string | undefined;
    private infobipBaseUrl: string | undefined;

    constructor() {
        this.atUsername = process.env.AT_USERNAME;
        this.atApiKey = process.env.AT_API_KEY;
        this.atSenderId = process.env.AT_SENDER_ID;

        this.infobipApiKey = process.env.INFOBIP_API_KEY;
        this.infobipBaseUrl = process.env.INFOBIP_BASE_URL;

        // Automatically use sandbox URL if username is 'sandbox'
        if (this.atUsername === 'sandbox') {
            this.atApiUrl = 'https://api.sandbox.africastalking.com/version1/messaging';
        }
    }

    async sendSms(options: SmsOptions): Promise<any> {
        const provider = process.env.SMS_PROVIDER || (this.infobipApiKey ? 'infobip' : 'africastalking');

        console.log(`[SMS] Sending via ${provider} to ${options.to}`);

        if (provider === 'infobip') {
            return this.sendViaInfobip(options);
        } else {
            return this.sendViaAt(options);
        }
    }

    private async sendViaInfobip(options: SmsOptions): Promise<any> {
        if (!this.infobipApiKey || !this.infobipBaseUrl) {
            console.warn('[SMS] Infobip credentials not configured. Falling back to console.');
            console.log(`[SMS MOCK] To: ${options.to} | Message: ${options.message}`);
            return { status: 'mocked', message: 'Infobip credentials missing' };
        }

        let baseUrl = this.infobipBaseUrl.endsWith('/') ? this.infobipBaseUrl.slice(0, -1) : this.infobipBaseUrl;
        if (!baseUrl.startsWith('http')) {
            baseUrl = `https://${baseUrl}`;
        }
        const url = `${baseUrl}/sms/2/text/advanced`;

        const body = {
            messages: [
                {
                    destinations: [{ to: options.to }],
                    from: "Landee", // Default sender name
                    text: options.message
                }
            ]
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `App ${this.infobipApiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('[SMS] Infobip API error:', errorData);
                throw new Error(`Infobip API failed: ${response.status}`);
            }

            const data = await response.json();
            const messageStatus = data?.messages?.[0]?.status;
            const statusName = messageStatus?.name || 'Unknown';
            const statusDesc = messageStatus?.description || 'No description';

            if (statusName === 'PENDING' || statusName === 'ACCEPTED' || statusName === 'MESSAGE_ACCEPTED') {
                console.info(`✅ [SMS] Infobip Success | To: ${options.to} | Status: ${statusName}`);
            } else {
                console.warn(`[SMS] Infobip Warning | To: ${options.to} | Status: ${statusName} (${statusDesc})`);
            }
            return data;
        } catch (error) {
            console.error('[SMS] Infobip send failed:', error);
            throw error;
        }
    }

    private async sendViaAt(options: SmsOptions): Promise<any> {
        if (!this.atUsername || !this.atApiKey) {
            console.warn('[SMS] Africa\'s Talking credentials not configured. SMS will be logged to console only.');
            console.log(`[SMS MOCK] To: ${options.to} | Message: ${options.message}`);
            return { status: 'mocked', message: 'SMS credentials missing' };
        }

        const params = new URLSearchParams();
        params.append('username', this.atUsername);
        params.append('to', options.to);
        params.append('message', options.message);
        if (this.atSenderId) {
            params.append('from', this.atSenderId);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(this.atApiUrl, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'apiKey': this.atApiKey,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString(),
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('[SMS] AT API error:', errorData);
                throw new Error(`AT API failed: ${response.status}`);
            }

            const data = await response.json();

            // AT returns 201 even if delivery fails for individual recipients
            const recipients = data?.SMSMessageData?.Recipients || [];
            if (recipients.length > 0) {
                const status = recipients[0].status;
                const cost = recipients[0].cost;

                if (status === 'Success' || status === 'Sent') {
                    console.info(`✅ [SMS] AT Success | To: ${options.to} | Cost: ${cost}`);
                } else {
                    console.warn(`[SMS] Status: ${status} | To: ${options.to} | Cost: ${cost}`);
                    console.warn(`[SMS] Delivery status warning: ${status} for ${options.to}`);
                }
            } else {
                console.info('✅ [SMS] AT Sent successfully to:', options.to);
            }

            return data;
        } catch (error) {
            console.error('[SMS] Send failed:', error);
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    generateOtp(length: number = 6): string {
        return Math.floor(100000 + Math.random() * 900000).toString().substring(0, length);
    }

    composePaymentConfirmation(
        tenantName: string,
        amount: number,
        propertyName: string,
        unitNumber: string,
        code: string
    ): string {
        const formattedAmount = new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
        }).format(amount);

        return `Dear ${tenantName}, payment of ${formattedAmount} for ${propertyName} Unit ${unitNumber} confirmed. Ref: ${code}. Thank you!`;
    }

    composeRentReminder(
        tenantName: string,
        amount: number,
        dueDate: string,
        propertyName: string
    ): string {
        const formattedAmount = new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
        }).format(amount);

        return `Dear ${tenantName}, your rent of ${formattedAmount} for ${propertyName} is due on ${dueDate}. Please pay promptly to avoid late fees.`;
    }

    composeMaintenanceNotification(
        landlordName: string,
        tenantName: string,
        propertyName: string,
        unitNumber: string,
        title: string,
        priority: string
    ): string {
        return `Dear ${landlordName}, new maintenance request from ${tenantName} (${propertyName} Unit ${unitNumber}): "${title}". Priority: ${priority.toUpperCase()}.`;
    }

    composeLandlordPaymentNotification(
        landlordName: string,
        tenantName: string,
        amount: number,
        propertyName: string,
        unitNumber: string,
        code: string
    ): string {
        const formattedAmount = new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
        }).format(amount);

        return `Dear ${landlordName}, payment of ${formattedAmount} received from ${tenantName} for ${propertyName} Unit ${unitNumber}. Ref: ${code}.`;
    }
}

export const smsService = new SmsService();
