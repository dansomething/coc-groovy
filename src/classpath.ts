import { workspace } from 'coc.nvim'
import findUp from 'find-up'
import fs from 'fs'
import * as path from 'path'
import { GROOVY, PLUGIN_NAME } from './constants'
import { Settings } from './settings'
import { IS_WINDOWS } from './system'

// Cache the Maven generated classpath to improve initial load time.
let mvnClasspath: string[] | undefined

export async function getClasspath(filepath: string, forceUpdate?: boolean): Promise<string[]> {
  if (forceUpdate) {
    mvnClasspath = undefined
    workspace.showMessage("Resetting loaded libraries.")
  }

  if (!mvnClasspath) {
    mvnClasspath = await getMvnClasspath(filepath)
  }

  const config = workspace.getConfiguration(GROOVY)
  let classpath = config.get<string[]>(Settings.REFERENCED_LIBRARIES, [])
  if (mvnClasspath) {
    classpath = classpath.concat(mvnClasspath)
  }
  return classpath
}

export async function getMvnClasspath(filepath: string): Promise<string[]> {
  const pom = await findNearestPom(filepath)
  if (!pom) {
    return null
  }

  const cwd = path.dirname(pom)
  workspace.showMessage(`${PLUGIN_NAME} project [${path.basename(cwd)}] loading libraries...`)
  return buildClasspath(cwd)
}

async function buildClasspath(cwd: string): Promise<string[]> {
  const mvnCmd = await findMvnCmd()
  if (!mvnCmd) {
    return null
  }

  // Specifying the full path results in only one file being created for a multi-module project.
  const outputFilePath = path.resolve(cwd, '.classpath.txt')
  const separator = ':'
  const cmd = `${mvnCmd} dependency:build-classpath -Dmdep.pathSeparator='${separator}' -Dmdep.outputFile=${outputFilePath}`

  let result: string
  try {
    result = await workspace.runCommand(cmd, cwd)
  } catch(e) {
    // The maven operation failed for some reason so there's nothing we can do.
    workspace.showMessage(`${PLUGIN_NAME} classpath command failed "cd ${cwd} && ${cmd}"`, 'error')
    return null
  }

  if (!result?.includes('BUILD SUCCESS')) {
    return null
  }

  const fileContent = fs.readFileSync(outputFilePath, 'utf8')
  workspace.deleteFile(outputFilePath)
  if (!fileContent) {
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
