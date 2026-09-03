// Интеграционный тест: проверяет создание комнаты, вход игроков, старт,
// выбор персонажей и автопереход в фазу раздачи ролей (setup).
// Запуск: node server/__test.mjs
import WebSocket from 'ws';

const URL = 'ws://localhost:3001/ws';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Client {
  constructor(name) {
    this.name = name;
    this.ws = new WebSocket(URL);
    this.seq = 0;
    this.pending = new Map();
    this.latest = null; // последний снапшот {room, players}
    this.ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.type === 'state') {
        this.latest = { room: msg.room, players: msg.players };
        // console.log(`[${this.name}] state phase=${msg.room.phase} players=${msg.players.length}`);
      } else if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (p) { this.pending.delete(msg.id); p(msg); }
      }
    });
  }
  open() { return new Promise((res) => this.ws.on('open', res)); }
  req(type, payload) {
    const id = ++this.seq;
    return new Promise((res, rej) => {
      this.pending.set(id, res);
      this.ws.send(JSON.stringify({ id, type, ...payload }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error(`${this.name} timeout for ${type}`)); } }, 6000);
    });
  }
  act(type, payload) { this.ws.send(JSON.stringify({ type, ...payload })); }
  get me() { return this.latest?.players.find((p) => p.id === this.myId) ?? null; }
  close() { this.ws.close(); }
}

async function main() {
  const host = new Client('host');
  await host.open();

  const settings = {
    rounds: 5, playerCount: 4, hasKiller: true, extraRoles: false,
    characters: true, secretCategory: false, discardRole: false,
    timer: { enabled: false, clueSeconds: 60, ghostSeconds: 60, discussionMinutes: 3, votingSeconds: 120 },
  };

  // 1. host создаёт комнату
  const created = await host.req('createRoom', { nickname: 'Хост', settings });
  host.myId = created.player.id;
  await sleep(200);
  const code = created.room.code;
  console.log('1. Комната создана:', created.room.id, 'код', code, 'фаза', host.latest.room.phase);

  // 2. 3 игрока входят
  const others = [];
  for (const n of ['Аня', 'Боря', 'Ваня']) {
    const c = new Client(n);
    await c.open();
    const r = await c.req('joinRoom', { code, nickname: n });
    c.myId = r.player.id;
    others.push(c);
    await sleep(150);
  }
  console.log('2. Игроков в комнате:', host.latest.players.length, host.latest.players.map((p) => p.nickname).join(', '));

  // 3. старт игры
  host.act('startGame', { roomId: created.room.id });
  await sleep(300);
  console.log('3. Фаза после старта:', host.latest.room.phase);

  if (host.latest.room.phase !== 'character_choice') {
    console.log('НЕ entered character_choice! hasKiller+characters должны создавать character_choice.');
    return;
  }

  // 4. Проверяем предложения персонажей
  const all = [host, ...others];
  for (const c of all) {
    const offer = c.latest.room.state.charOffers?.[c.myId] ?? [];
    const role = c.me.role;
    console.log(`   ${c.name}: роль=${role}, оффер=${offer.map((o) => o.id).join(',')}`);
    if (role === 'ghost' && offer.length !== 0) throw new Error('Призрак не должен получать оффер');
    if (role !== 'ghost' && offer.length !== 2) throw new Error('Не-' + c.name + ' должен получить ровно 2 персонажа');
  }

  // 5. Каждый детектив выбирает персонажа
  for (const c of all) {
    const offer = c.latest.room.state.charOffers?.[c.myId] ?? [];
    if (offer.length === 0) continue; // призрак
    const pick = offer[0].id;
    c.act('chooseCharacter', { roomId: created.room.id, playerId: c.myId, characterId: pick });
    await sleep(150);
    const chosen = c.me.character;
    console.log(`   ${c.name} выбрал(а) ${chosen} (синхронизация: ${chosen === pick})`);
  }

  await sleep(300);
  console.log('4. Итоговая фаза после выбора всех:', host.latest.room.phase);
  const lastPhase = host.latest.room.phase;
  for (const c of all) {
    console.log(`   ${c.name}: character=${c.me.character} роль=${c.me.role}`);
  }

  if (lastPhase === 'setup') {
    console.log('✅ УСПЕХ: все выбрали персонажей, игра перешла в фазу раздачи (setup).');
  } else {
    console.log('❌ Фаза после выбора всех:', lastPhase, '(ожидалось setup)');
  }

  all.forEach((c) => c.close());
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1); });
