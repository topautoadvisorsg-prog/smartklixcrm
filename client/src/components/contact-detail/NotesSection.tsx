import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Note } from "@shared/schema";

interface NotesSectionProps {
  contactId: string;
  notes: Note[];
}

export default function NotesSection({ contactId, notes }: NotesSectionProps) {
  const { toast } = useToast();
  const [newNote, setNewNote] = useState("");

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

  const handleAddNote = () => {
    if (newNote.trim()) {
      addNoteMutation.mutate(newNote);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Notes ({notes.length})
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
          {notes.slice(0, 5).map(note => (
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
  );
}
