import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Printer, Share2 } from "lucide-react";
import EstimatePresentationView from "./EstimatePresentationView";
import type { Estimate } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface EstimatePreviewDialogProps {
  estimate: Estimate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EstimatePreviewDialog({
  estimate,
  open,
  onOpenChange,
}: EstimatePreviewDialogProps) {
  const { toast } = useToast();

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/estimates/${estimate.id}/view`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Link Copied",
      description: "Estimate link has been copied to clipboard.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="dialog-estimate-preview">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Estimate Preview
              </DialogTitle>
              <DialogDescription>
                Customer presentation view for Estimate #{estimate.id.slice(0, 8)}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                data-testid="button-share-estimate"
              >
                <Share2 className="w-4 h-4 mr-1" />
                Share
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                data-testid="button-print-estimate"
              >
                <Printer className="w-4 h-4 mr-1" />
                Print
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4">
          <EstimatePresentationView
            estimate={estimate}
            onSelect={(tier) => {
              toast({
                title: "Option Selected",
                description: `Customer selected the ${tier.charAt(0).toUpperCase() + tier.slice(1)} option.`,
              });
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
