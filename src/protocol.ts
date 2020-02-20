import { NotificationType } from 'vscode-languageserver-protocol'

export interface StatusReport {
  message: string
  type: string
}

export interface ProgressReport {
  id: string
  task: string
  subTask: string
  status: string
  workDone: number
  totalWork: number
  complete: boolean
}

export namespace ProgressReportNotification {
  export const type = new NotificationType<ProgressReport, never>('language/progressReport')
}

export namespace StatusNotification {
  export const type = new NotificationType<StatusReport, never>('language/status')
}
