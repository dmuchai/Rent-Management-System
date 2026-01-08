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
    console.log(`[Realtime] Query keys to invalidate:`, JSON.parse(stringifiedQueryKey));
    
    // Create a unique channel name for this subscription
    const channelName = `${tableName}_changes`;
    
    let channel: RealtimeChannel | null = null;
    
    try {
      // Subscribe to postgres changes on the specified table
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events: INSERT, UPDATE, DELETE
            schema: 'public',
            table: tableName,
          },
          (payload) => {
            try {
              console.log(`[Realtime] Change detected in ${tableName}:`, payload.eventType);
              console.log('[Realtime] Payload:', payload);
              
              // Invalidate queries using the memoized queryKey array
              const parsedQueryKey = JSON.parse(stringifiedQueryKey);
              console.log('[Realtime] Parsed query key:', parsedQueryKey);
              console.log('[Realtime] Query key type:', typeof parsedQueryKey, Array.isArray(parsedQueryKey));
              
              if (!Array.isArray(parsedQueryKey)) {
                console.error('[Realtime] ERROR: Query key is not an array!', parsedQueryKey);
                return;
              }
              
              queryClient.invalidateQueries({ queryKey: parsedQueryKey });
              
              console.log(`[Realtime] Invalidated query key: [${parsedQueryKey.join(', ')}]`);
            } catch (error) {
              console.error('[Realtime] Error in subscription callback:', error);
              console.error('[Realtime] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
            }
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
    } catch (error) {
      console.error(`[Realtime] Error setting up subscription for ${tableName}:`, error);
      console.error('[Realtime] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    }

    // Cleanup: Unsubscribe when component unmounts
    return () => {
      console.log(`[Realtime] Cleaning up subscription for ${tableName}`);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          console.error(`[Realtime] Error removing channel for ${tableName}:`, error);
        }
      }
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
