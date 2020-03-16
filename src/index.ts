import { commands, ExtensionContext, LanguageClient, workspace } from 'coc.nvim'
import { DidChangeConfigurationNotification, Disposable } from 'vscode-languageserver-protocol'
import { getClasspath } from './classpath'
import { getClientOptions } from './client'
import { Commands } from './commands'
import { GROOVY, PLUGIN_NAME } from './constants'
import { RequirementsData, resolveRequirements } from './requirements'
import { getServerOptions } from './server'

let languageClient: LanguageClient
let languageClientDisposable: Disposable

export async function activate(context: ExtensionContext): Promise<void> {
  let requirements: RequirementsData
  try {
    requirements = await resolveRequirements()
    await getCurrentFileClasspath() // called here to optimize startup time
    workspace.showMessage(
      `${PLUGIN_NAME} using Java from ${requirements.java_home}, version: ${requirements.java_version}`,
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
  languageClientDisposable.dispose()
  languageClient = null
}

async function startLanguageServer(context: ExtensionContext, requirements: RequirementsData): Promise<void> {
  const clientOptions = getClientOptions(updateClasspath)
  const serverOptions = await getServerOptions(context, requirements)
  languageClient = new LanguageClient(
    GROOVY,
    PLUGIN_NAME,
    serverOptions,
    clientOptions
  )
  languageClient.registerProposedFeatures()

  languageClient.onReady().then(() => {
    workspace.showMessage(`${PLUGIN_NAME} started!`)
    registerCommands(context)
  }, e => {
    context.logger.error(e.message)
  })

  workspace.showMessage(`${PLUGIN_NAME} starting...`)
  languageClientDisposable = languageClient.start()
}

function registerCommands(context: ExtensionContext): void {
  context.subscriptions.push(commands.registerCommand(Commands.CONFIGURATION_UPDATE, updateProjectConfig))
}

async function updateProjectConfig(): Promise<void> {
  await updateClasspath(true)
  workspace.showMessage(`${PLUGIN_NAME} project config updated.`)
}

async function updateClasspath(forceUpdate?: boolean): Promise<void> {
  const classpath = await getCurrentFileClasspath(forceUpdate)
  const config = workspace.getConfiguration(GROOVY)
  const groovy = { ...config, classpath }
  // The Groovy language server only loads the classpath from a config change notification.
  // Ideally this would also be loaded with initializationOptions too.
  languageClient.sendNotification(DidChangeConfigurationNotification.type, {
    settings: { groovy }
  })
}

async function getCurrentFileClasspath(forceUpdate?: boolean): Promise<string[]> {
  const filepath = await workspace.nvim.call('expand', '%:p') as string
  return await getClasspath(filepath, forceUpdate)
}
