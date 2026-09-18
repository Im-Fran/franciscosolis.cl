/** The shapes `apps/support` answers with. Snake_case, because that is what crosses the wire. */

export type TicketStatus = "new" | "open" | "pending" | "on_hold" | "solved" | "closed" | "spam";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type MessageKind = "reply" | "note";
export type SupportLocale = "en" | "es";

export type SupportStatus = {
  message: string;
  ticket_statuses: TicketStatus[];
  ticket_priorities: TicketPriority[];
  ticket_sources: string[];
  message_kinds: MessageKind[];
  timeline_events: string[];
  locales: SupportLocale[];
  default_locale: SupportLocale;
};

export type SupportAgent = {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  roles: string[];
  permissions: string[];
  can_administer: boolean;
};

export type Label = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  position?: number;
};

export type ParticipantTag = "guest" | "interest";

export type Participant = {
  id: string;
  email: string;
  name: string | null;
  role: "requester" | "agent" | "cc";
  /** Internal-only, agent-set classification. Absent from the requester's own view of the ticket. */
  tag?: ParticipantTag | null;
  notify_email: boolean;
  created_at: string | null;
};

export type TicketSummary = {
  id: string;
  reference: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  requester_email: string;
  assignee_email: string | null;
  updated_at: string | null;
};

export type Ticket = TicketSummary & {
  source: string;
  locale: SupportLocale;
  requester_name: string | null;
  ai_summary: string | null;
  first_response_at: string | null;
  solved_at: string | null;
  closed_at: string | null;
  created_at: string | null;
  labels: Label[];
  participants: Participant[];
};

/** What a requester sees: no assignee, no triage notes, no internal timestamps. */
export type RequesterTicket = {
  reference: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  locale: SupportLocale;
  requester_email: string;
  requester_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  solved_at: string | null;
  closed_at: string | null;
  access_level: "agent" | "requester";
  labels: Label[];
  participants: Participant[];
};

export type TimelineMessage = {
  type: "message";
  id: string;
  seq: number;
  kind?: MessageKind;
  author_type: "requester" | "agent" | "system";
  author_name: string | null;
  author_email: string | null;
  body: string;
  source: string;
  attachments: {filename: string; mime_type: string; size: number}[];
  created_at: string | null;
};

export type TimelineEvent = {
  type: "event";
  id: string;
  event: string;
  actor_type: string;
  actor_email: string | null;
  metadata: Record<string, unknown>;
  created_at: string | null;
};

export type TimelineEntry = TimelineMessage | TimelineEvent;

export type HelpCategory = {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  locale: SupportLocale;
  available_locales: SupportLocale[];
  articles?: HelpArticleSummary[];
};

export type HelpArticleSummary = {
  slug: string;
  category_id: string | null;
  title: string;
  summary: string | null;
  tags: string[];
  featured: boolean;
  helpful_yes: number;
  helpful_no: number;
  locale: SupportLocale;
  available_locales: SupportLocale[];
  published_at: string | null;
  updated_at: string | null;
};

export type HelpArticle = HelpArticleSummary & {body: string | null};

export type SearchHit = {
  slug: string;
  title: string;
  /** Carries `<mark>` around the matched words. Sanitise before rendering — see `help-snippet.tsx`. */
  snippet: string;
  locale: SupportLocale;
  score: number;
};

export type SearchResults = {
  hits: SearchHit[];
  fallbackLocale: boolean;
};

export type AdminArticle = {
  id: string;
  slug: string;
  category_id: string | null;
  title: string;
  summary: string | null;
  body: string | null;
  status: "draft" | "published" | "archived";
  position: number;
  featured: boolean;
  tags: string[];
  translations: Record<string, Record<string, string>>;
  helpful_yes: number;
  helpful_no: number;
  published_at: string | null;
  updated_at: string | null;
};

export type AdminCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  status: "draft" | "published" | "archived";
  position: number;
  translations: Record<string, Record<string, string>>;
};

export type AssistAnswer = {
  answer: string | null;
  insufficient_context: boolean;
  confidence: "high" | "medium" | "low" | null;
  sources: {slug: string; title: string; locale: SupportLocale; score: number}[];
  model: string;
};

export type NewTicket = {
  subject: string;
  body: string;
  email: string;
  name?: string;
  locale?: SupportLocale;
  cc?: string[];
  /** The honeypot. Left empty by anything with a person behind it. */
  website?: string;
};

export type CreatedTicket = {
  reference: string;
  status: TicketStatus;
  /** The only copy of the ticket link that ever exists. Shown once, and emailed. */
  url: string;
};
