import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BackNavigationConfirmDialogProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
  journeyName?: string;
}

export const BackNavigationConfirmDialog: React.FC<BackNavigationConfirmDialogProps> = ({
  open,
  onStay,
  onLeave,
  journeyName = "warranty journey"
}) => {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">
            Are you sure you want to leave?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base text-gray-600">
            You're currently in the middle of your {journeyName}. 
            If you leave now, you'll need to start over. 
            Your progress will be saved for a short time if you return soon.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogAction
            onClick={onStay}
            className="bg-primary hover:bg-primary/90 text-white order-1 sm:order-2"
          >
            Stay and Continue
          </AlertDialogAction>
          <AlertDialogCancel
            onClick={onLeave}
            className="mt-0 order-2 sm:order-1"
          >
            Leave Journey
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
