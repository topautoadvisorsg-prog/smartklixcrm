import { Plus, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import type { Appointment } from "@shared/schema";

interface AppointmentsSectionProps {
  appointments: Appointment[];
}

export default function AppointmentsSection({ appointments }: AppointmentsSectionProps) {
  return (
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
        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No appointments</p>
        ) : (
          <div className="space-y-3">
            {appointments.slice(0, 3).map(apt => (
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
  );
}
