import { commands, Executable, ExtensionContext, LanguageClient, LanguageClientOptions, workspace } from 'coc.nvim'
import * as path from 'path'
import { DidChangeConfigurationNotification } from 'vscode-languageserver-protocol'
import { getClasspath } from './classpath'
import { Commands } from './commands'
import { prepareExecutable } from './serverStarter'
import { RequirementsData, resolveRequirements, ServerConfiguration } from './requirements'
import { isGroovyFile } from './system'

const LANG = 'groovy'
const PLUGIN_NAME = 'Groovy Language Server [GLS]'
const PLUGIN_NAME_SHORT = '[GLS]'
let languageClient: LanguageClient

export async function activate(context: ExtensionContext): Promise<void> {
  let requirements: RequirementsData
  try {
    requirements = await resolveRequirements()
    workspace.showMessage(
      `${PLUGIN_NAME_SHORT} using Java from ${requirements.java_home}, version: ${requirements.java_version}`,
      'more'
    )
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
    PLUGIN_NAME,
    serverOptions,
    clientOptions
  )
  languageClient.registerProposedFeatures()

  languageClient.onReady().then(() => {
    workspace.showMessage(`${PLUGIN_NAME_SHORT} started!`)
    updateConfig()
    registerCommands(context)
  }, e => {
    context.logger.error(e.message)
  })

  workspace.showMessage(`${PLUGIN_NAME} starting...`)
  languageClient.start()
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

function registerCommands(context: ExtensionContext): void {
  context.subscriptions.push(commands.registerCommand(Commands.CONFIGURATION_UPDATE, updateConfig))
}

async function updateConfig(): Promise<void> {
  const filepath = await workspace.nvim.call('expand', '%:p') as string
  if (!isGroovyFile(filepath)) {
    workspace.showMessage('Open a Groovy file to update project config.', 'warning')
    return null
  }

  await updateClasspath(filepath)
  workspace.showMessage(`${PLUGIN_NAME_SHORT} project config updated.`)
}

async function updateClasspath(filepath: string): Promise<void> {
  const config = workspace.getConfiguration(LANG)
  let classpath = config.get<string[]>('project.referencedLibraries', [])
  const projectClasspath = await getClasspath(filepath)
  if (projectClasspath) {
    classpath = classpath.concat(projectClasspath)
  }
  // The Groovy language server only loads the classpath from a config change notification.
  // Ideally this would also be loaded with initializationOptions too.
  languageClient.sendNotification(DidChangeConfigurationNotification.type, {
    settings: { groovy: { classpath } }
  })
}
