import { DidChangeConfigurationSignature, LanguageClientOptions, workspace } from 'coc.nvim';
import { GROOVY } from './constants';

export function getClientOptions(onConfigChange: () => void): LanguageClientOptions {
  const config = workspace.getConfiguration(GROOVY);

  return {
    diagnosticCollectionName: GROOVY,
    documentSelector: [{ scheme: 'file', language: GROOVY }],
    synchronize: {
      configurationSection: GROOVY,
    },
    initializationOptions: {
      settings: { groovy: config },
    },
    middleware: {
      workspace: {
        didChangeConfiguration: (sections: string[] | undefined, next: DidChangeConfigurationSignature): void => {
          if (sections?.length == 1 && sections[0] === GROOVY) {
            onConfigChange();
          } else {
            next(sections);
          }
        },
      },
    },
  };
}
