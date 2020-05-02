import { workspace } from 'coc.nvim'
import findUp from 'find-up'
import fs from 'fs'
import * as path from 'path'
import { GROOVY, PLUGIN_NAME } from './constants'
import { Settings } from './settings'
import { IS_WINDOWS } from './system'

const CLASSPATH_FILE = '.groovy-classpath'

// Cache the Maven generated classpath to improve initial load time.
let mvnClasspath: string[] | undefined

export async function getClasspath(storagePath: string, filepath: string, forceUpdate?: boolean): Promise<string[]> {
  if (forceUpdate) {
    mvnClasspath = undefined
    deleteClasspathFile(storagePath)
    workspace.showMessage("Resetting loaded libraries.")
  }

  if (!mvnClasspath) {
    mvnClasspath = await getMvnClasspath(storagePath, filepath)
  }

  const config = workspace.getConfiguration(GROOVY)
  let classpath = config.get<string[]>(Settings.REFERENCED_LIBRARIES, [])
  if (mvnClasspath) {
    classpath = classpath.concat(mvnClasspath)
  }
  return classpath
}

export async function getMvnClasspath(storagePath: string , filepath: string): Promise<string[]> {
  const pom = await findNearestPom(filepath)
  if (!pom) {
    return null
  }

  const cwd = path.dirname(pom)
  workspace.showMessage(`${PLUGIN_NAME} project [${path.basename(cwd)}] loading libraries...`)
  return buildClasspath(storagePath, cwd)
}

function getClasspathFilePath(storagePath: string): string {
  // Specifying the full path results in only one file being created for a multi-module project.
  return path.resolve(storagePath, CLASSPATH_FILE)
}

function deleteClasspathFile(storagePath: string): void {
    workspace.deleteFile(getClasspathFilePath(storagePath), { ignoreIfNotExists: true })
}

async function buildClasspath(storagePath: string, cwd: string): Promise<string[]> {
  const classpathFilePath = getClasspathFilePath(storagePath)
  const separator = ':'
  let fileContent: string

  if (fs.existsSync(classpathFilePath)) {
    fileContent = fs.readFileSync(classpathFilePath, 'utf8')
  }

  if (!fileContent) {
    const mvnCmd = await findMvnCmd()
    if (!mvnCmd) {
      return null
    }
    const cmd = `${mvnCmd} dependency:build-classpath -Dmdep.pathSeparator='${separator}' -Dmdep.outputFile=${classpathFilePath}`

    try {
      const result = await workspace.runCommand(cmd, cwd)
      if (!result?.includes('BUILD SUCCESS')) {
        deleteClasspathFile(storagePath)
        return null
      }
    } catch(e) {
      // The maven operation failed for some reason so there's nothing we can do.
      deleteClasspathFile(storagePath)
      workspace.showMessage(`${PLUGIN_NAME} classpath command failed "cd ${cwd} && ${cmd}"`, 'error')
      return null
    }
  }

  fileContent = fs.readFileSync(classpathFilePath, 'utf8')
  if (!fileContent) {
    deleteClasspathFile(storagePath)
    return null
  }

  return fileContent.split(separator).sort()
}

async function findNearestPom(filepath: string): Promise<string | null> {
  const filedir = path.dirname(filepath)
  return await findUp('pom.xml', { cwd: filedir })
}

async function findMvnCmd(): Promise<string | null> {
  try {
    const mvn = IS_WINDOWS ? 'mvn.cmd' : 'mvn'
    const mvnVersion = await workspace.runCommand(`${mvn} --version`)
    if (mvnVersion.match(/Apache Maven \d\.\d+\.\d+/)) {
      return mvn
    }
  } catch (_e) {
    // noop
  }

  return null
}
