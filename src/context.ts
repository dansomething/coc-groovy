import { ExtensionContext } from 'coc.nvim';
import { Logger } from 'log4js';

let _context: ExtensionContext;

export function getContext(): ExtensionContext {
  return _context;
}

export function setContext(context: ExtensionContext) {
  _context = context;
}

export function getLogger(): Logger {
  return _context.logger;
}
