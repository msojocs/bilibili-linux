import { createLogger, Logger } from "../common/log";
import { ResponseReplaceXMLHttpRequest } from "./response-replace";
/* eslint-disable @typescript-eslint/no-explicit-any */
export class CustomXMLHttpRequest extends window.XMLHttpRequest {
  private _url: string;
  _params: string;
  private _status: number;
  _response: null;
  private _responseText: string;
  private _onreadystatechange: ((this: XMLHttpRequest, ev: Event) => any) | null;
  private _onloadend: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => any) | null;
  private _onload: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => any) | null;
  log: Logger;
  static get isHooked() {
    return true
  }
  constructor() {
    super();
    this._url = "";
    this._params = "";
    this._status = 200
    this._responseText = ''
    this._response = null

    this._onreadystatechange = null;
    this._onloadend = null;
    this._onload = null;
    this.log = createLogger('CustomXMLHttpRequest')
    super.onloadend = async (ev) => {
      if (this._onloadend) {
        const replace: any = ResponseReplaceXMLHttpRequest
        if (replace[this._url]) await replace[this._url](this)
        this._onloadend(ev);
      }
    };
    super.onload = async (ev) => {
      if (this._onload) {
        const replace: any = ResponseReplaceXMLHttpRequest
        // log.log('onload', this._url)
        if (replace[this._url]) await replace[this._url](this)
        this._onload(ev);
      }
    };
    super.onreadystatechange = (ev) => {
      this.log.info(ev)
      if (this.readyState === 4 && this.status === 200) {
        // log.log('onreadystatechange', this, super.responseType)
        switch (super.responseType) {
          case 'text':
          case '': {
            const responseText = super.responseText;
            if (responseText) {
              //   log.log(responseText)
              //   const res = null;
              //   if (res !== null) {
              //     this.responseText = res
              //   } else {
              //     this.responseText = super.responseText
              //   }
              // } else {
              this.responseText = responseText
            }
          }
            break;
          case 'json': {
            const response = super.response;
            if (response) {
              //   const res = null;
              //   if (res !== null) {
              //     this.response = res
              //   } else {
              //     this.response = super.response
              //   }
              // } else {
              this.response = response
            }
          }
            break;
          default:
            // console.warn('unsupported type:', super.responseType)
            break;
        }
      }
      // 用于arraybuffer等
      try {
        if (super.responseType === 'arraybuffer')
          this.response = super.response
      } catch (e) {
        this.log.error('响应体处理异常：', e)
      }
      try {
        
        const replace: any = ResponseReplaceXMLHttpRequest
        if (this._onreadystatechange) {
          // debugger
          if (this.readyState === 4 && replace[this._url]) replace[this._url](this).then(() => this._onreadystatechange?.(ev))
          else
            this._onreadystatechange(ev);
        }
      } catch (err) {
        this.log.info('未处理的error: ', err)
      }
    };
  }
  get response() {
    if (this._response === null) return super.response
    return this._response
  }
  set response(v) {
    this._response = v
  }

  get responseText() {
    return this._responseText
  }
  set responseText(v) {
    this._responseText = v
  }

  get status() {
    return this._status
  }
  set status(v) {
    this._status = v
  }

  send(body?: Document | XMLHttpRequestBodyInit | null) {
    // log.log('send:', ...arguments)
    // if (arr[0]) {
    // const params = null;
    // if (params !== null) {
    //   arr[0] = params
    // }
    // }
    return super.send(body)
  }

  open(...args: any[]) {
    // log.log('request for: ', ...arr)
    const url = args[1]
    if (typeof url == 'string') {
      const [path, params] = url.split(/\?/);
      this._url = path;
      this._params = params;
      // if (this._params) {
      // const params = null;
      // if (params !== null) {
      //   arr[1] = this._url + "?" + params
      // }
      // }
    }
    return (super.open as any)(...args)
  }

  set onreadystatechange(v: ((this: XMLHttpRequest, ev: Event) => any) | null) {
    this._onreadystatechange = v
  }
  set onloadend(v: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => any) | null) {
    this._onloadend = v
  }
  set onload(v: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => any) | null) {
    this._onload = v
  }

  // onload(){
  //   log.log('onload', ...arguments)
  // }
}