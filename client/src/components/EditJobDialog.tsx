/**
 * Edit Job Dialog Component
 * 
 * Allows editing job information from Job Detail page.
 * Updates job via PATCH /api/jobs/:id
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Briefcase } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Job } from "@shared/schema";

const editJobSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  value: z.string().optional(),
  jobNumber: z.string().optional(),
});

type EditJobFormData = z.infer<typeof editJobSchema>;

interface EditJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
}

export default function EditJobDialog({
  open,
  onOpenChange,
  job,
}: EditJobDialogProps) {
  const { toast } = useToast();

  const form = useForm<EditJobFormData>({
    resolver: zodResolver(editJobSchema),
    defaultValues: {
      title: job.title || "",
      description: job.description || "",
      value: job.value ? String(job.value) : "",
      jobNumber: job.jobNumber || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: job.title || "",
        description: job.description || "",
        value: job.value ? String(job.value) : "",
        jobNumber: job.jobNumber || "",
      });
    }
  }, [open, job, form]);

  const updateJobMutation = useMutation({
    mutationFn: async (data: EditJobFormData) => {
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description || null,
        jobNumber: data.jobNumber || null,
      };
      
      if (data.value && data.value.trim()) {
        const parsedValue = parseFloat(data.value);
        if (!isNaN(parsedValue)) {
          payload.value = parsedValue;
        }
      } else {
        payload.value = null;
      }
      
      return apiRequest(`/api/jobs/${job.id}`, "PATCH", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Job Updated",
        description: "Job information has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Could not update job.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditJobFormData) => {
    updateJobMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-edit-job">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Edit Job
          </DialogTitle>
          <DialogDescription>
            Update job information for {job.title}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="HVAC Repair - Main Office"
                      data-testid="input-job-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Detailed description of the job..."
                      rows={3}
                      data-testid="textarea-job-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Value ($)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                      placeholder="4500.00"
                      data-testid="input-job-value"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="jobNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Number</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="JOB-2024-001"
                      data-testid="input-job-number"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateJobMutation.isPending}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateJobMutation.isPending}
                data-testid="button-save-job"
              >
                {updateJobMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
