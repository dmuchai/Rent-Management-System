import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Check, Info, Building, CreditCard, Phone } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getBankByPaybill } from "@shared/bankPaybills";

interface PaymentChannel {
  id: string;
  channelType: 'mpesa_paybill' | 'mpesa_till' | 'mpesa_to_bank' | 'bank_account';
  paybillNumber?: string;
  tillNumber?: string;
  bankPaybillNumber?: string;
  bankAccountNumber?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  displayName: string;
  isPrimary: boolean;
  isActive: boolean;
  notes?: string;
}

interface PaymentInstructionsProps {
  landlordId: string;
  invoiceReferenceCode?: string;
  amount?: number;
}

export default function PaymentInstructions({ 
  landlordId, 
  invoiceReferenceCode,
  amount 
}: PaymentInstructionsProps) {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  console.log('[PaymentInstructions] Received props:', { landlordId, invoiceReferenceCode, amount });

  const { data: channels = [], isLoading, error } = useQuery<PaymentChannel[]>({
    queryKey: [`/api/landlord/${landlordId}/payment-channels`],
    queryFn: async () => {
      console.log('[PaymentInstructions] Fetching channels for landlordId:', landlordId);
      const response = await apiRequest("GET", `/api/landlord/${landlordId}/payment-channels`);
      const result = await response.json();
      console.log('[PaymentInstructions] API response:', result);
      return Array.isArray(result) ? result : result.data || [];
    },
    enabled: !!landlordId, // Only run query if landlordId exists
  });

  console.log('[PaymentInstructions] Query state:', { channels, isLoading, error });

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      toast({
        title: "Copied!",
        description: `${fieldName} copied to clipboard`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy manually",
        variant: "destructive",
      });
    }
  };

  const CopyButton = ({ text, fieldName }: { text: string; fieldName: string }) => (
    <button
      onClick={() => copyToClipboard(text, fieldName)}
      className="ml-2 p-1 hover:bg-gray-100 rounded transition-colors"
      aria-label={`Copy ${fieldName}`}
    >
      {copiedField === fieldName ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4 text-gray-500" />
      )}
    </button>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Instructions
          </CardTitle>
          <CardDescription>Loading payment methods...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeChannels = channels.filter(ch => ch.isActive);
  const primaryChannel = activeChannels.find(ch => ch.isPrimary) || activeChannels[0];

  if (activeChannels.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>No Payment Methods Available</AlertTitle>
            <AlertDescription>
              Please contact your landlord for payment instructions.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Instructions
        </CardTitle>
        <CardDescription>
          Choose a payment method below
          {amount && ` • Amount: KES ${amount.toLocaleString()}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Channel - Highlighted */}
        {primaryChannel && (
          <div className="border-2 border-primary rounded-lg p-4 bg-primary/5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg">{primaryChannel.displayName}</h3>
                <Badge variant="default" className="mt-1">Recommended</Badge>
              </div>
              {getChannelIcon(primaryChannel.channelType)}
            </div>

            {renderChannelDetails(primaryChannel)}
          </div>
        )}

        {/* Other Active Channels */}
        {activeChannels.filter(ch => !ch.isPrimary).length > 0 && (
          <>
            <Separator className="my-4" />
            <p className="text-sm font-medium text-muted-foreground">Alternative Payment Methods</p>
          </>
        )}

        {activeChannels.filter(ch => !ch.isPrimary).map((channel) => (
          <div key={channel.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold">{channel.displayName}</h3>
              {getChannelIcon(channel.channelType)}
            </div>

            {renderChannelDetails(channel)}
          </div>
        ))}

        {/* General Instructions */}
        <Alert className="mt-4">
          <Info className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-2 space-y-1 text-sm">
              {invoiceReferenceCode && (
                <li>Always use the provided reference code for automatic payment matching</li>
              )}
              <li>Payments are typically processed within 5-10 minutes</li>
              <li>Keep your M-PESA/bank confirmation message for your records</li>
              <li>Contact your landlord if payment is not reflected within 24 hours</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );

  function getChannelIcon(channelType: string) {
    switch (channelType) {
      case 'mpesa_paybill':
      case 'mpesa_till':
        return <Phone className="h-6 w-6 text-green-600" />;
      case 'mpesa_to_bank':
        return <Building className="h-6 w-6 text-blue-600" />;
      case 'bank_account':
        return <Building className="h-6 w-6 text-gray-600" />;
      default:
        return <CreditCard className="h-6 w-6 text-gray-600" />;
    }
  }

  function renderChannelDetails(channel: PaymentChannel) {
    switch (channel.channelType) {
      case 'mpesa_paybill':
        if (!channel.paybillNumber) {
          return <p className="text-sm text-muted-foreground">Paybill number not configured</p>;
        }
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-white p-3 rounded border">
              <div>
                <p className="text-xs text-muted-foreground">Paybill Number</p>
                <p className="text-lg font-bold font-mono">{channel.paybillNumber}</p>
              </div>
              <CopyButton text={channel.paybillNumber} fieldName="Paybill" />
            </div>

            {invoiceReferenceCode && (
              <div className="flex items-center justify-between bg-white p-3 rounded border">
                <div>
                  <p className="text-xs text-muted-foreground">Account Number / Reference</p>
                  <p className="text-lg font-bold font-mono">{invoiceReferenceCode}</p>
                </div>
                <CopyButton text={invoiceReferenceCode} fieldName="Reference" />
              </div>
            )}

            <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
              <p className="font-medium mb-2">Steps to Pay:</p>
              <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                <li>Go to M-PESA menu on your phone</li>
                <li>Select "Lipa na M-PESA"</li>
                <li>Select "Paybill"</li>
                <li>Enter Business No: <strong className="text-foreground">{channel.paybillNumber}</strong></li>
                {invoiceReferenceCode ? (
                  <li>Enter Account No: <strong className="text-foreground">{invoiceReferenceCode}</strong></li>
                ) : (
                  <li>Enter your phone number as Account No</li>
                )}
                <li>Enter amount: <strong className="text-foreground">{amount ? `KES ${amount.toLocaleString()}` : 'Your amount'}</strong></li>
                <li>Enter your M-PESA PIN</li>
                <li>Confirm payment</li>
              </ol>
            </div>
          </div>
        );

      case 'mpesa_till':
        if (!channel.tillNumber) {
          return <p className="text-sm text-muted-foreground">Till number not configured</p>;
        }
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-white p-3 rounded border">
              <div>
                <p className="text-xs text-muted-foreground">Till Number</p>
                <p className="text-lg font-bold font-mono">{channel.tillNumber}</p>
              </div>
              <CopyButton text={channel.tillNumber} fieldName="Till Number" />
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
              <p className="font-medium mb-2">Steps to Pay:</p>
              <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                <li>Go to M-PESA menu on your phone</li>
                <li>Select "Lipa na M-PESA"</li>
                <li>Select "Buy Goods and Services"</li>
                <li>Enter Till No: <strong className="text-foreground">{channel.tillNumber}</strong></li>
                <li>Enter amount: <strong className="text-foreground">{amount ? `KES ${amount.toLocaleString()}` : 'Your amount'}</strong></li>
                <li>Enter your M-PESA PIN</li>
                <li>Confirm payment</li>
              </ol>
            </div>
          </div>
        );

      case 'mpesa_to_bank':
        if (!channel.bankPaybillNumber || !channel.bankAccountNumber) {
          return <p className="text-sm text-muted-foreground">Bank account details not configured</p>;
        }
        const bankInfo = getBankByPaybill(channel.bankPaybillNumber);
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-white p-3 rounded border">
              <div>
                <p className="text-xs text-muted-foreground">Bank Paybill ({bankInfo?.name || 'Bank'})</p>
                <p className="text-lg font-bold font-mono">{channel.bankPaybillNumber}</p>
              </div>
              <CopyButton text={channel.bankPaybillNumber} fieldName="Paybill" />
            </div>

            <div className="flex items-center justify-between bg-white p-3 rounded border">
              <div>
                <p className="text-xs text-muted-foreground">Account Number</p>
                <p className="text-lg font-bold font-mono">{channel.bankAccountNumber}</p>
              </div>
              <CopyButton text={channel.bankAccountNumber} fieldName="Account" />
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <p className="font-medium text-blue-900 mb-2">💡 Pay via M-PESA to Bank Account</p>
              <ol className="list-decimal pl-4 space-y-1 text-blue-800">
                <li>Go to M-PESA menu on your phone</li>
                <li>Select "Lipa na M-PESA"</li>
                <li>Select "Paybill"</li>
                <li>Enter Business No: <strong>{channel.bankPaybillNumber}</strong> ({bankInfo?.name || 'Bank'})</li>
                <li>Enter Account No: <strong>{channel.bankAccountNumber}</strong></li>
                <li>Enter amount: <strong>{amount ? `KES ${amount.toLocaleString()}` : 'Your amount'}</strong></li>
                <li>Enter your M-PESA PIN</li>
                <li>Funds will be credited directly to landlord's bank account</li>
              </ol>
            </div>

            {channel.notes && (
              <p className="text-xs text-muted-foreground mt-2 italic">Note: {channel.notes}</p>
            )}
          </div>
        );

      case 'bank_account':
        if (!channel.accountNumber) {
          return <p className="text-sm text-muted-foreground">Account number not configured</p>;
        }
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-white p-3 rounded border">
              <div>
                <p className="text-xs text-muted-foreground">Bank Name</p>
                <p className="text-lg font-bold">{channel.bankName}</p>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white p-3 rounded border">
              <div>
                <p className="text-xs text-muted-foreground">Account Number</p>
                <p className="text-lg font-bold font-mono">{channel.accountNumber}</p>
              </div>
              <CopyButton text={channel.accountNumber} fieldName="Account Number" />
            </div>

            {channel.accountName && (
              <div className="flex items-center justify-between bg-white p-3 rounded border">
                <div>
                  <p className="text-xs text-muted-foreground">Account Name</p>
                  <p className="text-lg font-bold">{channel.accountName}</p>
                </div>
              </div>
            )}

            <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
              <p className="font-medium mb-2">Bank Transfer Instructions:</p>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                <li>Use your bank's mobile app or visit a branch</li>
                <li>Transfer to the account details above</li>
                {invoiceReferenceCode && (
                  <li>Use reference: <strong className="text-foreground">{invoiceReferenceCode}</strong></li>
                )}
                <li>Keep your transaction receipt</li>
                <li>Notify landlord after payment</li>
              </ul>
            </div>
          </div>
        );

      default:
        return <p className="text-sm text-muted-foreground">Payment method details not available</p>;
    }
  }
}
