export type CategoryKey = 'motive' | 'location' | 'weapon' | 'secret';

export const CATEGORIES: { key: CategoryKey; title: string; hint: string }[] = [
  { key: 'motive', title: 'Мотив', hint: 'Что толкнуло на преступление' },
  { key: 'location', title: 'Место', hint: 'Где всё произошло' },
  { key: 'weapon', title: 'Способ', hint: 'Чем была отнята жизнь' },
  { key: 'secret', title: 'Тайна', hint: 'Тайна, которую хранит убийца' },
];

export type Role = 'ghost' | 'killer' | 'detective' | 'accomplice' | 'witness' | 'expert' | 'blackmailer';

/** Путь к карточке роли в public/roles (русские имена файлов). */
export const ROLE_IMAGES: Record<Role, string> = {
  ghost: '/roles/призрак.jpg',
  killer: '/roles/убийца.jpg',
  detective: '/roles/детектив.jpg',
  accomplice: '/roles/сообщник.jpg',
  witness: '/roles/свидетель.jpg',
  expert: '/roles/эксперт.jpg',
  blackmailer: '/roles/шантажист.jpg',
};

export const ROLE_INFO: Record<Role, { title: string; blurb: string; color: string; public: boolean }> = {
  ghost: {
    title: 'Призрак',
    blurb: 'Знает роли всех игроков и истинные улики. Помогает детективам только картами подсказок и побеждает вместе с ними.',
    color: '#9fe3e3',
    public: true,
  },
  killer: {
    title: 'Убийца',
    blurb: 'Знает истинные улики. Мешает детективам их отгадать и не быть арестованным. Голосует вместе со всеми, роль скрыта.',
    color: '#d96b6b',
    public: false,
  },
  detective: {
    title: 'Детектив',
    blurb: 'Раскрыть дело: все истинные улики либо на одну меньше и личность убийцы.',
    color: '#c9ad67',
    public: false,
  },
  accomplice: {
    title: 'Сообщник',
    blurb: 'Знает истинные улики и убийцу. Мешает раскрыть дело и не должен быть арестован.',
    color: '#a078c8',
    public: false,
  },
  witness: {
    title: 'Свидетель',
    blurb: 'Знает убийцу. Помогает детективам, но не должен выдать себя убийце.',
    color: '#e8c07a',
    public: false,
  },
  expert: {
    title: 'Эксперт',
    blurb: 'Знает истинные улики. Помогает детективам, но не должен выдать себя убийце.',
    color: '#7eb8e8',
    public: false,
  },
  blackmailer: {
    title: 'Шантажист',
    blurb: 'Знает истинные улики и убийцу.',
    color: '#e07ad0',
    public: false,
  },
};

export type ClueCard = {
  id: string;
  label: string;
  img?: string;
};

export type SubmittedClue = {
  playerId: string;
  nickname: string;
  card: ClueCard;
  card2?: ClueCard; // курьер: вторая отправленная карта
};

export type TableClue = {
  id: string;
  category: CategoryKey;
  card: ClueCard;
  authorId: string;
  authorName: string;
  note?: string;
};

export type GamePhase =
  | 'lobby'
  | 'character_choice'
  | 'setup'
  | 'true_choice'
  | 'ghost_opening'
  | 'submit'
  | 'ghost_review'
  | 'refresh'
  | 'discussion'
  | 'voting'
  | 'tally'
  | 'results';

export type TimerSettings = {
  enabled: boolean;
  clueSeconds: 30 | 60;
  ghostSeconds: 30 | 60;
  discussionMinutes: 1 | 2 | 3 | 4 | 5;
  votingSeconds: 30 | 60 | 120;
};

export type RoomSettings = {
  rounds: number;
  playerCount: number;
  hasKiller: boolean;
  extraRoles: boolean;
  characters: boolean;
  secretCategory: boolean;
  discardRole: boolean;
  timer: TimerSettings;
};

export type Ballot = {
  playerId: string;
  nickname: string;
  picks: Partial<Record<CategoryKey, string>>;
  killerId: string | null;
  locked: boolean;
};

export type TallyResult = {
  picks: Partial<Record<CategoryKey, string | null>>;
  killerId: string | null;
  ties: Partial<Record<CategoryKey | 'killer', boolean>>;
};

export type ResultSummary = {
  clues: Record<string, { correct: boolean; chosenId: string | null; trueId: string | null; chosenLabel: string | null; trueLabel: string | null }>;
  killer: { correct: boolean; chosenId: string | null; trueId: string | null };
  guessed: number;
  total: number;
  caseSolved: boolean;
  winners: 'detectives' | 'killer';
};

export type GameEvent = {
  id: string;
  at: string;
  text: string;
};

export type Player = {
  id: string;
  room_id: string;
  nickname: string;
  role: Role | null;
  hand: ClueCard[];
  submitted_clue: SubmittedClue | null;
  is_ready: boolean;
  character: string | null;
  joined_at?: string;
};

export type CharacterInfo = {
  id: string;
  title: string;
  img: string;
};

// 24 персонажа из public/characters (карточка содержит текст способности).
// Имена файлов имеют точный регистр (Библиотекарь, Ученый) — указываем их явно.
export const CHARACTERS: CharacterInfo[] = [
  ['адвокат', 'Адвокат'], ['актер', 'Актёр'], ['антиквар', 'Антиквар'], ['библиотекарь', 'Библиотекарь'],
  ['бродяга', 'Бродяга'], ['врач', 'Врач'], ['дезинсектор', 'Дезинсектор'], ['журналист', 'Журналист'],
  ['игрок', 'Игрок'], ['курьер', 'Курьер'], ['медиум', 'Медиум'], ['официант', 'Официант'],
  ['охотник', 'Охотник'], ['писатель', 'Писатель'], ['повар', 'Повар'], ['политик', 'Политик'],
  ['психолог', 'Психолог'], ['специалист', 'Специалист'], ['студент', 'Студент'], ['телеведущий', 'Телеведущий'],
  ['тренер', 'Тренер'], ['ученый', 'Учёный'], ['хакер', 'Хакер'], ['шериф', 'Шериф'],
].map(([id, title]) => {
  const file = id === 'библиотекарь' ? 'Библиотекарь' : id === 'ученый' ? 'Ученый' : id;
  return { id, title, img: `/characters/${file}.jpg` };
});

export function randomCharacters(count: number, exclude: string[] = []): CharacterInfo[] {
  const pool = CHARACTERS.filter((c) => !exclude.includes(c.id));
  const out: CharacterInfo[] = [];
  const bag = shuffle(pool);
  for (let i = 0; i < Math.min(count, bag.length); i++) out.push(bag[i]);
  return out;
}

/** Вид способности определяет, кто и как в неё взаимодействует, и что получает игрок. */
export type AbilityKind =
  | 'point_clue'        // призрак указывает на улику на поле (игрок её видит)
  | 'point_category'    // призрак указывает на категорию (жетон)
  | 'point_number'      // призрак показывает число (пальцами)
  | 'point_player'      // призрак указывает на игрока
  | 'point_two_clues'   // призрак указывает на 2 связанные улики
  | 'show_deck3'        // открыть 3 из колоды, призрак может указать 1, остаток в сброс
  | 'ghost_from_discard'// медиум: призрак показывает 1 карту из сброса
  | 'view_discard3'     // спецагент: посмотреть 3 случайные карты из сброса
  | 'send_deck3'        // повар: посмотреть 3 из колоды и отправить призраку
  | 'reveal_hand_point' // антиквар: призрак указывает 1 важную карту из руки
  | 'reveal_hand_left'  // писатель: призрак убирает 3 из руки, добрать
  | 'trainer'           // тренер: игроки кладут взакрытую, призрак показывает лучшую
  | 'discard_hand'      // дезинсектор: сбросить часть руки, добрать
  | 'send_two'          // курьер: отправить 2 карты вместо 1
  | 'copy_other'        // актёр: скопировать способность другого
  | 'extra_vote';       // политик: дополнительный голос

export type AbilityTarget = 'category' | 'table_clue' | 'hand_card' | 'player' | 'discard' | 'deck3';

export type AbilityDef = {
  id: string;          // character id
  title: string;
  kind: AbilityKind;
  // сколько целей выбирает владелец ДО активации (направлен на что)
  ownerTargets?: AbilityTarget[];
  // сколько целей выбирает призрак
  ghostTargets?: AbilityTarget[];
  maxNumber?: number;
  description: string;
};

// Способности персонажей (описания по правилам, реализация общая через движок ниже).
export const CHARACTER_ABILITIES: Record<string, AbilityDef> = {
  адвокат: { id: 'адвокат', title: 'Адвокат', kind: 'point_player', ghostTargets: ['player'], description: 'Призрак указывает на игрока, не являющегося убийцей.' },
  актер: { id: 'актер', title: 'Актёр', kind: 'copy_other', description: 'Скопируйте и примените способность другого персонажа.' },
  антиквар: { id: 'антиквар', title: 'Антиквар', kind: 'reveal_hand_point', ghostTargets: ['hand_card'], description: 'Тайно покажите руку призраку — он укажет на 1 важную карту (или пропустит).' },
  библиотекарь: { id: 'библиотекарь', title: 'Библиотекарь', kind: 'point_category', ownerTargets: ['table_clue'], ghostTargets: ['category'], description: 'Укажите на 1 подсказку — призрак укажет жетон связанной категории.' },
  бродяга: { id: 'бродяга', title: 'Бродяга', kind: 'point_clue', ownerTargets: ['category'], ghostTargets: ['table_clue'], description: 'Выберите категорию «Место» — призрак укажет 1 неистинную улику в ней.' },
  врач: { id: 'врач', title: 'Врач', kind: 'point_clue', ownerTargets: ['category'], ghostTargets: ['table_clue'], description: 'Выберите категорию «Способ» — призрак укажет 1 неистинную улику в ней.' },
  дезинсектор: { id: 'дезинсектор', title: 'Дезинсектор', kind: 'discard_hand', description: 'Сбросьте любое число карт с руки и доберите новые.' },
  журналист: { id: 'журналист', title: 'Журналист', kind: 'point_category', ghostTargets: ['category'], description: 'Призрак указывает на жетон категории, требующей особого внимания.' },
  игрок: { id: 'игрок', title: 'Игрок', kind: 'show_deck3', ghostTargets: ['deck3'], description: 'Откройте 3 карты из колоды — призрак можешь указать на 1 (или ни на одну), затем все сбрасываются.' },
  курьер: { id: 'курьер', title: 'Курьер', kind: 'send_two', description: 'Можете отправить призраку сразу 2 карты вместо 1.' },
  медиум: { id: 'медиум', title: 'Медиум', kind: 'ghost_from_discard', ghostTargets: ['discard'], description: 'Призрак показывает вам 1 карту из сброса по своему выбору.' },
  официант: { id: 'официант', title: 'Официант', kind: 'point_clue', ownerTargets: ['category'], ghostTargets: ['table_clue'], description: 'Выберите категорию «Мотив» — призрак укажет 1 неистинную улику.' },
  охотник: { id: 'охотник', title: 'Охотник', kind: 'point_two_clues', ghostTargets: ['table_clue'], description: 'Призрак показывает на 2 связанные между собой подсказки.' },
  писатель: { id: 'писатель', title: 'Писатель', kind: 'reveal_hand_left', ghostTargets: ['hand_card'], description: 'Тайно покажите руку призраку — он уберёт 3 в сброс, затем доберите 3.' },
  повар: { id: 'повар', title: 'Повар', kind: 'send_deck3', description: 'Посмотрите 3 из колоды и отправьте их призраку вместо 1.' },
  политик: { id: 'политик', title: 'Политик', kind: 'extra_vote', description: 'После одного из голосований добавьте ещё 1 голос за любой вариант.' },
  психолог: { id: 'психолог', title: 'Психолог', kind: 'point_number', ghostTargets: ['category'], maxNumber: 12, description: 'Призрак показывает на пальцах, сколько игроков соврали в этом раунде.' },
  специалист: { id: 'специалист', title: 'Спецагент', kind: 'view_discard3', description: 'Посмотреть 3 случайные карты из сброса тайно.' },
  студент: { id: 'студент', title: 'Студент', kind: 'point_clue', ghostTargets: ['table_clue'], description: 'Призрак показывает 1 неверно понятую подсказку.' },
  телеведущий: { id: 'телеведущий', title: 'Телеведущий', kind: 'point_clue', ghostTargets: ['table_clue'], description: 'Призрак показывает на особенно важную подсказку.' },
  тренер: { id: 'тренер', title: 'Тренер', kind: 'trainer', ownerTargets: ['player'], description: 'До 3 игроков кладут по 1 карте взакрытую, призрак показывает лучшую (в сброс).' },
  ученый: { id: 'ученый', title: 'Учёный', kind: 'point_clue', ownerTargets: ['category'], ghostTargets: ['table_clue'], description: 'Выберите категорию — призрак укажет связанную с истиной улику (или покажет «нет»).' },
  хакер: { id: 'хакер', title: 'Хакер', kind: 'point_clue', ownerTargets: ['table_clue'], ghostTargets: ['table_clue'], description: 'Укажите на подсказку — призрак укажет все связанные с ней (если есть).' },
  шериф: { id: 'шериф', title: 'Шериф', kind: 'point_number', ownerTargets: ['category'], ghostTargets: ['category'], maxNumber: 12, description: 'Выберите категорию — призрак покажет на пальцах, сколько подсказок с ней связано.' },
};

/** Активная способность: кем активирована, какой доп. шаг, и куда сохраняется результат. */
export type AbilityState = {
  ownerId: string;
  characterId: string;
  kind: AbilityKind;
  step:
    | 'owner_target'      // владелец выбирает цель (категория/улика/игла/игроки)
    | 'ghost_action'      // действует призрак
    | 'ghost_skip'        // призрак может пропустить (игрок/антиквар)
    | 'reveal_pick'       // карты из колоды открыты всем (игрок), ghost может указать 1
    | 'owner_discard'     // владелец выбирает, что сбросить из руки (дезинсектор)
    | 'send_to_ghost'     // владелец отправляет карты призраку (повар)
    | 'player_submit'     // выбранные игроки кладут карту взакрытую (тренер)
    | 'copy_pick'         // актёр выбирает, чью способность скопировать
    | 'extra_vote'        // политик добавляет голос
    | 'owner_view';       // владелец видит результат
  // выбор владельца (категория/улика/игла)
  ownerChoice?: string;
  // карты из колоды/сброса/руки, открытые приватно (кто видит — см. revealTo)
  revealed?: ClueCard[];
  // кому видно revealed: 'owner' | 'owner_ghost' | 'ghost'
  revealTo?: 'owner' | 'owner_ghost' | 'ghost';
  // выбранные призраком улики/карты/игроки (id)
  ghostPicks?: string[];
  // результат-число (психолог/шериф)
  resultNumber?: number;
  // из какой фазы возобновиться после завершения
  resumePhase?: GamePhase;
  // для copy_other — id скопированной способности
  copiedId?: string;
  // для тренера — выбранные игроки
  pickedPlayers?: string[];
  // id карт, которые уже сбросили/отправили (для идемпотентности)
  done?: string[];
  // карты руки владельца, показанные призраку (reveal_hand)
  handRevealed?: ClueCard[];
  // для писателя — карты, которые призрак отправил в сброс
  toDiscard?: ClueCard[];
  // для тренера — подложенные игроками карты
  copies?: { playerId: string; card: ClueCard }[];
};

export type RoomGameState = {
  deck?: ClueCard[];
  discard?: ClueCard[];
  vanished?: ClueCard[];
  hints?: ClueCard[];
  table?: TableClue[];
  layingCard?: ClueCard | null;
  layingPlayerId?: string | null;
  trueChoices?: Partial<Record<CategoryKey, string>> | null;
  round?: number;
  deadlineAt?: string | null;
  radioPlayerId?: string | null;
  speakerId?: string | null;
  spokenIds?: string[];
  refreshedIds?: string[];
  ballots?: Record<string, Ballot>;
  tally?: TallyResult | null;
  voteRound?: number;
  voteScope?: CategoryKey[];
  voteScopeKiller?: boolean;
  voteDecided?: Partial<Record<CategoryKey | 'killer', string | null>>;
  politicianExtra?: Partial<Record<CategoryKey, string>>; // политик: доп. голоса
  winners?: 'detectives' | 'killer' | null;
  resultSummary?: ResultSummary | null;
  charOffers?: Record<string, CharacterInfo[]>;
  discardedRole?: Role | null;
  ability?: AbilityState | null;
  usedAbilities?: string[]; // characterIds, способности в один раз за партию
  events?: GameEvent[];
};

export type Room = {
  id: string;
  code: string;
  host_name: string;
  player_count: number;
  settings: RoomSettings;
  phase: GamePhase;
  state: RoomGameState;
  created_at: string;
};

const CARD_WORDS = [
  'Молоток', 'Топор', 'Нож', 'Верёвка', 'Свеча', 'Яд', 'Подкова', 'Ключ', 'Камень', 'Бутылка',
  'Лес', 'Гавань', 'Чердак', 'Подвал', 'Озеро', 'Мост', 'Кладбище', 'Трактир', 'Сад', 'Кухня',
  'Ревность', 'Месть', 'Долг', 'Наследство', 'Тайна', 'Предательство', 'Власть', 'Клятва', 'Письмо', 'Свидание',
  'Лестница', 'Пистолет', 'Полотенце', 'Колокол', 'Зеркало', 'Кувшин', 'Фонарь', 'Перчатки', 'Вуаль', 'Книги',
  'Карета', 'Причал', 'Часовня', 'Тропа', 'Окно', 'Дверь', 'Сундук', 'Карта', 'Портрет', 'Жёлудь',
  'Термос', 'Пончик', 'Наручники', 'Маска', 'Камера', 'Конь', 'Наушники', 'Конёк', 'Утка', 'Бочка',
  'Кукла', 'Огнетушитель', 'Канат', 'Банка варенья', 'Следы', 'Средство от комаров', 'Чайник', 'Зонт',
  'Бинокль', 'Песочные часы', 'Компас', 'Перо', 'Скрипка', 'Часы', 'Перстень', 'Сигара', 'Плащ', 'Флейта',
  'Клетка', 'Якорь', 'Череп', 'Метла', 'Лупа', 'Чернила', 'Светильник', 'Цепь', 'Шприц', 'Магнит',
];

export const TOTAL_CARDS = 300;

/** Рандомно выдаёт N неповторяющихся карт-картинок из public/cards/1..TOTAL_CARDS.jpg */
export function drawImageDeck(count: number, exclude: string[] = []): ClueCard[] {
  const used = new Set(exclude);
  const pool: number[] = [];
  for (let i = 1; i <= TOTAL_CARDS; i++) {
    const id = `img-${i}`;
    if (!used.has(id)) pool.push(i);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, count);
  return chosen.map((n) => ({
    id: `img-${n}`,
    label: `№${n}`,
    img: `/cards/${n}.jpg`,
  }));
}

export function buildDeck(): ClueCard[] {
  // Полная колода из 300 картинок, перемешанная без повторов.
  const ids: number[] = [];
  for (let i = 1; i <= TOTAL_CARDS; i++) ids.push(i);
  const order = shuffle(ids);
  return order.map((n) => ({ id: `img-${n}`, label: `№${n}`, img: `/cards/${n}.jpg` }));
}

export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function cluesPerCategory(settings: RoomSettings): number {
  return settings.characters ? 5 : 4;
}

export function activeCategories(settings: RoomSettings) {
  return CATEGORIES.filter((c) => c.key !== 'secret' || settings.secretCategory);
}

export function tableSize(settings: RoomSettings): number {
  return activeCategories(settings).length * cluesPerCategory(settings);
}

export function roundsForPlayers(playerCount: number, secretCategory: boolean): number {
  let rounds = 5;
  if (playerCount >= 11) rounds = 2;
  else if (playerCount >= 8) rounds = 3;
  else if (playerCount >= 5) rounds = 4;
  else rounds = 5;
  if (secretCategory) rounds += 1;
  return rounds;
}

export const DEFAULT_TIMER: TimerSettings = {
  enabled: false,
  clueSeconds: 60,
  ghostSeconds: 60,
  discussionMinutes: 3,
  votingSeconds: 120,
};

export function defaultSettings(playerCount = 4): RoomSettings {
  return {
    rounds: roundsForPlayers(playerCount, false),
    playerCount,
    hasKiller: true,
    extraRoles: false,
    characters: false,
    secretCategory: false,
    discardRole: false,
    timer: DEFAULT_TIMER,
  };
}

export function minPlayers(settings: RoomSettings): number {
  return settings.hasKiller ? 4 : 2;
}

export function takeCards(state: RoomGameState, n: number): { cards: ClueCard[]; state: RoomGameState } {
  let deck = [...(state.deck ?? [])];
  let discard = [...(state.discard ?? [])];
  const cards: ClueCard[] = [];
  for (let i = 0; i < n; i++) {
    if (deck.length === 0 && discard.length > 0) {
      deck = shuffle(discard);
      discard = [];
    }
    if (deck.length === 0) break;
    cards.push(deck.shift()!);
  }
  return { cards, state: { ...state, deck, discard } };
}

export function refillHand(player: Player, state: RoomGameState, size = 5): { player: Player; state: RoomGameState } {
  const need = Math.max(0, size - player.hand.length);
  const drawn = takeCards(state, need);
  return {
    player: { ...player, hand: [...player.hand, ...drawn.cards] },
    state: drawn.state,
  };
}

export function clockwiseOrder(players: Player[]): Player[] {
  return [...players].sort((a, b) => String(a.joined_at ?? a.id).localeCompare(String(b.joined_at ?? b.id)));
}

export function nextPlayer(players: Player[], currentId: string | null | undefined): Player | null {
  const order = clockwiseOrder(players);
  if (!order.length) return null;
  if (!currentId) return order[0];
  const i = order.findIndex((p) => p.id === currentId);
  return order[(i + 1) % order.length];
}

export function nextSpeaker(players: Player[], currentId: string | null | undefined): Player | null {
  const order = clockwiseOrder(players);
  if (!order.length) return null;
  let current = currentId;
  for (let n = 0; n < order.length; n++) {
    const nxt = nextPlayer(order, current);
    if (!nxt) return null;
    if (nxt.role !== 'ghost') return nxt;
    current = nxt.id;
  }
  return null;
}

export function rolesForGame(playerCount: number, settings: RoomSettings): Role[] {
  if (!settings.hasKiller) {
    return ['ghost', ...Array.from({ length: playerCount - 1 }, () => 'detective' as const)];
  }
  const deck: Role[] = ['ghost', 'killer'];
  if (settings.extraRoles && playerCount >= 7) {
    deck.push('accomplice', 'witness');
    if (playerCount >= 10) deck.push('expert');
    if (playerCount >= 10) deck.push('accomplice');
  }
  while (deck.length < playerCount) deck.push('detective');
  return deck.slice(0, playerCount);
}

export function majorityId(ids: (string | null | undefined)[]): { id: string | null; tie: boolean } {
  const counts: Record<string, number> = {};
  ids.forEach((id) => {
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return { id: null, tie: true };
  if (entries.length > 1 && entries[0][1] === entries[1][1]) return { id: null, tie: true };
  return { id: entries[0][0], tie: false };
}

export function computeTally(ballots: Ballot[], categories: { key: CategoryKey }[]): TallyResult {
  const locked = ballots.filter((b) => b.locked);
  const picks: TallyResult['picks'] = {};
  const ties: TallyResult['ties'] = {};
  categories.forEach((cat) => {
    const res = majorityId(locked.map((b) => b.picks[cat.key]));
    picks[cat.key] = res.id;
    ties[cat.key] = res.tie;
  });
  const killer = majorityId(locked.map((b) => b.killerId));
  return { picks, killerId: killer.id, ties: { ...ties, killer: killer.tie } };
}

export function evaluateCase(room: Room, players: Player[], tally: TallyResult): ResultSummary {
  const cats = activeCategories(room.settings);
  const table = room.state.table ?? [];
  const truth = room.state.trueChoices ?? {};
  const killer = players.find((p) => p.role === 'killer') ?? null;
  const labelOf = (id: string | null | undefined) => table.find((c) => c.id === id)?.card.label ?? null;

  const clues: ResultSummary['clues'] = {};
  let clueCorrect = 0;
  cats.forEach((cat) => {
    const chosenId = tally.picks[cat.key] ?? null;
    const trueId = truth[cat.key] ?? null;
    const correct = !!chosenId && chosenId === trueId;
    if (correct) clueCorrect += 1;
    clues[cat.key] = {
      correct,
      chosenId,
      trueId,
      chosenLabel: labelOf(chosenId),
      trueLabel: labelOf(trueId),
    };
  });

  // Сброшенная роль убийцы: убийцы нет в игре — решает успех только количество угаданных улик.
  const noKiller = room.settings.hasKiller && !killer;
  const killerCorrect = noKiller
    ? false
    : room.settings.hasKiller
      ? !!killer && tally.killerId === killer.id
      : tally.killerId === players.find((p) => p.role === 'ghost')?.id;

  const neededClues = cats.length;
  const caseSolved = noKiller
    ? clueCorrect === neededClues
    : room.settings.hasKiller
      ? clueCorrect === neededClues || (clueCorrect >= neededClues - 1 && killerCorrect)
      : clueCorrect === neededClues;

  return {
    clues,
    killer: {
      correct: killerCorrect,
      chosenId: tally.killerId,
      trueId: noKiller ? null : room.settings.hasKiller ? killer?.id ?? null : players.find((p) => p.role === 'ghost')?.id ?? null,
    },
    guessed: noKiller || !room.settings.hasKiller ? clueCorrect : clueCorrect + (killerCorrect ? 1 : 0),
    total: noKiller ? neededClues : room.settings.hasKiller ? neededClues + 1 : neededClues,
    caseSolved,
    winners: caseSolved ? 'detectives' : 'killer',
  };
}

export function deadlineFromNow(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export function timerSecondsForPhase(phase: GamePhase, settings: RoomSettings): number | null {
  if (!settings.timer.enabled) return null;
  if (phase === 'submit') return settings.timer.clueSeconds;
  if (phase === 'ghost_review' || phase === 'ghost_opening') return settings.timer.ghostSeconds;
  if (phase === 'discussion' || phase === 'refresh') return settings.timer.discussionMinutes * 60;
  if (phase === 'voting') return settings.timer.votingSeconds;
  return null;
}

export function addEvent(state: RoomGameState, text: string): GameEvent[] {
  const events = [...(state.events ?? [])];
  events.push({ id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), text });
  return events.slice(-80);
}

export function playerColor(index: number): string {
  const colors = ['#7ec8c8', '#c9ad67', '#d96b6b', '#8f9fe3', '#c78fe3', '#8fe39f', '#e3b58f', '#e38fbc'];
  return colors[index % colors.length];
}

export function clueTone(id: string): { from: string; to: string } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return { from: `hsl(${hue} 28% 22%)`, to: `hsl(${(hue + 28) % 360} 32% 12%)` };
}
