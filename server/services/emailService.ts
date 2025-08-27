import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Configure transporter based on environment
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('Email service not configured. Email not sent.');
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `"RentFlow" <${process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      console.log('Email sent successfully to:', options.to);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error('Failed to send email');
    }
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

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">Rent Payment Reminder</h2>
        
        <p>Dear ${tenantName},</p>
        
        <p>This is a friendly reminder that your rent payment is due soon.</p>
        
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Payment Details</h3>
          <p><strong>Property:</strong> ${propertyName}</p>
          <p><strong>Unit:</strong> ${unitNumber}</p>
          <p><strong>Amount Due:</strong> ${formattedAmount}</p>
          <p><strong>Due Date:</strong> ${formattedDate}</p>
        </div>
        
        ${paymentLink ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${paymentLink}" 
               style="background-color: #3B82F6; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Pay Now
            </a>
          </div>
        ` : ''}
        
        <p>If you have any questions or concerns, please don't hesitate to contact us.</p>
        
        <p>Thank you for your prompt attention to this matter.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
        
        <p style="color: #6B7280; font-size: 14px;">
          This is an automated message from RentFlow Property Management System.
        </p>
      </div>
    `;

    await this.sendEmail({
      to: tenantEmail,
      subject: `Rent Payment Reminder - ${propertyName} Unit ${unitNumber}`,
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

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10B981;">Payment Confirmation</h2>
        
        <p>Dear ${tenantName},</p>
        
        <p>We have successfully received your rent payment. Thank you!</p>
        
        <div style="background-color: #F0FDF4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
          <h3 style="margin-top: 0; color: #10B981;">Payment Details</h3>
          <p><strong>Property:</strong> ${propertyName}</p>
          <p><strong>Unit:</strong> ${unitNumber}</p>
          <p><strong>Amount Paid:</strong> ${formattedAmount}</p>
          <p><strong>Payment Date:</strong> ${formattedDate}</p>
          <p><strong>Confirmation Code:</strong> ${confirmationCode}</p>
        </div>
        
        <p>Please keep this confirmation for your records.</p>
        
        <p>If you have any questions about this payment, please contact us.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
        
        <p style="color: #6B7280; font-size: 14px;">
          This is an automated message from RentFlow Property Management System.
        </p>
      </div>
    `;

    await this.sendEmail({
      to: tenantEmail,
      subject: `Payment Confirmation - ${propertyName} Unit ${unitNumber}`,
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

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #EF4444;">Overdue Payment Notice</h2>
        
        <p>Dear ${tenantName},</p>
        
        <p>We notice that your rent payment is now overdue. Please make your payment as soon as possible to avoid any late fees.</p>
        
        <div style="background-color: #FEF2F2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #EF4444;">
          <h3 style="margin-top: 0; color: #EF4444;">Overdue Payment Details</h3>
          <p><strong>Property:</strong> ${propertyName}</p>
          <p><strong>Unit:</strong> ${unitNumber}</p>
          <p><strong>Amount Due:</strong> ${formattedAmount}</p>
          <p><strong>Original Due Date:</strong> ${formattedDate}</p>
        </div>
        
        ${paymentLink ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${paymentLink}" 
               style="background-color: #EF4444; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Pay Now
            </a>
          </div>
        ` : ''}
        
        <p>If you are experiencing financial difficulties, please contact us to discuss payment arrangements.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
        
        <p style="color: #6B7280; font-size: 14px;">
          This is an automated message from RentFlow Property Management System.
        </p>
      </div>
    `;

    await this.sendEmail({
      to: tenantEmail,
      subject: `OVERDUE: Rent Payment - ${propertyName} Unit ${unitNumber}`,
      html,
      text: `Dear ${tenantName}, your rent payment of ${formattedAmount} for ${propertyName} Unit ${unitNumber} was due on ${formattedDate} and is now overdue.`,
    });
  }
}

export const emailService = new EmailService();
