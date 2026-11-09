// Called locally by home_relay.py. Private snapshots travel over stdin, never argv.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';

let client;
try {
  const credentials = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const { default: Redis, AbstractConnector } = await import(pathToFileURL(process.argv[3]).href);
  class ProxyConnector extends AbstractConnector {
    constructor(options) {
      super(options.disconnectTimeout);
      this.options = options;
    }
  
    connect() {
      this.connecting = true;
      const { host, port, proxyUrl, connectTimeout } = this.options;
      const proxy = new URL(proxyUrl);
      const transport = proxy.protocol === 'https:' ? https : http;
      return new Promise((resolve, reject) => {
        const headers = { Host: `${host}:${port}` };
        if (proxy.username || proxy.password) {
          const credentials = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`;
          headers['Proxy-Authorization'] = `Basic ${Buffer.from(credentials).toString('base64')}`;
        }
        const request = transport.request({
          hostname: proxy.hostname,
          port: proxy.port || (proxy.protocol === 'https:' ? 443 : 80),
          method: 'CONNECT',
          path: `${host}:${port}`,
          headers,
          agent: false,
        });
        this.request = request;
        const deadline = setTimeout(() => request.destroy(new Error('redis_proxy_timeout')), connectTimeout);
        request.once('error', error => { clearTimeout(deadline); reject(error); });
        request.once('connect', (response, socket, head) => {
          clearTimeout(deadline);
          if (response.statusCode !== 200 || !this.connecting) {
            socket.destroy();
            reject(new Error(`redis_proxy_connect_${response.statusCode}`));
            return;
          }
          if (head.length) socket.unshift(head);
          this.stream = tls.connect({ socket, servername: host, rejectUnauthorized: true });
          const stream = this.stream;
          stream.setTimeout(connectTimeout, () => stream.destroy(new Error('redis_tls_timeout')));
          stream.once('secureConnect', () => stream.setTimeout(0));
          this.stream.once('error', error => { this.firstError = error; });
          // ioredis attaches its own secureConnect, timeout and error listeners.
          resolve(this.stream);
        });
        request.end();
      });
    }
  
    disconnect() {
      this.request?.destroy();
      super.disconnect();
    }
  }
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy ||
    process.env.HTTP_PROXY || process.env.http_proxy;
  if (proxyUrl && !['http:', 'https:'].includes(new URL(proxyUrl).protocol)) {
    throw new Error('unsupported_proxy_protocol');
  }
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const command = JSON.parse(input);
  if (command[0] !== 'EVAL' || command[2] !== 1 || !command[3]) {
    throw new Error('invalid_home_publish_command');
  }
  client = new Redis({
    host: credentials.host, port: credentials.port, password: credentials.password,
    tls: { servername: credentials.host, rejectUnauthorized: true },
    ...(proxyUrl ? { Connector: ProxyConnector, proxyUrl } : {}), lazyConnect: true,
    connectTimeout: 10000, commandTimeout: 10000, maxRetriesPerRequest: 0,
    retryStrategy: () => null, enableOfflineQueue: false, enableReadyCheck: false,
    autoResendUnfulfilledCommands: false, disableClientInfo: true, protocol: 2,
  });
  client.on('error', () => {});
  await client.connect();
  const result = await client.eval(...command.slice(1));
  process.stdout.write(JSON.stringify({ result }));
} catch (error) {
  process.stderr.write(JSON.stringify({ error: error.name || 'PublishError' }));
  process.exitCode = 1;
} finally {
  client?.disconnect();
}
