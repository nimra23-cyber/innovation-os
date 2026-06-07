import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../lib/logger';

export class SteeringLoader {
  /**
   * Loads all .md files from the .kiro/steering/ directory.
   * Each file is wrapped with a section header and concatenated.
   * Missing or unreadable files are skipped with a warning log.
   *
   * The steering directory is resolved relative to the monorepo root
   * (two levels up from packages/backend/).
   */
  static async loadAll(): Promise<string> {
    // Resolve .kiro/steering/ relative to the project root.
    // __dirname at runtime = packages/backend/src/services (or dist/services)
    // So we go up 4 levels to reach the monorepo root.
    const steeringDir = path.resolve(__dirname, '../../../../.kiro/steering');

    let files: string[];
    try {
      files = await fs.readdir(steeringDir);
    } catch (error) {
      logger.warn(
        { steeringDir, error },
        'Could not read steering directory — proceeding without steering context'
      );
      return '';
    }

    const mdFiles = files.filter(f => f.endsWith('.md')).sort();
    const contents: string[] = [];

    for (const file of mdFiles) {
      try {
        const filePath = path.join(steeringDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        contents.push(`## Steering: ${file}\n\n${content.trim()}`);
      } catch (error) {
        logger.warn(
          { file, steeringDir },
          `Steering file "${file}" missing or unreadable — skipping`
        );
      }
    }

    return contents.join('\n\n---\n\n');
  }
}
