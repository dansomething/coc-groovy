import { commands, Executable, ExtensionContext, LanguageClient, LanguageClientOptions, workspace } from "coc.nvim"
import * as path from 'path'
import { Commands } from './commands'
import { prepareExecutable } from "./groovyServerStarter"
import { RequirementsData, resolveRequirements, ServerConfiguration } from "./requirements"

const LANG = 'groovy'
const NAME = 'Groovy Language Server'
let languageClient: LanguageClient

export async function activate(context: ExtensionContext): Promise<void> {
  let requirements: RequirementsData
  try {
    requirements = await resolveRequirements()
    workspace.showMessage(`Using java from ${requirements.java_home}, version: ${requirements.java_version}`, 'more')
    return startLanguageServer(context, requirements)
  } catch (e) {
    const res = await workspace.showQuickpick(['Yes', 'No'], `${e.message}, ${e.label}?`)
    if (res == 0) {
      commands.executeCommand(Commands.OPEN_BROWSER, e.openUrl).catch(_e => {
        // noop
      })
    }
  }
}

export function deactivate(): void {
  languageClient = null
}

async function startLanguageServer(context: ExtensionContext, requirements: RequirementsData): Promise<void> {
  const clientOptions = getClientOptions()
  const serverOptions = await getServerOptions(context, requirements)
  languageClient = new LanguageClient(
    LANG,
    NAME,
    serverOptions,
    clientOptions
  )

  const progressItem = workspace.createStatusBarItem(0, { progress: true })
  progressItem.text = `${NAME} starting`
  progressItem.show()

  languageClient.onReady().then(() => {
    languageClient.onNotification('language/progressReport', onProgressReport(progressItem, requirements))
    languageClient.onNotification('language/status', onStatus(progressItem))
  }, e => {
    context.logger.error(e.message)
  })

  workspace.showMessage(`${NAME} starting`)
  languageClient.start()
}

function onProgressReport(progressItem: any, requirements: RequirementsData): (report: any) => any {
  let started = false
  const statusItem = workspace.createStatusBarItem(0)
  statusItem.text = ''

  return report => {
    switch (report.type) {
      case 'Started':
        started = true
      progressItem.isProgress = false
      statusItem.text = NAME
      statusItem.show()
      workspace.showMessage(`${NAME} started`)
      // TODO How are these properties used? Should apiVersion be set?
      languageClient.info(`${NAME} Started`, { javaRequirement: requirements, apiVersion: '0.2' })
      break
      case 'Error':
        progressItem.isProgress = false
      statusItem.hide()
      workspace.showMessage(`${NAME} error [${report.message}]`, 'error')
      break
      case 'Starting':
        if (!started) {
        progressItem.text = report.message
        progressItem.show()
      }
      break
      case 'Message':
        workspace.showMessage(report.message)
      break
    }
  }
}

function onStatus(progressItem: any): (progress: any) => any {
  return progress => {
    progressItem.show()
    progressItem.text = progress.status
    if (progress.complete) {
      setTimeout(() => { progressItem.hide() }, 500)
    }
  }
}

function getClientOptions(): LanguageClientOptions {
  const config = workspace.getConfiguration(LANG)

  return {
    documentSelector: [{ scheme: 'file', language: LANG }],
    synchronize: {
      configurationSection: LANG
    },
    initializationOptions: {
      settings: { groovy: config }
    }
  }
}

async function getServerOptions(context: ExtensionContext, requirements: RequirementsData): Promise<Executable> {
  const config = workspace.getConfiguration(LANG)
  const root = config.get<string>('ls.home', defaultServerHome(context))
  const encoding = await workspace.nvim.eval('&fileencoding') as string
  const serverConfig: ServerConfiguration = {
    root,
    encoding,
    vmargs: config.get<string>('ls.vmargs', '')
  }
  return prepareExecutable(requirements, serverConfig)
}

function defaultServerHome(context: ExtensionContext): string {
  return path.resolve(context.extensionPath, 'server')
}
