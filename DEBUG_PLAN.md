# Debug Plan for Dashboard Errors

## Current Symptoms
1. Blank dashboard page after authentication
2. Console error: `Me.slice is not a function` at `index-ChQGwuOT.js:358`
3. Realtime subscriptions are working (setup messages visible)

## Root Cause Analysis

The error `Me.slice is not a function` suggests that somewhere in the code:
- A variable `Me` is expected to be an array or string (which have `.slice()` method)
- But `Me` is receiving something else (likely an object or undefined)

## Debugging Steps

### Step 1: Check Browser DevTools
1. Open DevTools → Sources tab
2. Enable "Pause on exceptions"
3. Refresh page to catch the exact line where error occurs
4. Inspect the value of `Me` at that point

### Step 2: Add Error Boundary
Create an ErrorBoundary component to catch React rendering errors and display useful information.

### Step 3: Add Console Logging
Add strategic console.logs to track:
- What data is being returned from API calls
- What props are being passed to components
- Any data transformations that might corrupt arrays

### Step 4: Check Query Responses
Verify that all useQuery calls are returning expected data structures:
```javascript
console.log('Dashboard stats:', dashboardStats);
console.log('Properties:', properties);
console.log('Tenants:', tenants);
```

### Step 5: Simplify Dashboard
Temporarily comment out sections of the dashboard to isolate which component is causing the issue.

### Step 6: Check for Array Mutations
Look for code that might be converting arrays to objects or vice versa.

## Next Actions
1. Add React Error Boundary
2. Add detailed logging to dashboard component
3. Check if any query is returning malformed data
4. Verify TypeScript types match actual API responses
