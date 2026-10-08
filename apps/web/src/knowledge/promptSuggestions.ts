import {
  ChartColumn,
  ChartLine,
  FileText,
  GitCompareArrows,
  History,
  ListOrdered,
  MessagesSquare,
  Route,
  SearchCheck,
  Target,
  TrendingDown,
  UserRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type KnowledgeIntent = "ask" | "plan" | "analyze";

/**
 * A starter under the prompt box — six per mode, so they fit two rows at the
 * prompt box's width. A short `label` (five or six words at most) that pre-fills the box with the fuller `prompt`. `[brackets]` mark the
 * parts the user is expected to replace. `icon` is either a source id — the
 * tool the answer would mostly come from, shown with its logo — or a generic
 * icon for what the prompt is about.
 */
export type PromptSuggestion = {
  label: string;
  prompt: string;
  icon: { source: string } | LucideIcon;
};

export const PROMPT_SUGGESTIONS: Record<KnowledgeIntent, PromptSuggestion[]> = {
  ask: [
    {
      label: "Explain how a feature works",
      prompt: "Explain how [feature] works today — the business rules behind it, known edge cases, and the decisions that shaped it.",
      icon: Workflow,
    },
    {
      label: "Find past decisions on a topic",
      prompt: "What decisions have we made about [topic], when, and why? Link the tickets, docs or meeting notes behind each one.",
      icon: History,
    },
    {
      label: "Summarize recent customer feedback",
      prompt: "Summarize what customers have said about [feature or area] in the last 3 months. Group it into themes and include representative quotes.",
      icon: MessagesSquare,
    },
    {
      label: "Check what's planned in Jira",
      prompt: "What's in progress or planned for [area] in Jira? Group the tickets by epic and flag anything blocked.",
      icon: { source: "jira" },
    },
    {
      label: "Review the latest Figma designs",
      prompt: "Walk me through the latest Figma designs for [feature]. What changed from what's live today, and what's still open?",
      icon: { source: "figma" },
    },
    {
      label: "Look up a key metric",
      prompt: "What's the current [metric] for [feature or flow], and how has it trended over the last 6 months?",
      icon: ChartLine,
    },
  ],
  plan: [
    {
      label: "Draft an initiative brief",
      prompt: "Draft an initiative brief for [problem or opportunity]: the problem, who it affects, supporting evidence, success metrics and open questions.",
      icon: FileText,
    },
    {
      label: "Build a user persona",
      prompt: "Build a persona for [user segment] from our research, support tickets and analytics: goals, pain points, behaviours and representative quotes.",
      icon: UserRound,
    },
    {
      label: "Rank top customer pain points",
      prompt: "What are the top customer pain points in [area]? Rank them by how often they come up and their business impact, with evidence for each.",
      icon: ListOrdered,
    },
    {
      label: "Gather evidence for an idea",
      prompt: "What evidence do we have for and against building [idea]? Pull from research, feedback, analytics and past decisions.",
      icon: SearchCheck,
    },
    {
      label: "Break it into Jira epics",
      prompt: "Break [initiative] into Jira epics and stories with acceptance criteria, ordered so we can ship value early.",
      icon: { source: "jira" },
    },
    {
      label: "Define success metrics",
      prompt: "Define success metrics for [initiative]: a primary metric, guardrail metrics, the current baseline and a realistic target.",
      icon: Target,
    },
  ],
  analyze: [
    {
      label: "Break down a funnel by step",
      prompt: "Show conversion for each step of the [flow] funnel over the last 90 days, and highlight the steps with the biggest drop-off.",
      icon: ChartColumn,
    },
    {
      label: "Find where users drop off",
      prompt: "Where do users abandon [flow]? Combine analytics, session recordings and feedback to explain why.",
      icon: TrendingDown,
    },
    {
      label: "Compare before and after release",
      prompt: "Compare [metric] for [flow] in the 30 days before and after [release]. Did the change have the effect we expected?",
      icon: GitCompareArrows,
    },
    {
      label: "Audit a flow against Figma",
      prompt: "Compare the Figma designs for [flow] with how it behaves live. List gaps, inconsistencies and UX issues, step by step.",
      icon: { source: "figma" },
    },
    {
      label: "Map the current user journey",
      prompt: "Map the current user journey for [flow], step by step: what users see, what they do, and where they get stuck.",
      icon: Route,
    },
    {
      label: "Link flow issues to tickets",
      prompt: "Which open Jira tickets relate to problems in [flow]? Match each one to the step where users struggle.",
      icon: { source: "jira" },
    },
  ],
};
