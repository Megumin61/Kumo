import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import {createGunzip, createInflate, createBrotliDecompress} from 'node:zlib';

// Public X pages and their media only. Never forward browser cookies or accept
// arbitrary destinations through the loopback bridge.
export function checkRemoteUrl(value, hosts) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !hosts.includes(url.hostname)) {
    throw new Error('remote_url_not_allowed');
  }
  return url;
}

function proxyFor(url, env) {
  const bypass = String(env.NO_PROXY || env.no_proxy || '').split(',').map(value => value.trim()).filter(Boolean);
  if (bypass.some(host => host === '*' || url.hostname === host || url.hostname.endsWith(host.startsWith('.') ? host : `.${host}`))) return null;
  const value = env.HTTPS_PROXY || env.https_proxy || env.ALL_PROXY || env.all_proxy;
  if (!value) return null;
  const proxy = new URL(value);
  if (!['http:', 'https:'].includes(proxy.protocol)) throw new Error('unsupported_proxy_protocol');
  return proxy;
}

function tunnelAgent(proxy, timeout) {
  const agent = new https.Agent({keepAlive: false});
  agent.createConnection = (options, callback) => {
    const headers = {Host: `${options.host}:${options.port || 443}`};
    if (proxy.username) headers['Proxy-Authorization'] = `Basic ${Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`).toString('base64')}`;
    const connect = (proxy.protocol === 'https:' ? https : http).request(proxy, {
      method: 'CONNECT', path: `${options.host}:${options.port || 443}`, headers
    });
    let settled = false;
    const finish = (error, socket) => {
      if (settled) { if (error) socket?.destroy(); return; }
      settled = true;
      callback(error, socket);
    };
    connect.setTimeout(timeout, () => connect.destroy(new Error('proxy_connect_timeout')));
    connect.once('error', error => finish(error));
    connect.once('connect', (response, socket, head) => {
      if (response.statusCode !== 200) { socket.destroy(); finish(new Error(`proxy_http_${response.statusCode}`)); return; }
      if (head.length) socket.unshift(head);
      const secure = tls.connect({socket, servername: options.host});
      secure.setTimeout(timeout, () => secure.destroy(new Error('remote_timeout')));
      secure.once('secureConnect', () => finish(null, secure));
      secure.once('error', error => finish(error));
    });
    connect.end();
  };
  return agent;
}

export async function publicGet(value, {hosts = ['x.com', 'twitter.com', 'video.twimg.com'], maxBytes = 80 * 1024 * 1024, timeout = 45000, env = process.env, redirects = 3, onProgress} = {}) {
  const url = checkRemoteUrl(value, hosts);
  const proxy = proxyFor(url, env);
  const agent = proxy ? tunnelAgent(proxy, Math.min(timeout, 15000)) : new https.Agent({keepAlive: false});
  try {
    const result = await new Promise((resolve, reject) => {
      const request = https.get(url, {
        agent,
        headers: {Accept: url.hostname === 'video.twimg.com' ? '*/*' : 'text/html', 'Accept-Encoding': 'gzip, deflate, br', 'User-Agent': 'Kumo/0.8 public-content-clipper'}
      }, response => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
          response.resume();
          resolve({redirect: new URL(response.headers.location, url).href});
          return;
        }
        if (response.statusCode !== 200) { response.resume(); reject(new Error(`remote_http_${response.statusCode}`)); return; }
        if (Number(response.headers['content-length'] || 0) > maxBytes) { response.destroy(); reject(new Error('media_too_large')); return; }
        let stream = response;
        const encoding = response.headers['content-encoding'];
        if (encoding === 'gzip') stream = response.pipe(createGunzip());
        else if (encoding === 'deflate') stream = response.pipe(createInflate());
        else if (encoding === 'br') stream = response.pipe(createBrotliDecompress());
        const chunks = [];
        let size = 0;
        stream.on('data', chunk => {
          size += chunk.length;
          if (size > maxBytes) { stream.destroy(); response.destroy(); reject(new Error('media_too_large')); return; }
          chunks.push(chunk);
          onProgress?.(size, Number(response.headers['content-length'] || 0));
        });
        response.once('aborted', () => reject(new Error('remote_response_truncated')));
        stream.once('error', reject);
        stream.once('end', () => resolve({bytes: Buffer.concat(chunks), type: response.headers['content-type'] || 'application/octet-stream'}));
      });
      const timer = setTimeout(() => request.destroy(new Error('remote_timeout')), timeout);
      request.once('close', () => clearTimeout(timer));
      request.once('error', reject);
    });
    if (result.redirect) {
      if (!redirects) throw new Error('too_many_redirects');
      return publicGet(result.redirect, {hosts, maxBytes, timeout, env, redirects: redirects - 1, onProgress});
    }
    return result;
  } finally {
    agent.destroy();
  }
}
