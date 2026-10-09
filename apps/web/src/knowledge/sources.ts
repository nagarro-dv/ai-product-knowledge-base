import { Upload, type LucideIcon } from "lucide-react";
// Real brand logos from thesvg (one import per logo, so only these get
// bundled), plus a few supplied separately in ./logos for brands thesvg
// lacks or only has as an unreadable wordmark.
import appStore from "thesvg/app-store";
import asana from "thesvg/asana";
import azureDevops from "thesvg/azure-azure-devops";
import clickup from "thesvg/clickup";
import confluence from "thesvg/confluence";
import dovetail from "thesvg/dovetail";
import figma from "thesvg/figma";
import fullstory from "thesvg/fullstory";
import github from "thesvg/github";
import gitlab from "thesvg/gitlab";
import google from "thesvg/google";
import googleAnalytics from "thesvg/google-analytics";
import granola from "thesvg/granola";
import hotjar from "thesvg/hotjar";
import hubspot from "thesvg/hubspot";
import intercom from "thesvg/intercom";
import jira from "thesvg/jira";
import linear from "thesvg/linear";
import loom from "thesvg/loom";
import maze from "thesvg/maze";
import microsoftOffice from "thesvg/microsoft-office";
import microsoftTeams from "thesvg/microsoft-teams";
import miro from "thesvg/miro";
import mixpanel from "thesvg/mixpanel";
import monday from "thesvg/monday";
import notion from "thesvg/notion";
import qualtrics from "thesvg/qualtrics";
import salesforce from "thesvg/salesforce";
import slack from "thesvg/slack";
import snowflake from "thesvg/snowflake";
import storybook from "thesvg/storybook";
import stripe from "thesvg/stripe";
import surveymonkey from "thesvg/surveymonkey";
import zendesk from "thesvg/zendesk";
import zoom from "thesvg/zoom";
import ahaLogo from "./logos/aha.svg";
import airtableLogo from "./logos/airtable.svg";
import amplitudeLogo from "./logos/amplitude.svg";
import dropboxLogo from "./logos/dropbox.svg";
import pendoLogo from "./logos/pendo.svg";
import powerBiLogo from "./logos/power-bi.svg";
import productboardLogo from "./logos/productboard.svg";
import typeformLogo from "./logos/typeform.svg";
import userTestingLogo from "./logos/usertesting.svg";

type BrandIcon = { svg: string; hex: string; variants: Record<string, string> };

/**
 * A logo as a self-contained data URI for an <img>. Rendering the SVG markup
 * inline instead would leak some logos' embedded <style> rules (generic
 * class names like `.st0`) onto the rest of the page.
 *
 * `mono` is for brands whose full-colour logo here is a wide wordmark: their
 * icon-only mark exists only in one colour, so it's tinted with the brand's
 * own hex.
 */
function logo(icon: BrandIcon, variant?: "mono"): string {
  let svg = variant ? (icon.variants[variant] ?? icon.svg) : icon.svg;
  if (variant) {
    const color = `#${icon.hex}`;
    svg = svg.replace(/currentColor/g, color);
    svg = svg.replace(/<svg\b([^>]*)>/, (tag, attrs: string) => (/\sfill=/.test(attrs) ? tag : `<svg fill="${color}"${attrs}>`));
  }
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** `mark` is a brand logo (an image URL) when one exists, otherwise a generic icon. */
export type KnowledgeSource = { id: string; label: string; mark: string | LucideIcon };
export type KnowledgeSourceGroup = { label: string; sources: KnowledgeSource[] };

function source(label: string, mark: string | LucideIcon): KnowledgeSource {
  return { id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label, mark };
}

/** Marks the "Upload files" entry — picking it opens the file dialog instead of attaching a tool. */
export const UPLOAD_SOURCE_ID = "upload-files";

/** Every tool a client can bring product knowledge in from, grouped by the kind of knowledge it holds. */
export const SOURCE_GROUPS: readonly KnowledgeSourceGroup[] = [
  {
    label: "Docs & files",
    sources: [
      source("Upload files", Upload),
      // No Google Workspace mark in thesvg — the Google "G" stands in.
      source("Google Workspace", logo(google)),
      // No Microsoft 365 mark in thesvg — the Office icon stands in.
      source("Microsoft 365", logo(microsoftOffice)),
      source("Notion", logo(notion)),
      // thesvg's Confluence mark is near-black navy; use Confluence's blue.
      source("Confluence", logo({ ...confluence, svg: confluence.svg.replace(/#172B4D/gi, "#006AE4") })),
      source("Dropbox", dropboxLogo),
      // thesvg's Airtable mark has the wrong colours; this is the official one.
      source("Airtable", airtableLogo),
    ],
  },
  {
    label: "Conversations & meetings",
    sources: [
      source("Slack", logo(slack)),
      source("Microsoft Teams", logo(microsoftTeams)),
      source("Zoom", logo(zoom)),
      source("Loom", logo(loom)),
      // thesvg's Granola mark is near-black; use Granola's green.
      source("Granola", logo({ ...granola, svg: granola.svg.replace(/#1E1E1E/gi, "#AEC327") })),
    ],
  },
  {
    label: "Work tracking & roadmaps",
    sources: [
      source("Jira", logo(jira)),
      source("Azure DevOps", logo(azureDevops)),
      source("Linear", logo(linear)),
      source("Asana", logo(asana)),
      source("Monday", logo(monday, "mono")),
      source("ClickUp", logo(clickup)),
      source("GitHub", logo(github)),
      source("GitLab", logo(gitlab)),
      source("Productboard", productboardLogo),
      source("Aha!", ahaLogo),
    ],
  },
  {
    label: "Design & research",
    sources: [
      source("Figma", logo(figma)),
      source("Storybook", logo(storybook)),
      source("Miro", logo(miro)),
      source("Dovetail", logo(dovetail)),
      source("Maze", logo(maze)),
      source("UserTesting", userTestingLogo),
    ],
  },
  {
    label: "Analytics",
    sources: [
      source("Amplitude", amplitudeLogo),
      source("Mixpanel", logo(mixpanel)),
      source("Google Analytics", logo(googleAnalytics)),
      source("Pendo", pendoLogo),
      source("Hotjar", logo(hotjar)),
      source("FullStory", logo(fullstory)),
      source("Power BI", powerBiLogo),
      source("Snowflake", logo(snowflake)),
    ],
  },
  {
    label: "Customer voice",
    sources: [
      // thesvg's Intercom mark is a pale cyan that disappears on white; use Intercom's product blue.
      source("Intercom", logo({ ...intercom, svg: intercom.svg.replace(/#6AFDEF/gi, "#336BFE") })),
      source("Zendesk", logo(zendesk)),
      source("Typeform", typeformLogo),
      source("SurveyMonkey", logo(surveymonkey)),
      source("Qualtrics", logo(qualtrics)),
      source("App store reviews", logo(appStore)),
    ],
  },
  {
    label: "Revenue & CRM",
    sources: [source("Salesforce", logo(salesforce)), source("HubSpot", logo(hubspot)), source("Stripe", logo(stripe, "mono"))],
  },
];

const ALL_SOURCES = SOURCE_GROUPS.flatMap((group) => group.sources);

export function sourceById(id: string): KnowledgeSource {
  const found = ALL_SOURCES.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown knowledge source: ${id}`);
  return found;
}
