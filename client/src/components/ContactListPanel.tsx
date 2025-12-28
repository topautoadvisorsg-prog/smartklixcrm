import { useState } from "react";
import { Search, Plus, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import StatusBadge from "@/components/StatusBadge";
import CreateContactDialog from "@/components/CreateContactDialog";

interface Contact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContactListPanelProps {
  contacts: Contact[] | undefined;
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (contact: Contact) => void;
}

export default function ContactListPanel({
  contacts,
  isLoading,
  selectedId,
  onSelect,
}: ContactListPanelProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredContacts = contacts?.filter((contact) => {
    const query = searchQuery.toLowerCase();
    return (
      contact.name?.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query) ||
      contact.phone?.includes(query) ||
      contact.company?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Contacts</h2>
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            data-testid="button-create-contact"
          >
            <Plus className="w-4 h-4 mr-1" />
            New
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            className="pl-9 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-contacts"
          />
        </div>
        {contacts && (
          <p className="text-xs text-muted-foreground">
            {filteredContacts?.length || 0} of {contacts.length} contacts
          </p>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="divide-y">
          {isLoading && (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {!isLoading && filteredContacts?.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              {searchQuery ? "No contacts match your search" : "No contacts yet"}
            </div>
          )}

          {!isLoading &&
            filteredContacts?.map((contact) => (
              <div
                key={contact.id}
                className={`p-3 cursor-pointer transition-colors hover-elevate ${
                  selectedId === contact.id
                    ? "bg-primary/10 border-l-2 border-l-primary"
                    : ""
                }`}
                onClick={() => onSelect(contact)}
                data-testid={`contact-item-${contact.id}`}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10">
                    {contact.avatar && <AvatarImage src={contact.avatar} />}
                    <AvatarFallback className="text-sm">
                      {contact.name
                        ? contact.name.substring(0, 2).toUpperCase()
                        : contact.phone
                        ? "PH"
                        : "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {contact.name || contact.phone || "Unknown"}
                      </span>
                      <StatusBadge status={contact.status} className="scale-90" />
                    </div>
                    {contact.company && (
                      <p className="text-xs text-muted-foreground truncate">
                        {contact.company}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {contact.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3" />
                          <span className="truncate max-w-[120px]">{contact.email}</span>
                        </span>
                      )}
                      {contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {contact.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </ScrollArea>

      <CreateContactDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
