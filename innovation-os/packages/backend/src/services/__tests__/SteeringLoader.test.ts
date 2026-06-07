import * as fsMock from 'fs/promises';
import { SteeringLoader } from '../SteeringLoader';

// Mock the entire fs/promises module
jest.mock('fs/promises');

// Mock the logger so we can assert warn calls without pino side-effects
jest.mock('../../lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Typed references to the mocked functions
const mockReaddir = fsMock.readdir as jest.MockedFunction<typeof fsMock.readdir>;
const mockReadFile = fsMock.readFile as jest.MockedFunction<typeof fsMock.readFile>;

// Import logger AFTER mocking so we get the mocked version
import { logger } from '../../lib/logger';

// Use jest.mocked() for type-safe access to the mocked functions —
// avoids unsafe casting of pino.Logger to a plain object shape.
const warnSpy = jest.mocked(logger.warn);
const infoSpy = jest.mocked(logger.info);
const errorSpy = jest.mocked(logger.error);

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SteeringLoader.loadAll()', () => {
  it('loads all steering files and wraps each with a section header', async () => {
    mockReaddir.mockResolvedValue(['explainability.md', 'ethical-ai.md', 'student-first.md'] as any);
    mockReadFile
      .mockResolvedValueOnce('Explainability content' as any)
      .mockResolvedValueOnce('Ethical AI content' as any)
      .mockResolvedValueOnce('Student-first content' as any);

    const result = await SteeringLoader.loadAll();

    expect(result).toContain('## Steering: explainability.md');
    expect(result).toContain('Explainability content');
    expect(result).toContain('## Steering: ethical-ai.md');
    expect(result).toContain('Ethical AI content');
    expect(result).toContain('## Steering: student-first.md');
    expect(result).toContain('Student-first content');
  });

  it('concatenates multiple files with the correct separator', async () => {
    mockReaddir.mockResolvedValue(['a.md', 'b.md'] as any);
    mockReadFile
      .mockResolvedValueOnce('Content A' as any)
      .mockResolvedValueOnce('Content B' as any);

    const result = await SteeringLoader.loadAll();

    expect(result).toContain('\n\n---\n\n');
  });

  it('skips a missing file with a warning and still returns other files content', async () => {
    // Files are sorted alphabetically by SteeringLoader before reading:
    // sorted order: ['also-good.md', 'good.md', 'missing.md']
    mockReaddir.mockResolvedValue(['good.md', 'missing.md', 'also-good.md'] as any);
    mockReadFile
      .mockResolvedValueOnce('Also good content' as any)  // also-good.md (sorted 1st)
      .mockResolvedValueOnce('Good content' as any)        // good.md (sorted 2nd)
      .mockRejectedValueOnce(new Error('ENOENT: no such file')); // missing.md (sorted 3rd)

    const result = await SteeringLoader.loadAll();

    expect(result).toContain('Good content');
    expect(result).toContain('Also good content');
    expect(result).not.toContain('## Steering: missing.md');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ file: 'missing.md' }),
      expect.stringContaining('missing.md')
    );
  });

  it('returns empty string when the steering directory is empty', async () => {
    mockReaddir.mockResolvedValue([] as any);

    const result = await SteeringLoader.loadAll();

    expect(result).toBe('');
  });

  it('ignores non-.md files', async () => {
    mockReaddir.mockResolvedValue(['guide.md', 'readme.txt', 'notes.json'] as any);
    mockReadFile.mockResolvedValueOnce('Guide content' as any);

    const result = await SteeringLoader.loadAll();

    expect(result).toContain('## Steering: guide.md');
    expect(result).toContain('Guide content');
    // Only one readFile call — txt and json were filtered out
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });

  it('returns empty string and logs a warning when the steering directory is unreadable', async () => {
    mockReaddir.mockRejectedValue(new Error('EACCES: permission denied'));

    const result = await SteeringLoader.loadAll();

    expect(result).toBe('');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ steeringDir: expect.any(String) }),
      expect.stringContaining('Could not read steering directory')
    );
  });
});
