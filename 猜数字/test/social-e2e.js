'use strict';

/**
 * 大厅社交层端到端测试（Node 内置 WebSocket，无依赖）
 *   终端 1：PORT=3100 node server.js
 *   终端 2：node test/social-e2e.js
 */

const assert = require('assert');

const URL = process.env.WS_URL || 'ws://127.0.0.1:3100';

/* 每次跑用不同的身份，避免和正在开着的浏览器撞车 */
const rnd = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const AID = 'A' + rnd();
const BID = 'B' + rnd();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client(label) {
  const ws = new WebSocket(URL);
  const c = { label, ws, msgs: [], waiters: [] };

  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(String(ev.data));
    c.msgs.push(m);
    for (let i = c.waiters.length - 1; i >= 0; i -= 1) {
      if (c.waiters[i].pred(m)) {
        c.waiters[i].res(m);
        c.waiters.splice(i, 1);
      }
    }
  });

  c.open = new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', () => rej(new Error(label + ' 连接失败')));
  });
  c.send = (o) => ws.send(JSON.stringify(o));
  c.wait = (pred, timeout = 4000) => {
    const hit = c.msgs.find(pred);
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(label + ' 等待超时')), timeout);
      c.waiters.push({
        pred,
        res: (m) => {
          clearTimeout(t);
          resolve(m);
        }
      });
    });
  };
  c.since = (n) => c.msgs.slice(n);
  return c;
}

(async () => {
  const A = client('A');
  const B = client('B');
  await Promise.all([A.open, B.open]);

  /* 1. 上线 */
  A.send({ t: 'hello', id: AID, nick: '阿明' });
  const aOk = await A.wait((m) => m.t === 'hello-ok');
  assert.equal(aOk.you.nick, '阿明');
  console.log('✓ A 上线，身份', aOk.you.id);

  /* 2. 关注后能看到上线事件 */
  A.send({ t: 'watch', ids: [BID] });
  const list0 = await A.wait((m) => m.t === 'presence-list');
  assert.equal(list0.list[0].online, false);
  console.log('✓ A 关注 B，初始状态离线');

  B.send({ t: 'hello', id: BID, nick: '小柯' });
  await B.wait((m) => m.t === 'hello-ok');
  const online = await A.wait((m) => m.t === 'presence' && m.id === BID);
  assert.equal(online.online, true);
  assert.equal(online.nick, '小柯');
  console.log('✓ B 上线，A 实时收到在线状态');

  /* 3. 私聊 */
  A.send({ t: 'dm', to: BID, text: '在吗？来一局', cid: 'c1' });
  const dm = await B.wait((m) => m.t === 'dm');
  assert.equal(dm.text, '在吗？来一局');
  assert.equal(dm.from.nick, '阿明');
  const ack = await A.wait((m) => m.t === 'dm-ack' && m.cid === 'c1');
  assert.equal(ack.delivered, true);
  console.log('✓ 私聊实时送达');

  /* 4. 邀请 + 回复 */
  A.send({ t: 'invite', to: BID, code: 'K7QM', game: 'guess', gameName: '猜数字' });
  const inv = await B.wait((m) => m.t === 'invite');
  assert.equal(inv.code, 'K7QM');
  assert.equal(inv.from.nick, '阿明');
  console.log('✓ B 收到邀请，房间号', inv.code);

  B.send({ t: 'invite-reply', to: AID, accept: true, code: 'K7QM' });
  const rep = await A.wait((m) => m.t === 'invite-reply');
  assert.equal(rep.accept, true);
  assert.equal(rep.from.nick, '小柯');
  console.log('✓ A 收到「已接受」回执');

  /* 4.1 已读回执 */
  B.send({ t: 'read', to: AID, ids: ['c1'] });
  const rd = await A.wait((m) => m.t === 'read');
  assert.deepEqual(rd.ids, ['c1']);
  assert.equal(rd.from.id, BID);
  console.log('✓ 已读回执转发（c1 被对方读取）');

  /* 4.2 活动状态：进入房间 / 离开房间会同步给关注者 */
  B.send({ t: 'watch', ids: [AID] });
  const listA = await B.wait((m) => m.t === 'presence-list');
  assert.equal(listA.list[0].act, null);
  A.send({ t: 'create', nick: '阿明', game: 'guess' });
  await A.wait((m) => m.t === 'joined');
  const actOn = await B.wait((m) => m.t === 'presence' && m.id === AID && m.act);
  assert.equal(actOn.act.name, '猜数字');
  console.log('✓ 进入房间后，好友看到「正在玩 猜数字」');
  A.send({ t: 'leave' });
  const actOff = await B.wait((m) => m.t === 'presence' && m.id === AID && m.act === null);
  assert.ok(actOff);
  console.log('✓ 离开房间后，活动状态恢复为 online');

  /* 5. 离线私聊进队列，重连后补送 */
  B.ws.close();
  await sleep(500);
  const offline = await A.wait((m) => m.t === 'presence' && m.id === BID && m.online === false);
  assert.ok(offline);
  console.log('✓ B 断线，A 看到离线');

  A.send({ t: 'dm', to: BID, text: '离线消息测试', cid: 'c2' });
  const ack2 = await A.wait((m) => m.t === 'dm-ack' && m.cid === 'c2');
  assert.equal(ack2.delivered, false);
  console.log('✓ 离线下消息进入暂存队列');

  A.send({ t: 'invite', to: BID, code: 'ZZZZ', game: 'guess', gameName: '猜数字' });
  const failInvite = await A.wait((m) => m.t === 'invite-fail');
  assert.equal(failInvite.to, BID);
  console.log('✓ 对方离线时邀请会失败（不排队）');

  const B2 = client('B2');
  await B2.open;
  B2.send({ t: 'hello', id: BID, nick: '小柯' });
  await B2.wait((m) => m.t === 'hello-ok');
  const queued = await B2.wait((m) => m.t === 'dm' && m.text === '离线消息测试', 5000);
  assert.equal(queued.queued, true);
  console.log('✓ 重连后收到离线期间的消息');

  /* 6. 改昵称会同步给关注者 */
  const before = A.msgs.length;
  B2.send({ t: 'profile', nick: '小柯2' });
  const nickEvent = await A.wait((m) => m.t === 'presence' && m.id === BID && m.nick === '小柯2');
  assert.ok(nickEvent);
  console.log('✓ 改昵称实时同步给好友');

  /* 7. 非法身份被拒 */
  const C = client('C');
  await C.open;
  C.send({ t: 'hello', id: 'ab', nick: 'x' });
  const err = await C.wait((m) => m.t === 'error');
  assert.match(err.msg, /无效/);
  console.log('✓ 非法身份标识被拒绝');

  A.ws.close();
  B2.ws.close();
  C.ws.close();

  console.log('\n大厅社交层测试全部通过 ✅');
  process.exit(0);
})().catch((e) => {
  console.error('\n测试失败 ❌', e.message);
  process.exit(1);
});
