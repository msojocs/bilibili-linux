import { Button, Popconfirm, QRCode } from "antd"
import { useState, useMemo } from "react"
import { BiliBiliApi } from "../../../common/bilibili-api"
import { createLogger } from "../../../common/log"

const log = createLogger('HDLogin')
export default function HDLogin() {
  const [qrCode, setQrCode] = useState('')
  const [tokenInfo, setTokenInfo] = useState({
        access_token: '',
        expires_at: 0,
    })
  const startHDLogin = async function () {
    log.info('HD Login')
    const login = new BiliBiliApi()
    try {
      log.info('获取登录二维码')
      const qr = await login.HD_getLoginQrCode()
      setQrCode(qr.data.url)
      let t = window.setInterval(async () => {
        log.info('获取扫码结果')
        const ret = await login.HD_pollCheckLogin(qr.data.auth_code)
        log.info('扫码结果：', ret)
        if (ret.code === 0) {
          setQrCode('')
          ret.data.token_info.expires_at = Date.now() / 1000 + ret.data.token_info.expires_in
          localStorage.setItem('bili_accessToken_hd', JSON.stringify(ret.data.token_info))
          setTokenInfo(ret.data.token_info)
          clearInterval(t)
          t = 0
        }
      }, 2000)
    }
    catch (e) {
      log.error('HD Login Error:', e)
    }
  }
  const deleteHDLogin = function () {
    localStorage.removeItem('bili_accessToken_hd')
    setTokenInfo({
      access_token: '',
      expires_at: 0,
    })
  }
  const tokenData = useMemo(() => {
    const ret = {
      msg: '',
      expired: true,
    }
    if (!tokenInfo) ret.msg = '本地没有token数据！'
    if (tokenInfo && tokenInfo.expires_at) {
      const expiredAt = new Date(tokenInfo.expires_at * 1000)
      if (expiredAt.getTime() < Date.now()) {
        ret.msg = `token已过期`
        ret.expired = true
      }
      else {
        ret.expired = false
        ret.msg = `过期时间：${expiredAt.toLocaleString()}`
      }
    }
    return ret
  }, [tokenInfo])
  return (
    <>
    <div className="settings_content--item upos-item">
      <h4>Access Token管理</h4>
      <div>
        <p><strong>AccessToken用于获取外区番剧的播放链接。</strong></p>
        <div>
          {
            tokenData.expired ? (<Button onClick={startHDLogin} type="primary">HD登录</Button>)
              :
              (<Popconfirm
                v-else
                title="你确定要删除吗？"
                onConfirm={deleteHDLogin}
              >
                <Button danger>删除</Button>
              </Popconfirm>
              )
          }
          <span>&nbsp;&nbsp;{tokenData.msg}</span>
          {
            qrCode && (<div>
              <QRCode value={qrCode} />
            </div>)
          }
        </div>
      </div>
    </div>
    </>
  )
}