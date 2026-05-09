import AdminChatPanel from "@/components/AdminChatPanel";

export default function AdminChat() {
  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold mb-2">Proposal Agent</h1>
        <p className="text-sm text-muted-foreground">
          Proposal Agent with full CRM access - create contacts, manage jobs, schedule appointments, and more.
        </p>
      </div>
      
      <div className="flex-1 min-h-0">
        <AdminChatPanel />
      </div>
    </div>
  );
}
