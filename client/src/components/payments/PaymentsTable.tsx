/**
 * PaymentsTable Component with Realtime Updates
 * 
 * This component demonstrates how to use the useRealtimeSubscription hook
 * to enable live updates for the payments table.
 * 
 * Features:
 * - Fetches payments data using TanStack Query
 * - Subscribes to Realtime updates from Supabase
 * - Automatically refreshes when payments are added, updated, or deleted
 * - Shows loading states and error handling
 */

import { useQuery } from '@tanstack/react-query';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import PaymentHistory from '@/components/payments/PaymentHistory';
import type { Payment } from '@shared/schema';

// API helper function
async function fetchPayments(): Promise<Payment[]> {
  const response = await fetch('/api/payments', {
    credentials: 'include', // Include auth cookies
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch payments');
  }
  
  return response.json();
}

export default function PaymentsTable() {
  // Fetch payments data using TanStack Query
  const { data: payments, isLoading, error } = useQuery({
    queryKey: ['payments'],
    queryFn: fetchPayments,
    staleTime: 1000 * 60, // Consider data fresh for 1 minute
    refetchOnWindowFocus: true, // Refetch when user focuses the window
  });

  // Subscribe to Realtime updates
  // This will automatically invalidate and refetch the payments query
  // whenever INSERT, UPDATE, or DELETE events occur on the payments table
  useRealtimeSubscription('payments', ['payments']);

  // Error state
  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Payments</h3>
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : 'An unknown error occurred'}
        </p>
      </div>
    );
  }

  // Render the payment history component
  return <PaymentHistory payments={payments || []} loading={isLoading} />;
}
