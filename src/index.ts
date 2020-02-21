import { commands, ExtensionContext, LanguageClient, workspace } from 'coc.nvim'
import { DidChangeConfigurationNotification, Disposable } from 'vscode-languageserver-protocol'
import { getClasspath } from './classpath'
import { getClientOptions } from './client'
import { Commands } from './commands'
import { GROOVY, PLUGIN_NAME, PLUGIN_NAME_SHORT } from './constants'
import { RequirementsData, resolveRequirements } from './requirements'
import { getServerOptions } from './server'
import { isGroovyFile } from './system'

let languageClient: LanguageClient
let languageClientDisposable: Disposable

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
  languageClientDisposable.dispose()
  languageClient = null
}

async function startLanguageServer(context: ExtensionContext, requirements: RequirementsData): Promise<void> {
  const clientOptions = getClientOptions()
  const serverOptions = await getServerOptions(context, requirements)
  languageClient = new LanguageClient(
    GROOVY,
    PLUGIN_NAME,
    serverOptions,
    clientOptions
  )
  languageClient.registerProposedFeatures()

  languageClient.onReady().then(() => {
    workspace.showMessage(`${PLUGIN_NAME_SHORT} started!`)
    updateProjectConfig()
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
  const filepath = await workspace.nvim.call('expand', '%:p') as string
  if (!isGroovyFile(filepath)) {
    workspace.showMessage('Open a Groovy file to update project config.', 'warning')
    return null
  }

  await updateClasspath(filepath)
  workspace.showMessage(`${PLUGIN_NAME_SHORT} project config updated.`)
}

async function updateClasspath(filepath: string): Promise<void> {
  const config = workspace.getConfiguration(GROOVY)
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
