export type ToolState =
  | "intake"
  | "analyzing"
  | "analysisReady"
  | "analysisStopped"
  | "implementing"
  | "implementationReady"
  | "implementationSuccess"
  | "error";

export type SourceKind = "figma" | "ticket" | "component" | "internal-doc";

export type SourceEntry = {
  id: string;
  kind: SourceKind;
  value: string;
  context: string;
  componentId?: string;
  ticketKey?: string;
  taskFolder?: string;
};

export type AnalysisTask = {
  id: string;
  label: string;
  description?: string;
  active: boolean;
};

export type ImplementationTaskStatus = "to-do" | "doing" | "done";

export type ImplementationTask = {
  id: string;
  title: string;
  status: ImplementationTaskStatus;
};

export type ChangeIntentType = "style-rule" | "behavior-rule" | "layout-rule" | "content-rule" | "unknown";

export type ChangeIntent = {
  targetComponent: string;
  changeType: ChangeIntentType;
  stateCondition: string;
  codeTargets: string[];
  proposedRule: string;
  confidence: number;
  assumptions: string[];
  followUpQuestions: string[];
};

export type AnalysisOutput = {
  summary: string;
  taskAnalysis: string;
  tasks: AnalysisTask[];
  needMoreContext: string | null;
  changeIntent: ChangeIntent;
  detailedNotes: string;
  raw: string;
};

export type StreamItem = {
  id: string;
  kind: "thinking" | "assistant" | "tool" | "status" | "error";
  text: string;
};

export type PreviewTarget = {
  id: string;
  label: string;
  reason: string;
};
