import { LanguageClientOptions, workspace } from 'coc.nvim'
import { GROOVY } from './constants'

export function getClientOptions(): LanguageClientOptions {
  const config = workspace.getConfiguration(GROOVY)

  return {
    documentSelector: [{ scheme: 'file', language: GROOVY }],
    synchronize: {
      configurationSection: GROOVY
    },
    initializationOptions: {
      settings: { groovy: config }
    }
  }
}
