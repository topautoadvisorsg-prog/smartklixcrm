/**
 * AI VOICE MODULE — Integration Socket
 *
 * Status: WIRED — awaiting external telephony + AI API connection
 *
 * Two core functions:
 *   A) INBOUND: Capture caller info, respond with "team will follow up", forward to intake hub
 *   B) OUTBOUND: Send templated follow-up messages for missed calls / appointments
 *
 * This module is NOT a chatbot. It is a lightweight intake + scheduling follow-up layer.
 * It will connect to external voice/telephony APIs when ready.
 */

import { Phone, PhoneIncoming, PhoneOutgoing, Plug, CircleDot, ArrowRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const INBOUND_FIELDS = [
  "Caller name (if available)",
  "Phone number",
  "Reason for call",
  "Short summary",
];

const INBOUND_RESPONSE = `"Got it — someone from our team will follow up shortly."`;

const OUTBOUND_TEMPLATES = [
  { trigger: "Missed call", message: "We missed your call. We're here to help when you're ready — please reach out at your convenience." },
  { trigger: "Missed appointment", message: "We missed you on your scheduled appointment. Please reach out to reschedule at a time that works for you." },
  { trigger: "Rescheduling", message: "Just following up on your request — we're here to help when you're ready." },
];

export default function AIReceptionist() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-2">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
          <Phone className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-black uppercase tracking-tight">AI Voice</h1>
            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest border-amber-500/40 text-amber-500 bg-amber-500/10">
              <Plug className="w-3 h-3 mr-1" />
              Awaiting API Connection
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Lightweight intake + follow-up layer. Captures inbound caller info and sends templated outbound messages.
            Not a chatbot — no deep reasoning required.
          </p>
        </div>
      </div>

      {/* Integration socket notice */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">
        <CircleDot className="w-4 h-4 text-amber-500 shrink-0" />
        <span>
          This module is an <span className="font-semibold text-foreground">integration socket</span> — 
          the UI and logic structure are wired and ready. External telephony and AI APIs connect here.
        </span>
      </div>

      {/* Function A — Inbound */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <PhoneIncoming className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Function A</p>
              <h2 className="text-sm font-bold">Inbound Call Handling</h2>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Capture Fields</p>
            <ul className="space-y-1.5">
              {INBOUND_FIELDS.map((field) => (
                <li key={field} className="flex items-center gap-2 text-sm">
                  <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                  {field}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Immediate Response</p>
            <div className="px-4 py-3 rounded-lg bg-muted/50 border border-border font-mono text-sm text-foreground">
              {INBOUND_RESPONSE}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowRight className="w-3 h-3 text-primary" />
            Structured payload forwarded to central intake hub
          </div>
        </CardContent>
      </Card>

      {/* Function B — Outbound */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <PhoneOutgoing className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Function B</p>
              <h2 className="text-sm font-bold">Outbound Follow-Up Messages</h2>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Templated messages only — no complex AI reasoning. Triggers: missed calls, missed appointments, rescheduling.
          </p>
          <div className="space-y-2">
            {OUTBOUND_TEMPLATES.map((t) => (
              <div key={t.trigger} className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t.trigger}</span>
                </div>
                <p className="text-sm text-foreground font-mono leading-relaxed">
                  "{t.message}"
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
