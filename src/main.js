const SUITS = { D: "Dots", B: "Bamboo", C: "Characters" };
const WINDS = ["E", "S", "W", "N"];
const DRAGONS = ["R", "G", "H"];
const FLOWERS = ["F1", "F2", "F3", "F4"];
const SEASONS = ["T1", "T2", "T3", "T4"];
const BONUS_TILES = [...FLOWERS, ...SEASONS];
const SEAT_ROTATION_ORDER = [0, 1, 3, 2]; // bottom -> right -> top -> left
const BASE_TILES = [
  ...["D", "B", "C"].flatMap((s) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${s}${n}`)),
  ...WINDS,
  ...DRAGONS,
];
const ALL_TILES = [...BASE_TILES];
const TILE_INDEX = Object.fromEntries(ALL_TILES.map((t, i) => [t, i]));

const DEFAULT_RULES = {
  name: "香港常用(3番起糊)",
  minFan: 3,
  fanCap: 10,
  selfDrawBonus: true,
  concealedBonus: true,
};
const RULE_PROFILE_URL = "rule_profiles.json";
const STORAGE_RULE_PROFILES = "hkmahjong_rule_profiles_v1";
const STORAGE_RULE_PROFILE_NAME = "hkmahjong_rule_profile_name_v1";
const INITIAL_SCORE = 100;

function buildWallTiles() {
  return [...BASE_TILES, ...BASE_TILES, ...BASE_TILES, ...BASE_TILES, ...BONUS_TILES];
}

function tileAssetPath(tile) {
  return `assets/tiles/${tile}.png`;
}

function tileName(tile, locale = "en") {
  if (locale === "zh-HK") {
    const suitZh = { D: "\u7b52", B: "\u7d22", C: "\u842c" };
    const windZh = { E: "\u6771", S: "\u5357", W: "\u897f", N: "\u5317" };
    const dragonZh = { R: "\u4e2d", G: "\u767c", H: "\u767d" };
    const flowerZh = { F1: "\u6885", F2: "\u862d", F3: "\u83ca", F4: "\u7af9" };
    const seasonZh = { T1: "\u6625", T2: "\u590f", T3: "\u79cb", T4: "\u51ac" };
    if (tile[0] in suitZh && tile.length === 2) return `${tile[1]}${suitZh[tile[0]]}`;
    if (flowerZh[tile]) return `\u82b1${flowerZh[tile]}`;
    if (seasonZh[tile]) return `\u5b63${seasonZh[tile]}`;
    if (windZh[tile]) return windZh[tile];
    return dragonZh[tile] || tile;
  }
  if (tile[0] in SUITS && tile.length === 2) return `${tile[1]} ${SUITS[tile[0]]}`;
  const wind = { E: "East", S: "South", W: "West", N: "North" };
  const dragon = { R: "Red", G: "Green", H: "White" };
  const flower = { F1: "Plum", F2: "Orchid", F3: "Chrysanthemum", F4: "Bamboo" };
  const season = { T1: "Spring", T2: "Summer", T3: "Autumn", T4: "Winter" };
  if (flower[tile]) return `Flower ${flower[tile]}`;
  if (season[tile]) return `Season ${season[tile]}`;
  if (wind[tile]) return wind[tile];
  return dragon[tile] || tile;
}

function tileKey(tile) {
  if (tile[0] === "D") return [0, Number(tile[1])];
  if (tile[0] === "B") return [1, Number(tile[1])];
  if (tile[0] === "C") return [2, Number(tile[1])];
  if (WINDS.includes(tile)) return [3, WINDS.indexOf(tile)];
  if (DRAGONS.includes(tile)) return [4, DRAGONS.indexOf(tile)];
  if (FLOWERS.includes(tile)) return [5, FLOWERS.indexOf(tile)];
  if (SEASONS.includes(tile)) return [6, SEASONS.indexOf(tile)];
  return [9, 0];
}

function tileCompare(a, b) {
  const ka = tileKey(a);
  const kb = tileKey(b);
  return ka[0] - kb[0] || ka[1] - kb[1];
}

function toCounts(hand) {
  const counts = Object.fromEntries(ALL_TILES.map((t) => [t, 0]));
  for (const t of hand) if (Object.prototype.hasOwnProperty.call(counts, t)) counts[t] += 1;
  return counts;
}

function isSuited(tile) {
  return tile && tile[0] in SUITS;
}

function tileNum(tile) {
  return isSuited(tile) ? Number(tile[1]) : -1;
}

function countsToArray(counts) {
  return ALL_TILES.map((t) => counts[t]);
}

const memoMelds = new Map();
const memoNMelds = new Map();

function canFormMelds(state) {
  const key = state.join(",");
  if (memoMelds.has(key)) return memoMelds.get(key);

  let first = -1;
  for (let i = 0; i < state.length; i += 1) {
    if (state[i] > 0) {
      first = i;
      break;
    }
  }
  if (first === -1) {
    memoMelds.set(key, true);
    return true;
  }

  const arr = state.slice();
  const tile = ALL_TILES[first];
  if (arr[first] >= 3) {
    arr[first] -= 3;
    if (canFormMelds(arr)) {
      memoMelds.set(key, true);
      return true;
    }
    arr[first] += 3;
  }

  if (isSuited(tile)) {
    const suit = tile[0];
    const n = tileNum(tile);
    if (n <= 7) {
      const i2 = TILE_INDEX[`${suit}${n + 1}`];
      const i3 = TILE_INDEX[`${suit}${n + 2}`];
      if (arr[i2] > 0 && arr[i3] > 0) {
        arr[first] -= 1;
        arr[i2] -= 1;
        arr[i3] -= 1;
        if (canFormMelds(arr)) {
          memoMelds.set(key, true);
          return true;
        }
      }
    }
  }

  memoMelds.set(key, false);
  return false;
}

function canFormNMelds(state, nMelds) {
  const key = `${nMelds}|${state.join(",")}`;
  if (memoNMelds.has(key)) return memoNMelds.get(key);

  if (nMelds === 0) {
    const ok = state.reduce((a, b) => a + b, 0) === 0;
    memoNMelds.set(key, ok);
    return ok;
  }

  let first = -1;
  for (let i = 0; i < state.length; i += 1) {
    if (state[i] > 0) {
      first = i;
      break;
    }
  }
  if (first === -1) {
    memoNMelds.set(key, false);
    return false;
  }

  const arr = state.slice();
  const tile = ALL_TILES[first];

  if (arr[first] >= 3) {
    arr[first] -= 3;
    if (canFormNMelds(arr, nMelds - 1)) {
      memoNMelds.set(key, true);
      return true;
    }
    arr[first] += 3;
  }

  if (isSuited(tile)) {
    const suit = tile[0];
    const n = tileNum(tile);
    if (n <= 7) {
      const i2 = TILE_INDEX[`${suit}${n + 1}`];
      const i3 = TILE_INDEX[`${suit}${n + 2}`];
      if (arr[i2] > 0 && arr[i3] > 0) {
        arr[first] -= 1;
        arr[i2] -= 1;
        arr[i3] -= 1;
        if (canFormNMelds(arr, nMelds - 1)) {
          memoNMelds.set(key, true);
          return true;
        }
      }
    }
  }

  memoNMelds.set(key, false);
  return false;
}

function isSevenPairs(hand) {
  if (hand.length !== 14) return false;
  const counts = toCounts(hand);
  let pairs = 0;
  for (const v of Object.values(counts)) {
    if (v === 2) pairs += 1;
    else if (v === 4) pairs += 2;
    else if (v !== 0) return false;
  }
  return pairs === 7;
}

function isThirteenOrphans(hand) {
  if (hand.length !== 14) return false;
  const counts = toCounts(hand);
  const req = new Set(["D1", "D9", "B1", "B9", "C1", "C9", "E", "S", "W", "N", "R", "G", "H"]);
  let pair = false;
  for (const t of ALL_TILES) {
    const v = counts[t];
    if (req.has(t)) {
      if (v === 0) return false;
      if (v >= 2) {
        if (pair) return false;
        pair = true;
      }
      if (v > 2) return false;
    } else if (v !== 0) {
      return false;
    }
  }
  return pair;
}

function isWinWithOpenMelds(hand, openMeldCount) {
  const requiredMelds = 4 - openMeldCount;
  if (requiredMelds < 0) return false;
  const expectedLen = 2 + 3 * requiredMelds;
  if (hand.length !== expectedLen) return false;

  if (openMeldCount === 0 && (isSevenPairs(hand) || isThirteenOrphans(hand))) return true;

  const counts = toCounts(hand);
  for (const t of ALL_TILES) {
    if (counts[t] >= 2) {
      const work = { ...counts };
      work[t] -= 2;
      if (canFormNMelds(countsToArray(work), requiredMelds)) return true;
    }
  }
  return false;
}

function handScoreForBot(hand) {
  const c = toCounts(hand);
  let score = 0;
  for (const [t, v] of Object.entries(c)) {
    if (v >= 2) score += 4;
    if (v >= 3) score += 6;
    if (isSuited(t) && v > 0) {
      const s = t[0];
      const n = Number(t[1]);
      if (n <= 8 && c[`${s}${n + 1}`] > 0) score += 2;
      if (n <= 7 && c[`${s}${n + 2}`] > 0) score += 1;
    }
    if ((WINDS.includes(t) || DRAGONS.includes(t)) && v === 1) score -= 1;
  }
  return score;
}

function chooseBotDiscard(hand) {
  const candidates = [...new Set(hand)].sort(tileCompare);
  let bestTile = candidates[0];
  let bestScore = -1e9;
  for (const tile of candidates) {
    const tmp = hand.slice();
    tmp.splice(tmp.indexOf(tile), 1);
    const s = handScoreForBot(tmp);
    if (s > bestScore) {
      bestScore = s;
      bestTile = tile;
    }
  }
  return bestTile;
}

function chooseBotDiscardHard(hand, openMeldCount) {
  const candidates = [...new Set(hand)].sort(tileCompare);
  let bestTile = candidates[0];
  let bestEval = -1e9;

  for (const tile of candidates) {
    const tmp = hand.slice();
    tmp.splice(tmp.indexOf(tile), 1);
    const counts = toCounts(tmp);
    let waits = 0;
    for (const draw of ALL_TILES) {
      const live = 4 - counts[draw];
      if (live <= 0) continue;
      if (isWinWithOpenMelds(tmp.concat(draw), openMeldCount)) waits += live;
    }
    let evalScore = handScoreForBot(tmp) + waits * 6;
    if (waits > 0) evalScore += 14;
    if (evalScore > bestEval) {
      bestEval = evalScore;
      bestTile = tile;
    }
  }

  return bestTile;
}
function isChowMeld(meld) {
  if (meld.length !== 3) return false;
  const seq = meld.slice().sort(tileCompare);
  if (!(isSuited(seq[0]) && seq[0][0] === seq[1][0] && seq[1][0] === seq[2][0])) return false;
  const nums = seq.map(tileNum);
  return nums[1] === nums[0] + 1 && nums[2] === nums[1] + 1;
}

function isPungLikeMeld(meld) {
  if (meld.length === 3) return meld[0] === meld[1] && meld[1] === meld[2];
  if (meld.length === 4) return meld[0] === meld[1] && meld[1] === meld[2] && meld[2] === meld[3];
  return false;
}

function searchMeldPartition(counts, nMelds, acc) {
  if (nMelds === 0) return ALL_TILES.every((t) => counts[t] === 0) ? acc.map((m) => m.slice()) : null;

  let first = null;
  for (const t of ALL_TILES) {
    if (counts[t] > 0) {
      first = t;
      break;
    }
  }
  if (first === null) return null;

  if (counts[first] >= 3) {
    counts[first] -= 3;
    acc.push([first, first, first]);
    const found = searchMeldPartition(counts, nMelds - 1, acc);
    if (found) return found;
    acc.pop();
    counts[first] += 3;
  }

  if (isSuited(first)) {
    const s = first[0];
    const n = tileNum(first);
    if (n <= 7) {
      const t2 = `${s}${n + 1}`;
      const t3 = `${s}${n + 2}`;
      if (counts[t2] > 0 && counts[t3] > 0) {
        counts[first] -= 1;
        counts[t2] -= 1;
        counts[t3] -= 1;
        acc.push([first, t2, t3]);
        const found = searchMeldPartition(counts, nMelds - 1, acc);
        if (found) return found;
        acc.pop();
        counts[first] += 1;
        counts[t2] += 1;
        counts[t3] += 1;
      }
    }
  }

  return null;
}

function findStandardPartition(hand, nMelds) {
  const counts = toCounts(hand);
  for (const pair of ALL_TILES) {
    if (counts[pair] < 2) continue;
    const work = { ...counts };
    work[pair] -= 2;
    const melds = searchMeldPartition(work, nMelds, []);
    if (melds) return [pair, melds];
  }
  return null;
}

function classifySuitType(hand) {
  const suits = new Set(hand.filter((t) => isSuited(t)).map((t) => t[0]));
  const honors = hand.some((t) => WINDS.includes(t) || DRAGONS.includes(t));
  if (suits.size === 0 && honors) return "all_honors";
  if (suits.size === 1 && honors) return "mixed_one_suit";
  if (suits.size === 1 && !honors) return "pure_one_suit";
  return "mixed";
}

function scoreHandPatterns(hand, exposedCount, selfDraw, rules, exposedMelds, bonusTiles, locale = "en") {
  const patterns = [[locale === "zh-HK" ? "\u98df\u7cca" : "Win", 1]];
  const closed = exposedCount === 0;
  if (selfDraw && rules.selfDrawBonus) patterns.push([locale === "zh-HK" ? "\u81ea\u6478" : "Self Draw", 1]);
  if (closed && rules.concealedBonus) patterns.push([locale === "zh-HK" ? "\u9580\u524d\u6e05" : "Concealed Hand", 1]);

  const allTiles = hand.slice();
  for (const m of exposedMelds) allTiles.push(...m);

  const partition = findStandardPartition(hand, Math.max(0, 4 - exposedCount));
  if (closed && isThirteenOrphans(hand)) {
    patterns.push([locale === "zh-HK" ? "\u5341\u4e09\u4e48" : "Thirteen Orphans", 13]);
  } else if (closed && isSevenPairs(hand)) {
    patterns.push([locale === "zh-HK" ? "\u4e03\u5c0d\u5b50" : "Seven Pairs", 4]);
  } else {
    const allMelds = [];
    if (partition) allMelds.push(...partition[1]);
    allMelds.push(...exposedMelds.map((m) => m.slice()));
    if (allMelds.length > 0 && allMelds.every((m) => isPungLikeMeld(m))) {
      patterns.push([locale === "zh-HK" ? "\u5c0d\u5c0d\u7cca" : "All Pungs", 3]);
    }
    const soeng = allMelds.reduce((sum, m) => sum + (isChowMeld(m) ? 1 : 0), 0);
    if (soeng > 0) patterns.push([locale === "zh-HK" ? `\u4e0a x${soeng}` : `Chow x${soeng}`, soeng]);
  }

  const suitType = classifySuitType(allTiles);
  if (suitType === "all_honors") patterns.push([locale === "zh-HK" ? "\u5b57\u4e00\u8272" : "All Honors", 13]);
  else if (suitType === "pure_one_suit") patterns.push([locale === "zh-HK" ? "\u6e05\u4e00\u8272" : "Pure One Suit", 7]);
  else if (suitType === "mixed_one_suit") patterns.push([locale === "zh-HK" ? "\u6df7\u4e00\u8272" : "Mixed One Suit", 3]);

  const flowerPts = bonusTiles.filter((t) => FLOWERS.includes(t)).length;
  const seasonPts = bonusTiles.filter((t) => SEASONS.includes(t)).length;
  if (flowerPts) patterns.push([locale === "zh-HK" ? `\u82b1\u724c x${flowerPts}` : `Flower x${flowerPts}`, flowerPts]);
  if (seasonPts) patterns.push([locale === "zh-HK" ? `\u5b63\u7bc0\u724c x${seasonPts}` : `Season x${seasonPts}`, seasonPts]);

  const total = patterns.reduce((sum, x) => sum + x[1], 0);
  return [total, patterns.map(([name, pts]) => `${name} +${pts}${locale === "zh-HK" ? "\u756a" : " fan"}`)];
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function toInt(val, fallback) {
  const n = Number.parseInt(String(val ?? "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRuleProfile(name, raw = {}) {
  const minFan = Math.max(1, toInt(raw.min_fan ?? raw.minFan, DEFAULT_RULES.minFan));
  const fanCap = Math.max(minFan, toInt(raw.cap ?? raw.fanCap, DEFAULT_RULES.fanCap));
  return {
    name,
    minFan,
    fanCap,
    selfDrawBonus: Boolean(raw.self_draw ?? raw.selfDraw ?? DEFAULT_RULES.selfDrawBonus),
    concealedBonus: Boolean(raw.concealed ?? raw.concealedBonus ?? DEFAULT_RULES.concealedBonus),
  };
}

function loadRuleProfilesFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_RULE_PROFILES);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // Ignore.
  }
  return {};
}

function saveRuleProfilesToStorage(profiles) {
  try {
    localStorage.setItem(STORAGE_RULE_PROFILES, JSON.stringify(profiles));
  } catch {
    // Ignore.
  }
}

async function fetchRuleProfiles() {
  try {
    const res = await fetch(RULE_PROFILE_URL, { cache: "no-store" });
    if (!res.ok) return {};
    const data = await res.json();
    if (data && typeof data === "object") return data;
  } catch {
    // Ignore.
  }
  return {};
}

class MahjongWebGame {
  constructor() {
    this.locale = "zh-HK";
    this.theme = "harbor";
    this.tileBackColor = "#9dc2e8";
    this.players = [
      this.createPlayer(true),
      this.createPlayer(false),
      this.createPlayer(false),
      this.createPlayer(false),
    ];
    this.botNamesEn = ["Kai", "Ming", "Yat", "Chun", "Hoi", "Wing", "Lok", "Hin", "Shun", "Fai"];
    this.botNamesZh = ["嘉明", "一鳴", "俊熙", "海濤", "永樂", "皓軒", "順發", "志宏", "家駿", "偉霖"];
    this.currentBotNames = ["Bot A", "Bot B", "Bot C"];
    this.humanDisplayName = null;
    this.scores = [INITIAL_SCORE, INITIAL_SCORE, INITIAL_SCORE, INITIAL_SCORE];
    this.lastScoreDelta = [0, 0, 0, 0];
    this.rules = { ...DEFAULT_RULES };
    this.ruleProfiles = {};
    this.ruleProfileName = DEFAULT_RULES.name;
    this.botDifficulty = "medium";
    this.roundDice = [1, 1, 1];
    this.wallStartStack = 0;
    this.wall = [];
    this.wallTotal = buildWallTiles().length;
    this.drawnTilesCount = 0;
    this.current = 0;
    this.needDraw = true;
    this.gameOver = false;
    this.pendingClaim = null;
    this.discardHistory = [];
    this.calledDiscardIndices = new Set();
    this.logs = [];
    this.revealAllHands = false;
    this.enableCelebration = false;
    this.congratsTimer = null;
    this.diceCloseRequested = false;
    this.diceCanClose = false;
    this.roundBooting = false;
    this.rulesExpanded = false;
    this.turnTimer = null;
    this.roundWinnerIdx = -1;
    this.dealerStep = 0;
    this.prevailingWindIndex = 0;
    this.fanHistory = [];
    this.scoreHistory = [];
    this.handCounter = 0;
    this.humanDrawnIndex = -1;
    this.layoutRaf = 0;
    this.speechEnabled = true;

    this.dom = {
      app: document.querySelector(".app"),
      homeScreen: document.getElementById("homeScreen"),
      homeTitle: document.getElementById("homeTitle"),
      homeSubtitle: document.getElementById("homeSubtitle"),
      homeLangLabel: document.getElementById("homeLangLabel"),
      homeThemeLabel: document.getElementById("homeThemeLabel"),
      homeBackLabel: document.getElementById("homeBackLabel"),
      homeLangSelect: document.getElementById("homeLangSelect"),
      homeThemeSelect: document.getElementById("homeThemeSelect"),
      homeBackColor: document.getElementById("homeBackColor"),
      startGameBtn: document.getElementById("startGameBtn"),
      titleText: document.getElementById("titleText"),
      scoresTitle: document.getElementById("scoresTitle"),
      resetScoresBtn: document.getElementById("resetScoresBtn"),
      rulesTitle: document.getElementById("rulesTitle"),
      rulesBody: document.getElementById("rulesBody"),
      guideTitle: document.getElementById("guideTitle"),
      rulesOutput: document.getElementById("rulesOutput"),
      guideOutput: document.getElementById("guideOutput"),
      calcTitle: document.getElementById("calcTitle"),
      calcOutput: document.getElementById("calcOutput"),
      logTitle: document.getElementById("logTitle"),
      fanHistoryTitle: document.getElementById("fanHistoryTitle"),
      scoreHistoryTitle: document.getElementById("scoreHistoryTitle"),
      fanHistColHand: document.getElementById("fanHistColHand"),
      fanHistColWinner: document.getElementById("fanHistColWinner"),
      fanHistColFan: document.getElementById("fanHistColFan"),
      fanHistColPatterns: document.getElementById("fanHistColPatterns"),
      scoreHistColHand: document.getElementById("scoreHistColHand"),
      scoreHistColWinner: document.getElementById("scoreHistColWinner"),
      scoreHistColDelta: document.getElementById("scoreHistColDelta"),
      scoreHistColTotal: document.getElementById("scoreHistColTotal"),
      fanHistoryBody: document.getElementById("fanHistoryBody"),
      scoreHistoryBody: document.getElementById("scoreHistoryBody"),
      langSelect: document.getElementById("langSelect"),
      themeSelect: document.getElementById("themeSelect"),
      tileBackColor: document.getElementById("tileBackColor"),
      homeBtn: document.getElementById("homeBtn"),
      configBtn: document.getElementById("configBtn"),
      statusLine: document.getElementById("statusLine"),
      configPanel: document.getElementById("configPanel"),
      cfgDifficultyLabel: document.getElementById("cfgDifficultyLabel"),
      cfgRuleProfileLabel: document.getElementById("cfgRuleProfileLabel"),
      cfgMinFanLabel: document.getElementById("cfgMinFanLabel"),
      cfgCapLabel: document.getElementById("cfgCapLabel"),
      cfgSelfDrawLabel: document.getElementById("cfgSelfDrawLabel"),
      cfgConcealedLabel: document.getElementById("cfgConcealedLabel"),
      difficultySelect: document.getElementById("difficultySelect"),
      minFanInput: document.getElementById("minFanInput"),
      fanCapInput: document.getElementById("fanCapInput"),
      ruleProfileSelect: document.getElementById("ruleProfileSelect"),
      selfDrawBonusInput: document.getElementById("selfDrawBonusInput"),
      concealedBonusInput: document.getElementById("concealedBonusInput"),
      applyConfigBtn: document.getElementById("applyConfigBtn"),
      wallInfo: document.getElementById("wallInfo"),
      tableEl: document.querySelector(".table"),
      midRow: document.querySelector(".midRow"),
      centerCol: document.querySelector(".centerCol"),
      centerZone: document.querySelector(".centerZone"),
      youPanelEl: document.querySelector(".youPanel"),
      wallDice: document.getElementById("wallDice"),
      wallNorth: document.getElementById("wallNorth"),
      wallEast: document.getElementById("wallEast"),
      wallSouth: document.getElementById("wallSouth"),
      wallWest: document.getElementById("wallWest"),
      discardGrid: document.getElementById("discardGrid"),
      claimBar: document.getElementById("claimBar"),
      handRow: document.getElementById("handRow"),
      hintLine: document.getElementById("hintLine"),
      logOutput: document.getElementById("logOutput"),
      scoreList: document.getElementById("scoreList"),
      northPanel: document.getElementById("northPanel"),
      westPanel: document.getElementById("westPanel"),
      eastPanel: document.getElementById("eastPanel"),
      youMeta: document.getElementById("youMeta"),
      bonusRow: document.getElementById("bonusRow"),
      youMelds: document.getElementById("youMelds"),
      newRoundBtn: document.getElementById("newRoundBtn"),
      selfDrawBtn: document.getElementById("selfDrawBtn"),
      nextMatchBtn: document.getElementById("nextMatchBtn"),
      diceOverlay: document.getElementById("diceOverlay"),
      dicePanel: document.getElementById("dicePanel"),
      diceTitle: document.getElementById("diceTitle"),
      startDiceBtn: document.getElementById("startDiceBtn"),
      die1: document.getElementById("die1"),
      die2: document.getElementById("die2"),
      die3: document.getElementById("die3"),
      closeDiceBtn: document.getElementById("closeDiceBtn"),
      congratsOverlay: document.getElementById("congratsOverlay"),
      congratsText: document.getElementById("congratsText"),
      congratsTiles: document.getElementById("congratsTiles"),
      congratsFansTitle: document.getElementById("congratsFansTitle"),
      congratsFans: document.getElementById("congratsFans"),
      congratsCard: document.getElementById("congratsCard"),
      closeCongratsBtn: document.getElementById("closeCongratsBtn"),
    };

    this.dom.newRoundBtn.addEventListener("click", () => this.startRound());
    if (this.dom.resetScoresBtn) this.dom.resetScoresBtn.addEventListener("click", () => this.resetScores());
    if (this.dom.rulesTitle) {
      this.dom.rulesTitle.addEventListener("click", () => this.toggleRulesVisibility());
      this.dom.rulesTitle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.toggleRulesVisibility();
        }
      });
    }
    this.dom.selfDrawBtn.addEventListener("click", () => this.humanSelfDrawWin());
    if (this.dom.nextMatchBtn) this.dom.nextMatchBtn.addEventListener("click", () => this.startNextMatch());
    this.dom.homeBtn.addEventListener("click", () => this.showHome());
    this.dom.configBtn.addEventListener("click", () => this.toggleConfigPanel());
    this.dom.startGameBtn.addEventListener("click", () => this.startFromHome());
    this.dom.applyConfigBtn.addEventListener("click", () => this.applyConfigFromPanel());
    if (this.dom.closeDiceBtn) {
      this.dom.closeDiceBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.requestCloseDice();
      });
    }
    this.dom.closeCongratsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.hideCongrats();
    });
    this.dom.dicePanel.addEventListener("click", (e) => e.stopPropagation());
    this.dom.congratsCard.addEventListener("click", (e) => e.stopPropagation());
    this.dom.diceOverlay.addEventListener("click", () => this.requestCloseDice());
    this.dom.langSelect.addEventListener("change", (e) => {
      this.locale = e.target.value;
      this.dom.homeLangSelect.value = this.locale;
      this.render();
    });
    this.dom.homeLangSelect.addEventListener("change", (e) => {
      this.locale = e.target.value;
      this.dom.langSelect.value = this.locale;
      this.render();
    });
    this.dom.themeSelect.addEventListener("change", (e) => this.setTheme(e.target.value));
    this.dom.homeThemeSelect.addEventListener("change", (e) => this.setTheme(e.target.value));
    this.dom.tileBackColor.addEventListener("input", (e) => this.setTileBackColor(e.target.value));
    this.dom.homeBackColor.addEventListener("input", (e) => this.setTileBackColor(e.target.value));
    window.addEventListener("resize", () => this.scheduleBoardLayout());

    this.dom.app.classList.add("hidden");
    this.syncConfigPanel();
    this.setTheme(this.theme);
    this.setTileBackColor(this.tileBackColor);
    this.updateStaticText();
    this.scheduleBoardLayout();
  }

  async init() {
    await this.loadRuleProfiles();
    this.applyRuleProfile(this.ruleProfileName);
    this.renderRuleProfiles();
    this.syncConfigPanel();
    this.updateStaticText();
  }

  scheduleBoardLayout() {
    if (this.layoutRaf) cancelAnimationFrame(this.layoutRaf);
    this.layoutRaf = requestAnimationFrame(() => {
      this.layoutRaf = 0;
      this.applyBoardLayout();
    });
  }

  applyBoardLayout() {
    const centerZone = this.dom.centerZone;
    const centerCol = this.dom.centerCol;
    if (!centerZone || !centerCol) return;
    const colH = centerCol.clientHeight;
    if (!colH) return;
    const northH = this.dom.northPanel ? this.dom.northPanel.offsetHeight : 0;
    const gap = 8;
    // Fill the middle column width; only control height to avoid bottom clipping.
    const targetH = Math.max(220, colH - northH - gap);
    centerZone.style.width = "100%";
    centerZone.style.height = `${Math.floor(targetH)}px`;
    centerZone.style.margin = "0";
  }

  createPlayer(isHuman) {
    return { isHuman, hand: [], discards: [], melds: [], exposedMelds: [], bonusTiles: [] };
  }

  tr(key, vars = {}) {
    const en = {
      title: "Hong Kong Mahjong",
      homeSubtitle: "Play against 3 bots in one full round.",
      language: "Language",
      theme: "Theme",
      backColor: "Back Tile Color",
      startGame: "Start Game",
      ruleProfile: "Rule Profile",
      selfDrawBonus: "Self-draw bonus",
      concealedBonus: "Concealed bonus",
      home: "Home",
      config: "Config",
      apply: "Apply",
      scores: "Scores",
      resetScores: "Reset Scores",
      scoreDelta: "Score change",
      log: "Log",
      newRound: "New Round",
      selfDrawWin: "Self Draw Win",
      nextMatch: "Next Match",
      rollingDice: "Rolling Dice...",
      clickToRollDice: "You are East. Click to roll dice.",
      clickToCloseDice: "Click to close.",
      startRoll: "Start Roll",
      roundStarted: "Round started. Rule: {rule}.",
      drawGame: "Draw game: wall empty.",
      revealedBonus: "{player} revealed bonus tile {tile}.",
      drewTile: "{player} drew a tile.",
      fanCap: "Fan capped at {cap}",
      pong: "Pong",
      kong: "Kong",
      chi: "Chow",
      ron: "Ron",
      pass: "Pass",
      claimedPong: "{player} claimed Pong {tile}.",
      claimedKong: "{player} claimed Kong {tile}.",
      claimedChi: "{player} claimed Chow {tile}.",
      concealedKongLabel: "Concealed Kong",
      madeConcealedKong: "{player} made concealed Kong {tile}.",
      addedKongLabel: "Add Kong",
      madeAddedKong: "{player} added Kong {tile}.",
      wonOnDiscard: "{player} won on {discarder}'s discard.",
      discarded: "{player} discarded {tile}.",
      declaredSelfDraw: "You declared self draw win.",
      cannotWinYet: "Cannot win yet. Need {minFan} fan minimum.",
      wonBySelfDraw: "{player} won by self draw.",
      canSelfDrawOrDiscard: "You can self draw win ({fan} fan), or discard.",
      result: "Result: {player}, {fan} fan.",
      patterns: "Patterns: {patterns}",
      roundOver: "Round Over",
      turn: "Turn: {player}",
      rule: "Rule: {rule}",
      difficulty: "Difficulty: {difficulty}",
      wallRemaining: "Wall: {count}/{total} | Break: {breakPos}",
      hand: "Hand",
      bonus: "Bonus",
      melds: "Melds",
      none: "none",
      bonusTiles: "Bonus tiles",
      exposedMelds: "Exposed melds",
      roundEndedPress: "Round ended. Press New Round.",
      latestDiscardHint: "Latest discard is highlighted in red.",
      claimOn: "Claim on {tile}:",
      chooseClaim: "Choose a claim action or pass.",
      botsActing: "Bots are acting...",
      canWinOrDiscard: "You can win ({fan} fan) or discard.",
      clickDiscard: "Click a tile to discard.",
      waiting: "Waiting for next action...",
      roundOverPress: "Round over. Press New Round.",
      playerYou: "You",
      difficultyEasy: "Easy",
      difficultyMedium: "Medium",
      difficultyHard: "Hard",
      cfgDifficulty: "Difficulty",
      cfgRuleProfile: "Rule Profile",
      cfgMinFan: "Min Fan",
      cfgFanCap: "Fan Cap",
      cfgSelfDraw: "Self-draw bonus",
      cfgConcealed: "Concealed bonus",
      close: "Close",
      configApplied: "Configuration updated.",
      congrats: "Congratulations {player}! {fan} fan",
      fanBreakdown: "Fan Breakdown",
      fanHistory: "Fan History",
      scoreHistory: "Score History",
      historyHand: "Hand",
      historyWinner: "Winner",
      historyFan: "Fan",
      historyPatterns: "Patterns",
      historyDelta: "Delta",
      historyTotal: "Totals",
      drawLabel: "Draw",
      noFanDetail: "No fan details",
      fanRules: "Fan Rules",
      showFanRules: "Show Fan Rules",
      hideFanRules: "Hide Fan Rules",
      playGuide: "How to Play",
      calculation: "Calculation",
      calcWaiting: "No winning hand yet in this round.",
      seatWind: "Seat",
      roundWind: "Round",
      seatEast: "East",
      seatSouth: "South",
      seatWest: "West",
      seatNorth: "North",
    };
    const zh = {
      title: "香港麻雀",
      homeSubtitle: "與三位電腦進行完整一局對戰。",
      language: "語言",
      theme: "主題",
      backColor: "牌背顏色",
      startGame: "開始遊戲",
      ruleProfile: "房規",
      selfDrawBonus: "\u81ea\u6478\u52a0\u756a",
      concealedBonus: "\u9580\u524d\u6e05\u52a0\u756a",
      home: "主畫面",
      scores: "分數",
      resetScores: "重置分數",
      scoreDelta: "本局分差",
      log: "紀錄",
      newRound: "新開一局",
      selfDrawWin: "自摸食糊",
      nextMatch: "下一局",
      rollingDice: "擲骰中...",
      clickToRollDice: "你是東家，請點擊開始擲骰。",
      clickToCloseDice: "點擊關閉。",
      startRoll: "開始擲骰",
      roundStarted: "新一局開始。房規：{rule}。",
      drawGame: "流局：牌牆已空。",
      revealedBonus: "{player} 補花：{tile}。",
      drewTile: "{player} 摸牌。",
      fanCap: "封頂 {cap} 番",
      pong: "碰",
      kong: "槓",
      chi: "上",
      ron: "食糊",
      pass: "跳過",
      claimedPong: "{player} 碰 {tile}。",
      claimedKong: "{player} 槓 {tile}。",
      claimedChi: "{player} 上 {tile}。",
      concealedKongLabel: "暗槓",
      madeConcealedKong: "{player} 暗槓 {tile}。",
      addedKongLabel: "加槓",
      madeAddedKong: "{player} 加槓 {tile}。",
      wonOnDiscard: "{player} 食糊 {discarder} 的棄牌。",
      discarded: "{player} 打出 {tile}。",
      declaredSelfDraw: "你宣告自摸食糊。",
      cannotWinYet: "未達食糊條件，至少需要 {minFan} 番。",
      wonBySelfDraw: "{player} 自摸食糊。",
      canSelfDrawOrDiscard: "你可自摸食糊（{fan} 番），或選擇打牌。",
      result: "結果：{player}，{fan} 番。",
      patterns: "番型：{patterns}",
      roundOver: "本局結束",
      turn: "目前輪到：{player}",
      rule: "房規：{rule}",
      difficulty: "難度：{difficulty}",
      wallRemaining: "牌牆：{count}/{total} | 開門位：{breakPos}",
      hand: "手牌",
      bonus: "花季",
      melds: "副露",
      none: "無",
      bonusTiles: "花季牌",
      exposedMelds: "副露",
      roundEndedPress: "本局已結束，請按「新開一局」。",
      latestDiscardHint: "紅框為最新一張棄牌。",
      claimOn: "可宣告：{tile}",
      chooseClaim: "請選擇上／碰／槓／食糊，或跳過。",
      botsActing: "電腦行動中...",
      canWinOrDiscard: "你可食糊（{fan} 番）或打牌。",
      clickDiscard: "請點擊手牌打出。",
      waiting: "等待下一步...",
      roundOverPress: "本局已結束，按「新開一局」。",
      playerYou: "你",
      difficultyEasy: "初階",
      difficultyMedium: "中階",
      difficultyHard: "進階",
      config: "設定",
      apply: "套用",
      cfgDifficulty: "難度",
      cfgRuleProfile: "\u623f\u898f",
      cfgMinFan: "\u6700\u4f4e\u756a\u6578",
      cfgFanCap: "\u756a\u6578\u4e0a\u9650",
      cfgSelfDraw: "\u81ea\u6478\u52a0\u756a",
      cfgConcealed: "\u9580\u524d\u6e05\u52a0\u756a",
      close: "關閉",
      configApplied: "設定已更新。",
      congrats: "恭喜 {player}！{fan} 番",
      fanBreakdown: "番型明細",
      fanHistory: "番數歷史",
      scoreHistory: "分數歷史",
      historyHand: "局",
      historyWinner: "贏家",
      historyFan: "番",
      historyPatterns: "番型",
      historyDelta: "加減",
      historyTotal: "總分",
      drawLabel: "流局",
      noFanDetail: "沒有番型資料",
      fanRules: "番數規則",
      showFanRules: "顯示番數規則",
      hideFanRules: "隱藏番數規則",
      playGuide: "玩法說明",
      calculation: "計番明細",
      calcWaiting: "本局尚未出現食糊計番。",
      seatWind: "門風",
      roundWind: "圈風",
      seatEast: "東",
      seatSouth: "南",
      seatWest: "西",
      seatNorth: "北",
    };
    const dict = this.locale === "zh-HK" ? zh : en;
    return (dict[key] || en[key] || key).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
  }
  updateStaticText() {
    document.documentElement.lang = this.locale === "zh-HK" ? "zh-HK" : "en";
    this.dom.titleText.textContent = this.tr("title");
    this.dom.homeTitle.textContent = this.tr("title");
    this.dom.homeSubtitle.textContent = this.tr("homeSubtitle");
    this.dom.homeLangLabel.textContent = this.tr("language");
    this.dom.homeThemeLabel.textContent = this.tr("theme");
    this.dom.homeBackLabel.textContent = this.tr("backColor");
    this.dom.startGameBtn.textContent = this.tr("startGame");
    this.dom.scoresTitle.textContent = this.tr("scores");
    if (this.dom.resetScoresBtn) this.dom.resetScoresBtn.textContent = this.tr("resetScores");
    if (this.dom.rulesTitle) this.dom.rulesTitle.textContent = this.tr("fanRules");
    if (this.dom.guideTitle) this.dom.guideTitle.textContent = this.tr("playGuide");
    if (this.dom.calcTitle) this.dom.calcTitle.textContent = this.tr("calculation");
    this.toggleRulesVisibility(this.rulesExpanded);
    this.dom.logTitle.textContent = this.tr("log");
    if (this.dom.fanHistoryTitle) this.dom.fanHistoryTitle.textContent = this.tr("fanHistory");
    if (this.dom.scoreHistoryTitle) this.dom.scoreHistoryTitle.textContent = this.tr("scoreHistory");
    if (this.dom.fanHistColHand) this.dom.fanHistColHand.textContent = this.tr("historyHand");
    if (this.dom.fanHistColWinner) this.dom.fanHistColWinner.textContent = this.tr("historyWinner");
    if (this.dom.fanHistColFan) this.dom.fanHistColFan.textContent = this.tr("historyFan");
    if (this.dom.fanHistColPatterns) this.dom.fanHistColPatterns.textContent = this.tr("historyPatterns");
    if (this.dom.scoreHistColHand) this.dom.scoreHistColHand.textContent = this.tr("historyHand");
    if (this.dom.scoreHistColWinner) this.dom.scoreHistColWinner.textContent = this.tr("historyWinner");
    if (this.dom.scoreHistColDelta) this.dom.scoreHistColDelta.textContent = this.tr("historyDelta");
    if (this.dom.scoreHistColTotal) this.dom.scoreHistColTotal.textContent = this.tr("historyTotal");
    this.dom.newRoundBtn.textContent = this.tr("newRound");
    this.dom.homeBtn.textContent = this.tr("home");
    this.dom.configBtn.textContent = this.tr("config");
    this.dom.selfDrawBtn.textContent = this.tr("selfDrawWin");
    if (this.dom.nextMatchBtn) this.dom.nextMatchBtn.textContent = this.tr("nextMatch");
    this.dom.cfgDifficultyLabel.textContent = this.tr("cfgDifficulty");
    if (this.dom.cfgRuleProfileLabel) this.dom.cfgRuleProfileLabel.textContent = this.tr("cfgRuleProfile");
    this.dom.cfgMinFanLabel.textContent = this.tr("cfgMinFan");
    this.dom.cfgCapLabel.textContent = this.tr("cfgFanCap");
    if (this.dom.cfgSelfDrawLabel) this.dom.cfgSelfDrawLabel.textContent = this.tr("cfgSelfDraw");
    if (this.dom.cfgConcealedLabel) this.dom.cfgConcealedLabel.textContent = this.tr("cfgConcealed");
    this.dom.applyConfigBtn.textContent = this.tr("apply");
    this.dom.congratsFansTitle.textContent = this.tr("fanBreakdown");
    if (this.dom.startDiceBtn) this.dom.startDiceBtn.textContent = this.tr("startRoll");
    if (this.dom.closeDiceBtn) this.dom.closeDiceBtn.textContent = this.tr("close");
    if (this.dom.closeCongratsBtn) this.dom.closeCongratsBtn.textContent = this.tr("close");
    this.renderRulesGuide();
    if (this.dom.calcOutput && !this.dom.calcOutput.textContent.trim()) this.dom.calcOutput.textContent = this.tr("calcWaiting");
    this.renderRuleProfiles();
  }

  async loadRuleProfiles() {
    const remote = await fetchRuleProfiles();
    const local = loadRuleProfilesFromStorage();
    const merged = { ...remote, ...local };
    if (!merged[DEFAULT_RULES.name]) {
      merged[DEFAULT_RULES.name] = {
        min_fan: String(DEFAULT_RULES.minFan),
        cap: String(DEFAULT_RULES.fanCap),
        self_draw: DEFAULT_RULES.selfDrawBonus,
        concealed: DEFAULT_RULES.concealedBonus,
      };
    }
    this.ruleProfiles = merged;
    const storedName = (() => {
      try {
        return localStorage.getItem(STORAGE_RULE_PROFILE_NAME) || "";
      } catch {
        return "";
      }
    })();
    this.ruleProfileName = merged[storedName] ? storedName : this.rules.name;
  }

  applyRuleProfile(name) {
    const profile = this.ruleProfiles[name] || this.ruleProfiles[DEFAULT_RULES.name] || {};
    this.rules = normalizeRuleProfile(name, profile);
    this.ruleProfileName = this.rules.name;
  }

  renderRuleProfiles() {
    if (!this.dom.ruleProfileSelect) return;
    const names = Object.keys(this.ruleProfiles || {});
    if (!names.length) return;
    this.dom.ruleProfileSelect.innerHTML = "";
    for (const name of names) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      this.dom.ruleProfileSelect.appendChild(opt);
    }
    this.dom.ruleProfileSelect.value = this.ruleProfileName;
    this.dom.ruleProfileSelect.onchange = () => {
      const next = this.dom.ruleProfileSelect.value;
      this.applyRuleProfile(next);
      this.syncConfigPanel();
      this.render();
    };
  }

  toggleRulesVisibility(force) {
    const expanded = typeof force === "boolean" ? force : !this.rulesExpanded;
    this.rulesExpanded = expanded;
    if (this.dom.rulesBody) this.dom.rulesBody.classList.toggle("hidden", !expanded);
    if (this.dom.rulesTitle) this.dom.rulesTitle.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  queueAction(fn, delayMs) {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null;
      fn();
    }, delayMs);
  }

  setTheme(theme) {
    this.theme = theme;
    document.body.dataset.theme = theme;
    this.dom.themeSelect.value = theme;
    this.dom.homeThemeSelect.value = theme;
    this.render();
  }

  adjustColor(hex, delta) {
    const v = hex.replace("#", "");
    const n = Number.parseInt(v, 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + delta));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + delta));
    const b = Math.max(0, Math.min(255, (n & 0xff) + delta));
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  }

  setTileBackColor(hex) {
    this.tileBackColor = hex;
    const bright = this.adjustColor(hex, 28);
    const dark = this.adjustColor(hex, -16);
    document.documentElement.style.setProperty("--tile-back-a", bright);
    document.documentElement.style.setProperty("--tile-back-b", dark);
    this.dom.tileBackColor.value = hex;
    this.dom.homeBackColor.value = hex;
  }

  syncConfigPanel() {
    this.dom.difficultySelect.value = this.botDifficulty;
    if (this.dom.ruleProfileSelect) this.dom.ruleProfileSelect.value = this.ruleProfileName;
    this.dom.minFanInput.value = String(this.rules.minFan);
    this.dom.fanCapInput.value = String(this.rules.fanCap);
    if (this.dom.selfDrawBonusInput) this.dom.selfDrawBonusInput.checked = !!this.rules.selfDrawBonus;
    if (this.dom.concealedBonusInput) this.dom.concealedBonusInput.checked = !!this.rules.concealedBonus;
  }

  toggleConfigPanel() {
    this.syncConfigPanel();
    this.dom.configPanel.classList.toggle("hidden");
  }

  applyConfigFromPanel() {
    const diff = this.dom.difficultySelect.value;
    const minFan = Math.max(1, Math.min(13, Number.parseInt(this.dom.minFanInput.value, 10) || 3));
    const rawCap = Math.max(1, Math.min(13, Number.parseInt(this.dom.fanCapInput.value, 10) || 10));
    const fanCap = Math.max(minFan, rawCap);
    const profileName = this.dom.ruleProfileSelect && this.dom.ruleProfileSelect.value
      ? this.dom.ruleProfileSelect.value
      : this.rules.name;
    const selfDrawBonus = this.dom.selfDrawBonusInput ? !!this.dom.selfDrawBonusInput.checked : this.rules.selfDrawBonus;
    const concealedBonus = this.dom.concealedBonusInput ? !!this.dom.concealedBonusInput.checked : this.rules.concealedBonus;
    this.botDifficulty = ["easy", "medium", "hard"].includes(diff) ? diff : "medium";
    this.ruleProfileName = profileName;
    this.ruleProfiles[profileName] = {
      min_fan: String(minFan),
      cap: String(fanCap),
      self_draw: selfDrawBonus,
      concealed: concealedBonus,
    };
    saveRuleProfilesToStorage(this.ruleProfiles);
    try {
      localStorage.setItem(STORAGE_RULE_PROFILE_NAME, this.ruleProfileName);
    } catch {}
    this.rules = normalizeRuleProfile(profileName, this.ruleProfiles[profileName]);
    this.syncConfigPanel();
    this.dom.configPanel.classList.add("hidden");
    this.log(this.tr("configApplied"));
    this.render();
  }

  randomizeBotNames() {
    const pool = this.locale === "zh-HK" ? this.botNamesZh.slice() : this.botNamesEn.slice();
    shuffleInPlace(pool);
    this.currentBotNames = pool.slice(0, 3);
  }

  speakText(text, lang = "zh-HK") {
    if (!this.speechEnabled || !text || !window.speechSynthesis) return;
    try {
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = lang;
      utt.rate = lang.startsWith("zh") ? 0.95 : 1.0;
      window.speechSynthesis.speak(utt);
    } catch {}
  }

  playActionClip(action, onFail = null) {
    if (!this.speechEnabled) return false;
    const sourcesByAction = {
      chi: ["assets/sfx/chi_soeng5.wav", "assets/sfx/claim.wav"],
    };
    const sources = sourcesByAction[action];
    if (!sources || !sources.length) return false;
    const tryAt = (idx) => {
      if (idx >= sources.length) {
        if (typeof onFail === "function") onFail();
        return;
      }
      try {
        const audio = new Audio(sources[idx]);
        audio.volume = 1.0;
        const fail = () => tryAt(idx + 1);
        audio.addEventListener("error", fail, { once: true });
        const p = audio.play();
        if (p && typeof p.catch === "function") p.catch(() => fail());
      } catch {
        tryAt(idx + 1);
      }
    };
    tryAt(0);
    return true;
  }

  isLikelyFemaleName(name) {
    if (!name) return false;
    const n = String(name).trim();
    const femaleExact = new Set([
      "Mei", "Ling", "Yan", "Wing", "Faye", "Ivy", "Kelly", "Joyce", "Cindy", "Mandy",
      "阿May", "阿Ling", "阿Yan", "美玲", "嘉欣", "慧玲", "詠", "Wing",
    ]);
    if (femaleExact.has(n)) return true;
    // Common feminine cues in CJK names.
    if (/[婷玲欣雯敏兒雅詠怡穎雪芳娜媚]/.test(n)) return true;
    return false;
  }

  chooseVoice(lang, femalePreferred) {
    if (!window.speechSynthesis || !window.speechSynthesis.getVoices) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    const langLc = lang.toLowerCase();
    let byLang = voices.filter((v) => (v.lang || "").toLowerCase().startsWith(langLc));
    if (!byLang.length && langLc.startsWith("yue")) {
      byLang = voices.filter((v) => (v.lang || "").toLowerCase().startsWith("zh-hk"));
    }
    if (!byLang.length) return null;
    if (langLc.startsWith("yue") || langLc.startsWith("zh-hk")) {
      const cantoHints = ["cantonese", "yue", "hong kong", "香港", "廣東話", "粤语", "粵語"];
      const cantoVoices = byLang.filter((v) => {
        const s = `${v.name || ""} ${v.voiceURI || ""}`.toLowerCase();
        return cantoHints.some((h) => s.includes(h));
      });
      if (cantoVoices.length) byLang = cantoVoices;
    }
    const femaleHints = ["female", "woman", "girl", "女"];
    const maleHints = ["male", "man", "boy", "男"];
    const hinted = byLang.find((v) => {
      const s = `${v.name || ""} ${v.voiceURI || ""}`.toLowerCase();
      return femalePreferred
        ? femaleHints.some((h) => s.includes(h))
        : maleHints.some((h) => s.includes(h));
    });
    return hinted || byLang[0];
  }

  speakDeclaration(playerIdx, action, tile = null) {
    const zhAction = action === "pong" ? "碰"
      : action === "kong" ? "槓"
        : action === "chi" ? "上"
          : action === "ron" ? "食糊"
            : action === "selfdraw" ? "自摸"
              : action === "concealed_kong" ? "暗槓"
                : action === "added_kong" ? "加槓"
                  : action;
    const enAction = action === "pong" ? "Pong"
      : action === "kong" ? "Kong"
        : action === "chi" ? "Chow"
          : action === "ron" ? "Ron"
            : action === "selfdraw" ? "Self Draw"
              : action === "concealed_kong" ? "Concealed Kong"
              : action === "added_kong" ? "Added Kong"
                  : action;
    if (!this.speechEnabled || !window.speechSynthesis) return;
    const player = this.playerNameByIndex(playerIdx);
    const femalePreferred = this.isLikelyFemaleName(player);
    const lang = this.locale === "zh-HK" ? "yue-HK" : "en-US";
    const text = this.locale === "zh-HK" ? zhAction : enAction;
    try {
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = this.locale === "zh-HK" ? "zh-HK" : lang;
      utt.rate = lang.startsWith("zh") ? 0.95 : 1.0;
      utt.pitch = femalePreferred ? 1.2 : 0.9;
      const voice = this.chooseVoice(lang, femalePreferred);
      if (voice) utt.voice = voice;
      window.speechSynthesis.speak(utt);
    } catch {}
  }

  playerSideByIndex(idx) {
    if (idx === 0) return "south";
    if (idx === 1) return "east";
    if (idx === 2) return "west";
    return "north";
  }

  startNextMatch() {
    if (!this.gameOver || this.roundWinnerIdx < 0 || this.roundBooting) return;
    this.dealerStep = (this.dealerStep + 1) % 4;
    if (this.dealerStep === 0) this.prevailingWindIndex = (this.prevailingWindIndex + 1) % 4;
    this.startRound();
  }

  playerNameByIndex(idx) {
    if (idx === 0) return this.humanDisplayName || this.tr("playerYou");
    return this.currentBotNames[idx - 1] || `Bot ${idx}`;
  }

  difficultyLabel() {
    const key = this.botDifficulty === "easy" ? "difficultyEasy" : this.botDifficulty === "hard" ? "difficultyHard" : "difficultyMedium";
    return this.tr(key);
  }

  seatLabelByIndex(idx) {
    const wind = this.seatWindTileByIndex(idx);
    const map = { E: "seatEast", S: "seatSouth", W: "seatWest", N: "seatNorth" };
    return this.tr(map[wind] || "seatEast");
  }

  seatWindTileByIndex(idx) {
    const pos = SEAT_ROTATION_ORDER.indexOf(idx);
    if (pos < 0) return "E";
    const windIdx = (pos - this.dealerStep + 4) % 4;
    return WINDS[windIdx];
  }

  roundWindTile() {
    return WINDS[this.prevailingWindIndex] || "E";
  }

  windLabel(tile) {
    const key = tile === "E" ? "seatEast" : tile === "S" ? "seatSouth" : tile === "W" ? "seatWest" : "seatNorth";
    return this.tr(key);
  }

  seatPositionLabel(tile) {
    const base = this.windLabel(tile);
    return this.locale === "zh-HK" ? `${base}位` : `${base} Seat`;
  }

  roundWindLabel(tile) {
    const base = this.windLabel(tile);
    return this.locale === "zh-HK" ? `${base}圈` : `${base} Round`;
  }

  playerNameWithWinds(idx) {
    const seat = this.seatPositionLabel(this.seatWindTileByIndex(idx));
    return `${this.playerNameByIndex(idx)} (${seat})`;
  }

  renderRulesGuide() {
    if (!this.dom.rulesOutput || !this.dom.guideOutput) return;
    const fanCap = this.rules.fanCap;
    const minFan = this.rules.minFan;
    const rulesZh = [
      `\u98df\u7cca\u6e96\u5247\uff1a\u6a19\u6e96\u70ba\u56db\u7d44\u4e00\u5c0d\uff1b\u4f8b\u5916\u53ef\u7528\u5341\u4e09\u4e48\u3001\u4e03\u5c0d\u5b50`,
      `\u8d77\u7cca\u756a\u6578\uff1a\u81f3\u5c11 ${minFan} \u756a\uff08\u53ef\u65bc\u8a2d\u5b9a\u66f4\u6539\uff09`,
      `\u5c01\u9802\uff1a${fanCap} \u756a`,
      `\u98df\u7cca +1\u756a`,
      `\u81ea\u6478 +1\u756a\uff08\u53ef\u958b\u95dc\uff09`,
      `\u9580\u524d\u6e05 +1\u756a\uff08\u53ef\u958b\u95dc\uff09`,
      `\u5c0d\u5c0d\u7cca +3\u756a`,
      `\u4e0a (\u9806\u5b50) \u6bcf\u7d44 +1\u756a`,
      `\u6df7\u4e00\u8272 +3\u756a`,
      `\u6e05\u4e00\u8272 +7\u756a`,
      `\u5b57\u4e00\u8272 +13\u756a`,
      `\u4e03\u5c0d\u5b50 +4\u756a`,
      `\u5341\u4e09\u4e48 +13\u756a`,
      `\u82b1\u724c \u6bcf\u5f35 +1\u756a`,
      `\u5b63\u7bc0\u724c \u6bcf\u5f35 +1\u756a`,
      `\u8a3b\uff1a\u672c\u9801\u53ea\u5217\u672c\u7a0b\u5f0f\u5df2\u5be6\u4f5c\u7684\u724c\u578b\u8207\u8a08\u756a`,
    ];
    const rulesEn = [
      "Win rule: standard 4 melds + 1 pair; exceptions include Thirteen Orphans / Seven Pairs",
      `Minimum to win: ${minFan} fan (configurable)`,
      `Fan cap: ${fanCap}`,
      "Win +1 fan",
      "Self Draw +1 fan",
      "Concealed Hand +1 fan",
      "All Pungs +3 fan",
      "Each Chow +1 fan",
      "Mixed One Suit +3 fan",
      "Pure One Suit +7 fan",
      "All Honors +13 fan",
      "Seven Pairs +4 fan",
      "Thirteen Orphans +13 fan",
      "Flower tiles +1 fan each",
      "Season tiles +1 fan each",
      "Note: this list only shows rules currently implemented in this app.",
    ];
    const guideZh = [
      "1. \u958b\u5c40\u5f8c\u6309\u5ea7\u6b21\u884c\u724c\uff0c\u8f2a\u5230\u4f60\u6642\u5148\u6478\u5f8c\u6253\u3002",
      "2. \u53ef\u5ba3\u544a\u5403/\u78b0/\u69d3/\u98df\u7cca\uff1b\u82e5\u7121\u53ef\u5ba3\u544a\u5247\u7531\u4e0b\u5bb6\u7e7c\u7e8c\u3002",
      "3. \u7576\u81ea\u6478\u53ef\u98df\u7cca\u6642\uff0c\u6309\u300c\u548c\u724c\uff08\u81ea\u6478\uff09\u300d\u7d50\u675f\u672c\u5c40\u3002",
      "4. \u672c\u5c40\u7d50\u675f\u6703\u986f\u793a\u756a\u578b\u660e\u7d30\u8207\u7e3d\u756a\u6578\u3002",
      "5. \u6309\u300c\u65b0\u958b\u4e00\u5c40\u300d\u91cd\u65b0\u767c\u724c\u3002",
    ];
    const guideEn = [
      "1. Turn order follows Mahjong seats; draw then discard.",
      "2. Claims available: Chow/Pong/Kong/Ron when legal.",
      "3. If self-draw is available, press the win button to end the hand.",
      "4. Win summary shows full fan breakdown.",
      "5. Press New Round to redeal.",
    ];
    const rules = this.locale === "zh-HK" ? rulesZh : rulesEn;
    const guide = this.locale === "zh-HK" ? guideZh : guideEn;
    this.dom.rulesOutput.innerHTML = `<ul>${rules.map((x) => `<li>${x}</li>`).join("")}</ul>`;
    this.dom.guideOutput.innerHTML = `<ul>${guide.map((x) => `<li>${x}</li>`).join("")}</ul>`;
  }

  renderCalcSummary(fan, lines) {
    if (!this.dom.calcOutput) return;
    if (!lines || !lines.length) {
      this.dom.calcOutput.textContent = this.tr("calcWaiting");
      return;
    }
    const totalLine = this.locale === "zh-HK" ? `總番數：${fan} 番` : `Total fan: ${fan}`;
    this.dom.calcOutput.innerHTML = `<ul><li>${totalLine}</li>${lines.map((x) => `<li>${x}</li>`).join("")}</ul>`;
  }

  log(msg) {
    this.logs.push(msg);
    this.logs = this.logs.slice(-220);
    this.dom.logOutput.textContent = this.logs.join("\n");
    this.dom.logOutput.scrollTop = this.dom.logOutput.scrollHeight;
  }

  showHome() {
    this.dom.configPanel.classList.add("hidden");
    this.hideCongrats();
    this.hideDiceOverlay();
    this.dom.app.classList.add("hidden");
    this.dom.homeScreen.classList.remove("hidden");
  }

  async startFromHome() {
    this.locale = this.dom.homeLangSelect.value;
    this.dom.langSelect.value = this.locale;
    this.setTheme(this.dom.homeThemeSelect.value);
    this.setTileBackColor(this.dom.homeBackColor.value);
    this.updateStaticText();
    this.dom.configPanel.classList.add("hidden");
    this.dom.homeScreen.classList.add("hidden");
    this.dom.app.classList.remove("hidden");
    this.dealerStep = 0;
    this.prevailingWindIndex = 0;
    this.fanHistory = [];
    this.scoreHistory = [];
    this.handCounter = 0;
    this.resetScores(false);
    await this.startRound();
  }

  resetScores(doRender = true) {
    this.scores = [INITIAL_SCORE, INITIAL_SCORE, INITIAL_SCORE, INITIAL_SCORE];
    this.lastScoreDelta = [0, 0, 0, 0];
    if (doRender) {
      this.log(this.tr("resetScores"));
      this.render();
    }
  }

  diceFaceSvg(value) {
    const pip = (x, y, show) => show
      ? `<circle cx="${x}" cy="${y}" r="6.2" fill="#1f1f1f"/>`
      : "";
    const map = {
      1: [0, 0, 1, 0, 0, 0, 0],
      2: [1, 0, 0, 0, 0, 0, 1],
      3: [1, 0, 0, 1, 0, 0, 1],
      4: [1, 1, 0, 0, 0, 1, 1],
      5: [1, 1, 0, 1, 0, 1, 1],
      6: [1, 1, 1, 0, 1, 1, 1],
    };
    const p = map[value] || map[1];
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <rect x="2" y="2" width="60" height="60" rx="12" fill="#fffdfa" stroke="#3c3320" stroke-width="2"/>
        ${pip(16, 16, p[0])}
        ${pip(32, 16, p[1])}
        ${pip(48, 16, p[2])}
        ${pip(32, 32, p[3])}
        ${pip(16, 48, p[4])}
        ${pip(32, 48, p[5])}
        ${pip(48, 48, p[6])}
      </svg>
    `;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  setDieFace(el, value) {
    el.innerHTML = "";
    const img = document.createElement("img");
    img.src = this.diceFaceSvg(value);
    img.alt = `dice-${value}`;
    el.appendChild(img);
  }

  renderWallDice() {
    this.dom.wallDice.innerHTML = "";
    for (const v of this.roundDice) {
      const d = document.createElement("div");
      d.className = "die";
      this.setDieFace(d, v);
      this.dom.wallDice.appendChild(d);
    }
  }

  waitForDiceStartClick() {
    return new Promise((resolve) => {
      if (!this.dom.startDiceBtn) {
        resolve(true);
        return;
      }
      const onStart = (e) => {
        e.stopPropagation();
        cleanup();
        resolve(true);
      };
      const cleanup = () => {
        this.dom.startDiceBtn.removeEventListener("click", onStart);
      };
      this.dom.startDiceBtn.addEventListener("click", onStart);
    });
  }

  waitForDiceCloseClick() {
    return new Promise((resolve) => {
      const onClose = () => {
        cleanup();
        resolve(true);
      };
      const cleanup = () => {
        this.dom.diceOverlay.removeEventListener("click", onClose);
        this.dom.dicePanel.removeEventListener("click", onClose);
      };
      this.dom.diceOverlay.addEventListener("click", onClose);
      this.dom.dicePanel.addEventListener("click", onClose);
    });
  }

  async animateDice() {
    this.diceCloseRequested = false;
    this.diceCanClose = false;
    this.dom.diceOverlay.classList.remove("hidden");
    const diceEls = [this.dom.die1, this.dom.die2, this.dom.die3];
    for (let i = 0; i < 3; i += 1) this.setDieFace(diceEls[i], this.roundDice[i]);
    const waitForEastClick = this.seatWindTileByIndex(0) === "E";
    if (this.dom.startDiceBtn) this.dom.startDiceBtn.classList.toggle("hidden", !waitForEastClick);
    if (waitForEastClick) {
      this.dom.diceTitle.textContent = this.tr("clickToRollDice");
      await this.waitForDiceStartClick();
    }
    if (this.dom.startDiceBtn) this.dom.startDiceBtn.classList.add("hidden");
    this.dom.diceTitle.textContent = this.tr("rollingDice");
    for (const d of diceEls) d.classList.add("rolling");
    let ticks = 24;
    return new Promise((resolve) => {
      const timer = setInterval(() => {
        this.roundDice = [1, 2, 3].map(() => 1 + Math.floor(Math.random() * 6));
        this.setDieFace(this.dom.die1, this.roundDice[0]);
        this.setDieFace(this.dom.die2, this.roundDice[1]);
        this.setDieFace(this.dom.die3, this.roundDice[2]);
        ticks -= 1;
        if (ticks <= 0 || this.diceCloseRequested) {
          clearInterval(timer);
          for (const d of diceEls) d.classList.remove("rolling");
          this.dom.diceTitle.textContent = this.tr("clickToCloseDice");
          this.diceCanClose = true;
          this.waitForDiceCloseClick().then(() => {
            this.hideDiceOverlay();
            resolve(this.roundDice);
          });
        }
      }, 90);
    });
  }

  computeBreakColumnFromDice(sum, totalCols) {
    const perSide = Math.max(1, Math.floor(totalCols / 4));
    const sideBySeatWind = { E: "south", S: "east", W: "north", N: "west" };
    for (let i = 0; i < 4; i += 1) {
      sideBySeatWind[this.seatWindTileByIndex(i)] = this.playerSideByIndex(i);
    }
    // Side selection follows Mahjong seat order: East -> South -> West -> North.
    const chosenWind = WINDS[((sum - 1) % 4 + 4) % 4];
    const chosenSide = sideBySeatWind[chosenWind] || "east";
    const base = {
      north: 0,
      east: perSide,
      south: 2 * perSide,
      west: 3 * perSide,
    };
    // Start counting from the right end of the chosen side.
    const rightEnd = {
      north: base.north + (perSide - 1),
      east: base.east + (perSide - 1),
      south: base.south,
      west: base.west,
    };
    // Count columns clockwise by dice sum, then draw starts at next column.
    return (rightEnd[chosenSide] + sum) % totalCols;
  }

  requestCloseDice() {
    if (!this.diceCanClose) return;
    this.diceCloseRequested = true;
    this.hideDiceOverlay();
  }

  hideDiceOverlay() {
    this.diceCanClose = false;
    this.dom.diceOverlay.classList.add("hidden");
  }

  async startRound() {
    if (this.roundBooting) return;
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    this.roundBooting = true;
    this.randomizeBotNames();
    this.current = 0;
    this.needDraw = true;
    this.gameOver = false;
    this.roundWinnerIdx = -1;
    this.pendingClaim = null;
    this.discardHistory = [];
    this.calledDiscardIndices = new Set();
    this.revealAllHands = false;
    this.hideCongrats();
    this.hideDiceOverlay();
    this.dom.congratsTiles.innerHTML = "";
    this.dom.congratsFans.innerHTML = "";
    if (this.dom.calcOutput) this.dom.calcOutput.textContent = this.tr("calcWaiting");
    this.logs = [];
    this.drawnTilesCount = 0;
    this.humanDrawnIndex = -1;
    // Reset visual wall to full before dice roll so previous-round depletion is not shown.
    this.wall = buildWallTiles();
    this.wallTotal = this.wall.length;
    this.wallStartStack = 0;
    for (const p of this.players) {
      p.hand = [];
      p.discards = [];
      p.melds = [];
      p.exposedMelds = [];
      p.bonusTiles = [];
    }
    this.render();
    const [d1, d2, d3] = await this.animateDice();
    this.wall = buildWallTiles();
    this.wallTotal = this.wall.length;
    shuffleInPlace(this.wall);
    const totalCols = Math.max(1, Math.floor(this.wallTotal / 2));
    const diceSum = d1 + d2 + d3;
    this.wallStartStack = this.computeBreakColumnFromDice(diceSum, totalCols);
    const cut = (this.wallStartStack * 2) % this.wall.length;
    this.wall = this.wall.slice(cut).concat(this.wall.slice(0, cut));
    for (let r = 0; r < 13; r += 1) {
      for (let i = 0; i < 4; i += 1) {
        if (!this.drawTileIntoPlayer(i)) {
          this.roundBooting = false;
          return;
        }
      }
    }
    this.log(this.tr("roundStarted", { rule: this.rules.name }));
    this.roundBooting = false;
    this.render();
    this.queueAction(() => this.advanceGameLoop(), 120);
  }

  drawTileIntoPlayer(playerIdx) {
    if (this.wall.length === 0) {
      this.endRound(this.tr("drawGame"));
      return false;
    }
    const p = this.players[playerIdx];
    while (true) {
      if (this.wall.length === 0) {
        this.endRound(this.tr("drawGame"));
        return false;
      }
      const tile = this.wall.shift();
      this.drawnTilesCount += 1;
      if (BONUS_TILES.includes(tile)) {
        p.bonusTiles.push(tile);
        this.log(this.tr("revealedBonus", { player: this.playerNameByIndex(playerIdx), tile: tileName(tile, this.locale) }));
        continue;
      }
      p.hand.push(tile);
      const keepDrawnAtRight = playerIdx === 0 && !this.roundBooting && this.current === 0 && this.needDraw;
      if (!keepDrawnAtRight) p.hand.sort(tileCompare);
      return true;
    }
  }

  drawForCurrent() {
    if (!this.drawTileIntoPlayer(this.current)) return false;
    if (this.current === 0) {
      const you = this.players[0];
      this.humanDrawnIndex = you.hand.length - 1;
    } else {
      this.humanDrawnIndex = -1;
    }
    this.log(this.tr("drewTile", { player: this.playerNameByIndex(this.current) }));
    return true;
  }

  evaluateWin(player, extraTile = null, selfDraw = false) {
    const tiles = player.hand.slice();
    if (extraTile) tiles.push(extraTile);
    if (!isWinWithOpenMelds(tiles, player.exposedMelds.length)) return [false, 0, []];
    let [fan, lines] = scoreHandPatterns(
      tiles,
      player.exposedMelds.length,
      selfDraw,
      this.rules,
      player.exposedMelds,
      player.bonusTiles,
      this.locale,
    );
    if (fan > this.rules.fanCap) lines.push(this.tr("fanCap", { cap: this.rules.fanCap }));
    fan = Math.min(fan, this.rules.fanCap);
    return [fan >= this.rules.minFan, fan, lines];
  }

  canPong(player, tile) {
    return player.hand.filter((x) => x === tile).length >= 2;
  }

  canKongFromDiscard(player, tile) {
    return player.hand.filter((x) => x === tile).length >= 3;
  }

  concealedKongOptions(player) {
    return [...new Set(player.hand)].filter((t) => player.hand.filter((x) => x === t).length === 4).sort(tileCompare);
  }

  addedKongOptions(player) {
    const pungTiles = player.exposedMelds
      .filter((m) => m.length === 3 && m[0] === m[1] && m[1] === m[2])
      .map((m) => m[0]);
    return [...new Set(pungTiles)].filter((t) => player.hand.includes(t)).sort(tileCompare);
  }

  chiOptions(player, tile) {
    if (!isSuited(tile)) return [];
    const s = tile[0];
    const n = Number(tile[1]);
    const opts = [];
    for (const [a, b] of [[n - 2, n - 1], [n - 1, n + 1], [n + 1, n + 2]]) {
      if (a >= 1 && a <= 9 && b >= 1 && b <= 9) {
        const t1 = `${s}${a}`;
        const t2 = `${s}${b}`;
        if (player.hand.includes(t1) && player.hand.includes(t2)) opts.push([t1, t2]);
      }
    }
    return opts;
  }

  chooseBotDiscard(player) {
    if (this.botDifficulty === "easy") return player.hand[Math.floor(Math.random() * player.hand.length)];
    if (this.botDifficulty === "hard") return chooseBotDiscardHard(player.hand, player.exposedMelds.length);
    return chooseBotDiscard(player.hand);
  }
  applyClaim(claimerIdx, claimType, tile, chiPair = null) {
    this.markLatestDiscardAsCalled(tile);
    const p = this.players[claimerIdx];
    if (claimType === "pong") {
      p.hand.splice(p.hand.indexOf(tile), 1);
      p.hand.splice(p.hand.indexOf(tile), 1);
      p.exposedMelds.push([tile, tile, tile]);
      p.melds.push(`${this.tr("pong")} ${tileName(tile, this.locale)}`);
      this.current = claimerIdx;
      this.needDraw = false;
      this.log(this.tr("claimedPong", { player: this.playerNameByIndex(claimerIdx), tile: tileName(tile, this.locale) }));
      this.speakDeclaration(claimerIdx, "pong", tile);
    } else if (claimType === "kong") {
      p.hand.splice(p.hand.indexOf(tile), 1);
      p.hand.splice(p.hand.indexOf(tile), 1);
      p.hand.splice(p.hand.indexOf(tile), 1);
      p.exposedMelds.push([tile, tile, tile, tile]);
      p.melds.push(`${this.tr("kong")} ${tileName(tile, this.locale)}`);
      this.current = claimerIdx;
      this.needDraw = true;
      this.log(this.tr("claimedKong", { player: this.playerNameByIndex(claimerIdx), tile: tileName(tile, this.locale) }));
      this.speakDeclaration(claimerIdx, "kong", tile);
    } else if (claimType === "chi" && chiPair) {
      const [a, b] = chiPair;
      p.hand.splice(p.hand.indexOf(a), 1);
      p.hand.splice(p.hand.indexOf(b), 1);
      p.exposedMelds.push([a, tile, b].sort(tileCompare));
      p.melds.push(`${this.tr("chi")} ${tileName(a, this.locale)}-${tileName(tile, this.locale)}-${tileName(b, this.locale)}`);
      this.current = claimerIdx;
      this.needDraw = false;
      this.log(this.tr("claimedChi", { player: this.playerNameByIndex(claimerIdx), tile: tileName(tile, this.locale) }));
      this.speakDeclaration(claimerIdx, "chi", tile);
    }
    this.pendingClaim = null;
    if (claimerIdx === 0) this.humanDrawnIndex = -1;
  }

  applyConcealedKong(playerIdx, tile) {
    const p = this.players[playerIdx];
    if (p.hand.filter((x) => x === tile).length < 4) return;
    for (let i = 0; i < 4; i += 1) p.hand.splice(p.hand.indexOf(tile), 1);
    p.exposedMelds.push([tile, tile, tile, tile]);
    p.melds.push(`${this.tr("concealedKongLabel")} ${tileName(tile, this.locale)}`);
    this.current = playerIdx;
    this.needDraw = true;
    this.log(this.tr("madeConcealedKong", { player: this.playerNameByIndex(playerIdx), tile: tileName(tile, this.locale) }));
    this.speakDeclaration(playerIdx, "concealed_kong", tile);
  }

  applyAddedKong(playerIdx, tile) {
    const p = this.players[playerIdx];
    const handIdx = p.hand.indexOf(tile);
    if (handIdx < 0) return;
    const meldIdx = p.exposedMelds.findIndex((m) => m.length === 3 && m[0] === tile && m[1] === tile && m[2] === tile);
    if (meldIdx < 0) return;
    p.hand.splice(handIdx, 1);
    p.exposedMelds[meldIdx] = [tile, tile, tile, tile];
    this.current = playerIdx;
    this.needDraw = true;
    if (playerIdx === 0) this.humanDrawnIndex = -1;
    this.log(this.tr("madeAddedKong", { player: this.playerNameByIndex(playerIdx), tile: tileName(tile, this.locale) }));
    this.speakDeclaration(playerIdx, "added_kong", tile);
  }

  maybeOpenHumanClaim(discarderIdx, tile) {
    if (discarderIdx === 0) return false;
    const human = this.players[0];
    const canRon = this.evaluateWin(human, tile, false)[0];
    const canPong = this.canPong(human, tile);
    const canKong = this.canKongFromDiscard(human, tile);
    const canChi = (discarderIdx + 1) % 4 === 0 ? this.chiOptions(human, tile) : [];
    if (!(canRon || canPong || canKong || canChi.length)) return false;
    this.pendingClaim = { tile, discarder: discarderIdx, canRon, canPong, canKong, chiOptions: canChi };
    return true;
  }

  tryRonFromDiscard(discarderIdx, tile) {
    for (let offset = 1; offset <= 3; offset += 1) {
      const idx = (discarderIdx + offset) % 4;
      if (idx === 0) continue;
      const [ok, fan, lines] = this.evaluateWin(this.players[idx], tile, false);
      if (ok) {
        this.players[idx].hand.push(tile);
        this.players[idx].hand.sort(tileCompare);
        this.speakDeclaration(idx, "ron", tile);
        this.endRound(this.tr("wonOnDiscard", { player: this.playerNameByIndex(idx), discarder: this.playerNameByIndex(discarderIdx) }), idx, discarderIdx, false, fan, lines);
        return true;
      }
    }
    return false;
  }

  tryBotClaim(discarderIdx, tile) {
    if (this.botDifficulty === "easy" && Math.random() < 0.5) return false;
    for (let offset = 1; offset <= 3; offset += 1) {
      const idx = (discarderIdx + offset) % 4;
      if (idx === 0) continue;
      if (this.canKongFromDiscard(this.players[idx], tile)) {
        this.applyClaim(idx, "kong", tile);
        return true;
      }
    }
    for (let offset = 1; offset <= 3; offset += 1) {
      const idx = (discarderIdx + offset) % 4;
      if (idx === 0) continue;
      if (this.canPong(this.players[idx], tile)) {
        if (this.botDifficulty === "hard") {
          const before = handScoreForBot(this.players[idx].hand);
          const tmp = this.players[idx].hand.slice();
          tmp.splice(tmp.indexOf(tile), 1);
          tmp.splice(tmp.indexOf(tile), 1);
          if (handScoreForBot(tmp) < before - 2) continue;
        }
        this.applyClaim(idx, "pong", tile);
        return true;
      }
    }
    const next = (discarderIdx + 1) % 4;
    if (next !== 0 && this.botDifficulty !== "easy") {
      const opts = this.chiOptions(this.players[next], tile);
      if (opts.length) {
        this.applyClaim(next, "chi", tile, opts[0]);
        return true;
      }
    }
    return false;
  }

  resolveAfterDiscard(discarderIdx, tile) {
    if (this.maybeOpenHumanClaim(discarderIdx, tile)) {
      this.render();
      return;
    }
    if (this.tryRonFromDiscard(discarderIdx, tile)) return;
    if (this.tryBotClaim(discarderIdx, tile)) {
      this.render();
      if (!this.gameOver) this.queueAction(() => this.advanceGameLoop(), 250);
      return;
    }
    this.current = (discarderIdx + 1) % 4;
    this.needDraw = true;
    this.render();
    this.queueAction(() => this.advanceGameLoop(), 180);
  }

  discardTile(playerIdx, tile) {
    const p = this.players[playerIdx];
    const i = p.hand.indexOf(tile);
    if (i < 0) return;
    p.hand.splice(i, 1);
    p.discards.push(tile);
    this.discardHistory.push([playerIdx, tile]);
    this.log(this.tr("discarded", { player: this.playerNameByIndex(playerIdx), tile: tileName(tile, this.locale) }));
    this.resolveAfterDiscard(playerIdx, tile);
  }

  humanSelfDrawWin() {
    if (this.gameOver || this.current !== 0 || this.needDraw || this.roundBooting) return;
    const [ok, fan, lines] = this.evaluateWin(this.players[0], null, true);
    if (ok) {
      this.speakDeclaration(0, "selfdraw");
      this.endRound(this.tr("declaredSelfDraw"), 0, -1, true, fan, lines);
    }
    else {
      this.log(this.tr("cannotWinYet", { minFan: this.rules.minFan }));
      this.render();
    }
  }

  humanDiscard(index) {
    if (this.gameOver || this.current !== 0 || this.needDraw || this.pendingClaim || this.roundBooting) return;
    const p = this.players[0];
    if (p.hand.length % 3 !== 2) return;
    if (!Number.isInteger(index) || index < 0 || index >= p.hand.length) return;
    const [tile] = p.hand.splice(index, 1);
    p.hand.sort(tileCompare);
    this.humanDrawnIndex = -1;
    p.discards.push(tile);
    this.discardHistory.push([0, tile]);
    this.log(this.tr("discarded", { player: this.playerNameByIndex(0), tile: tileName(tile, this.locale) }));
    this.resolveAfterDiscard(0, tile);
    this.render();
  }

  humanClaimRon() {
    if (!this.pendingClaim || !this.pendingClaim.canRon) return;
    const discarder = this.pendingClaim.discarder;
    const tile = this.pendingClaim.tile;
    this.players[0].hand.push(tile);
    this.players[0].hand.sort(tileCompare);
    const [, fan, lines] = this.evaluateWin(this.players[0], null, false);
    this.speakDeclaration(0, "ron", tile);
    this.endRound(this.tr("wonOnDiscard", { player: this.playerNameByIndex(0), discarder: this.playerNameByIndex(discarder) }), 0, discarder, false, fan, lines);
  }

  humanClaimPong() {
    if (!this.pendingClaim || !this.pendingClaim.canPong) return;
    this.applyClaim(0, "pong", this.pendingClaim.tile);
    this.render();
  }

  humanClaimKong() {
    if (!this.pendingClaim || !this.pendingClaim.canKong) return;
    this.applyClaim(0, "kong", this.pendingClaim.tile);
    this.render();
    this.queueAction(() => this.advanceGameLoop(), 120);
  }

  humanClaimChi(a, b) {
    if (!this.pendingClaim) return;
    const key = `${a},${b}`;
    const allowed = this.pendingClaim.chiOptions.map((x) => `${x[0]},${x[1]}`);
    if (!allowed.includes(key)) return;
    this.applyClaim(0, "chi", this.pendingClaim.tile, [a, b]);
    this.render();
  }

  humanConcealedKong(tile) {
    if (this.gameOver || this.current !== 0 || this.needDraw || this.pendingClaim || this.roundBooting) return;
    if (!this.concealedKongOptions(this.players[0]).includes(tile)) return;
    this.applyConcealedKong(0, tile);
    this.render();
    this.queueAction(() => this.advanceGameLoop(), 120);
  }

  humanAddedKong(tile) {
    if (this.gameOver || this.current !== 0 || this.needDraw || this.pendingClaim || this.roundBooting) return;
    if (!this.addedKongOptions(this.players[0]).includes(tile)) return;
    this.applyAddedKong(0, tile);
    this.render();
    this.queueAction(() => this.advanceGameLoop(), 120);
  }

  humanPassClaim() {
    if (!this.pendingClaim) return;
    const discarder = this.pendingClaim.discarder;
    const tile = this.pendingClaim.tile;
    this.pendingClaim = null;
    if (this.tryRonFromDiscard(discarder, tile)) return;
    if (this.tryBotClaim(discarder, tile)) {
      this.render();
      if (!this.gameOver) this.queueAction(() => this.advanceGameLoop(), 250);
      return;
    }
    this.current = (discarder + 1) % 4;
    this.needDraw = true;
    this.render();
    this.queueAction(() => this.advanceGameLoop(), 180);
  }

  botTurn() {
    if (this.gameOver || this.pendingClaim || this.roundBooting || this.current === 0) return;
    const p = this.players[this.current];
    if (this.needDraw) {
      if (!this.drawForCurrent()) return;
      this.needDraw = false;
      const [ok, fan, lines] = this.evaluateWin(p, null, true);
      if (ok) {
        this.speakDeclaration(this.current, "selfdraw");
        this.endRound(this.tr("wonBySelfDraw", { player: this.playerNameByIndex(this.current) }), this.current, -1, true, fan, lines);
        return;
      }
    }
    const kongs = this.concealedKongOptions(p);
    if (kongs.length && (this.botDifficulty !== "easy" || Math.random() < 0.4)) {
      this.applyConcealedKong(this.current, kongs[0]);
      this.render();
      this.queueAction(() => this.advanceGameLoop(), 200);
      return;
    }
    if (p.hand.length % 3 !== 2) {
      const mod = p.hand.length % 3;
      if (mod === 1) {
        if (!this.drawForCurrent()) return;
      } else if (mod === 0 && p.hand.length > 0) {
        this.discardTile(this.current, this.chooseBotDiscard(p));
        this.render();
        if (!this.gameOver) this.queueAction(() => this.advanceGameLoop(), 230);
        return;
      }
      if (p.hand.length % 3 !== 2) {
        this.current = (this.current + 1) % 4;
        this.needDraw = true;
        this.render();
        this.queueAction(() => this.advanceGameLoop(), 180);
        return;
      }
    }
    this.discardTile(this.current, this.chooseBotDiscard(p));
    this.render();
    if (!this.gameOver) this.queueAction(() => this.advanceGameLoop(), 300);
  }

  advanceGameLoop() {
    if (this.gameOver || this.pendingClaim || this.roundBooting) {
      this.render();
      return;
    }
    if (this.needDraw) {
      if (!this.drawForCurrent()) return;
      this.needDraw = false;
      const p = this.players[this.current];
      const [ok, fan, lines] = this.evaluateWin(p, null, true);
      if (ok) {
        if (p.isHuman) this.log(this.tr("canSelfDrawOrDiscard", { fan }));
        else {
          this.speakDeclaration(this.current, "selfdraw");
          this.endRound(this.tr("wonBySelfDraw", { player: this.playerNameByIndex(this.current) }), this.current, -1, true, fan, lines);
          return;
        }
      }
    }
    this.render();
    if (this.current !== 0) this.queueAction(() => this.botTurn(), 320);
  }

  endRound(msg, winnerIdx = -1, loserIdx = -1, selfDraw = false, fan = 0, lines = []) {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    this.gameOver = true;
    this.roundWinnerIdx = winnerIdx;
    this.handCounter += 1;
    this.pendingClaim = null;
    this.revealAllHands = winnerIdx >= 0 && winnerIdx !== 0;
    this.log(msg);
    this.lastScoreDelta = [0, 0, 0, 0];
    if (winnerIdx >= 0) {
      if (!fan || !lines.length) {
        const result = this.evaluateWin(this.players[winnerIdx], null, selfDraw);
        fan = result[1];
        lines = result[2];
      }
      if (fan > 0) {
        if (selfDraw) {
          for (let i = 0; i < 4; i += 1) {
            if (i === winnerIdx) continue;
            this.scores[i] -= fan;
            this.scores[winnerIdx] += fan;
            this.lastScoreDelta[i] -= fan;
            this.lastScoreDelta[winnerIdx] += fan;
          }
        } else if (loserIdx >= 0) {
          this.scores[loserIdx] -= fan;
          this.scores[winnerIdx] += fan;
          this.lastScoreDelta[loserIdx] -= fan;
          this.lastScoreDelta[winnerIdx] += fan;
        }
      }
      this.log(this.tr("result", { player: this.playerNameByIndex(winnerIdx), fan }));
      if (lines.length) this.log(this.tr("patterns", { patterns: lines.join(" | ") }));
      this.log(`${this.tr("scoreDelta")}: ${this.lastScoreDelta.map((v, i) => `${this.playerNameByIndex(i)} ${v >= 0 ? "+" : ""}${v}`).join(" | ")}`);
      this.fanHistory.push({
        hand: this.handCounter,
        winner: this.playerNameByIndex(winnerIdx),
        fan,
        patterns: lines.slice(),
      });
      this.renderCalcSummary(fan, lines);
    } else {
      this.renderCalcSummary(0, []);
      this.fanHistory.push({
        hand: this.handCounter,
        winner: this.tr("drawLabel"),
        fan: 0,
        patterns: [],
      });
    }
    this.scoreHistory.push({
      hand: this.handCounter,
      winner: winnerIdx >= 0 ? this.playerNameByIndex(winnerIdx) : this.tr("drawLabel"),
      delta: this.players.map((_, i) => ({ name: this.playerNameByIndex(i), value: this.lastScoreDelta[i] || 0 })),
      total: this.players.map((_, i) => ({ name: this.playerNameByIndex(i), value: this.scores[i] })),
    });
    this.render();
    if (winnerIdx >= 0 && this.enableCelebration) this.showCongrats(winnerIdx, fan, lines);
  }

  showCongrats(winnerIdx, fan, lines = []) {
    const winner = this.players[winnerIdx];
    const fullTiles = winner.hand.slice().sort(tileCompare);
    for (const meld of winner.exposedMelds) fullTiles.push(...meld);
    for (const bonus of winner.bonusTiles) fullTiles.push(bonus);

    this.dom.congratsText.textContent = this.tr("congrats", {
      player: this.playerNameByIndex(winnerIdx),
      fan,
    });
    this.dom.congratsTiles.innerHTML = "";
    for (const t of fullTiles) this.dom.congratsTiles.appendChild(this.createTileNode(t, "face", { small: true }));
    this.dom.congratsFans.innerHTML = "";
    const detail = lines && lines.length ? lines : [this.tr("noFanDetail")];
    for (const line of detail) {
      const li = document.createElement("li");
      li.textContent = line;
      this.dom.congratsFans.appendChild(li);
    }
    this.dom.congratsOverlay.classList.remove("hidden");
  }

  hideCongrats() {
    if (this.congratsTimer) {
      clearTimeout(this.congratsTimer);
      this.congratsTimer = null;
    }
    this.dom.congratsOverlay.classList.add("hidden");
  }

  markLatestDiscardAsCalled(tile) {
    for (let i = this.discardHistory.length - 1; i >= 0; i -= 1) {
      if (this.calledDiscardIndices.has(i)) continue;
      if (this.discardHistory[i][1] !== tile) continue;
      this.calledDiscardIndices.add(i);
      return;
    }
  }

  createTileNode(tile, mode = "face", opts = {}) {
    const node = document.createElement(opts.button ? "button" : "div");
    node.className = `tile ${mode === "back" ? "back" : ""} ${opts.small ? "small" : ""} ${opts.last ? "discard last" : ""} ${opts.called ? "discard called" : ""}`.trim();
    if (opts.button) node.classList.add("tileBtn");
    if (opts.opponent) node.classList.add("opponentTile");
    if (opts.sideRotated) node.classList.add("sideRotated");
    if (opts.rotate === "cw") node.classList.add("rot-cw");
    if (opts.rotate === "ccw") node.classList.add("rot-ccw");
    if (mode === "back") return node;
    const img = document.createElement("img");
    img.src = tileAssetPath(tile);
    img.alt = tileName(tile, this.locale);
    img.onload = () => this.scheduleBoardLayout();
    img.onerror = () => {
      img.remove();
      node.textContent = tileName(tile, this.locale);
      this.scheduleBoardLayout();
    };
    node.appendChild(img);
    return node;
  }

  createMeldStrip(meld, small = true, rotate = "", vertical = false, opponent = false, sideRotated = false) {
    const strip = document.createElement("div");
    strip.className = "meldStrip";
    if (vertical) strip.classList.add("vertical");
    for (const t of meld) strip.appendChild(this.createTileNode(t, "face", {
      small,
      rotate,
      opponent,
      sideRotated,
    }));
    return strip;
  }

  renderOpponent(container, playerIdx, side = "north") {
    const p = this.players[playerIdx];
    container.innerHTML = "";
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${this.playerNameWithWinds(playerIdx)}`;
    container.appendChild(meta);

    const rotate = side === "west" ? "cw" : side === "east" ? "ccw" : "";
    const tiles = this.revealAllHands ? p.hand.slice().sort(tileCompare) : new Array(Math.min(p.hand.length, 14)).fill("BACK");

    const recent = side === "north" ? p.exposedMelds.slice(-4) : p.exposedMelds.slice(-6);
    const opened = document.createElement("div");
    opened.className = side === "north" ? "opponentOpened" : "sideOpened";
    const sideRotated = side !== "north";
    for (const m of recent) opened.appendChild(this.createMeldStrip(m, true, rotate, sideRotated, true, sideRotated));
    for (const t of p.bonusTiles.slice(-8)) opened.appendChild(this.createTileNode(t, "face", {
      small: true,
      rotate,
      opponent: true,
      sideRotated,
    }));
    const remaining = document.createElement("div");
    if (side === "north") {
      remaining.className = "opponentClosedNorth";
    } else {
      remaining.className = "sideTileLine";
    }
    for (const t of tiles) remaining.appendChild(this.createTileNode(t, this.revealAllHands ? "face" : "back", {
      small: true,
      rotate,
      opponent: true,
      sideRotated,
    }));

    if (side === "north") {
      container.appendChild(opened);
      container.appendChild(remaining);
      return;
    }

    const sideBody = document.createElement("div");
    sideBody.className = "sideBody";
    sideBody.classList.add(side);
    if (side === "west") {
      // West: opened tiles on the right of closed tiles.
      sideBody.appendChild(remaining);
      sideBody.appendChild(opened);
    } else {
      // East: opened tiles on the left of closed tiles.
      sideBody.appendChild(opened);
      sideBody.appendChild(remaining);
    }
    container.appendChild(sideBody);
  }

  renderDiscards() {
    this.dom.discardGrid.innerHTML = "";
    const start = 0;
    const shown = this.discardHistory;
    for (let i = 0; i < shown.length; i += 1) {
      const absoluteIndex = start + i;
      this.dom.discardGrid.appendChild(this.createTileNode(shown[i][1], "face", {
        small: true,
        last: i === shown.length - 1,
        called: this.calledDiscardIndices.has(absoluteIndex),
      }));
    }
  }

  renderWall() {
    const sides = [this.dom.wallNorth, this.dom.wallEast, this.dom.wallSouth, this.dom.wallWest];
    for (const s of sides) s.innerHTML = "";
    const totalCols = Math.max(1, Math.floor(this.wallTotal / 2));
    const remainingCols = Math.max(0, Math.ceil(this.wall.length / 2));
    const drawnCols = Math.max(0, Math.floor(this.drawnTilesCount / 2));
    const drawCol = ((this.wallStartStack % totalCols) + drawnCols) % totalCols;
    const perSide = Math.max(1, Math.floor(totalCols / 4));
    const isActive = (idx) => {
      if (remainingCols <= 0) return false;
      const end = (drawCol + remainingCols - 1) % totalCols;
      if (drawCol <= end) return idx >= drawCol && idx <= end;
      return idx >= drawCol || idx <= end;
    };
    for (let idx = 0; idx < totalCols; idx += 1) {
      const col = document.createElement("div");
      col.className = "wallCol";
      for (let r = 0; r < 2; r += 1) {
        const d = document.createElement("div");
        d.className = "wallStack";
        if (isActive(idx)) d.classList.add("active");
        if (idx === drawCol && isActive(idx) && r === 0) d.classList.add("pointer");
        col.appendChild(d);
      }
      if (idx < perSide) this.dom.wallNorth.appendChild(col);
      else if (idx < 2 * perSide) this.dom.wallEast.appendChild(col);
      else if (idx < 3 * perSide) this.dom.wallSouth.prepend(col);
      else this.dom.wallWest.prepend(col);
    }
  }

  renderClaimBar() {
    const bar = this.dom.claimBar;
    bar.innerHTML = "";
    if (this.gameOver) {
      return;
    }
    if (!this.pendingClaim) {
      if (this.current === 0 && !this.needDraw && this.players[0].hand.length % 3 === 2) {
        const concealed = this.concealedKongOptions(this.players[0]);
        for (const tile of concealed) {
          const b = document.createElement("button");
          b.textContent = `${this.tr("concealedKongLabel")} ${tileName(tile, this.locale)}`;
          b.addEventListener("click", () => this.humanConcealedKong(tile));
          bar.appendChild(b);
        }
        const added = this.addedKongOptions(this.players[0]);
        for (const tile of added) {
          const b = document.createElement("button");
          b.textContent = `${this.tr("addedKongLabel")} ${tileName(tile, this.locale)}`;
          b.addEventListener("click", () => this.humanAddedKong(tile));
          bar.appendChild(b);
        }
      }
      return;
    }

    const info = this.pendingClaim;

    if (info.canRon) {
      const b = document.createElement("button");
      b.textContent = this.tr("ron");
      b.addEventListener("click", () => this.humanClaimRon());
      bar.appendChild(b);
    }
    if (info.canKong) {
      const b = document.createElement("button");
      b.textContent = this.tr("kong");
      b.addEventListener("click", () => this.humanClaimKong());
      bar.appendChild(b);
    }
    if (info.canPong) {
      const b = document.createElement("button");
      b.textContent = this.tr("pong");
      b.addEventListener("click", () => this.humanClaimPong());
      bar.appendChild(b);
    }
    for (const [a, b] of info.chiOptions) {
      const btn = document.createElement("button");
      const sequence = [a, info.tile, b].sort(tileCompare);
      btn.textContent = `${this.tr("chi")} ${sequence.map((t) => tileName(t, this.locale)).join("-")}`;
      btn.addEventListener("click", () => this.humanClaimChi(a, b));
      bar.appendChild(btn);
    }
    const pass = document.createElement("button");
    pass.textContent = this.tr("pass");
    pass.addEventListener("click", () => this.humanPassClaim());
    bar.appendChild(pass);
  }

  renderHand() {
    const you = this.players[0];
    if (this.humanDrawnIndex < 0) you.hand.sort(tileCompare);
    this.dom.handRow.innerHTML = "";
    const canDiscard = !this.gameOver && this.current === 0 && !this.needDraw && !this.pendingClaim && !this.roundBooting && you.hand.length % 3 === 2;
    for (let i = 0; i < you.hand.length; i += 1) {
      const tile = you.hand[i];
      const node = this.createTileNode(tile, "face", { button: canDiscard });
      if (i === this.humanDrawnIndex && canDiscard) node.classList.add("drawnTile");
      if (canDiscard) node.addEventListener("click", () => this.humanDiscard(i));
      this.dom.handRow.appendChild(node);
    }

    this.dom.youMeta.textContent = `${this.playerNameWithWinds(0)}`;
    this.dom.bonusRow.innerHTML = "";

    this.dom.youMelds.innerHTML = "";
    const hasOpened = you.exposedMelds.length > 0 || you.bonusTiles.length > 0;
    if (hasOpened) {
      for (const meld of you.exposedMelds) this.dom.youMelds.appendChild(this.createMeldStrip(meld, true));
      for (const t of you.bonusTiles) this.dom.youMelds.appendChild(this.createTileNode(t, "face", { small: true }));
    }

    const [canWin, fan] = this.evaluateWin(you, null, true);
    this.dom.selfDrawBtn.disabled = !(canDiscard && canWin);
    this.dom.selfDrawBtn.style.display = canDiscard && canWin ? "inline-flex" : "none";
    this.dom.selfDrawBtn.textContent = canWin
      ? `${this.locale === "zh-HK" ? "可宣告 " : "Declare "}${this.tr("selfDrawWin")} (${fan}${this.locale === "zh-HK" ? "番" : " fan"})`
      : this.tr("selfDrawWin");
    if (this.dom.nextMatchBtn) {
      const showNext = this.gameOver && this.roundWinnerIdx >= 0;
      this.dom.nextMatchBtn.classList.toggle("hidden", !showNext);
    }

    if (this.roundBooting) this.dom.hintLine.textContent = this.tr("rollingDice");
    else if (this.gameOver) this.dom.hintLine.textContent = this.tr("roundOverPress");
    else if (this.pendingClaim) this.dom.hintLine.textContent = this.tr("claimOn", { tile: tileName(this.pendingClaim.tile, this.locale) });
    else if (this.current !== 0) this.dom.hintLine.textContent = this.tr("botsActing");
    else if (canWin && !this.needDraw) this.dom.hintLine.textContent = this.tr("canWinOrDiscard", { fan });
    else if (canDiscard) this.dom.hintLine.textContent = this.tr("clickDiscard");
    else this.dom.hintLine.textContent = this.tr("waiting");
  }

  renderScores() {
    this.dom.scoreList.innerHTML = "";
    for (let i = 0; i < 4; i += 1) {
      const li = document.createElement("li");
      const delta = this.lastScoreDelta[i];
      const deltaTxt = delta ? ` (${delta > 0 ? "+" : ""}${delta})` : "";
      li.textContent = `${this.playerNameWithWinds(i)}: ${this.scores[i] >= 0 ? "+" : ""}${this.scores[i]}${deltaTxt}`;
      this.dom.scoreList.appendChild(li);
    }
  }

  renderFanHistory() {
    if (!this.dom.fanHistoryBody) return;
    this.dom.fanHistoryBody.innerHTML = "";
    for (const row of this.fanHistory.slice(-40).reverse()) {
      const tr = document.createElement("tr");
      const patterns = row.patterns && row.patterns.length ? row.patterns.join(" | ") : this.tr("none");
      tr.innerHTML = `<td>${row.hand}</td><td>${row.winner}</td><td>${row.fan}</td><td>${patterns}</td>`;
      this.dom.fanHistoryBody.appendChild(tr);
    }
  }

  renderScoreHistory() {
    if (!this.dom.scoreHistoryBody) return;
    this.dom.scoreHistoryBody.innerHTML = "";
    for (const row of this.scoreHistory.slice(-40).reverse()) {
      const tr = document.createElement("tr");
      const delta = row.delta.map((x) => `${x.name} ${x.value >= 0 ? "+" : ""}${x.value}`).join(" | ");
      const total = row.total.map((x) => `${x.name} ${x.value >= 0 ? "+" : ""}${x.value}`).join(" | ");
      tr.innerHTML = `<td>${row.hand}</td><td>${row.winner}</td><td>${delta}</td><td>${total}</td>`;
      this.dom.scoreHistoryBody.appendChild(tr);
    }
  }

  render() {
    this.updateStaticText();
    this.dom.langSelect.value = this.locale;
    this.dom.homeLangSelect.value = this.locale;
    const turn = this.gameOver ? this.tr("roundOver") : this.tr("turn", { player: this.playerNameByIndex(this.current) });
    this.dom.statusLine.textContent = `${turn} | ${this.tr("difficulty", { difficulty: this.difficultyLabel() })} | ${this.roundWindLabel(this.roundWindTile())}`;
    this.dom.wallInfo.textContent = this.tr("wallRemaining", {
      count: this.wall.length,
      total: this.wallTotal,
      breakPos: this.wallStartStack + 1,
    });

    this.renderWallDice();
    this.renderWall();
    this.renderOpponent(this.dom.northPanel, 3, "north");
    this.renderOpponent(this.dom.westPanel, 2, "west");
    this.renderOpponent(this.dom.eastPanel, 1, "east");
    this.renderDiscards();
    this.renderClaimBar();
    this.renderHand();
    this.renderScores();
    this.renderFanHistory();
    this.renderScoreHistory();
    this.scheduleBoardLayout();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const game = new MahjongWebGame();
  game.init();
});

