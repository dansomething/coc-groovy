import { workspace } from 'coc.nvim'
import findUp from 'find-up'
import fs from 'fs'
import * as path from 'path'
import { PLUGIN_NAME_SHORT } from './constants'
import { isGroovyFile, IS_WINDOWS } from './system'

export async function getClasspath(filepath: string): Promise<string[]> {
  if (!isGroovyFile(filepath)) {
    workspace.showMessage('Open a Groovy file to update project config.', 'warning')
    return null
  }

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

  const outputFile = '.classpath.txt'
  const separator = ':'

  const result = await workspace.runCommand(
    `${mvnCmd} dependency:build-classpath -Dmdep.pathSeparator='${separator}' -Dmdep.outputFile=${outputFile}`,
    cwd
  )
  if (!result.includes('BUILD SUCCESS')) {
    return null
  }

  const outputFilePath = await findUp(outputFile, { cwd })
  if (!outputFilePath) {
    return null
  }

  const fileContent = fs.readFileSync(outputFilePath, 'utf8')
  // workspace.deleteFile(outputFilePath)
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
  } catch (e) {
    // noop
  }

  return null
}
