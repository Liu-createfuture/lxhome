'use strict';

/**
 * 端到端联机测试
 * 用法： GN_SECRET=8374 PORT=3100 node server.js  然后 node test/e2e.js
 */

const WebSocket = require('ws');
const assert = require('assert');

const URL = process.env.WS_URL || 'ws://127.0.0.1:3100';
const SECRET = process.env.GN_SECRET || '8374';

function makeClient(label) {
  const ws = new WebSocket(URL);
  const c = { label, ws, msgs: [], state: null, code: null, token: null };
  const waiters = [];

  ws.on('message', (raw) => {
    const m = JSON.parse(String(raw));
    c.msgs.push(m);
    if (m.t === 'state') c.state = m.state;
    if (m.t === 'joined') {
      c.code = m.code;
      c.token = m.token;
    }
    for (let i = waiters.length - 1; i >= 0; i -= 1) {
      if (waiters[i].pred(m)) {
        waiters[i].res(m);
        waiters.splice(i, 1);
      }
    }
  });

  c.open = new Promise((res, rej) => {
    ws.on('open', res);
    ws.on('error', rej);
  });
  c.send = (o) => ws.send(JSON.stringify(o));
  c.seen = (pred) => c.msgs.some(pred);
  c.wait = (pred, timeout = 5000) => {
    const hit = c.msgs.find(pred);
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label}: 等待超时`)), timeout);
      waiters.push({
        pred,
        res: (m) => {
          clearTimeout(timer);
          resolve(m);
        }
      });
    });
  };
  return c;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const A = makeClient('A');
  const B = makeClient('B');
  await Promise.all([A.open, B.open]);
  console.log('✓ 两个客户端已连接');

  /* 1. 创建房间 */
  A.send({ t: 'create', nick: 'Alice' });
  const joined = await A.wait((m) => m.t === 'joined');
  const code = joined.code;
  assert.equal(code.length, 4, '房间号应为 4 位');
  await A.wait((m) => m.t === 'state' && m.state.status === 'waiting');
  console.log(`✓ 创建房间 ${code}`);

  /* 2. 加入房间 */
  B.send({ t: 'join', code, nick: 'Bob' });
  const bJoined = await B.wait((m) => m.t === 'joined');
  assert.equal(bJoined.code, code);
  const st = await A.wait((m) => m.t === 'state' && m.state.players.length === 2);
  assert.equal(st.state.players[0].nick, 'Alice');
  assert.equal(st.state.players[1].nick, 'Bob');
  console.log('✓ 第二名玩家加入，房间内 2 人');

  /* 3. 错误房号 */
  const C = makeClient('C');
  await C.open;
  C.send({ t: 'join', code: 'ZZZZ', nick: 'Carl' });
  const noRoom = await C.wait((m) => m.t === 'error');
  assert.match(noRoom.msg, /房间不存在/);
  C.ws.close();
  console.log('✓ 无效房间号被拒绝');

  /* 4. 非房主不能开始 */
  B.send({ t: 'start' });
  const notHost = await B.wait((m) => m.t === 'error');
  assert.match(notHost.msg, /房主/);
  console.log('✓ 非房主无法开始游戏');

  /* 5. 房主开始 → 倒计时 → 对战 */
  A.send({ t: 'start' });
  await A.wait((m) => m.t === 'state' && m.state.status === 'countdown');
  console.log('✓ 进入 3 秒倒计时');
  await A.wait((m) => m.t === 'state' && m.state.status === 'playing', 8000);
  await B.wait((m) => m.t === 'state' && m.state.status === 'playing', 8000);
  console.log('✓ 对战开始');

  /* 6. 非法猜测被拒 */
  A.send({ t: 'guess', value: '1123' });
  const dupErr = await A.wait((m) => m.t === 'error');
  assert.match(dupErr.msg, /不重复/);
  A.send({ t: 'guess', value: '12' });
  await A.wait((m) => m.t === 'error' && /4 位不重复/.test(m.msg));
  console.log('✓ 重复数字 / 位数不足被拒绝');

  /* 7. 判分正确性：答案 8374，猜 0123 → 0A1B */
  A.send({ t: 'guess', value: '0123' });
  const s1 = await A.wait((m) => m.t === 'state' && m.state.myGuesses.length === 1);
  assert.deepEqual(
    { a: s1.state.myGuesses[0].a, b: s1.state.myGuesses[0].b },
    { a: 0, b: 1 },
    '0123 vs 8374 应为 0A1B'
  );

  A.send({ t: 'guess', value: '8370' });
  const s2 = await A.wait((m) => m.t === 'state' && m.state.myGuesses.length === 2);
  assert.deepEqual({ a: s2.state.myGuesses[1].a, b: s2.state.myGuesses[1].b }, { a: 3, b: 0 }, '8370 vs 8374 应为 3A0B');
  console.log('✓ A/B 判分正确（0A1B / 3A0B）');

  /* 8. 对手能看到猜测次数 */
  const bView = await B.wait((m) => m.t === 'state' && m.state.players[0].attempts === 2);
  assert.equal(bView.state.players[0].solved, false);
  console.log('✓ 对手进度同步（已猜 2 次）');

  /* 9. B 猜中 → 结束并揭晓答案 */
  B.send({ t: 'guess', value: SECRET });
  const fin = await A.wait((m) => m.t === 'state' && m.state.status === 'finished');
  assert.equal(fin.state.secret, SECRET);
  assert.equal(fin.state.winnerIdx, 1, '获胜者应为 B');
  assert.equal(fin.state.myGuesses.length, 2);
  const finB = await B.wait((m) => m.t === 'state' && m.state.status === 'finished' && m.state.winnerIdx === 1);
  assert.equal(finB.state.myGuesses.length, 1);
  console.log(`✓ B 猜中 ${SECRET}，本局结束并揭晓答案`);

  /* 10. 再来一局 */
  B.send({ t: 'rematch' });
  const again = await A.wait((m) => m.t === 'state' && m.state.status === 'countdown' && m.state.myGuesses.length === 0, 4000);
  assert.equal(again.state.winnerIdx, -1);
  console.log('✓ 再来一局正常重置');

  await sleep(3400);
  await A.wait((m) => m.t === 'state' && m.state.status === 'playing', 3000);

  /* 11. 掉线重连 */
  const tokenA = A.token;
  const codeA = A.code;
  A.ws.close();
  await sleep(400);
  const A2 = makeClient('A2');
  await A2.open;
  A2.send({ t: 'rejoin', code: codeA, token: tokenA });
  const rejoin = await A2.wait((m) => m.t === 'state' && m.state.code === codeA);
  assert.equal(rejoin.state.you, 0);
  assert.equal(rejoin.state.players[0].nick, 'Alice');
  console.log('✓ 断线后用 token 重连成功，席位保留');

  /* 12. 离开房间 */
  A2.send({ t: 'leave' });
  const leftState = await B.wait((m) => m.t === 'state' && m.state.players.length === 1, 4000);
  assert.equal(leftState.state.status, 'finished');
  console.log('✓ 离开房间后对手收到结算状态');

  B.send({ t: 'leave' });
  B.ws.close();
  A2.ws.close();

  console.log('\n全部联机测试通过 ✅');
  process.exit(0);
})().catch((err) => {
  console.error('\n测试失败 ❌', err);
  process.exit(1);
});
