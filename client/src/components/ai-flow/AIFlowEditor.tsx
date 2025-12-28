import { useCallback, useState, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  Panel,
  MarkerType,
  NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Save,
  Trash2,
  MessageSquare,
  Bot,
  Phone,
  GitBranch,
  UserPlus,
  Calendar,
  Mail,
  FileText,
  Zap,
  Settings,
  Globe,
} from "lucide-react";

import TriggerNode from "./nodes/TriggerNode";
import ConditionNode from "./nodes/ConditionNode";
import ActionNode from "./nodes/ActionNode";
import ResponseNode from "./nodes/ResponseNode";

export interface FlowNodeData {
  label: string;
  type: "trigger" | "condition" | "action" | "response";
  config?: Record<string, unknown>;
  icon?: string;
  [key: string]: unknown;
}

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
  response: ResponseNode,
};

const nodeCategories = [
  {
    name: "Triggers",
    icon: Zap,
    items: [
      { type: "trigger", label: "Widget Chat", icon: "globe", config: { channel: "widget" } },
      { type: "trigger", label: "Internal Chat", icon: "bot", config: { channel: "crm_chat" } },
      { type: "trigger", label: "Voice Call", icon: "phone", config: { channel: "voice" } },
      { type: "trigger", label: "GPT Action", icon: "settings", config: { channel: "gpt_actions" } },
    ],
  },
  {
    name: "Conditions",
    icon: GitBranch,
    items: [
      { type: "condition", label: "Check Contact Exists", icon: "user", config: { check: "contact_exists" } },
      { type: "condition", label: "Check Mode", icon: "settings", config: { check: "mode" } },
      { type: "condition", label: "Check Intent", icon: "message", config: { check: "intent" } },
      { type: "condition", label: "Business Hours", icon: "clock", config: { check: "business_hours" } },
    ],
  },
  {
    name: "Actions",
    icon: Zap,
    items: [
      { type: "action", label: "Create Contact", icon: "userPlus", config: { action: "create_contact" } },
      { type: "action", label: "Create Job", icon: "briefcase", config: { action: "create_job" } },
      { type: "action", label: "Schedule Appointment", icon: "calendar", config: { action: "schedule_appointment" } },
      { type: "action", label: "Send Email", icon: "mail", config: { action: "send_email" } },
      { type: "action", label: "Create Estimate", icon: "fileText", config: { action: "create_estimate" } },
      { type: "action", label: "Update Pipeline", icon: "pipeline", config: { action: "update_pipeline" } },
    ],
  },
  {
    name: "Responses",
    icon: MessageSquare,
    items: [
      { type: "response", label: "AI Response", icon: "bot", config: { responseType: "ai_generated" } },
      { type: "response", label: "Template Response", icon: "fileText", config: { responseType: "template" } },
      { type: "response", label: "Handoff to Human", icon: "user", config: { responseType: "handoff" } },
    ],
  },
];

interface AIFlowEditorProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onSave?: (nodes: Node[], edges: Edge[]) => void;
  isSaving?: boolean;
}

export default function AIFlowEditor({ initialNodes = [], initialEdges = [], onSave, isSaving }: AIFlowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const addNode = useCallback(
    (nodeType: string, label: string, icon: string, config: Record<string, unknown>) => {
      const newNode: Node = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position: { x: 250, y: nodes.length * 100 + 50 },
        data: { label, type: nodeType, icon, config },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes.length, setNodes]
  );

  const deleteSelectedNode = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
      setSelectedNode(null);
    }
  }, [selectedNode, setNodes, setEdges]);

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(nodes, edges);
    }
  }, [nodes, edges, onSave]);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  const selectedNodeData = selectedNode?.data as FlowNodeData | undefined;

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      <Card className="w-64 flex-shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Node Library
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-18rem)]">
            <div className="p-3 space-y-4">
              {nodeCategories.map((category) => (
                <div key={category.name}>
                  <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <category.icon className="w-3 h-3" />
                    {category.name}
                  </div>
                  <div className="space-y-1">
                    {category.items.map((item) => (
                      <Button
                        key={item.label}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs"
                        onClick={() => addNode(item.type, item.label, item.icon, item.config)}
                        data-testid={`node-${item.type}-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <NodeIcon icon={item.icon} className="w-3 h-3 mr-2" />
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="flex-1 border rounded-lg overflow-hidden bg-muted/30">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          proOptions={proOptions}
          fitView
          className="bg-background"
        >
          <Background gap={16} size={1} />
          <Controls />
          <MiniMap 
            nodeStrokeWidth={3}
            className="bg-background border rounded-md"
          />
          <Panel position="top-right" className="flex gap-2">
            {selectedNode && (
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSelectedNode}
                data-testid="button-delete-node"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={isSaving}
              data-testid="button-save-flow"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Flow"}
            </Button>
          </Panel>
        </ReactFlow>
      </div>

      {selectedNode && selectedNodeData && (
        <Card className="w-72 flex-shrink-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Node Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Node Type</p>
              <Badge variant="secondary">{selectedNodeData.type}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Label</p>
              <p className="text-sm font-medium">{selectedNodeData.label}</p>
            </div>
            {selectedNodeData.config && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Configuration</p>
                <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-40">
                  {JSON.stringify(selectedNodeData.config, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NodeIcon({ icon, className }: { icon: string; className?: string }) {
  const icons: Record<string, typeof Bot> = {
    globe: Globe,
    bot: Bot,
    phone: Phone,
    settings: Settings,
    user: UserPlus,
    userPlus: UserPlus,
    message: MessageSquare,
    clock: Calendar,
    briefcase: FileText,
    calendar: Calendar,
    mail: Mail,
    fileText: FileText,
    pipeline: GitBranch,
  };
  const Icon = icons[icon] || Bot;
  return <Icon className={className} />;
}
