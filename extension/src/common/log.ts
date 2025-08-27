/* eslint-disable no-console */
const LogLevel = {
  /** 追踪日志 */
  Trace: 0,
  /** 普通日志 */
  Info: 1,
  /** 警告日志 */
  Warning: 2,
  /** 错误日志 */
  Error: 3,
} as const
type LogLevelType = typeof LogLevel[keyof typeof LogLevel];
const Styles = ['color: black;', 'color: green;', 'color: orange;', 'color: red;']
const Methods = ['log', 'info', 'warn', 'error'] as const
const log = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  trace: console.trace,
}
/**
 * 日志的配置类型
 */
interface LoggerConfigType {
  /** 命名空间 */
  namespace: string
}
/**
 * 拦截器函数类型
 */
type InterceptorFuncType = (config: LoggerConfigType) => void

const isLogEnabled = true

const CurrentLogLevel: LogLevelType = (() => {
  const level = localStorage.getItem('LogLevel')
  if (level == null) return LogLevel.Info
  if (level === 'Trace') return LogLevel.Trace
  if (level === 'Info') return LogLevel.Info
  if (level === 'Warning') return LogLevel.Warning
  if (level === 'Error') return LogLevel.Error
  return LogLevel.Info
})()

/**
 * 日志打印工具，统一管理日志输出&上报
 */
export class Logger {
  /** 命名空间（scope），用于区分所在执行文件 */
  private readonly beforeFuncs: InterceptorFuncType[] = []
  private readonly afterFuncs: InterceptorFuncType[] = []
  public static moduleName: string = ''
  private readonly config: LoggerConfigType = {
    namespace: 'Bilibili',
  }

  constructor (namespace = 'unknown') {
    this.config.namespace = `[${namespace}]`
  }

  /**
   * 创建新的 Logger 实例
   *
   * @param namespace 命名空间
   * @returns Logger
   */
  public create (namespace = 'unknown') {
    return new Logger(namespace)
  }

  private _log (level: LogLevelType, args: unknown[]) {
    if (!isLogEnabled) return
    // 优先级小的不显示
    if (level < CurrentLogLevel) return
    this.beforeFuncs.forEach(e => e(this.config))
    log[Methods[level]](`%c[${Logger.moduleName}]${this.config.namespace}`, Styles[level], ...args)
    this.afterFuncs.forEach(e => e(this.config))
  }

  /**
   * 添加拦截器
   * @param func 拦截器
   * @param isBefore 是否日志之前
   * @returns this
   */
  public addInterceptor (func: InterceptorFuncType, isBefore = true) {
    if (typeof func !== 'function')
      return this.error('拦截器函数不符合规范')
    if (isBefore) {
      this.beforeFuncs.push(func)
      return this
    }
    this.afterFuncs.push(func)
    return this
  }

  /**
   * 添加日志打印之前的拦截函数
   *
   * @param func 拦截器
   * @returns this
   */
  public addBeforeInterceptor (func: InterceptorFuncType) {
    this.beforeFuncs.push(func)
    return this
  }

  /**
   * 添加日志打印之后的拦截函数
   *
   * @param func 拦截器
   * @returns this
   */
  public addAfterInterceptor (func: InterceptorFuncType) {
    this.afterFuncs.push(func)
    return this
  }

  /**
   * 打印追踪信息 🐛
   *
   * @param args 任意参数
   */
  public trace (...args: unknown[]) {
    this._log(LogLevel.Trace, args)
    return this
  }

  /**
   * 打印输出信息 🐛
   *
   * @param args 任意参数
   */
  public info (...args: unknown[]) {
    this._log(LogLevel.Info, args)
    return this
  }

  /**
   * 打印输出警告信息 ❕
   *
   * @param args 任意参数
   */
  public warn (...args: unknown[]) {
    this._log(LogLevel.Warning, args)
    return this
  }

  /**
   * 打印输出错误信息 ❌
   *
   * @param args 任意参数
   */
  public error (...args: unknown[]) {
    this._log(LogLevel.Error, args)
    return this
  }

  /**
   * 设置命名空间（日志前缀）
   * @param namespace
   */
  public setNamespace (namespace = '') {
    this.config.namespace = `[${namespace}]`
    return this
  }
}

// export const nanoLog = new Logger()

export const createLogger = (namespace?: string) => {
  return new Logger(namespace)
}
