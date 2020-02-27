import { workspace } from 'coc.nvim'
import findUp from 'find-up'
import fs from 'fs'
import * as path from 'path'
import { GROOVY, PLUGIN_NAME_SHORT } from './constants'
import { Settings } from './settings'
import { IS_WINDOWS } from './system'

export async function getClasspath(filepath: string): Promise<string[]> {
  const config = workspace.getConfiguration(GROOVY)
  let classpath = config.get<string[]>(Settings.REFERENCED_LIBRARIES, [])
  const projectClasspath = await getMvnClasspath(filepath)
  if (projectClasspath) {
    classpath = classpath.concat(projectClasspath)
  }
  return classpath
}

export async function getMvnClasspath(filepath: string): Promise<string[]> {
  const pom = await findNearestPom(filepath)
  if (!pom) {
    return null
  }

  const cwd = path.dirname(pom)
  workspace.showMessage(`${PLUGIN_NAME_SHORT} project [${path.basename(cwd)}] loading libraries...`)
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

  let result: string
  try {
    result = await workspace.runCommand(
      `${mvnCmd} dependency:build-classpath -Dmdep.pathSeparator='${separator}' -Dmdep.outputFile=${outputFilePath}`,
      cwd
    )
  } catch(e) {
    // The maven operation failed for some reason so there's nothing we can do.
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

  return fileContent.split(separator)
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
