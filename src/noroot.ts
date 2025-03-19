import { StaticFeature, workspace } from 'coc.nvim';
import { InitializeParams } from 'vscode-languageserver-protocol';
import { GROOVY } from './constants';
import * as Settings from './settings';

/**
 * Feature to support Groovy language server features on `.groovy` files that don't have a workspace root.
 */
export class NoRootFeature implements StaticFeature {
  public fillInitializeParams(params: InitializeParams): void {
    const config = workspace.getConfiguration(GROOVY);
    const isNoRoot = config.get<boolean>(Settings.LS_FEATURE_NOROOT, false);
    if (isNoRoot) {
      // When the rootPath is null, the Groovy language server will not resolve workspace folders.
      // Instead, it will track and compile individual opened files.
      params.rootPath = null;
      params.rootUri = null;
    }
  }

  public fillClientCapabilities(): void {}

  public initialize(): void {}

  public dispose(): void {}
}
