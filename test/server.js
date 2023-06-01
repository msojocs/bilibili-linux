const net = require('net')
const http = require('http')
const https = require('https')

const orgiCreateServer = net.createServer 
net.createServer = function() {
  console.log('create server:', ...arguments)
  orgiCreateServer.apply(this, arguments)
}

const orgiHttpCreateServer = http.createServer
http.createServer = function() {
  console.log('http createServer:', ...arguments)
  return orgiHttpCreateServer.apply(this, arguments)
}

const orgiHttpsCreateServer = https.createServer
https.createServer = function() {
  console.log('https createServer:', ...arguments)
  return orgiHttpsCreateServer.apply(this, arguments)
}

const orgiRequest = http.request
http.request = function() {
  console.log('http request:', ...arguments)
  return orgiRequest.apply(this, arguments)
}
const orgiHttpsRequest = https.request
https.request = function() {
  console.log('https request:', ...arguments)
  return orgiHttpsRequest.apply(this, arguments)
}

const serverPort = 22332
// 有请求就创建一个tcp链接
net.createServer(client => {
  client.on('error', error => console.log('client', error))

  client.on('data', req => {
   // 请求的处理
   let content = req.toString()
   content = content.replace('localhost:' + serverPort, 'pic.bstarstatic.com')
   content = content.replace(/Referer:.*?\r\n/, '')
   console.log('req: ', content)

    // 创建与b服务的链接
    const bSserve = new net.Socket()
    bSserve.connect(80, 'pic.bstarstatic.com')
    bSserve.on('error', error => console.log('bSserve', error))

    // 把请求发送给b服务器
    bSserve.write(content)
    
    bSserve.on('data', res => {
     // 响应的处理
     const content = res.toString()
    //  console.log('resp: ', content)

      // 把响应发送给客户端
      client.write(res)
    })
  })
}).listen(serverPort)
