import { commands, ExtensionContext, LanguageClient, Uri, workspace } from 'coc.nvim';
import { createHash } from 'crypto';
import * as path from 'path';
import { DidChangeConfigurationNotification, Disposable } from 'vscode-languageserver-protocol';
import { getClasspath } from './classpath';
import { getClientOptions } from './client';
import { Commands } from './commands';
import { GROOVY, PLUGIN_NAME } from './constants';
import { setContext } from './context';
import { RequirementsData, resolveRequirements } from './requirements';
import { getServerOptions } from './server';
import { getTempWorkspace } from './system';

let languageClient: LanguageClient | null;
let languageClientDisposable: Disposable;
let storagePath: string;

export async function activate(context: ExtensionContext): Promise<void> {
  setContext(context);
  storagePath = getStoragePath(context);
  let requirements: RequirementsData;
  try {
    requirements = await resolveRequirements();
    await getCurrentFileClasspath(); // called here to optimize startup time
    workspace.showMessage(
      `${PLUGIN_NAME} using Java from ${requirements.java_home}, version: ${requirements.java_version}`,
      'more'
    );
    return startLanguageServer(context, requirements);
  } catch (e) {
    const res = await workspace.showQuickpick(['Yes', 'No'], `${e.message}, ${e.label}?`);
    if (res == 0) {
      commands.executeCommand(Commands.OPEN_BROWSER, e.openUrl).catch(() => {
        // noop
      });
    }
  }
}

export function deactivate(): void {
  languageClientDisposable.dispose();
  languageClient = null;
}

function getStoragePath(context: ExtensionContext): string {
  let workspacePath = context.storagePath;
  if (!workspacePath) {
    workspacePath = getTempWorkspace();
  }

  const id = createHash('md5').update(workspace.root).digest('hex');
  const workspaceName = `groovy_ws_${id}`;
  return path.resolve(workspacePath, workspaceName);
}

async function startLanguageServer(context: ExtensionContext, requirements: RequirementsData): Promise<void> {
  const clientOptions = getClientOptions(updateClasspath);
  const serverOptions = await getServerOptions(context, requirements);
  languageClient = new LanguageClient(GROOVY, PLUGIN_NAME, serverOptions, clientOptions);
  languageClient.registerProposedFeatures();

  languageClient.onReady().then(
    () => {
      workspace.showMessage(`${PLUGIN_NAME} started!`);
      registerCommands(context);
    },
    (e) => {
      context.logger.error(e.message);
    }
  );

  workspace.showMessage(`${PLUGIN_NAME} starting...`);
  languageClientDisposable = languageClient.start();
}

function registerCommands(context: ExtensionContext): void {
  context.subscriptions.push(commands.registerCommand(Commands.CONFIGURATION_UPDATE, updateProjectConfig));
}

async function updateProjectConfig(): Promise<void> {
  await updateClasspath(true);
  workspace.showMessage(`${PLUGIN_NAME} project config updated.`);
}

async function updateClasspath(forceUpdate?: boolean): Promise<void> {
  const classpath = await getCurrentFileClasspath(forceUpdate);
  const config = workspace.getConfiguration(GROOVY);
  const groovy = { ...config, classpath };
  // The Groovy language server only loads the classpath from a config change notification.
  // Ideally this would also be loaded with initializationOptions too.
  languageClient?.sendNotification(DidChangeConfigurationNotification.type, {
    settings: { groovy },
  });
}

async function getCurrentFileClasspath(forceUpdate = false): Promise<string[]> {
  const { document } = await workspace.getCurrentState();
  const uri = Uri.parse(document.uri);
  const filepath = uri.fsPath;
  return await getClasspath(storagePath, filepath, forceUpdate);
}
