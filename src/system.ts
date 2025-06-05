import * as os from 'os';
import * as path from 'path';

export const IS_WINDOWS = process.platform.indexOf('win') === 0;
export const JAVAC_FILENAME = 'javac' + (IS_WINDOWS ? '.exe' : '');
export const JAVA_FILENAME = 'java' + (IS_WINDOWS ? '.exe' : '');

declare let v8debug: object | undefined;
export const DEBUG = typeof v8debug === 'object' || startedInDebugMode();

function startedInDebugMode(): boolean {
  const args = process.execArgv;
  if (args) {
    return args.some(
      (arg: string) => /^--debug=?/.test(arg) || /^--debug-brk=?/.test(arg) || /^--inspect-brk=?/.test(arg),
    );
  }
  return false;
}

export function isGroovyFile(path: string): boolean {
  return path?.endsWith('.groovy');
}

export function getTempWorkspace(): string {
  return path.resolve(os.tmpdir(), 'coc-groovy');
}
