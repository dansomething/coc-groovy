import { workspace } from 'coc.nvim';
import findUp from 'find-up';
import fs from 'fs';
import * as path from 'path';
import { GROOVY, PLUGIN_NAME } from './constants';
import { getContext, getLogger } from './context';
import { Settings } from './settings';
import { IS_WINDOWS } from './system';

const CLASSPATH_FILE = '.groovy-classpath';
const SEPARATOR = IS_WINDOWS ? ';' : ':';
const TOOL_GRADLE = 'gradle';
const TOOL_MVN = 'mvn';

export async function getClasspath(storagePath: string, filepath: string, forceUpdate: boolean): Promise<string[]> {
  if (forceUpdate) {
    workspace.showMessage('Resetting loaded libraries.');
  }

  const builtClassPath = await getBuiltClasspath(storagePath, filepath, forceUpdate);

  const config = workspace.getConfiguration(GROOVY);
  let classpath: Array<string> | string = config.get<string[]>(Settings.REFERENCED_LIBRARIES, []);
  if (!Array.isArray(classpath)) {
    const value = classpath as string;
    classpath = value.split(SEPARATOR) as string[];
  }
  if (builtClassPath) {
    classpath = classpath.concat(builtClassPath);
  }
  return classpath;
}

export async function getBuiltClasspath(
  storagePath: string,
  filepath: string,
  forceUpdate: boolean
): Promise<string[] | null> {
  const buildFile = await findNearestBuildFile(filepath);
  if (!buildFile) {
    getLogger().info('getBuiltClasspath: No build file was found to use for classpath generation.');
    return null;
  }

  const cwd = path.dirname(buildFile);
  const buildTool = buildFile.includes('pom') ? TOOL_MVN : TOOL_GRADLE;
  workspace.showMessage(`${PLUGIN_NAME} project [${path.basename(cwd)}] loading libraries with [${buildTool}]...`);
  return buildClasspath(storagePath, cwd, buildTool, forceUpdate);
}

function getClasspathFilePath(storagePath: string): string {
  // Specifying the full path results in only one file being created for a multi-module project.
  return path.resolve(storagePath, CLASSPATH_FILE);
}

function deleteClasspathFile(storagePath: string): void {
  workspace.deleteFile(getClasspathFilePath(storagePath), { ignoreIfNotExists: true });
}

async function buildClasspath(
  storagePath: string,
  cwd: string,
  tool: string,
  forceUpdate: boolean
): Promise<string[] | null> {
  const classpathFilePath = getClasspathFilePath(storagePath);

  let cmd: string;
  if (tool === TOOL_MVN) {
    const mvnCmd = await findMvnCmd();
    if (!mvnCmd) {
      return null;
    }
    cmd = `${mvnCmd} dependency:build-classpath -Dmdep.pathSeparator='${SEPARATOR}' -Dmdep.outputFile=${classpathFilePath} -Dmdep.regenerateFile=${forceUpdate}`;
  } else if (tool === TOOL_GRADLE) {
    const gradleCmd = await findGradleCmd();
    if (!gradleCmd) {
      return null;
    }
    cmd = `${gradleCmd} --path-separator=${SEPARATOR} --output-file=${classpathFilePath} --regenerate-file=${forceUpdate}`;
  } else {
    return null;
  }

  try {
    getLogger().debug(`buildClasspath cwd: ${cwd}`);
    getLogger().debug(`buildClasspath cmd: ${cmd}`);
    const result = await workspace.runCommand(cmd, cwd);
    if (!result?.includes('BUILD SUCCESS')) {
      getLogger().warn(`buildClasspath: cmd failed [${result}]`);
      deleteClasspathFile(storagePath);
      return null;
    }
  } catch (e) {
    // The maven operation failed for some reason so there's nothing we can do.
    getLogger().warn(`buildClasspath: cmd failed [${JSON.stringify(e)}]`);
    workspace.showMessage(`${PLUGIN_NAME} classpath command failed "cd ${cwd} && ${cmd}"`, 'error');
    deleteClasspathFile(storagePath);
    return null;
  }

  const fileContent = fs.readFileSync(classpathFilePath, 'utf8');
  if (!fileContent) {
    getLogger().warn(`buildClasspath: Empty classpath file generated? Deleting [${storagePath}]`);
    deleteClasspathFile(storagePath);
    return null;
  }

  return fileContent.split(SEPARATOR).sort();
}

async function findNearestBuildFile(filepath: string): Promise<string | undefined> {
  const filedir = path.dirname(filepath);
  let buildFile = await findUp('pom.xml', { cwd: filedir });
  if (!buildFile) {
    buildFile = await findUp('build.gradle', { cwd: filedir });
  }
  return buildFile;
}

async function findGradleCmd(): Promise<string | null> {
  try {
    return path.resolve(
      getContext().extensionPath,
      'utils',
      'gradle-classpath',
      'bin',
      'gradle-classpath' + (IS_WINDOWS ? '.bat' : '')
    );
  } catch (_e) {
    // noop
  }

  return null;
}

async function findMvnCmd(): Promise<string | null> {
  try {
    const mvn = IS_WINDOWS ? 'mvn.cmd' : 'mvn';
    const mvnVersion = await workspace.runCommand(`${mvn} --version`);
    if (mvnVersion.match(/Apache Maven \d\.\d+\.\d+/)) {
      return mvn;
    }
  } catch (_e) {
    // noop
  }

  return null;
}
