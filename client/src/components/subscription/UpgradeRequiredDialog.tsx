import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { PlanCode, SubscriptionResourceKey } from '../../../../shared/subscription/index.js';

interface UpgradeRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: SubscriptionResourceKey | null;
  currentPlan: PlanCode;
  requiredPlan: PlanCode;
  current: number;
  limit: number;
  onViewPlans: () => void;
}

export function UpgradeRequiredDialog({
  open,
  onOpenChange,
  resource,
  currentPlan,
  requiredPlan,
  current,
  limit,
  onViewPlans,
}: UpgradeRequiredDialogProps) {
  const resourceLabel =
    resource === 'active_properties'
      ? 'active properties'
      : resource === 'active_units'
        ? 'active units'
        : 'management users';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upgrade required</DialogTitle>
          <DialogDescription>
            You have reached the {resourceLabel} limit for your current plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/40 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Current plan</span>
              <Badge variant="secondary" className="capitalize">{currentPlan}</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Limit reached</span>
              <span className="font-medium">{current} / {limit}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Required plan</span>
              <Badge>{requiredPlan}</Badge>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Upgrade to continue adding new {resourceLabel}. Existing records stay readable.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onViewPlans}>View plans</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
