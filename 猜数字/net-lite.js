/* =========================================================
   连接层
   ---------------------------------------------------------
   优先用 WebSocket；在微信内置浏览器等屏蔽 WebSocket 的环境里，
   自动切换到 SSE（下行）+ POST（上行）的兼容通道。
   对外接口与 WebSocket 一致：readyState / addEventListener / send / close
   ========================================================= */

(function () {
  'use strict';

  const WS_TIMEOUT = 4000;
  let preferSse = location.search.indexOf('forceSse=1') !== -1;

  function emitter(target) {
    const map = Object.create(null);
    target.addEventListener = function (type, fn) {
      (map[type] || (map[type] = [])).push(fn);
    };
    target._emit = function (type, ev) {
      const list = map[type] || [];
      for (let i = 0; i < list.length; i += 1) {
        try {
          list[i](ev);
        } catch {
          /* 单个回调出错不影响连接 */
        }
      }
    };
    return target;
  }

  function openSocket(url) {
    const sock = emitter({ readyState: 0, url: url, transport: 'ws' });
    let ws = null;
    let es = null;
    let sid = null;
    let timer = null;
    let postUrl = null;
    let opened = false;

    function emitOpen() {
      if (sock.readyState === 1) return;
      sock.readyState = 1;
      opened = true;
      sock._emit('open', { type: 'open' });
    }

    function emitClose(reason) {
      if (sock.readyState === 3) return;
      sock.readyState = 3;
      sock._emit('close', { type: 'close', code: 1006, reason: reason || '' });
    }

    function httpBase() {
      return url.split('?')[0].replace(/^ws/, 'http').replace(/\/+$/, '');
    }

    function sharecode() {
      const q = url.split('?')[1] || '';
      const m = /(?:^|&)sharecode=([^&]*)/.exec(q);
      return m ? decodeURIComponent(m[1]) : '';
    }

    function useSse(reason) {
      if (sid) return;
      try {
        if (ws) ws.close();
      } catch {
        /* ignore */
      }
      clearTimeout(timer);

      if (typeof EventSource !== 'function') {
        emitClose('no-sse');
        return;
      }

      sock.transport = 'sse';
      console.warn('[net] WebSocket 不可用（' + reason + '），切换兼容通道');

      const base = httpBase();
      sid = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      postUrl = base + '/api/post';

      const qs = new URLSearchParams();
      qs.set('sid', sid);
      const sc = sharecode();
      if (sc) qs.set('sharecode', sc);

      es = new EventSource(base + '/api/sse?' + qs.toString());
      es.addEventListener('message', (ev) => {
        let m = null;
        try {
          m = JSON.parse(ev.data);
        } catch {
          /* ignore */
        }
        if (m && m.t === 'ready') {
          emitOpen();
          return;
        }
        sock._emit('message', { data: ev.data });
      });
      es.addEventListener('error', () => {
        if (sock.readyState === 0) {
          emitClose('sse-error');
          return;
        }
        try {
          es.close();
        } catch {
          /* ignore */
        }
        es = null;
        emitClose('sse-lost');
      });

      preferSse = true;
    }

    function startWs() {
      sock.transport = 'ws';
      try {
        ws = new WebSocket(url);
      } catch {
        useSse('构造失败');
        return;
      }
      timer = setTimeout(() => {
        if (sock.readyState === 0) useSse('超时');
      }, WS_TIMEOUT);

      ws.addEventListener('open', () => {
        clearTimeout(timer);
        emitOpen();
      });
      ws.addEventListener('message', (ev) => {
        sock._emit('message', { data: ev.data });
      });
      ws.addEventListener('error', () => {
        if (!opened) useSse('握手失败');
      });
      ws.addEventListener('close', () => {
        clearTimeout(timer);
        if (!opened) {
          useSse('未建立即关闭');
          return;
        }
        emitClose('ws-closed');
      });
    }

    sock.send = function (data) {
      if (sock.readyState !== 1) return;

      if (sock.transport === 'ws' && ws && ws.readyState === 1) {
        try {
          ws.send(data);
        } catch {
          /* ignore */
        }
        return;
      }

      if (sock.transport === 'sse' && postUrl && sid) {
        let msg = null;
        try {
          msg = JSON.parse(data);
        } catch {
          return;
        }
        const sc = sharecode();
        const target = postUrl + (sc ? '?sharecode=' + encodeURIComponent(sc) : '');
        fetch(target, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sid: sid, msg: msg }),
          cache: 'no-store',
          keepalive: true
        }).catch(() => {});
      }
    };

    sock.close = function () {
      clearTimeout(timer);
      try {
        if (ws) ws.close();
      } catch {
        /* ignore */
      }
      try {
        if (es) es.close();
      } catch {
        /* ignore */
      }
      emitClose('client-close');
    };

    if (preferSse) useSse('会话内已回退');
    else startWs();

    return sock;
  }

  window.openSocket = openSocket;
})();
