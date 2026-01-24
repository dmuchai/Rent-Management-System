import twilio from 'twilio';

/**
 * SMS Service for API Functions
 * 
 * Handles sending text messages using Africa's Talking API.
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

    // Twilio Credentials
    private twilioAccountSid: string | undefined;
    private twilioAuthToken: string | undefined;
    private twilioFromNumber: string | undefined;
    private twilioClient: any;

    constructor() {
        // Africa's Talking
        this.atUsername = process.env.AT_USERNAME;
        this.atApiKey = process.env.AT_API_KEY;
        this.atSenderId = process.env.AT_SENDER_ID;

        // Twilio
        this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
        this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
        this.twilioFromNumber = process.env.TWILIO_FROM_NUMBER;

        if (this.twilioAccountSid && this.twilioAuthToken) {
            this.twilioClient = twilio(this.twilioAccountSid, this.twilioAuthToken);
        }

        // Automatically use sandbox URL if username is 'sandbox'
        if (this.atUsername === 'sandbox') {
            this.atApiUrl = 'https://api.sandbox.africastalking.com/version1/messaging';
        }
    }

    async sendSms(options: SmsOptions): Promise<any> {
        const provider = process.env.SMS_PROVIDER || (this.twilioAccountSid ? 'twilio' : 'africastalking');

        console.log(`[SMS] Sending via ${provider} to ${options.to}`);

        if (provider === 'twilio') {
            return this.sendViaTwilio(options);
        } else {
            return this.sendViaAt(options);
        }
    }

    private async sendViaTwilio(options: SmsOptions): Promise<any> {
        if (!this.twilioClient || !this.twilioFromNumber) {
            console.warn('[SMS] Twilio not configured. Falling back to console.');
            console.log(`[SMS MOCK] To: ${options.to} | Message: ${options.message}`);
            return { status: 'mocked', message: 'Twilio credentials missing' };
        }

        try {
            const message = await this.twilioClient.messages.create({
                body: options.message,
                from: this.twilioFromNumber,
                to: options.to,
            });
            console.log(`[SMS] Twilio message created: ${message.sid} | Status: ${message.status}`);
            return message;
        } catch (error) {
            console.error('[SMS] Twilio send failed:', error);
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
                console.log(`[SMS] Status: ${status} | To: ${options.to} | Cost: ${cost}`);

                if (status !== 'Success' && status !== 'Sent') {
                    console.warn(`[SMS] Delivery status warning: ${status} for ${options.to}`);
                }
            } else {
                console.log('✅ SMS sent successfully to:', options.to);
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
