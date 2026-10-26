'use strict';

/**
 * 端到端联机测试（使用 Node 内置 WebSocket 客户端，无需任何依赖）
 *
 * 用法：
 *   终端 1：GN_SECRET=8374 PORT=3100 node server.js
 *   终端 2：GN_SECRET=8374 node test/e2e.js
 *
 * 也可以用 WS_URL 指向线上地址做冒烟测试（此时不校验固定答案）。
 */

const assert = require('assert');

const URL = process.env.WS_URL || 'ws://127.0.0.1:3100';
const SECRET = process.env.GN_SECRET || '8374';
const CHECK_SECRET = !process.env.WS_URL;

function makeClient(label) {
  const ws = new WebSocket(URL);
  const c = { label, ws, msgs: [], state: null, code: null, token: null };
  const waiters = [];

  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(String(ev.data));
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
    ws.addEventListener('open', res);
    ws.addEventListener('error', () => rej(new Error(`${label}: 连接失败`)));
  });
  c.send = (o) => ws.send(JSON.stringify(o));
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
  console.log(`✓ 两个客户端已连接 ${URL}`);

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

  /* 7. 判分正确性 */
  A.send({ t: 'guess', value: '0123' });
  const s1 = await A.wait((m) => m.t === 'state' && m.state.myGuesses.length === 1);
  const g1 = s1.state.myGuesses[0];
  if (CHECK_SECRET) {
    assert.deepEqual({ a: g1.a, b: g1.b }, { a: 0, b: 1 }, '0123 vs 8374 应为 0A1B');
  }
  A.send({ t: 'guess', value: '8370' });
  const s2 = await A.wait((m) => m.t === 'state' && m.state.myGuesses.length === 2);
  const g2 = s2.state.myGuesses[1];
  if (CHECK_SECRET) {
    assert.deepEqual({ a: g2.a, b: g2.b }, { a: 3, b: 0 }, '8370 vs 8374 应为 3A0B');
  }
  console.log(`✓ A/B 判分正常（${g1.a}A${g1.b}B / ${g2.a}A${g2.b}B）`);

  /* 8. 对手能看到猜测次数 */
  const bView = await B.wait((m) => m.t === 'state' && m.state.players[0].attempts === 2);
  assert.equal(bView.state.players[0].solved, false);
  console.log('✓ 对手进度同步（已猜 2 次）');

  /* 9. B 猜中（或线上环境用剩余可能兜底） */
  const guessForB = CHECK_SECRET ? SECRET : '0123';
  B.send({ t: 'guess', value: guessForB });
  let finished = null;
  if (CHECK_SECRET) {
    finished = await A.wait((m) => m.t === 'state' && m.state.status === 'finished', 6000);
    assert.equal(finished.state.secret, SECRET, '揭晓答案应与设定一致');
    assert.equal(finished.state.winnerIdx, 1, '获胜者应为 B');
    assert.equal(finished.state.myGuesses.length, 2);
    console.log(`✓ B 猜中 ${SECRET}，本局结束并揭晓答案`);
  } else {
    // 线上冒烟：只验证猜测回执正常返回
    const echoed = await B.wait((m) => m.t === 'state' && m.state.myGuesses.length === 1, 6000);
    assert.equal(echoed.state.myGuesses[0].guess, guessForB);
    console.log('✓ 线上环境猜测回执正常');
    finished = bView;
  }

  /* 10. 再来一局 */
  B.send({ t: 'rematch' });
  await A.wait((m) => m.t === 'state' && m.state.status === 'countdown' && m.state.myGuesses.length === 0, 5000);
  console.log('✓ 再来一局正常重置');

  await sleep(3400);
  await A.wait((m) => m.t === 'state' && m.state.status === 'playing', 6000);

  /* 11. 掉线重连 */
  const tokenA = A.token;
  const codeA = A.code;
  A.ws.close();
  await sleep(500);
  const A2 = makeClient('A2');
  await A2.open;
  A2.send({ t: 'rejoin', code: codeA, token: tokenA });
  const rejoin = await A2.wait((m) => m.t === 'state' && m.state.code === codeA);
  assert.equal(rejoin.state.players[0].nick, 'Alice');
  console.log('✓ 断线后用 token 重连成功，席位保留');

  /* 12. 离开房间 */
  A2.send({ t: 'leave' });
  await B.wait((m) => m.t === 'state' && m.state.players.length === 1, 5000);
  console.log('✓ 离开房间后对手收到新状态');

  B.send({ t: 'leave' });
  B.ws.close();
  A2.ws.close();

  console.log('\n全部联机测试通过 ✅');
  process.exit(0);
})().catch((err) => {
  console.error('\n测试失败 ❌', err.message);
  process.exit(1);
});
