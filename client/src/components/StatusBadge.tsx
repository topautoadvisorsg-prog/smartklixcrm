import { Badge } from "@/components/ui/badge";

type Status = "draft" | "assist" | "auto" | "new" | "in_progress" | "completed" | "cancelled" | "pending" | "approved" | "rejected" | "active" | "inactive" | "qualified" | "unqualified";

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  assist: { label: "Assist", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  auto: { label: "Auto", className: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  new: { label: "New", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  approved: { label: "Approved", className: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300" },
  rejected: { label: "Rejected", className: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300" },
  active: { label: "Active", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  inactive: { label: "Inactive", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  qualified: { label: "Qualified", className: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300" },
  unqualified: { label: "Unqualified", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  lead_intake: { label: "Lead Intake", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
};

const defaultConfig = { 
  label: "Unknown", 
  className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" 
};

export default function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status] || defaultConfig;
  const displayLabel = label || config.label;
  const displayStatus = status || "unknown";
  
  return (
    <Badge className={`${config.className} ${className || ""}`} data-testid={`badge-${displayStatus}`}>
      {displayLabel}
    </Badge>
  );
}
