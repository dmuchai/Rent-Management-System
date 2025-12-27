# Practical Example: Adding Realtime to Landlord Dashboard

This document shows exactly how to update your existing dashboard component to use Realtime updates.

## 📝 Before (Current Code)

```tsx
// File: client/src/pages/dashboard/landlord.tsx
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function LandlordDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState("overview");

  // Fetch properties
  const { data: properties } = useQuery({
    queryKey: ["properties"],
    queryFn: () => apiRequest("/api/properties"),
  });

  // Fetch tenants
  const { data: tenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => apiRequest("/api/tenants"),
  });

  // Fetch payments
  const { data: payments } = useQuery({
    queryKey: ["payments"],
    queryFn: () => apiRequest("/api/payments"),
  });

  return (
    <div>
      {/* Dashboard UI */}
    </div>
  );
}
```

## ✨ After (With Realtime)

```tsx
// File: client/src/pages/dashboard/landlord.tsx
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription"; // ← ADD THIS

export default function LandlordDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState("overview");

  // Fetch properties
  const { data: properties } = useQuery({
    queryKey: ["properties"],
    queryFn: () => apiRequest("/api/properties"),
  });

  // Fetch tenants
  const { data: tenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => apiRequest("/api/tenants"),
  });

  // Fetch payments
  const { data: payments } = useQuery({
    queryKey: ["payments"],
    queryFn: () => apiRequest("/api/payments"),
  });

  // ✨ ADD THESE THREE LINES - That's it!
  useRealtimeSubscription("properties", ["properties"]);
  useRealtimeSubscription("tenants", ["tenants"]);
  useRealtimeSubscription("payments", ["payments"]);

  return (
    <div>
      {/* Dashboard UI - NO CHANGES NEEDED */}
    </div>
  );
}
```

## 🎯 What Changed?

**Just 4 lines of code:**
1. Import the hook at the top
2. Add subscription for properties
3. Add subscription for tenants  
4. Add subscription for payments

**That's literally it!** Your dashboard now updates in real-time. 🎉

## 🔄 Step-by-Step Update Guide

### Step 1: Import the Hook

Add this to your imports section:
```tsx
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
```

### Step 2: Add Subscriptions

Add these lines right after your `useQuery` hooks (before the `return` statement):
```tsx
useRealtimeSubscription("properties", ["properties"]);
useRealtimeSubscription("tenants", ["tenants"]);
useRealtimeSubscription("payments", ["payments"]);
useRealtimeSubscription("leases", ["leases"]);
useRealtimeSubscription("units", ["units"]);
```

### Step 3: Save and Test

1. Save the file
2. Open your dashboard
3. Open browser console (F12)
4. Look for messages like:
   ```
   [Realtime] Setting up subscription for table: properties
   [Realtime] ✅ Successfully subscribed to properties changes
   ```

### Step 4: Verify It Works

1. Open your dashboard in two browser windows side by side
2. In Window 1: Add a new property or tenant
3. In Window 2: Watch it appear automatically! ✨

## 📍 Where to Add Realtime

### Dashboard Overview Page
```tsx
// client/src/pages/dashboard/landlord.tsx
useRealtimeSubscription("properties", ["properties"]);
useRealtimeSubscription("tenants", ["tenants"]);
useRealtimeSubscription("leases", ["leases"]);
useRealtimeSubscription("payments", ["payments"]);
useRealtimeSubscription("units", ["units"]);
```

### Individual Pages

**Properties Page:**
```tsx
// client/src/pages/dashboard/landlord-properties.tsx
useRealtimeSubscription("properties", ["properties"]);
```

**Tenants Page:**
```tsx
// client/src/pages/dashboard/landlord-tenants.tsx
useRealtimeSubscription("tenants", ["tenants"]);
```

**Leases Page:**
```tsx
// client/src/pages/dashboard/landlord-leases.tsx
useRealtimeSubscription("leases", ["leases"]);
```

**Payments Page:**
```tsx
// client/src/pages/dashboard/landlord-payments.tsx
useRealtimeSubscription("payments", ["payments"]);
```

## 💡 Pro Tips

### Tip 1: Only Subscribe When Viewing
If you have a detail page that only loads when an ID is present:

```tsx
function PropertyDetails({ propertyId }) {
  const { data: property } = useQuery({
    queryKey: ["properties", propertyId],
    queryFn: () => apiRequest(`/api/properties?id=${propertyId}`),
    enabled: !!propertyId,
  });

  // Only subscribe when propertyId exists
  useRealtimeSubscription("properties", ["properties", propertyId], {
    enabled: !!propertyId
  });

  return <div>{/* Property details */}</div>;
}
```

### Tip 2: Subscribe to Related Tables
If your stats depend on multiple tables:

```tsx
function DashboardStats() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => apiRequest("/api/dashboard/stats"),
  });

  // Subscribe to all tables that affect stats
  useRealtimeSubscription("properties", ["properties"]);
  useRealtimeSubscription("units", ["units"]);
  useRealtimeSubscription("tenants", ["tenants"]);
  useRealtimeSubscription("leases", ["leases"]);
  useRealtimeSubscription("payments", ["payments"]);

  return <StatsCards stats={stats} />;
}
```

### Tip 3: Add Visual Feedback
Show users when data is refreshing:

```tsx
function PropertiesList() {
  const { data: properties, isFetching } = useQuery({
    queryKey: ["properties"],
    queryFn: () => apiRequest("/api/properties"),
  });

  useRealtimeSubscription("properties", ["properties"]);

  return (
    <div className="relative">
      {/* Subtle loading indicator */}
      {isFetching && (
        <div className="absolute top-4 right-4 z-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            Updating...
          </div>
        </div>
      )}
      
      {/* Your properties list */}
      <PropertyList properties={properties || []} />
    </div>
  );
}
```

## ⚙️ Configuration Needed

Make sure you have these environment variables set:

**Local (.env):**
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**Vercel (Project Settings → Environment Variables):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Supabase (Database → Replication):**
- Enable replication for: `properties`, `tenants`, `leases`, `payments`, `units`

## 🎉 Results

**Before:**
- Users must manually refresh the page to see updates
- Changes made by other users are invisible
- Data can become stale

**After:**
- Updates appear instantly (within ~100ms)
- All users see changes in real-time
- Data is always fresh
- Better collaboration for multi-user scenarios
- More professional and modern UX

---

**That's it! Three lines of code for real-time magic.** ✨
