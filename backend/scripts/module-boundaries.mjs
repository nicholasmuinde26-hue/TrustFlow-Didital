import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
const violationsOnly = process.argv.includes('--violations-only');
const json = process.argv.includes('--json');
const backendOnly = process.argv.includes('--backend-only');
const frontendOnly = process.argv.includes('--frontend-only');
const allRoots = [
  { name: 'backend', sourceRoot: path.join(backendRoot, 'src') },
  { name: 'frontend', sourceRoot: path.join(backendRoot, '../frontend/chama-manager-frontend/src') },
];
const roots = allRoots.filter(({ name }) => (!backendOnly || name === 'backend') && (!frontendOnly || name === 'frontend'));
const findings = [];
const modelFindings = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(target);
    return /\.(?:js|jsx|mjs|cjs)$/.test(entry.name) ? [target] : [];
  });
}

function fileExists(file) {
  try { return fs.statSync(file).isFile(); } catch { return false; }
}

function resolveFile(basePath) {
  const candidates = [basePath, ...['.js', '.jsx', '.mjs', '.cjs'].map((extension) => `${basePath}${extension}`), ...['index.js', 'index.jsx', 'index.mjs'].map((name) => path.join(basePath, name))];
  return candidates.find(fileExists) || null;
}

function moduleOf(file, modulesRoot, moduleNames) {
  const relative = path.relative(modulesRoot, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  const name = relative.split(path.sep)[0];
  return moduleNames.has(name) ? name : null;
}

function resolveImport(fromFile, specifier, sourceRoot) {
  if (specifier.startsWith('.')) return resolveFile(path.resolve(path.dirname(fromFile), specifier));
  if (specifier.startsWith('@/')) return resolveFile(path.resolve(sourceRoot, specifier.slice(2)));
  return null;
}

for (const { name: codebase, sourceRoot } of roots) {
  const modulesRoot = path.join(sourceRoot, 'modules');
  const moduleNames = new Set(fs.readdirSync(modulesRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  for (const file of walk(sourceRoot)) {
    const sourceModule = moduleOf(file, modulesRoot, moduleNames);
    const source = fs.readFileSync(file, 'utf8');
    const imports = [
      ...[...source.matchAll(/(?:\bimport\s+(?:[\s\S]*?\s+from\s+)?|\bexport\s+[\s\S]*?\s+from\s+)['"]([^'"]+)['"]/g)].map((match) => match[1]),
      ...[...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1]),
    ];
    for (const specifier of imports) {
      const targetPath = resolveImport(file, specifier, sourceRoot);
      if (!targetPath) continue;
      const legacyModelsRoot = path.join(sourceRoot, 'models');
      if (sourceModule && targetPath.startsWith(`${legacyModelsRoot}${path.sep}`)) {
        modelFindings.push({
          codebase,
          source: path.relative(sourceRoot, file).replaceAll(path.sep, '/'),
          model: path.relative(legacyModelsRoot, targetPath).replaceAll(path.sep, '/'),
          from: sourceModule,
        });
      }
      const targetModule = moduleOf(targetPath, modulesRoot, moduleNames);
      if (!targetModule || targetModule === sourceModule) continue;
      findings.push({
        codebase,
        source: path.relative(sourceRoot, file).replaceAll(path.sep, '/'),
        target: path.relative(sourceRoot, targetPath).replaceAll(path.sep, '/'),
        from: sourceModule || '(core)',
        to: targetModule,
      });
    }
  }
}

findings.sort((a, b) => `${a.codebase}/${a.from}/${a.to}/${a.source}`.localeCompare(`${b.codebase}/${b.from}/${b.to}/${b.source}`));
const isPublicApi = (item) => new RegExp(`^modules/${item.to}/index\\.(?:js|jsx|mjs|cjs)$`).test(item.target);
const counts = new Map();
for (const item of findings) {
  const key = `${item.codebase}: ${item.from} -> ${item.to}`;
  counts.set(key, (counts.get(key) || 0) + 1);
}

const moduleImports = findings.filter((item) => item.from !== '(core)');
const moduleViolations = moduleImports.filter((item) => !isPublicApi(item));
const externalImports = findings.filter((item) => item.from === '(core)');
const externalViolations = externalImports.filter((item) => !isPublicApi(item));
if (!json) for (const { name: codebase } of roots) {
  const codebaseFindings = findings.filter((item) => item.codebase === codebase);
  const inside = codebaseFindings.filter((item) => item.from !== '(core)');
  const outside = codebaseFindings.filter((item) => item.from === '(core)');
  const insideBad = inside.filter((item) => !isPublicApi(item));
  const outsideBad = outside.filter((item) => !isPublicApi(item));
  console.log(`${codebase}: ${codebaseFindings.length} cross-module imports; ${insideBad.length} direct module-to-module internal imports; ${outsideBad.length} external imports of module internals.`);
}
if (!json) {
  console.log(strict ? 'Mode: strict (direct module-internal imports fail).' : 'Mode: warn-only (baseline report; does not fail).');
  for (const [pair, count] of [...counts].sort(([a], [b]) => a.localeCompare(b))) console.log(`  ${pair}: ${count}`);
  const backendModelImports = modelFindings.filter((item) => item.codebase === 'backend');
  if (backendModelImports.length) {
    const models = new Set(backendModelImports.map((item) => item.model));
    const owners = new Set(backendModelImports.map((item) => item.from));
    console.log(`Legacy model boundary baseline: ${backendModelImports.length} direct model imports across ${models.size} shared model files and ${owners.size} modules.`);
  }
}
const findingsToPrint = violationsOnly
  ? findings.filter((item) => !isPublicApi(item))
  : findings;
if (json) {
  console.log(JSON.stringify(findingsToPrint, null, 2));
} else if (findingsToPrint.length) {
  console.log('\nImport sites:');
  for (const item of findingsToPrint) console.log(`  [${item.codebase}] ${item.source} -> ${item.target}`);
}
if (strict && (moduleViolations.length || externalViolations.length)) process.exitCode = 1;
