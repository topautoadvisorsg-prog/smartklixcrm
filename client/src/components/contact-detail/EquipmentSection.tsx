import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, MapPin, Package, ChevronDown, ChevronRight, Trash2, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Location, Equipment } from "@shared/schema";

interface EquipmentSectionProps {
  contactId: string;
  locations: Location[];
  equipment: Equipment[];
}

export default function EquipmentSection({ contactId, locations, equipment }: EquipmentSectionProps) {
  const { toast } = useToast();
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [newLocation, setNewLocation] = useState({ name: "", address: "", notes: "" });
  const [newEquipment, setNewEquipment] = useState({ name: "", model: "", serialNumber: "", notes: "" });

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
          isPrimary: locations.length === 0,
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
    return equipment.filter(e => e.locationId === locationId);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Locations & Equipment ({locations.length})
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
          {locations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No locations added yet</p>
          ) : (
            <div className="space-y-3">
              {locations.map(loc => {
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
    </>
  );
}
