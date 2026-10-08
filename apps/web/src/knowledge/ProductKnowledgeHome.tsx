import { ArrowRight, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProviderPicker } from "../accelerator/ProviderPicker";
import { fetchAgentProviders, type AgentProvider } from "../agentSseClient";
import { resolveSelectedProvider, saveSelectedProvider } from "../aiProviders/providerSelection";
import { AiAttachment } from "../components/custom/AiAttachment";
import { DsIconButton } from "../components/ds/IconButton";
import { DsTypography } from "../components/ds/DsTypography";
import { openSettings } from "../navigationEvents";
import { SourceMark } from "./SourceMark";
import { PROMPT_SUGGESTIONS, type KnowledgeIntent, type PromptSuggestion } from "./promptSuggestions";
import { SourcesPopover } from "./SourcesPopover";
import { sourceById } from "./sources";
// Shared with the DS Accelerator home so both products open on the same
// canvas, tab track and composer — one product family, not two apps.
import "../accelerator/DsAcceleratorTool.css";
import "../accelerator/ModeTabs.css";
import "../accelerator/SlotIntake.css";
import "./ProductKnowledgeHome.css";

const INTENTS: Record<KnowledgeIntent, { label: string; placeholder: string }> = {
  ask: {
    label: "Ask",
    placeholder: "Ask anything about your product — business rules, past decisions, how a feature works today…",
  },
  plan: {
    label: "Plan Initiative",
    placeholder: "Describe the problem or opportunity — we'll gather the evidence into a brief you can take to stakeholders…",
  },
  analyze: {
    label: "Analyze Flow",
    placeholder: "Name a view, flow or funnel to analyse — e.g. sign-up, checkout, first-week activation…",
  },
};

const INTENT_ORDER: KnowledgeIntent[] = ["ask", "plan", "analyze"];

/** The sources most questions start from, one click away inside the prompt
 *  box — everything else (including file upload) is behind the "+" button. */
const QUICK_SOURCE_IDS = ["jira", "figma"];

type Attachment =
  | { kind: "source"; id: string }
  | { kind: "file"; id: string; name: string };

const PROVIDER_SCOPE = "knowledge-base";

/**
 * Home screen for the Product Knowledge Base. UI only for now: there is no
 * knowledge backend yet, so sending a question explains that instead of
 * pretending to answer.
 */
export function ProductKnowledgeHome() {
  const [intent, setIntent] = useState<KnowledgeIntent>("ask");
  const [question, setQuestion] = useState("");
  const [notice, setNotice] = useState(false);
  const [providers, setProviders] = useState<AgentProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const config = INTENTS[intent];
  const attachedSourceIds = new Set(attachments.filter((a) => a.kind === "source").map((a) => a.id));

  const toggleSource = (id: string) => {
    setAttachments((current) =>
      current.some((a) => a.kind === "source" && a.id === id)
        ? current.filter((a) => !(a.kind === "source" && a.id === id))
        : [...current, { kind: "source", id }],
    );
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const added = Array.from(files).map((file) => ({
      kind: "file" as const,
      id: `${file.name}:${file.size}:${file.lastModified}`,
      name: file.name,
    }));
    setAttachments((current) => [...current, ...added.filter((f) => !current.some((a) => a.id === f.id))]);
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchAgentProviders({ signal: controller.signal })
      .then((list) => {
        setProviders(list);
        setSelectedProvider(resolveSelectedProvider(PROVIDER_SCOPE, list));
      })
      .catch(() => {
        // Agent service unreachable — the composer simply shows no engine picker.
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="accelerator knowledgeHome" aria-label="Product Knowledge Base">
      <section className="accelerator__window accelerator__window--intake" aria-labelledby="knowledge-title">
        <section className="accelerator__startScreen">
          <div className="accelerator__startContent knowledgeHome__content">
            <div className="accelerator__startHeader">
              <DsTypography as="h1" id="knowledge-title" variant="heading-2" className="accelerator__startQuestion">
                What do you want to know about your product?
              </DsTypography>
            </div>

            <div className="knowledgeHome__workspace">
              <div className="modeTabs" role="tablist" aria-label="What you're doing">
                {INTENT_ORDER.map((id) => {
                  const isSelected = id === intent;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      className={`modeTabs__tab${isSelected ? " modeTabs__tab--selected" : ""}`}
                      onClick={() => {
                        setIntent(id);
                        setNotice(false);
                      }}
                    >
                      <DsTypography as="span" variant="paragraph-small-medium" className="modeTabs__title">
                        {INTENTS[id].label}
                      </DsTypography>
                    </button>
                  );
                })}
              </div>

              <div className="knowledgeHome__composerGroup">
                <form
                  className="slotIntake__composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (question.trim()) setNotice(true);
                  }}
                >
                  {attachments.length > 0 ? (
                    <div className="slotIntake__composerAttachments">
                      {attachments.map((attachment) => {
                        const remove = () => setAttachments((current) => current.filter((a) => a.id !== attachment.id));
                        if (attachment.kind === "file") {
                          return (
                            <AiAttachment
                              key={attachment.id}
                              size="tag"
                              kind="comment"
                              value={attachment.name}
                              subtitle="File"
                              title={attachment.name}
                              onRemove={remove}
                            />
                          );
                        }
                        const source = sourceById(attachment.id);
                        return (
                          <AiAttachment
                            key={attachment.id}
                            size="tag"
                            value={source.label}
                            subtitle="Source"
                            icon={<SourceMark source={source} size={16} />}
                            onRemove={remove}
                          />
                        );
                      })}
                    </div>
                  ) : null}
                  <textarea
                    ref={promptRef}
                    className="slotIntake__composerTextarea"
                    value={question}
                    onChange={(event) => {
                      setQuestion(event.target.value);
                      setNotice(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder={config.placeholder}
                    aria-label={config.label}
                    rows={3}
                  />
                  <div className="slotIntake__composerToolbar">
                    <div className="slotIntake__composerAttachButtons">
                      <SourcesPopover
                        selectedIds={attachedSourceIds}
                        onToggle={toggleSource}
                        onUpload={() => fileInputRef.current?.click()}
                      />
                      {QUICK_SOURCE_IDS.filter((id) => !attachedSourceIds.has(id))
                        .map(sourceById)
                        .map((source) => (
                          <button
                            key={source.id}
                            type="button"
                            className="slotIntake__attachChip"
                            onClick={() => toggleSource(source.id)}
                          >
                            <SourceMark source={source} size={13} />
                            {source.label}
                          </button>
                        ))}
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        hidden
                        onChange={(event) => {
                          addFiles(event.target.files);
                          event.target.value = "";
                        }}
                      />
                    </div>
                    <div className="slotIntake__composerActions">
                      {providers.length > 0 ? (
                        <ProviderPicker
                          providers={providers}
                          selectedProviderId={selectedProvider}
                          onSelect={(id) => {
                            setSelectedProvider(id);
                            saveSelectedProvider(PROVIDER_SCOPE, id);
                          }}
                          onManage={() => openSettings("ai-models")}
                        />
                      ) : null}
                      <DsIconButton variant="primary" size="small" type="submit" aria-label="Ask" disabled={!question.trim()}>
                        <ArrowRight size={16} aria-hidden />
                      </DsIconButton>
                    </div>
                  </div>
                </form>
                {notice ? (
                  <p className="knowledgeHome__notice" role="status">
                    <Info size={14} aria-hidden />
                    <DsTypography as="span" variant="paragraph-small">
                      Answering isn't connected yet — this home screen is a preview of the Product Knowledge Base.
                    </DsTypography>
                  </p>
                ) : null}
              </div>

              <section className="knowledgeHome__starters" aria-labelledby="knowledge-starters-title">
                <DsTypography as="h2" id="knowledge-starters-title" variant="heading-5" className="knowledgeHome__startersTitle">
                  Not sure where to start?
                </DsTypography>
                <div className="knowledgeHome__suggestions">
                  {PROMPT_SUGGESTIONS[intent].map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      className="knowledgeHome__suggestion"
                      onClick={() => {
                        setQuestion(suggestion.prompt);
                        setNotice(false);
                        promptRef.current?.focus();
                      }}
                    >
                      <SuggestionIcon icon={suggestion.icon} />
                      <DsTypography as="span" variant="paragraph-small-medium">
                        {suggestion.label}
                      </DsTypography>
                    </button>
                  ))}
                </div>
              </section>

            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function SuggestionIcon({ icon }: { icon: PromptSuggestion["icon"] }) {
  if ("source" in icon) return <SourceMark source={sourceById(icon.source)} size={15} />;
  const Icon = icon;
  return <Icon size={15} strokeWidth={1.8} aria-hidden />;
}
