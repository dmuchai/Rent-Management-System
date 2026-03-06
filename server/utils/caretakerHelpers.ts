import { supabase } from "../supabaseAuth";

/**
 * Returns all unit IDs that a caretaker is assigned to (directly or via property).
 */
export async function getCaretakerUnitIds(caretakerId: string): Promise<string[]> {
  const { data: assignments, error } = await supabase
    .from("caretaker_assignments")
    .select("property_id, unit_id")
    .eq("caretaker_id", caretakerId)
    .eq("status", "active");

  if (error) throw error;

  const unitIds = new Set<string>();
  const propertyIds: string[] = [];

  (assignments || []).forEach((assignment: any) => {
    if (assignment.unit_id) unitIds.add(assignment.unit_id);
    if (assignment.property_id) propertyIds.push(assignment.property_id);
  });

  if (propertyIds.length > 0) {
    const { data: units, error: unitsError } = await supabase
      .from("units")
      .select("id")
      .in("property_id", propertyIds);

    if (unitsError) throw unitsError;
    (units || []).forEach((unit: any) => unitIds.add(unit.id));
  }

  return Array.from(unitIds);
}

/**
 * Returns true if the caretaker has an active assignment under the given landlord.
 */
export async function caretakerHasLandlordAccess(
  caretakerId: string,
  landlordId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("caretaker_assignments")
    .select("id")
    .eq("caretaker_id", caretakerId)
    .eq("landlord_id", landlordId)
    .eq("status", "active")
    .limit(1);

  if (error) throw error;
  return (data || []).length > 0;
}
