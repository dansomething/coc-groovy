import { Executable } from 'coc.nvim'
import * as glob from 'glob'
import * as path from 'path'
import { PLUGIN_NAME } from './constants'
import { RequirementsData, ServerConfiguration } from './requirements'
import { DEBUG, JAVA_FILENAME } from './system'

export function prepareExecutable(requirements: RequirementsData, config: ServerConfiguration): Executable {
  const executable: Executable = Object.create(null)
  const options = Object.create(null)
  options.env = process.env
  options.stdio = 'pipe'
  executable.options = options
  executable.command = path.resolve(requirements.java_home, 'bin', JAVA_FILENAME)
  executable.args = prepareParams(config)
  // tslint:disable-next-line: no-console
  console.log(`Starting ${PLUGIN_NAME} with: ` + executable.command + ' ' + executable.args.join(' '))
  return executable
}

function prepareParams(config: ServerConfiguration): string[] {
  const params: string[] = []
  if (DEBUG) {
    params.push('-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=localhost:1044,quiet=y')
    // suspend=y is the default. Use this form if you need to debug the server startup code:
    //  params.push('-agentlib:jdwp=transport=dt_socket,server=y,address=localhost:1044')
    params.push('-Dlog.level=ALL')
  }

  const { vmargs, root } = config
  const encodingKey = '-Dfile.encoding='
  if (vmargs.indexOf(encodingKey) < 0 && config.encoding) {
    params.push(encodingKey + config.encoding)
  }

  parseVmArgs(params, vmargs)
  const jarsFound: string[] = glob.sync('**/groovy-language-server-all.jar', { cwd: root })
  if (jarsFound.length) {
    params.push('-jar')
    params.push(path.resolve(root, jarsFound[0]))
  } else {
    return null
  }

  return params
}

// exported for tests
export function parseVmArgs(params: any[], vmargsLine: string): void {
  if (!vmargsLine) {
    return
  }
  const vmargs = vmargsLine.match(/(?:[^\s"]+|"[^"]*")+/g)
  if (vmargs === null) {
    return
  }
  vmargs.forEach(arg => {
    // remove all standalone double quotes
    // tslint:disable-next-line: only-arrow-functions typedef
    arg = arg.replace(/(\\)?"/g, function($0, $1) { return ($1 ? $0 : '') })
    // unescape all escaped double quotes
    arg = arg.replace(/(\\)"/g, '"')
    if (params.indexOf(arg) < 0) {
      params.push(arg)
    }
  })
}
