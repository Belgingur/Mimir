/**
 * Which commit a build came from. vite.config.ts asks git at build time and
 * writes the answer into the built index.html (a `mimir-commit` meta tag) and
 * into `version.json` next to it, so anyone can tell which commit is live.
 *
 * This file holds the pure part, so it can be tested without git.
 */

/** The `name` of the meta tag that carries the commit in the built page. */
export const COMMIT_META_NAME = "mimir-commit";

/** Environment variable a build without git can set to name its commit. */
export const COMMIT_ENV_VAR = "MIMIR_COMMIT";

/** What git said about the checkout, or null when git wasn't available. */
export interface GitState {
  /** `git rev-parse --short HEAD` */
  shortSha: string;
  /** True when tracked files differ from HEAD (as `git describe --dirty`). */
  dirty: boolean;
}

// A commit name ends up in an HTML attribute and a JSON file, so only accept
// what a SHA or a tag/describe name can contain.
const SAFE_COMMIT = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/;

/**
 * The commit to record: git's short SHA (plus `-dirty` for local changes),
 * else the value of MIMIR_COMMIT, else "unknown".
 */
export function resolveBuildCommit(
  git: GitState | null,
  envCommit: string | undefined,
): string {
  const sha = git?.shortSha.trim() ?? "";
  if (SAFE_COMMIT.test(sha)) return git?.dirty ? `${sha}-dirty` : sha;
  const fromEnv = envCommit?.trim() ?? "";
  if (SAFE_COMMIT.test(fromEnv)) return fromEnv;
  return "unknown";
}

/** The contents of `version.json`. */
export function versionJson(commit: string, builtAt: Date): string {
  return `${JSON.stringify({ commit, builtAt: builtAt.toISOString() }, null, 2)}\n`;
}
