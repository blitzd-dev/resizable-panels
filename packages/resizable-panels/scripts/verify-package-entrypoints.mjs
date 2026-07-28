import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const packageRoot = dirname(
  fileURLToPath(new URL("../package.json", import.meta.url)),
);
const packageJson = JSON.parse(
  readFileSync(resolve(packageRoot, "package.json"), "utf8"),
);

function collectTargets(value, targets) {
  if (typeof value === "string") {
    targets.add(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectTargets(item, targets);
    return;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectTargets(item, targets);
  }
}

const targets = new Set();
collectTargets(packageJson.exports, targets);
for (const field of ["main", "module", "types", "typings"]) {
  if (typeof packageJson[field] === "string") targets.add(packageJson[field]);
}

if (targets.size === 0) {
  throw new Error("Package metadata does not declare any entry points.");
}

for (const target of targets) {
  if (!target.startsWith("./")) {
    throw new Error(`Package entry point must be relative: ${target}`);
  }

  const targetPath = resolve(packageRoot, target);
  if (relative(packageRoot, targetPath).startsWith("..")) {
    throw new Error(`Package entry point escapes the package root: ${target}`);
  }

  let targetStats;
  try {
    targetStats = statSync(targetPath);
  } catch (error) {
    throw new Error(`Package entry point does not exist: ${target}`, {
      cause: error,
    });
  }
  if (!targetStats.isFile()) {
    throw new Error(`Package entry point is not a file: ${target}`);
  }
}

const declarationEntryPoints = [...targets]
  .filter((target) => target.endsWith(".d.ts"))
  .map((target) => resolve(packageRoot, target));
const visitedDeclarations = new Set();
const distDirectory = resolve(packageRoot, "dist");

function isWithin(parent, candidate) {
  const pathFromParent = relative(parent, candidate);
  return (
    pathFromParent === "" ||
    (!pathFromParent.startsWith("..") && !isAbsolute(pathFromParent))
  );
}

function collectRelativeSpecifiers(declarationPath, contents) {
  const sourceFile = ts.createSourceFile(
    declarationPath,
    contents,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const specifiers = new Set(
    sourceFile.referencedFiles
      .map(({ fileName }) => fileName)
      .filter((specifier) => specifier.startsWith(".")),
  );

  function addStringLiteral(node) {
    if (node && ts.isStringLiteralLike(node) && node.text.startsWith(".")) {
      specifiers.add(node.text);
    }
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addStringLiteral(node.moduleSpecifier);
    } else if (ts.isImportTypeNode(node)) {
      addStringLiteral(node.argument.literal);
    } else if (ts.isExternalModuleReference(node)) {
      addStringLiteral(node.expression);
    } else if (ts.isModuleDeclaration(node)) {
      addStringLiteral(node.name);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

function verifyDeclarationClosure(declarationPath) {
  if (visitedDeclarations.has(declarationPath)) return;
  visitedDeclarations.add(declarationPath);

  const contents = readFileSync(declarationPath, "utf8");
  const relativeSpecifiers = collectRelativeSpecifiers(
    declarationPath,
    contents,
  );

  for (const specifier of relativeSpecifiers) {
    if (!/\.js$/.test(specifier)) {
      throw new Error(
        `Declaration ${relative(packageRoot, declarationPath)} has a NodeNext-incompatible relative specifier: ${specifier}`,
      );
    }
    const candidate = resolve(dirname(declarationPath), specifier);
    const declarationDependency = candidate.replace(/\.js$/, ".d.ts");
    if (!isWithin(distDirectory, declarationDependency)) {
      throw new Error(
        `Declaration ${relative(packageRoot, declarationPath)} escapes dist through ${specifier}.`,
      );
    }
    let dependencyStats;
    try {
      dependencyStats = statSync(declarationDependency);
    } catch (error) {
      throw new Error(
        `Declaration ${relative(packageRoot, declarationPath)} references missing ${relative(packageRoot, declarationDependency)}.`,
        { cause: error },
      );
    }
    if (!dependencyStats.isFile()) {
      throw new Error(
        `Declaration dependency is not a file: ${relative(packageRoot, declarationDependency)}`,
      );
    }
    verifyDeclarationClosure(declarationDependency);
  }
}

for (const declarationEntryPoint of declarationEntryPoints) {
  verifyDeclarationClosure(declarationEntryPoint);
}
const reachableDeclarationCount = visitedDeclarations.size;

const emittedDeclarations = readdirSync(distDirectory, { recursive: true })
  .filter((entry) => entry.endsWith(".d.ts"))
  .map((entry) => resolve(distDirectory, entry));
for (const emittedDeclaration of emittedDeclarations) {
  verifyDeclarationClosure(emittedDeclaration);
}

console.log(
  `Verified ${targets.size} declared package entry points, ${reachableDeclarationCount} reachable declaration files, and all ${emittedDeclarations.length} emitted declaration files.`,
);
