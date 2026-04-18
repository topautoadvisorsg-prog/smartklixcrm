import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  ArrowLeft, Mail, Phone, Building, Calendar, FileText, MessageSquare, 
  Activity, Edit, DollarSign, Plus, Upload, Sparkles, 
  TrendingUp, Clock, CheckCircle, AlertCircle, Send, Briefcase,
  MapPin, Package, ChevronDown, ChevronRight, Trash2, Wrench, CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import StatusBadge from "@/components/StatusBadge";
import ActivityTimeline from "@/components/ActivityTimeline";
import EditContactDialog from "@/components/EditContactDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Contact, Job, Note, FileRecord as FileData, AuditLogEntry, Appointment, Estimate, Invoice, Payment, Location, Equipment, StoredPaymentMethod } from "@shared/schema";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, formatDistanceToNow } from "date-fns";
import avatar1 from "@assets/generated_images/Female_executive_avatar_c19fd1f4.png";

export default function ContactDetail() {
  const [, params] = useRoute("/contacts/:id");
  const [, setLocation] = useLocation();
  const contactId = params?.id;
  const { toast } = useToast();
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [newLocation, setNewLocation] = useState({ name: "", address: "", notes: "" });
  const [newEquipment, setNewEquipment] = useState({ name: "", model: "", serialNumber: "", notes: "" });
  const [addPaymentMethodDialogOpen, setAddPaymentMethodDialogOpen] = useState(false);

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

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "contact",
          entityId: contactId,
          content,
          title: "Quick Note",
        }),
      });
      if (!response.ok) throw new Error("Failed to add note");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setNewNote("");
      toast({ title: "Note added successfully" });
    },
  });

  const addLocationMutation = useMutation({
    mutationFn: async (data: { name: string; address: string; notes: string }) => {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          name: data.name,
          address: data.address,
          notes: data.notes,
          isPrimary: contactLocations.length === 0,
        }),
      });
      if (!response.ok) throw new Error("Failed to add location");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations", { contactId }] });
      setLocationDialogOpen(false);
      setNewLocation({ name: "", address: "", notes: "" });
      toast({ title: "Location added successfully" });
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/locations/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete location");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations", { contactId }] });
      toast({ title: "Location deleted" });
    },
  });

  const addEquipmentMutation = useMutation({
    mutationFn: async (data: { locationId: string; name: string; model: string; serialNumber: string; notes: string }) => {
      const response = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: data.locationId,
          name: data.name,
          model: data.model,
          serialNumber: data.serialNumber,
          notes: data.notes,
        }),
      });
      if (!response.ok) throw new Error("Failed to add equipment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setEquipmentDialogOpen(false);
      setSelectedLocationId(null);
      setNewEquipment({ name: "", model: "", serialNumber: "", notes: "" });
      toast({ title: "Equipment added successfully" });
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/equipment/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete equipment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      toast({ title: "Equipment deleted" });
    },
  });

  const deletePaymentMethodMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/payment-methods/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete payment method");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods", { contactId }] });
      toast({ title: "Payment method removed" });
    },
  });

  const handleAddNote = () => {
    if (newNote.trim()) {
      addNoteMutation.mutate(newNote);
    }
  };

  const toggleLocationExpanded = (locationId: string) => {
    const newExpanded = new Set(expandedLocations);
    if (newExpanded.has(locationId)) {
      newExpanded.delete(locationId);
    } else {
      newExpanded.add(locationId);
    }
    setExpandedLocations(newExpanded);
  };

  const getEquipmentForLocation = (locationId: string) => {
    return allEquipment.filter(e => e.locationId === locationId);
  };

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
              <CardTitle className="text-lg">AI Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Follow up on pending estimate</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimate #1234 sent 3 days ago - suggested action: send reminder
                  </p>
                </div>
                <Button size="sm" variant="outline" data-testid="button-ai-action-1">
                  <Send className="w-3 h-3 mr-1" />
                  Send
                </Button>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
                <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Schedule maintenance appointment</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on last service date, customer is due for routine maintenance
                  </p>
                </div>
                <Button size="sm" variant="outline" data-testid="button-ai-action-2">
                  <Calendar className="w-3 h-3 mr-1" />
                  Schedule
                </Button>
              </div>
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Locations & Equipment ({contactLocations.length})
              </CardTitle>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setLocationDialogOpen(true)}
                data-testid="button-add-location"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Location
              </Button>
            </CardHeader>
            <CardContent>
              {contactLocations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No locations added yet</p>
              ) : (
                <div className="space-y-3">
                  {contactLocations.map(loc => {
                    const locationEquipment = getEquipmentForLocation(loc.id);
                    const isExpanded = expandedLocations.has(loc.id);
                    return (
                      <div key={loc.id} className="border rounded-md" data-testid={`location-card-${loc.id}`}>
                        <div 
                          className="flex items-center justify-between p-3 hover-elevate cursor-pointer"
                          onClick={() => toggleLocationExpanded(loc.id)}
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                            <MapPin className="w-4 h-4 text-primary" />
                            <div>
                              <p className="font-medium">{loc.name}</p>
                              <p className="text-sm text-muted-foreground">{loc.address}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {loc.isPrimary && (
                              <Badge variant="outline" className="text-xs">Primary</Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              <Package className="w-3 h-3 mr-1" />
                              {locationEquipment.length}
                            </Badge>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteLocationMutation.mutate(loc.id);
                              }}
                              data-testid={`button-delete-location-${loc.id}`}
                            >
                              <Trash2 className="w-3 h-3 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="border-t p-3 bg-muted/30">
                            {loc.notes && (
                              <p className="text-sm text-muted-foreground mb-3 italic">{loc.notes}</p>
                            )}
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium flex items-center gap-2">
                                <Wrench className="w-4 h-4" />
                                Equipment at this location
                              </p>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLocationId(loc.id);
                                  setEquipmentDialogOpen(true);
                                }}
                                data-testid={`button-add-equipment-${loc.id}`}
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Add
                              </Button>
                            </div>
                            {locationEquipment.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-2">No equipment</p>
                            ) : (
                              <div className="space-y-2">
                                {locationEquipment.map(equip => (
                                  <div 
                                    key={equip.id} 
                                    className="flex items-center justify-between p-2 bg-background rounded border"
                                    data-testid={`equipment-card-${equip.id}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <Package className="w-4 h-4 text-muted-foreground" />
                                      <div>
                                        <p className="text-sm font-medium">{equip.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {equip.model && `${equip.model}`}
                                          {equip.serialNumber && ` • S/N: ${equip.serialNumber}`}
                                        </p>
                                      </div>
                                    </div>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => deleteEquipmentMutation.mutate(equip.id)}
                                      data-testid={`button-delete-equipment-${equip.id}`}
                                    >
                                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Methods Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Methods ({storedPaymentMethods.length})
              </CardTitle>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setAddPaymentMethodDialogOpen(true)}
                data-testid="button-add-payment-method"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Card
              </Button>
            </CardHeader>
            <CardContent>
              {storedPaymentMethods.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No payment methods saved</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {storedPaymentMethods.map(pm => (
                    <div 
                      key={pm.id} 
                      className="flex items-center justify-between p-3 border rounded-md"
                      data-testid={`payment-method-card-${pm.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {pm.brand ? `${pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1)}` : 'Card'} 
                            {pm.last4 && ` •••• ${pm.last4}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {pm.expiryMonth && pm.expiryYear && `Expires ${pm.expiryMonth}/${pm.expiryYear}`}
                            {pm.isDefault && <Badge variant="secondary" className="ml-2 text-xs">Default</Badge>}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => deletePaymentMethodMutation.mutate(pm.id)}
                        data-testid={`button-delete-payment-method-${pm.id}`}
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Communication Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Communication Timeline
              </CardTitle>
              <CardDescription>All interactions, notes, and system events</CardDescription>
            </CardHeader>
            <CardContent>
              {timelineEvents.length > 0 ? (
                <ActivityTimeline events={timelineEvents.slice(0, 10)} />
              ) : (
                <p className="text-center text-muted-foreground py-8">No activity yet</p>
              )}
            </CardContent>
          </Card>

          {/* Inline Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Notes ({contactNotes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a quick note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  data-testid="input-new-note"
                  rows={3}
                />
                <Button 
                  onClick={handleAddNote} 
                  disabled={!newNote.trim() || addNoteMutation.isPending}
                  data-testid="button-add-note"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Note
                </Button>
              </div>
              <Separator />
              <div className="space-y-3">
                {contactNotes.slice(0, 5).map(note => (
                  <div key={note.id} className="p-3 border rounded-md" data-testid={`note-card-${note.id}`}>
                    <p className="text-sm font-medium">{note.title || "Quick Note"}</p>
                    <p className="text-sm text-muted-foreground mt-1">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Appointments
              </CardTitle>
              <Button size="sm" variant="outline" data-testid="button-schedule-appointment">
                <Plus className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent>
              {contactAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No appointments</p>
              ) : (
                <div className="space-y-3">
                  {contactAppointments.slice(0, 3).map(apt => (
                    <div key={apt.id} className="p-2 border rounded-md" data-testid={`appointment-card-${apt.id}`}>
                      <p className="text-sm font-medium">{apt.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(apt.scheduledAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Files */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Files ({contactFiles.length})
              </CardTitle>
              <Button size="sm" variant="outline" data-testid="button-upload-file">
                <Upload className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent>
              {contactFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No files uploaded</p>
              ) : (
                <div className="space-y-2">
                  {contactFiles.slice(0, 5).map(file => (
                    <div key={file.id} className="flex items-center justify-between text-sm p-2 border rounded-md" data-testid={`file-card-${file.id}`}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {(file.size / 1024).toFixed(1)}KB
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <EditContactDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        contact={contact}
      />

      {/* Add Location Dialog */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="location-name">Location Name</Label>
              <Input
                id="location-name"
                placeholder="e.g., Main Office, Warehouse"
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                data-testid="input-location-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-address">Address</Label>
              <Input
                id="location-address"
                placeholder="Full street address"
                value={newLocation.address}
                onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                data-testid="input-location-address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-notes">Service Notes</Label>
              <Input
                id="location-notes"
                placeholder="Gate code, access instructions, etc."
                value={newLocation.notes}
                onChange={(e) => setNewLocation({ ...newLocation, notes: e.target.value })}
                data-testid="input-location-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => addLocationMutation.mutate(newLocation)}
              disabled={!newLocation.name || !newLocation.address || addLocationMutation.isPending}
              data-testid="button-save-location"
            >
              {addLocationMutation.isPending ? "Adding..." : "Add Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Equipment Dialog */}
      <Dialog open={equipmentDialogOpen} onOpenChange={setEquipmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Equipment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="equipment-name">Equipment Name</Label>
              <Input
                id="equipment-name"
                placeholder="e.g., HVAC Unit, Water Heater"
                value={newEquipment.name}
                onChange={(e) => setNewEquipment({ ...newEquipment, name: e.target.value })}
                data-testid="input-equipment-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equipment-model">Model</Label>
              <Input
                id="equipment-model"
                placeholder="Model number"
                value={newEquipment.model}
                onChange={(e) => setNewEquipment({ ...newEquipment, model: e.target.value })}
                data-testid="input-equipment-model"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equipment-serial">Serial Number</Label>
              <Input
                id="equipment-serial"
                placeholder="Serial number"
                value={newEquipment.serialNumber}
                onChange={(e) => setNewEquipment({ ...newEquipment, serialNumber: e.target.value })}
                data-testid="input-equipment-serial"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equipment-notes">Notes</Label>
              <Input
                id="equipment-notes"
                placeholder="Maintenance notes, warranty info, etc."
                value={newEquipment.notes}
                onChange={(e) => setNewEquipment({ ...newEquipment, notes: e.target.value })}
                data-testid="input-equipment-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEquipmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedLocationId) {
                  addEquipmentMutation.mutate({
                    locationId: selectedLocationId,
                    ...newEquipment,
                  });
                }
              }}
              disabled={!newEquipment.name || !selectedLocationId || addEquipmentMutation.isPending}
              data-testid="button-save-equipment"
            >
              {addEquipmentMutation.isPending ? "Adding..." : "Add Equipment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
