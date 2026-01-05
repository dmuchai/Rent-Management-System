interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private brevoApiKey: string | undefined;
  private brevoApiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor() {
    this.brevoApiKey = process.env.BREVO_API_KEY;
  }

  /**
   * Escapes HTML special characters to prevent XSS/HTML injection
   * @param str - The string to escape
   * @returns Escaped string safe for HTML insertion
   */
  private escapeHtml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Validates and sanitizes URLs to prevent unsafe schemes
   * Only allows http and https protocols
   * @param url - The URL to validate
   * @returns Sanitized URL or null if invalid/unsafe
   */
  private validateUrl(url: string | undefined): string | null {
    if (!url || typeof url !== 'string') {
      return null;
    }

    try {
      const parsedUrl = new URL(url);
      
      // Only allow http and https protocols
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        console.warn(`Rejected unsafe URL scheme: ${parsedUrl.protocol}`);
        return null;
      }

      return parsedUrl.href;
    } catch (error) {
      console.warn('Invalid URL provided:', url);
      return null;
    }
  }

  /**
   * Sanitizes email subject line to prevent header injection attacks
   * Removes CR/LF characters that could be used to inject additional headers
   */
  private sanitizeSubject(str: string): string {
    if (!str || typeof str !== 'string') {
      return '';
    }
    return str.replace(/[\r\n]/g, '').trim();
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.brevoApiKey) {
      console.warn('Brevo API key not configured. Email not sent.');
      console.log('Would have sent email to:', options.to, 'Subject:', options.subject);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(this.brevoApiUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'accept': 'application/json',
          'api-key': this.brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: 'Landee & Moony',
            email: process.env.BREVO_SENDER_EMAIL || 'noreply@landeeandmoony.com',
          },
          to: [
            {
              email: options.to,
            },
          ],
          subject: options.subject,
          htmlContent: options.html,
          textContent: options.text,
        }),
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = await response.text();
        }
        console.error('Brevo API error:', errorData);
        throw new Error(`Failed to send email via Brevo: ${response.statusText}`);
      }

      console.log('✅ Email sent successfully to:', options.to);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error('Failed to send email');
    }
  }

  async sendTenantInvitation(
    tenantEmail: string,
    tenantName: string,
    invitationToken: string,
    propertyName?: string,
    unitNumber?: string,
    landlordName?: string
  ): Promise<void> {
    const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/accept-invitation?token=${encodeURIComponent(invitationToken)}`;
    
    // Escape all user-provided inputs
    const escapedTenantName = this.escapeHtml(tenantName);
    const escapedLandlordName = landlordName ? this.escapeHtml(landlordName) : null;
    const escapedPropertyName = propertyName ? this.escapeHtml(propertyName) : null;
    const escapedUnitNumber = unitNumber ? this.escapeHtml(unitNumber) : null;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3B82F6; margin: 0;">Landee & Moony</h1>
          <p style="color: #6B7280; margin-top: 8px;">Property Management System</p>
        </div>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; color: white; text-align: center; margin-bottom: 30px;">
          <h2 style="margin: 0 0 10px 0; font-size: 28px;">Welcome to Your New Home! 🏠</h2>
          <p style="margin: 0; font-size: 16px; opacity: 0.9;">You've been invited to join Landee & Moony</p>
        </div>
        
        <div style="background-color: #F9FAFB; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
          <h3 style="color: #1F2937; margin-top: 0;">Hello ${escapedTenantName},</h3>
          <p style="color: #4B5563; line-height: 1.6;">
            ${escapedLandlordName || 'Your landlord'} has invited you to create your tenant account on Landee & Moony, 
            Kenya's leading property management platform.
          </p>
          ${escapedPropertyName ? `
            <div style="margin-top: 20px; padding: 15px; background-color: white; border-radius: 6px; border-left: 4px solid #3B82F6;">
              <p style="margin: 0; color: #6B7280; font-size: 14px;">Property Details</p>
              <p style="margin: 8px 0 0 0; color: #1F2937; font-weight: 600;">${escapedPropertyName}${escapedUnitNumber ? ` - Unit ${escapedUnitNumber}` : ''}</p>
            </div>
          ` : ''}
        </div>
        
        <div style="background-color: #EFF6FF; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
          <h4 style="color: #1F2937; margin-top: 0;">With your account, you can:</h4>
          <ul style="color: #4B5563; line-height: 1.8; padding-left: 20px;">
            <li>💳 Pay rent easily with M-Pesa, Card, or Bank Transfer</li>
            <li>📊 View your payment history and receipts</li>
            <li>🔧 Submit maintenance requests</li>
            <li>📄 Access your lease documents anytime</li>
            <li>📧 Receive important property updates</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 35px 0;">
          <a href="${invitationLink}" 
             style="background-color: #3B82F6; color: white; padding: 16px 40px; 
                    text-decoration: none; border-radius: 8px; display: inline-block;
                    font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
            Create My Account
          </a>
          <p style="color: #6B7280; font-size: 14px; margin-top: 15px;">
            This invitation link expires in 7 days
          </p>
        </div>
        
        <div style="border-top: 2px solid #E5E7EB; padding-top: 20px; margin-top: 30px;">
          <p style="color: #6B7280; font-size: 14px; line-height: 1.6;">
            <strong>Need help?</strong><br>
            If you didn't expect this invitation or have any questions, please contact your landlord 
            or reach out to our support team at <a href="mailto:support@landeeandmoony.com" style="color: #3B82F6;">support@landeeandmoony.com</a>
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
            © 2026 Landee & Moony. All rights reserved.<br>
            The #1 Property Management System in Kenya
          </p>
        </div>
      </div>
    `;

    const text = `
Welcome to Landee & Moony, ${tenantName}!

${landlordName || 'Your landlord'} has invited you to create your tenant account.

${propertyName ? `Property: ${propertyName}${unitNumber ? ` - Unit ${unitNumber}` : ''}` : ''}

With your account, you can:
- Pay rent easily with M-Pesa, Card, or Bank Transfer
- View your payment history and receipts
- Submit maintenance requests
- Access your lease documents anytime
- Receive important property updates

Create your account by clicking this link:
${invitationLink}

This invitation link expires in 7 days.

Need help? Contact us at support@landeeandmoony.com

© 2026 Landee & Moony - The #1 Property Management System in Kenya
    `;

    await this.sendEmail({
      to: tenantEmail,
      subject: `🏠 Welcome to Landee & Moony - Create Your Account`,
      html,
      text,
    });
  }

  async sendRentReminder(
    tenantEmail: string,
    tenantName: string,
    amount: number,
    dueDate: Date,
    propertyName: string,
    unitNumber: string,
    paymentLink?: string
  ): Promise<void> {
    const formattedDate = dueDate.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const formattedAmount = new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);

    // Escape all user-provided inputs
    const escapedTenantName = this.escapeHtml(tenantName);
    const escapedPropertyName = this.escapeHtml(propertyName);
    const escapedUnitNumber = this.escapeHtml(unitNumber);
    
    // Validate payment link to ensure only safe URLs
    const safePaymentLink = this.validateUrl(paymentLink);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3B82F6; margin: 0;">Landee & Moony</h1>
          <p style="color: #6B7280; margin-top: 8px;">Property Management System</p>
        </div>
        
        <h2 style="color: #3B82F6;">Rent Payment Reminder</h2>
        
        <p>Dear ${escapedTenantName},</p>
        
        <p>This is a friendly reminder that your rent payment is due soon.</p>
        
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Payment Details</h3>
          <p><strong>Property:</strong> ${escapedPropertyName}</p>
          <p><strong>Unit:</strong> ${escapedUnitNumber}</p>
          <p><strong>Amount Due:</strong> ${formattedAmount}</p>
          <p><strong>Due Date:</strong> ${formattedDate}</p>
        </div>
        
        ${safePaymentLink ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${safePaymentLink}" 
               style="background-color: #3B82F6; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Pay Now
            </a>
          </div>
        ` : ''}
        
        <p>If you have any questions or concerns, please contact us at <a href="mailto:support@landeeandmoony.com" style="color: #3B82F6;">support@landeeandmoony.com</a></p>
        
        <p>Thank you for your prompt attention to this matter.</p>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
            © 2026 Landee & Moony. All rights reserved.<br>
            The #1 Property Management System in Kenya
          </p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: tenantEmail,
      subject: `Rent Payment Reminder - ${this.sanitizeSubject(propertyName)} Unit ${this.sanitizeSubject(unitNumber)}`,
      html,
      text: `Dear ${tenantName}, your rent payment of ${formattedAmount} for ${propertyName} Unit ${unitNumber} is due on ${formattedDate}.`,
    });
  }

  async sendPaymentConfirmation(
    tenantEmail: string,
    tenantName: string,
    amount: number,
    paymentDate: Date,
    propertyName: string,
    unitNumber: string,
    confirmationCode: string
  ): Promise<void> {
    const formattedDate = paymentDate.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const formattedAmount = new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);

    // Escape all user-provided inputs
    const escapedTenantName = this.escapeHtml(tenantName);
    const escapedPropertyName = this.escapeHtml(propertyName);
    const escapedUnitNumber = this.escapeHtml(unitNumber);
    const escapedConfirmationCode = this.escapeHtml(confirmationCode);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3B82F6; margin: 0;">Landee & Moony</h1>
          <p style="color: #6B7280; margin-top: 8px;">Property Management System</p>
        </div>
        
        <h2 style="color: #10B981;">Payment Confirmation</h2>
        
        <p>Dear ${escapedTenantName},</p>
        
        <p>We have successfully received your rent payment. Thank you!</p>
        
        <div style="background-color: #F0FDF4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
          <h3 style="margin-top: 0; color: #10B981;">Payment Details</h3>
          <p><strong>Property:</strong> ${escapedPropertyName}</p>
          <p><strong>Unit:</strong> ${escapedUnitNumber}</p>
          <p><strong>Amount Paid:</strong> ${formattedAmount}</p>
          <p><strong>Payment Date:</strong> ${formattedDate}</p>
          <p><strong>Confirmation Code:</strong> ${escapedConfirmationCode}</p>
        </div>
        
        <p>Please keep this confirmation for your records.</p>
        
        <p>If you have any questions about this payment, please contact us at <a href="mailto:support@landeeandmoony.com" style="color: #3B82F6;">support@landeeandmoony.com</a></p>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
            © 2026 Landee & Moony. All rights reserved.<br>
            The #1 Property Management System in Kenya
          </p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: tenantEmail,
      subject: `Payment Confirmation - ${this.sanitizeSubject(propertyName)} Unit ${this.sanitizeSubject(unitNumber)}`,
      html,
      text: `Dear ${tenantName}, your payment of ${formattedAmount} for ${propertyName} Unit ${unitNumber} has been confirmed. Confirmation code: ${confirmationCode}.`,
    });
  }

  async sendOverdueNotice(
    tenantEmail: string,
    tenantName: string,
    amount: number,
    dueDate: Date,
    propertyName: string,
    unitNumber: string,
    paymentLink?: string
  ): Promise<void> {
    const formattedDate = dueDate.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const formattedAmount = new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);

    // Escape all user-provided inputs
    const escapedTenantName = this.escapeHtml(tenantName);
    const escapedPropertyName = this.escapeHtml(propertyName);
    const escapedUnitNumber = this.escapeHtml(unitNumber);
    
    // Validate payment link to ensure only safe URLs
    const safePaymentLink = this.validateUrl(paymentLink);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3B82F6; margin: 0;">Landee & Moony</h1>
          <p style="color: #6B7280; margin-top: 8px;">Property Management System</p>
        </div>
        
        <h2 style="color: #EF4444;">Overdue Payment Notice</h2>
        
        <p>Dear ${escapedTenantName},</p>
        
        <p>We notice that your rent payment is now overdue. Please make your payment as soon as possible to avoid any late fees.</p>
        
        <div style="background-color: #FEF2F2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #EF4444;">
          <h3 style="margin-top: 0; color: #EF4444;">Overdue Payment Details</h3>
          <p><strong>Property:</strong> ${escapedPropertyName}</p>
          <p><strong>Unit:</strong> ${escapedUnitNumber}</p>
          <p><strong>Amount Due:</strong> ${formattedAmount}</p>
          <p><strong>Original Due Date:</strong> ${formattedDate}</p>
        </div>
        
        ${safePaymentLink ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${safePaymentLink}" 
               style="background-color: #EF4444; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Pay Now
            </a>
          </div>
        ` : ''}
        
        <p>If you are experiencing financial difficulties, please contact us at <a href="mailto:support@landeeandmoony.com" style="color: #3B82F6;">support@landeeandmoony.com</a> to discuss payment arrangements.</p>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
            © 2026 Landee & Moony. All rights reserved.<br>
            The #1 Property Management System in Kenya
          </p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: tenantEmail,
      subject: `OVERDUE: Rent Payment - ${this.sanitizeSubject(propertyName)} Unit ${this.sanitizeSubject(unitNumber)}`,
      html,
      text: `Dear ${tenantName}, your rent payment of ${formattedAmount} for ${propertyName} Unit ${unitNumber} was due on ${formattedDate} and is now overdue.`,
    });
  }
}

export const emailService = new EmailService();
