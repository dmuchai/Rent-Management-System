-- Fix occupancy for existing active leases
-- Run this once to update units that have active leases but is_occupied = false

UPDATE public.units u
SET is_occupied = true, updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM public.leases l
  WHERE l.unit_id = u.id
  AND l.is_active = true
)
AND u.is_occupied = false;

-- Verify the fix
SELECT 
  u.id,
  u.unit_number,
  u.is_occupied,
  p.name as property_name,
  COUNT(l.id) FILTER (WHERE l.is_active = true) as active_leases
FROM public.units u
JOIN public.properties p ON u.property_id = p.id
LEFT JOIN public.leases l ON l.unit_id = u.id
GROUP BY u.id, u.unit_number, u.is_occupied, p.name
ORDER BY p.name, u.unit_number;
