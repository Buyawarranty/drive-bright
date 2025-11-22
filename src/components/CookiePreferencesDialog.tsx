import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface CookiePreferences {
  essential: boolean;
  performance: boolean;
  marketing: boolean;
  functional: boolean;
}

interface CookiePreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (preferences: CookiePreferences) => void;
}

export function CookiePreferencesDialog({
  open,
  onOpenChange,
  onSave,
}: CookiePreferencesDialogProps) {
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always true, cannot be disabled
    performance: false,
    marketing: false,
    functional: false,
  });

  const handleSave = () => {
    onSave(preferences);
    onOpenChange(false);
  };

  const handleAcceptAll = () => {
    const allAccepted = {
      essential: true,
      performance: true,
      marketing: true,
      functional: true,
    };
    onSave(allAccepted);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cookie Preferences</DialogTitle>
          <DialogDescription>
            Manage your cookie preferences. Essential cookies are always enabled
            to ensure the site functions properly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="essential" className="font-medium">
                Essential
              </Label>
              <p className="text-sm text-muted-foreground">
                Required for the website to function. Cannot be disabled.
              </p>
            </div>
            <Switch id="essential" checked={true} disabled aria-label="Essential cookies (always enabled)" />
          </div>

          <div className="flex items-center justify-between space-x-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="performance" className="font-medium">
                Performance
              </Label>
              <p className="text-sm text-muted-foreground">
                Help us understand how visitors interact with our website.
              </p>
            </div>
            <Switch
              id="performance"
              checked={preferences.performance}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, performance: checked })
              }
              aria-label="Performance cookies"
            />
          </div>

          <div className="flex items-center justify-between space-x-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="marketing" className="font-medium">
                Marketing
              </Label>
              <p className="text-sm text-muted-foreground">
                Used to deliver personalized advertisements relevant to you.
              </p>
            </div>
            <Switch
              id="marketing"
              checked={preferences.marketing}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, marketing: checked })
              }
              aria-label="Marketing cookies"
            />
          </div>

          <div className="flex items-center justify-between space-x-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="functional" className="font-medium">
                Functional
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable enhanced functionality and personalization.
              </p>
            </div>
            <Switch
              id="functional"
              checked={preferences.functional}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, functional: checked })
              }
              aria-label="Functional cookies"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleSave} className="w-full sm:w-auto">
            Save Preferences
          </Button>
          <Button onClick={handleAcceptAll} className="w-full sm:w-auto">
            Accept All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
