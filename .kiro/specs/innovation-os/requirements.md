# Requirements Document

## Introduction

InnovationOS is a production-ready, spec-driven, agentic AI platform that transforms raw ideas into validated startup plans. It acts as an AI innovation accelerator — guiding students, researchers, entrepreneurs, and founders from idea stage to launch stage through a coordinated pipeline of specialized AI agents. Users submit an idea and the platform automatically orchestrates analysis, competitor research, roadmap generation, funding discovery, mentor matching, and pitch preparation, culminating in a Startup Intelligence Report.

This platform is built using Kiro spec-driven development methodology. Kiro Steering Files loaded from `.kiro/steering/` define the platform's core principles — including student-first design, ethical AI usage, and actionable recommendations — and are automatically injected as agent context at runtime. Kiro Hooks, defined as JSON configuration files, drive automated agentic workflow orchestration by mapping lifecycle events to agent triggers without manual intervention.

This document covers all features: MVP-scoped features (Idea Submission, Validation Agent, Competitor Agent, Roadmap Agent, Feasibility Engine, Startup Intelligence Report, Steering Files, Hooks Configuration) and planned post-MVP features (Funding Agent, Mentor Agent, Pitch Agent, AI Advisor, Authentication).

---

## Glossary

- **InnovationOS**: The AI operating system platform described in this document.
- **Platform**: The InnovationOS web application, comprising frontend and backend services.
- **User**: Any person who interacts with InnovationOS — including students, researchers, founders, and innovators.
- **Idea**: A user-submitted concept that forms the basis of a Project Workspace.
- **Project_Workspace**: The persistent container that stores all data, agent outputs, and reports associated with a single Idea.
- **Validation_Agent**: The AI agent responsible for analyzing an Idea and generating structured validation scores and recommendations.
- **Competitor_Agent**: The AI agent responsible for generating competitor research, SWOT analysis, and market opportunity analysis for an Idea.
- **Roadmap_Agent**: The AI agent responsible for generating phased startup roadmaps with milestones, deliverables, and timelines.
- **Funding_Agent**: The AI agent responsible for recommending grants, accelerators, incubators, competitions, and funding programs (planned, post-MVP).
- **Mentor_Agent**: The AI agent responsible for recommending mentors matched to the Idea's domain, stage, and technology (planned, post-MVP).
- **Pitch_Agent**: The AI agent responsible for generating structured pitch decks and investor narratives (planned, post-MVP).
- **Feasibility_Engine**: The sub-system within the Platform that computes technical, market, and financial feasibility scores and a Launch Readiness Score.
- **AI_Advisor**: The contextual AI chat assistant that answers user questions about their project (planned, post-MVP).
- **Startup_Intelligence_Report**: The consolidated summary document generated after all active agents for a Project Workspace have completed their analysis.
- **Agent_Pipeline**: The ordered, partially-parallel execution sequence of agents triggered after Idea submission.
- **Innovation_Score**: A numeric score (0–100) reflecting the novelty and differentiation potential of the Idea.
- **Problem_Clarity_Score**: A numeric score (0–100) reflecting how well-defined the problem statement is.
- **Market_Demand_Score**: A numeric score (0–100) reflecting the size and urgency of the target market.
- **Technical_Feasibility_Score**: A numeric score (0–100) reflecting the estimated buildability of the Idea with current technology.
- **Launch_Readiness_Score**: A composite numeric score (0–100) indicating overall readiness to move toward a public launch.
- **SWOT_Analysis**: A structured assessment of Strengths, Weaknesses, Opportunities, and Threats relative to competitors.
- **Roadmap_Phase**: A named stage in the startup journey (Research, Validation, MVP, Testing, Launch, Growth).
- **Milestone**: A discrete, verifiable achievement within a Roadmap_Phase.
- **Deliverable**: A tangible output associated with a Milestone.
- **Agent_Status**: The execution state of an agent for a given Project_Workspace. Valid values: `pending`, `running`, `completed`, `failed`.
- **API**: The RESTful HTTP interface exposed by the Platform backend.
- **Database**: The Prisma-managed data store (SQLite in development, PostgreSQL-ready for production).
- **Frontend**: The Next.js + TypeScript + Tailwind CSS + ShadCN UI web application.
- **Backend**: The Node.js + Express.js API server.
- **Steering_File**: A Markdown document stored in `.kiro/steering/` that defines platform principles, agent behavior guidelines, and contextual rules. Steering_Files are automatically loaded as agent context at runtime.
- **Hook**: A JSON configuration file that maps a named lifecycle event to an automated agent trigger or platform action, enabling event-driven orchestration without manual intervention.
- **Agent_Hook**: A specific Hook that triggers an AI agent when a defined lifecycle event occurs within a Project_Workspace.
- **LLM**: Large Language Model — the underlying AI model (Google Gemini API or an OpenAI-compatible API) used by agents to generate analysis, recommendations, and content.
- **Server_Sent_Events**: A unidirectional HTTP streaming protocol (SSE) used to push real-time agent status updates from the Backend to the Frontend without requiring polling or a full WebSocket connection.

---

## Requirements

---

### Requirement 1: Idea Submission

**User Story:** As a User, I want to submit my idea with structured details, so that the Platform can create a dedicated workspace and begin automated analysis.

#### Acceptance Criteria

1. THE Platform SHALL provide an idea submission form that collects the following fields: project title (required, 5–120 characters), idea description (required, 50–2000 characters), problem statement (required, 20–1000 characters), target audience (required, 10–500 characters), industry (required, selected from a predefined list), and goals (required, 20–1000 characters).
2. WHEN a User submits the idea submission form with all required fields valid, THE Platform SHALL create a Project_Workspace containing the submitted Idea data and assign it a unique identifier.
3. WHEN the Platform creates a Project_Workspace, THE Platform SHALL set the initial Agent_Status for all agents to `pending`.
4. WHEN a User submits the idea submission form with one or more required fields missing or invalid, THE Platform SHALL display a descriptive inline validation error for each invalid field and SHALL NOT create a Project_Workspace.
5. WHEN a User submits the idea submission form with the project title shorter than 5 characters or longer than 120 characters, THE Platform SHALL display an error message indicating the character limit.
6. WHEN a User submits the idea submission form with the idea description shorter than 50 characters or longer than 2000 characters, THE Platform SHALL display an error message indicating the character limit.
7. WHEN a Project_Workspace is successfully created, THE Platform SHALL redirect the User to the Project_Workspace dashboard.
8. THE Platform SHALL persist Project_Workspace data in the Database immediately upon creation.
9. THE Platform SHALL allow a User to view a list of all Project_Workspaces they have submitted, ordered by creation date descending.
10. WHEN a User views a Project_Workspace list item, THE Platform SHALL display the project title, industry, creation date, and the overall Agent_Status summary.

---

### Requirement 2: Agent Pipeline Orchestration

**User Story:** As a User, I want analysis to start automatically after I submit an idea, so that I do not have to manually trigger each agent.

#### Acceptance Criteria

1. WHEN a Project_Workspace is created, THE Platform SHALL automatically trigger the Validation_Agent for that Project_Workspace.
2. WHEN the Validation_Agent for a Project_Workspace reaches Agent_Status `completed`, THE Platform SHALL automatically trigger the Competitor_Agent for that Project_Workspace.
3. WHEN the Competitor_Agent for a Project_Workspace reaches Agent_Status `completed`, THE Platform SHALL automatically trigger the Roadmap_Agent, the Funding_Agent (where Funding_Agent is enabled), and the Mentor_Agent (where Mentor_Agent is enabled) for that Project_Workspace in parallel.
4. WHEN all agents that were triggered for a Project_Workspace reach Agent_Status `completed`, THE Platform SHALL automatically generate the Startup_Intelligence_Report for that Project_Workspace.
5. WHILE any agent for a Project_Workspace is running, THE Platform SHALL display the Agent_Status as `running` for that agent in the Project_Workspace dashboard.
6. IF an agent for a Project_Workspace reaches Agent_Status `failed`, THEN THE Platform SHALL display the failure status and a descriptive error message to the User and SHALL NOT block the execution of subsequent independent agents.
7. WHEN an agent completes or fails, THE Platform SHALL update the Agent_Status in the Database before triggering any downstream agent.
8. THE Platform SHALL support re-running a failed agent for a Project_Workspace without creating a new Project_Workspace.

---

### Requirement 3: Validation Agent

**User Story:** As a User, I want my idea automatically analyzed across multiple dimensions with scores and explanations, so that I understand its strengths, weaknesses, and areas to improve.

#### Acceptance Criteria

1. WHEN the Validation_Agent is triggered for a Project_Workspace, THE Validation_Agent SHALL analyze the submitted Idea and generate the following scores, each as an integer between 0 and 100 inclusive: Innovation_Score, Problem_Clarity_Score, Market_Demand_Score, and Technical_Feasibility_Score.
2. THE Validation_Agent SHALL generate a written explanation of at least 50 words for each score, describing the factors that influenced the score.
3. THE Validation_Agent SHALL generate a list of at least 3 identified risks associated with the Idea, each risk including a title, a description, and a severity level of either High, Medium, or Low.
4. THE Validation_Agent SHALL generate a list of at least 3 actionable recommendations for improving the Idea, each recommendation including a title, a description, and an impact rank (1 being highest impact) relative to other recommendations in the same list.
5. WHEN the Validation_Agent completes analysis, THE Validation_Agent SHALL persist all scores, explanations, risks, and recommendations to the Database associated with the Project_Workspace.
6. WHEN the Validation_Agent completes analysis, THE Validation_Agent SHALL update the Agent_Status for Validation_Agent to `completed` in the Database.
7. IF the Validation_Agent fails to complete analysis due to an error, THEN THE Validation_Agent SHALL update the Agent_Status to `failed` and persist a descriptive error message to the Database.
8. THE Platform SHALL display all Validation_Agent outputs (scores, explanations, risks, recommendations) in the Project_Workspace dashboard under a dedicated Validation section.
9. THE Platform SHALL present each score with a visual indicator (such as a progress bar or radial gauge) alongside its numeric value.
10. WHEN a User views the Validation section, THE Platform SHALL display scores, explanations, risks (including severity level), and recommendations (ordered by impact rank) in a structured, readable layout.

---

### Requirement 4: Competitor Agent

**User Story:** As a User, I want a structured competitor analysis generated for my idea, so that I can understand the competitive landscape and identify opportunities.

#### Acceptance Criteria

1. WHEN the Competitor_Agent is triggered for a Project_Workspace, THE Competitor_Agent SHALL generate a list of at least 3 existing competitors or similar solutions relevant to the Idea, each entry including a name, a brief description, the primary competitive category (Direct, Indirect, or Substitute), and a URL or reference link where available.
2. THE Competitor_Agent SHALL generate a SWOT_Analysis for the Idea relative to the identified competitors, containing at least 2 items in each of the four quadrants: Strengths, Weaknesses, Opportunities, and Threats.
3. THE Competitor_Agent SHALL generate a list of at least 2 identified market opportunities that the Idea could exploit given the competitive landscape.
4. THE Competitor_Agent SHALL generate a list of at least 2 competitive advantages that the Idea possesses relative to the identified competitors.
5. WHEN the Competitor_Agent completes analysis, THE Competitor_Agent SHALL persist all competitors, SWOT_Analysis, market opportunities, and competitive advantages to the Database associated with the Project_Workspace.
6. WHEN the Competitor_Agent completes analysis, THE Competitor_Agent SHALL update the Agent_Status for Competitor_Agent to `completed` in the Database.
7. IF the Competitor_Agent fails to complete analysis due to an error, THEN THE Competitor_Agent SHALL update the Agent_Status to `failed` and persist a descriptive error message to the Database.
8. THE Platform SHALL display all Competitor_Agent outputs in the Project_Workspace dashboard under a dedicated Competitor Analysis section.

---

### Requirement 5: Roadmap Agent

**User Story:** As a User, I want an automatically generated startup roadmap tailored to my idea, so that I have a clear, phased execution plan from research to growth.

#### Acceptance Criteria

1. WHEN the Roadmap_Agent is triggered for a Project_Workspace, THE Roadmap_Agent SHALL generate a roadmap containing all six Roadmap_Phases in order: Research, Validation, MVP, Testing, Launch, Growth.
2. THE Roadmap_Agent SHALL generate at least 2 Milestones for each Roadmap_Phase, each Milestone containing a title, a description, a priority level (High, Medium, or Low), and an estimated duration expressed in weeks.
3. THE Roadmap_Agent SHALL generate at least 1 Deliverable for each Milestone, each Deliverable containing a title and a description.
4. THE Roadmap_Agent SHALL generate an estimated start offset (in weeks from project start) and an estimated end offset (in weeks from project start) for each Roadmap_Phase.
5. WHEN the Roadmap_Agent completes generation, THE Roadmap_Agent SHALL persist all Roadmap_Phases, Milestones, Deliverables, and timeline data to the Database associated with the Project_Workspace.
6. WHEN the Roadmap_Agent completes generation, THE Roadmap_Agent SHALL update the Agent_Status for Roadmap_Agent to `completed` in the Database.
7. IF the Roadmap_Agent fails to complete generation due to an error, THEN THE Roadmap_Agent SHALL update the Agent_Status to `failed` and persist a descriptive error message to the Database.
8. THE Platform SHALL display the generated roadmap in a visual, phased timeline layout in the Project_Workspace dashboard under a dedicated Roadmap section.
9. WHEN a User views a Roadmap_Phase, THE Platform SHALL display the phase name, estimated timeline, all associated Milestones, and each Milestone's Deliverables.

---

### Requirement 6: Feasibility Engine

**User Story:** As a User, I want a multi-dimensional feasibility assessment of my idea, so that I can understand whether it is viable technically, commercially, and financially before investing significant effort.

#### Acceptance Criteria

1. THE Feasibility_Engine SHALL compute a Technical_Feasibility_Score (0–100) based on factors including technology readiness, team skill requirements, infrastructure complexity, and development time estimate.
2. THE Feasibility_Engine SHALL compute a Market_Feasibility_Score (0–100) based on factors including target market size, demand signals, competitive density, and market maturity.
3. THE Feasibility_Engine SHALL compute a Financial_Feasibility_Score (0–100) based on factors including estimated development cost bracket, time-to-revenue estimate, and funding accessibility.
4. THE Feasibility_Engine SHALL compute an Innovation_Score (0–100) reflecting the novelty and differentiation potential of the Idea relative to the current market.
5. THE Feasibility_Engine SHALL compute a Launch_Readiness_Score (0–100) as a weighted composite of Technical_Feasibility_Score, Market_Feasibility_Score, Financial_Feasibility_Score, and Innovation_Score.
6. THE Feasibility_Engine SHALL generate a written explanation of at least 40 words for each score, describing the key factors considered.
7. WHEN the Feasibility_Engine completes computation, THE Feasibility_Engine SHALL persist all scores and explanations to the Database associated with the Project_Workspace.
8. THE Platform SHALL display all Feasibility_Engine outputs in the Project_Workspace dashboard under a dedicated Feasibility section, presenting each score with a visual indicator alongside its numeric value.
9. THE Platform SHALL display the Launch_Readiness_Score prominently as the primary overall readiness indicator in the Project_Workspace dashboard.

---

### Requirement 7: Startup Intelligence Report

**User Story:** As a User, I want a single consolidated report that synthesizes all agent outputs for my idea, so that I have one shareable artifact that captures the full analysis.

#### Acceptance Criteria

1. WHEN all active agents for a Project_Workspace reach Agent_Status `completed`, THE Platform SHALL automatically generate a Startup_Intelligence_Report for that Project_Workspace.
2. THE Startup_Intelligence_Report SHALL include the following sections: Executive Summary, Validation Summary (all scores and explanations), Competitor Analysis (all competitors, SWOT_Analysis, market opportunities, competitive advantages), Startup Roadmap (all phases, milestones, deliverables, timelines), Feasibility Assessment (all feasibility scores and explanations), and Key Recommendations.
3. THE Startup_Intelligence_Report SHALL present a concise Executive Summary of no more than 300 words synthesizing the most important findings from all agents.
4. THE Startup_Intelligence_Report SHALL be persistently stored in the Database associated with the Project_Workspace.
5. THE Platform SHALL display the Startup_Intelligence_Report in the Project_Workspace dashboard under a dedicated Report section.
6. THE Platform SHALL allow a User to export the Startup_Intelligence_Report as a PDF document.
7. WHEN a User exports the Startup_Intelligence_Report, THE Platform SHALL generate the PDF with all sections, scores, tables, and visual elements reproduced faithfully, including proper headings, section breaks, and formatted score values.
8. IF the Startup_Intelligence_Report generation fails, THEN THE Platform SHALL display a descriptive error message to the User and SHALL allow the User to manually trigger report regeneration.

---

### Requirement 8: Funding Agent (Planned — Post-MVP)

**User Story:** As a User, I want personalized funding recommendations for my idea, so that I can discover relevant grants, accelerators, and competitions I would not otherwise find.

#### Acceptance Criteria

1. WHERE the Funding_Agent feature is enabled, THE Funding_Agent SHALL generate a list of at least 5 funding opportunities relevant to the Idea, based on industry, startup stage, and geographic region.
2. WHERE the Funding_Agent feature is enabled, EACH funding opportunity recommendation SHALL include: name, type (Grant, Accelerator, Incubator, Competition, Scholarship, or Program), a brief description, eligibility criteria summary, estimated funding amount or range (if publicly available), application deadline (if publicly available), and a URL or contact reference.
3. WHERE the Funding_Agent feature is enabled, THE Funding_Agent SHALL rank recommendations by relevance to the Idea's industry, stage, and goals.
4. WHERE the Funding_Agent feature is enabled, WHEN the Funding_Agent completes analysis, THE Funding_Agent SHALL persist all recommendations to the Database associated with the Project_Workspace and SHALL update the Agent_Status for Funding_Agent to `completed`.
5. WHERE the Funding_Agent feature is enabled, IF the Funding_Agent fails to complete analysis due to an error, THEN THE Funding_Agent SHALL update the Agent_Status to `failed` and persist a descriptive error message to the Database.
6. WHERE the Funding_Agent feature is enabled, THE Platform SHALL display Funding_Agent outputs in the Project_Workspace dashboard under a dedicated Funding section.

---

### Requirement 9: Mentor Agent (Planned — Post-MVP)

**User Story:** As a User, I want matched mentor recommendations for my idea, so that I can connect with experienced advisors relevant to my domain and stage.

#### Acceptance Criteria

1. WHERE the Mentor_Agent feature is enabled, THE Mentor_Agent SHALL generate a list of at least 3 mentor recommendations for the Project_Workspace based on industry, startup stage, and technology domain.
2. WHERE the Mentor_Agent feature is enabled, EACH mentor recommendation SHALL include: name, professional background summary, areas of expertise, reason for matching the specific Idea, and a contact or profile reference.
3. WHERE the Mentor_Agent feature is enabled, WHEN the Mentor_Agent completes analysis, THE Mentor_Agent SHALL persist all recommendations to the Database associated with the Project_Workspace and SHALL update the Agent_Status for Mentor_Agent to `completed`.
4. WHERE the Mentor_Agent feature is enabled, IF the Mentor_Agent fails to complete analysis due to an error, THEN THE Mentor_Agent SHALL update the Agent_Status to `failed` and persist a descriptive error message to the Database.
5. WHERE the Mentor_Agent feature is enabled, THE Platform SHALL display Mentor_Agent outputs in the Project_Workspace dashboard under a dedicated Mentors section.

---

### Requirement 10: Pitch Agent (Planned — Post-MVP)

**User Story:** As a User, I want an automatically generated pitch deck for my idea, so that I can present my startup to investors and partners without starting from scratch.

#### Acceptance Criteria

1. WHERE the Pitch_Agent feature is enabled, THE Pitch_Agent SHALL generate a structured pitch deck for the Project_Workspace containing the following sections in order: Problem, Solution, Market Size, Business Model, Competitive Landscape, Revenue Model, Go-To-Market Strategy, and Funding Request.
2. WHERE the Pitch_Agent feature is enabled, EACH pitch deck section SHALL include a title, a narrative paragraph of at least 50 words, and at least 1 supporting data point or key metric drawn from the Validation_Agent and Competitor_Agent outputs.
3. WHERE the Pitch_Agent feature is enabled, WHEN the Pitch_Agent completes generation, THE Pitch_Agent SHALL persist the pitch deck to the Database associated with the Project_Workspace and SHALL update the Agent_Status for Pitch_Agent to `completed`.
4. WHERE the Pitch_Agent feature is enabled, IF the Pitch_Agent fails to complete generation due to an error, THEN THE Pitch_Agent SHALL update the Agent_Status to `failed` and persist a descriptive error message to the Database.
5. WHERE the Pitch_Agent feature is enabled, THE Platform SHALL allow the User to export the generated pitch deck as a PDF document.
6. WHERE the Pitch_Agent feature is enabled, THE Platform SHALL display the generated pitch deck in the Project_Workspace dashboard under a dedicated Pitch Deck section.

---

### Requirement 11: AI Advisor (Planned — Post-MVP)

**User Story:** As a User, I want a contextual AI chat assistant that understands my project, so that I can ask questions and get personalized answers about innovation, strategy, and startup execution.

#### Acceptance Criteria

1. WHERE the AI_Advisor feature is enabled, THE AI_Advisor SHALL maintain a conversation history scoped to the Project_Workspace, persisted in the Database.
2. WHERE the AI_Advisor feature is enabled, WHEN a User submits a question in the AI_Advisor chat interface, THE AI_Advisor SHALL respond with an answer that takes into account the Project_Workspace's Idea data, all completed agent outputs, and the prior conversation history for that workspace.
3. WHERE the AI_Advisor feature is enabled, THE AI_Advisor SHALL respond to each user message within 30 seconds under normal operating conditions.
4. WHERE the AI_Advisor feature is enabled, IF the AI_Advisor fails to generate a response, THEN THE AI_Advisor SHALL display a descriptive error message to the User and SHALL preserve the conversation history intact.
5. WHERE the AI_Advisor feature is enabled, THE Platform SHALL display the AI_Advisor chat interface in the Project_Workspace dashboard under a dedicated Advisor section.

---

### Requirement 12: Authentication (Planned — Post-MVP)

**User Story:** As a User, I want to create an account and sign in securely, so that my projects are private and accessible only to me.

#### Acceptance Criteria

1. WHERE the Authentication feature is enabled, THE Platform SHALL allow a User to register using an email address and a password of at least 8 characters containing at least one uppercase letter, one lowercase letter, and one numeric digit.
2. WHERE the Authentication feature is enabled, THE Platform SHALL allow a User to sign in using a registered email address and password.
3. WHERE the Authentication feature is enabled, THE Platform SHALL allow a User to sign in using a Google account via OAuth 2.0.
4. WHERE the Authentication feature is enabled, WHEN a User submits a registration form with an email address that is already registered, THE Platform SHALL display a descriptive error message and SHALL NOT create a duplicate account.
5. WHERE the Authentication feature is enabled, WHEN a User attempts to access a Project_Workspace that does not belong to their account, THE Platform SHALL return an authorization error and SHALL NOT expose any Project_Workspace data.
6. WHERE the Authentication feature is enabled, THE Platform SHALL hash User passwords using a secure one-way hashing algorithm before storing them in the Database.
7. WHERE the Authentication feature is enabled, WHEN a User successfully authenticates, THE Platform SHALL issue a session token with an expiration of 24 hours and SHALL require re-authentication upon expiration.

---

### Requirement 13: Project Workspace Dashboard

**User Story:** As a User, I want a unified dashboard for my project workspace, so that I can view all agent outputs, scores, and reports in one place.

#### Acceptance Criteria

1. THE Platform SHALL provide a Project_Workspace dashboard page accessible via a unique URL derived from the Project_Workspace identifier.
2. THE Platform SHALL display the project title, industry, submission date, and a real-time Agent_Status summary on the Project_Workspace dashboard.
3. WHILE any agent for a Project_Workspace is running, THE Platform SHALL push Agent_Status updates to the Project_Workspace dashboard using Server_Sent_Events or WebSocket without requiring a full page reload.
4. WHILE any agent for a Project_Workspace is running, THE Platform SHALL display a per-agent progress indicator showing the current status (pending, running, completed, or failed) for each agent individually.
5. WHILE any agent for a Project_Workspace is running, THE Platform SHALL display an estimated time remaining for the active agent, updated at intervals of no more than 10 seconds.
6. THE Platform SHALL organize agent outputs into clearly labeled, navigable sections on the Project_Workspace dashboard.
7. WHEN all active agents have completed and the Startup_Intelligence_Report is available, THE Platform SHALL surface a prominent call-to-action on the Project_Workspace dashboard to view or export the report.
8. THE Platform SHALL render the Project_Workspace dashboard in a responsive layout that is functional on screen widths from 375px to 1920px.
9. THE Platform SHALL meet WCAG 2.1 Level AA color contrast requirements for all text and interactive elements on the Project_Workspace dashboard.

---

### Requirement 14: Data Persistence and API

**User Story:** As a developer, I want a well-structured API and database schema, so that all platform data is reliably stored, retrieved, and extensible for future features.

#### Acceptance Criteria

1. THE Platform SHALL expose a RESTful API that provides endpoints for: creating a Project_Workspace, retrieving a Project_Workspace by identifier, listing all Project_Workspaces, retrieving agent outputs by Project_Workspace identifier and agent type, and retrieving the Startup_Intelligence_Report by Project_Workspace identifier.
2. THE API SHALL return responses in JSON format with consistent envelope structure containing at minimum a `data` field and, on error, an `error` field with a descriptive message.
3. THE API SHALL return HTTP 400 for client validation errors, HTTP 404 when a requested resource is not found, HTTP 500 for unexpected server errors, and HTTP 202 when an agent job has been accepted but is not yet complete.
4. THE Platform SHALL use Prisma as the ORM for all Database interactions.
5. THE Database schema SHALL include tables for: Project_Workspaces, Agent_Runs (storing Agent_Status, agent type, outputs, and timestamps), Feasibility_Scores, Roadmap_Phases, Milestones, Deliverables, Startup_Intelligence_Reports, and Conversation_History (for AI_Advisor).
6. THE Platform SHALL use SQLite as the Database in development environments and SHALL be configurable to use PostgreSQL in production environments without code changes beyond environment configuration.
7. WHEN a Database write operation fails, THE Platform SHALL log the error with sufficient context for debugging and SHALL return a descriptive error response to the caller.

---

### Requirement 15: Scoring Methodology Consistency

**User Story:** As a User, I want scores to be computed consistently and transparently, so that I can trust the analysis and compare results across projects.

#### Acceptance Criteria

1. THE Platform SHALL apply the same scoring rubric and weighting formula for each score type (Innovation_Score, Problem_Clarity_Score, Market_Demand_Score, Technical_Feasibility_Score, Market_Feasibility_Score, Financial_Feasibility_Score, Launch_Readiness_Score) consistently across all Project_Workspaces.
2. THE Platform SHALL document the scoring rubric, including the factors and their weights, in a machine-readable configuration accessible to developers.
3. THE Launch_Readiness_Score SHALL be computed as a weighted average with the following weights: Technical_Feasibility_Score 25%, Market_Feasibility_Score 30%, Financial_Feasibility_Score 20%, Innovation_Score 25%.
4. WHEN a score is displayed, THE Platform SHALL display the score as an integer between 0 and 100.
5. THE Platform SHALL display a brief methodology note explaining what each score measures, accessible to the User from the score display.

---

### Requirement 16: Ethical AI and Explainability

**User Story:** As a User, I want the AI analysis to be transparent and ethically sound, so that I understand how conclusions were reached and can trust the recommendations.

#### Acceptance Criteria

1. THE Validation_Agent, Competitor_Agent, Roadmap_Agent, Funding_Agent (where enabled), Mentor_Agent (where enabled), and Pitch_Agent (where enabled) SHALL include a data source attribution note with each generated output, stating the general categories of information the AI used (e.g., market data, known competitor databases, technology trends).
2. THE Platform SHALL display a disclaimer on every AI-generated output section informing the User that outputs are AI-generated analyses and do not constitute professional business, legal, or financial advice.
3. THE Platform SHALL not use User-submitted Idea data to train or fine-tune AI models without explicit User consent.
4. THE Platform SHALL present recommendations as actionable suggestions rather than directives, using language that preserves User agency.
5. WHEN an AI agent generates a score below 40 on any dimension, THE Platform SHALL display a contextual explanation emphasizing that low scores indicate areas for improvement, not failure.

---

### Requirement 17: Actionable Recommendations Standard

**User Story:** As a User, I want all recommendations to be specific and actionable, so that I know exactly what steps to take next.

#### Acceptance Criteria

1. THE Validation_Agent SHALL ensure that each recommendation includes: a specific action verb (e.g., "Conduct", "Build", "Partner", "Validate"), a target outcome, and a suggested next step.
2. THE Roadmap_Agent SHALL ensure that each Milestone description specifies a verifiable completion criterion.
3. THE Funding_Agent (where enabled) SHALL ensure that each funding recommendation includes at least one specific action the User can take to initiate the application process.
4. THE Mentor_Agent (where enabled) SHALL ensure that each mentor recommendation includes a specific reason why the mentor is relevant to the User's Idea.
5. THE Platform SHALL prioritize recommendations in order of estimated impact, presenting highest-impact recommendations first within each section.

---

### Requirement 18: MVP Scope Definition

**User Story:** As a developer, I want a clearly defined MVP boundary, so that I can build a fully functional and demo-ready product within hackathon constraints without scope creep.

#### Acceptance Criteria

1. THE Platform MVP SHALL implement the following features as fully functional and demo-ready: Idea Submission (Requirement 1), Agent Pipeline Orchestration (Requirement 2), Validation Agent (Requirement 3), Competitor Agent (Requirement 4), Roadmap Agent (Requirement 5), Feasibility Engine (Requirement 6), Startup Intelligence Report (Requirement 7), Steering Files (Requirement 19), and Hooks Configuration (Requirement 20).
2. THE Platform MVP SHALL defer the following features to post-MVP implementation, spec'd but not built during the MVP phase: Funding Agent (Requirement 8), Mentor Agent (Requirement 9), Pitch Agent (Requirement 10), AI Advisor (Requirement 11), and Authentication (Requirement 12).
3. WHEN a post-MVP feature is referenced in the MVP UI, THE Platform SHALL display a clearly labeled "Coming Soon" indicator rather than a non-functional UI element.
4. THE Platform MVP SHALL be deployable and demonstrable in a single command or a documented sequence of no more than 5 steps.
5. THE Platform MVP SHALL complete the full Agent_Pipeline (Validation → Competitor → Roadmap → Report) for a submitted Idea and display the Startup_Intelligence_Report to the User within a single session without requiring authentication.
6. THE Platform SHALL use feature flags to enable post-MVP agents (Funding_Agent, Mentor_Agent, Pitch_Agent, AI_Advisor, Authentication) without code changes, allowing them to be activated when implemented.

---

### Requirement 19: Steering Files

**User Story:** As a developer, I want platform behavior governed by Steering Files that define core principles, so that all agents produce consistent, ethical, and student-first outputs across every Project_Workspace.

#### Acceptance Criteria

1. THE Platform SHALL load Steering_Files from the `.kiro/steering/` directory automatically at agent initialization time, injecting their content as system-level context into the LLM prompt for each agent invocation.
2. THE Platform SHALL maintain at least the following Steering_Files, each as a separate Markdown document in `.kiro/steering/`: `explainability.md` (defining output transparency standards), `student-first.md` (defining accessible, educational tone guidelines), `real-world-impact.md` (defining criteria for grounding recommendations in actionable reality), `ethical-ai.md` (defining prohibited output patterns and bias mitigation guidance), `actionable-recommendations.md` (defining the structure and ranking standard for all recommendations), and `scoring-methodology.md` (defining the consistent scoring rubric and weight definitions for all score types).
3. THE Platform SHALL treat Steering_File content as read-only at runtime and SHALL NOT allow user input to modify Steering_File content.
4. WHEN a Steering_File is missing or unreadable at agent initialization, THE Platform SHALL log a warning identifying the missing file and SHALL continue agent execution using the remaining available Steering_Files.
5. THE Platform SHALL version Steering_Files in source control alongside application code so that changes to agent behavior are traceable and auditable.
6. THE Steering_File `student-first.md` SHALL specify that agents use plain language (no unexplained jargon), provide context for every score, and frame all feedback constructively for early-stage innovators.
7. THE Steering_File `ethical-ai.md` SHALL specify that agents SHALL NOT generate outputs that discriminate based on the founder's personal characteristics, region of origin, or academic background.
8. THE Steering_File `actionable-recommendations.md` SHALL specify that all recommendations must include an action verb, a target outcome, and a next step, and must be ranked by estimated impact from highest to lowest.
9. THE Steering_File `scoring-methodology.md` SHALL define the weight and factor set for each score type and SHALL be the single source of truth referenced by the Feasibility_Engine and all scoring agents.

---

### Requirement 20: Hooks Configuration

**User Story:** As a developer, I want the agentic workflow driven by declarative Hook configuration files, so that the execution sequence is transparent, auditable, and modifiable without changing application code.

#### Acceptance Criteria

1. THE Platform SHALL define each Agent_Hook as a JSON configuration file stored in a designated hooks directory (`.kiro/hooks/`), containing at minimum: a unique hook identifier, the lifecycle event name that triggers the hook, the target agent or action to invoke, and the conditions under which the hook fires.
2. THE Platform SHALL implement the following Agent_Hooks as part of the MVP:
   - `on-idea-submitted`: fires when a Project_Workspace is created and triggers the Validation_Agent.
   - `on-validation-completed`: fires when the Validation_Agent reaches Agent_Status `completed` and triggers the Competitor_Agent.
   - `on-competitor-completed`: fires when the Competitor_Agent reaches Agent_Status `completed` and triggers the Roadmap_Agent (and, where enabled, the Funding_Agent and Mentor_Agent in parallel).
   - `on-roadmap-completed`: fires when the Roadmap_Agent reaches Agent_Status `completed` and triggers Startup_Intelligence_Report generation.
3. THE Platform SHALL implement the following post-MVP Agent_Hooks, defined in configuration but disabled by default:
   - `on-funding-completed`: fires when the Funding_Agent reaches Agent_Status `completed` and updates the Startup_Intelligence_Report with funding data.
   - `on-pitch-completed`: fires when the Pitch_Agent reaches Agent_Status `completed` and triggers a Startup_Intelligence_Report refresh.
4. WHEN the Platform receives a lifecycle event, THE Platform SHALL evaluate all registered Agent_Hooks whose event name matches the received event and SHALL fire each matching hook whose conditions are satisfied.
5. IF an Agent_Hook fails to fire due to a configuration error or runtime exception, THEN THE Platform SHALL log the failure with the hook identifier and event name and SHALL NOT silently skip downstream agents.
6. THE Platform SHALL support enabling and disabling individual Agent_Hooks via the feature flag configuration without requiring code changes or redeployment.
7. THE Platform SHALL validate all Hook configuration files at application startup and SHALL log a descriptive error for any malformed or missing required fields before beginning to serve requests.

---

### Requirement 21: Tech Stack Constraints

**User Story:** As a developer, I want the technology stack formally specified, so that all implementation decisions are consistent, the codebase is maintainable, and the platform is ready for production deployment.

#### Acceptance Criteria

1. THE Frontend SHALL be implemented using Next.js with TypeScript, Tailwind CSS for styling, and ShadCN UI for component primitives.
2. THE Backend SHALL be implemented using Node.js with Express.js as the HTTP framework.
3. THE Platform SHALL use Prisma as the sole ORM for all Database access, with SQLite as the Database engine in development and PostgreSQL as the target Database engine for production.
4. THE Platform SHALL integrate with the Google Gemini API as the primary LLM provider for all agent invocations.
5. WHERE a Google Gemini API key is unavailable, THE Platform SHALL fall back to an OpenAI-compatible API endpoint, configurable via environment variable, without requiring code changes.
6. THE Platform SHALL store all LLM API keys and Database connection strings as environment variables and SHALL NOT hard-code credentials in source files.
7. WHERE the Authentication feature is enabled (post-MVP), THE Platform SHALL support email and password authentication and Google OAuth 2.0 sign-in.
8. THE Platform SHALL define all third-party dependency versions as exact version pins in `package.json` to ensure reproducible builds.
9. THE Frontend and Backend SHALL be structured as separate packages within a monorepo, with shared TypeScript type definitions for API contracts accessible to both packages.

---

### Requirement 22: Export and Sharing Standards

**User Story:** As a User, I want to export and share my analysis artifacts, so that I can present my startup plan to collaborators, investors, and mentors outside the platform.

#### Acceptance Criteria

1. THE Platform SHALL allow a User to export the Startup_Intelligence_Report as a PDF document from the Project_Workspace dashboard.
2. WHEN a User exports the Startup_Intelligence_Report as a PDF, THE Platform SHALL include all report sections (Executive Summary, Validation Summary, Competitor Analysis, Startup Roadmap, Feasibility Assessment, Key Recommendations) with proper headings, section breaks, formatted score values, and readable tables.
3. WHEN a User exports the Startup_Intelligence_Report as a PDF, THE Platform SHALL include the project title, submission date, and a generation timestamp in the PDF header or cover page.
4. WHEN a PDF export is requested, THE Platform SHALL generate and begin downloading the PDF within 15 seconds of the User's request under normal operating conditions.
5. IF a PDF export fails to generate, THEN THE Platform SHALL display a descriptive error message to the User and SHALL preserve the Startup_Intelligence_Report data intact in the Database.
6. WHERE the Pitch_Agent feature is enabled (post-MVP), THE Platform SHALL allow a User to export the generated pitch deck as a separate PDF document from the Project_Workspace dashboard.
7. WHERE the sharing feature is enabled (post-MVP), THE Platform SHALL generate a read-only shareable link for a Project_Workspace that allows a recipient to view the Startup_Intelligence_Report without an account.
8. WHERE the sharing feature is enabled (post-MVP), THE Platform SHALL allow the Project_Workspace owner to revoke a previously generated shareable link, after which the link SHALL return an access denied response to any viewer.
