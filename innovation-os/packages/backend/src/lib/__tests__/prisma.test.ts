/**
 * Unit tests for Prisma schema integrity.
 *
 * Uses a separate SQLite test database (test.db) to keep test state
 * isolated from the development database.
 */

import { PrismaClient } from '@prisma/client';
import * as path from 'path';

// Resolve the test DB path (absolute, so it works regardless of CWD)
// __dirname = packages/backend/src/lib/__tests__
// ../../../  = packages/backend/
const TEST_DB_PATH = path.resolve(__dirname, '../../../prisma/test.db');
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

// Construct a PrismaClient that explicitly targets the test database.
// Passing `datasources` overrides the DATABASE_URL env var.
const prisma = new PrismaClient({
  datasources: {
    db: { url: TEST_DB_URL },
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createTestWorkspace(suffix = '') {
  return prisma.projectWorkspace.create({
    data: {
      title: `Test Project${suffix}`,
      description: 'A test project description',
      problemStatement: 'A test problem statement',
      targetAudience: 'Early-stage founders',
      industry: 'Technology',
      goals: 'Validate the concept',
    },
  });
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(async () => {
  // Clean all tables in dependency-safe order before each test
  await prisma.conversationHistory.deleteMany();
  await prisma.deliverable.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.roadmapPhase.deleteMany();
  await prisma.competitor.deleteMany();
  await prisma.competitorAnalysis.deleteMany();
  await prisma.validationRecommendation.deleteMany();
  await prisma.validationRisk.deleteMany();
  await prisma.validationResult.deleteMany();
  await prisma.feasibilityScore.deleteMany();
  await prisma.startupIntelligenceReport.deleteMany();
  await prisma.agentRun.deleteMany();
  await prisma.projectWorkspace.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AgentRun unique constraint @@unique([projectId, agentType])', () => {
  it('allows creating an AgentRun for a project+agentType pair', async () => {
    const workspace = await createTestWorkspace();

    const run = await prisma.agentRun.create({
      data: {
        projectId: workspace.id,
        agentType: 'validation',
        status: 'pending',
      },
    });

    expect(run.id).toBeDefined();
    expect(run.agentType).toBe('validation');
  });

  it('rejects a duplicate AgentRun for the same project+agentType', async () => {
    const workspace = await createTestWorkspace();

    await prisma.agentRun.create({
      data: {
        projectId: workspace.id,
        agentType: 'validation',
        status: 'pending',
      },
    });

    // Creating another AgentRun with the same projectId+agentType must throw
    await expect(
      prisma.agentRun.create({
        data: {
          projectId: workspace.id,
          agentType: 'validation',
          status: 'running',
        },
      })
    ).rejects.toThrow();
  });

  it('allows different agentTypes for the same project', async () => {
    const workspace = await createTestWorkspace();

    const run1 = await prisma.agentRun.create({
      data: { projectId: workspace.id, agentType: 'validation', status: 'pending' },
    });
    const run2 = await prisma.agentRun.create({
      data: { projectId: workspace.id, agentType: 'competitor', status: 'pending' },
    });

    expect(run1.agentType).toBe('validation');
    expect(run2.agentType).toBe('competitor');
  });

  it('allows the same agentType for different projects', async () => {
    const ws1 = await createTestWorkspace('-A');
    const ws2 = await createTestWorkspace('-B');

    const run1 = await prisma.agentRun.create({
      data: { projectId: ws1.id, agentType: 'validation', status: 'pending' },
    });
    const run2 = await prisma.agentRun.create({
      data: { projectId: ws2.id, agentType: 'validation', status: 'pending' },
    });

    expect(run1.projectId).toBe(ws1.id);
    expect(run2.projectId).toBe(ws2.id);
  });
});

describe('Cascade delete: ProjectWorkspace → AgentRun', () => {
  it('deletes all AgentRun records when the parent ProjectWorkspace is deleted', async () => {
    const workspace = await createTestWorkspace();

    await prisma.agentRun.createMany({
      data: [
        { projectId: workspace.id, agentType: 'validation', status: 'pending' },
        { projectId: workspace.id, agentType: 'competitor', status: 'pending' },
        { projectId: workspace.id, agentType: 'roadmap', status: 'pending' },
      ],
    });

    // Confirm runs exist before delete
    const before = await prisma.agentRun.count({ where: { projectId: workspace.id } });
    expect(before).toBe(3);

    // Delete the workspace
    await prisma.projectWorkspace.delete({ where: { id: workspace.id } });

    // All child AgentRun records should be gone
    const after = await prisma.agentRun.count({ where: { projectId: workspace.id } });
    expect(after).toBe(0);
  });

  it('does not affect AgentRun records for other workspaces', async () => {
    const ws1 = await createTestWorkspace('-A');
    const ws2 = await createTestWorkspace('-B');

    await prisma.agentRun.create({
      data: { projectId: ws1.id, agentType: 'validation', status: 'pending' },
    });
    await prisma.agentRun.create({
      data: { projectId: ws2.id, agentType: 'validation', status: 'pending' },
    });

    // Delete only ws1
    await prisma.projectWorkspace.delete({ where: { id: ws1.id } });

    // ws2's AgentRun should remain
    const surviving = await prisma.agentRun.count({ where: { projectId: ws2.id } });
    expect(surviving).toBe(1);
  });
});
