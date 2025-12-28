import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, MessageCircle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

type WidgetSettings = {
  primaryColor: string;
  accentColor: string;
  welcomeMessage: string;
  supportEmail: string;
  position: string;
};

export default function ChatWidget() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: settings, isLoading } = useQuery<WidgetSettings>({
    queryKey: ["/api/widget/settings"],
  });

  const [config, setConfig] = useState({
    primaryColor: "#FDB913",
    accentColor: "#1E40AF",
    welcomeMessage: "Hi! How can we help you today?",
    supportEmail: "support@smartklix.com",
    position: "bottom-right",
  });

  useEffect(() => {
    if (settings) {
      setConfig({
        primaryColor: settings.primaryColor || "#FDB913",
        accentColor: settings.accentColor || "#1E40AF",
        welcomeMessage: settings.welcomeMessage || "Hi! How can we help you today?",
        supportEmail: settings.supportEmail || "support@smartklix.com",
        position: settings.position || "bottom-right",
      });
    }
  }, [settings]);

  const tenantId = "TENANT_123456";

  const generateSnippet = () => {
    return `<!-- Smart Klix Widget -->
<script src="https://cdn.smartklix.ai/widget.js"
        data-tenant="${tenantId}"
        data-color="${config.primaryColor}"
        data-accent="${config.accentColor}"
        data-position="${config.position}"
        data-welcome="${config.welcomeMessage}">
</script>`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generateSnippet());
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Widget code copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy code",
        variant: "destructive",
      });
    }
  };

  const saveSettingsMutation = useMutation({
    mutationFn: (settings: WidgetSettings) =>
      apiRequest("/api/widget/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/widget/settings"] });
      toast({
        title: "Settings Saved",
        description: "Widget configuration has been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save widget settings",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveSettingsMutation.mutate(config);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading widget settings...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-chat-widget-title">Chat Widget</h1>
          <p className="text-muted-foreground">Embed Smart Klix chat into any external website</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card data-testid="card-widget-configuration">
              <CardHeader>
                <CardTitle>Widget Configuration</CardTitle>
                <CardDescription>Customize your chat widget appearance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={config.primaryColor}
                      onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                      className="w-20 h-10"
                      data-testid="input-primary-color"
                    />
                    <Input
                      type="text"
                      value={config.primaryColor}
                      onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                      className="flex-1"
                      data-testid="input-primary-color-text"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accentColor">Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accentColor"
                      type="color"
                      value={config.accentColor}
                      onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                      className="w-20 h-10"
                      data-testid="input-accent-color"
                    />
                    <Input
                      type="text"
                      value={config.accentColor}
                      onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                      className="flex-1"
                      data-testid="input-accent-color-text"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="welcomeMessage">Welcome Message</Label>
                  <Textarea
                    id="welcomeMessage"
                    value={config.welcomeMessage}
                    onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                    placeholder="Enter welcome message"
                    rows={3}
                    data-testid="input-welcome-message"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supportEmail">Support Email</Label>
                  <Input
                    id="supportEmail"
                    type="email"
                    value={config.supportEmail}
                    onChange={(e) => setConfig({ ...config, supportEmail: e.target.value })}
                    placeholder="support@example.com"
                    data-testid="input-support-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="position">Widget Position</Label>
                  <Select
                    value={config.position}
                    onValueChange={(value) => setConfig({ ...config, position: value })}
                  >
                    <SelectTrigger data-testid="select-widget-position">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottom-right" data-testid="option-bottom-right">
                        Bottom Right
                      </SelectItem>
                      <SelectItem value="bottom-left" data-testid="option-bottom-left">
                        Bottom Left
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleSave} className="w-full" data-testid="button-save-config">
                  Save Configuration
                </Button>
              </CardContent>
            </Card>

            <Card data-testid="card-code-snippet">
              <CardHeader>
                <CardTitle>Widget Code Snippet</CardTitle>
                <CardDescription>Copy and paste this code into your website</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                    <code data-testid="text-code-snippet">{generateSnippet()}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopy}
                    className="absolute top-2 right-2"
                    data-testid="button-copy-snippet"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    <span className="font-semibold">Tenant ID:</span> {tenantId}
                  </p>
                  <p className="text-xs">
                    This code dynamically updates as you change configuration settings.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-widget-preview">
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>See how your widget will appear</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative bg-gradient-to-br from-muted to-background rounded-lg p-8 min-h-[500px] border-2 border-dashed">
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <p className="text-sm">Your website content here...</p>
                </div>

                <div
                  className={`absolute ${
                    config.position === "bottom-right" ? "bottom-4 right-4" : "bottom-4 left-4"
                  } transition-all duration-300`}
                  data-testid="preview-widget-bubble"
                >
                  <div className="relative">
                    <Button
                      size="icon"
                      className="h-14 w-14 rounded-full shadow-lg"
                      style={{ backgroundColor: config.primaryColor }}
                      data-testid="button-preview-widget"
                    >
                      <MessageCircle className="w-6 h-6" />
                    </Button>

                    <Card
                      className="absolute bottom-20 w-80 shadow-xl"
                      style={{
                        [config.position === "bottom-right" ? "right" : "left"]: 0,
                      }}
                      data-testid="preview-widget-card"
                    >
                      <CardHeader
                        className="text-white"
                        style={{ backgroundColor: config.primaryColor }}
                      >
                        <CardTitle className="text-base">Smart Klix Support</CardTitle>
                        <CardDescription className="text-white/90 text-sm">
                          We're here to help
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3">
                        <div
                          className="bg-muted p-3 rounded-lg text-sm"
                          data-testid="preview-welcome-message"
                        >
                          {config.welcomeMessage}
                        </div>
                        <Input
                          placeholder="Type your message..."
                          className="text-sm"
                          data-testid="preview-message-input"
                        />
                        <Button
                          size="sm"
                          className="w-full"
                          style={{ backgroundColor: config.accentColor }}
                          data-testid="preview-send-button"
                        >
                          Send Message
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
