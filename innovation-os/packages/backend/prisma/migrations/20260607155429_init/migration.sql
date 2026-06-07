-- CreateTable
CREATE TABLE "ProjectWorkspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "problemStatement" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "goals" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectWorkspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "innovationScore" INTEGER NOT NULL,
    "problemClarityScore" INTEGER NOT NULL,
    "marketDemandScore" INTEGER NOT NULL,
    "technicalFeasibilityScore" INTEGER NOT NULL,
    "innovationExplanation" TEXT NOT NULL,
    "problemClarityExplanation" TEXT NOT NULL,
    "marketDemandExplanation" TEXT NOT NULL,
    "techFeasibilityExplanation" TEXT NOT NULL,
    "dataSourceAttribution" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationResult_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectWorkspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationRisk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "validationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    CONSTRAINT "ValidationRisk_validationId_fkey" FOREIGN KEY ("validationId") REFERENCES "ValidationResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "validationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impactRank" INTEGER NOT NULL,
    CONSTRAINT "ValidationRecommendation_validationId_fkey" FOREIGN KEY ("validationId") REFERENCES "ValidationResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompetitorAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "swotStrengths" TEXT NOT NULL,
    "swotWeaknesses" TEXT NOT NULL,
    "swotOpportunities" TEXT NOT NULL,
    "swotThreats" TEXT NOT NULL,
    "marketOpportunities" TEXT NOT NULL,
    "competitiveAdvantages" TEXT NOT NULL,
    "dataSourceAttribution" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompetitorAnalysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectWorkspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "url" TEXT,
    CONSTRAINT "Competitor_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "CompetitorAnalysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoadmapPhase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "startWeek" INTEGER NOT NULL,
    "endWeek" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoadmapPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectWorkspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    CONSTRAINT "Milestone_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "RoadmapPhase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deliverable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "milestoneId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    CONSTRAINT "Deliverable_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeasibilityScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "technicalScore" INTEGER NOT NULL,
    "marketScore" INTEGER NOT NULL,
    "financialScore" INTEGER NOT NULL,
    "innovationScore" INTEGER NOT NULL,
    "launchReadinessScore" INTEGER NOT NULL,
    "technicalExplanation" TEXT NOT NULL,
    "marketExplanation" TEXT NOT NULL,
    "financialExplanation" TEXT NOT NULL,
    "innovationExplanation" TEXT NOT NULL,
    "launchReadinessExplanation" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeasibilityScore_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectWorkspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StartupIntelligenceReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "keyRecommendations" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StartupIntelligenceReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectWorkspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectWorkspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AgentRun_projectId_idx" ON "AgentRun"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRun_projectId_agentType_key" ON "AgentRun"("projectId", "agentType");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationResult_projectId_key" ON "ValidationResult"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorAnalysis_projectId_key" ON "CompetitorAnalysis"("projectId");

-- CreateIndex
CREATE INDEX "RoadmapPhase_projectId_idx" ON "RoadmapPhase"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapPhase_projectId_order_key" ON "RoadmapPhase"("projectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "FeasibilityScore_projectId_key" ON "FeasibilityScore"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "StartupIntelligenceReport_projectId_key" ON "StartupIntelligenceReport"("projectId");

-- CreateIndex
CREATE INDEX "ConversationHistory_projectId_idx" ON "ConversationHistory"("projectId");
