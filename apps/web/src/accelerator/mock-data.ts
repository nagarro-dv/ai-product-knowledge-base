import type { AnalysisOutput } from "./types";
import { getSolutionsForTaskFolder, solutionsToAnalysisTasks } from "./task-docs";

export const MOCK_TASK_FOLDER = "ds-042-credit-score-clarity";

export function buildMockAnalysisOutput(): AnalysisOutput {
  const docs = getSolutionsForTaskFolder(MOCK_TASK_FOLDER);
  const tasks = solutionsToAnalysisTasks(docs);

  return {
    summary:
      "Users misread the Credit Score card: the large number draws attention but the status label and trend copy do not explain what to do next. The ticket asks for clearer hierarchy without breaking the token-driven layout.",
    taskAnalysis:
      "- Principle: lead with actionable insight, not raw score\n- Principle: preserve arc gauge semantics for power users\n- Principle: stay within --ds-* tokens and existing DsCreditScore API",
    tasks,
    needMoreContext: null,
    changeIntent: {
      targetComponent: "credit-score",
      changeType: "layout-rule",
      stateCondition: "Credit Score card on dashboard summary",
      codeTargets: [
        "apps/web/src/components/ds/CreditScore.tsx",
        "apps/web/src/components/ds/CreditScoreShowcase.tsx",
      ],
      proposedRule:
        "Reorder visual hierarchy so status and guidance read before or beside the numeric score, using existing typography and badge tokens.",
      confidence: 0.91,
      assumptions: ["Mock accelerator payload for layout testing only."],
      followUpQuestions: [],
    },
    detailedNotes: "Mock DS Accelerator output (no agent). Example ticket DS-042.",
    raw: "[mock]",
  };
}
