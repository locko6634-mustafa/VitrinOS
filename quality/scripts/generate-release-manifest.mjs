import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const inputIndex = args.indexOf("--input");
if (inputIndex === -1 || !args[inputIndex + 1]) {
  throw new Error("Kullanim: npm run release-manifest -- --input <supabase-functions-list.json>");
}

const input = JSON.parse(await readFile(resolve(args[inputIndex + 1]), "utf8"));
const functions = Array.isArray(input) ? input : input.functions;
if (!Array.isArray(functions)) throw new Error("Function listeleme girdisi functions dizisi icermiyor.");

const sourceRoot = resolve("supabase/functions");
const entries = [];
for (const fn of functions.sort((a, b) => a.slug.localeCompare(b.slug))) {
  const sourcePath = `supabase/functions/${fn.slug}/index.ts`;
  const source = await readFile(join(sourceRoot, fn.slug, "index.ts"));
  entries.push({
    slug: fn.slug,
    version: fn.version,
    verify_jwt: fn.verify_jwt,
    deployed_at: fn.updated_at ? new Date(fn.updated_at).toISOString() : null,
    bundle_sha256: fn.ezbr_sha256 ?? fn.bundle_sha256 ?? null,
    source_path: sourcePath,
    source_sha256: createHash("sha256").update(source).digest("hex")
  });
}

const now = new Date();
const releaseId = `${now.toISOString().slice(0, 10)}-edge-functions`;
const manifest = {
  release_id: releaseId,
  environment: "production",
  project_ref: process.env.SUPABASE_PROJECT_REF || "wrzalebhnlwppufdcmiz",
  generated_at: now.toISOString(),
  git: {
    commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  },
  functions: entries
};

const output = resolve(`supabase/releases/${releaseId}.json`);
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Release manifest yazildi: ${output}`);
