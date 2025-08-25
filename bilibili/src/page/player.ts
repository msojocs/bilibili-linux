import { createLogger, Logger } from "../common/log"
import { replaceFetch, replaceXMLHttpRequest } from "../document/replace"

export const initPlayerPage = () => {
  Logger.moduleName = 'Player'
  const log = createLogger('Entry')
  log.info('replace XMLHttpRequest...')
  replaceXMLHttpRequest()
  log.info('replace fetch...')
  replaceFetch()
}