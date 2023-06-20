import cp from 'child_process';
import { Uri, workspace } from 'coc.nvim';
import expandHomeDir from 'expand-home-dir';
import findJavaHome from 'find-java-home';
import fs from 'fs';
import path from 'path';
import { pathExistsSync } from 'path-exists';
import { GROOVY } from './constants';
import { getLogger } from './context';
import { Settings } from './settings';
import { JAVAC_FILENAME, JAVA_FILENAME } from './system';

export interface ServerConfiguration {
  root: string;
  encoding: string;
  vmargs: string;
}

export interface RequirementsData {
  java_home: string;
  java_version: number;
}

interface ErrorData {
  message: string;
  label: string;
  openUrl: Uri;
  replaceClose: boolean;
}

/**
 * Resolves the requirements needed to run this extension.
 *
 * Returns a promise that will resolve to a RequirementsData if all
 * requirements are resolved. Otherwise, it will reject with ErrorData if
 * any of the requirements fail to be met.
 */
export async function resolveRequirements(): Promise<RequirementsData> {
  const java_home = await checkJavaRuntime();
  const javaVersion = await checkJavaVersion(java_home);
  return Promise.resolve({ java_home, java_version: javaVersion });
}

function checkJavaRuntime(): Promise<string> {
  return new Promise((resolve, reject) => {
    let source: string;
    let javaHome: string | undefined = readJavaHomeConfig();
    if (javaHome) {
      source = 'The groovy.java.home variable defined in COC settings';
    } else {
      javaHome = process.env['JDK_HOME'];
      if (javaHome) {
        source = 'The JDK_HOME environment variable';
      } else {
        javaHome = process.env['JAVA_HOME'];
        source = 'The JAVA_HOME environment variable';
      }
    }
    if (javaHome !== undefined) {
      let home: string = expandHomeDir(javaHome);
      const stat = fs.lstatSync(home);
      if (stat.isSymbolicLink()) {
        home = fs.realpathSync(home);
      }
      if (!pathExistsSync(home)) {
        openJDKDownload(reject, source + ' points to a missing folder');
      }
      if (!pathExistsSync(path.resolve(home, 'bin', JAVAC_FILENAME))) {
        openJDKDownload(reject, source + ' does not point to a JDK.');
      }
      return resolve(home);
    }
    // No settings, let's try to detect as last resort.
    findJavaHome({ allowJre: true }, (err, home) => {
      if (err) {
        getLogger().error(`findJavaHome: No Java runtime found. Error [${JSON.stringify(err)}]`);
        openJDKDownload(reject, 'Java runtime could not be located');
      } else {
        resolve(home);
      }
    });
  });
}

function readJavaHomeConfig(): string | undefined {
  const config = workspace.getConfiguration(GROOVY);
  return config.get<string | undefined>(Settings.JAVA_HOME, undefined);
}

function checkJavaVersion(java_home: string): Promise<number> {
  return new Promise((resolve, reject) => {
    cp.execFile(java_home + '/bin/' + JAVA_FILENAME, ['-version'], {}, (_error, _stdout, stderr) => {
      const javaVersion = parseMajorVersion(stderr);
      if (javaVersion < 8) {
        openJDKDownload(reject, 'Java 8 or more recent is required to run. Please download and install a recent JDK');
      } else {
        resolve(javaVersion);
      }
    });
  });
}

function parseMajorVersion(content: string): number {
  let regexp = /version "(.*)"/g;
  let match = regexp.exec(content);
  if (!match) {
    return 0;
  }
  let version = match[1];
  // Ignore '1.' prefix for legacy Java versions
  if (version.startsWith('1.')) {
    version = version.substring(2);
  }

  // look into the interesting bits now
  regexp = /\d+/g;
  match = regexp.exec(version);
  let javaVersion = 0;
  if (match) {
    javaVersion = parseInt(match[0], 10);
  }
  return javaVersion;
}

function openJDKDownload(reject: (reason?: any) => void, cause: string): void {
  let jdkUrl = 'https://developers.redhat.com/products/openjdk/download/?sc_cid=701f2000000RWTnAAO';
  if (process.platform === 'darwin') {
    jdkUrl = 'http://www.oracle.com/technetwork/java/javase/downloads/index.html';
  }
  reject({
    message: cause,
    label: 'Get the Java Development Kit',
    openUrl: Uri.parse(jdkUrl),
    replaceClose: false,
  } as ErrorData);
}
