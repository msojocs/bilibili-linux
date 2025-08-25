import { createLogger, Logger } from "../common/log"
import { replaceFetch, replaceXMLHttpRequest } from "../document/replace"

(() => {
  Logger.moduleName = 'Search'
  const log = createLogger('Entry')
  log.info('replace XMLHttpRequest...')
  replaceXMLHttpRequest()
  log.info('replace fetch...')
  replaceFetch()
})()