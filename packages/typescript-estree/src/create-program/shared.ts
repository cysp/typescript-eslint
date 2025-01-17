import path from 'path';
import type { Program } from 'typescript';
import * as ts from 'typescript';

import type { ParseSettings } from '../parseSettings';

interface ASTAndNoProgram {
  ast: ts.SourceFile;
  program: null;
}
interface ASTAndDefiniteProgram {
  ast: ts.SourceFile;
  program: ts.Program;
}
type ASTAndProgram = ASTAndDefiniteProgram | ASTAndNoProgram;

/**
 * Compiler options required to avoid critical functionality issues
 */
const CORE_COMPILER_OPTIONS: ts.CompilerOptions = {
  noEmit: true, // required to avoid parse from causing emit to occur

  /**
   * Flags required to make no-unused-vars work
   */
  noUnusedLocals: true,
  noUnusedParameters: true,
};

/**
 * Default compiler options for program generation
 */
const DEFAULT_COMPILER_OPTIONS: ts.CompilerOptions = {
  ...CORE_COMPILER_OPTIONS,
  allowNonTsExtensions: true,
  allowJs: true,
  checkJs: true,
};

function createDefaultCompilerOptionsFromExtra(
  parseSettings: ParseSettings,
): ts.CompilerOptions {
  if (parseSettings.debugLevel.has('typescript')) {
    return {
      ...DEFAULT_COMPILER_OPTIONS,
      extendedDiagnostics: true,
    };
  }

  return DEFAULT_COMPILER_OPTIONS;
}

// This narrows the type so we can be sure we're passing canonical names in the correct places
type CanonicalPath = string & { __brand: unknown };

// typescript doesn't provide a ts.sys implementation for browser environments
const useCaseSensitiveFileNames =
  ts.sys !== undefined ? ts.sys.useCaseSensitiveFileNames : true;
const correctPathCasing = useCaseSensitiveFileNames
  ? (filePath: string): string => filePath
  : (filePath: string): string => filePath.toLowerCase();

function getCanonicalFileName(filePath: string): CanonicalPath {
  let normalized = path.normalize(filePath);
  if (normalized.endsWith(path.sep)) {
    normalized = normalized.slice(0, -1);
  }
  return correctPathCasing(normalized) as CanonicalPath;
}

function ensureAbsolutePath(p: string, tsconfigRootDir: string): string {
  return path.isAbsolute(p)
    ? p
    : path.join(tsconfigRootDir || process.cwd(), p);
}

function canonicalDirname(p: CanonicalPath): CanonicalPath {
  return path.dirname(p) as CanonicalPath;
}

const DEFINITION_EXTENSIONS = [
  ts.Extension.Dts,
  ts.Extension.Dcts,
  ts.Extension.Dmts,
] as const;
function getExtension(fileName: string | undefined): string | null {
  if (!fileName) {
    return null;
  }

  return (
    DEFINITION_EXTENSIONS.find(definitionExt =>
      fileName.endsWith(definitionExt),
    ) ?? path.extname(fileName)
  );
}

function getAstFromProgram(
  currentProgram: Program,
  parseSettings: ParseSettings,
): ASTAndDefiniteProgram | undefined {
  const ast = currentProgram.getSourceFile(parseSettings.filePath);

  // working around https://github.com/typescript-eslint/typescript-eslint/issues/1573
  const expectedExt = getExtension(parseSettings.filePath);
  const returnedExt = getExtension(ast?.fileName);
  if (expectedExt !== returnedExt) {
    return undefined;
  }

  return ast && { ast, program: currentProgram };
}

/**
 * Hash content for compare content.
 * @param content hashed contend
 * @returns hashed result
 */
function createHash(content: string): string {
  // No ts.sys in browser environments.
  if (ts.sys?.createHash) {
    return ts.sys.createHash(content);
  }
  return content;
}

export {
  ASTAndDefiniteProgram,
  ASTAndNoProgram,
  ASTAndProgram,
  CORE_COMPILER_OPTIONS,
  canonicalDirname,
  CanonicalPath,
  createDefaultCompilerOptionsFromExtra,
  createHash,
  ensureAbsolutePath,
  getCanonicalFileName,
  getAstFromProgram,
};
