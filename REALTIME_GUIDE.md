# Supabase Realtime Implementation Guide

This guide shows you how to use the `useRealtimeSubscription` hook to add live updates to your dashboard.

## ✅ Setup Complete

The following files have been created:

1. **`client/src/lib/supabase.ts`** - Supabase client for the frontend
2. **`client/src/hooks/useRealtimeSubscription.ts`** - Reusable Realtime hook
3. **`client/src/components/payments/PaymentsTable.tsx`** - Example implementation

## 🔧 Configuration Required

### 1. Add Environment Variables

Add these to your `.env` file (local development):

```bash
# Supabase Configuration (Frontend - Already in your project)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Add to Vercel Environment Variables

In your Vercel dashboard, add:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**⚠️ Important:** These should use the same values as `SUPABASE_URL` and the **anon key** (not the service role key).

### 3. Enable Realtime in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Database** → **Replication**
3. Enable replication for the tables you want to track:
   - `payments`
   - `properties`
   - `units`
   - `tenants`
   - `leases`

## 📖 Usage Examples

### Basic Usage

```tsx
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

function MyComponent() {
  // Simply add this line - it handles everything automatically!
  useRealtimeSubscription('payments', ['payments']);
  
  // Your existing component code...
}
```

### Example 1: Payments Table (Already Created)

```tsx
// File: client/src/components/payments/PaymentsTable.tsx
import { useQuery } from '@tanstack/react-query';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

export default function PaymentsTable() {
  const { data: payments } = useQuery({
    queryKey: ['payments'],
    queryFn: fetchPayments,
  });

  // Enable real-time updates
  useRealtimeSubscription('payments', ['payments']);

  return <PaymentHistory payments={payments || []} />;
}
```

### Example 2: Properties Dashboard

```tsx
import { useQuery } from '@tanstack/react-query';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

export default function PropertiesDashboard() {
  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const res = await fetch('/api/properties', { credentials: 'include' });
      return res.json();
    },
  });

  // Listen for property changes
  useRealtimeSubscription('properties', ['properties']);

  return (
    <div>
      {properties?.map(property => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
}
```

### Example 3: Tenants List

```tsx
import { useQuery } from '@tanstack/react-query';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

export default function TenantsList() {
  const { data: tenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const res = await fetch('/api/tenants', { credentials: 'include' });
      return res.json();
    },
  });

  // Listen for tenant changes
  useRealtimeSubscription('tenants', ['tenants']);

  return <TenantTable tenants={tenants || []} />;
}
```

### Example 4: Multiple Subscriptions

```tsx
export default function Dashboard() {
  // Subscribe to multiple tables at once
  useRealtimeSubscription('properties', ['properties']);
  useRealtimeSubscription('units', ['units']);
  useRealtimeSubscription('tenants', ['tenants']);
  useRealtimeSubscription('leases', ['leases']);
  useRealtimeSubscription('payments', ['payments']);

  // Your dashboard code...
}
```

### Example 5: Conditional Subscription

```tsx
export default function PropertyDetails({ propertyId }: { propertyId: number }) {
  const { data: property } = useQuery({
    queryKey: ['properties', propertyId],
    queryFn: () => fetchProperty(propertyId),
    enabled: !!propertyId, // Only fetch if propertyId exists
  });

  // Only subscribe when viewing a specific property
  useRealtimeSubscription('properties', ['properties', propertyId], {
    enabled: !!propertyId
  });

  return <PropertyCard property={property} />;
}
```

## 🎯 How It Works

1. **Hook Setup**: When your component mounts, `useRealtimeSubscription` creates a Supabase Realtime channel
2. **Listen for Changes**: The hook listens for `INSERT`, `UPDATE`, and `DELETE` events on the specified table
3. **Auto-Refresh**: When a change occurs, it calls `queryClient.invalidateQueries()` with your query key
4. **TanStack Query Refetch**: TanStack Query automatically refetches the data
5. **UI Update**: Your component re-renders with the fresh data
6. **Cleanup**: When the component unmounts, the subscription is automatically removed

## 🎨 Visual Feedback (Optional)

You can add visual feedback when data updates:

```tsx
import { useQuery } from '@tanstack/react-query';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useToast } from '@/hooks/use-toast';

export default function PaymentsTable() {
  const { toast } = useToast();
  const { data: payments, isFetching } = useQuery({
    queryKey: ['payments'],
    queryFn: fetchPayments,
  });

  useRealtimeSubscription('payments', ['payments']);

  // Show a subtle indicator when refetching
  React.useEffect(() => {
    if (isFetching) {
      console.log('Refreshing payments data...');
    }
  }, [isFetching]);

  return (
    <div className="relative">
      {isFetching && (
        <div className="absolute top-2 right-2">
          <span className="flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </span>
        </div>
      )}
      <PaymentHistory payments={payments || []} />
    </div>
  );
}
```

## 🐛 Debugging

The hook includes comprehensive logging. Open your browser console to see:

- `[Realtime] Setting up subscription for table: payments`
- `[Realtime] ✅ Successfully subscribed to payments changes`
- `[Realtime] Change detected in payments: INSERT`
- `[Realtime] Invalidated query key: [payments]`
- `[Realtime] Cleaning up subscription for payments`

## 🚀 Next Steps

### Apply to Your Dashboard Components

Update these files to use Realtime:

1. **Properties** - `client/src/pages/dashboard/landlord-properties.tsx`
2. **Units** - `client/src/pages/dashboard/landlord-units.tsx`
3. **Tenants** - `client/src/pages/dashboard/landlord-tenants.tsx`
4. **Leases** - `client/src/pages/dashboard/landlord-leases.tsx`
5. **Dashboard Stats** - `client/src/components/SimpleDashboard.tsx`

### Example Update Pattern

**Before:**
```tsx
export default function PropertiesPage() {
  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: fetchProperties,
  });
  
  return <PropertyList properties={properties} />;
}
```

**After:**
```tsx
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

export default function PropertiesPage() {
  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: fetchProperties,
  });
  
  // Add this single line!
  useRealtimeSubscription('properties', ['properties']);
  
  return <PropertyList properties={properties} />;
}
```

## 📊 Performance Considerations

- **Rate Limiting**: The Supabase client is configured with 10 events per second max
- **Stale Time**: Consider setting `staleTime` in your queries to reduce unnecessary refetches
- **Conditional Subscriptions**: Use the `enabled` option to only subscribe when needed
- **Multiple Subscriptions**: Each subscription creates a separate channel - this is fine for different tables

## ✅ Benefits

- ✨ **Real-time updates** - See changes instantly without page refresh
- 🔄 **Automatic sync** - Data stays fresh across all users
- 🎯 **Simple integration** - Just one line of code per component
- 🧹 **Auto cleanup** - No memory leaks, subscriptions removed on unmount
- 📊 **Works with existing code** - No changes to your current TanStack Query setup

---

**Ready to go live with real-time updates!** 🚀
