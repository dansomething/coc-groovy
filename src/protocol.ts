import { NotificationType } from 'vscode-languageserver-protocol';

export namespace ProgressReportNotification {
  export const type = new NotificationType<any, never>('workspace/didChangeConfiguration');
}
