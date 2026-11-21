import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface RunResult {
  stdout: string;
  stderr: string;
}

export async function run(
  command: string,
  args: string[],
  options: { timeoutMs?: number; encoding?: 'utf8' } = {},
): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      timeout: options.timeoutMs ?? 10 * 60 * 1000,
    });
    return { stdout, stderr };
  } catch (error) {
    // execFile's message is only the command line; the tool's own complaint is in stderr.
    const stderr = (error as { stderr?: string }).stderr?.trim();
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(stderr ? `${message}\n${stderr}` : message, {
      cause: error,
    });
  }
}

export interface ToolVersions {
  tesseract: string;
  poppler: string;
}

const installHint =
  'Install the tools with: brew install tesseract poppler (docs/developer-guide.md §2, "Book search tools")';

/** Versions of the native tools, or an error that says what to install. */
export async function toolVersions(): Promise<ToolVersions> {
  const probe = async (
    command: string,
    args: string[],
    pattern: RegExp,
  ): Promise<string> => {
    try {
      const { stdout, stderr } = await run(command, args, { timeoutMs: 15000 });
      const match = pattern.exec(`${stdout}\n${stderr}`);
      if (!match?.[1]) throw new Error('unrecognised version output');
      return match[1];
    } catch (error) {
      throw new Error(
        `${command} is not usable (${error instanceof Error ? error.message : String(error)}). ${installHint}`,
        { cause: error },
      );
    }
  };
  const tesseract = await probe('tesseract', ['--version'], /tesseract (\S+)/);
  const poppler = await probe('pdftotext', ['-v'], /version (\S+)/);
  await probe('pdfinfo', ['-v'], /version (\S+)/);
  await probe('pdftoppm', ['-v'], /version (\S+)/);
  return { tesseract, poppler };
}

/** True when a command runs; used to skip tests that need the native tools. */
export function toolAvailable(command: string, arg: string): boolean {
  return spawnSync(command, [arg], { timeout: 15000 }).status === 0;
}
