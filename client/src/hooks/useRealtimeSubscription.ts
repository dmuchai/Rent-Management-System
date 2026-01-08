/**
 * useRealtimeSubscription Hook
 * 
 * A reusable custom hook for subscribing to Supabase Realtime changes.
 * Automatically invalidates TanStack Query cache when database changes occur.
 * 
 * @param tableName - The name of the database table to listen to
 * @param queryKey - The TanStack Query key to invalidate on changes
 * 
 * @example
 * ```tsx
 * // In your component
 * useRealtimeSubscription('payments', ['payments']);
 * ```
 */

import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeSubscriptionOptions {
  tableName: string;
  queryKey: string[];
  enabled?: boolean; // Optional: allow conditional subscription
}

export function useRealtimeSubscription(
  tableName: string,
  queryKey: string[],
  options?: { enabled?: boolean }
) {
  const queryClient = useQueryClient();
  const enabled = options?.enabled !== undefined ? options.enabled : true;

  // Memoize the stringified queryKey to prevent unnecessary effect reruns
  const stringifiedQueryKey = useMemo(() => JSON.stringify(queryKey), [queryKey]);

  useEffect(() => {
    // Skip if disabled
    if (!enabled) {
      console.log(`[Realtime] Subscription disabled for table: ${tableName}`);
      return;
    }

    console.log(`[Realtime] Setting up subscription for table: ${tableName}`);
    
    // Create a unique channel name for this subscription
    const channelName = `${tableName}_changes`;
    
    // Subscribe to postgres changes on the specified table
    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events: INSERT, UPDATE, DELETE
          schema: 'public',
          table: tableName,
        },
        (payload) => {
          console.log(`[Realtime] Change detected in ${tableName}:`, payload.eventType);
          console.log('[Realtime] Payload:', payload);
          
          // Invalidate queries using the memoized queryKey array
          const parsedQueryKey = JSON.parse(stringifiedQueryKey);
          queryClient.invalidateQueries({ queryKey: parsedQueryKey });
          
          console.log(`[Realtime] Invalidated query key: [${parsedQueryKey.join(', ')}]`);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] ✅ Successfully subscribed to ${tableName} changes`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[Realtime] ❌ Failed to subscribe to ${tableName}`);
        } else if (status === 'TIMED_OUT') {
          console.error(`[Realtime] ⏱️ Subscription to ${tableName} timed out`);
        } else if (status === 'CLOSED') {
          console.log(`[Realtime] 🔌 Subscription to ${tableName} closed`);
        } else {
          console.log(`[Realtime] Status update for ${tableName}:`, status);
        }
      });

    // Cleanup: Unsubscribe when component unmounts
    return () => {
      console.log(`[Realtime] Cleaning up subscription for ${tableName}`);
      supabase.removeChannel(channel);
    };
  }, [tableName, stringifiedQueryKey, queryClient, enabled]);
}

/**
 * Alternative hook with more configuration options
 */
export function useRealtimeSubscriptionAdvanced({
  tableName,
  queryKey,
  enabled = true,
}: UseRealtimeSubscriptionOptions) {
  return useRealtimeSubscription(tableName, queryKey, { enabled });
}
