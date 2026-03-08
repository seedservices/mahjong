from __future__ import annotations

import json
import math
import random
import struct
import wave
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Tuple

from kivy.config import Config

Config.set("graphics", "resizable", "1")
Config.set("graphics", "minimum_width", "1100")
Config.set("graphics", "minimum_height", "760")
Config.set("graphics", "width", "1280")
Config.set("graphics", "height", "860")

from kivy.app import App
from kivy.animation import Animation
from kivy.clock import Clock
from kivy.core.audio import SoundLoader
from kivy.core.window import Window
from kivy.graphics import Color, Line, PopMatrix, PushMatrix, Rectangle, Rotate, RoundedRectangle
from kivy.lang import Builder
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.checkbox import CheckBox
from kivy.uix.floatlayout import FloatLayout
from kivy.uix.gridlayout import GridLayout
from kivy.uix.image import Image
from kivy.uix.label import Label
from kivy.uix.scrollview import ScrollView
from kivy.uix.spinner import Spinner
from kivy.uix.textinput import TextInput
from kivy.uix.widget import Widget

def resolve_cjk_font() -> str:
    local_dir = Path("assets/fonts")
    local_candidates = [
        Path("assets/fonts/LXGWWenKaiMonoTC-Regular.ttf"),
        Path("assets/fonts/LXGWWenKaiMonoTC-Bold.ttf"),
        Path("assets/fonts/LXGWWenKaiMonoTC-Light.ttf"),
    ]
    if local_dir.exists():
        local_candidates.extend(sorted(local_dir.glob("LXGWWenKaiMonoTC*.ttf")))
        local_candidates.extend(sorted(local_dir.glob("LXGWWenKaiMonoTC*.otf")))
    candidates = [
        *local_candidates,
        Path("C:/Windows/Fonts/msjh.ttc"),
        Path("C:/Windows/Fonts/msjhbd.ttc"),
        Path("C:/Windows/Fonts/mingliu.ttc"),
        Path("/System/Library/Fonts/PingFang.ttc"),
        Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    return ""


UI_FONT = resolve_cjk_font()
if UI_FONT:
    f = UI_FONT.replace("\\", "\\\\")
    Builder.load_string(
        f"""
<Label>:
    font_name: "{f}"
    font_size: "24sp"
<Button>:
    font_name: "{f}"
    font_size: "24sp"
<TextInput>:
    font_name: "{f}"
    font_size: "22sp"
"""
    )
else:
    Builder.load_string(
        """
<Label>:
    font_size: "24sp"
<Button>:
    font_size: "24sp"
<TextInput>:
    font_size: "22sp"
"""
    )


SUITS = {"D": "筒", "B": "索", "C": "萬"}
WINDS = ["E", "S", "W", "N"]
DRAGONS = ["R", "G", "H"]
FLOWERS = ["F1", "F2", "F3", "F4"]
SEASONS = ["T1", "T2", "T3", "T4"]
BONUS_TILES = FLOWERS + SEASONS
BASE_TILES: List[str] = [f"{s}{n}" for s in ("D", "B", "C") for n in range(1, 10)] + WINDS + DRAGONS
ALL_TILES: List[str] = BASE_TILES
WIND_NAME = {"E": "東", "S": "南", "W": "西", "N": "北"}
DRAGON_NAME = {"R": "中", "G": "發", "H": "白"}
OWNER_NAME = {0: "你", 1: "南家", 2: "西家", 3: "北家"}
TILE_ASSET_DIR = Path("assets/tiles")
SFX_ASSET_DIR = Path("assets/sfx")
MENU_LOGO_PATH = Path("assets/logo_menu.png")
RULE_PROFILES_PATH = Path("rule_profiles.json")
DEFAULT_HOUSE_RULES = {
    "name": "香港常用(3番起糊)",
    "min_fan": 3,
    "fan_cap": 10,
    "self_draw_bonus": True,
    "concealed_bonus": True,
}
BOT_DIFFICULTY = ("初階", "中階", "進階")


def build_wall_tiles() -> List[str]:
    return BASE_TILES * 4 + BONUS_TILES.copy()


def tile_image_path(tile: str) -> str:
    p = TILE_ASSET_DIR / f"{tile}.png"
    if p.exists():
        return str(p)
    return ""


def back_image_path() -> str:
    p = TILE_ASSET_DIR / "BACK.png"
    if p.exists():
        return str(p)
    return ""


def tile_name(tile: str) -> str:
    if tile[0] in SUITS:
        return f"{tile[1]}{SUITS[tile[0]]}"
    if tile in FLOWERS:
        flower = {"F1": "梅", "F2": "蘭", "F3": "菊", "F4": "竹"}
        return f"花{flower[tile]}"
    if tile in SEASONS:
        season = {"T1": "春", "T2": "夏", "T3": "秋", "T4": "冬"}
        return f"季{season[tile]}"
    if tile in WIND_NAME:
        return WIND_NAME[tile]
    return DRAGON_NAME[tile]


def tile_key(tile: str) -> Tuple[int, int]:
    if tile[0] == "D":
        return 0, int(tile[1])
    if tile[0] == "B":
        return 1, int(tile[1])
    if tile[0] == "C":
        return 2, int(tile[1])
    if tile in WINDS:
        return 3, WINDS.index(tile)
    if tile in DRAGONS:
        return 4, DRAGONS.index(tile)
    if tile in FLOWERS:
        return 5, FLOWERS.index(tile)
    if tile in SEASONS:
        return 6, SEASONS.index(tile)
    return 9, 0


def to_counts(hand: List[str]) -> Dict[str, int]:
    c = {t: 0 for t in ALL_TILES}
    for t in hand:
        c[t] += 1
    return c


def is_suited(tile: str) -> bool:
    return tile[0] in SUITS


def tile_num(tile: str) -> int:
    return int(tile[1]) if is_suited(tile) else -1


def counts_tuple(counts: Dict[str, int]) -> Tuple[int, ...]:
    return tuple(counts[t] for t in ALL_TILES)


@lru_cache(maxsize=None)
def can_form_melds(state: Tuple[int, ...]) -> bool:
    arr = list(state)
    first = -1
    for i, v in enumerate(arr):
        if v > 0:
            first = i
            break
    if first == -1:
        return True
    tile = ALL_TILES[first]
    if arr[first] >= 3:
        arr[first] -= 3
        if can_form_melds(tuple(arr)):
            return True
        arr[first] += 3
    if is_suited(tile):
        suit = tile[0]
        n = tile_num(tile)
        if n <= 7:
            t2 = f"{suit}{n+1}"
            t3 = f"{suit}{n+2}"
            i2 = ALL_TILES.index(t2)
            i3 = ALL_TILES.index(t3)
            if arr[i2] > 0 and arr[i3] > 0:
                arr[first] -= 1
                arr[i2] -= 1
                arr[i3] -= 1
                if can_form_melds(tuple(arr)):
                    return True
    return False


@lru_cache(maxsize=None)
def can_form_n_melds(state: Tuple[int, ...], n_melds: int) -> bool:
    if n_melds == 0:
        return sum(state) == 0
    arr = list(state)
    first = -1
    for i, v in enumerate(arr):
        if v > 0:
            first = i
            break
    if first == -1:
        return False
    tile = ALL_TILES[first]
    if arr[first] >= 3:
        arr[first] -= 3
        if can_form_n_melds(tuple(arr), n_melds - 1):
            return True
        arr[first] += 3
    if is_suited(tile):
        suit = tile[0]
        n = tile_num(tile)
        if n <= 7:
            t2 = f"{suit}{n+1}"
            t3 = f"{suit}{n+2}"
            i2 = ALL_TILES.index(t2)
            i3 = ALL_TILES.index(t3)
            if arr[i2] > 0 and arr[i3] > 0:
                arr[first] -= 1
                arr[i2] -= 1
                arr[i3] -= 1
                if can_form_n_melds(tuple(arr), n_melds - 1):
                    return True
    return False


def is_standard_win(hand: List[str]) -> bool:
    if len(hand) != 14:
        return False
    counts = to_counts(hand)
    for t in ALL_TILES:
        if counts[t] >= 2:
            work = counts.copy()
            work[t] -= 2
            if can_form_melds(counts_tuple(work)):
                return True
    return False


def is_seven_pairs(hand: List[str]) -> bool:
    if len(hand) != 14:
        return False
    c = to_counts(hand)
    pair_count = 0
    for v in c.values():
        if v == 2:
            pair_count += 1
        elif v == 4:
            pair_count += 2
        elif v != 0:
            return False
    return pair_count == 7


def is_thirteen_orphans(hand: List[str]) -> bool:
    if len(hand) != 14:
        return False
    c = to_counts(hand)
    req = {"D1", "D9", "B1", "B9", "C1", "C9", "E", "S", "W", "N", "R", "G", "H"}
    pair = False
    for t in ALL_TILES:
        v = c[t]
        if t in req:
            if v == 0:
                return False
            if v >= 2:
                if pair:
                    return False
                pair = True
            if v > 2:
                return False
        elif v != 0:
            return False
    return pair


def is_win(hand: List[str]) -> bool:
    return is_standard_win(hand) or is_seven_pairs(hand) or is_thirteen_orphans(hand)


def is_win_with_open_melds(hand: List[str], open_meld_count: int) -> bool:
    required_melds = 4 - open_meld_count
    if required_melds < 0:
        return False
    expected_len = 2 + 3 * required_melds
    if len(hand) != expected_len:
        return False
    if open_meld_count == 0 and (is_seven_pairs(hand) or is_thirteen_orphans(hand)):
        return True
    counts = to_counts(hand)
    for t in ALL_TILES:
        if counts[t] >= 2:
            work = counts.copy()
            work[t] -= 2
            if can_form_n_melds(counts_tuple(work), required_melds):
                return True
    return False


def hand_score_for_bot(hand: List[str]) -> int:
    c = to_counts(hand)
    score = 0
    for t, v in c.items():
        if v >= 2:
            score += 4
        if v >= 3:
            score += 6
        if is_suited(t) and v > 0:
            s = t[0]
            n = int(t[1])
            if n <= 8 and c.get(f"{s}{n+1}", 0) > 0:
                score += 2
            if n <= 7 and c.get(f"{s}{n+2}", 0) > 0:
                score += 1
        if (t in WINDS or t in DRAGONS) and v == 1:
            score -= 1
    return score


def choose_bot_discard(hand: List[str]) -> str:
    candidates = sorted(set(hand), key=tile_key)
    best_tile = candidates[0]
    best_score = -10**9
    for tile in candidates:
        tmp = hand.copy()
        tmp.remove(tile)
        s = hand_score_for_bot(tmp)
        if s > best_score:
            best_score = s
            best_tile = tile
    return best_tile


def choose_bot_discard_hard(hand: List[str], open_meld_count: int) -> str:
    candidates = sorted(set(hand), key=tile_key)
    best_tile = candidates[0]
    best_eval = -10**9
    for tile in candidates:
        tmp = hand.copy()
        tmp.remove(tile)
        waits = 0
        counts = to_counts(tmp)
        for draw in ALL_TILES:
            live = 4 - counts.get(draw, 0)
            if live <= 0:
                continue
            if is_win_with_open_melds(tmp + [draw], open_meld_count):
                waits += live
        eval_score = hand_score_for_bot(tmp) + waits * 6
        if waits > 0:
            eval_score += 14
        if eval_score > best_eval:
            best_eval = eval_score
            best_tile = tile
    return best_tile


def is_all_pungs(hand: List[str]) -> bool:
    if len(hand) != 14:
        return False
    counts = to_counts(hand)
    for pair_tile in ALL_TILES:
        if counts[pair_tile] < 2:
            continue
        work = counts.copy()
        work[pair_tile] -= 2
        if all((v % 3) == 0 for v in work.values()):
            return True
    return False


def _is_chow_meld(meld: List[str]) -> bool:
    if len(meld) != 3:
        return False
    seq = sorted(meld, key=tile_key)
    if not (is_suited(seq[0]) and seq[0][0] == seq[1][0] == seq[2][0]):
        return False
    nums = [tile_num(x) for x in seq]
    return nums[1] == nums[0] + 1 and nums[2] == nums[1] + 1


def _is_pung_like_meld(meld: List[str]) -> bool:
    if len(meld) == 3:
        return meld[0] == meld[1] == meld[2]
    if len(meld) == 4:
        return meld[0] == meld[1] == meld[2] == meld[3]
    return False


def _search_meld_partition(counts: Dict[str, int], n_melds: int, acc: List[List[str]]) -> List[List[str]] | None:
    if n_melds == 0:
        if all(v == 0 for v in counts.values()):
            return [m[:] for m in acc]
        return None
    first = None
    for t in ALL_TILES:
        if counts[t] > 0:
            first = t
            break
    if first is None:
        return None
    if counts[first] >= 3:
        counts[first] -= 3
        acc.append([first, first, first])
        found = _search_meld_partition(counts, n_melds - 1, acc)
        if found:
            return found
        acc.pop()
        counts[first] += 3
    if is_suited(first):
        s = first[0]
        n = tile_num(first)
        if n <= 7:
            t2 = f"{s}{n+1}"
            t3 = f"{s}{n+2}"
            if counts[t2] > 0 and counts[t3] > 0:
                counts[first] -= 1
                counts[t2] -= 1
                counts[t3] -= 1
                acc.append([first, t2, t3])
                found = _search_meld_partition(counts, n_melds - 1, acc)
                if found:
                    return found
                acc.pop()
                counts[first] += 1
                counts[t2] += 1
                counts[t3] += 1
    return None


def find_standard_partition(hand: List[str], n_melds: int) -> Tuple[str, List[List[str]]] | None:
    counts = to_counts(hand)
    for pair in ALL_TILES:
        if counts[pair] < 2:
            continue
        work = counts.copy()
        work[pair] -= 2
        melds = _search_meld_partition(work, n_melds, [])
        if melds is not None:
            return pair, melds
    return None


def classify_suit_type(hand: List[str]) -> str:
    suits = {t[0] for t in hand if t and t[0] in SUITS}
    honors = any(t in WINDS or t in DRAGONS for t in hand)
    if not suits and honors:
        return "all_honors"
    if len(suits) == 1 and honors:
        return "mixed_one_suit"
    if len(suits) == 1 and not honors:
        return "pure_one_suit"
    return "mixed"


@lru_cache(maxsize=None)
def can_form_chows_only(state: Tuple[int, ...]) -> bool:
    arr = list(state)
    first = -1
    for i, v in enumerate(arr):
        if v > 0:
            first = i
            break
    if first == -1:
        return True
    tile = ALL_TILES[first]
    if not is_suited(tile):
        return False
    suit = tile[0]
    n = tile_num(tile)
    if n > 7:
        return False
    t2 = f"{suit}{n+1}"
    t3 = f"{suit}{n+2}"
    i2 = ALL_TILES.index(t2)
    i3 = ALL_TILES.index(t3)
    if arr[i2] == 0 or arr[i3] == 0:
        return False
    arr[first] -= 1
    arr[i2] -= 1
    arr[i3] -= 1
    return can_form_chows_only(tuple(arr))


def count_soeng_melds(all_melds: List[List[str]]) -> int:
    return sum(1 for meld in all_melds if _is_chow_meld(meld))


def score_hand_patterns(
    hand: List[str],
    exposed_count: int,
    self_draw: bool,
    rules: Dict | None = None,
    exposed_melds: List[List[str]] | None = None,
    bonus_tiles: List[str] | None = None,
) -> Tuple[int, List[str]]:
    rules = rules or DEFAULT_HOUSE_RULES
    exposed_melds = exposed_melds or []
    bonus_tiles = bonus_tiles or []
    patterns: List[Tuple[str, int]] = [("食糊", 1)]
    closed = exposed_count == 0
    if self_draw and rules.get("self_draw_bonus", True):
        patterns.append(("自摸", 1))
    if closed and rules.get("concealed_bonus", True):
        patterns.append(("門前清", 1))

    all_tiles = hand[:]
    for m in exposed_melds:
        all_tiles.extend(m)
    partition = find_standard_partition(hand, max(0, 4 - exposed_count))

    if closed and is_thirteen_orphans(hand):
        patterns.append(("十三么", 13))
    elif closed and is_seven_pairs(hand):
        patterns.append(("七對子", 4))
    else:
        all_melds: List[List[str]] = []
        if partition:
            all_melds.extend(partition[1])
        all_melds.extend([m[:] for m in exposed_melds])
        if all_melds and all(_is_pung_like_meld(m) for m in all_melds):
            patterns.append(("對對糊", 3))
        soeng = count_soeng_melds(all_melds)
        if soeng > 0:
            patterns.append((f"上 x{soeng}", soeng))

    suit_type = classify_suit_type(all_tiles)
    if suit_type == "all_honors":
        patterns.append(("字一色", 13))
    elif suit_type == "pure_one_suit":
        patterns.append(("清一色", 7))
    elif suit_type == "mixed_one_suit":
        patterns.append(("混一色", 3))

    flower_pts = len([t for t in bonus_tiles if t in FLOWERS])
    season_pts = len([t for t in bonus_tiles if t in SEASONS])
    if flower_pts:
        patterns.append((f"花牌 x{flower_pts}", flower_pts))
    if season_pts:
        patterns.append((f"季節牌 x{season_pts}", season_pts))

    total = sum(v for _, v in patterns)
    lines = [f"{name} +{pts}番" for name, pts in patterns]
    return total, lines


def _to_int(val, default: int) -> int:
    try:
        return int(str(val).strip())
    except (TypeError, ValueError):
        return default


def load_rule_profiles() -> Dict[str, Dict]:
    profiles = {
        DEFAULT_HOUSE_RULES["name"]: {
            "min_fan": str(DEFAULT_HOUSE_RULES["min_fan"]),
            "cap": str(DEFAULT_HOUSE_RULES["fan_cap"]),
            "self_draw": DEFAULT_HOUSE_RULES["self_draw_bonus"],
            "concealed": DEFAULT_HOUSE_RULES["concealed_bonus"],
        }
    }
    if not RULE_PROFILES_PATH.exists():
        return profiles
    try:
        raw = json.loads(RULE_PROFILES_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return profiles
    if isinstance(raw, dict):
        for k, v in raw.items():
            if isinstance(v, dict):
                profiles[k] = v
    return profiles


def _write_pcm_wav(path: Path, samples: List[int], sample_rate: int = 22050):
    path.parent.mkdir(parents=True, exist_ok=True)
    frames = bytearray()
    for s in samples:
        frames.extend(struct.pack("<h", max(-32767, min(32767, int(s)))))
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(bytes(frames))


def ensure_sfx_assets():
    def _clack(duration_ms: int, hardness: float = 1.0) -> List[int]:
        sr = 22050
        count = int(sr * duration_ms / 1000.0)
        out: List[int] = []
        lp = 0.0
        for i in range(count):
            t = i / sr
            env = math.exp(-(12.0 + 3.0 * hardness) * t)
            white = (random.random() * 2 - 1) * (9800 + 1200 * hardness) * env
            lp = 0.70 * lp + 0.30 * white
            transient = (white - lp) * (1.0 + 0.35 * hardness)
            out.append(int(transient))
        return out

    def _roll(duration_ms: int) -> List[int]:
        sr = 22050
        count = int(sr * duration_ms / 1000.0)
        out: List[int] = []
        lp = 0.0
        for i in range(count):
            t = i / sr
            env = max(0.0, 1.0 - t / (duration_ms / 1000.0))
            white = (random.random() * 2 - 1) * 9000 * env
            lp = 0.92 * lp + 0.08 * white
            out.append(int(lp))
        return out

    def _concat(parts: List[List[int]]) -> List[int]:
        sep = [0] * 200
        out: List[int] = []
        for p in parts:
            out.extend(p)
            out.extend(sep)
        return out

    SFX_ASSET_DIR.mkdir(parents=True, exist_ok=True)
    bank = {
        "draw.wav": _clack(52, hardness=0.7),
        "discard.wav": _clack(80, hardness=1.4),
        "claim.wav": _concat([_clack(84, hardness=1.35), _clack(82, hardness=1.25)]),
        "win.wav": _concat([_clack(85, hardness=1.2), _clack(90, hardness=1.4), _clack(95, hardness=1.6)]),
        "toggle.wav": _clack(46, hardness=0.5),
        "flower.wav": _concat([_clack(58, hardness=0.8), _clack(62, hardness=0.9)]),
        "call_pung.wav": _concat([_clack(95, hardness=1.4), _clack(95, hardness=1.35), _clack(120, hardness=1.6)]),
        "call_kong.wav": _concat([_clack(100, hardness=1.6), _clack(110, hardness=1.7), _clack(130, hardness=1.9)]),
        "dice.wav": _concat([_roll(190), _clack(88, hardness=1.1)]),
    }
    for name, pcm in bank.items():
        p = SFX_ASSET_DIR / name
        _write_pcm_wav(p, pcm)


class FeltBoard(Widget):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        with self.canvas.before:
            Color(0.07, 0.35, 0.18, 1)
            self.bg = RoundedRectangle(pos=self.pos, size=self.size, radius=[20])
            Color(0.75, 0.65, 0.3, 1)
            self.border = Line(rounded_rectangle=(self.x, self.y, self.width, self.height, 20), width=2.2)
        self.bind(pos=self._update, size=self._update)

    def _update(self, *_):
        self.bg.pos = self.pos
        self.bg.size = self.size
        self.border.rounded_rectangle = (self.x, self.y, self.width, self.height, 20)


class OverlayPanel(BoxLayout):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        with self.canvas.before:
            Color(0.08, 0.08, 0.08, 0.95)
            self.bg = RoundedRectangle(pos=self.pos, size=self.size, radius=[14])
            Color(0.85, 0.74, 0.42, 1)
            self.outline = Line(rounded_rectangle=(self.x, self.y, self.width, self.height, 14), width=1.8)
        self.bind(pos=self._update, size=self._update)

    def _update(self, *_):
        self.bg.pos = self.pos
        self.bg.size = self.size
        self.outline.rounded_rectangle = (self.x, self.y, self.width, self.height, 14)


class TileButton(Button):
    def __init__(self, text_value: str, mode: str = "face", highlight: bool = False, tile_id: str = "", **kwargs):
        super().__init__(**kwargs)
        self.mode = mode
        self.highlight = highlight
        self.tile_id = tile_id
        self.background_normal = ""
        self.background_down = ""
        self.text = text_value
        self.bold = True
        self.color = (0.12, 0.12, 0.12, 1)
        self.font_size = "28sp" if mode == "face" else "20sp"
        self._hl_line = None
        self._paint()
        self.bind(pos=self._update_highlight, size=self._update_highlight)

    def _paint(self):
        source = ""
        if self.mode == "back":
            source = back_image_path()
            self.text = "" if source else "背"
        else:
            source = tile_image_path(self.tile_id) if self.tile_id else ""
            if source:
                self.text = ""
            elif self.mode == "discard":
                self.font_size = "16sp"
        if source:
            self.background_normal = source
            self.background_down = source
            self.background_disabled_normal = source
            self.background_disabled_down = source
            self.background_color = (1, 1, 1, 1)
        else:
            if self.mode == "back":
                self.background_color = (0.92, 0.76, 0.32, 1)
                self.color = (0.3, 0.2, 0.05, 1)
            else:
                self.background_color = (0.98, 0.96, 0.89, 1)

        if self.highlight:
            with self.canvas.after:
                Color(0.95, 0.2, 0.15, 1)
                self._hl_line = Line(width=2)
            self._update_highlight()

    def _update_highlight(self, *_):
        if self._hl_line is not None:
            self._hl_line.rectangle = (self.x + 1, self.y + 1, max(0, self.width - 2), max(0, self.height - 2))


class StaticTile(Widget):
    def __init__(self, tile_id: str, tile_w: int, tile_h: int, angle: float = 0.0, **kwargs):
        super().__init__(**kwargs)
        self.tile_id = tile_id
        self.tile_w = tile_w
        self.tile_h = tile_h
        self.angle = angle
        src = tile_image_path(tile_id)
        self._source = src
        self.size_hint = (None, None)
        box = max(tile_w, tile_h) + 4
        self.size = (box, box)
        with self.canvas:
            PushMatrix()
            self._rot = Rotate(angle=self.angle, origin=self.center)
            if src:
                self._rect = Rectangle(source=src, pos=self.pos, size=(self.tile_w, self.tile_h))
            else:
                Color(0.98, 0.96, 0.89, 1)
                self._rect = Rectangle(pos=self.pos, size=(self.tile_w, self.tile_h))
            PopMatrix()
        self.bind(pos=self._update_graphics, size=self._update_graphics)
        self._update_graphics()

    def _update_graphics(self, *_):
        cx, cy = self.center
        self._rot.origin = (cx, cy)
        self._rot.angle = self.angle
        self._rect.size = (self.tile_w, self.tile_h)
        self._rect.pos = (cx - self.tile_w / 2, cy - self.tile_h / 2)


@dataclass
class Player:
    name: str
    is_human: bool
    hand: List[str] = field(default_factory=list)
    discards: List[str] = field(default_factory=list)
    melds: List[str] = field(default_factory=list)
    exposed_melds: List[List[str]] = field(default_factory=list)
    bonus_tiles: List[str] = field(default_factory=list)


class MahjongGameUI(BoxLayout):
    def __init__(self, **kwargs):
        super().__init__(orientation="vertical", spacing=8, padding=8, **kwargs)
        self.players = [
            Player("你", True),
            Player("電腦-南", False),
            Player("電腦-西", False),
            Player("電腦-北", False),
        ]
        self.rule_profiles = load_rule_profiles()
        self.house_rules = DEFAULT_HOUSE_RULES.copy()
        if self.house_rules["name"] in self.rule_profiles:
            self._apply_profile(self.house_rules["name"])
        self.bot_difficulty = "中階"
        self.scores: List[int] = [0, 0, 0, 0]
        self.rules_panel: OverlayPanel | None = None
        self.summary_panel: OverlayPanel | None = None
        self.sound_enabled = True
        ensure_sfx_assets()
        self.sfx_bank: Dict[str, object] = {}
        self.wall: List[str] = []
        self.current = 0
        self.need_draw = True
        self.game_over = False
        self.last_discard = ""
        self.last_discard_owner = -1
        self.pending_claim: Dict = {}
        self.discard_history: List[Tuple[int, str]] = []
        self.recent_draw_tile: str | None = None
        self.last_animated_discard_count = 0
        self.reveal_all_hands = False
        self.wall_total = len(build_wall_tiles())
        self.drawn_tiles_count = 0
        self.round_dice = (1, 1, 1)
        self.wall_start_stack = 0
        self.deal_queue: List[int] = []
        self.is_dealing_initial = False
        self.is_rolling_dice = False
        self.last_draw_anim_marker: Tuple[int, int] | None = None
        self.deal_token = 0
        self.dice_anim_token = 0
        self.target_dice = (1, 1, 1)
        self.logs: List[str] = []

        self.header = Label(text="", size_hint_y=None, height=40, font_size="18sp")
        self.add_widget(self.header)

        top_actions = BoxLayout(orientation="horizontal", size_hint_y=None, height=54, spacing=6, padding=(2, 0, 2, 0))
        self.new_round_btn = Button(text="新開一局", size_hint_x=0.2)
        self.hu_btn = Button(text="宣告食糊", size_hint_x=0.16)
        self.difficulty_spinner = Spinner(text=self.bot_difficulty, values=BOT_DIFFICULTY, size_hint_x=0.18)
        self.rules_btn = Button(text="房規設定", size_hint_x=0.14)
        self.sound_btn = Button(text="音效: 開", size_hint_x=0.14)
        self.home_btn = Button(text="主畫面", size_hint_x=0.12)
        self.new_round_btn.bind(on_press=lambda *_: self.start_round())
        self.hu_btn.bind(on_press=lambda *_: self.human_self_draw_win())
        self.rules_btn.bind(on_press=lambda *_: self.open_rules_editor())
        self.difficulty_spinner.bind(text=self.on_bot_difficulty_changed)
        self.sound_btn.bind(on_press=lambda *_: self.toggle_sound())
        self.home_btn.bind(on_press=lambda *_: App.get_running_app().show_home_screen())
        top_actions.add_widget(self.new_round_btn)
        top_actions.add_widget(self.hu_btn)
        top_actions.add_widget(Label(text="電腦難度", size_hint_x=0.12, font_size="16sp"))
        top_actions.add_widget(self.difficulty_spinner)
        top_actions.add_widget(self.rules_btn)
        top_actions.add_widget(self.sound_btn)
        top_actions.add_widget(self.home_btn)
        self.add_widget(top_actions)

        self.main_split = BoxLayout(orientation="horizontal", spacing=8, size_hint=(1, 1))
        self.left_col = BoxLayout(orientation="vertical", spacing=6, size_hint=(0.8, 1))
        self.log_box = TextInput(readonly=True, size_hint=(0.2, 1), font_size="15sp")
        self.main_split.add_widget(self.left_col)
        self.main_split.add_widget(self.log_box)
        self.add_widget(self.main_split)

        self.table = FeltBoard(size_hint=(1, 1))
        table_wrap = BoxLayout()
        table_wrap.add_widget(self.table)
        self.left_col.add_widget(table_wrap)

        self.table_content = BoxLayout(orientation="vertical", spacing=5, padding=8)
        self.table.add_widget(self.table_content)
        self.overlay_layer = FloatLayout(size_hint=(1, 1))
        self.table.add_widget(self.overlay_layer)
        self.table.bind(size=lambda *_: self._sync_table_content(), pos=lambda *_: self._sync_table_content())
        Window.bind(on_resize=lambda *_: self._sync_table_content())
        self._sync_table_content()

        self.north_back_row = BoxLayout(orientation="horizontal", size_hint_y=None, height=46, spacing=3)
        self.table_content.add_widget(self.north_back_row)
        self.north_meld_row = BoxLayout(orientation="horizontal", size_hint_y=None, height=46, spacing=3)
        self.table_content.add_widget(self.north_meld_row)

        self.north_info = Label(text="", size_hint_y=None, height=34, font_size="15sp")
        self.table_content.add_widget(self.north_info)

        mid = BoxLayout(orientation="horizontal", spacing=8)
        self.west_box = BoxLayout(orientation="vertical", size_hint_x=0.21, spacing=3)
        self.west_info = Label(text="", size_hint_y=None, height=60, font_size="15sp")
        self.west_melds = BoxLayout(orientation="vertical", spacing=2, size_hint_y=None, height=110)
        self.west_backs = GridLayout(cols=1, spacing=2, size_hint=(1, 1))
        self.west_box.add_widget(self.west_info)
        self.west_box.add_widget(self.west_melds)
        self.west_box.add_widget(self.west_backs)

        self.center_zone = FloatLayout(size_hint=(0.58, 1))
        self.wall_info = Label(text="牌牆", size_hint=(0.9, None), height=24, pos_hint={"center_x": 0.5, "top": 1.0}, font_size="15sp")
        self.wall_north = BoxLayout(orientation="horizontal", spacing=1, size_hint=(0.86, None), height=26, pos_hint={"center_x": 0.5, "top": 0.93})
        self.wall_south = BoxLayout(orientation="horizontal", spacing=1, size_hint=(0.86, None), height=26, pos_hint={"center_x": 0.5, "y": 0.07})
        self.wall_west = BoxLayout(orientation="vertical", spacing=1, size_hint=(None, 0.7), width=26, pos_hint={"x": 0.05, "center_y": 0.5})
        self.wall_east = BoxLayout(orientation="vertical", spacing=1, size_hint=(None, 0.7), width=26, pos_hint={"right": 0.95, "center_y": 0.5})
        self.center_discards = GridLayout(cols=10, spacing=2, size_hint=(0.66, 0.56), pos_hint={"center_x": 0.5, "center_y": 0.5})
        self.center_zone.add_widget(self.wall_info)
        self.center_zone.add_widget(self.wall_north)
        self.center_zone.add_widget(self.wall_south)
        self.center_zone.add_widget(self.wall_west)
        self.center_zone.add_widget(self.wall_east)
        self.center_zone.add_widget(self.center_discards)
        self.east_box = BoxLayout(orientation="vertical", size_hint_x=0.21, spacing=3)
        self.east_info = Label(text="", size_hint_y=None, height=60, font_size="15sp")
        self.east_melds = BoxLayout(orientation="vertical", spacing=2, size_hint_y=None, height=110)
        self.east_backs = GridLayout(cols=1, spacing=2, size_hint=(1, 1))
        self.east_box.add_widget(self.east_info)
        self.east_box.add_widget(self.east_melds)
        self.east_box.add_widget(self.east_backs)

        mid.add_widget(self.west_box)
        mid.add_widget(self.center_zone)
        mid.add_widget(self.east_box)
        self.table_content.add_widget(mid)

        self.south_info = Label(text="", size_hint_y=None, height=38, font_size="16sp")
        self.table_content.add_widget(self.south_info)
        self.south_bonus_row = BoxLayout(orientation="horizontal", size_hint_y=None, height=46, spacing=2)
        self.table_content.add_widget(self.south_bonus_row)
        self.south_meld_row = BoxLayout(orientation="horizontal", size_hint_y=None, height=46, spacing=3)
        self.table_content.add_widget(self.south_meld_row)

        self.claim_bar = BoxLayout(orientation="horizontal", size_hint_y=None, height=56, spacing=6)
        self.left_col.add_widget(self.claim_bar)

        self.human_hint = Label(text="", size_hint_y=None, height=40, font_size="16sp")
        self.left_col.add_widget(self.human_hint)

        hand_wrap = ScrollView(size_hint=(1, 0.31))
        self.hand_area = BoxLayout(orientation="horizontal", spacing=8, size_hint_y=None, height=176, padding=(4, 6, 4, 6))
        self.hand_grid = GridLayout(cols=14, spacing=6, size_hint=(None, 1), width=920)
        self.draw_slot = BoxLayout(orientation="vertical", size_hint=(None, 1), width=106)
        self.hand_area.add_widget(self.hand_grid)
        self.hand_area.add_widget(self.draw_slot)
        hand_wrap.add_widget(self.hand_area)
        self.left_col.add_widget(hand_wrap)

        for lb in (self.north_info, self.west_info, self.east_info, self.south_info, self.human_hint):
            lb.halign = "left"
            lb.valign = "middle"
            lb.bind(size=lambda inst, *_: setattr(inst, "text_size", inst.size))
        self.header.halign = "center"
        self.header.valign = "middle"
        self.header.bind(size=lambda inst, *_: setattr(inst, "text_size", inst.size))

        self.start_round()

    def _sync_table_content(self):
        self.table_content.size = self.table.size
        self.table_content.pos = self.table.pos
        if hasattr(self, "overlay_layer"):
            self.overlay_layer.size = self.table.size
            self.overlay_layer.pos = self.table.pos

    def log(self, msg: str):
        self.logs.append(msg)
        self.logs = self.logs[-160:]
        self.log_box.text = "\n".join(self.logs)
        self.log_box.cursor = (0, len(self.log_box.text))

    def _apply_profile(self, profile_name: str):
        profile = self.rule_profiles.get(profile_name, {})
        self.house_rules["name"] = profile_name
        self.house_rules["min_fan"] = max(1, _to_int(profile.get("min_fan"), DEFAULT_HOUSE_RULES["min_fan"]))
        self.house_rules["fan_cap"] = max(self.house_rules["min_fan"], _to_int(profile.get("cap"), DEFAULT_HOUSE_RULES["fan_cap"]))
        self.house_rules["self_draw_bonus"] = bool(profile.get("self_draw", True))
        self.house_rules["concealed_bonus"] = bool(profile.get("concealed", True))

    def on_bot_difficulty_changed(self, *_):
        self.bot_difficulty = self.difficulty_spinner.text
        self.log(f"電腦難度切換為 {self.bot_difficulty}。")

    def toggle_sound(self):
        self.sound_enabled = not self.sound_enabled
        self.sound_btn.text = "音效: 開" if self.sound_enabled else "音效: 關"
        self.play_sfx("toggle")

    def play_sfx(self, event: str):
        if not self.sound_enabled:
            return
        mapping = {
            "draw": "draw.wav",
            "discard": "discard.wav",
            "claim": "claim.wav",
            "win": "win.wav",
            "toggle": "toggle.wav",
            "flower": "flower.wav",
            "call_pung": "call_pung.wav",
            "call_kong": "call_kong.wav",
            "dice": "dice.wav",
        }
        name = mapping.get(event)
        if not name:
            return
        if event not in self.sfx_bank:
            self.sfx_bank[event] = SoundLoader.load(str(SFX_ASSET_DIR / name))
        snd = self.sfx_bank.get(event)
        if snd is None:
            return
        snd.stop()
        snd.play()

    def play_callout(self, kind: str):
        self.play_sfx("call_pung" if kind == "碰" else "call_kong")

    def dismiss_overlay_panels(self):
        if self.rules_panel is not None:
            self.overlay_layer.remove_widget(self.rules_panel)
            self.rules_panel = None
        if self.summary_panel is not None:
            self.overlay_layer.remove_widget(self.summary_panel)
            self.summary_panel = None

    def open_rules_editor(self):
        self.dismiss_overlay_panels()
        panel = OverlayPanel(
            orientation="vertical",
            spacing=8,
            padding=12,
            size_hint=(None, None),
            size=(620, 420),
            pos_hint={"center_x": 0.5, "center_y": 0.5},
        )
        panel.add_widget(Label(text="房規設定", size_hint_y=None, height=34))

        self.rules_profile_spinner = Spinner(
            text=self.house_rules["name"],
            values=tuple(self.rule_profiles.keys()),
            size_hint_y=None,
            height=44,
        )
        panel.add_widget(self.rules_profile_spinner)

        row_min = BoxLayout(size_hint_y=None, height=44, spacing=8)
        row_min.add_widget(Label(text="最低番數", size_hint_x=0.3, font_size="18sp"))
        self.min_fan_input = TextInput(text=str(self.house_rules["min_fan"]), multiline=False, size_hint_x=0.7, input_filter="int")
        row_min.add_widget(self.min_fan_input)
        panel.add_widget(row_min)

        row_cap = BoxLayout(size_hint_y=None, height=44, spacing=8)
        row_cap.add_widget(Label(text="封頂番數", size_hint_x=0.3, font_size="18sp"))
        self.cap_input = TextInput(text=str(self.house_rules["fan_cap"]), multiline=False, size_hint_x=0.7, input_filter="int")
        row_cap.add_widget(self.cap_input)
        panel.add_widget(row_cap)

        row_sd = BoxLayout(size_hint_y=None, height=40, spacing=8)
        row_sd.add_widget(Label(text="自摸加番", size_hint_x=0.8, font_size="18sp"))
        self.self_draw_cb = CheckBox(active=bool(self.house_rules["self_draw_bonus"]), size_hint_x=0.2)
        row_sd.add_widget(self.self_draw_cb)
        panel.add_widget(row_sd)

        row_closed = BoxLayout(size_hint_y=None, height=40, spacing=8)
        row_closed.add_widget(Label(text="門前清加番", size_hint_x=0.8, font_size="18sp"))
        self.closed_cb = CheckBox(active=bool(self.house_rules["concealed_bonus"]), size_hint_x=0.2)
        row_closed.add_widget(self.closed_cb)
        panel.add_widget(row_closed)

        btn_row = BoxLayout(size_hint_y=None, height=48, spacing=8)
        apply_btn = Button(text="套用")
        close_btn = Button(text="關閉")
        apply_btn.bind(on_press=lambda *_: self.apply_rules_from_editor())
        close_btn.bind(on_press=lambda *_: self.dismiss_overlay_panels())
        btn_row.add_widget(apply_btn)
        btn_row.add_widget(close_btn)
        panel.add_widget(btn_row)

        self.rules_profile_spinner.bind(text=lambda _, v: self.load_profile_into_editor(v))
        self.rules_panel = panel
        self.overlay_layer.add_widget(panel)

    def load_profile_into_editor(self, profile_name: str):
        profile = self.rule_profiles.get(profile_name)
        if not profile:
            return
        self.min_fan_input.text = str(_to_int(profile.get("min_fan"), self.house_rules["min_fan"]))
        self.cap_input.text = str(_to_int(profile.get("cap"), self.house_rules["fan_cap"]))
        self.self_draw_cb.active = bool(profile.get("self_draw", True))
        self.closed_cb.active = bool(profile.get("concealed", True))

    def apply_rules_from_editor(self):
        name = self.rules_profile_spinner.text or self.house_rules["name"]
        min_fan = max(1, _to_int(self.min_fan_input.text, self.house_rules["min_fan"]))
        fan_cap = max(min_fan, _to_int(self.cap_input.text, self.house_rules["fan_cap"]))
        self.house_rules["name"] = name
        self.house_rules["min_fan"] = min_fan
        self.house_rules["fan_cap"] = fan_cap
        self.house_rules["self_draw_bonus"] = bool(self.self_draw_cb.active)
        self.house_rules["concealed_bonus"] = bool(self.closed_cb.active)
        self.rule_profiles[name] = {
            "min_fan": str(min_fan),
            "cap": str(fan_cap),
            "self_draw": self.house_rules["self_draw_bonus"],
            "concealed": self.house_rules["concealed_bonus"],
        }
        try:
            RULE_PROFILES_PATH.write_text(json.dumps(self.rule_profiles, ensure_ascii=False, indent=2), encoding="utf-8")
        except OSError:
            self.log("房規已套用，但無法寫入 rule_profiles.json。")
        self.log(
            f"已套用房規：{name}，最低{min_fan}番，封頂{fan_cap}番，"
            f"自摸加番={'開' if self.house_rules['self_draw_bonus'] else '關'}，"
            f"門前清加番={'開' if self.house_rules['concealed_bonus'] else '關'}。"
        )
        self.dismiss_overlay_panels()
        self.refresh_hand_buttons()

    def evaluate_win(self, player: Player, extra_tile: str | None = None, self_draw: bool = False) -> Tuple[bool, int, List[str]]:
        tiles = player.hand.copy()
        if extra_tile is not None:
            tiles.append(extra_tile)
        if not is_win_with_open_melds(tiles, len(player.exposed_melds)):
            return False, 0, []
        fan, lines = score_hand_patterns(
            tiles,
            len(player.exposed_melds),
            self_draw,
            rules=self.house_rules,
            exposed_melds=player.exposed_melds,
            bonus_tiles=player.bonus_tiles,
        )
        if fan > self.house_rules["fan_cap"]:
            lines.append(f"封頂 {self.house_rules['fan_cap']} 番")
        fan = min(fan, self.house_rules["fan_cap"])
        return fan >= self.house_rules["min_fan"], fan, lines

    def show_round_summary(self, winner_idx: int, loser_idx: int, fan: int, lines: List[str], self_draw: bool):
        self.dismiss_overlay_panels()
        panel = OverlayPanel(
            orientation="vertical",
            spacing=8,
            padding=12,
            size_hint=(None, None),
            size=(680, 500),
            pos_hint={"center_x": 0.5, "center_y": 0.5},
        )
        mode = "自摸" if self_draw else "食糊"
        panel.add_widget(Label(text=f"本局結算：{self.players[winner_idx].name} {mode}", size_hint_y=None, height=36))
        panel.add_widget(Label(text=f"番數 {fan}（房規：{self.house_rules['name']}）", size_hint_y=None, height=30, font_size="18sp"))

        pattern_list = ScrollView(size_hint=(1, 0.42))
        pattern_box = BoxLayout(orientation="vertical", spacing=4, size_hint_y=None, padding=(2, 2, 2, 2))
        pattern_box.bind(minimum_height=pattern_box.setter("height"))
        for ln in lines:
            pattern_box.add_widget(Label(text=ln, size_hint_y=None, height=28, font_size="17sp"))
        pattern_list.add_widget(pattern_box)
        panel.add_widget(pattern_list)

        board = GridLayout(cols=2, size_hint_y=None, height=34 * len(self.players), spacing=4)
        for idx, p in enumerate(self.players):
            board.add_widget(Label(text=p.name, font_size="17sp"))
            board.add_widget(Label(text=f"{self.scores[idx]:+d}", font_size="17sp"))
        panel.add_widget(board)

        btn_row = BoxLayout(size_hint_y=None, height=48, spacing=8)
        next_btn = Button(text="下一局")
        close_btn = Button(text="關閉")
        next_btn.bind(on_press=lambda *_: self.start_round())
        close_btn.bind(on_press=lambda *_: self.dismiss_overlay_panels())
        btn_row.add_widget(next_btn)
        btn_row.add_widget(close_btn)
        panel.add_widget(btn_row)
        self.summary_panel = panel
        self.overlay_layer.add_widget(panel)

    def render_wall_visual(self):
        self.wall_north.clear_widgets()
        self.wall_south.clear_widgets()
        self.wall_west.clear_widgets()
        self.wall_east.clear_widgets()
        total_stacks = max(1, self.wall_total // 4)
        remaining_stacks = max(0, (len(self.wall) + 3) // 4)
        draw_stack = max(0, min(total_stacks - 1, self.drawn_tiles_count // 4))
        q = max(1, total_stacks // 4)

        def is_active(idx: int) -> bool:
            if remaining_stacks <= 0:
                return False
            end = (draw_stack + remaining_stacks - 1) % total_stacks
            if draw_stack <= end:
                return draw_stack <= idx <= end
            return idx >= draw_stack or idx <= end

        for idx in range(total_stacks):
            active = is_active(idx)
            b = TileButton(text_value="", mode="back", size_hint=(None, None), width=18, height=24, disabled=True)
            if not active:
                b.opacity = 0.18
            if idx == draw_stack and active:
                b.highlight = True
                b._paint()
            if idx < q:
                self.wall_north.add_widget(b)
            elif idx < 2 * q:
                self.wall_east.add_widget(b)
            elif idx < 3 * q:
                self.wall_south.add_widget(b)
            else:
                self.wall_west.add_widget(b)
        d1, d2, d3 = self.round_dice
        state = "擲骰中" if self.is_rolling_dice else "抓牌中"
        self.wall_info.text = f"牌牆 {len(self.wall)}/{self.wall_total} | 擲骰 {d1}+{d2}+{d3}={d1+d2+d3} | 開門位 {self.wall_start_stack + 1} | {state}"

    def _note_draw_animation(self, player_idx: int):
        self.last_draw_anim_marker = (player_idx, len(self.players[player_idx].hand))

    def _draw_tile_into_player(self, player_idx: int) -> bool:
        if not self.wall:
            self.end_round("流局：牌牆已空。")
            return False
        p = self.players[player_idx]
        while True:
            if not self.wall:
                self.end_round("流局：牌牆已空。")
                return False
            tile = self.wall.pop(0)
            self.drawn_tiles_count += 1
            if tile in BONUS_TILES:
                p.bonus_tiles.append(tile)
                self.log(f"{p.name} 補花：{tile_name(tile)}。")
                self.play_sfx("flower")
                continue
            p.hand.append(tile)
            p.hand.sort(key=tile_key)
            self._note_draw_animation(player_idx)
            if player_idx == 0:
                self.recent_draw_tile = tile
            return True

    def _deal_initial_step(self, token: int, *_):
        if token != self.deal_token:
            return
        if not self.deal_queue:
            self.is_dealing_initial = False
            self.log(
                f"新一局開始。你是東家。房規={self.house_rules['name']} "
                f"(最低{self.house_rules['min_fan']}番/封頂{self.house_rules['fan_cap']}番) "
                f"電腦難度={self.bot_difficulty}"
            )
            self.advance_game_loop()
            return
        idx = self.deal_queue.pop(0)
        if not self._draw_tile_into_player(idx):
            return
        self.play_sfx("draw")
        self.refresh_hand_buttons()
        Clock.schedule_once(lambda *_: self._deal_initial_step(token), 0.05)

    def _animate_dice_step(self, token: int, frames_left: int, *_):
        if token != self.dice_anim_token:
            return
        if frames_left <= 0:
            self.is_rolling_dice = False
            self.round_dice = self.target_dice
            d1, d2, d3 = self.round_dice
            self.wall_start_stack = (d1 + d2 + d3) % max(1, len(self.wall) // 4)
            cut = (self.wall_start_stack * 4) % len(self.wall)
            self.wall = self.wall[cut:] + self.wall[:cut]
            self.log(f"擲骰 {d1}+{d2}+{d3}={d1+d2+d3}，由第 {self.wall_start_stack + 1} 墩開門抓牌。")
            self.log("發牌中...")
            self.refresh_hand_buttons()
            self.deal_token += 1
            dt = self.deal_token
            Clock.schedule_once(lambda *_: self._deal_initial_step(dt), 0.02)
            return
        self.round_dice = (random.randint(1, 6), random.randint(1, 6), random.randint(1, 6))
        if frames_left % 3 == 0:
            self.play_sfx("dice")
        self.refresh_hand_buttons()
        Clock.schedule_once(lambda *_: self._animate_dice_step(token, frames_left - 1), 0.05)

    def start_round(self):
        self.dismiss_overlay_panels()
        self.wall = build_wall_tiles()
        random.shuffle(self.wall)
        self.target_dice = (random.randint(1, 6), random.randint(1, 6), random.randint(1, 6))
        self.round_dice = (1, 1, 1)
        self.wall_start_stack = 0
        for p in self.players:
            p.hand.clear()
            p.discards.clear()
            p.melds.clear()
            p.exposed_melds.clear()
            p.bonus_tiles.clear()
        self.game_over = False
        self.current = 0
        self.need_draw = True
        self.last_discard = ""
        self.last_discard_owner = -1
        self.pending_claim = {}
        self.discard_history = []
        self.recent_draw_tile = None
        self.last_animated_discard_count = 0
        self.reveal_all_hands = False
        self.last_draw_anim_marker = None
        self.drawn_tiles_count = 0
        self.logs = []
        self.deal_queue = [i for _ in range(13) for i in range(4)]
        self.is_dealing_initial = True
        self.is_rolling_dice = True
        self.dice_anim_token += 1
        token = self.dice_anim_token
        self.log("擲骰中...")
        self.refresh_hand_buttons()
        Clock.schedule_once(lambda *_: self._animate_dice_step(token, 18), 0.03)

    def draw_for_current(self) -> bool:
        p = self.players[self.current]
        if not self._draw_tile_into_player(self.current):
            return False
        self.log(f"{p.name} 摸牌。")
        self.play_sfx("draw")
        return True

    @staticmethod
    def can_pong(player: Player, tile: str) -> bool:
        return player.hand.count(tile) >= 2

    @staticmethod
    def can_kong_from_discard(player: Player, tile: str) -> bool:
        return player.hand.count(tile) >= 3

    @staticmethod
    def concealed_gong_options(player: Player) -> List[str]:
        return sorted([t for t in set(player.hand) if player.hand.count(t) == 4], key=tile_key)

    @staticmethod
    def chi_options(player: Player, tile: str) -> List[Tuple[str, str]]:
        if tile[0] not in SUITS:
            return []
        s = tile[0]
        n = int(tile[1])
        opts: List[Tuple[str, str]] = []
        for a, b in ((n - 2, n - 1), (n - 1, n + 1), (n + 1, n + 2)):
            if 1 <= a <= 9 and 1 <= b <= 9:
                t1 = f"{s}{a}"
                t2 = f"{s}{b}"
                if player.hand.count(t1) and player.hand.count(t2):
                    opts.append((t1, t2))
        return list(dict.fromkeys(opts))

    def has_pending_claim(self) -> bool:
        return bool(self.pending_claim)

    def player_can_win(self, player: Player, extra_tile: str | None = None, self_draw: bool = False) -> bool:
        ok, _, _ = self.evaluate_win(player, extra_tile=extra_tile, self_draw=self_draw)
        return ok

    def render_center_discards(self):
        self.center_discards.clear_widgets()
        show = self.discard_history[-84:]
        cols = max(10, int(max(self.center_discards.width, 1) // 70))
        self.center_discards.cols = cols
        tile_w, tile_h = 62, 84
        total = len(self.discard_history)
        show_start = max(0, total - len(show))
        pending_idx = self.pending_claim.get("discard_index") if self.pending_claim else None
        highlight_idx = (pending_idx - show_start) if isinstance(pending_idx, int) and show_start <= pending_idx < total else (len(show) - 1)
        should_animate_last = total != self.last_animated_discard_count
        for idx, (owner, tile) in enumerate(show):
            is_last = idx == highlight_idx
            t = TileButton(
                text_value="",
                mode="discard",
                highlight=is_last,
                tile_id=tile,
                size_hint=(None, None),
                width=tile_w,
                height=tile_h,
                disabled=True,
            )
            if not tile_image_path(tile):
                t.text = tile_name(tile)
            if idx == len(show) - 1 and should_animate_last:
                t.opacity = 0
                Animation(opacity=1, d=0.18).start(t)
            self.center_discards.add_widget(t)
        self.last_animated_discard_count = total

    def render_opponent_backs(self):
        self.north_back_row.clear_widgets()
        self.west_backs.clear_widgets()
        self.east_backs.clear_widgets()

        north_count = len(self.players[3].hand)
        west_count = len(self.players[2].hand)
        east_count = len(self.players[1].hand)

        if self.reveal_all_hands:
            north_tiles = sorted(self.players[3].hand, key=tile_key)
            west_tiles = sorted(self.players[2].hand, key=tile_key)
            east_tiles = sorted(self.players[1].hand, key=tile_key)
            for idx, tile in enumerate(north_tiles):
                t = StaticTile(tile_id=tile, tile_w=41, tile_h=56, angle=0.0)
                if self.last_draw_anim_marker == (3, len(north_tiles)) and idx == len(north_tiles) - 1:
                    t.opacity = 0
                    Animation(opacity=1, d=0.16).start(t)
                self.north_back_row.add_widget(t)
            for idx, tile in enumerate(west_tiles):
                t = StaticTile(tile_id=tile, tile_w=33, tile_h=44, angle=90.0)
                if self.last_draw_anim_marker == (2, len(west_tiles)) and idx == len(west_tiles) - 1:
                    t.opacity = 0
                    Animation(opacity=1, d=0.16).start(t)
                self.west_backs.add_widget(t)
            for idx, tile in enumerate(east_tiles):
                t = StaticTile(tile_id=tile, tile_w=33, tile_h=44, angle=-90.0)
                if self.last_draw_anim_marker == (1, len(east_tiles)) and idx == len(east_tiles) - 1:
                    t.opacity = 0
                    Animation(opacity=1, d=0.16).start(t)
                self.east_backs.add_widget(t)
        else:
            for idx in range(min(north_count, 14)):
                b = TileButton(
                    text_value="",
                    mode="back",
                    size_hint=(None, None),
                    width=37,
                    height=50,
                    disabled=True,
                )
                if self.last_draw_anim_marker == (3, north_count) and idx == min(north_count, 14) - 1:
                    b.opacity = 0
                    Animation(opacity=1, d=0.16).start(b)
                self.north_back_row.add_widget(b)
            for idx in range(min(west_count, 14)):
                b = TileButton(
                    text_value="",
                    mode="back",
                    size_hint=(None, None),
                    width=25,
                    height=34,
                    disabled=True,
                )
                if self.last_draw_anim_marker == (2, west_count) and idx == min(west_count, 14) - 1:
                    b.opacity = 0
                    Animation(opacity=1, d=0.16).start(b)
                self.west_backs.add_widget(b)
            for idx in range(min(east_count, 14)):
                b = TileButton(
                    text_value="",
                    mode="back",
                    size_hint=(None, None),
                    width=25,
                    height=34,
                    disabled=True,
                )
                if self.last_draw_anim_marker == (1, east_count) and idx == min(east_count, 14) - 1:
                    b.opacity = 0
                    Animation(opacity=1, d=0.16).start(b)
                self.east_backs.add_widget(b)

    def _add_meld_strip(self, container: BoxLayout, meld_tiles: List[str], tile_w: int, tile_h: int, angle: float = 0.0):
        strip = BoxLayout(
            orientation="horizontal",
            size_hint=(None, None),
            width=(max(tile_w, tile_h) + 4) * len(meld_tiles),
            height=max(tile_w, tile_h) + 4,
            spacing=2,
        )
        for tile in meld_tiles:
            t = StaticTile(tile_id=tile, tile_w=tile_w, tile_h=tile_h, angle=angle)
            strip.add_widget(t)
        container.add_widget(strip)

    def render_exposed_melds(self):
        self.north_meld_row.clear_widgets()
        self.south_meld_row.clear_widgets()
        self.west_melds.clear_widgets()
        self.east_melds.clear_widgets()

        for meld in self.players[3].exposed_melds[-4:]:
            self._add_meld_strip(self.north_meld_row, meld, 39, 52, 0.0)
        for meld in self.players[0].exposed_melds[-4:]:
            self._add_meld_strip(self.south_meld_row, meld, 39, 52, 0.0)
        for meld in self.players[2].exposed_melds[-4:]:
            self._add_meld_strip(self.west_melds, meld, 33, 44, 90.0)
        for meld in self.players[1].exposed_melds[-4:]:
            self._add_meld_strip(self.east_melds, meld, 33, 44, -90.0)

    def render_bonus_tiles(self):
        self.south_bonus_row.clear_widgets()
        bonus = self.players[0].bonus_tiles[-10:]
        if not bonus:
            self.south_bonus_row.add_widget(Label(text="花季牌：無", font_size="16sp"))
            return
        self.south_bonus_row.add_widget(Label(text="花季牌：", size_hint_x=None, width=92, font_size="16sp"))
        for tile in bonus:
            b = TileButton(
                text_value="",
                mode="face",
                tile_id=tile,
                size_hint=(None, None),
                width=30,
                height=40,
                disabled=True,
            )
            if not tile_image_path(tile):
                b.text = tile_name(tile)
            self.south_bonus_row.add_widget(b)

    def render_claim_bar(self):
        self.claim_bar.clear_widgets()
        if self.is_rolling_dice:
            self.claim_bar.add_widget(Label(text="擲骰動畫中..."))
            return
        if self.is_dealing_initial:
            self.claim_bar.add_widget(Label(text="發牌中..."))
            return
        if not self.pending_claim:
            self.claim_bar.add_widget(Label(text="中間會顯示棄牌，紅框為最新一張。"))
            if (
                not self.game_over
                and self.current == 0
                and not self.need_draw
                and len(self.players[0].hand) % 3 == 2
                and not self.is_dealing_initial
            ):
                kongs = self.concealed_gong_options(self.players[0])
                for tile in kongs:
                    b = Button(text=f"暗槓 {tile_name(tile)}", size_hint_x=0.2)
                    b.bind(on_press=lambda _, t=tile: self.human_concealed_gong(t))
                    self.claim_bar.add_widget(b)
            return
        info = self.pending_claim
        tile = info["tile"]
        self.claim_bar.add_widget(Label(text=f"可宣告：{tile_name(tile)}", size_hint_x=0.2))
        if info.get("can_ron"):
            b = Button(text="食糊", size_hint_x=0.1)
            b.bind(on_press=lambda *_: self.human_claim_ron())
            self.claim_bar.add_widget(b)
        if info.get("can_kong"):
            b = Button(text="槓", size_hint_x=0.11)
            b.bind(on_press=lambda *_: self.human_claim_kong())
            self.claim_bar.add_widget(b)
        if info.get("can_pong"):
            b = Button(text="碰", size_hint_x=0.08)
            b.bind(on_press=lambda *_: self.human_claim_pong())
            self.claim_bar.add_widget(b)
        for t1, t2 in info.get("chi_options", []):
            b = Button(text=f"吃 {tile_name(t1)}-{tile_name(tile)}-{tile_name(t2)}", size_hint_x=0.2)
            b.bind(on_press=lambda _, a=t1, b_=t2: self.human_claim_chi(a, b_))
            self.claim_bar.add_widget(b)
        skip = Button(text="跳過", size_hint_x=0.1)
        skip.bind(on_press=lambda *_: self.human_pass_claim())
        self.claim_bar.add_widget(skip)

    def update_status(self):
        if self.is_dealing_initial:
            turn = "發牌動畫中"
        else:
            turn = "已結束" if self.game_over else f"目前輪到：{self.players[self.current].name}"
        score_text = " | ".join([f"{self.players[i].name}:{self.scores[i]:+d}" for i in range(4)])
        self.header.text = f"牌牆剩餘：{len(self.wall)} 張 | {turn} | {score_text}"

        south_meld = "、".join(self.players[0].melds[-4:]) if self.players[0].melds else "無副露"
        north_meld = "、".join(self.players[3].melds[-4:]) if self.players[3].melds else "無副露"
        west_meld = "、".join(self.players[2].melds[-4:]) if self.players[2].melds else "無副露"
        east_meld = "、".join(self.players[1].melds[-4:]) if self.players[1].melds else "無副露"

        self.north_info.text = f"北家 手牌:{len(self.players[3].hand)} 花季:{len(self.players[3].bonus_tiles)} | {north_meld}"
        self.west_info.text = f"西家 手牌:{len(self.players[2].hand)} 花季:{len(self.players[2].bonus_tiles)}\n{west_meld}"
        self.east_info.text = f"南家 手牌:{len(self.players[1].hand)} 花季:{len(self.players[1].bonus_tiles)}\n{east_meld}"
        my_bonus = "、".join(tile_name(t) for t in self.players[0].bonus_tiles[-6:]) if self.players[0].bonus_tiles else "無"
        self.south_info.text = f"你 手牌:{len(self.players[0].hand)} 花季:{len(self.players[0].bonus_tiles)}({my_bonus})  {south_meld}"

    def refresh_hand_buttons(self):
        self.hand_grid.clear_widgets()
        self.draw_slot.clear_widgets()
        human = self.players[0]
        human.hand.sort(key=tile_key)
        can_discard = (not self.game_over) and (not self.is_dealing_initial) and (not self.is_rolling_dice) and self.current == 0 and (len(human.hand) % 3 == 2) and not self.has_pending_claim()
        can_hu, fan, _ = self.evaluate_win(human, self_draw=True)
        self.hu_btn.disabled = not (can_discard and (not self.need_draw) and can_hu)
        if not self.hu_btn.disabled:
            self.hu_btn.text = f"宣告食糊({fan}番)"
        else:
            self.hu_btn.text = "宣告食糊"
        if self.game_over:
            self.human_hint.text = "本局已結束，按「新開一局」重新開始。"
        elif self.is_rolling_dice:
            self.human_hint.text = "擲骰中，請稍候..."
        elif self.has_pending_claim():
            self.human_hint.text = "你可宣告吃/碰/槓/食糊，或跳過。"
        elif self.current != 0:
            self.human_hint.text = "電腦行動中..."
        elif len(human.hand) % 3 == 2:
            if can_hu and not self.need_draw:
                self.human_hint.text = f"你可宣告食糊（{fan}番），或選擇打牌。"
            else:
                self.human_hint.text = "點擊手牌打出（右側為剛摸到的牌）。"
        else:
            self.human_hint.text = "等待流程..."

        main_tiles = human.hand.copy()
        draw_tile = None
        if can_discard and self.recent_draw_tile and self.recent_draw_tile in main_tiles:
            main_tiles.remove(self.recent_draw_tile)
            draw_tile = self.recent_draw_tile

        self.hand_grid.cols = max(1, len(main_tiles))
        self.hand_grid.width = max(980, len(main_tiles) * 82)
        for idx, tile in enumerate(main_tiles):
            b = TileButton(
                text_value="",
                mode="face",
                tile_id=tile,
                size_hint=(None, None),
                width=86,
                height=116,
                disabled=not can_discard,
            )
            if not tile_image_path(tile):
                b.text = tile_name(tile)
            if self.last_draw_anim_marker == (0, len(human.hand)) and not draw_tile and idx == len(main_tiles) - 1:
                b.opacity = 0
                Animation(opacity=1, d=0.2).start(b)
            b.bind(on_press=lambda _, t=tile: self.human_discard(t))
            self.hand_grid.add_widget(b)

        if draw_tile:
            self.draw_slot.add_widget(Label(text="摸牌", size_hint_y=None, height=30))
            b = TileButton(
                text_value="",
                mode="face",
                highlight=True,
                tile_id=draw_tile,
                size_hint=(None, None),
                width=92,
                height=124,
                disabled=not can_discard,
            )
            if not tile_image_path(draw_tile):
                b.text = tile_name(draw_tile)
            if self.last_draw_anim_marker == (0, len(human.hand)):
                b.opacity = 0
                Animation(opacity=1, d=0.22).start(b)
            b.bind(on_press=lambda _, t=draw_tile: self.human_discard(t))
            self.draw_slot.add_widget(b)
        else:
            self.draw_slot.add_widget(Label(text=""))

        self.render_center_discards()
        self.render_wall_visual()
        self.render_opponent_backs()
        self.render_exposed_melds()
        self.render_bonus_tiles()
        self.render_claim_bar()
        self.update_status()
        self.last_draw_anim_marker = None

    def end_round(self, msg: str, winner_idx: int = -1, loser_idx: int = -1, self_draw: bool = False, fan: int = 0, lines: List[str] | None = None):
        self.game_over = True
        self.pending_claim = {}
        self.reveal_all_hands = winner_idx in (1, 2, 3)
        self.log(msg)
        self.play_sfx("win")
        if winner_idx >= 0:
            if fan <= 0 or not lines:
                _, fan, lines = self.evaluate_win(self.players[winner_idx], self_draw=self_draw)
            if fan > 0:
                if self_draw:
                    for i in range(4):
                        if i == winner_idx:
                            continue
                        self.scores[i] -= fan
                        self.scores[winner_idx] += fan
                elif loser_idx in (0, 1, 2, 3):
                    self.scores[loser_idx] -= fan
                    self.scores[winner_idx] += fan
                self.show_round_summary(winner_idx, loser_idx, fan, lines or [], self_draw)
        self.refresh_hand_buttons()

    def try_ron_from_discard(self, discarder_idx: int, tile: str) -> bool:
        for offset in range(1, 4):
            idx = (discarder_idx + offset) % 4
            if idx == 0:
                continue
            p = self.players[idx]
            ok, fan, lines = self.evaluate_win(p, extra_tile=tile, self_draw=False)
            if ok:
                p.hand.append(tile)
                p.hand.sort(key=tile_key)
                self.end_round(
                    f"{p.name} 食糊 {self.players[discarder_idx].name} 的 {tile_name(tile)}，本局結束。",
                    winner_idx=idx,
                    loser_idx=discarder_idx,
                    self_draw=False,
                    fan=fan,
                    lines=lines,
                )
                return True
        return False

    def apply_claim(self, claimer_idx: int, claim_type: str, tile: str, chi_pair: Tuple[str, str] | None = None):
        p = self.players[claimer_idx]
        if claimer_idx == 0:
            self.recent_draw_tile = None
        if claim_type == "pong":
            p.hand.remove(tile)
            p.hand.remove(tile)
            p.melds.append(f"碰 {tile_name(tile)}")
            p.exposed_melds.append([tile, tile, tile])
            self.current = claimer_idx
            self.need_draw = False
            self.log(f"{p.name} 碰 {tile_name(tile)}。")
            if claimer_idx != 0:
                self.play_callout("碰")
        elif claim_type == "kong":
            p.hand.remove(tile)
            p.hand.remove(tile)
            p.hand.remove(tile)
            p.melds.append(f"槓 {tile_name(tile)}")
            p.exposed_melds.append([tile, tile, tile, tile])
            self.current = claimer_idx
            self.need_draw = True
            self.log(f"{p.name} 槓 {tile_name(tile)}。")
            if claimer_idx != 0:
                self.play_callout("槓")
        elif claim_type == "chi" and chi_pair:
            a, b = chi_pair
            p.hand.remove(a)
            p.hand.remove(b)
            p.melds.append(f"吃 {tile_name(a)}-{tile_name(tile)}-{tile_name(b)}")
            p.exposed_melds.append(sorted([a, tile, b], key=tile_key))
            self.current = claimer_idx
            self.need_draw = False
            self.log(f"{p.name} 吃 {tile_name(tile)}。")
        self.play_sfx("claim")
        self.pending_claim = {}

    def apply_concealed_gong(self, player_idx: int, tile: str):
        p = self.players[player_idx]
        if p.hand.count(tile) < 4:
            return
        for _ in range(4):
            p.hand.remove(tile)
        p.melds.append(f"暗槓 {tile_name(tile)}")
        p.exposed_melds.append([tile, tile, tile, tile])
        self.current = player_idx
        self.need_draw = True
        if player_idx == 0:
            self.recent_draw_tile = None
        self.log(f"{p.name} 槓！暗槓 {tile_name(tile)}。")
        self.play_sfx("claim")
        if player_idx != 0:
            self.play_callout("槓")

    def try_bot_claim(self, discarder_idx: int, tile: str) -> bool:
        if self.bot_difficulty == "初階" and random.random() < 0.5:
            return False
        for offset in range(1, 4):
            idx = (discarder_idx + offset) % 4
            if idx == 0:
                continue
            if self.can_kong_from_discard(self.players[idx], tile):
                self.apply_claim(idx, "kong", tile)
                return True
        for offset in range(1, 4):
            idx = (discarder_idx + offset) % 4
            if idx == 0:
                continue
            if self.can_pong(self.players[idx], tile):
                if self.bot_difficulty == "進階":
                    before = hand_score_for_bot(self.players[idx].hand)
                    tmp = self.players[idx].hand.copy()
                    tmp.remove(tile)
                    tmp.remove(tile)
                    after = hand_score_for_bot(tmp)
                    if after < before - 2:
                        continue
                self.apply_claim(idx, "pong", tile)
                return True
        next_idx = (discarder_idx + 1) % 4
        if next_idx != 0 and self.bot_difficulty != "初階":
            opts = self.chi_options(self.players[next_idx], tile)
            if opts:
                self.apply_claim(next_idx, "chi", tile, opts[0])
                return True
        return False

    def maybe_open_human_claim(self, discarder_idx: int, tile: str) -> bool:
        if discarder_idx == 0:
            return False
        human = self.players[0]
        can_ron = self.player_can_win(human, extra_tile=tile, self_draw=False)
        can_pong = self.can_pong(human, tile)
        can_kong = self.can_kong_from_discard(human, tile)
        can_chi_opts: List[Tuple[str, str]] = []
        if (discarder_idx + 1) % 4 == 0:
            can_chi_opts = self.chi_options(human, tile)
        if not (can_ron or can_pong or can_kong or can_chi_opts):
            return False
        self.pending_claim = {
            "tile": tile,
            "discarder": discarder_idx,
            "discard_index": len(self.discard_history) - 1,
            "can_ron": can_ron,
            "can_pong": can_pong,
            "can_kong": can_kong,
            "chi_options": can_chi_opts,
        }
        self.refresh_hand_buttons()
        return True

    def resolve_after_discard(self, discarder_idx: int, tile: str):
        if self.maybe_open_human_claim(discarder_idx, tile):
            return
        if self.try_ron_from_discard(discarder_idx, tile):
            return
        if self.try_bot_claim(discarder_idx, tile):
            self.refresh_hand_buttons()
            if not self.game_over:
                Clock.schedule_once(lambda *_: self.advance_game_loop(), 0.3)
            return
        self.current = (discarder_idx + 1) % 4
        self.need_draw = True
        self.refresh_hand_buttons()
        Clock.schedule_once(lambda *_: self.advance_game_loop(), 0.25)

    def discard_tile(self, player_idx: int, tile: str):
        p = self.players[player_idx]
        p.hand.remove(tile)
        if player_idx == 0:
            self.recent_draw_tile = None
        p.discards.append(tile)
        self.last_discard = tile
        self.last_discard_owner = player_idx
        self.discard_history.append((player_idx, tile))
        self.log(f"{p.name} 打出 {tile_name(tile)}。")
        self.play_sfx("discard")
        self.resolve_after_discard(player_idx, tile)

    def human_self_draw_win(self):
        if self.game_over or self.current != 0 or self.need_draw:
            return
        ok, fan, lines = self.evaluate_win(self.players[0], self_draw=True)
        if ok:
            self.end_round("你宣告自摸食糊，本局結束。", winner_idx=0, self_draw=True, fan=fan, lines=lines)
        else:
            self.log(f"目前未達可食糊條件（需至少 {self.house_rules['min_fan']} 番）。")
            self.refresh_hand_buttons()

    def human_discard(self, tile: str):
        if self.game_over or self.current != 0 or self.has_pending_claim() or self.is_dealing_initial or self.is_rolling_dice:
            return
        if len(self.players[0].hand) % 3 != 2:
            return
        self.discard_tile(0, tile)
        self.refresh_hand_buttons()

    def human_claim_ron(self):
        if not self.pending_claim or not self.pending_claim.get("can_ron"):
            return
        tile = self.pending_claim["tile"]
        discarder = self.pending_claim["discarder"]
        self.recent_draw_tile = None
        self.players[0].hand.append(tile)
        self.players[0].hand.sort(key=tile_key)
        _, fan, lines = self.evaluate_win(self.players[0], self_draw=False)
        self.end_round(
            f"你宣告食糊 {self.players[discarder].name} 的 {tile_name(tile)}，本局結束。",
            winner_idx=0,
            loser_idx=discarder,
            self_draw=False,
            fan=fan,
            lines=lines,
        )

    def human_claim_pong(self):
        if not self.pending_claim or not self.pending_claim.get("can_pong"):
            return
        tile = self.pending_claim["tile"]
        self.apply_claim(0, "pong", tile)
        self.refresh_hand_buttons()

    def human_claim_kong(self):
        if not self.pending_claim or not self.pending_claim.get("can_kong"):
            return
        tile = self.pending_claim["tile"]
        self.apply_claim(0, "kong", tile)
        self.refresh_hand_buttons()
        Clock.schedule_once(lambda *_: self.advance_game_loop(), 0.2)

    def human_claim_chi(self, t1: str, t2: str):
        if not self.pending_claim:
            return
        if (t1, t2) not in self.pending_claim.get("chi_options", []):
            return
        tile = self.pending_claim["tile"]
        self.apply_claim(0, "chi", tile, (t1, t2))
        self.refresh_hand_buttons()

    def human_concealed_gong(self, tile: str):
        if self.game_over or self.current != 0 or self.need_draw or self.has_pending_claim():
            return
        if tile not in self.concealed_gong_options(self.players[0]):
            return
        self.apply_concealed_gong(0, tile)
        self.refresh_hand_buttons()
        Clock.schedule_once(lambda *_: self.advance_game_loop(), 0.2)

    def human_pass_claim(self):
        if not self.pending_claim:
            return
        discarder = self.pending_claim["discarder"]
        tile = self.pending_claim["tile"]
        self.pending_claim = {}
        if self.try_ron_from_discard(discarder, tile):
            return
        if self.try_bot_claim(discarder, tile):
            self.refresh_hand_buttons()
            if not self.game_over:
                Clock.schedule_once(lambda *_: self.advance_game_loop(), 0.3)
            return
        self.current = (discarder + 1) % 4
        self.need_draw = True
        self.refresh_hand_buttons()
        Clock.schedule_once(lambda *_: self.advance_game_loop(), 0.25)

    def choose_bot_discard_for_current(self, player: Player) -> str:
        if self.bot_difficulty == "初階":
            return random.choice(player.hand)
        if self.bot_difficulty == "進階":
            return choose_bot_discard_hard(player.hand, len(player.exposed_melds))
        return choose_bot_discard(player.hand)

    def bot_turn(self):
        if self.game_over:
            return
        if self.has_pending_claim():
            # Guard against stale scheduled bot callbacks while human claim UI is active.
            return
        p = self.players[self.current]
        if self.need_draw:
            if not self.draw_for_current():
                return
            self.need_draw = False
            ok, fan, lines = self.evaluate_win(p, self_draw=True)
            if ok:
                self.end_round(f"{p.name} 自摸糊牌，本局結束。", winner_idx=self.current, self_draw=True, fan=fan, lines=lines)
                return
        bot_kongs = self.concealed_gong_options(p)
        if bot_kongs and (self.bot_difficulty != "初階" or random.random() < 0.4):
            self.apply_concealed_gong(self.current, bot_kongs[0])
            self.refresh_hand_buttons()
            Clock.schedule_once(lambda *_: self.advance_game_loop(), 0.25)
            return
        if len(p.hand) % 3 != 2:
            # Robust recovery to avoid aborting rounds on transient sequencing issues.
            self.log(f"回合同步修正：{p.name} 手牌狀態({len(p.hand)})。")
            mod = len(p.hand) % 3
            if mod == 1:
                if not self.draw_for_current():
                    return
                ok, fan, lines = self.evaluate_win(p, self_draw=True)
                if ok:
                    self.end_round(f"{p.name} 自摸糊牌，本局結束。", winner_idx=self.current, self_draw=True, fan=fan, lines=lines)
                    return
            elif mod == 0:
                if not p.hand:
                    # Force a safe skip if hand somehow became empty.
                    self.current = (self.current + 1) % 4
                    self.need_draw = True
                    self.refresh_hand_buttons()
                    Clock.schedule_once(lambda *_: self.advance_game_loop(), 0.25)
                    return
                forced = self.choose_bot_discard_for_current(p)
                self.log(f"修正打牌：{p.name} 強制打出 {tile_name(forced)}。")
                self.discard_tile(self.current, forced)
                self.refresh_hand_buttons()
                if not self.game_over:
                    Clock.schedule_once(lambda *_: self.advance_game_loop(), 0.3)
                return
            if len(p.hand) % 3 != 2:
                # Last-resort fallback: skip to next player instead of ending round.
                self.current = (self.current + 1) % 4
                self.need_draw = True
                self.refresh_hand_buttons()
                Clock.schedule_once(lambda *_: self.advance_game_loop(), 0.25)
                return
        discard = self.choose_bot_discard_for_current(p)
        self.discard_tile(self.current, discard)
        self.refresh_hand_buttons()
        if not self.game_over:
            Clock.schedule_once(lambda *_: self.advance_game_loop(), 0.35)

    def advance_game_loop(self):
        if self.is_rolling_dice:
            self.refresh_hand_buttons()
            return
        if self.is_dealing_initial:
            self.refresh_hand_buttons()
            return
        if self.game_over:
            self.refresh_hand_buttons()
            return
        if self.has_pending_claim():
            self.refresh_hand_buttons()
            return
        if self.need_draw:
            if not self.draw_for_current():
                return
            self.need_draw = False
            p = self.players[self.current]
            ok, fan, lines = self.evaluate_win(p, self_draw=True)
            if ok:
                if p.is_human:
                    self.log(f"你摸牌後可食糊（{fan}番），請自行按「宣告食糊」，或選擇打牌。")
                else:
                    self.end_round(f"{p.name} 自摸糊牌，本局結束。", winner_idx=self.current, self_draw=True, fan=fan, lines=lines)
                    return
        self.refresh_hand_buttons()
        if self.current != 0:
            Clock.schedule_once(lambda *_: self.bot_turn(), 0.35)


class HomeScreen(FloatLayout):
    def __init__(self, on_start, **kwargs):
        super().__init__(**kwargs)
        with self.canvas.before:
            Color(0.06, 0.22, 0.14, 1)
            self.bg = Rectangle(pos=self.pos, size=self.size)
        self.bind(pos=self._update_bg, size=self._update_bg)

        panel = OverlayPanel(
            orientation="vertical",
            spacing=10,
            padding=16,
            size_hint=(None, None),
            size=(760, 520),
            pos_hint={"center_x": 0.5, "center_y": 0.5},
        )
        if MENU_LOGO_PATH.exists():
            panel.add_widget(Image(source=str(MENU_LOGO_PATH), size_hint_y=None, height=150, allow_stretch=True, keep_ratio=True))
        panel.add_widget(Label(text="香港麻雀對局", size_hint_y=None, height=48, font_size="36sp"))
        panel.add_widget(Label(text="支援花牌/季節牌、食糊/上、碰槓宣告與難度設定", size_hint_y=None, height=42, font_size="19sp"))
        panel.add_widget(Label(text="按下開始進入牌桌", size_hint_y=None, height=40, font_size="20sp"))
        start_btn = Button(text="開始遊戲", size_hint_y=None, height=58)
        start_btn.bind(on_press=lambda *_: on_start())
        panel.add_widget(start_btn)
        self.add_widget(panel)

    def _update_bg(self, *_):
        self.bg.pos = self.pos
        self.bg.size = self.size


class HKMahjongApp(App):
    def build(self):
        self.root_container = FloatLayout()
        self.show_home_screen()
        return self.root_container

    def show_home_screen(self):
        self.root_container.clear_widgets()
        self.root_container.add_widget(HomeScreen(on_start=self.start_game))

    def start_game(self):
        self.root_container.clear_widgets()
        self.root_container.add_widget(MahjongGameUI())


if __name__ == "__main__":
    HKMahjongApp().run()

