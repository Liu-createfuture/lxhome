'use strict';

/**
 * 兼容通道（SSE 下行 + POST 上行）端到端测试
 *   终端 1：PORT=3100 node server.js
 *   终端 2：node test/sse-e2e.js
 */

const http = require('http');
const assert = require('assert');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3100';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function openSse(label) {
  const sid = 't' + label + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const c = { label, sid, msgs: [], waiters: [], closed: false };

  const req = http.get(`${BASE}/api/sse?sid=${sid}`, (res) => {
    if (res.statusCode !== 200) {
      console.error(label, 'SSE 状态码', res.statusCode);
      return;
    }
    res.setEncoding('utf8');
    let buf = '';
    res.on('data', (chunk) => {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const line = block.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;
        let m = null;
        try {
          m = JSON.parse(line.slice(6));
        } catch {
          continue;
        }
        if (m.t === 'ready') {
          m._ready = true;
        }
        c.msgs.push(m);
        for (let i = c.waiters.length - 1; i >= 0; i -= 1) {
          if (c.waiters[i].pred(m)) {
            c.waiters[i].res(m);
            c.waiters.splice(i, 1);
          }
        }
      }
    });
  });
  req.on('error', (e) => console.error(label, 'SSE error', e.message));

  c.close = () => {
    c.closed = true;
    req.destroy();
  };
  c.wait = (pred, timeout = 5000) => {
    const hit = c.msgs.find(pred);
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`${label}: 等待超时`)), timeout);
      c.waiters.push({
        pred,
        res: (m) => {
          clearTimeout(t);
          resolve(m);
        }
      });
    });
  };
  c.post = async (msg) => {
    const r = await fetch(`${BASE}/api/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sid, msg })
    });
    assert.equal(r.status, 200, `${label} 上行失败`);
    return r.json();
  };
  return c;
}

(async () => {
  const A = openSse('A');
  const B = openSse('B');
  await Promise.all([
    A.wait((m) => m.t === 'ready'),
    B.wait((m) => m.t === 'ready')
  ]);
  console.log('✓ 两条 SSE 通道已建立');

  await A.post({ t: 'hello', id: 'SSEAAA11', nick: '微信用户A' });
  const aOk = await A.wait((m) => m.t === 'hello-ok');
  assert.equal(aOk.you.nick, '微信用户A');
  console.log('✓ 上行 hello / 下行 hello-ok 正常');

  await B.post({ t: 'hello', id: 'SSEBBB22', nick: '微信用户B' });
  await B.wait((m) => m.t === 'hello-ok');

  await A.post({ t: 'watch', ids: ['SSEBBB22'] });
  const list = await A.wait((m) => m.t === 'presence-list');
  assert.equal(list.list[0].online, true);
  console.log('✓ 在线状态在兼容通道上也能推送');

  await A.post({ t: 'dm', to: 'SSEBBB22', text: '兼容通道也能聊天' });
  const dm = await B.wait((m) => m.t === 'dm');
  assert.equal(dm.text, '兼容通道也能聊天');
  console.log('✓ 私聊投递正常');

  await A.post({ t: 'create', nick: 'A' });
  const joined = await A.wait((m) => m.t === 'joined');
  assert.equal(joined.code.length, 4);
  await A.wait((m) => m.t === 'state' && m.state.status === 'waiting');

  await B.post({ t: 'join', code: joined.code, nick: 'B' });
  await B.wait((m) => m.t === 'joined');
  const st = await A.wait((m) => m.t === 'state' && m.state.players.length === 2, 6000);
  assert.equal(st.state.players[1].nick, 'B');
  console.log(`✓ 建房 + 加入房间（${joined.code}）在兼容通道上完成`);

  await A.post({ t: 'guess', value: '0123' });
  const err = await A.wait((m) => m.t === 'error', 3000).catch(() => null);
  assert.ok(err, '未开始时应拒绝猜测');
  console.log('✓ 业务校验（未开始不能猜）仍然生效');

  A.close();
  B.close();
  await sleep(300);
  console.log('\n兼容通道测试全部通过 ✅');
  process.exit(0);
})().catch((e) => {
  console.error('\n测试失败 ❌', e.message);
  process.exit(1);
});
