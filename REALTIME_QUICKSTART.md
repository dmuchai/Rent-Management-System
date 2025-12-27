/**
 * QUICK START: Using Supabase Realtime
 * 
 * Add this single line to any component to enable real-time updates:
 */

import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

// In your component:
useRealtimeSubscription('table_name', ['queryKey']);

/**
 * COMPLETE EXAMPLES
 */

// ================================
// Example 1: Payments
// ================================
import { useQuery } from '@tanstack/react-query';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

function PaymentsPage() {
  const { data: payments } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await fetch('/api/payments', { credentials: 'include' });
      return res.json();
    },
  });

  useRealtimeSubscription('payments', ['payments']);

  return <PaymentHistory payments={payments || []} />;
}

// ================================
// Example 2: Properties
// ================================
function PropertiesPage() {
  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const res = await fetch('/api/properties', { credentials: 'include' });
      return res.json();
    },
  });

  useRealtimeSubscription('properties', ['properties']);

  return <PropertyList properties={properties || []} />;
}

// ================================
// Example 3: Dashboard (Multiple)
// ================================
function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: fetchStats,
  });

  // Subscribe to all tables that affect dashboard stats
  useRealtimeSubscription('properties', ['properties']);
  useRealtimeSubscription('units', ['units']);
  useRealtimeSubscription('tenants', ['tenants']);
  useRealtimeSubscription('leases', ['leases']);
  useRealtimeSubscription('payments', ['payments']);

  return <StatsCards stats={stats} />;
}

// ================================
// Example 4: Conditional (with ID)
// ================================
function PropertyDetails({ propertyId }: { propertyId: number }) {
  const { data: property } = useQuery({
    queryKey: ['properties', propertyId],
    queryFn: () => fetchProperty(propertyId),
    enabled: !!propertyId,
  });

  useRealtimeSubscription('properties', ['properties', propertyId], {
    enabled: !!propertyId
  });

  return <PropertyCard property={property} />;
}

/**
 * HOW IT WORKS
 * 
 * 1. Component mounts → Hook subscribes to Supabase Realtime
 * 2. Database changes (INSERT/UPDATE/DELETE) → Event received
 * 3. Query invalidated → TanStack Query refetches data
 * 4. Component re-renders → UI updates automatically
 * 5. Component unmounts → Subscription cleaned up
 * 
 * NO POLLING. NO MANUAL REFRESH. JUST WORKS. ✨
 */
