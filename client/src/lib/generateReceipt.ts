import jsPDF from "jspdf";

interface PaymentReceiptData {
  id: string;
  amount: string | number;
  paidDate: string;
  paymentMethod: string;
  paymentType: string;
  description?: string;
  tenant: {
    firstName: string;
    lastName: string;
    email: string;
  };
  property: {
    name: string;
  };
  unit: {
    unitNumber: string;
  };
}

export const generatePaymentReceipt = (payment: PaymentReceiptData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFillColor(37, 99, 235); // Blue header
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT RECEIPT", pageWidth / 2, 20, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Official Payment Confirmation", pageWidth / 2, 30, { align: "center" });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Receipt ID and Date
  doc.setFontSize(10);
  let y = 55;
  doc.setFont("helvetica", "bold");
  doc.text("Receipt #:", 20, y);
  doc.setFont("helvetica", "normal");
  doc.text(payment.id.substring(0, 8).toUpperCase(), 50, y);
  
  doc.setFont("helvetica", "bold");
  doc.text("Date Issued:", pageWidth - 70, y);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleDateString(), pageWidth - 20, y, { align: "right" });
  
  // Divider line
  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  
  // Tenant Information
  y += 15;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Tenant Information", 20, y);
  
  y += 10;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${payment.tenant.firstName} ${payment.tenant.lastName}`, 20, y);
  
  y += 7;
  doc.text(`Email: ${payment.tenant.email}`, 20, y);
  
  // Property Information
  y += 15;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Property Information", 20, y);
  
  y += 10;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Property: ${payment.property.name}`, 20, y);
  
  y += 7;
  doc.text(`Unit: ${payment.unit.unitNumber}`, 20, y);
  
  // Payment Details Box
  y += 20;
  const boxY = y;
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(20, boxY, pageWidth - 40, 60, 3, 3, "F");
  
  y += 10;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Details", 25, y);
  
  y += 12;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  
  // Payment details in two columns
  const leftCol = 25;
  const rightCol = pageWidth / 2 + 10;
  
  doc.setFont("helvetica", "bold");
  doc.text("Amount Paid:", leftCol, y);
  doc.setFont("helvetica", "normal");
  doc.text(`KES ${parseFloat(payment.amount.toString()).toLocaleString()}`, leftCol + 40, y);
  
  doc.setFont("helvetica", "bold");
  doc.text("Payment Date:", rightCol, y);
  doc.setFont("helvetica", "normal");
  const paidDate = new Date(payment.paidDate);
  const formattedDate = isNaN(paidDate.getTime()) ? "—" : paidDate.toLocaleDateString();
  doc.text(formattedDate, rightCol + 40, y);
  
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Payment Method:", leftCol, y);
  doc.setFont("helvetica", "normal");
  doc.text(payment.paymentMethod.replace(/_/g, " ").toUpperCase(), leftCol + 40, y);
  
  doc.setFont("helvetica", "bold");
  doc.text("Payment Type:", rightCol, y);
  doc.setFont("helvetica", "normal");
  doc.text(payment.paymentType.replace(/_/g, " ").toUpperCase(), rightCol + 40, y);
  
  // Description if available
  if (payment.description) {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Description:", leftCol, y);
    doc.setFont("helvetica", "normal");
    const descLines = doc.splitTextToSize(payment.description, pageWidth - 90);
    doc.text(descLines, leftCol + 40, y);
    y += descLines.length * 5;
  }
  
  // Amount in Large Font
  y += 25;
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235);
  doc.text(
    `KES ${parseFloat(payment.amount.toString()).toLocaleString()}`,
    pageWidth / 2,
    y,
    { align: "center" }
  );
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  y += 8;
  doc.text("Total Amount Paid", pageWidth / 2, y, { align: "center" });
  
  // Footer
  y = doc.internal.pageSize.getHeight() - 40;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  
  y += 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("This is an official payment receipt", pageWidth / 2, y, { align: "center" });
  
  y += 5;
  doc.text("For any queries, please contact your property manager", pageWidth / 2, y, { align: "center" });
  
  y += 10;
  doc.setFontSize(8);
  doc.text(
    `Generated on ${new Date().toLocaleString()}`,
    pageWidth / 2,
    y,
    { align: "center" }
  );
  
  // Save the PDF with validated ID and sanitized filename
  const paymentIdPart = payment?.id && payment.id.length >= 8 
    ? payment.id.substring(0, 8) 
    : "unknown";
  const datePart = new Date().toISOString().split('T')[0].replace(/:/g, '-');
  const fileName = `receipt-${paymentIdPart}-${datePart}.pdf`;
  
  try {
    doc.save(fileName);
  } catch (error) {
    console.error("Failed to save receipt PDF:", error);
    throw new Error(`Unable to generate receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export default generatePaymentReceipt;
