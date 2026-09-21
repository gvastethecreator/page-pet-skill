import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skill = path.join(root, "SKILLS", "page-pet");
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const required = [
  ".gitignore",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "AGENTS.md",
  "skills.sh.json",
  "SKILLS/README.md",
  "SKILLS/page-pet/SKILL.md",
  "SKILLS/page-pet/agents/openai.yaml",
  "SKILLS/page-pet/assets/catalog.json",
  "SKILLS/page-pet/runtime/page-pet.js",
  "SKILLS/page-pet/playground/index.html",
  "SKILLS/page-pet/references/generation.md",
  "SKILLS/page-pet/references/alignment.md",
  "SKILLS/page-pet/references/color.md",
  "SKILLS/page-pet/references/integration.md",
  "SKILLS/page-pet/references/troubleshooting.md",
];

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) fail(`missing ${relative}`);
}

const skillMd = fs.readFileSync(path.join(skill, "SKILL.md"), "utf8");
if (!/^---\r?\nname: page-pet\r?\n/m.test(skillMd)) fail("SKILL.md name must be page-pet");

const catalog = JSON.parse(fs.readFileSync(path.join(skill, "assets", "catalog.json"), "utf8"));
if (!Array.isArray(catalog) || catalog.length === 0) fail("catalog.json must list packs");
for (const entry of catalog) {
  const packDir = path.join(skill, "assets", path.dirname(entry.replace(/^\.\//, "")));
  for (const file of ["manifest.json", "mascot.webp", "gaze-review.json", "build-report.json"]) {
    const full = path.join(packDir, file);
    if (!fs.existsSync(full)) fail(`missing ${path.relative(root, full)}`);
  }
}

const pythonFiles = fs.readdirSync(path.join(skill, "scripts"))
  .filter((name) => name.endsWith(".py"))
  .map((name) => path.join(skill, "scripts", name));
const py = spawnSync("python", ["-m", "py_compile", ...pythonFiles], { stdio: "inherit" });
if (py.status !== 0) fail("python compile failed");

const jsFiles = [
  path.join(skill, "runtime", "page-pet.js"),
  path.join(skill, "runtime", "manifest.js"),
  path.join(skill, "runtime", "motion.js"),
  path.join(skill, "runtime", "puppet.js"),
  path.join(skill, "playground", "app.js"),
  path.join(skill, "playground", "review.js"),
];
for (const file of jsFiles) {
  const node = spawnSync("node", ["--check", file], { stdio: "inherit" });
  if (node.status !== 0) fail(`syntax failed: ${path.relative(root, file)}`);
}

console.log(`ok: ${catalog.length} catalog packs, python compile, js syntax`);
