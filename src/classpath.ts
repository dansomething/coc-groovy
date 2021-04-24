import { workspace } from 'coc.nvim';
import findUp from 'find-up';
import fs from 'fs';
import * as path from 'path';
import { GROOVY, PLUGIN_NAME } from './constants';
import { Settings } from './settings';
import { IS_WINDOWS } from './system';

const CLASSPATH_FILE = '.groovy-classpath';

// Cache the Maven generated classpath to improve initial load time.
let builtClassPath: string[] | null;
const separator = ':';

export async function getClasspath(storagePath: string, filepath: string, forceUpdate?: boolean): Promise<string[]> {
  if (forceUpdate) {
    builtClassPath = null;
    deleteClasspathFile(storagePath);
    workspace.showMessage('Resetting loaded libraries.');
  }

  if (!builtClassPath) {
    builtClassPath = await getBuiltClasspath(storagePath, filepath);
  }

  const config = workspace.getConfiguration(GROOVY);
  let classpath: Array<string> = config.get<string[]>(Settings.REFERENCED_LIBRARIES, []);
  if(Array.isArray(classpath)){
    if (builtClassPath) {
      classpath = classpath.concat(builtClassPath);
    }
  }else{
      let value: String = classpath
      classpath = value.split(separator) as string[]
      classpath = classpath.concat(builtClassPath as [])
  }
  return classpath;
}

export async function getBuiltClasspath(storagePath: string, filepath: string): Promise<string[] | null> {
  const buildFile = await findNearestBuildFile(filepath);
  if (!buildFile) {
    return null;
  }

  const cwd = path.dirname(buildFile);
  const buildTool = buildFile.includes("pom")? "mvn": "gradle"
  workspace.showMessage(`${PLUGIN_NAME} project [${path.basename(cwd)}] loading libraries with ${buildTool}...`);
  return buildClasspath(storagePath, cwd, buildTool);
}

function getClasspathFilePath(storagePath: string): string {
  // Specifying the full path results in only one file being created for a multi-module project.
  return path.resolve(storagePath, CLASSPATH_FILE);
}

function deleteClasspathFile(storagePath: string): void {
  workspace.deleteFile(getClasspathFilePath(storagePath), { ignoreIfNotExists: true });
}

async function buildClasspath(storagePath: string, cwd: string, tool: string): Promise<string[] | null> {
  const classpathFilePath = getClasspathFilePath(storagePath);
  let fileContent: string | null = null;

  if (fs.existsSync(classpathFilePath)) {
    fileContent = fs.readFileSync(classpathFilePath, 'utf8');
  }

  if (!fileContent) {
    let cmd = ""
    if(tool === "mvn"){
      const mvnCmd = await findMvnCmd();
      if (!mvnCmd) {
        return null;
      }
      cmd = `${mvnCmd} dependency:build-classpath -Dmdep.pathSeparator='${separator}' -Dmdep.outputFile=${classpathFilePath}`;
    }else if(tool === "gradle"){
      const gradleCmd = await findGradleCmd();
      if (!gradleCmd) {
        return null;
      }
      cmd = `${gradleCmd} --output-file=${classpathFilePath}`;
    }else{
      return null
    }

    try {
      await workspace.runCommand(cmd, cwd);
      const errorCMD = IS_WINDOWS? "echo %errorlevel%": "echo $?"
      const errorCode = await workspace.runCommand(errorCMD)
      if (errorCode !== "0") {
        deleteClasspathFile(storagePath);
        return null;
      }
    } catch (e) {
      // The maven operation failed for some reason so there's nothing we can do.
      deleteClasspathFile(storagePath);
      workspace.showMessage(`${PLUGIN_NAME} classpath command failed "cd ${cwd} && ${cmd}"`, 'error');
      return null;
    }
  }

  fileContent = fs.readFileSync(classpathFilePath, 'utf8');
  if (!fileContent) {
    deleteClasspathFile(storagePath);
    return null;
  }

  return fileContent.split(separator).sort();
}

async function findNearestBuildFile(filepath: string): Promise<string | undefined> {
  const filedir = path.dirname(filepath);
  const isPom = await findUp('pom.xml', { cwd: filedir });
  if(!isPom){
    return await findUp('build.gradle', { cwd: filedir });
  }
  return isPom
}

async function findGradleCmd(): Promise<string | null> {
  try {
    if(IS_WINDOWS){
      return `${workspace.root}\\utils\\groovy-classpath\\bin\\gradle-classpath.bat`
    }else{
      return `${workspace.root}/utils/groovy-classpath/bin/gradle-classpath`
    }
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
