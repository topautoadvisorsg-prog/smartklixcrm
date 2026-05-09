import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Zap, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PipelineCardData } from "./PipelineCard";

interface WizardData {
  contactPhone: string;
  contactEmail: string;
  assignedTech: string;
  duration: string;
  depositReady: boolean;
}

interface BookingRequest {
  cardId: string;
  technicianId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  depositPaid?: boolean;
}

interface BookingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  card: PipelineCardData | null;
}

export default function BookingWizard({ isOpen, onClose, card }: BookingWizardProps) {
  const { toast } = useToast();
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({
    contactPhone: '',
    contactEmail: '',
    assignedTech: '',
    duration: '',
    depositReady: false,
  });

  const bookingMutation = useMutation({
    mutationFn: async (data: BookingRequest) => {
      const response = await apiRequest('POST', '/api/pipeline/book', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline/cards'] });
      toast({
        title: "Booking Committed",
        description: "Job has been booked successfully",
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to book job",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    onClose();
    setWizardStep(1);
    setWizardData({
      contactPhone: '',
      contactEmail: '',
      assignedTech: '',
      duration: '',
      depositReady: false,
    });
  };

  const handleNext = () => {
    if (wizardStep < 4) {
      setWizardStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (wizardStep > 1) {
      setWizardStep(prev => prev - 1);
    }
  };

  const handleCommitBooking = () => {
    if (!card) return;

    bookingMutation.mutate({
      cardId: card.id,
      technicianId: wizardData.assignedTech,
      depositPaid: wizardData.depositReady,
    });
  };

  // Initialize wizard data when card changes
  const handleOpenChange = (open: boolean) => {
    if (open && card) {
      setWizardData({
        contactPhone: card.customerPhone || '',
        contactEmail: card.customerEmail || '',
        assignedTech: card.assignedUserName || '',
        duration: '',
        depositReady: false,
      });
    }
    if (!open) {
      handleClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-foreground">
            Finalize Booking & Transition Gate
          </DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="flex items-center space-x-2 mb-6">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">
            Step {wizardStep} of 4: {
              wizardStep === 1 ? 'Validate Contact Info' :
              wizardStep === 2 ? 'Confirm Scope (Read-Only)' :
              wizardStep === 3 ? 'Assign Technician & Duration' :
              'Verify Payment Readiness'
            }
          </span>
          <div className="flex-1 h-1 bg-muted rounded-full">
            <div 
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(wizardStep / 4) * 100}%` }}
            />
          </div>
        </div>

        {card && (
          <>
            {/* Step 1: Contact Validation */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-xl p-4 border border-border space-y-3">
                  <div className="flex items-center space-x-2 text-xs">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground font-bold">Client:</span>
                    <span className="text-foreground font-bold">{card.customerName}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      Phone Number
                    </Label>
                    <Input
                      value={wizardData.contactPhone}
                      onChange={(e) => setWizardData(prev => ({ ...prev, contactPhone: e.target.value }))}
                      placeholder="+1 555-0000"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      Email Address
                    </Label>
                    <Input
                      value={wizardData.contactEmail}
                      onChange={(e) => setWizardData(prev => ({ ...prev, contactEmail: e.target.value }))}
                      placeholder="contact@example.com"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Scope Confirmation (Read-Only) */}
            {wizardStep === 2 && (
              <div className="bg-muted/50 rounded-xl p-4 border border-border space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-bold">Client:</span>
                  <span className="text-foreground font-bold">{card.customerName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-bold">Estimate ID:</span>
                  <span className="text-foreground font-bold">
                    {card.estimateId || 'N/A'} (Active)
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-bold">Total Value:</span>
                  <span className="text-foreground font-black">
                    ${card.totalValue.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-bold">Job Title:</span>
                  <span className="text-foreground font-medium">{card.jobTitle}</span>
                </div>
              </div>
            )}

            {/* Step 3: Assign Tech & Duration */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Assigned Technician
                  </Label>
                  <Select 
                    value={wizardData.assignedTech} 
                    onValueChange={(val) => setWizardData(prev => ({ ...prev, assignedTech: val }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select technician..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sarah Arch">Sarah Arch</SelectItem>
                      <SelectItem value="Michael Gov">Michael Gov</SelectItem>
                      <SelectItem value="John Smith">John Smith</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Estimated Duration
                  </Label>
                  <Select 
                    value={wizardData.duration} 
                    onValueChange={(val) => setWizardData(prev => ({ ...prev, duration: val }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select duration..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1 day">1 Day</SelectItem>
                      <SelectItem value="2-3 days">2-3 Days</SelectItem>
                      <SelectItem value="1 week">1 Week</SelectItem>
                      <SelectItem value="2 weeks">2 Weeks</SelectItem>
                      <SelectItem value="1 month">1 Month+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 4: Payment Readiness */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-xl p-4 border border-border space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-bold">Total Value:</span>
                    <span className="text-foreground font-black">
                      ${card.totalValue.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-bold">Deposit Required:</span>
                    <span className="text-foreground font-bold">
                      ${(card.totalValue * 0.25).toLocaleString()} (25%)
                    </span>
                  </div>
                </div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wizardData.depositReady}
                    onChange={(e) => setWizardData(prev => ({ ...prev, depositReady: e.target.checked }))}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-sm font-medium text-foreground">
                    Deposit received or payment terms confirmed
                  </span>
                </label>
              </div>
            )}
          </>
        )}

        {/* Wizard Actions */}
        <div className="flex space-x-3 mt-6">
          {wizardStep > 1 && (
            <Button variant="outline" onClick={handleBack} disabled={bookingMutation.isPending}>
              Back
            </Button>
          )}
          <Button variant="outline" onClick={handleClose} disabled={bookingMutation.isPending}>
            Cancel
          </Button>
          
          {wizardStep < 4 ? (
            <Button onClick={handleNext} className="flex-1">
              Next Step
            </Button>
          ) : (
            <Button 
              onClick={handleCommitBooking} 
              disabled={bookingMutation.isPending || !wizardData.depositReady}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {bookingMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  COMMIT BOOKING (Irreversible)
                </>
              )}
            </Button>
          )}
        </div>

        <p className="text-[9px] text-muted-foreground mt-4 text-center leading-relaxed">
          This action triggers a ledger event and creates an operational Job record. Cannot be undone.
        </p>
      </DialogContent>
    </Dialog>
  );
}
