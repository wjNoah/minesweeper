// End-to-end tests of the relay, over real WebSockets, on Cloudflare's local runtime.
// Run them with: npm run test:relay
// To test a relay that is already running: RELAY_URL=ws://localhost:8787 npm run test:relay
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { after, before, describe, it } from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const PORT = 8799;
const ORIGIN = 'http://localhost:4200';
const KEY = 'ABCDEFGHJKMNPQRSTUVWXYZ2';
const OTHER_KEY = 'ZZZZZZZZZZZZZZZZZZZZZZZZ';

let base = process.env.RELAY_URL;
let relay;

/** Starts the relay on this computer and waits until it answers. */
async function startRelay() {
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  relay = spawn('npx', ['--yes', 'wrangler@4', 'dev', '--port', String(PORT)], {
    cwd,
    stdio: 'ignore',
    detached: true,
  });
  base = `ws://localhost:${PORT}`;
  for (let i = 0; i < 300; i++) {
    try {
      await fetch(`http://localhost:${PORT}/`);
      return;
    } catch {
      await wait(1000);
    }
  }
  throw new Error('The relay did not start in time.');
}

/** A connection that records what arrives. */
function connect(path, origin = ORIGIN) {
  const socket = new WebSocket(base + path, { headers: { Origin: origin } });
  const messages = [];
  socket.addEventListener('message', (event) => messages.push(event.data));
  socket.addEventListener('error', () => undefined);
  return {
    socket,
    messages,
    opened: new Promise((resolve) => socket.addEventListener('open', resolve)),
    closed: new Promise((resolve) =>
      socket.addEventListener('close', (event) => resolve(event.code)),
    ),
  };
}

function until(condition) {
  return (async () => {
    for (let i = 0; i < 100; i++) {
      if (condition()) return true;
      await wait(50);
    }
    return false;
  })();
}

const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const newCode = () =>
  Array.from({ length: 5 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');

/** A host and a guest in a new room, both told that they are paired. */
async function pair() {
  const code = newCode();
  const host = connect(`/room/${code}?create=${KEY}`);
  await host.opened;
  const guest = connect(`/room/${code}`);
  await guest.opened;
  assert.ok(await until(() => host.messages.includes('paired')), 'host is told');
  assert.ok(await until(() => guest.messages.includes('paired')), 'guest is told');
  return { code, host, guest };
}

before(
  async () => {
    if (!base) await startRelay();
  },
  { timeout: 310_000 },
);

after(() => {
  if (relay) process.kill(-relay.pid);
});

describe('joining a room', () => {
  it('pairs the host and the guest', async () => {
    const { host, guest } = await pair();
    host.socket.close();
    guest.socket.close();
  });

  it('sends the host no paired message before a guest is there', async () => {
    const host = connect(`/room/${newCode()}?create=${KEY}`);
    await host.opened;
    await wait(300);
    assert.deepEqual(host.messages, []);
    host.socket.close();
  });

  it('refuses a code nobody created', async () => {
    assert.equal(await connect(`/room/${newCode()}`).closed, 4004);
  });

  it('refuses a third player', async () => {
    const { code, host, guest } = await pair();
    assert.equal(await connect(`/room/${code}`).closed, 4010);
    assert.equal(host.socket.readyState, WebSocket.OPEN, 'the match goes on');
    host.socket.close();
    guest.socket.close();
  });

  it('refuses to create a room whose code is in use', async () => {
    const { code, host, guest } = await pair();
    assert.equal(await connect(`/room/${code}?create=${OTHER_KEY}`).closed, 4009);
    host.socket.close();
    guest.socket.close();
  });

  it('frees the code when the room is empty', async () => {
    const code = newCode();
    const first = connect(`/room/${code}?create=${KEY}`);
    await first.opened;
    first.socket.close();
    await first.closed;
    const second = connect(`/room/${code}?create=${OTHER_KEY}`);
    await second.opened;
    await wait(300);
    assert.equal(second.socket.readyState, WebSocket.OPEN);
    second.socket.close();
  });
});

describe('who may connect', () => {
  it('refuses other websites: the connection never opens', async () => {
    const evil = connect(`/room/${newCode()}?create=${KEY}`, 'https://evil.example');
    let opened = false;
    evil.opened.then(() => (opened = true));
    assert.equal(await evil.closed, 1006);
    assert.equal(opened, false);
  });

  it('refuses a connection without an origin, which browsers always send', async () => {
    const bare = new WebSocket(`${base}/room/${newCode()}?create=${KEY}`);
    bare.addEventListener('error', () => undefined);
    let opened = false;
    bare.addEventListener('open', () => (opened = true));
    await new Promise((resolve) => bare.addEventListener('close', resolve));
    assert.equal(opened, false);
  });

  it('answers 404 for other addresses and malformed codes', async () => {
    const http = base.replace('ws', 'http');
    assert.equal((await fetch(`${http}/`)).status, 404);
    assert.equal((await fetch(`${http}/room/abc`)).status, 404);
    assert.equal((await fetch(`${http}/room/AAAA0`)).status, 404); // 0 is not in a code
  });

  it('asks for a WebSocket on a room address', async () => {
    const http = base.replace('ws', 'http');
    assert.equal((await fetch(`${http}/room/${newCode()}`)).status, 426);
  });
});

describe('passing on messages', () => {
  it('passes messages both ways, and not back to the sender', async () => {
    const { host, guest } = await pair();
    host.socket.send('{"from":"host"}');
    guest.socket.send('{"from":"guest"}');
    assert.ok(await until(() => guest.messages.includes('{"from":"host"}')));
    assert.ok(await until(() => host.messages.includes('{"from":"guest"}')));
    assert.ok(!host.messages.includes('{"from":"host"}'));
    assert.ok(!guest.messages.includes('{"from":"guest"}'));
    host.socket.close();
    guest.socket.close();
  });

  it('answers keep-alive pings itself and does not bother the other player', async () => {
    const { host, guest } = await pair();
    host.socket.send('ping');
    assert.ok(await until(() => host.messages.includes('pong')));
    await wait(200);
    assert.ok(!guest.messages.includes('ping'));
    host.socket.close();
    guest.socket.close();
  });

  it('closes the room for the other player when someone leaves', async () => {
    const { host, guest } = await pair();
    guest.socket.close(1000);
    assert.equal(await host.closed, 4000);
  });
});

describe('limits', () => {
  it('closes a connection that sends a message that is too big', async () => {
    const host = connect(`/room/${newCode()}?create=${KEY}`);
    await host.opened;
    host.socket.send('x'.repeat(10_001));
    assert.equal(await host.closed, 4013);
  });

  it('accepts a message of exactly the maximum size', async () => {
    const { host, guest } = await pair();
    const largest = 'x'.repeat(10_000);
    host.socket.send(largest);
    assert.ok(await until(() => guest.messages.includes(largest)));
    host.socket.close();
    guest.socket.close();
  });

  it('closes a connection that sends too much, after passing on the allowed messages', async () => {
    const { host, guest } = await pair();
    for (let i = 0; i < 61; i++) host.socket.send(`{"n":${i}}`);
    assert.equal(await host.closed, 4029);
    assert.equal(await guest.closed, 4000);
    assert.equal(guest.messages.filter((m) => m.startsWith('{"n"')).length, 60);
  });
});

describe('a host who comes back', () => {
  it('takes over the room with the right key, and the guest can still join', async () => {
    const code = newCode();
    const before = connect(`/room/${code}?create=${KEY}`);
    await before.opened;
    const back = connect(`/room/${code}?create=${KEY}`);
    await back.opened;
    await wait(300);
    assert.equal(back.socket.readyState, WebSocket.OPEN);

    const guest = connect(`/room/${code}`);
    await guest.opened;
    assert.ok(await until(() => back.messages.includes('paired')));
    back.socket.send('{"a":1}');
    assert.ok(await until(() => guest.messages.includes('{"a":1}')));
    back.socket.close();
    guest.socket.close();
  });

  it('refuses a wrong, missing or malformed key', async () => {
    const code = newCode();
    const host = connect(`/room/${code}?create=${KEY}`);
    await host.opened;
    assert.equal(await connect(`/room/${code}?create=${OTHER_KEY}`).closed, 4009);
    assert.equal(await connect(`/room/${code}?create`).closed, 4009);
    assert.equal(await connect(`/room/${code}?create=x`).closed, 4009);
    assert.equal(host.socket.readyState, WebSocket.OPEN);
    host.socket.close();
  });

  it('keeps the guest connected and pairs again if the guest had already joined', async () => {
    const { code, guest } = await pair();
    const back = connect(`/room/${code}?create=${KEY}`);
    await back.opened;
    assert.ok(await until(() => back.messages.includes('paired')));
    assert.equal(guest.socket.readyState, WebSocket.OPEN);

    back.socket.send('{"b":2}');
    assert.ok(await until(() => guest.messages.includes('{"b":2}')));
    guest.socket.send('{"c":3}');
    assert.ok(await until(() => back.messages.includes('{"c":3}')));
    back.socket.close();
    guest.socket.close();
  });

  it('the old connection closing later does not end the room', async () => {
    const code = newCode();
    const before = connect(`/room/${code}?create=${KEY}`);
    await before.opened;
    const back = connect(`/room/${code}?create=${KEY}`);
    await back.opened;
    await before.closed; // Can take a few seconds.
    await wait(200);
    assert.equal(back.socket.readyState, WebSocket.OPEN);
    back.socket.close();
  });
});

describe('a room that went to sleep', () => {
  it('keeps working: messages, pings, limits and the host key', { timeout: 60_000 }, async () => {
    const { code, host, guest } = await pair();
    await wait(25_000); // A room with nothing to do hibernates after about 10 seconds.

    host.socket.send('ping');
    assert.ok(await until(() => host.messages.includes('pong')));
    host.socket.send('{"awake":1}');
    assert.ok(await until(() => guest.messages.includes('{"awake":1}')));
    assert.ok(!host.messages.includes('{"awake":1}'), 'still not back to the sender');

    assert.equal(await connect(`/room/${code}`).closed, 4010, 'still knows it is full');

    const back = connect(`/room/${code}?create=${KEY}`);
    await back.opened;
    assert.ok(await until(() => back.messages.includes('paired')), 'still knows the key');
    back.socket.close();
    guest.socket.close();
  });
});
