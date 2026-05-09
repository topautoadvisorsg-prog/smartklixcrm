import { PublicChatWidget } from "@/components/PublicChatWidget";

export default function WidgetDemo() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Demo landing page content */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Hero */}
          <div className="space-y-4">
            <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              Welcome to SmartKlix
            </h1>
            <p className="text-xl text-muted-foreground">
              Professional field service management and automation
            </p>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="bg-card p-6 rounded-lg shadow-md">
              <div className="text-4xl mb-4">🔧</div>
              <h3 className="text-lg font-semibold mb-2">Expert Service</h3>
              <p className="text-sm text-muted-foreground">
                Professional plumbing, electrical, and HVAC services
              </p>
            </div>

            <div className="bg-card p-6 rounded-lg shadow-md">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-lg font-semibold mb-2">Fast Response</h3>
              <p className="text-sm text-muted-foreground">
                Same-day service available for urgent repairs
              </p>
            </div>

            <div className="bg-card p-6 rounded-lg shadow-md">
              <div className="text-4xl mb-4">💯</div>
              <h3 className="text-lg font-semibold mb-2">Guaranteed Work</h3>
              <p className="text-sm text-muted-foreground">
                100% satisfaction guarantee on all services
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-card p-8 rounded-lg shadow-lg mt-12">
            <h2 className="text-2xl font-bold mb-4">Need Help?</h2>
            <p className="text-muted-foreground mb-6">
              Try our chat widget in the bottom-right corner! It's powered by AI
              and connects directly to our team.
            </p>
            <div className="inline-block bg-blue-100 dark:bg-blue-900 px-6 py-3 rounded-full">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                👉 Click the chat bubble to get started
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-12 text-left bg-muted p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Widget Demo Instructions:</h3>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Click the chat bubble in the bottom-right corner</li>
              <li>Start chatting - the AI will respond to your questions</li>
              <li>Click "Let us know how to reach you" to provide contact info</li>
              <li>Check the Contacts and Jobs pages to see the lead created in CRM</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Public Chat Widget */}
      <PublicChatWidget
        welcomeMessage="Hi! I'm the SmartKlix AI assistant. How can I help you today?"
        companyName="SmartKlix Support"
        position="bottom-right"
      />
    </div>
  );
}
