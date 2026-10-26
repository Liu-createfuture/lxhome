'use strict';

/**
 * 极简 WebSocket 服务端（仅用 Node 内置模块实现，零依赖）
 * 只覆盖本项目需要的部分：文本帧、分片重组、ping/pong、close。
 * 对外接口与 ws 库保持兼容：new WebSocketServer({ server })、ws.send/on/ping/terminate、wss.clients。
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const OP_CONT = 0x0;
const OP_TEXT = 0x1;
const OP_BINARY = 0x2;
const OP_CLOSE = 0x8;
const OP_PING = 0x9;
const OP_PONG = 0xa;

const MAX_MESSAGE = 64 * 1024; // 单条消息上限，超出直接断开

class WebSocket extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.isAlive = true;
    this._buf = Buffer.alloc(0);
    this._closed = false;
    this._fragments = [];
    this._fragSize = 0;

    try {
      socket.setNoDelay(true);
      socket.setTimeout(0);
    } catch {
      /* ignore */
    }

    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('close', () => this._onClose());
    socket.on('end', () => this._onClose());
    socket.on('error', () => this._onClose());
  }

  static get OPEN() {
    return 1;
  }
  static get CLOSED() {
    return 3;
  }

  get readyState() {
    return this._closed ? 3 : 1;
  }

  send(data) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
    this._sendFrame(OP_TEXT, buf);
  }

  ping() {
    this._sendFrame(OP_PING, Buffer.alloc(0));
  }

  close() {
    this._sendFrame(OP_CLOSE, Buffer.from([0x03, 0xe8])); // 1000 正常关闭
    this._teardown();
  }

  terminate() {
    this._teardown();
  }

  /* ---------------- 收包 ---------------- */

  _onData(chunk) {
    if (this._closed) return;
    this._buf = this._buf.length ? Buffer.concat([this._buf, chunk]) : chunk;
    let guard = 0;
    while (!this._closed && this._parseFrame()) {
      guard += 1;
      if (guard > 64) break;
    }
  }

  _parseFrame() {
    const buf = this._buf;
    if (buf.length < 2) return false;

    const b0 = buf[0];
    const b1 = buf[1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let offset = 2;

    if (len === 126) {
      if (buf.length < offset + 2) return false;
      len = buf.readUInt16BE(offset);
      offset += 2;
    } else if (len === 127) {
      if (buf.length < offset + 8) return false;
      const big = buf.readBigUInt64BE(offset);
      offset += 8;
      if (big > BigInt(MAX_MESSAGE)) {
        this._fail(1009);
        return false;
      }
      len = Number(big);
    }

    if (len > MAX_MESSAGE) {
      this._fail(1009);
      return false;
    }

    let mask = null;
    if (masked) {
      if (buf.length < offset + 4) return false;
      mask = buf.subarray(offset, offset + 4);
      offset += 4;
    }

    if (buf.length < offset + len) return false;

    let payload = buf.subarray(offset, offset + len);
    if (mask) {
      const out = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i += 1) out[i] = payload[i] ^ mask[i & 3];
      payload = out;
    }

    this._buf = buf.subarray(offset + len);
    this._handleFrame(fin, opcode, payload);
    return true;
  }

  _handleFrame(fin, opcode, payload) {
    if (opcode === OP_PING) {
      this._sendFrame(OP_PONG, payload);
      return;
    }

    if (opcode === OP_PONG) {
      this.isAlive = true;
      this.emit('pong');
      return;
    }

    if (opcode === OP_CLOSE) {
      this._sendFrame(OP_CLOSE, payload.subarray(0, 2));
      this._teardown();
      return;
    }

    if (opcode === OP_CONT) {
      this._fragments.push(payload);
      this._fragSize += payload.length;
      if (this._fragSize > MAX_MESSAGE) {
        this._fail(1009);
        return;
      }
      if (fin) {
        const full = Buffer.concat(this._fragments);
        this._fragments = [];
        this._fragSize = 0;
        this.emit('message', full);
      }
      return;
    }

    if (opcode === OP_TEXT || opcode === OP_BINARY) {
      if (!fin) {
        this._fragments = [payload];
        this._fragSize = payload.length;
        return;
      }
      this.emit('message', payload);
    }
  }

  /* ---------------- 发包 ---------------- */

  _sendFrame(opcode, payload) {
    if (this._closed) return;
    const len = payload.length;
    let header;

    if (len < 126) {
      header = Buffer.allocUnsafe(2);
      header[1] = len;
    } else if (len < 65536) {
      header = Buffer.allocUnsafe(4);
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.allocUnsafe(10);
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    header[0] = 0x80 | opcode;

    try {
      this.socket.write(Buffer.concat([header, payload]));
    } catch {
      this._teardown();
    }
  }

  _fail(code) {
    try {
      const body = Buffer.allocUnsafe(2);
      body.writeUInt16BE(code, 0);
      this._sendFrame(OP_CLOSE, body);
    } catch {
      /* ignore */
    }
    this._teardown();
  }

  _teardown() {
    if (this._closed) return;
    this._closed = true;
    try {
      this.socket.end();
    } catch {
      /* ignore */
    }
    try {
      this.socket.destroy();
    } catch {
      /* ignore */
    }
    this.emit('close');
  }

  _onClose() {
    if (this._closed) return;
    this._closed = true;
    this.emit('close');
  }
}

class WebSocketServer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.clients = new Set();
    if (options.server) this.attach(options.server);
  }

  attach(server) {
    server.on('upgrade', (req, socket, head) => {
      const key = req.headers['sec-websocket-key'];
      const upgrade = String(req.headers.upgrade || '').toLowerCase();

      if (!key || upgrade !== 'websocket') {
        try {
          socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        } catch {
          /* ignore */
        }
        socket.destroy();
        return;
      }

      const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
      const headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
        '',
        ''
      ].join('\r\n');

      try {
        socket.write(headers);
      } catch {
        socket.destroy();
        return;
      }

      const ws = new WebSocket(socket);
      this.clients.add(ws);
      ws.on('close', () => this.clients.delete(ws));
      if (head && head.length) ws._onData(head);
      this.emit('connection', ws, req);
    });
  }
}

module.exports = { WebSocketServer, WebSocket };
