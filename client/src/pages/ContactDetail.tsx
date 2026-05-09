import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowLeft, Mail, Phone, Building, Calendar, FileText, 
  Edit, DollarSign, Plus, Sparkles, 
  TrendingUp, AlertCircle, Briefcase
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "@/components/StatusBadge";
import EditContactDialog from "@/components/EditContactDialog";
import { 
  NotesSection, 
  FilesSection, 
  AppointmentsSection, 
  EquipmentSection, 
  PaymentMethodsSection, 
  TimelineSection 
} from "@/components/contact-detail";
import { format, formatDistanceToNow } from "date-fns";
import avatar1 from "@assets/generated_images/Female_executive_avatar_c19fd1f4.png";
import type { Contact, Job, Note, FileRecord as FileData, AuditLogEntry, Appointment, Estimate, Invoice, Payment, Location, Equipment, StoredPaymentMethod } from "@shared/schema";

export default function ContactDetail() {
  const [, params] = useRoute("/contacts/:id");
  const [, setLocation] = useLocation();
  const contactId = params?.id;
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: contacts = [], isLoading: contactLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const contact = contacts.find(c => c.id === contactId);

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: allNotes = [] } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
  });

  const { data: allFiles = [] } = useQuery<FileData[]>({
    queryKey: ["/api/files"],
  });

  const { data: allAppointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: auditLog = [] } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/audit-log"],
  });

  const { data: allEstimates = [] } = useQuery<Estimate[]>({
    queryKey: ["/api/estimates"],
  });

  const { data: allInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: allPayments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const { data: contactLocations = [] } = useQuery<Location[]>({
    queryKey: ["/api/locations", { contactId }],
    queryFn: async () => {
      const res = await fetch(`/api/locations?contactId=${contactId}`);
      return res.json();
    },
    enabled: !!contactId,
  });

  const { data: allEquipment = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: storedPaymentMethods = [] } = useQuery<StoredPaymentMethod[]>({
    queryKey: ["/api/payment-methods", { contactId }],
    queryFn: async () => {
      const res = await fetch(`/api/payment-methods?contactId=${contactId}`);
      return res.json();
    },
    enabled: !!contactId,
  });

  const contactJobs = jobs.filter(job => job.clientId === contactId);
  const contactNotes = allNotes.filter(note => note.entityType === 'contact' && note.entityId === contactId);
  const contactFiles = allFiles.filter(file => file.entityType === 'contact' && file.entityId === contactId);
  const contactAppointments = allAppointments.filter(apt => apt.contactId === contactId);
  const contactEstimates = allEstimates.filter(est => est.contactId === contactId);
  const contactInvoices = allInvoices.filter(inv => inv.contactId === contactId);
  
  const totalRevenue = contactInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
  const paidRevenue = allPayments
    .filter(p => contactInvoices.some(inv => inv.id === p.invoiceId))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Build unified communication timeline
  const timelineEvents = [
    ...auditLog
      .filter(log => log.entityId === contactId)
      .map(log => ({
        id: `audit-${log.id}`,
        user: log.userId || "System",
        userAvatar: avatar1,
        action: `${log.action.replace(/_/g, " ")}`,
        timestamp: formatDistanceToNow(new Date(log.timestamp), { addSuffix: true }),
        rawTimestamp: new Date(log.timestamp).getTime(),
        details: log.entityType ? `${log.entityType}` : undefined,
        type: "audit" as const,
      })),
    ...contactNotes.map(note => ({
      id: `note-${note.id}`,
      user: "User",
      userAvatar: avatar1,
      action: `Added note: ${note.title || "Untitled"}`,
      timestamp: formatDistanceToNow(new Date(note.createdAt), { addSuffix: true }),
      rawTimestamp: new Date(note.createdAt).getTime(),
      details: note.content?.substring(0, 100),
      type: "note" as const,
    })),
  ].sort((a, b) => b.rawTimestamp - a.rawTimestamp);

  if (contactLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setLocation("/contacts")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Contacts
        </Button>
        <Card className="p-12">
          <p className="text-center text-muted-foreground">Contact not found</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => setLocation("/contacts")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Contact Header Card */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-4 space-y-0">
          <Avatar className="w-16 h-16">
            {contact.avatar && <AvatarImage src={contact.avatar} />}
            <AvatarFallback className="text-lg">
              {contact.name ? contact.name.substring(0, 2).toUpperCase() : "??"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-semibold">{contact.name || contact.phone || "Unknown Contact"}</h1>
              <StatusBadge status={contact.status} />
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {contact.email}
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {contact.phone}
                </div>
              )}
              {contact.company && (
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  {contact.company}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditDialogOpen(true)}
              data-testid="button-edit-contact"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Two-column grid layout - Main content + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content (Left Column - 2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Suggestions */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <Sparkles className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">AI Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Insights will appear here once the AI has analyzed this contact.
              </p>
            </CardContent>
          </Card>

          {/* Jobs Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Jobs ({contactJobs.length})
              </CardTitle>
              <Button size="sm" variant="outline" data-testid="button-create-job">
                <Plus className="w-4 h-4 mr-2" />
                Create Job
              </Button>
            </CardHeader>
            <CardContent>
              {contactJobs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No jobs yet</p>
              ) : (
                <div className="space-y-3">
                  {contactJobs.slice(0, 5).map(job => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-3 border rounded-md hover-elevate cursor-pointer"
                      onClick={() => setLocation(`/jobs/${job.id}`)}
                      data-testid={`job-card-${job.id}`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{job.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {job.value ? `$${job.value}` : ""} • {format(new Date(job.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Locations & Equipment Section */}
          <EquipmentSection 
            contactId={contactId || ""} 
            locations={contactLocations} 
            equipment={allEquipment} 
          />

          {/* Payment Methods Section */}
          <PaymentMethodsSection 
            contactId={contactId || ""} 
            paymentMethods={storedPaymentMethods} 
          />

          {/* Communication Timeline */}
          <TimelineSection events={timelineEvents} />

          {/* Inline Notes */}
          <NotesSection contactId={contactId || ""} notes={contactNotes} />
        </div>

        {/* Right Sidebar (1/3 width) */}
        <div className="space-y-6">
          {/* Financial Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Financial Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-semibold">${totalRevenue.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-xl font-medium text-green-600">${paidRevenue.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-xl font-medium text-orange-600">${(totalRevenue - paidRevenue).toFixed(2)}</p>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Recent Invoices</p>
                {contactInvoices.slice(0, 3).map(inv => (
                  <div key={inv.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Invoice {inv.id.substring(0, 8)}</span>
                    <span className="font-medium">${inv.totalAmount}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Appointments */}
          <AppointmentsSection appointments={contactAppointments} />

          {/* Files */}
          <FilesSection files={contactFiles} />
        </div>
      </div>

      {/* Edit Contact Dialog */}
      <EditContactDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        contact={contact}
      />
    </div>
  );
}
