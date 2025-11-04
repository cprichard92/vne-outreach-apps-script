import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export function loadGasEnvironment(files, globals = {}) {
  const sandbox = {
    ...globals,
    console,
    Date,
    Math,
    RegExp,
    Set,
    Map,
    Logger: globals.Logger || { log: () => {} },
    Utilities:
      globals.Utilities || {
        formatDate: () => '',
        sleep: () => {},
      },
    Session:
      globals.Session || {
        getScriptTimeZone: () => 'America/New_York',
      },
  };

  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);

  for (const file of files) {
    const absolutePath = path.resolve(file);
    const code = readFileSync(absolutePath, 'utf8');
    const localModule = { exports: {} };
    context.module = localModule;
    context.exports = localModule.exports;
    vm.runInContext(code, context, { filename: absolutePath });
    if (localModule.exports && Object.keys(localModule.exports).length) {
      Object.assign(sandbox, localModule.exports);
    }
  }

  return sandbox;
}

function defaultGetCell(row, colNum) {
  return colNum ? row[colNum - 1] : '';
}

function defaultExtractDomain(emailOrUrl) {
  const s = (emailOrUrl || '').toString().trim().toLowerCase();
  if (!s) return '';
  if (s.includes('@')) {
    return s.split('@')[1].replace(/^www\./, '');
  }
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`);
    return u.hostname.replace(/^www\./, '');
  } catch (err) {
    return s.replace(/^www\./, '');
  }
}

export function createBounceRetryTestEnv(overrides = {}) {
  return loadGasEnvironment(
    ['src/bounce_retry.gs'],
    {
      VNE_EMAIL: 'info@vneimporters.com',
      getCell: defaultGetCell,
      extractDomain: defaultExtractDomain,
      ...overrides,
    },
  );
}
