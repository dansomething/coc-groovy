import { NotificationType } from 'vscode-languageserver-protocol'

export interface Initialized {
}

export namespace InitializedNotification {
  export const type = new NotificationType<Initialized, never>('workspace/didChangeConfiguration')
}

export interface DidChangeConfiguration {
}

export namespace ProgressReportNotification {
  export const type = new NotificationType<DidChangeConfiguration, never>('workspace/didChangeConfiguration')
}
