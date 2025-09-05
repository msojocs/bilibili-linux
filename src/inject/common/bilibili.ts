import { createLogger } from "../../common/log";
import https from "https";
import path from "path";
import fs from "fs";
import { app } from "electron";

const log = createLogger("Bilibili");
export const createBilibiliServer = () => {
  // 创建https服务器
  const server = https.createServer(
    {
      key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC19oO8fx2YxkOt\nGoeqffhsXRfFvq/mhkA+9cp+NfV+TaKs8Ap7n3w2I97JwYUbtKYIfL+z/1GHOS5f\np8kJaVcFMxx8iowW5/bitReeHC1T+MCqOynrXfhU54DNJVkGhXsWAxwAoHzDVUh9\nax248EWJR3wrTVuCIK3NM1iFs2KItQNa9CcyLtzXsHfKifGu0Se7aDJNIVR3R4B4\nQtvFzbEfLr3kvq0QGAnBeZ00blPE19lB4dIHi4aPeQz5H0bySpvmCW7rDaoCsoJ0\nwv/MtZanZjORephlY3E7lziUpL1toF4qowB5Ogb20+r8Vwkc3ONgjMpOmH3ze6ki\n+WXPEFNTAgMBAAECggEBAJjgXPvAPIh/gppr4LFwFohMik18EOL3xgBfltoE0ZVk\n+pibL+N/Med2qZYOfZuyYZBd5t3+U2vtsbVyDShYFWFr+LH14Q7ZooYEKayP9dFH\n++7JuEVj9OC4g3FXwH0HJktvH1azfz7JZxbgKN+ZFoLoyTzESG6CsCLn0aa6+Lzr\nFRPqLM8TRZKjfl5dYy6z8nEVWWA+ow1MTsaEq0aNpeBsYePjz/181jpQV5OrQe/+\nl/LqzUU53iSOU1ZAoruhzeJ0/aGfYjG/QdphNWuK6a2590kETxWoDiz7Z1m82Vx6\n1FrOY5Dr8/+dzgFLdrQkKz+DGpUlnnA+6wGw6K7MlUECgYEA2QfmC8AoHf5Du4K/\nS6JpnczvqxwTEXPMKwMNDRAxXmXyvi2PszkpLGwvP2pZYlK6D20FtOW1uVtp5jiN\nyQ0J42P83KlYQeBNvV7flgSZW7ImO8u5JO8UybbNelu+B/OKqSR9ZoHXZRzG4bYU\nlaKQxIoXG6l7IieDN0TLPgv6EfMCgYEA1qKsuh+M61EFSosIPb5fhvg/2/TeizDm\nZRvG8Zju/e6tikewGW0XLRVb1trSBFu6Ijf41QsTZRxh37FjYRPN/XF6sRHpr3Ni\nRmaQch+0BcQaU4v+WSbCnGR9nyi3O8hCPC713UrusNfokXRf6z5ARtLvDwfBU2tQ\nDCLtMmypsSECgYEAqm/chj/agWtrr7cHGZOrU8RcN0kt5FfG78ROnIKp8pMnZZiM\nMFhkcEFpfWi8V03WVkTs5Vo8MxuJ98VT+57ktBGSw4uuBtXq1xvJhJuKAAvQoMbl\nWA71iU+o4D1p5/6nVxuT60tuZzaJLTp7weNPwzka2ptnWrQjBOVeoxRux2cCgYAD\n7u09Z/CcK1rud8fJ4eA8R/ZboIwnftjqB21I5iWTD7msbA3lGWOwVtDdChuJKukp\nUV9FADP1yWRdxhFtKQDAYUD/V7Wxmmq1oZGKFdylsmdNGqapmZU9anYG4ach+FSG\nZ9HnoUTohrxjVf+f/v8MjTcGTn0Te0b3QfiY0Pb3IQKBgFhRUMasW/MnIFg1IfYU\nkVtMEJpajml9tEEQ91bBr29bCxl+nM2bM9yjb6LQU0vYTyWNn3zS/LOa3gSbOC/i\nc+3fmiI6TpouNE1eBva6kKyvmqC4dwD6aTEHokfhuMFYZQbVC8IGuhEQuN9OIM9x\nTQg6mubcOzaGBUeTmeZTkCpb\n-----END PRIVATE KEY-----\n",
      cert: "-----BEGIN CERTIFICATE-----\nMIIEPzCCAyegAwIBAgIUJVg1qdKcUuryV+2IxAn9teS5qu0wDQYJKoZIhvcNAQEL\nBQAwga0xCzAJBgNVBAYTAkNOMREwDwYDVQQIDAhTaGFuZ0hhaTERMA8GA1UEBwwI\nU2hhbmdIYWkxLzAtBgNVBAoMJlNoYW5naGFpIEJpbGliaWxpIFRlY2hub2xvZ3kg\nQ28uLCBMdGQuMREwDwYDVQQLDAhiaWxpYmlsaTEPMA0GA1UEAwwGYmlsaXBjMSMw\nIQYJKoZIhvcNAQkBFhRzaGVudGFvQGJpbGliaWxpLmNvbTAgFw0yMzEwMjQwNTIy\nMTNaGA8yMTIzMDkzMDA1MjIxM1owga0xCzAJBgNVBAYTAkNOMREwDwYDVQQIDAhT\naGFuZ0hhaTERMA8GA1UEBwwIU2hhbmdIYWkxLzAtBgNVBAoMJlNoYW5naGFpIEJp\nbGliaWxpIFRlY2hub2xvZ3kgQ28uLCBMdGQuMREwDwYDVQQLDAhiaWxpYmlsaTEP\nMA0GA1UEAwwGYmlsaXBjMSMwIQYJKoZIhvcNAQkBFhRzaGVudGFvQGJpbGliaWxp\nLmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALX2g7x/HZjGQ60a\nh6p9+GxdF8W+r+aGQD71yn419X5NoqzwCnuffDYj3snBhRu0pgh8v7P/UYc5Ll+n\nyQlpVwUzHHyKjBbn9uK1F54cLVP4wKo7Ketd+FTngM0lWQaFexYDHACgfMNVSH1r\nHbjwRYlHfCtNW4Igrc0zWIWzYoi1A1r0JzIu3Newd8qJ8a7RJ7toMk0hVHdHgHhC\n28XNsR8uveS+rRAYCcF5nTRuU8TX2UHh0geLho95DPkfRvJKm+YJbusNqgKygnTC\n/8y1lqdmM5F6mGVjcTuXOJSkvW2gXiqjAHk6BvbT6vxXCRzc42CMyk6YffN7qSL5\nZc8QU1MCAwEAAaNTMFEwHQYDVR0OBBYEFNCVw8dStnHz5VY1MEIDI8dPR9t2MB8G\nA1UdIwQYMBaAFNCVw8dStnHz5VY1MEIDI8dPR9t2MA8GA1UdEwEB/wQFMAMBAf8w\nDQYJKoZIhvcNAQELBQADggEBAAiisyz9WJNmyYthp7hRHxt8ptV8UefFOVt1oJfE\nuicHBoXBCWKOb2sYbJUOnpPQrCGTLxa0sDUXu1OvwJP2YrKhbiW4ZLefWlVM/Rx0\nJpcbbVvrR5puMfwxKrW5HT+Uafq/bFe/fJPTdHmLU9vAqkAcqZxrPhNjz1O88wp4\ntuyLcVxHcwr4ZvHFcCMo+Gkph76QY8clcOtyTF3p3U2HCFGu3I8WvJcEexjjanx6\nztZgsc9zCVdDWS5RFsEMXPj9+vTvLuo1S6z0UhMnKo4yYBCb/6gmJRJMrZ7beifP\niVFRvhO43BAkKW04hRC/nsliqcedqetuZbpTjq98g9eEDow=\n-----END CERTIFICATE-----\n",
    },
    (req, res) => {
      const renderPath = path.resolve(__dirname, "./render");
      const url = req.url?.split("?")[0];
      const p = path.resolve(renderPath, `.${url}`);
      log.info(url);
      if (url?.endsWith(".js")) {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      }
      res.writeHead(200);
      res.write(fs.readFileSync(p));
      res.end();
    }
  );
  server.listen(3031);
  app.commandLine.appendSwitch(
    "host-rules",
    "MAP bilipc.bilibili.com localhost:3031"
  );
};
