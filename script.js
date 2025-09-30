const playButton = document.getElementById('playButton');
const playIcon = document.getElementById('playIcon');
// Controls: repurpose previous button as NEXT1, keep existing NEXT as NEXT2
const next1Button = document.getElementById('next1Button');
const nextButton = document.getElementById('nextButton'); // NEXT2 (existing)
const progressBarElement = document.getElementById('progressBar');
const currentTimeDisplay = document.getElementById('currentTime');
const problemArea = document.getElementById('problemArea');
const titleArea = document.querySelector('.title-area h2');

// Hooks for independent effects per NEXT button
// Stage-specific effects are wired here
function onNext1Effect() {
    if (currentStage === 9) stage9HandleInput('left');
}
function onNext2Effect() {
    if (currentStage === 9) stage9HandleInput('right');
}

//====================================================
// NEXT色設定（デフォルト + ステージ別オーバーライド）
//====================================================
const DEFAULT_NEXT_COLORS = {
    left: '#ff0000',  // 赤
    right: '#007bff', // 青
    both: '#800080',  // 紫
    none: '#ffffff'   // 未選択（パズル内ドット用の基準色）
};

// 必要なステージのみ上書き（例示）
// 使い方: STAGE_NEXT_COLORS[ステージ番号] = { left:'#xx', right:'#yy', both:'#zz', none:'#ww' };
const STAGE_NEXT_COLORS = {
    // 例: 16: { left: '#00ff88', right: '#ffaa00', both: '#66ccff' }
};

function getNextColorsForStage(stage) {
    const o = STAGE_NEXT_COLORS[stage];
    if (!o) return DEFAULT_NEXT_COLORS;
    return {
        left: o.left || DEFAULT_NEXT_COLORS.left,
        right: o.right || DEFAULT_NEXT_COLORS.right,
        both: o.both || DEFAULT_NEXT_COLORS.both,
        none: o.none || DEFAULT_NEXT_COLORS.none,
    };
}
//====================================================
// 定数定義
//====================================================
const BPM = 170.0;
const BEATS_PER_SECOND = BPM / 60;
const BEAT_INTERVAL = 60 / BPM; // 1拍の長さ（秒）
const TOTAL_DURATION = 283; // 4:42 in seconds

// Audio URLs for calibration and main stages
const AUDIO_URLS = {
    test: 'assets/audio/MUSICTEST.mp3',
    main: 'assets/audio/MUSIC2000.mp3'
};

// Per-track volume preferences (0..1), set in code
// Edit these values to adjust volumes per track
const TRACK_VOLUMES = { test: 0.32, main: 0.5 };

function getTrackKeyForUrl(url) {
    if (!url) return null;
    if (url === AUDIO_URLS.test) return 'test';
    if (url === AUDIO_URLS.main) return 'main';
    return null;
}

function applyVolumeForCurrentTrack() {
    const key = getTrackKeyForUrl(audio?.url);
    const v = (key && typeof TRACK_VOLUMES[key] === 'number') ? TRACK_VOLUMES[key] : 0.7;
    try { audio.volume = v; } catch(_) {}
}

// 入力のビート判定を前寄りに補正（描画遅延やイベント遅延の吸収用）
// 例: 30ms 前倒しで、境界付近で「前の拍」に入ってしまう誤判定を低減
let INPUT_BEAT_BIAS_MS = (function() {
    const v = Number(localStorage.getItem('inputBeatBiasMs'));
    return Number.isFinite(v) ? v : 0;
})();
// 音楽出力側のオフセットは使わない（判定オフセットのみ使用）

function getInputBeatNumber() {
    const dotCount = stageSettings[currentStage]?.dots || 4;
    const biasSec = (INPUT_BEAT_BIAS_MS || 0) / 1000;
    // できるだけ最新の時間を参照（音声が準備済みなら audio.currentTime）
    const t = (audio && typeof audio.currentTime === 'number') ? audio.currentTime : currentTime;
    const beatPos = (t + biasSec) * BEATS_PER_SECOND;
    const progress = beatPos % dotCount;
    const nearest = Math.floor(progress + 0.5) % dotCount;
    const beat = nearest + 1;
    return Math.max(1, Math.min(dotCount, beat));
}

// Wrap-safe version used for input registration to avoid last->first bleed
function getWrapSafeBeatNumber() {
    const dotCount = stageSettings[currentStage]?.dots || 4;
    const biasSec = (INPUT_BEAT_BIAS_MS || 0) / 1000;
    const t = (audio && typeof audio.currentTime === 'number') ? audio.currentTime : currentTime;
    const beatPos = (t + biasSec) * BEATS_PER_SECOND;
    const progress = ((beatPos % dotCount) + dotCount) % dotCount; // [0, dotCount)
    let nearest = Math.floor(progress + 0.5);
    if (nearest >= dotCount) nearest = dotCount - 1; // clamp instead of wrap
    return nearest + 1; // 1..dotCount
}


const HIRAGANA = [
    'あ', 'い', 'う', 'え', 'お',
    'か', 'き', 'く', 'け', 'こ',
    'さ', 'し', 'す', 'せ', 'そ',
    'た', 'ち', 'つ', 'て', 'と',
    'な', 'に', 'ぬ', 'ね', 'の',
    'は', 'ひ', 'ふ', 'へ', 'ほ',
    'ま', 'み', 'む', 'め', 'も',
    'や', 'ゆ', 'よ',
    'ら', 'り', 'る', 'れ', 'ろ',
    'わ', 'を', 'ん'
];




//====================================================
// ギミックシステム
//====================================================
const GIMMICK_TYPES = {
    TIMER: 'timer',
    HIRAGANA: 'hiragana',
    IMAGE_SEQUENCE: 'image_sequence',
    SEGMENT: 'segment',
    DYNAMIC_TEXT: 'dynamic_text',
    WALL_IMAGE: 'wall_image',
    DOT_COUNTER: 'dot_counter',
    DYNAMIC_TEXT_GROUP: 'dynamic_text_group',
    RHYTHM_DOTS: 'rhythm_dots',
    NUMBER_TEXT: 'number_text',
    CLICK_COUNTER: 'click_counter',  // 新しく追加
    LYRICS: 'lyrics',
    MORSE_DISPLAY: 'morse_display',
    INPUT_IMAGE: 'input_image',
    VERTICAL_LINES: 'vertical_lines' // 濁点っぽい縦線2本描画
};
// extend types without touching original block
GIMMICK_TYPES.LINES_ARCS = 'lines_arcs';
// Stage 9: 4 tiles that rotate per beat
GIMMICK_TYPES.ROTATE_TILES = 'rotate_tiles';
// クリック回数を追跡する変数を追加
const clickCounts = {
    play: 0,
    // legacy fields kept for compatibility
    prev: 0,
    next: 0,
    progress: 0,
    // new independent counters
    next1: 0,
    next2: 0,
    getTotal() {
        // count both next1 and next2 toward total via legacy next as well
        return this.play + this.prev + this.next + this.progress;
    }
};

const STAGE_CONFIGS = {
    0: {
        gimmicks: [
        ]
    },
    1: {
        gimmicks: [

        ]
    },
    2: {
        gimmicks: [

        ]
    },
    3: {
        
        gimmicks: [
            {
                type: GIMMICK_TYPES.RHYTHM_DOTS,
                settings: {
                    x: 50,      // 全体の中心X座標
                    y: 50,      // 全体の中心Y座標
                    size: 428,  // 全体のサイズ
                    dots: [
                        { x: 15, y: 50, size: 25, beat: 1 },  // 左上
                        { x: 25, y: 50, size: 25, beat: 2 },  // 右上
                        { x: 35, y: 50, size: 25, beat: 3 },  // 左から2番目
                        { x: 45, y: 50, size: 25, beat: 4 },  // 右から2番目
                        { x: 55, y: 50, size: 25, beat: 5 },  // 左から3番目
                        { x: 65, y: 50, size: 25, beat: 6 },  // 右から3番目
                        { x: 75, y: 50, size: 25, beat: 7 },  // 左下
                        { x: 85, y: 50, size: 25, beat: 8 }   // 右下
                    ]
                }
            }
        ]
           
    },
    4: {
        gimmicks: [
            {
                type: GIMMICK_TYPES.RHYTHM_DOTS,
                settings: {
                    x: 50,      // 全体の中心X座標
                    y: 50,      // 全体の中心Y座標
                    size: 400,  // 全体のサイズ
                    dots: [
                        { x: 20, y: 20, size: 30, beat: 1 },  // 左上
                        { x: 80, y: 20, size: 30, beat: 2 },  // 右上
                        { x: 20, y: 40, size: 30, beat: 3 },  // 左から2番目
                        { x: 80, y: 40, size: 30, beat: 4 },  // 右から2番目
                        { x: 20, y: 60, size: 30, beat: 5 },  // 左から3番目
                        { x: 80, y: 60, size: 30, beat: 6 },  // 右から3番目
                        { x: 20, y: 80, size: 30, beat: 7 },  // 左下
                        { x: 80, y: 80, size: 30, beat: 8 }   // 右下
                        
                    ]
                }
            }
        ]
    },
    5: {
        gimmicks: [
            {
                type: GIMMICK_TYPES.NUMBER_TEXT,
                settings: {
                    x: 50,      // 全体の中心X座標
                    y: 53,      // 全体の中心Y座標
                    size: 190,  // 全体のサイズを大きく
                    spacing: 5,  // 文字間のスペース
                    words: [
                        {
                            text: "Z--#",
                            x: 50,
                            y: -45,
                            specialChar: { index: 3, default: "O", selected: "I" }
                        },
                        {
                            text: "#N-",
                            x: 50,
                            y: -25,
                            specialChar: { index: 0, default: "O", selected: "I" }
                        },
                        {
                            text: "-W#",
                            x: 50,
                            y: -5,
                            specialChar: { index: 2, default: "O", selected: "I" }
                        },

                        {
                            text: "-#U-",
                            x: 50,
                            y: 35,
                            specialChar: { index: 1, default: "O", selected: "I" }
                        },
                        {
                            text: "-#V-",
                            x: 50,
                            y: 55,
                            specialChar: { index: 1, default: "O", selected: "I" }
                        },
                        {
                            text: "S#X",
                            x: 50,
                            y: 75,
                            specialChar: { index: 1, default: "O", selected: "I" }
                        },

                        {
                            text: "-#G--",
                            x: 50,
                            y: 115,
                            specialChar: { index: 1, default: "O", selected: "I" }
                        },
                        {
                            text: "N#N-",
                            x: 50,
                            y: 135,
                            specialChar: { index: 1, default: "O", selected: "I" }
                        },
                        {
                            text: "-----",  // 変更なしのテキスト
                            x: 50,
                            y: 15
                        },
                        {
                            text: "S-V-N",  // 変更なしのテキスト
                            x: 50,
                            y: 95
                        },
                    ]
                }
            },
            {
                type: GIMMICK_TYPES.INPUT_IMAGE,
                settings: {
                    x: 50,
                    y: 75,
                    size: 150,
                    leftImage: 'assets/images/puzzles/stage5/UP.png',
                    rightImage: 'assets/images/puzzles/stage5/DOWN.png'
                }
            }
        ]
    },
    6: {
        gimmicks: [
            {
                type: GIMMICK_TYPES.DOT_COUNTER,
                settings: {
                    x: 30,
                    y: 20,
                    size: 90,
                    startBeat: 1,
                    endBeat: 4,
                    baseNumber: '1',
                    requiredCount: 2  // 前半は2回必要
                }
            },
            {
                type: GIMMICK_TYPES.DOT_COUNTER,
                settings: {
                    x: 70,
                    y: 20,
                    size: 90,
                    startBeat: 5,
                    endBeat: 8,
                    baseNumber: '1',
                    requiredCount: 3  // 後半は3回必要
                }
            }
        ]
    },
    7: {
        gimmicks: [
            // {
            //     type: GIMMICK_TYPES.RHYTHM_DOTS,
            //     settings: {
            //         x: 50,      // 全体の中心X座標
            //         y: 50,      // 全体の中心Y座標
            //         size: 400,  // 全体のサイズ
            //         dots: [
            //             { x: 40, y: 10, size: 30, beat: 2 },  // 左上
            //             { x: 60, y: 10, size: 30, beat: 7 },  // 右上
            //             { x: 90, y: 40, size: 30, beat: 3 },  // 左から2番目
            //             { x: 90, y: 60, size: 30, beat: 4 },  // 右から2番目
            //             { x: 60, y: 90, size: 30, beat: 8 },  // 左から3番目
            //             { x: 40, y: 90, size: 30, beat: 1 },
            //             { x: 10, y: 60, size: 30, beat: 5 },   // 右から3番目
            //             { x: 10, y: 40, size: 30, beat: 6 }  // 左下
            //               // 右下
                        
            //         ]
            //     }
            // },
            {
                // ステージ7: ボタンを押した拍のみ縦線2本を描画
                type: GIMMICK_TYPES.VERTICAL_LINES,
                settings: {
                    x: 50,
                    y: 50,
                    size: 400,
                    beats: [
                        { beat: 1, lines: [ { x: 27, y: 40, length: 28, width: 10 }, { x: 30, y: 40, length: 28, width: 10 } ] },
                        { beat: 2, lines: [ { x: 50, y: 40, length: 28, width: 10 }, { x: 53, y: 40, length: 28, width: 10 } ] },
                        { beat: 3, lines: [ { x: 73, y: 40, length: 28, width: 10 }, { x: 76, y: 40, length: 28, width: 10 } ] },
                        { beat: 4, lines: [ { x: 99, y: 40, length: 28, width: 10 }, { x: 102, y: 40, length: 28, width: 10 } ] }
                    ]
                }
            },
            {
                // ステージ7: 左NEXTで直線＋円弧の複合要素を描画
                type: GIMMICK_TYPES.LINES_ARCS,
                settings: {
                    x: 50,
                    y: 50,
                    size: 400,
                    // 角度は度数法。cx,cy,radius は%（要素サイズ基準）。width はpx（400基準でスケール）。
                    beats: [
                        { beat: 1,
                          lines: [ { x: 20, y: 42, length: 50, width: 8 } ],
                          arcs:  [ { cx: 8, cy: 47, radius: 12, startAngle: 0,  endAngle: 90,  width: 10 } ] },
                        { beat: 2,
                          lines: [ { x: 43, y: 42, length: 50, width: 8 } ],
                          arcs:  [ { cx: 31, cy: 47, radius: 12, startAngle: 0,  endAngle: 90,  width: 10 } ] },
                        { beat: 3,
                          lines: [ { x: 66, y: 42, length: 50, width: 8 } ],
                          arcs:  [ { cx: 54, cy: 47, radius: 12, startAngle: 0,  endAngle: 90,  width: 10 } ] },
                        { beat: 4,
                          lines: [ { x: 89, y: 42, length: 50, width: 8 } ],
                          arcs:  [ { cx: 77, cy: 47, radius: 12, startAngle: 0,  endAngle: 90,  width: 10 } ] },
                    ]
                }
            }
        ]
    },
    8: {
        gimmicks: [
            {
                type: GIMMICK_TYPES.IMAGE_SEQUENCE,
                settings: {
                    x: 20,
                    y: 50,
                    size: 80,
                    images: Array.from({ length: 8 }, (_, i) => `assets/images/puzzles/stage8/moon${i}.png`),
                    changeInterval: 60 * 4 / 170 / 4
                }
            }
        ]
    },
    9: {
        gimmicks: [
            {
                type: GIMMICK_TYPES.ROTATE_TILES,
                settings: {
                    x: 47.7,
                    y: 48,
                    size: 360,
                    images: [
                        'assets/images/puzzles/stage9/MAZE0.png',
                        'assets/images/puzzles/stage9/MAZE1.png',
                        'assets/images/puzzles/stage9/MAZE2.png',
                        'assets/images/puzzles/stage9/MAZE3.png'
                    ],
                    // set default rotations; can be single number or array of four numbers
                    defaultRotation: [90, -90, 90, 0],
                    // optional: custom positions inside element (percent). If omitted, arranged in one row.
                    positions: [ { x: 15, y: 50 }, { x: 40, y: 50 }, { x: 65, y: 50 }, { x: 90, y: 50 } ],
                    tileScale: 0.25,
                    gapRatio: 0.0
                }
            }
        ]
    },
    10: {
        gimmicks: [
            {
                type: GIMMICK_TYPES.IMAGE_SEQUENCE,
                settings: {
                    x: 50,
                    y: 50,
                    size: 150,
                    images: Array.from({ length: 8 }, (_, i) => `assets/images/puzzles/stage10/black${i}.png`),
                    changeInterval: 60 * 4 / 170 / 4
                }
            }
        ]
    },
    11: {
        gimmicks: [
            {
                type: GIMMICK_TYPES.WALL_IMAGE,
                settings: {
                    x: 50,
                    y: 50,
                    size: 100,  // 100%のサイズで表示
                    images: Array.from({ length: 16 }, (_, i) => `assets/images/puzzles/wall/wall${i}.png`)
                }
            }
        ]
    },
    12: {
        gimmicks: [
            {
                type: GIMMICK_TYPES.WALL_IMAGE,
                settings: {
                    x: 50,
                    y: 50,
                    size: 100,  // 100%のサイズで表示
                    images: Array.from({ length: 16 }, (_, i) => `assets/images/puzzles/wall/wall${i}.png`)
                }
            }
        ]
    },
    13: {
        gimmicks: [
            {
                type: GIMMICK_TYPES.WALL_IMAGE,
                settings: {
                    x: 50,
                    y: 50,
                    size: 100,  // 100%のサイズで表示
                    images: Array.from({ length: 16 }, (_, i) => `assets/images/puzzles/wall/wall${i}.png`)
                }
            }
        ]
    },
    14: {
        gimmicks: [
            {
                type: GIMMICK_TYPES.RHYTHM_DOTS,
                settings: {
                    x: 50,      // 全体の中心X座標
                    y: 50,      // 全体の中心Y座標
                    size: 400,  // 全体のサイズ
                    dots: [
                        { x: 50, y: 35, size: 25, beat: 1 },  // 左上
                        { x: 73, y: 35, size: 25, beat: 2 },  // 右上
                        { x: 40, y: 85, size: 25, beat: 3 },  // 左から2番目
                        { x: 39, y: 35, size: 25, beat: 4 },  // 右から2番目
                        { x: 61.5, y: 35, size: 25, beat: 5 },  // 左から3番目
                        { x: 84, y: 35, size: 25, beat: 6 },  // 右から3番目
                        { x: 50, y: 85, size: 25, beat: 7 },  // 左下
                        { x: 60, y: 85, size: 25, beat: 8 }   // 右下
                    ]
                }
            }
        ]
    },

    15: {
        gimmicks: [
            {
                type: GIMMICK_TYPES.RHYTHM_DOTS,
                settings: {
                    x: 50,      
                    y: 50,      
                    size: 400,  
                    dots: [
                        // beat: どの拍に属するか
                        { x: 50, y: 53, size: 30, beat: 1 }, 
                        { x: 58, y: 12, size: 30, beat: 1 },  // 1拍目のドット
                        
                        // 2拍目の3つのドット
                        { x: 40, y: 12, size: 30, beat: 2 },
                        { x: 41, y: 26, size: 30, beat: 2 },
                        { x: 51.5, y: 89, size: 30, beat: 2 },
                        
                        { x: 40, y: 53, size: 30, beat: 3 },  // 3拍目のドット

                        { x: 90, y: 40, size: 30, beat: 4 },
                        { x: 90, y: 50, size: 30, beat: 5 },
                        { x: 90, y: 60, size: 30, beat: 6 },

                        { x: 60, y: 26, size: 30, beat: 7 },  // 4拍目のドット
                    ]
                }
            }
        ]
    },
    16: {
        gimmicks: [
            {
                type: GIMMICK_TYPES.MORSE_DISPLAY,
                settings: {
                    x: 50,
                    y: 35,
                    size: 260,
                    fontScale: 0.35,
                    letterSpacing: 8
                }
            },
            {
                type: GIMMICK_TYPES.CLICK_COUNTER,
                settings: {
                    x: 30,
                    y: 70,
                    size: 80
                }
            },

        ]
    },
    17: {
        gimmicks: [
            {
                type: GIMMICK_TYPES.CLICK_COUNTER,
                settings: {
                    x: 30,
                    y: 30,
                    size: 80
                }
            },
            {
                type: GIMMICK_TYPES.RECORDS_DISPLAY,
                settings: {
                    x: 50,
                    y: 60,
                    size: 150
                }
            },
        ]
    },
    
};

// --- Stage 5 を歌詞表示に差し替え（シンプル実装・他ステージへ非影響）---
STAGE_CONFIGS[5] = {
    gimmicks: [
        {
            type: GIMMICK_TYPES.LYRICS,
            settings: {
                // 位置・サイズ（自由に調整可）
                x: 50,
                y: 50,
                size: 350,
                // スタイル（自由に調整可）
                fontSize: 33,
                lineHeight: 1.3,
                color: '#111',
                align: 'center',
                // 表示モード: 1行ずつのみ表示
                displayMode: 'current',
                // タイミング（仮）。時間未指定のときは autoStep で順番に表示
                autoStartAt: 0,
                autoStep: 2.5,
                lineDuration: 2.5,
                // 歌詞（仮・すべて時間指定、約5分想定）
                lines: [
                    { text: "~♪", start: 0.0, end: 17.2 },
                    { text: "(Don't fight it)", start: 17.2, end: 18.7 },
                    { text: "(Don't fight it)", start: 18.7, end: 20.2 },
                    { text: "(Don't fight it)", start: 20.2, end: 21.5 },
                    { text: "(Don't fight it)", start: 21.5, end: 22.6 },
                    { text: "~♪", start: 22.6, end: 34.2 },
                    { text: "Don't fight it", start: 34.2, end: 35.6 },
                    { text: "Don't fight it", start: 35.6, end: 37.0 },
                    { text: "Don't fight it", start: 37.0, end: 38.4 },
                    { text: "(Don't fight it)", start: 38.4, end: 39.8 },
                    { text: "Don't fight it", start: 39.8, end: 41.2 },
                    { text: "Don't fight it", start: 41.2, end: 42.6 },
                    { text: "Don't fight it", start: 42.6, end: 44.0 },
                    { text: "(Don't fight it)", start: 44.0, end: 45.0 },
                    { text: "~♪", start: 45.0, end: 51.0 },
                    { text: "Don't fight it", start: 51.0, end: 52.2 },
                    { text: "Don't fight it", start: 52.2, end: 53.6 },
                    { text: "Don't fight it", start: 53.6, end: 55.0 },
                    { text: "(Don't fight it)", start: 55.0, end: 56.4 },
                    { text: "~♪", start: 56.4, end: 90.7 },
                    { text: "Don't fight it", start: 90.7, end: 92.1 },
                    { text: "Don't fight it", start: 92.1, end: 93.5 },
                    { text: "Don't fight it", start: 93.5, end: 94.9 },
                    { text: "(Don't fight it)", start: 94.9, end: 96.3 },
                    { text: "Don't fight it", start: 96.3, end: 97.7 },
                    { text: "Don't fight it", start: 97.7, end: 99.1 },
                    { text: "Don't fight it", start: 99.1, end: 100.5 },
                    { text: "(Don't fight it)", start: 100.5, end: 101.7 },
                    { text: "~♪", start: 101.7, end: 136.4 },
                    { text: "Just like you never broke my heart", start: 136.4, end: 139.4 },
                    { text: "Like you never said the words", start: 139.4, end: 142.0 },
                    { text: "Two worlds never further apart", start: 142.0, end: 144.6 },
                    { text: "Now go", start: 146.4, end: 147.6 },
                    { text: "And life will never be the same", start: 147.6, end: 150.6 },
                    { text: "But I will keep on finding my way", start: 150.6, end: 153.5 },
                    { text: "I'll move on to get to my brighter day", start: 153.5, end: 157.3 },
                    { text: "~♪", start: 157.3, end: 186.7 },
                    { text: "(Don't fight it)", start: 186.7, end: 188.2 },
                    { text: "(Don't fight it)", start: 188.2, end: 189.6 },
                    { text: "(Don't fight it)", start: 189.6, end: 190.7 },
                    { text: "~♪", start: 190.7, end: 215.3 },
                    { text: "Just like you never broke my heart", start: 215.4, end: 218.4 },
                    { text: "Like you never said the words", start: 218.4, end: 221.3 },
                    { text: "Two worlds never further apart", start: 221.3, end: 225.4 },
                    { text: "Now go", start: 225.4, end: 226.6 },
                    { text: "And I will never be the same", start: 226.6, end: 229.6 },
                    { text: "But I will keep on finding a way", start: 229.6, end: 232.5 },
                    { text: "I'll move on to get to a brighter day", start: 232.5, end: 237.5 },
                    { text: "Don't fight it", start: 237.5, end: 238.9 },
                    { text: "Don't fight it", start: 238.9, end: 240.3 },
                    { text: "Don't fight it", start: 240.3, end: 241.2 },
                    { text: "Like you never said the words", start: 241.2, end: 243.1 },
                    { text: "Don't fight it", start: 243.1, end: 244.5 },
                    { text: "Don't fight it", start: 244.5, end: 245.9 },
                    { text: "(Don't fight it)", start: 245.9, end: 247.3 },
                    { text: "Don't fight it", start: 247.3, end: 248.7 },
                    { text: "Don't fight it", start: 248.7, end: 250.1 },
                    { text: "Don't fight it", start: 250.1, end: 251.5 },
                    { text: "Don't fight it", start: 251.5, end: 252.5 },
                    { text: "Like you never said the words", start: 252.5, end: 254.3 },
                    { text: "Don't fight it", start: 254.3, end: 255.7 },
                    { text: "Don't fight it", start: 255.7, end: 256.4 },
                    { text: "I'll move on to get to a brighter day", start: 256.4, end: 259.9 },
                    { text: "Don't fight it", start: 259.9, end: 261.3 },
                    { text: "Don't fight it", start: 261.3, end: 262.7 },
                    { text: "Don't fight it", start: 262.7, end: 264.1 },
                    { text: "(Don't fight it)", start: 264.1, end: 266.1 },
                    { text: "Don't fight it", start: 266.1, end: 267.5 },
                    { text: "Don't fight it", start: 267.5, end: 268.9 },
                    { text: "Don't fight it", start: 268.9, end: 270.3 },
                    { text: "(Don't fight it)", start: 270.3, end: 271.4 },
                    { text: "Don't fight it", start: 271.4, end: 272.8 },
                    { text: "Don't fight it", start: 272.8, end: 274.2 },
                    { text: "Don't fight it", start: 274.2, end: 275.6 },
                    { text: "(Don't fight it)", start: 275.6, end: 277.0 },
                    { text: "Don't fight it", start: 277.0, end: 278.4 },
                    { text: "Don't fight it", start: 278.4, end: 279.8 },
                    { text: "Don't fight it", start: 279.8, end: 281.2 },
                    { text: "(Don't fight it)", start: 281.2, end: 282.4 },
                    { text: "~♪", start: 282.4, end: 300.0 }
                ]
            }
        },
        {
            // ステージ5: 4拍 × (右=上矢印 / 左=下矢印) = 合計8本
            type: GIMMICK_TYPES.VERTICAL_LINES,
            settings: {
              x: 50,
              y: 50,
              size: 300,
              cornerStyle: 'round',        // same as before
              cornerRadius: 6,
              beats: [
                // 列xは 20 / 40 / 60 / 80 に統一（右は上向き、左は下向き）
                {
                  beat: 1,
                  rightLines: [
                    { x1: 20, y1: 30, x2: 20, y2: 46, width: 6 }, // ↑シャフト
                    { x1: 20, y1: 30, x2: 14, y2: 36, width: 6 }, // ↑ヘッド左
                    { x1: 20, y1: 30, x2: 26, y2: 36, width: 6 }  // ↑ヘッド右
                  ],
                  leftLines: [
                    { x1: 20, y1: 64, x2: 20, y2: 80, width: 6 }, // ↓シャフト
                    { x1: 20, y1: 80, x2: 14, y2: 74, width: 6 }, // ↓ヘッド左
                    { x1: 20, y1: 80, x2: 26, y2: 74, width: 6 }  // ↓ヘッド右
                  ]
                },
                {
                  beat: 2,
                  rightLines: [
                    { x1: 40, y1: 30, x2: 40, y2: 46, width: 6 },
                    { x1: 40, y1: 30, x2: 34, y2: 36, width: 6 },
                    { x1: 40, y1: 30, x2: 46, y2: 36, width: 6 }
                  ],
                  leftLines: [
                    { x1: 40, y1: 64, x2: 40, y2: 80, width: 6 },
                    { x1: 40, y1: 80, x2: 34, y2: 74, width: 6 },
                    { x1: 40, y1: 80, x2: 46, y2: 74, width: 6 }
                  ]
                },
                {
                  beat: 3,
                  rightLines: [
                    { x1: 60, y1: 30, x2: 60, y2: 46, width: 6 },
                    { x1: 60, y1: 30, x2: 54, y2: 36, width: 6 },
                    { x1: 60, y1: 30, x2: 66, y2: 36, width: 6 }
                  ],
                  leftLines: [
                    { x1: 60, y1: 64, x2: 60, y2: 80, width: 6 },
                    { x1: 60, y1: 80, x2: 54, y2: 74, width: 6 },
                    { x1: 60, y1: 80, x2: 66, y2: 74, width: 6 }
                  ]
                },
                {
                  beat: 4,
                  rightLines: [
                    { x1: 80, y1: 30, x2: 80, y2: 46, width: 6 },
                    { x1: 80, y1: 30, x2: 74, y2: 36, width: 6 },
                    { x1: 80, y1: 30, x2: 86, y2: 36, width: 6 }
                  ],
                  leftLines: [
                    { x1: 80, y1: 64, x2: 80, y2: 80, width: 6 },
                    { x1: 80, y1: 80, x2: 74, y2: 74, width: 6 },
                    { x1: 80, y1: 80, x2: 86, y2: 74, width: 6 }
                  ]
                }
              ]
            }
          }
          
    ]
};

// (removed) previously injected Stage 7 extra gimmick; now configured inline in STAGE_CONFIGS

const STAGE_NAMES = [
    "チュートリアル",
    "Do", "Doo", "イコールの下が答えだ！",
    "選択", "0or1", "数式",
    "道しるべ(きまぐれ)", "夜空", "おいしそう！",
    "チカチカ", "問題を成立させよう！", "西？",
    "九？", "一週間", "楽器の名前をこたえよう",
    "最終ステージ-がんばれ～", "エンディング-おめでとう！"
];

const PUZZLE_IMAGES = {
    0: "assets/images/puzzles/puzzle0.png",
    1: "assets/images/puzzles/puzzle1.png",
    2: "assets/images/puzzles/puzzle2.png",
    3: "assets/images/puzzles/puzzle3.png",
    4: "assets/images/puzzles/puzzle4.png",
    5: "assets/images/puzzles/puzzle999.png",
    6: "assets/images/puzzles/puzzle6.png",
    7: "assets/images/puzzles/puzzle7.png",
    8: "assets/images/puzzles/stage8/puzzlemoon.png",
    9: "assets/images/puzzles/puzzle9.png",
    10: "assets/images/puzzles/puzzle999.png",
    11: "assets/images/puzzles/puzzle11.png",
    12: "assets/images/puzzles/puzzle12.png",
    13: "assets/images/puzzles/puzzle13.png",
    14: "assets/images/puzzles/puzzle14.png",
    15: "assets/images/puzzles/puzzle15.png",
    16: "assets/images/puzzles/puzzle999.png",
    17: "assets/images/puzzles/puzzle17.png"
};

// ヒントシステム
const STAGE_HINTS = {
    0: "音楽のリズムに合わせて点が動きます。特に何もしなくても大丈夫です。",
    1: "黒黒白黒の順番で丸が表示されています。あなたができることはボタンを押すことのみです。試しに何度か次へボタンを押してみましょう",
    2: "停止ボタンをイコールだとすれば、答えは「テイル」です。「ステージタイトル」という文字の中に「テイル」が存在しています",
    3: "全てのボタンを押すと「ブラック」となります。「ホワイト」「ブラック」この文字から「ブライト」を作りましょう",
    4: "8つの点が順番に光ります。イラスト「せみ」「きん」「たい」「くり」です。「せんたく」になるようにどちらか片方ずつ選びましょう",
    5: "10個の要素がありますが、これは数字の「ZERO」から「NINE」を表しています。ボタンを押すと#が「O」か「I」になります。",
    6: "左側について「/」と縦書きの「一日」を合わせるととある漢数字になります。",
    7: "すべて光らせると「なぼとういざくん」となります。",
    8: "月が満ち欠けしていきます。「つきみ」にするには、真ん中が「み？づき」になります。",
    9: "上部は「一富士二鷹三茄子」を表しています。下部の食べ物にまつわる「慣用句」思い出してみましょう。",
    10: "「黒黒・黒・・黒・」で点滅しています",
    11: "ボタンを押すと、16分割されたタイルが現れます。上部は「点が10個で酉(とり)」中部は「点が12個で亥(い)」を表しています。1か所消す必要があります。",
    12: "「西」や「サザン」は九九に登場するワードです。3か所消す必要があります。",
    13: "例示は「点の個数」になるように調節しましょう。7か所消す必要があります。「西」という漢字に注目",
    14: "1拍目は「水」、2拍目は「金」、4拍目は「火」5拍目は「木」を表しています。順序に注目してみましょう",
    15: "7色のバーがあります。それぞれの色と文字数を考えると、上から2番目は「オレンジ」4番目は「ミドリ」が当てはまります。点が反応する順序に注目してみましょう",
    16: "クリック回数を100回以内に抑える必要があります。効率的な選び方を考えましょう。"
};

let loopCount = 0;
let hintShown = false;

const STAGE_ANSWERS = {
    0: "ーーー",
    1: "ーーー",
    2: "ーーー",
    3: "カイトウ",
    4: "せんたく",
    5: "ーーー",
    6: "十",
    7: "ぼういん",
    8: "つきみ",
    9: "ーーー",
    10: "ーーー",
    11: "午(うま)",
    12: "インク",
    13: "七",
    14: "てんかい",
    15: "？？",
    16: "クリア",
    17: "THANK YOU FOR PLAYING"
};
// Twitter共有用の関数を更新
function shareToTwitter() {
    clickCounts.play++; // クリック回数を増やす
    const text = encodeURIComponent('「Do」をクリアした！\n#Do謎 #Player謎');
    const url = encodeURIComponent('https://twitter.com/Souchan917/status/1880596843299737622');
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
}

// エンディング画面の更新関数を修正
function updateProblemElements() {
    // Stage 17/18: end/secret clear pages
    if (currentStage === 17 || currentStage === 18) {
        const isSpecial = (currentStage === 18);
        const title = isSpecial ? 'SPECIAL CLEAR' : 'CLEAR';
        problemArea.innerHTML = `
            <div style="
                width: 100%; height: 100%; display: flex; flex-direction: column;
                align-items: center; justify-content: center; background: white;
                border-radius: 10px; padding: 20px; font-family: 'M PLUS Rounded 1c', sans-serif; color:#333;">
                <p style="font-size:16px; margin-bottom: 20px;">クリック数: ${clickCounts.getTotal()}回</p>
                <div style="font-size: 48px; font-weight: bold; margin-bottom: 30px;">${title}</div>
                <button onclick="shareToTwitter()" style="padding: 12px 24px; background-color: #1DA1F2; color: white; border: none; border-radius: 20px; font-size: 16px; cursor: pointer; font-family: 'M PLUS Rounded 1c', sans-serif; margin-top: 10px; z-index: 1000;">Xで共有</button>
            </div>
        `;
        const answerArea = document.querySelector('.answer-area');
        if (answerArea) {
            answerArea.innerHTML = `
                <p style="margin-bottom: 20px;">${isSpecial ? 'SPECIAL CLEAR' : 'CLEAR'}</p>
                <button onclick="shareToTwitter()" style="padding: 12px 24px; background-color: #1DA1F2; color: white; border: none; border-radius: 20px; font-size: 16px; cursor: pointer; font-family: 'M PLUS Rounded 1c', sans-serif; margin-top: 10px; z-index: 1000;">Xで共有</button>
            `;
        }
        return;
    }
    if (currentStage === 17) {
        // エンディング画面用の特別なレイアウト
        problemArea.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: white;
                border-radius: 10px;
                padding: 20px;
            ">
                <p style="
                    color: #333;
                    font-size: 16px;
                    margin-bottom: 20px;
                    font-family: 'M PLUS Rounded 1c', sans-serif;
                ">総クリック回数: ${clickCounts.getTotal()}回</p>
                
                <div style="
                    font-size: 48px;
                    font-weight: bold;
                    color: #333;
                    margin-bottom: 30px;
                    font-family: 'M PLUS Rounded 1c', sans-serif;
                ">CLEAR</div>
            </div>
        `;

        // answer-area を更新
        const answerArea = document.querySelector('.answer-area');
        if (answerArea) {
            answerArea.innerHTML = `
                <p style="margin-bottom: 20px;">クリアおめでとう！</p>
                <button 
                    onclick="shareToTwitter()"
                    style="
                        padding: 12px 24px;
                        background-color: #1DA1F2;
                        color: white;
                        border: none;
                        border-radius: 20px;
                        font-size: 16px;
                        cursor: pointer;
                        font-family: 'M PLUS Rounded 1c', sans-serif;
                        margin-top: 10px;
                        z-index: 1000;
                    "
                >
                    Xで共有
                </button>
            `;
        }
    } else {
        gimmickManager.updateGimmick(currentStage, currentTime);
        gimmickManager.hideAllExcept(currentStage);
    }
}

// answer-areaの更新関数も修正
function updateAnswer() {
    const answerArea = document.querySelector('.answer-area');
    if (!answerArea) return;
    
    answerArea.innerHTML = ''; // 一旦クリア

    const answerText = document.createElement('p');
    answerText.textContent = STAGE_ANSWERS[currentStage];
    answerArea.appendChild(answerText);
    
    // エンディング画面の場合
    if (currentStage === 17) {
        const shareButton = document.createElement('button');
        shareButton.textContent = 'Xで共有';
        shareButton.onclick = shareToTwitter;
        shareButton.style.cssText = `
            padding: 12px 24px;
            background-color: #1DA1F2;
            color: white;
            border: none;
            border-radius: 20px;
            font-size: 16px;
            cursor: pointer;
            font-family: 'M PLUS Rounded 1c', sans-serif;
            margin-top: 15px;
            z-index: 1000;
        `;
        
        answerArea.appendChild(shareButton);
    }
}

// stageSettings: per-stage configuration
// - dots: number of beats per loop
// - useLeftNext: whether left NEXT (NEXT1) is enabled/visible on this stage (default: true)
const stageSettings = {
    '-1': { dots: 8, useLeftNext: false },
    0: { dots: 8, useLeftNext: false},
    1: { dots: 4, useLeftNext: false },
    2: { dots: 4 },
    3: { dots: 8 },
    4: { dots: 8 },
    5: { dots: 4 },
    6: { dots: 8 },
    7: { dots: 4 },
    8: { dots: 8 },
    9: { dots: 4 },
    10: { dots: 8 },
    11: { dots: 16 },
    12: { dots: 16 },
    13: { dots: 16 },
    14: { dots: 8 },
    15: { dots: 8 },
    16: { dots: 16 },
    17: { dots: 8 }
};

function isLeftNextEnabledForStage(stage) {
    const s = stageSettings[stage];
    if (!s || typeof s.useLeftNext === 'undefined') return true; // default enabled
    return !!s.useLeftNext;
}
// correctPatterns now supports two formats per stage:
// - Legacy: array of beat numbers (e.g., [1,3,4]) meaning "press at those beats with any button".
// - Dual-button: { mode: 'dual', steps: ['none'|'left'|'right'|'both', ...] } per beat.
//   'left' corresponds to NEXT1 (red), 'right' to NEXT2 (blue), 'both' means both pressed during the beat.
const correctPatterns = {
    0: [1, 2, 3, 4, 5, 6, 7, 8],
    // Stage 1: 1st none, 2nd blue (right), 3rd red (left), 4th purple (both)
    1: [1, 2, 4],
    2: { mode: 'dual', steps: ['none', 'right', 'left', 'both'] },
    3: { mode: 'dual', steps: ['none', 'left', 'none', 'none', 'none', 'right', 'right', 'left'] },
    4: [1, 4, 5, 7],
    5: [5, 6, 7, 8],
    6: [1, 2, 5, 6, 7],
    7: [1, 3],
    8: [2],
    9: [1, 2, 3, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16],
    10: [1, 2, 4, 7],
    11: [13],
    12: [1, 5, 9],
    13: [1, 2, 3, 4, 5, 9, 13],
    14: [7, 8],
    15: [1, 6],
    16: [1, 2, 3, 4],
    17: [2, 4, 6, 8]
};

function _isDualPattern(p) {
    return p && typeof p === 'object' && p.mode === 'dual' && Array.isArray(p.steps);
}

function _getExpectedStepForBeat(stage, beatNumber) {
    const p = correctPatterns[stage];
    if (_isDualPattern(p)) {
        // steps are 1-based in beats
        return p.steps[beatNumber - 1] || 'none';
    }
    // Legacy: return whether this beat is expected (true/false)
    if (Array.isArray(p)) return p.includes(beatNumber);
    return false;
}

//====================================================
// シームレスループ用オーディオプレイヤー（Web Audio API）
//====================================================
class SeamlessLoopPlayer {
    constructor(url) {
        this.url = url;
        this.context = null;
        this.gainNode = null;
        this.analyser = null; // for visualizer
        this.buffer = null;
        this.source = null;
        this._volume = 0.7;
        this._isPlaying = false;
        this._startTime = 0;    // context currentTime at start
        this._offset = 0;       // seconds into buffer when stopped/paused
        this._loopStart = 0;
        this._loopEnd = 0;      // set after decode
        this._ready = null;     // Promise for decode
        this._prefetchedArrayBuffer = null; // AssetLoader から供給される ArrayBuffer を保持
    }

    get isReady() { return !!this.buffer; }

    async _ensureContext() {
        if (!this.context) {
            const AC = window.AudioContext || window.webkitAudioContext;
            this.context = new AC();
            this.gainNode = this.context.createGain();
            this.gainNode.gain.value = this._volume;
            // Create analyser for visualization (parallel connection)
            this.analyser = this.context.createAnalyser();
            this.analyser.fftSize = 1024;           // 低レイテンシ寄り
            this.analyser.smoothingTimeConstant = 0.72; // 追従性アップ（遅延減）
            try {
                this.analyser.minDecibels = -100;
                this.analyser.maxDecibels = -10;
            } catch (_) {}
            // Connect gain to both destination and analyser (no audible change)
            this.gainNode.connect(this.context.destination);
            this.gainNode.connect(this.analyser);
        }
        if (this.context.state === 'suspended') {
            try { await this.context.resume(); } catch (_) {}
        }
    }

    async _load() {
        if (this._ready) return this._ready;
        this._ready = (async () => {
            let arrayBuf = this._prefetchedArrayBuffer;
            if (!arrayBuf) {
                const res = await fetch(this.url);
                arrayBuf = await res.arrayBuffer();
            }
            await this._ensureContext();
            const buffer = await this.context.decodeAudioData(arrayBuf.slice(0));
            this.buffer = buffer;
            const { loopStart, loopEnd } = SeamlessLoopPlayer._detectLoopPoints(buffer);
            this._loopStart = loopStart;
            this._loopEnd = loopEnd;
            this._prefetchedArrayBuffer = null; // 使い終わったら解放
        })();
        return this._ready;
    }

    // 事前にフェッチ済みの ArrayBuffer を提供（ユーザー操作後の初期化で使用）
    provideArrayBuffer(arrayBuffer) {
        if (arrayBuffer && arrayBuffer.byteLength > 0) {
            this._prefetchedArrayBuffer = arrayBuffer;
            // 既に別の _ready が走っている最中は触らない
        }
    }

    static _detectLoopPoints(buffer) {
        const sr = buffer.sampleRate;
        const ch = buffer.numberOfChannels;
        const len = buffer.length;
        const thresh = 0.0005;
        let first = 0;
        let last = len - 1;

        outerHead:
        for (let i = 0; i < len; i++) {
            for (let c = 0; c < ch; c++) {
                if (Math.abs(buffer.getChannelData(c)[i]) > thresh) { first = i; break outerHead; }
            }
        }
        outerTail:
        for (let i = len - 1; i >= 0; i--) {
            for (let c = 0; c < ch; c++) {
                if (Math.abs(buffer.getChannelData(c)[i]) > thresh) { last = i; break outerTail; }
            }
        }
        let loopStart = Math.max(0, (first / sr) - 0.001);
        let loopEnd = Math.min(buffer.duration, ((last + 1) / sr) + 0.001);
        if (!(loopEnd > loopStart + 0.01)) {
            loopStart = 0;
            loopEnd = buffer.duration;
        }
        return { loopStart, loopEnd };
    }

    _createSource(startOffsetSec) {
        if (!this.buffer) return;
        const src = this.context.createBufferSource();
        src.buffer = this.buffer;
        src.loop = true;
        src.loopStart = this._loopStart;
        src.loopEnd = this._loopEnd || this.buffer.duration;
        src.connect(this.gainNode);
        const offset = this._wrapToLoop(startOffsetSec);
        src.start(0, offset);
        this._startTime = this.context.currentTime - offset;
        this.source = src;
    }

    _wrapToLoop(sec) {
        const start = this._loopStart;
        const end = this._loopEnd || (this.buffer ? this.buffer.duration : 0);
        const span = Math.max(0.001, end - start);
        let rel = sec - start;
        rel = ((rel % span) + span) % span;
        return start + rel;
    }

    async play() {
        await this._ensureContext();
        await this._load();
        if (this._isPlaying) return;
        const v = this._volume;
        this.gainNode.gain.cancelScheduledValues(this.context.currentTime);
        this.gainNode.gain.setValueAtTime(0, this.context.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(v, this.context.currentTime + 0.03);
        this._createSource(this._offset);
        this._isPlaying = true;
    }

    pause() {
        if (!this._isPlaying) return;
        const now = this.context.currentTime;
        const t = now - this._startTime;
        const dur = this.duration;
        const rel = dur > 0 ? (t % dur) : 0;
        this._offset = this._loopStart + rel;
        try {
            this.gainNode.gain.cancelScheduledValues(this.context.currentTime);
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.context.currentTime);
            this.gainNode.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.02);
        } catch (_) {}
        try { this.source && this.source.stop(); } catch (_) {}
        try { this.source && this.source.disconnect(); } catch (_) {}
        this.source = null;
        this._isPlaying = false;
    }

    async _repositionPlayingSource() {
        if (!this._isPlaying) return;
        await this._ensureContext();
        await this._load();
        const v = this._volume;
        const now = this.context.currentTime;
        try {
            // quick fade-out
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
            this.gainNode.gain.linearRampToValueAtTime(0, now + 0.005);
        } catch(_) {}
        try { this.source && this.source.stop(now + 0.006); } catch(_) {}
        try { this.source && this.source.disconnect(); } catch(_) {}
        this.source = null;
        // start new source at requested offset
        this._createSource(this._offset);
        try {
            // quick fade-in
            const t = this.context.currentTime;
            this.gainNode.gain.setValueAtTime(0, t);
            this.gainNode.gain.linearRampToValueAtTime(v, t + 0.01);
        } catch(_) {}
    }

    get currentTime() {
        if (!this.buffer) return Math.max(0, (this._offset || 0) - this._loopStart);
        if (!this._isPlaying) return this._wrapToLoop(this._offset) - this._loopStart;
        const now = this.context.currentTime;
        const t = now - this._startTime;
        return this._wrapToLoop(t) - this._loopStart;
    }

    set currentTime(sec) {
        this._offset = this._loopStart + Math.max(0, sec);
        if (this._isPlaying) {
            // reposition without pausing globally
            this._repositionPlayingSource();
        }
    }

    get duration() {
        if (!this.buffer) return 0;
        const start = this._loopStart;
        const end = this._loopEnd || this.buffer.duration;
        return Math.max(0, end - start);
    }

    get volume() { return this._volume; }
    set volume(v) {
        this._volume = Math.max(0, Math.min(1, v));
        if (this.gainNode) this.gainNode.gain.value = this._volume;
    }

    // Switch to a new audio URL (arrayBuffer optional). If playing, crossfade quickly at loop boundary.
    async switchTo(url, arrayBuffer) {
        await this._ensureContext();
        // quick fade-out current
        try {
            const now = this.context.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
            this.gainNode.gain.linearRampToValueAtTime(0, now + 0.02);
        } catch (_) {}
        try { this.source && this.source.stop(); } catch (_) {}
        try { this.source && this.source.disconnect(); } catch (_) {}
        this.source = null;

        // load new buffer
        this.url = url;
        this._ready = null;
        this.buffer = null;
        this._prefetchedArrayBuffer = arrayBuffer || this._prefetchedArrayBuffer || null;
        await this._load();

        // start from loop start
        this._offset = this._loopStart;
        const v = this._volume;
        this._createSource(this._offset);
        try {
            const t = this.context.currentTime;
            this.gainNode.gain.setValueAtTime(0, t);
            this.gainNode.gain.linearRampToValueAtTime(v, t + 0.03);
        } catch (_) {}
        this._isPlaying = true;
    }

    // Schedule a switch to a different audio buffer exactly at the loop boundary (no fade)
    async scheduleSwitchAtLoopEnd(url, arrayBuffer, onSwitched) {
        if (!this._isPlaying) {
            // if not playing, just switch buffer without playing
            this.url = url;
            this._ready = null;
            this.buffer = null;
            this._prefetchedArrayBuffer = arrayBuffer || null;
            return;
        }
        await this._ensureContext();
        // decode next buffer
        let nextBuffer = null;
        if (arrayBuffer) {
            nextBuffer = await this.context.decodeAudioData(arrayBuffer.slice(0));
        } else {
            const res = await fetch(url);
            const ab = await res.arrayBuffer();
            nextBuffer = await this.context.decodeAudioData(ab.slice(0));
        }
        const pts = SeamlessLoopPlayer._detectLoopPoints(nextBuffer);
        const now = this.context.currentTime;
        const timeInLoop = this.currentTime; // seconds within current loop span
        const remain = Math.max(0.001, (this.duration || 0) - (timeInLoop || 0));
        const tSwitch = now + remain;

        // prepare next source
        const nextSrc = this.context.createBufferSource();
        nextSrc.buffer = nextBuffer;
        nextSrc.loop = true;
        nextSrc.loopStart = pts.loopStart;
        nextSrc.loopEnd = pts.loopEnd || nextBuffer.duration;
        nextSrc.connect(this.gainNode);

        // schedule start/stop at exact boundary
        try { this.source && this.source.stop(tSwitch); } catch (_) {}
        try { nextSrc.start(tSwitch, pts.loopStart); } catch (_) {}

        // swap state at switch time
        this.url = url;
        this.buffer = nextBuffer;
        this._loopStart = pts.loopStart;
        this._loopEnd = pts.loopEnd;
        this._startTime = tSwitch - pts.loopStart;
        this.source = nextSrc;
        this._isPlaying = true;

        if (typeof onSwitched === 'function') {
            setTimeout(() => { try { onSwitched(); } catch(_) {} }, Math.ceil(remain * 1000) + 10);
        }
    }
}
//====================================================
// ゲーム状態管理
//====================================================
let isPlaying = false;
let currentTime = 0;
let currentStage = -1;
let clearedStages = new Set();
let currentBeatProgress = 0;
// previous loop progress [0..1). Used to detect exact visual loop wrap
let lastLoopProgress = 0;
let selectedBeats = new Set();
// Track which NEXT pressed per beat for color (left=NEXT1, right=NEXT2)
let selectedBeatsLeft = new Set();
let selectedBeatsRight = new Set();
let lastBeat = -1;
let isLoopComplete = false;

// --- Hidden clear (stage18) control state ---
const HIDDEN_CLEAR_THRESHOLD_SEC = 180; // 3 minutes
let tutorialNoNextTimerSec = 0;
let tutorialNoNextLastTs = null;
let tutorialNoNextTriggered = false;
let tutorialNextPressed = false; // becomes true if NEXT pressed on stage 0

const MORSE_CODE_MAP = {
    '.-': 'A',
    '-...': 'B',
    '-.-.': 'C',
    '-..': 'D',
    '.': 'E',
    '..-.': 'F',
    '--.': 'G',
    '....': 'H',
    '..': 'I',
    '.---': 'J',
    '-.-': 'K',
    '.-..': 'L',
    '--': 'M',
    '-.': 'N',
    '---': 'O',
    '.--.': 'P',
    '--.-': 'Q',
    '.-.': 'R',
    '...': 'S',
    '-': 'T',
    '..-': 'U',
    '...-': 'V',
    '.--': 'W',
    '-..-': 'X',
    '-.--': 'Y',
    '--..': 'Z',
    '-----': '0',
    '.----': '1',
    '..---': '2',
    '...--': '3',
    '....-': '4',
    '.....': '5',
    '-....': '6',
    '--...': '7',
    '---..': '8',
    '----.': '9'
};

const stage16MorseState = {
    isActive: false,
    currentBeatSymbol: null,
    currentPattern: '',
    decodedText: '',
    displayText: ''
};

const stage5InputImageState = {
    side: null
};

function stage16UpdateDisplayText() {
    if (!stage16MorseState.isActive) {
        stage16MorseState.displayText = '';
        return;
    }
    let preview = '';
    if (stage16MorseState.currentBeatSymbol === 'invalid') {
        preview = '?';
    } else {
        let pattern = stage16MorseState.currentPattern || '';
        if (stage16MorseState.currentBeatSymbol === 'dash') {
            pattern += '-';
        } else if (stage16MorseState.currentBeatSymbol === 'dot') {
            pattern += '.';
        }
        if (pattern) {
            preview = MORSE_CODE_MAP[pattern] || '?';
        }
    }
    stage16MorseState.displayText = (stage16MorseState.decodedText || '') + (preview || '');
}

function stage16SetActive(active) {
    if (active) {
        stage16MorseState.isActive = true;
        stage16MorseState.currentBeatSymbol = null;
        stage16MorseState.currentPattern = '';
        stage16MorseState.decodedText = '';
        stage16UpdateDisplayText();
        return;
    }

    if (!stage16MorseState.isActive) return;
    if (stage16MorseState.currentBeatSymbol !== null) {
        stage16ProcessCurrentBeat();
    }
    stage16FinalizePattern(true);
    stage16MorseState.isActive = false;
    stage16MorseState.currentBeatSymbol = null;
    stage16MorseState.currentPattern = '';
    stage16MorseState.decodedText = '';
    stage16UpdateDisplayText();
}

function stage16RegisterInput(symbol) {
    if (!stage16MorseState.isActive) return;
    const current = stage16MorseState.currentBeatSymbol;
    if (current === null) {
        stage16MorseState.currentBeatSymbol = symbol;
    } else if (current !== symbol) {
        stage16MorseState.currentBeatSymbol = 'invalid';
    }
    stage16UpdateDisplayText();
}

function stage16ProcessCurrentBeat() {
    if (!stage16MorseState.isActive) return;
    const symbol = stage16MorseState.currentBeatSymbol;
    if (symbol === 'dash') {
        stage16MorseState.currentPattern += '-';
    } else if (symbol === 'dot') {
        stage16MorseState.currentPattern += '.';
    } else if (symbol === 'invalid') {
        stage16MorseState.currentPattern = '';
    } else {
        stage16FinalizePattern(false);
    }
    stage16MorseState.currentBeatSymbol = null;
    stage16UpdateDisplayText();
}

function stage16FinalizePattern(forceFinalize) {
    if (!stage16MorseState.currentPattern) return;
    const letter = MORSE_CODE_MAP[stage16MorseState.currentPattern] || '?';
    stage16MorseState.decodedText += letter;
    stage16MorseState.currentPattern = '';
    stage16UpdateDisplayText();
}

function stage16HandleTiming(beatChanged, loopWrapped) {
    if (!stage16MorseState.isActive) return;
    if (beatChanged) {
        stage16ProcessCurrentBeat();
    }
    if (loopWrapped) {
        stage16FinalizePattern(true);
        stage16MorseState.currentPattern = '';
        stage16MorseState.currentBeatSymbol = null;
        stage16MorseState.decodedText = '';
        stage16UpdateDisplayText();
    }
}
let isHolding = false;
let holdStartBeat = -1;
const audio = new SeamlessLoopPlayer(AUDIO_URLS.test);
// Apply code-defined volume for initial track
try { audio.volume = (typeof TRACK_VOLUMES.test === 'number') ? TRACK_VOLUMES.test : 0.7; } catch(_) {}

// Seamless stage/audio switching state
// removed pending switch polling; use scheduled switch instead

//====================================================
// 背景オーディオビジュアライザー
//====================================================
class BackgroundVisualizer {
    constructor(player, canvas) {
        this.player = player;
        this.canvas = canvas || document.getElementById('bgVisualizer');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.running = false;
        this.rafId = null;
        this.freqData = null;
        this.display = null; // smoothed heights [0..1]
        this.barCountTarget = 30; // 約50本
        this.barCount = this.barCountTarget;
        this.devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
        this.color = '#fff';
        // 描画する縦方向の範囲（上端=0, 下端=1）
        this.topRatio = 0.00;    // 上から5%
        this.bottomRatio = 1.00; // 下から5%
        // 解析用の周波数レンジ（0=低域,1=高域）
        this.range = [0, 1];
        // 最低高さ: 再生中/停止中（停止中は1/5）
        this.minPlaying = 0.05;
        this.minIdle = 0.012;
        // 全体高さスケール（1.0で等倍）
        this.heightScale = 1.0;
        // 各帯域の独立スケーリング用パラメータ
        this.peaks = null; this.peakDecay = 0.993; this.gainGamma = 1.6; this.topCurve = 1.4; this.fall = 0.90; this.attack = 0.25; this.direction = 'lowLeft';
        // Ensure analyser is configured for minimal latency if already available
        this._analyserConfigured = false;
        try {
            if (this.player && this.player.analyser) {
                this.player.analyser.fftSize = 256;
                this.player.analyser.smoothingTimeConstant = 0.0;
                this._analyserConfigured = true;
            }
        } catch (_) {}
        this._resizeHandler = () => this._resize();
        if (this.canvas) {
            this._resize();
            window.addEventListener('resize', this._resizeHandler);
        }
    }

    destroy() {
        this.stop();
        window.removeEventListener('resize', this._resizeHandler);
    }

    _resize() {
        if (!this.canvas) return;
        const dpr = this.devicePixelRatio;
        const rect = this.canvas.getBoundingClientRect();
        // Match internal size to CSS size for crisp rendering
        const w = Math.max(1, Math.floor(rect.width * dpr));
        const h = Math.max(1, Math.floor(rect.height * dpr));
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
        // 固定本数
        this.barCount = this.barCountTarget;
        this.display = new Float32Array(this.barCount);
        this.peaks = new Float32Array(this.barCount);
        for (let i = 0; i < this.barCount; i++) this.peaks[i] = 0.25;
    }

    setRange(startRatio, endRatio) {
        const s = Math.max(0, Math.min(1, startRatio));
        const e = Math.max(0, Math.min(1, endRatio));
        this.range = [Math.min(s, e), Math.max(s, e)];
    }

    // 縦方向の描画範囲を設定（0=上, 1=下）。例: setVerticalBounds(0.1, 0.9)
    setVerticalBounds(topRatio, bottomRatio) {
        const t = Math.max(0, Math.min(1, topRatio));
        const b = Math.max(0, Math.min(1, bottomRatio));
        this.topRatio = Math.min(t, b);
        this.bottomRatio = Math.max(t, b);
    }

    // CSSピクセル指定で上下を設定（キャンバス上部からのpx）
    setVerticalPixels(topPx, bottomPx) {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const t = (typeof topPx === 'number') ? topPx / Math.max(1, rect.height) : 0;
        const b = (typeof bottomPx === 'number') ? bottomPx / Math.max(1, rect.height) : 1;
        this.setVerticalBounds(t, b);
    }

    // 全体高さスケール（0〜2程度）
    setHeightScale(scale) {
        const s = Number(scale);
        if (!isNaN(s) && isFinite(s)) {
            this.heightScale = Math.max(0, s);
        }
    }

    updateColorForStage(stage) {
        if (stage === 16) {
            this.color = '#000';
            return;
        }
        try {
            const bg = getComputedStyle(document.body).backgroundColor || 'rgb(0,0,0)';
            const rgb = bg.match(/\d+/g).map(Number);
            const [r, g, b] = rgb.length >= 3 ? rgb : [0, 0, 0];
            const { h, s, l } = BackgroundVisualizer._rgbToHsl(r, g, b);
            // 濃い色: 彩度を高めて明度を少し下げる（視認性も確保）
            const s2 = Math.min(1, s * 0.9 + 0.25);
            const l2 = Math.min(0.55, Math.max(0.28, l * 0.65 + 0.06));
            const { r: rr, g: gg, b: bb } = BackgroundVisualizer._hslToRgb(h, s2, l2);
            this.color = `rgb(${Math.round(rr)}, ${Math.round(gg)}, ${Math.round(bb)})`;
        } catch (_) {
            this.color = '#ffffff';
        }
    }

    static _rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) { h = 0; s = 0; }
        else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                default: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h, s, l };
    }

    static _hue2rgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    }

    static _hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) { r = g = b = l; }
        else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = BackgroundVisualizer._hue2rgb(p, q, h + 1/3);
            g = BackgroundVisualizer._hue2rgb(p, q, h);
            b = BackgroundVisualizer._hue2rgb(p, q, h - 1/3);
        }
        return { r: r * 255, g: g * 255, b: b * 255 };
    }

    start() {
        if (!this.ctx || !this.player) return;
        if (this.running) return;
        this.running = true;
        const loop = () => {
            if (!this.running) return;
            this._draw();
            this.rafId = requestAnimationFrame(loop);
        };
        loop();
    }

    stop() {
        this.running = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }

    _ensureFreqBuffer() {
        const analyser = this.player && this.player.analyser;
        if (analyser && !this._analyserConfigured) {
            try {
                analyser.fftSize = 512;
                analyser.smoothingTimeConstant = 0.0;
            } catch (_) {}
            this._analyserConfigured = true;
        }
        if (analyser && (!this.freqData || this.freqData.length !== analyser.frequencyBinCount)) {
            this.freqData = new Uint8Array(analyser.frequencyBinCount);
        }
        return analyser;
    }

    _draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        if (!w || !h) return;

        // Clear background fully transparent, let page bg show through
        ctx.clearRect(0, 0, w, h);

        const analyser = this._ensureFreqBuffer();
        if (!analyser) return;

        analyser.getByteFrequencyData(this.freqData);
        const binCount = this.freqData.length;
        // 選択レンジにトリム
        const startBin = Math.floor(binCount * this.range[0]);
        const endBin = Math.max(startBin + 1, Math.floor(binCount * this.range[1]));
        const useBins = endBin - startBin;
        // Aggregate bins -> bars (independent per band)
        const bars = this.barCount;
        const step = useBins / bars;
        if (!this.peaks || this.peaks.length !== bars) {
            this.peaks = new Float32Array(bars);
            for (let i = 0; i < bars; i++) this.peaks[i] = 0.25;
            if (!this.display || this.display.length !== bars)
                this.display = new Float32Array(bars);
        }
        const gamma = this.gainGamma || 1.6;
        const topCurve = this.topCurve || 1.4;
        const decay = this.peakDecay || 0.993;
        const fall = this.fall || 0.8;
        for (let i = 0; i < bars; i++) {
            const idx = (this.direction === 'lowLeft') ? i : (bars - 1 - i);
            const start = startBin + Math.floor(idx * step);
            const end = startBin + Math.floor((idx + 1) * step);
            let sum = 0, count = 0;
            for (let b = start; b < end; b++) {
                // Slight high-frequency weighting for perceptual balance
                const wHigh = Math.pow((b + 1) / binCount, 0.6) * 0.7 + 0.3;
                sum += (this.freqData[b] / 255) * wHigh;
                count++;
            }
            const raw = count ? (sum / count) : 0;
            // 1) compress highs so bars are harder to reach top
            const comp = Math.pow(raw, gamma);
            // 2) per-band peak tracking for independent normalization
            const prevPeak = this.peaks[i] || 0.25;
            const newPeak = Math.max(comp, prevPeak * decay);
            this.peaks[i] = newPeak;
            let n = newPeak > 1e-4 ? (comp / newPeak) : comp;
            // 3) additional top curve to further prevent overshoot
            n = Math.pow(n, topCurve);
            // 4) per-band attack/fall smoothing + floor
            const minBase = (this.player && this.player._isPlaying) ? this.minPlaying : this.minIdle;
            n = Math.max(minBase, Math.min(0.98, n));
            const prev = this.display[i] || 0;
            const up = (this.attack || 0.12);
            let next;
            if (n >= prev) {
                // 上りは重く（遅く）追従させる
                next = prev + up * (n - prev);
            } else {
                // 下りはフォール（指数的）で素早く落とす
                next = prev * fall + (1 - fall) * n;
            }
            this.display[i] = Math.max(minBase, Math.min(0.995, next));
        }
        // Draw bars within vertical bounds (topRatio..bottomRatio)
        ctx.fillStyle = this.color;
        const topY = Math.floor(h * Math.max(0, Math.min(1, this.topRatio)));
        const bottomY = Math.floor(h * Math.max(0, Math.min(1, this.bottomRatio)));
        const areaH = Math.max(1, bottomY - topY);
        const barW = w / bars;
        for (let i = 0; i < bars; i++) {
            const val = this.display[i];
            const bh = Math.max(1, Math.floor(val * areaH * (this.heightScale || 1)));
            const x = Math.floor(i * barW);
            const y = bottomY - bh; // baseline = bottomY
            // ensure we cover exactly without gaps between x and next bar
            const nextX = Math.floor((i + 1) * barW);
            const width = Math.max(1, nextX - x);
            ctx.fillRect(x, y, width, Math.min(bh, areaH));
        }
    }
}

let bgVisualizer = null;

//====================================================
// ギミック管理クラス
//====================================================
class GimmickManager {
    constructor() {
        this.elements = new Map();
        this.activeWallImages = new Map();
    }

    createGimmickElement(stageId, gimmickIndex) {
        const config = STAGE_CONFIGS[stageId]?.gimmicks[gimmickIndex];
        if (!config) return null;

        const element = document.createElement('div');
        element.className = 'problem-element';
        element.id = `gimmick-${stageId}-${gimmickIndex}`;
        

        if (config.type === GIMMICK_TYPES.NUMBER_TEXT) {
            const container = document.createElement('div');
            container.style.position = 'relative';
            container.style.width = '100%';
            container.style.height = '100%';
            
            // 各単語用のコンテナを作成
            config.settings.words.forEach((word, wordIndex) => {
                const wordContainer = document.createElement('div');
                wordContainer.className = 'number-text-word';
                wordContainer.style.position = 'absolute';
                
                // 文字を1つずつ作成
                const chars = word.text.split('');
                chars.forEach((char, charIndex) => {
                    const charElement = document.createElement('span');
                    charElement.className = 'number-text-char';
                    // 特殊文字（#）は一時的に空白に
                    charElement.textContent = char === '#' ? '' : char;
                    wordContainer.appendChild(charElement);
                });
                
                container.appendChild(wordContainer);
            });
            
            element.appendChild(container);
        }
        if (config.type === GIMMICK_TYPES.IMAGE_SEQUENCE) {
            const img = document.createElement('img');
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            element.appendChild(img);
        }

        if (config.type === GIMMICK_TYPES.DOT_COUNTER) {
            const container = document.createElement('div');
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.display = 'flex';
            container.style.justifyContent = 'center';
            container.style.alignItems = 'center';
            element.appendChild(container);
        }

        if (config.type === GIMMICK_TYPES.MORSE_DISPLAY) {
            element.style.display = 'flex';
            element.style.flexDirection = 'column';
            element.style.alignItems = 'center';
            element.style.justifyContent = 'center';
            element.style.textAlign = 'center';
            element.style.fontFamily = "'M PLUS Rounded 1c', sans-serif";
            const textEl = document.createElement('div');
            textEl.className = 'morse-display-text';
            textEl.style.fontWeight = '700';
            element.appendChild(textEl);
        }

        if (config.type === GIMMICK_TYPES.INPUT_IMAGE) {
            element.style.pointerEvents = 'none';
            const img = document.createElement('img');
            img.className = 'input-image-display';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.objectFit = 'contain';
            img.style.opacity = '0';
            img.dataset.currentSrc = '';
            element.appendChild(img);
        }

        if (config.type === GIMMICK_TYPES.ROTATE_TILES) {
            // Container keeps children absolutely positioned
            element.style.position = 'absolute';
            element.style.overflow = 'hidden';
            // Build tile wrappers + images
            const images = (config.settings && config.settings.images) || [];
            const tiles = [];
            const imgs = [];
            // Resolve default rotations: number or array
            const defRot = config.settings && config.settings.defaultRotation;
            const defArray = Array.isArray(defRot) ? defRot : [defRot, defRot, defRot, defRot];
            for (let i = 0; i < images.length; i++) {
                const tile = document.createElement('div');
                tile.className = 'rotate-tile';
                tile.style.position = 'absolute';
                tile.style.transform = 'translate(-50%, -50%)';
                const img = document.createElement('img');
                img.src = images[i];
                img.alt = `tile-${i}`;
                img.draggable = false;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                img.style.transition = 'transform 0.25s ease-in-out';
                tile.appendChild(img);
                element.appendChild(tile);
                tiles.push(tile);
                imgs.push(img);
            }
            // Internal state stored on element
            const defaultAngles = imgs.map((_, idx) => {
                const v = defArray[idx];
                return Number.isFinite(v) ? Number(v) : 0;
            });
            const angles = defaultAngles.slice();
            const hidden = imgs.map(() => false);
            const processedBeats = new Set(); // beats processed in this loop (prevent multiple rotations per beat)
            element._rotateTiles = { tiles, imgs, angles, hidden, defaultAngles, processedBeats };
        }

        if (config.type === GIMMICK_TYPES.RHYTHM_DOTS) {
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.width = '100%';
            container.style.height = '100%';
            
            // 各ドットの作成
            config.settings.dots.forEach((_, index) => {
                const dot = document.createElement('div');
                dot.className = 'rhythm-dot-in-puzzle';
                dot.style.position = 'absolute';
                container.appendChild(dot);
            });
            
            element.appendChild(container);
        }

        if (config.type === GIMMICK_TYPES.VERTICAL_LINES) {
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.width = '100%';
            container.style.height = '100%';

            const beats = (config.settings && config.settings.beats) || [];
            beats.forEach(beatCfg => {
                // legacy lines (visible by general selection or stage rule)
                (beatCfg.lines || []).forEach((_, lineIdx) => {
                    const line = document.createElement('div');
                    line.className = 'dakuten-line';
                    line.style.position = 'absolute';
                    line.dataset.beat = String(beatCfg.beat);
                    line.dataset.which = String(lineIdx);
                    line.dataset.side = 'legacy';
                    container.appendChild(line);
                });

                // left-only lines (triggered by LEFT NEXT)
                (beatCfg.leftLines || []).forEach((_, lineIdx) => {
                    const line = document.createElement('div');
                    line.className = 'dakuten-line';
                    line.style.position = 'absolute';
                    line.dataset.beat = String(beatCfg.beat);
                    line.dataset.which = String(lineIdx);
                    line.dataset.side = 'left';
                    container.appendChild(line);
                });

                // right-only lines (triggered by RIGHT NEXT)
                (beatCfg.rightLines || []).forEach((_, lineIdx) => {
                    const line = document.createElement('div');
                    line.className = 'dakuten-line';
                    line.style.position = 'absolute';
                    line.dataset.beat = String(beatCfg.beat);
                    line.dataset.which = String(lineIdx);
                    line.dataset.side = 'right';
                    container.appendChild(line);
                });
            });

            element.appendChild(container);
        }

        if (config.type === GIMMICK_TYPES.LINES_ARCS) {
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.width = '100%';
            container.style.height = '100%';

            // One full-size SVG to draw arcs
            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            svg.style.position = 'absolute';
            svg.style.left = '0';
            svg.style.top = '0';
            svg.style.pointerEvents = 'none';

            const beats = (config.settings && config.settings.beats) || [];
            beats.forEach(beatCfg => {
                // arcs
                (beatCfg.arcs || []).forEach((arcCfg, arcIdx) => {
                    const path = document.createElementNS(svgNS, 'path');
                    path.setAttribute('fill', 'none');
                    path.setAttribute('stroke', arcCfg.color || '#111');
                    path.dataset.beat = String(beatCfg.beat);
                    path.dataset.which = `arc-${arcIdx}`;
                    path.style.opacity = '0';
                    svg.appendChild(path);
                });
            });

            container.appendChild(svg);

            // lines (reuse vertical line element structure)
            beats.forEach(beatCfg => {
                (beatCfg.lines || []).forEach((_, lineIdx) => {
                    const line = document.createElement('div');
                    line.className = 'shape-line';
                    line.style.position = 'absolute';
                    line.dataset.beat = String(beatCfg.beat);
                    line.dataset.which = `line-${lineIdx}`;
                    container.appendChild(line);
                });
            });

            element.appendChild(container);
        }

        if (config.type === GIMMICK_TYPES.LYRICS) {
            // テキストを入れるコンテナ
            const textWrap = document.createElement('div');
            textWrap.className = 'lyrics-wrap';
            textWrap.style.position = 'absolute';
            textWrap.style.left = '50%';
            textWrap.style.top = '50%';
            textWrap.style.transform = 'translate(-50%, -50%)';
            textWrap.style.width = '100%';
            textWrap.style.height = '100%';
            textWrap.style.display = 'flex';
            textWrap.style.flexDirection = 'column';
            textWrap.style.justifyContent = 'center';
            textWrap.style.alignItems = 'center';
            textWrap.style.pointerEvents = 'none';
            // Use a lyric-friendly Mincho font
            textWrap.style.fontFamily = "'Shippori Mincho', 'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', 'Hiragino Mincho', 'MS Mincho', serif";
            element.appendChild(textWrap);
        }

        problemArea.appendChild(element);
        this.elements.set(`${stageId}-${gimmickIndex}`, element);
        return element;
    }

    _countSelectedDotsInRange(start, end) {
        let count = 0;
        for (let i = start; i <= end; i++) {
            if (selectedBeats.has(i)) {
                count++;
            }
        }
        return count;
    }

    _generateDotCounterText(count, baseNumber) {
        return baseNumber + '0'.repeat(count);
    }

    _setupTextStyles(element, size) {
        element.style.fontSize = `${size * 0.5}px`;
        element.style.lineHeight = `${size}px`;
        element.style.textAlign = 'center';
        element.style.display = 'flex';
        element.style.justifyContent = 'center';
        element.style.alignItems = 'center';
        element.style.fontFamily = "'M PLUS Rounded 1c', sans-serif";
    }

    _updateTimerGimmick(element, currentTime) {
        element.textContent = formatTime(currentTime);
    }

    _updateHiraganaGimmick(element, config, currentTime) {
        const charIndex = Math.floor(currentTime / config.settings.changeInterval) % config.settings.characters.length;
        element.textContent = config.settings.characters[charIndex];
    }

    _updateImageSequenceGimmick(element, config, currentTime) {
        const img = element.querySelector('img');
        if (img) {
            const imageIndex = Math.floor(currentTime / config.settings.changeInterval) % config.settings.images.length;
            const imagePath = config.settings.images[imageIndex];
            if (img.src !== imagePath) {
                img.src = imagePath;
            }
        }
    }

    _updateWallImageGimmick(element, config) {
        selectedBeats.forEach(beatNumber => {
            if (!this.activeWallImages.has(beatNumber)) {
                const imageElement = document.createElement('img');
                imageElement.src = config.settings.images[beatNumber - 1];
                imageElement.style.position = 'absolute';
                imageElement.style.top = '0';
                imageElement.style.left = '0';
                imageElement.style.width = '100%';
                imageElement.style.height = '100%';
                imageElement.style.objectFit = 'cover';
                imageElement.style.zIndex = '1';
                element.appendChild(imageElement);
                this.activeWallImages.set(beatNumber, imageElement);
            }
        });

        if (isLoopComplete) {
            this.activeWallImages.forEach(img => img.remove());
            this.activeWallImages.clear();
        }
    }

    _updateDynamicTextGroupGimmick(element, config, size, scaleFactor) {
        const textSize = size * scaleFactor;
        const textGroupContainer = element;
        textGroupContainer.style.display = 'flex';
        textGroupContainer.style.flexDirection = 'row';
        textGroupContainer.style.justifyContent = 'center';
        textGroupContainer.style.alignItems = 'center';
        textGroupContainer.style.width = '100%';
        textGroupContainer.style.gap = `${config.settings.spacing}px`;

        config.settings.characters.forEach((char, charIndex) => {
            let charElement = textGroupContainer.children[charIndex];
            if (!charElement) {
                charElement = document.createElement('div');
                charElement.className = 'dynamic-text-char';
                textGroupContainer.appendChild(charElement);
            }

            const isSelected = selectedBeats.has(char.dotIndex + 1);
            charElement.textContent = isSelected ? char.selectedChar : char.defaultChar;
            charElement.style.fontSize = `${textSize * 0.6}px`;
        });
    }

    _updateLyricsGimmick(element, config, size, scaleFactor) {
        const settings = config.settings || {};
        const fontSize = (settings.fontSize ? settings.fontSize * scaleFactor : size * 0.15);
        const lineHeight = settings.lineHeight || 1.3;
        const color = settings.color || '#111';
        const align = settings.align || 'center';
        const mode = settings.displayMode || 'accumulate'; // 'accumulate' or 'current'
        const autoStep = settings.autoStep != null ? settings.autoStep : 2.5; // 秒
        const autoStartAt = settings.autoStartAt != null ? settings.autoStartAt : 0;
        const defaultDuration = settings.lineDuration != null ? settings.lineDuration : 2.5;

        let rawLines = settings.lines || settings.lyrics || [];
        // 正規化: { text, start, end }
        const entries = rawLines.map((entry, idx) => {
            if (typeof entry === 'string') {
                const start = autoStartAt + idx * autoStep;
                return { text: entry, start, end: start + defaultDuration };
            }
            const start = entry.start != null ? entry.start : (autoStartAt + idx * autoStep);
            const end = entry.end != null ? entry.end : (start + defaultDuration);
            return { text: entry.text, start, end };
        });

        // 表示する行を決定
        let visible = [];
        if (mode === 'accumulate') {
            visible = entries.filter(e => currentTime >= e.start).map(e => e.text);
        } else {
            // 現在行のみ（該当なしなら直前の行）
            const current = entries.find(e => currentTime >= e.start && currentTime < e.end);
            if (current) {
                visible = [current.text];
            } else {
                const prev = entries.filter(e => currentTime >= e.start).pop();
                if (prev) visible = [prev.text];
            }
        }

        const wrap = element.querySelector('.lyrics-wrap');
        if (!wrap) return;

        // スタイル
        wrap.style.textAlign = align;
        wrap.style.color = color;
        wrap.style.gap = `${Math.round(fontSize * (lineHeight - 1))}px`;

        // レイアウトに合わせてフォント反映
        // 既存をクリアして描画（シンプル実装）
        wrap.innerHTML = '';
        visible.forEach(line => {
            const p = document.createElement('div');
            p.textContent = line;
            p.style.fontSize = `${fontSize}px`;
            p.style.lineHeight = `${lineHeight}`;
            p.style.fontFamily = "'Shippori Mincho', 'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', 'Hiragino Mincho', 'MS Mincho', serif";
            p.style.fontWeight = '700';
            // 行の最大横幅を要素幅に合わせる
            p.style.maxWidth = '90%';
            p.style.textAlign = align;
            wrap.appendChild(p);
        });
    }

    _updateMorseDisplayGimmick(element, config, size) {
        const textEl = element.querySelector('.morse-display-text');
        if (!textEl) return;
        const settings = config.settings || {};
        const fontScale = (typeof settings.fontScale === 'number') ? settings.fontScale : 0.35;
        const fontSize = Math.max(12, size * fontScale);
        textEl.style.fontSize = `${fontSize}px`;
        if (typeof settings.letterSpacing === 'number') {
            textEl.style.letterSpacing = `${settings.letterSpacing}px`;
        } else {
            textEl.style.letterSpacing = '';
        }
        const text = stage16MorseState.displayText || '';
        textEl.textContent = text || '';
    }

    _updateInputImageGimmick(element, config, size) {
        const img = element.querySelector('.input-image-display');
        if (!img) return;
        const settings = config.settings || {};
        const side = (currentStage === 5) ? stage5InputImageState.side : null;
        let nextSrc = '';
        if (side === 'left' && settings.leftImage) {
            nextSrc = settings.leftImage;
        } else if (side === 'right' && settings.rightImage) {
            nextSrc = settings.rightImage;
        }
        if (nextSrc) {
            if (img.dataset.currentSrc !== nextSrc) {
                img.src = nextSrc;
                img.dataset.currentSrc = nextSrc;
            }
            img.style.opacity = '1';
        } else {
            if (img.dataset.currentSrc) {
                img.removeAttribute('src');
            }
            img.style.opacity = '0';
            img.dataset.currentSrc = '';
        }
    }

    _updateRotateTilesGimmick(element, config, containerSize) {
        if (!element || !config) return;
        const state = element._rotateTiles;
        if (!state) return;
        const tiles = state.tiles;
        const imgs = state.imgs;
        const settings = config.settings || {};
        const count = Math.min(tiles.length, imgs.length);

        // Handle loop reset: unhide tiles and restore default rotations; clear processed beats
        if (isLoopComplete && state.hidden) {
            for (let i = 0; i < state.hidden.length; i++) state.hidden[i] = false;
            if (state.processedBeats && typeof state.processedBeats.clear === 'function') {
                state.processedBeats.clear();
            }
            if (Array.isArray(state.defaultAngles)) {
                // Snap reset (no animation) to default angles at loop boundary
                for (let i = 0; i < imgs.length; i++) {
                    // temporarily disable transition
                    const img = imgs[i];
                    const prevTrans = img.style.transition;
                    img.style.transition = 'none';
                    state.angles[i] = state.defaultAngles[i] || 0;
                    img.style.transform = `rotate(${state.angles[i]}deg)`;
                    // force reflow so transition-less apply takes effect
                    void img.offsetWidth;
                    // restore transition for subsequent interactions
                    img.style.transition = prevTrans || 'transform 0.25s ease-in-out';
                }
            }
        }

        // Compute sizes and layout
        const size = settings.size * (containerSize / 400);
        const gapRatio = (typeof settings.gapRatio === 'number') ? Math.max(0, settings.gapRatio) : 0.06;
        const gap = Math.round(size * gapRatio);
        const positions = Array.isArray(settings.positions) ? settings.positions : null;
        const tileScale = (typeof settings.tileScale === 'number' && settings.tileScale > 0) ? settings.tileScale : 0.22;

        if (positions && positions.length >= count) {
            // Absolute positions (percent) inside the container element
            const tileSize = Math.max(8, Math.round(size * tileScale));
            for (let i = 0; i < count; i++) {
                const p = positions[i];
                const tile = tiles[i];
                tile.style.width = `${tileSize}px`;
                tile.style.height = `${tileSize}px`;
                tile.style.left = `${p.x}%`;
                tile.style.top = `${p.y}%`;
            }
        } else {
            // Default horizontal row layout (centered)
            const padding = Math.round(size * 0.06);
            const available = size - padding * 2;
            const tileWidth = Math.floor((available - gap * (count - 1)) / count);
            const top = Math.round((size - tileWidth) / 2);
            let x = padding;
            for (let i = 0; i < count; i++) {
                const tile = tiles[i];
                tile.style.width = `${tileWidth}px`;
                tile.style.height = `${tileWidth}px`;
                tile.style.left = `${x}px`;
                tile.style.top = `${top}px`;
                x += tileWidth + gap;
            }
        }

        // Apply rotation and visibility
        for (let i = 0; i < count; i++) {
            const img = imgs[i];
            const a = (state.angles && Number.isFinite(state.angles[i])) ? state.angles[i] : 0;
            img.style.transform = `rotate(${a}deg)`;
            tiles[i].style.visibility = state.hidden && state.hidden[i] ? 'hidden' : 'visible';
        }
    }

    // _updateNumberTextGimmick関数を更新
_updateNumberTextGimmick(element, config, containerSize) {
    const scaleFactor = containerSize / 400;
    const fontSize = config.settings.size * 0.2 * scaleFactor;
    
    const container = element.querySelector('div');
    container.style.position = 'absolute';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.left = '0';
    container.style.top = '0';
    
    const words = element.querySelectorAll('.number-text-word');
    const currentBeat = Math.floor(currentBeatProgress) + 1;
    
    words.forEach((wordElement, wordIndex) => {
        const wordConfig = config.settings.words[wordIndex];
        
        wordElement.style.position = 'absolute';
        wordElement.style.left = `${wordConfig.x}%`;
        wordElement.style.top = `${wordConfig.y}%`;
        wordElement.style.transform = 'translate(-50%, -50%)';
        wordElement.style.width = 'auto';
        wordElement.style.whiteSpace = 'nowrap';
        
        // 文字のスタイルを設定
        const chars = wordElement.querySelectorAll('.number-text-char');
        chars.forEach((charElement, charIndex) => {
            charElement.style.fontSize = `${fontSize}px`;
            charElement.style.fontFamily = "'M PLUS Rounded 1c', sans-serif";
            charElement.style.display = 'inline-block';
            charElement.style.minWidth = `${fontSize}px`;
            charElement.style.textAlign = 'center';
            charElement.style.fontWeight = 'bold';
            
            // specialChar が設定されている場合のみ、ドットの影響を受ける
            if (wordConfig.specialChar && wordConfig.specialChar.index === charIndex) {
                // wordIndex + 1 が対応する拍番号
                const beatNumber = wordIndex + 1;
                
                if (beatNumber < currentBeat || (beatNumber === currentBeat && lastBeat === currentBeat)) {
                    // この拍が既に過ぎている場合
                    const wasSelected = selectedBeats.has(beatNumber);
                    charElement.textContent = wasSelected ? 
                        wordConfig.specialChar.selected : 
                        wordConfig.specialChar.default;
                } else {
                    // この拍がまだ来ていない、または現在進行中の場合
                    charElement.textContent = '#';
                }
            } else {
                // # でない普通の文字はそのまま表示
                const originalChar = wordConfig.text[charIndex];
                if (originalChar !== '#') {
                    charElement.textContent = originalChar;
                }
            }
        });
    });
}

    _updateDotCounterGimmick(element, config, size) {
        const counterContainer = element.querySelector('div');
        if (counterContainer) {
            const fontSize = size * 0.5;
            counterContainer.style.fontSize = `${fontSize}px`;
            counterContainer.style.color = '#333';
            counterContainer.style.lineHeight = '1';
            counterContainer.style.textAlign = 'center';
            counterContainer.style.fontFamily = "'M PLUS Rounded 1c', sans-serif";
            counterContainer.style.display = 'flex';
            counterContainer.style.justifyContent = 'center';
            counterContainer.style.alignItems = 'center';

            const dotCount = this._countSelectedDotsInRange(
                config.settings.startBeat,
                config.settings.endBeat
            );

            counterContainer.textContent = this._generateDotCounterText(
                dotCount,
                config.settings.baseNumber
            );
        }
    }
    
    _updateClickCounterGimmick(element, config, size) {
        const total = clickCounts.getTotal();
        element.style.fontSize = `${size * 0.3}px`;
        element.style.fontFamily = "'M PLUS Rounded 1c', sans-serif";
        element.style.textAlign = 'center';
        element.style.color = '#333';
        element.style.whiteSpace = 'nowrap';  // 追加：改行を防ぐ
        element.textContent = `総クリック回数: ${total}回`;  // brタグを削除し、区切りをコロンに
    }
    _updateRhythmDotsGimmick(element, config, containerSize) {
        const dots = element.querySelectorAll('.rhythm-dot-in-puzzle');
        const scaleFactor = containerSize / 400;
        const currentBeat = Math.floor(currentBeatProgress) + 1;
    
        const container = element.querySelector('div');
        container.style.position = 'absolute';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.top = '0';
        container.style.left = '0';
    
        dots.forEach((dot, index) => {
            const dotConfig = config.settings.dots[index];
            const beatNumber = dotConfig.beat;  // 配列のインデックスではなく、beatプロパティを使用
    
            const scaledSize = (dotConfig.size || 20) * scaleFactor;
            dot.style.width = `${scaledSize}px`;
            dot.style.height = `${scaledSize}px`;
            dot.style.left = `${dotConfig.x}%`;
            dot.style.top = `${dotConfig.y}%`;
            dot.style.transform = 'translate(-50%, -50%)';
    
            // 見た目の設定
            { const colors = getNextColorsForStage(currentStage); const lp = selectedBeatsLeft.has(beatNumber); const rp = selectedBeatsRight.has(beatNumber); let bg = colors.none; if (lp && rp) bg = colors.both; else if (lp) bg = colors.left; else if (rp) bg = colors.right; dot.style.backgroundColor = bg; }
            dot.style.borderRadius = '50%';
            dot.style.opacity = '0.8';
            dot.style.transition = 'all 0.1s ease';
            dot.style.border = '2px solid #333';
    
            // 現在のビートのドットをハイライト
            if (beatNumber === currentBeat) {
                dot.style.transform = 'translate(-50%, -50%) scale(1.2)';
                dot.style.opacity = '1';
            } else {
                dot.style.transform = 'translate(-50%, -50%) scale(1)';
            }
        });
    }



    _updateVerticalLinesGimmick(element, config, containerSize) {
        const scaleFactor = containerSize / 400;
        const currentBeat = Math.floor(currentBeatProgress) + 1;

        const container = element.querySelector('div');
        if (!container) return;
        container.style.position = 'absolute';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.top = '0';
        container.style.left = '0';

        const beats = (config.settings && config.settings.beats) || [];
        const stageIdForElement = (() => {
            try { return parseInt((element.id || '').split('-')[1] || '-1', 10); }
            catch (_) { return -1; }
        })();
        const useRightOnly = (stageIdForElement === 7);
        const visibleSet = useRightOnly ? selectedBeatsRight : selectedBeats;

        const resolveLineColor = (lineCfg) => lineCfg.color || config?.settings?.color || '#111';

        const evaluateCorner = (value, widthPx) => {
            if (value == null) return null;
            if (typeof value === 'number' && Number.isFinite(value)) {
                return Math.max(0, value) * scaleFactor;
            }
            if (typeof value === 'string') {
                const trimmed = value.trim().toLowerCase();
                if (!trimmed) return null;
                if (trimmed === 'round' || trimmed === 'circle' || trimmed === 'full') {
                    return Math.max(0, widthPx / 2);
                }
                if (trimmed === 'square' || trimmed === 'sharp' || trimmed === 'none') {
                    return 0;
                }
                if (trimmed.endsWith('%')) {
                    const pct = parseFloat(trimmed);
                    if (Number.isFinite(pct)) {
                        return Math.max(0, widthPx * pct / 100);
                    }
                }
                const numeric = parseFloat(trimmed);
                if (Number.isFinite(numeric)) {
                    return Math.max(0, numeric) * scaleFactor;
                }
            }
            return null;
        };

        const resolveCornerRadiusPx = (lineCfg, widthPx) => {
            const lineCorner = evaluateCorner(lineCfg.cornerRadius ?? lineCfg.cornerStyle, widthPx);
            if (lineCorner !== null) return lineCorner;
            const configCorner = evaluateCorner(config?.settings?.cornerRadius ?? config?.settings?.cornerStyle, widthPx);
            if (configCorner !== null) return configCorner;
            return Math.max(0, widthPx / 2);
        };

        const applyLineStyle = (lineEl, lineCfg, isVisible) => {
            const baseWidth = (typeof lineCfg.width === 'number') ? lineCfg.width : 6;
            const widthPx = baseWidth * scaleFactor;
            const color = resolveLineColor(lineCfg);
            lineEl.style.backgroundColor = color;
            lineEl.style.transition = 'opacity 0.1s ease, transform 0.1s ease';

            const elementSizePx = (config?.settings?.size || 400) * scaleFactor;
            if (lineCfg.x1 != null && lineCfg.y1 != null && lineCfg.x2 != null && lineCfg.y2 != null) {
                const x1 = (lineCfg.x1 / 100) * elementSizePx;
                const y1 = (lineCfg.y1 / 100) * elementSizePx;
                const x2 = (lineCfg.x2 / 100) * elementSizePx;
                const y2 = (lineCfg.y2 / 100) * elementSizePx;
                const dx = x2 - x1;
                const dy = y2 - y1;
                const lengthPx = Math.max(1, Math.hypot(dx, dy));
                const angleDeg = (Math.atan2(dy, dx) * 180 / Math.PI) + 90;
                const cx = (lineCfg.x1 + lineCfg.x2) / 2;
                const cy = (lineCfg.y1 + lineCfg.y2) / 2;

                lineEl.style.width = `${widthPx}px`;
                lineEl.style.height = `${lengthPx}px`;
                lineEl.style.left = `${cx}%`;
                lineEl.style.top = `${cy}%`;
                lineEl.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg)`;
            } else {
                const heightPx = ((typeof lineCfg.length === 'number') ? lineCfg.length : 24) * scaleFactor;
                lineEl.style.width = `${widthPx}px`;
                lineEl.style.height = `${heightPx}px`;
                lineEl.style.left = `${lineCfg.x}%`;
                lineEl.style.top = `${lineCfg.y}%`;
                lineEl.style.transform = 'translate(-50%, -50%)';
            }

            const radiusPx = resolveCornerRadiusPx(lineCfg, widthPx);
            lineEl.style.borderRadius = `${radiusPx}px`;
            lineEl.style.opacity = isVisible ? '1' : '0';
        };

        beats.forEach(beatCfg => {
            (beatCfg.lines || []).forEach((lineCfg, lineIdx) => {
                const sel = `.dakuten-line[data-beat='${beatCfg.beat}'][data-side='legacy'][data-which='${lineIdx}']`;
                const lineEl = element.querySelector(sel);
                if (!lineEl) return;
                applyLineStyle(lineEl, lineCfg, visibleSet.has(beatCfg.beat));
            });
        });

        beats.forEach(beatCfg => {
            (beatCfg.leftLines || []).forEach((lineCfg, lineIdx) => {
                const sel = `.dakuten-line[data-beat='${beatCfg.beat}'][data-side='left'][data-which='${lineIdx}']`;
                const lineEl = element.querySelector(sel);
                if (!lineEl) return;
                applyLineStyle(lineEl, lineCfg, selectedBeatsLeft.has(beatCfg.beat));
            });
        });

        beats.forEach(beatCfg => {
            (beatCfg.rightLines || []).forEach((lineCfg, lineIdx) => {
                const sel = `.dakuten-line[data-beat='${beatCfg.beat}'][data-side='right'][data-which='${lineIdx}']`;
                const lineEl = element.querySelector(sel);
                if (!lineEl) return;
                applyLineStyle(lineEl, lineCfg, selectedBeatsRight.has(beatCfg.beat));
            });
        });
    }
    _updateLinesArcsGimmick(element, config, containerSize) {
        const scaleFactor = containerSize / 400;
        const container = element.querySelector('div');
        if (!container) return;
        const svg = container.querySelector('svg');
        const beats = (config.settings && config.settings.beats) || [];

        // Left NEXT (NEXT1) controls this gimmick's visibility
        const visibleSet = selectedBeatsLeft;

        // Update lines similar to vertical lines
        beats.forEach(beatCfg => {
            (beatCfg.lines || []).forEach((lineCfg, idx) => {
                const sel = `[data-beat='${beatCfg.beat}'][data-which='line-${idx}']`;
                const lineEl = container.querySelector(sel);
                if (!lineEl) return;
                const height = (lineCfg.length || 24) * scaleFactor;
                const width = (lineCfg.width || 6) * scaleFactor;
                lineEl.style.width = `${width}px`;
                lineEl.style.height = `${height}px`;
                lineEl.style.left = `${lineCfg.x}%`;
                lineEl.style.top = `${lineCfg.y}%`;
                lineEl.style.transform = 'translate(-50%, -50%)';
                lineEl.style.backgroundColor = '#111';
                lineEl.style.borderRadius = `${Math.max(1, width/2)}px`;
                lineEl.style.opacity = visibleSet.has(beatCfg.beat) ? '1' : '0';
                lineEl.style.transition = 'opacity 0.1s ease, transform 0.1s ease';

                // Generalized line support for LINES_ARCS too
                if (lineCfg.x1 != null && lineCfg.y1 != null && lineCfg.x2 != null && lineCfg.y2 != null) {
                    const widthPx = (lineCfg.width || 6) * scaleFactor;
                    const elementSizePx = (config?.settings?.size || 400) * scaleFactor;
                    const x1 = (lineCfg.x1 / 100) * elementSizePx;
                    const y1 = (lineCfg.y1 / 100) * elementSizePx;
                    const x2 = (lineCfg.x2 / 100) * elementSizePx;
                    const y2 = (lineCfg.y2 / 100) * elementSizePx;
                    const dx = x2 - x1;
                    const dy = y2 - y1;
                    const lengthPx = Math.max(1, Math.hypot(dx, dy));
                    const angleDeg = (Math.atan2(dy, dx) * 180 / Math.PI) + 90;
                    const cx = (lineCfg.x1 + lineCfg.x2) / 2;
                    const cy = (lineCfg.y1 + lineCfg.y2) / 2;

                    lineEl.style.width = `${widthPx}px`;
                    lineEl.style.height = `${lengthPx}px`;
                    lineEl.style.left = `${cx}%`;
                    lineEl.style.top = `${cy}%`;
                    lineEl.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg)`;
                }
            });
        });

        // Update arcs in the shared SVG
        if (svg) {
            // Make sure viewBox matches pixel canvas for consistent coordinates
            const sizePx = element.clientWidth || element.offsetWidth || containerSize;
            svg.setAttribute('viewBox', `0 0 ${sizePx} ${sizePx}`);

            beats.forEach(beatCfg => {
                (beatCfg.arcs || []).forEach((arcCfg, arcIdx) => {
                    const sel = `path[data-beat='${beatCfg.beat}'][data-which='arc-${arcIdx}']`;
                    const pathEl = svg.querySelector(sel);
                    if (!pathEl) return;

                    const cx = (arcCfg.cx != null ? arcCfg.cx : 50) / 100 * sizePx;
                    const cy = (arcCfg.cy != null ? arcCfg.cy : 50) / 100 * sizePx;
                    const radiusPx = (arcCfg.radius != null ? arcCfg.radius : 20) / 100 * sizePx;
                    const sw = (arcCfg.width != null ? arcCfg.width : 6) * scaleFactor;
                    const a1 = ((arcCfg.startAngle != null ? arcCfg.startAngle : 0) * Math.PI) / 180;
                    const a2 = ((arcCfg.endAngle != null ? arcCfg.endAngle : 0) * Math.PI) / 180;

                    const x1 = cx + radiusPx * Math.cos(a1);
                    const y1 = cy + radiusPx * Math.sin(a1);
                    const x2 = cx + radiusPx * Math.cos(a2);
                    const y2 = cy + radiusPx * Math.sin(a2);

                    let delta = (arcCfg.endAngle - arcCfg.startAngle);
                    // normalize to [0, 360)
                    while (delta < 0) delta += 360;
                    while (delta >= 360) delta -= 360;
                    const largeArc = delta > 180 ? 1 : 0;
                    const sweep = (arcCfg.endAngle >= arcCfg.startAngle) ? 1 : 0;

                    const d = `M ${x1} ${y1} A ${radiusPx} ${radiusPx} 0 ${largeArc} ${sweep} ${x2} ${y2}`;
                    pathEl.setAttribute('d', d);
                    pathEl.setAttribute('stroke', arcCfg.color || '#111');
                    pathEl.setAttribute('stroke-width', String(sw));
                    pathEl.style.opacity = visibleSet.has(beatCfg.beat) ? '1' : '0';
                    pathEl.style.transition = 'opacity 0.1s ease';
                });
            });
        }
    }

    updateGimmick(stageId) {
        const config = STAGE_CONFIGS[stageId];
        if (!config) return;

        config.gimmicks.forEach((gimmickConfig, index) => {
            let element = this.elements.get(`${stageId}-${index}`);
            if (!element) {
                element = this.createGimmickElement(stageId, index);
            }

            const containerSize = Math.min(problemArea.clientWidth, problemArea.clientHeight);
            const scaleFactor = containerSize / 400;
            const size = gimmickConfig.settings.size * scaleFactor;

            // 基本的なスタイル設定
            if (gimmickConfig.type !== GIMMICK_TYPES.WALL_IMAGE) {
                element.style.width = `${size}px`;
                element.style.height = `${size}px`;
                element.style.left = `${gimmickConfig.settings.x}%`;
                element.style.top = `${gimmickConfig.settings.y}%`;
                element.style.transform = 'translate(-50%, -50%)';
            } else {
                element.style.width = '100%';
                element.style.height = '100%';
                element.style.left = '0';
                element.style.top = '0';
                element.style.transform = 'none';
            }

            // タイマーとひらがなのスタイル設定
            if (gimmickConfig.type === GIMMICK_TYPES.TIMER || 
                gimmickConfig.type === GIMMICK_TYPES.HIRAGANA) {
                this._setupTextStyles(element, size);
            }

            // 各ギミックタイプの更新処理
            switch (gimmickConfig.type) {
                case GIMMICK_TYPES.TIMER:
                    this._updateTimerGimmick(element, currentTime);
                    break;

                case GIMMICK_TYPES.HIRAGANA:
                    this._updateHiraganaGimmick(element, gimmickConfig, currentTime);
                    break;

                case GIMMICK_TYPES.IMAGE_SEQUENCE:
                    this._updateImageSequenceGimmick(element, gimmickConfig, currentTime);
                    break;

                case GIMMICK_TYPES.WALL_IMAGE:
                    this._updateWallImageGimmick(element, gimmickConfig);
                    break;

                case GIMMICK_TYPES.DYNAMIC_TEXT_GROUP:
                    this._updateDynamicTextGroupGimmick(element, gimmickConfig, size, scaleFactor);
                    break;

                case GIMMICK_TYPES.DOT_COUNTER:
                    this._updateDotCounterGimmick(element, gimmickConfig, size);
                    break;

                case GIMMICK_TYPES.RHYTHM_DOTS:
                    this._updateRhythmDotsGimmick(element, gimmickConfig, containerSize);
                    break;

                case GIMMICK_TYPES.VERTICAL_LINES:
                    this._updateVerticalLinesGimmick(element, gimmickConfig, containerSize);
                    break;

                case GIMMICK_TYPES.LINES_ARCS:
                    this._updateLinesArcsGimmick(element, gimmickConfig, containerSize);
                    break;

                case GIMMICK_TYPES.SEGMENT:
                    // セグメント表示の実装（必要に応じて）
                    break;

                case GIMMICK_TYPES.NUMBER_TEXT:
                    this._updateNumberTextGimmick(element, gimmickConfig, containerSize);
                    break;

                case GIMMICK_TYPES.CLICK_COUNTER:
                    this._updateClickCounterGimmick(element, gimmickConfig, size);
                    break;

                case GIMMICK_TYPES.INPUT_IMAGE:
                    this._updateInputImageGimmick(element, gimmickConfig, size);
                    break;

                case GIMMICK_TYPES.MORSE_DISPLAY:
                    this._updateMorseDisplayGimmick(element, gimmickConfig, size);
                    break;

                case GIMMICK_TYPES.LYRICS:
                    this._updateLyricsGimmick(element, gimmickConfig, size, scaleFactor);
                    break;

                case GIMMICK_TYPES.ROTATE_TILES:
                    this._updateRotateTilesGimmick(element, gimmickConfig, containerSize);
                    break;
            }
        });
    }

    hideAllExcept(currentStageId) {
        this.elements.forEach((element, key) => {
            const [stageId] = key.split('-');
            element.style.display = parseInt(stageId) === currentStageId ? 'block' : 'none';
        });
    }

    reset() {
        this.activeWallImages.forEach(img => img.remove());
        this.activeWallImages.clear();
    }
}
//====================================================
// ユーティリティ関数
//====================================================
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updatePuzzleImage() {
    let existingImage = problemArea.querySelector('.puzzle-image');
    if (existingImage) {
        existingImage.remove();
    }

    const imagePath = PUZZLE_IMAGES[currentStage];
    if (imagePath) {
        const imageElement = document.createElement('img');
        // 初期表示のチラつきを抑えるためデコード優先
        imageElement.decoding = 'sync';
        imageElement.loading = 'eager';
        imageElement.src = imagePath;
        imageElement.className = 'puzzle-image';
        imageElement.alt = `Puzzle ${currentStage}`;
        problemArea.insertBefore(imageElement, problemArea.firstChild);
    }
}

//====================================================
// リズムドット関連の機能
//====================================================
function createRhythmDots() {
    const dotsContainer = document.getElementById('rhythmDots');
    if (!dotsContainer) return;

    dotsContainer.innerHTML = '';
    const dotCount = stageSettings[currentStage]?.dots || 4;
    // Set data attribute for CSS-based padding control
    dotsContainer.dataset.dotCount = String(dotCount);

    for (let i = 0; i < dotCount; i++) {
        const dot = document.createElement('div');
        dot.className = 'rhythm-dot';
        
        // クリア済みステージの場合、正解のドットを selected 状態で表示
        if (clearedStages.has(currentStage)) {
            const beatNumber = i + 1;
            if (Array.isArray(correctPatterns[currentStage]) && correctPatterns[currentStage].includes(beatNumber)) {
                dot.classList.add('selected');
            }
        }
        
        dotsContainer.appendChild(dot);
        // Dual pattern visual on cleared stage
        if (clearedStages.has(currentStage)) {
            const pattern = correctPatterns[currentStage];
            if (_isDualPattern(pattern)) {
                const beatNumber2 = i + 1;
                const step2 = _getExpectedStepForBeat(currentStage, beatNumber2);
                const colors2 = getNextColorsForStage(currentStage);
                let bg2 = '';
                if (step2 === 'both') bg2 = colors2.both;
                else if (step2 === 'left') bg2 = colors2.left;
                else if (step2 === 'right') bg2 = colors2.right;
                dot.classList.remove('selected');
                if (bg2) dot.style.backgroundColor = bg2;
            }
        }
    }
}

function updateRhythmDots() {
    if (!isPlaying && !clearedStages.has(currentStage)) return;

    const dotsContainer = document.getElementById('rhythmDots');
    if (!dotsContainer) return;

    const dotCount = stageSettings[currentStage]?.dots || 4;
    const oldBeat = lastBeat;
    // 視覚上のドット進行も判定オフセットに追従させる
    const visualTime = currentTime + (INPUT_BEAT_BIAS_MS || 0) / 1000;
    const rawProgress = visualTime * BEATS_PER_SECOND;
    currentBeatProgress = ((rawProgress % dotCount) + dotCount) % dotCount;
    const currentBeat = Math.floor(currentBeatProgress) + 1;

    // ループ先頭通過の検出を“連続進行の折り返し”で判定（オフセットと完全同期）
    const norm = currentBeatProgress / dotCount; // 0..1
    const beatChanged = oldBeat !== -1 && currentBeat !== oldBeat;
    const loopWrapped = norm + 1e-6 < lastLoopProgress;

    if (currentStage === 16) {
        stage16HandleTiming(beatChanged, loopWrapped);
    }

    if (loopWrapped) {
        checkRhythmPattern();
        selectedBeats.clear();
        selectedBeatsLeft.clear();
        selectedBeatsRight.clear();
        isLoopComplete = true;
    } else {
        isLoopComplete = false;
    }
    lastLoopProgress = norm;
    lastBeat = currentBeat;

    const dots = dotsContainer.querySelectorAll('.rhythm-dot');
    dots.forEach((dot, index) => {
        const beatNumber = index + 1;
        const isCurrentBeat = beatNumber === currentBeat;
        const isSelected = selectedBeats.has(beatNumber);
        const isClearedStage = clearedStages.has(currentStage);
        const patternForStage = correctPatterns[currentStage];
        // If cleared and dual pattern, show expected color and skip default handling
        if (isClearedStage && _isDualPattern(patternForStage)) {
            dot.classList.remove('active');
            dot.classList.remove('selected');
            const step = _getExpectedStepForBeat(currentStage, beatNumber);
            const colors = getNextColorsForStage(currentStage);
            let color = '';
            if (step === 'both') color = colors.both;
            else if (step === 'left') color = colors.left;
            else if (step === 'right') color = colors.right;
            else color = '';
            dot.style.backgroundColor = color;
            return;
        }
        const isCorrectBeat = isClearedStage && Array.isArray(patternForStage) &&
            patternForStage.includes(beatNumber);

        // クリア済みステージの場合、正解のドットを常に selected 状態に
        if (isCorrectBeat) {
            dot.classList.add('selected');
            dot.style.backgroundColor = '';
        } else {
            dot.classList.toggle('active', isCurrentBeat);
            dot.classList.toggle('selected', isSelected);
            const l = selectedBeatsLeft.has(beatNumber);
            const r = selectedBeatsRight.has(beatNumber);
            const colors = getNextColorsForStage(currentStage);
            let color = '';
            if (l && r) color = colors.both;
            else if (l) color = colors.left;
            else if (r) color = colors.right;
            else color = '';
            dot.style.backgroundColor = color;
        }
    });
}

// Stage 9: rotating tiles per beat
function stage9HandleInput(side) {
    try {
        if (currentStage !== 9) return;
        const el = document.getElementById('gimmick-9-0');
        if (!el || !el._rotateTiles) return;
        const state = el._rotateTiles;
        const beat = getWrapSafeBeatNumber();
        const idx = (beat - 1) % 4; // 1..16 -> 0..3
        const l = selectedBeatsLeft.has(beat);
        const r = selectedBeatsRight.has(beat);
        if (l && r) {
            state.hidden[idx] = true; // simultaneous -> hide
            // mark processed so repeated presses in same beat do nothing
            if (state.processedBeats) state.processedBeats.add(beat);
        } else {
            // Prevent multiple rotations within the same beat
            if (state.processedBeats && state.processedBeats.has(beat)) return;
            const delta = (side === 'right') ? 90 : -90;
            const prev = Number.isFinite(state.angles[idx]) ? state.angles[idx] : 0;
            const next = prev + delta; // keep signed to animate shortest path (e.g., -90deg)
            state.angles[idx] = next;
            if (state.processedBeats) state.processedBeats.add(beat);
        }
    } catch (_) { /* no-op */ }
}

function checkRhythmPattern() {
    // ステージ6の特殊判定
    if (currentStage === 6) {
        // 前半と後半のドット数をカウント
        let firstHalfCount = 0;
        let secondHalfCount = 0;
        
        // 前半（1-4拍）のカウント
        for (let i = 1; i <= 4; i++) {
            if (selectedBeats.has(i)) {
                firstHalfCount++;
            }
        }
        
        // 後半（5-8拍）のカウント
        for (let i = 5; i <= 8; i++) {
            if (selectedBeats.has(i)) {
                secondHalfCount++;
            }
        }

        // 正解判定: 前半が2回、後半が3回
        if (firstHalfCount === 2 && secondHalfCount === 3) {
            clearedStages.add(currentStage);
            currentStage++;
            updateStageContent();
        }
        
        selectedBeats.clear();
        selectedBeatsLeft.clear();
        selectedBeatsRight.clear();
        return;
    }

    // Dual-button judgement branch
    {
        const p = correctPatterns[currentStage];
        if (_isDualPattern(p)) {
            const steps = p.steps || [];
            let ok = true;
            for (let i = 1; i <= steps.length; i++) {
                const step = steps[i - 1];
                const l = selectedBeatsLeft.has(i);
                const r = selectedBeatsRight.has(i);
                if (step === 'none') { if (l || r) { ok = false; break; } }
                else if (step === 'left') { if (!l || r) { ok = false; break; } }
                else if (step === 'right') { if (!r || l) { ok = false; break; } }
                else if (step === 'both') { if (!(l && r)) { ok = false; break; } }
                else { ok = false; break; }
            }
            if (ok) {
                clearedStages.add(currentStage);
                currentStage++;
                updateStageContent();
            }
            selectedBeats.clear();
            selectedBeatsLeft.clear();
            selectedBeatsRight.clear();
            return;
        }
    }

    if (currentStage === 16) {
        const pattern = correctPatterns[currentStage];
        if (!pattern || selectedBeats.size !== pattern.length) {
            selectedBeats.clear();
            selectedBeatsLeft.clear();
            selectedBeatsRight.clear();
            return;
        }

        const allBeatsCorrect = pattern.every(beat => selectedBeats.has(beat));
        if (allBeatsCorrect) {
            // クリック回数が100回以下かチェック
            if (clickCounts.getTotal() <= 100) {
                clearedStages.add(currentStage);
                currentStage++;
                updateStageContent();
            } else {
                // クリック回数が100を超えた場合、リセットボタンを表示
                const resetContainer = document.getElementById('resetContainer');
                if (resetContainer) {
                    resetContainer.classList.add('show');
                }
            }
        }
        selectedBeats.clear();
        selectedBeatsLeft.clear();
        selectedBeatsRight.clear();
        return;
    }

    // 通常ステージの判定
    const pattern = correctPatterns[currentStage];
    if (!pattern || selectedBeats.size !== pattern.length) {
        selectedBeats.clear();
        selectedBeatsLeft.clear();
        selectedBeatsRight.clear();
        return;
    }

    const allBeatsCorrect = pattern.every(beat => selectedBeats.has(beat));
    if (allBeatsCorrect) {
        clearedStages.add(currentStage);
        currentStage++;
        updateStageContent();
    }
    
    selectedBeats.clear();
    selectedBeatsLeft.clear();
    selectedBeatsRight.clear();
}
//====================================================
// UI更新関数
//====================================================
const gimmickManager = new GimmickManager();

// Register stage 18 metadata (secret clear)
try {
    STAGE_NAMES[18] = 'SPECIAL CLEAR';
    stageSettings[18] = { dots: 8 };
    STAGE_ANSWERS[18] = 'SPECIAL CLEAR';
    correctPatterns[18] = [];
    // placeholder gimmicks (duplicated from stage 17 for later edits)
    STAGE_CONFIGS[18] = {
        gimmicks: [
            {
                type: GIMMICK_TYPES.CLICK_COUNTER,
                settings: { x: 30, y: 30, size: 80 }
            },
            {
                type: GIMMICK_TYPES.RECORDS_DISPLAY,
                settings: { x: 50, y: 60, size: 150 }
            },
        ]
    };
} catch (_) {}

function updateProgress() {
    const progress = (currentTime / TOTAL_DURATION) * 100;
    document.getElementById('progress').style.width = `${progress}%`;
    document.getElementById('progressKnob').style.left = `${progress}%`;
    currentTimeDisplay.textContent = formatTime(currentTime);
}

function updateStageContent() {
    titleArea.textContent = (currentStage === -1) ? 'ステージテスト' : STAGE_NAMES[currentStage];
    updatePuzzleImage();
    updateBackgroundColor();
    updateAnswer();
    createRhythmDots();
    selectedBeats.clear();
    selectedBeatsLeft.clear();
    selectedBeatsRight.clear();
    isLoopComplete = false;
    stage5InputImageState.side = null;
    stage16SetActive(currentStage === 16);
    updateProblemElements();
    updateNextButtonsVisibility();
}

// Show/hide left NEXT button per stage
function updateNextButtonsVisibility() {
    try {
        const leftEnabled = isLeftNextEnabledForStage(currentStage);
        const leftBtn = document.getElementById('next1Button');
        if (leftBtn) {
            // Keep layout from shifting: hide visually, keep space
            if (leftEnabled) {
                leftBtn.style.display = '';
                leftBtn.style.visibility = '';
                leftBtn.style.pointerEvents = '';
            } else {
                leftBtn.style.display = '';
                leftBtn.style.visibility = 'hidden';
                leftBtn.style.pointerEvents = 'none';
            }
        }
    } catch (_) {}
}

function updateBackgroundColor() {
    document.body.className = `stage-${currentStage}`;
    try {
        if (window.bgVisualizer) window.bgVisualizer.updateColorForStage(currentStage);
    } catch (_) {}
}

function updateAnswer() {
    const answerElement = document.querySelector('.answer-area p');
    if (currentStage === -1) {
        answerElement.textContent = '---';
        return;
    }
    answerElement.textContent = STAGE_ANSWERS[currentStage];
}

function updateProblemElements() {
    // ステージテスト: 専用UIを描画
    if (currentStage === -1) {
        const containerCss = `
            width: 100%; height: 100%; display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 14px;
            background: white; border-radius: 10px; padding: 20px; color: #333;
            font-family: 'M PLUS Rounded 1c', sans-serif;`;
        const rowCss = `display:flex; align-items:center; gap:10px;`;

        // 既にUIが存在するかチェック（毎フレ再描画しない）
        let calibRoot = document.getElementById('calibRoot');
        if (!calibRoot) {
            problemArea.innerHTML = `
                <div id="calibRoot" style="${containerCss}">
                    <div style="${rowCss}">
                        <button id="inputMinus" style="padding:6px 12px; font-family: 'M PLUS Rounded 1c', sans-serif; font-size: 18px; font-weight: 700;">-</button>
                        <div id="inputVal" style="min-width:120px; text-align:center; font-size: 18px; font-weight: 700; font-family: 'M PLUS Rounded 1c', sans-serif;">${INPUT_BEAT_BIAS_MS} ms</div>
                        <button id="inputPlus" style="padding:6px 12px; font-family: 'M PLUS Rounded 1c', sans-serif; font-size: 18px; font-weight: 700;">+</button>
                    </div>
                    <div style="${rowCss}; margin-top: 8px; gap:12px;">

                        <button id="calibReady" style="
                            padding:10px 20px;
                            border-radius:8px;
                            background:#fff;
                            color:#111;
                            border:2px solid #111;
                            font-family: 'M PLUS Rounded 1c', sans-serif;
                            font-weight: 700;
                            transition: background-color .15s ease, color .15s ease, transform .06s ease;
                        ">準備完了</button>
                    </div>
                </div>
            `;
            calibRoot = document.getElementById('calibRoot');

            const step = 10; // ms 単位
            const $ = (id) => document.getElementById(id);
            const updateDisplays = () => {
                const iv = $('inputVal');
                if (iv) iv.textContent = `${INPUT_BEAT_BIAS_MS} ms`;
            };
            const setInput = (ms) => {
                INPUT_BEAT_BIAS_MS = Math.round(ms);
                try { localStorage.setItem('inputBeatBiasMs', String(INPUT_BEAT_BIAS_MS)); } catch(_) {}
                updateDisplays();
            };
            const bind = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };
            bind('inputMinus', () => setInput((INPUT_BEAT_BIAS_MS || 0) - step));
            bind('inputPlus',  () => setInput((INPUT_BEAT_BIAS_MS || 0) + step));
            // START button: starts test music only
            bind('calibStart', async () => {
                if (!isPlaying) {
                    try { await audio._ensureContext(); } catch(_) {}
                    try {
                        const map = window.__audioBuffers || {};
                        const buf = map[AUDIO_URLS.test];
                        if (buf) audio.provideArrayBuffer(buf);
                    } catch(_) {}
                    try {
                        applyVolumeForCurrentTrack();
                        await audio.play();
                        isPlaying = true;
                        playIcon.src = 'assets/images/controls/pause.png';
                    } catch(_) {}
                }
            });
            const readyBtn = $('calibReady');
            const setReadyPressed = () => {
                try {
                    readyBtn.style.background = '#007bff';
                    readyBtn.style.color = '#fff';
                    readyBtn.style.borderColor = '#007bff';
                } catch(_) {}
            };
            // tactile feedback
            if (readyBtn) {
                readyBtn.addEventListener('mousedown', () => { try { readyBtn.style.transform = 'scale(0.98)'; } catch(_){} });
                readyBtn.addEventListener('mouseup',   () => { try { readyBtn.style.transform = 'scale(1)'; } catch(_){} });
                readyBtn.addEventListener('touchstart', () => { try { readyBtn.style.transform = 'scale(0.98)'; } catch(_){} }, { passive: true });
                readyBtn.addEventListener('touchend',   () => { try { readyBtn.style.transform = 'scale(1)'; } catch(_){} });
            }
            bind('calibReady', async () => {
                setReadyPressed();
                // Stop any playing audio immediately
                try { audio.pause(); } catch(_) {}
                isPlaying = false;
                try { if (playIcon) playIcon.src = 'assets/images/controls/play.png'; } catch(_) {}

                // Prepare main track (MUSIC2000.mp3) to start from the beginning on next play
                try {
                    const bufMap = window.__audioBuffers || {};
                    const nextBuf = bufMap[AUDIO_URLS.main];
                    if (typeof audio._ensureContext === 'function') {
                        await audio._ensureContext();
                    }
                    // Switch URL and pre-provide buffer, then decode to know loopStart
                    audio.url = AUDIO_URLS.main;
                    audio._ready = null; // force reload for new URL
                    if (nextBuf) audio.provideArrayBuffer(nextBuf);
                    if (typeof audio._load === 'function') {
                        await audio._load();
                    }
                    // Ensure next playback starts from the very beginning of the main loop
                    try { audio._offset = audio._loopStart || 0; } catch(_) {}
                    applyVolumeForCurrentTrack();
                } catch(_) {}

                // Reset UI time/progress
                try { currentTime = 0; updateProgress(); } catch(_) {}

                // Immediately move to Stage 0
                currentStage = 0;
                updateStageContent();
            });
        } else {
            // 数値表示だけ更新（音楽再生中でも押下可）
            const iv = document.getElementById('inputVal');
            if (iv) iv.textContent = `${INPUT_BEAT_BIAS_MS} ms`;
        }
        return;
    }

    gimmickManager.updateGimmick(currentStage, currentTime);
    gimmickManager.hideAllExcept(currentStage);
}

function update() {
    if (isPlaying) {
        // 出力オフセットは使わず、そのままの currentTime を使用
        currentTime = audio.currentTime;
        updateProgress();
        updateRhythmDots();
        updateProblemElements();

        // boundary switching handled by player scheduler now
    }
    // デバッグ用タイムスライダーを同期
    if (typeof debugTools?.updateTimeSlider === 'function') {
        debugTools.updateTimeSlider(currentTime);
    }
    // Secret clear (stage 18): trigger when track time reaches threshold on stage 0 without NEXT
    try {
        const t = (audio && typeof audio.currentTime === 'number') ? audio.currentTime : currentTime;
        if (currentStage === 0 && !tutorialNextPressed && !tutorialNoNextTriggered && t >= HIDDEN_CLEAR_THRESHOLD_SEC) {
            tutorialNoNextTriggered = true;
            currentStage = 18;
            updateStageContent();
        } else if (currentStage !== 0) {
            // leaving tutorial: reset flags
            tutorialNoNextTimerSec = 0;
            tutorialNoNextLastTs = null;
            tutorialNoNextTriggered = false;
            tutorialNextPressed = false;
        }
    } catch (_) {}
    requestAnimationFrame(update);
}

// --- override: 入力拍の計算（判定オフセットのみ） ---
function getInputBeatNumber() {
    const dotCount = stageSettings[currentStage]?.dots || 4;
    const tBase = (audio && typeof audio.currentTime === 'number') ? audio.currentTime : currentTime;
    const t = tBase + (INPUT_BEAT_BIAS_MS || 0) / 1000; // 正: 後ろ寄せ / 負: 前寄せ
    const beatPos = t * BEATS_PER_SECOND;
    const progress = beatPos % dotCount;
    const nearest = Math.floor(progress + 0.5) % dotCount;
    const beat = nearest + 1;
    return Math.max(1, Math.min(dotCount, beat));
}

//====================================================
// イベントリスナー
//====================================================
let isDragging = false;

function updateTimeFromClick(event, forceUpdate = false) {
    if (!isDragging && !forceUpdate) return;

    const rect = progressBarElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, x / width));

    currentTime = percentage * TOTAL_DURATION;
    audio.currentTime = currentTime;
    updateProgress();
}

playButton.addEventListener('click', async () => {
    clickCounts.play++;
    if (isPlaying) {
        try { audio.pause(); } catch (_) {}
        playIcon.src = 'assets/images/controls/play.png';
        isPlaying = false;
        return;
    }
    try {
        if (typeof audio._ensureContext === 'function') {
            await audio._ensureContext();
        }
        // ensure correct per-track volume before starting
        applyVolumeForCurrentTrack();
        await audio.play();
        playIcon.src = 'assets/images/controls/pause.png';
        isPlaying = true;
    } catch (err) {
        // Safari 等で失敗した場合はユーザー操作を促す
        console.warn('Audio play failed:', err);
        playIcon.src = 'assets/images/controls/play.png';
        isPlaying = false;
    }
});

// Disable long-press context menu on mobile
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Web Audio のシームレスループを使うため、ended での手動ループは不要

// LEFT: NEXT1 behavior (repurposed from previous)
function doNext1Action() {
    // respect per-stage toggle
    if (!isLeftNextEnabledForStage(currentStage)) return;
    // Count as independent next1 and overall next
    clickCounts.next1++;
    clickCounts.next++;
    if (currentStage === 0) tutorialNextPressed = true;
    if (currentStage === 17 || currentStage === 18) return;
    if (clearedStages.has(currentStage)) {
        currentStage++;
        updateStageContent();
        onNext1Effect();
        return;
    }
    const currentBeat = getWrapSafeBeatNumber();
    if (currentStage === 7) {
        // Stage 7: LEFT draws only its own shapes; do not affect global selection
        selectedBeatsLeft.add(currentBeat);
    } else {
        selectedBeats.add(currentBeat);
        selectedBeatsLeft.add(currentBeat);
    }
    if (currentStage === 5) {
        stage5InputImageState.side = 'left';
    }
    if (currentStage === 16) {
        stage16RegisterInput('dash');
    }
    onNext1Effect();
}

function doNext2Action() {
    clickCounts.next2++;
    clickCounts.next++;
    if (currentStage === 0) tutorialNextPressed = true;
    if (currentStage === 17 || currentStage === 18) return;
    if (clearedStages.has(currentStage)) {
        currentStage++;
        updateStageContent();
        onNext2Effect();
        return;
    }
    const currentBeat = getWrapSafeBeatNumber();
    selectedBeats.add(currentBeat);
    selectedBeatsRight.add(currentBeat);
    if (currentStage === 5) {
        stage5InputImageState.side = 'right';
    }
    if (currentStage === 16) {
        stage16RegisterInput('dot');
    }
    onNext2Effect();
}

// Minimal multi-touch support: touchstart triggers action; click as fallback
function _bindSimple(btn, action) {
    if (!btn) return;
    const animate = () => {
        try { btn.style.transform = 'scale(0.95)'; setTimeout(() => { btn.style.transform = 'scale(1)'; }, 100); } catch(_){}
    };
    btn.addEventListener('touchstart', (e) => { try { e.preventDefault(); } catch(_){} action(); animate(); }, { passive: false });
    btn.addEventListener('click', () => { action(); animate(); });
}

_bindSimple(next1Button, doNext1Action);
_bindSimple(nextButton, doNext2Action);

// プログレスバーのドラッグ制御
// プログレスバー: つまみ以外でも即ジャンプ＆ドラッグ開始
progressBarElement.addEventListener('mousedown', (event) => {
    isDragging = true;
    updateTimeFromClick(event, true);
});

// バーをクリックしただけでもジャンプ
progressBarElement.addEventListener('click', (event) => {
    updateTimeFromClick(event, true);
});

document.addEventListener('mousemove', (event) => {
    if (isDragging) {
        updateTimeFromClick(event, true);
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
});

// タッチデバイス用のイベントリスナー
function handleTouchStart(event) {
    isDragging = true;
    progressBarElement.addEventListener('touchmove', handleTouchMove);
    updateTimeFromTouch(event);
}

function handleTouchMove(event) {
    if (isDragging) {
        event.preventDefault();
        updateTimeFromTouch(event);
    }
}

function handleTouchEnd() {
    isDragging = false;
    progressBarElement.removeEventListener('touchmove', handleTouchMove);
}

function updateTimeFromTouch(event) {
    if (!isDragging) return;

    const touch = event.touches[0];
    const rect = progressBarElement.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, x / width));

    currentTime = percentage * TOTAL_DURATION;
    audio.currentTime = currentTime;
    updateProgress();
}

progressBarElement.addEventListener('touchstart', handleTouchStart);
progressBarElement.addEventListener('touchend', handleTouchEnd);

// ウィンドウリサイズ時の処理
window.addEventListener('resize', () => {
    createRhythmDots();
    updateProblemElements();
});




//====================================================
// デバッグツール
//====================================================
const debugTools = {
    initialize() {
        const stageSelect = document.getElementById('stageSelect');
        const jumpButton = document.getElementById('debugJump');

        // ステージジャンプ
        jumpButton.addEventListener('click', () => {
            const targetStage = parseInt(stageSelect.value);
            this.forceJumpToStage(targetStage);
        });

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            let targetStage = null;
            // 物理キー優先で判定（Shiftの記号化対策）
            const code = e.code || '';
            let digit = null;
            if (code.startsWith('Digit')) {
                digit = parseInt(code.slice(5), 10);
            } else if (code.startsWith('Numpad')) {
                const n = parseInt(code.slice(6), 10);
                if (!isNaN(n) && n >= 0 && n <= 9) digit = n;
            } else if (e.key && e.key >= '0' && e.key <= '9') {
                digit = parseInt(e.key, 10);
            }

            if (digit !== null) {
                // Shift + 0..7 => 10..17
                if (e.shiftKey && !e.ctrlKey) {
                    if (digit >= 0 && digit <= 7) targetStage = 10 + digit;
                }
                // Ctrl + 1..9 => 21..29（従来維持）
                else if (!e.shiftKey && e.ctrlKey) {
                    if (digit >= 1 && digit <= 9) targetStage = 20 + digit;
                }
                // 単体 0..9 => 0..9
                else if (!e.shiftKey && !e.ctrlKey) {
                    targetStage = digit;
                }
            }

            if (targetStage !== null && targetStage <= 25) {
                e.preventDefault();
                this.forceJumpToStage(targetStage);
            }
        });

        // デバッグ用 再生時間バー
        (function setupDebugTimeBar(self){
            const toolsRoot = document.getElementById('debugTools');
            if (!toolsRoot || toolsRoot.querySelector('#debugTimeSlider')) return;

            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.alignItems = 'center';
            row.style.marginTop = '6px';

            const label = document.createElement('div');
            label.textContent = '再生時間:';
            label.style.color = 'white';
            label.style.fontSize = '12px';

            const timeValue = document.createElement('div');
            timeValue.id = 'debugTimeValue';
            timeValue.textContent = '0:00';
            timeValue.style.color = 'white';
            timeValue.style.fontSize = '12px';
            timeValue.style.width = '48px';
            timeValue.style.textAlign = 'right';

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = 'debugTimeSlider';
            slider.min = '0';
            slider.max = String(TOTAL_DURATION);
            slider.step = '0.05';
            slider.value = '0';
            slider.style.flex = '1';

            row.appendChild(label);
            row.appendChild(slider);
            row.appendChild(timeValue);
            toolsRoot.appendChild(row);

            const startScrub = () => { self._scrubbing = true; };
            const endScrub = () => { self._scrubbing = false; };
            slider.addEventListener('mousedown', startScrub);
            slider.addEventListener('touchstart', startScrub, { passive: true });
            slider.addEventListener('mouseup', endScrub);
            slider.addEventListener('touchend', endScrub);

            const seekTo = (sec) => {
                currentTime = sec;
                audio.currentTime = sec;
                self.updateTimeLabel(sec);
                updateProgress();
                updateProblemElements();
                updateRhythmDots();
            };

            slider.addEventListener('input', () => {
                const sec = parseFloat(slider.value) || 0;
                const now = (window.performance && performance.now) ? performance.now() : Date.now();
                if (!self._lastSeekAt || now - self._lastSeekAt > 50) {
                    self._lastSeekAt = now;
                    seekTo(sec);
                } else {
                    // 軽量に表示だけ更新
                    self.updateTimeLabel(sec);
                }
            });
            slider.addEventListener('change', () => {
                const sec = parseFloat(slider.value) || 0;
                seekTo(sec);
            });

            self._timeSlider = slider;
            self._timeLabel = timeValue;
        })(this);

        // 判定オフセット（ms）調整UIをデバッグツールに追加
        (function setupJudgeOffsetUI(self){
            const toolsRoot = document.getElementById('debugTools');
            if (!toolsRoot || toolsRoot.querySelector('#judgeOffsetSlider')) return;

            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.alignItems = 'center';
            row.style.marginTop = '6px';

            const label = document.createElement('div');
            label.textContent = '判定オフセット:';
            label.style.color = 'white';
            label.style.fontSize = '12px';

            const value = document.createElement('div');
            value.id = 'judgeOffsetValue';
            value.textContent = `${Number(INPUT_BEAT_BIAS_MS||0)}ms`;
            value.style.color = 'white';
            value.style.fontSize = '12px';
            value.style.width = '48px';
            value.style.textAlign = 'right';

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = 'judgeOffsetSlider';
            slider.min = '-150';
            slider.max = '150';
            slider.step = '1';
            slider.value = String(Number(INPUT_BEAT_BIAS_MS||0));
            slider.style.flex = '1';

            const apply = (ms) => {
                const n = Number(ms);
                INPUT_BEAT_BIAS_MS = Number.isFinite(n) ? n : 0;
                try { localStorage.setItem('inputBeatBiasMs', String(INPUT_BEAT_BIAS_MS)); } catch(_){}
                value.textContent = `${INPUT_BEAT_BIAS_MS}ms`;
            };

            slider.addEventListener('input', () => apply(slider.value));
            slider.addEventListener('change', () => apply(slider.value));

            row.appendChild(label);
            row.appendChild(slider);
            row.appendChild(value);
            toolsRoot.appendChild(row);
        })(this);

        // (removed) Per-track volume sliders in debug tools per user's request
    },

    // 強制的にステージを移動する関数
    forceJumpToStage(stageNumber) {
        if (stageNumber >= -1 && stageNumber <= 25) {
            // ゲームの状態をリセット
            selectedBeats.clear();
            isLoopComplete = false;
            currentStage = stageNumber;
            
            // 前のステージをクリア済みに
            clearedStages = new Set();
            for (let i = 0; i < stageNumber; i++) {
                clearedStages.add(i);
            }

            // UI更新
            updateStageContent();
            console.log(`デバッグ: ステージ${stageNumber}に移動しました`);
        }
    },
    updateTimeLabel(sec) {
        if (this._timeLabel) {
            this._timeLabel.textContent = formatTime(sec);
        }
    },
    updateTimeSlider(sec) {
        if (!this._timeSlider || this._scrubbing) return;
        const clamped = Math.max(0, Math.min(TOTAL_DURATION, sec));
        if (this._timeSlider.value !== String(clamped)) {
            this._timeSlider.value = String(clamped);
            this.updateTimeLabel(clamped);
        }
    }
};

// ステージ更新時にセレクトボックスも更新
const originalUpdateStageContent = updateStageContent;
updateStageContent = function() {
    originalUpdateStageContent.apply(this, arguments);
    const stageSelect = document.getElementById('stageSelect');
    if (stageSelect) {
        stageSelect.value = currentStage;
    }

    // Do not auto-switch audio here; playback is controlled by START/準備完了
};

//====================================================
// 初期化
//====================================================
// アセットのプリロード機能を追加
class AssetLoader {
    constructor() {
        this.totalAssets = 0;
        this.loadedAssets = 0;
        this.loadingScreen = document.getElementById('loadingScreen');
        this.progressText = this.loadingScreen.querySelector('.loading-progress');
        this.progressImage = this.loadingScreen.querySelector('.loading-image');
        // 音声は HTMLAudio 要素ではロードせず、fetch で ArrayBuffer を事前取得
        this.cache = new Map();
    }

    updateLoadingProgress() {
        const percentage = Math.floor((this.loadedAssets / this.totalAssets) * 100);
        if (this.progressText) this.progressText.textContent = `${percentage}%`;
        if (this.progressImage) {
            this.progressImage.style.setProperty('--p', percentage);
            // use turn unit for stable conic angle math
            this.progressImage.style.setProperty('--a', `${percentage / 100}turn`);
        }
    }

    // Safari対応の新しいローダー（音声は ArrayBuffer のみ事前フェッチ）
    async loadAll2() {
        try {
            const imageList = [
                'assets/images/load/load.png',
                ...Object.values(PUZZLE_IMAGES),
                'assets/images/controls/play.png',
                'assets/images/controls/pause.png',
                'assets/images/controls/prev.png',
                'assets/images/controls/next.png',
                'assets/images/controls/hint.png',
                ...Array.from({ length: 8 }, (_, i) => `assets/images/puzzles/stage8/moon${i}.png`),
                ...Array.from({ length: 4 }, (_, i) => `assets/images/puzzles/stage9/MAZE${i}.png`),
                ...Array.from({ length: 8 }, (_, i) => `assets/images/puzzles/stage10/black${i}.png`),
                ...Array.from({ length: 16 }, (_, i) => `assets/images/puzzles/wall/wall${i}.png`)
            ];

            this.totalAssets = imageList.length + 2 + 1; // images + 2 audio buffers + fonts
            this.loadedAssets = 0;

            const imagePromises = imageList.map(src => new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = async () => {
                    try { if (img.decode) await img.decode(); } catch (_) {}
                    this.cache.set(src, img);
                    this.loadedAssets++;
                    this.updateLoadingProgress();
                    resolve();
                };
                img.onerror = reject;
                img.src = src;
            }));

            const audioUrls = [AUDIO_URLS.test, AUDIO_URLS.main];
            const audioBufferPromises = audioUrls.map(url =>
                fetch(url, { cache: 'force-cache' })
                    .then(res => { if (!res.ok) throw new Error('Audio fetch failed: ' + url); return res.arrayBuffer(); })
                    .then(buf => { this.cache.set(`__audio__:${url}`, buf); this.loadedAssets++; this.updateLoadingProgress(); return { url, buf }; })
            );

            const fontPromise = (document.fonts && document.fonts.ready)
                ? document.fonts.ready.then(() => { this.loadedAssets++; this.updateLoadingProgress(); })
                : Promise.resolve().then(() => { this.loadedAssets++; this.updateLoadingProgress(); });

            const [audioPairs] = await Promise.all([Promise.all(audioBufferPromises), fontPromise, ...imagePromises]);
            window.__imageCache = this.cache;
            const buffers = {};
            (audioPairs || []).forEach(({ url, buf }) => { buffers[url] = buf; });
            window.__audioBuffers = buffers;

            this.loadingScreen.classList.add('fade-out');
            await new Promise(resolve => setTimeout(resolve, 500));
            this.loadingScreen.style.display = 'none';
            return true;
        } catch (error) {
            console.error('Asset loading failed:', error);
            this.progressText.textContent = 'Loading failed. Please refresh.';
            return false;
        }
    }

    async loadAll() {
        try {
            // 画像のリストを作成
            const imageList = [
                'assets/images/load/load.png',
                // パズル画像
                ...Object.values(PUZZLE_IMAGES),
                
                // コントロール画像
                'assets/images/controls/play.png',
                'assets/images/controls/pause.png',
                'assets/images/controls/prev.png',
                'assets/images/controls/next.png',
                'assets/images/controls/hint.png',

                // Stage 8の月の画像
                ...Array.from({ length: 8 }, (_, i) => `assets/images/puzzles/stage8/moon${i}.png`),

                // Stage 10の画像
                ...Array.from({ length: 8 }, (_, i) => `assets/images/puzzles/stage10/black${i}.png`),

                // Wall画像
                ...Array.from({ length: 16 }, (_, i) => `assets/images/puzzles/wall/wall${i}.png`)
            ];

            this.totalAssets = imageList.length + 1; // +1 for audio
            this.loadedAssets = 0;

            // 画像のプリロード
            const imagePromises = imageList.map(src => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = async () => {
                        try {
                            if (img.decode) {
                                await img.decode();
                            }
                        } catch (e) { /* ignore */ }
                        this.cache.set(src, img);
                        this.loadedAssets++;
                        this.updateLoadingProgress();
                        resolve();
                    };
                    img.onerror = reject;
                    img.src = src;
                });
            });

            // オーディオの完全なロード
            const audioPromise = new Promise((resolve, reject) => {
                let loaded = false;
                
                // データの完全なロードを待つ
                this.audio.addEventListener('loadeddata', () => {
                    // 音声データの一部がロードされた
                    this.updateLoadingProgress();
                });

                // 再生可能になるまで待つ
                this.audio.addEventListener('canplaythrough', () => {
                    if (!loaded) {
                        loaded = true;
                        this.loadedAssets++;
                        this.updateLoadingProgress();
                        resolve(this.audio);
                    }
                });

                this.audio.addEventListener('error', reject);
                
                // 明示的にロード開始
                this.audio.load();
            });

            // すべてのアセットのロード完了を待つ
            const [loadedAudio] = await Promise.all([audioPromise, ...imagePromises]);
            window.__imageCache = this.cache;
            
            // グローバルのaudio要素に設定
            window.audio = loadedAudio;

            // ローディング画面をフェードアウト
            this.loadingScreen.classList.add('fade-out');
            await new Promise(resolve => setTimeout(resolve, 500));
            this.loadingScreen.style.display = 'none';
            
            return true;
        } catch (error) {
            console.error('Asset loading failed:', error);
            this.progressText.textContent = 'Loading failed. Please refresh.';
            return false;
        }
    }
}

// ヒントが表示されるまでのループ回数を定義
const STAGE_HINT_LOOPS = {
    0: 999,  // チュートリアルはヒント非表示
    1: 8,   // 比較的簡単なステージは早めに表示
    2: 10,
    3: 20,
    4: 10,
    5: 10,
    6: 10,
    7: 10,
    8: 10,
    9: 9,
    10: 10,
    11: 12,
    12: 12,
    13: 12,
    14: 12,
    15: 12,
    16: 999,  // 最終ステージは非表示
    17: 999   // エンディングは非表示
};

// ヒントモーダルで表示する答えのテキスト
const HINT_ANSWERS = {
    0: "チュートリアルステージです",
    1: "黒黒・黒",
    2: "・黒・・・黒・黒",
    3: "黒黒・・",
    4: "黒・・黒黒・黒・",
    5: "・・・・黒黒黒黒",
    6: "黒黒・・黒黒黒・\n（数字を漢字で表記すると百と千）",
    7: "・黒・黒黒・・黒",
    8: "・黒・・・・・・\n（tips:新月から数えて三日目の月が三日月）",
    9: "黒黒黒・黒黒黒・黒黒黒黒黒黒黒黒\n（桃栗三年柿八年）",
    10: "黒黒・黒・・黒・",
    11: "・・・・・・・・・・・・黒・・・\n（点の個数を干支にする）",
    12: "黒・・・黒・・・黒・・・・・・・\n（九九/ニシガハチ、サザンガク、インクガク）",
    13: "黒黒黒黒黒・・・黒・・・黒・・・\n（点の個数/西の漢字の上部分を隠すと四という漢字になる）",
    14: "・・・・・・黒黒\n（8拍は、水金地火木土天海を表す）",
    15: "黒・・・・黒・・\n（8拍は、ドレミファソラシ・を表す）",
    16: "総クリック回数を100回以内に抑えてください。",
    17: "おめでとうございます！"
};

// ヒントシステムの初期化
function initializeHintSystem() {
    const hintButton = document.getElementById('hintButton');
    const hintModal = document.getElementById('hintModal');
    const stageLoopCounts = {};  // ステージごとのループカウント

    // ヒントボタンの表示/非表示を制御
    function updateHintButtonVisibility() {
        // チュートリアル、最終ステージ、エンディングでは非表示
        if (currentStage <= 0 || currentStage >= 16) {
            hintButton.classList.add('hidden');
            return;
        }

        // 現在のステージのループカウントを取得
        stageLoopCounts[currentStage] = stageLoopCounts[currentStage] || 0;

        // ループ完了時にカウントを増やす
        if (isLoopComplete) {
            stageLoopCounts[currentStage]++;
        }

        // 必要なループ回数に達したらヒントボタンを表示
        const requiredLoops = STAGE_HINT_LOOPS[currentStage] || 12;
        if (stageLoopCounts[currentStage] >= requiredLoops && !clearedStages.has(currentStage)) {
            hintButton.classList.remove('hidden');
        } else {
            hintButton.classList.add('hidden');
        }
    }

    // ヒントモーダルを表示
    function showHintModal() {
        const hint = STAGE_HINTS[currentStage];
        const answer = HINT_ANSWERS[currentStage];
        
        if (hint) {
            // モーダルの内容を生成
            hintModal.innerHTML = `
                <div class="hint-content">
                    <h3>ヒント</h3>
                    <p>${hint}</p>
                    <div class="hint-answer" id="hintAnswer">${answer}</div>
                    <div class="hint-buttons">
                        <button class="hint-show-answer hint-button-base" id="showAnswerButton">
                            答えを見る
                        </button>
                        <button class="hint-close hint-button-base">
                            閉じる
                        </button>
                    </div>
                </div>
            `;

            // イベントリスナーを設定
            setupModalEventListeners();

            // モーダルを表示
            hintModal.classList.add('show');
        }
    }

    // モーダルのイベントリスナーを設定
    function setupModalEventListeners() {
        const closeButton = hintModal.querySelector('.hint-close');
        const showAnswerButton = document.getElementById('showAnswerButton');
        const answerElement = document.getElementById('hintAnswer');

        closeButton.addEventListener('click', hideHintModal);
        
        showAnswerButton.addEventListener('click', () => {
            answerElement.classList.add('show');
            showAnswerButton.style.opacity = '0.5';
            showAnswerButton.disabled = true;
        });

        // モーダル外クリックで閉じる
        hintModal.addEventListener('click', (e) => {
            if (e.target === hintModal) {
                hideHintModal();
            }
        });
    }

    // ヒントモーダルを非表示
    function hideHintModal() {
        hintModal.classList.remove('show');
    }

    // ヒントボタンのクリックイベント
    hintButton.addEventListener('click', showHintModal);

    // ステージ変更時の処理をオーバーライド
    const originalUpdateStageContent = window.updateStageContent;
    window.updateStageContent = function() {
        originalUpdateStageContent.apply(this, arguments);
        if (!stageLoopCounts[currentStage]) {
            stageLoopCounts[currentStage] = 0;
        }
        updateHintButtonVisibility();
    };

    // リズムパターンチェック後の処理をオーバーライド
    const originalCheckRhythmPattern = window.checkRhythmPattern;
    window.checkRhythmPattern = function() {
        originalCheckRhythmPattern.apply(this, arguments);
        updateHintButtonVisibility();
    };

    // 音楽ループ完了時の処理をオーバーライド
    const originalUpdateRhythmDots = window.updateRhythmDots;
    window.updateRhythmDots = function() {
        originalUpdateRhythmDots.apply(this, arguments);
        if (isLoopComplete) {
            updateHintButtonVisibility();
        }
    };

    // 初期状態のセットアップ
    updateHintButtonVisibility();
}

// initialize関数に組み込む
const originalInitialize = initialize;
initialize = async function() {
    await originalInitialize.apply(this, arguments);
    initializeHintSystem();
};


// 初期化関数を修正
async function initialize() {
    // モーダルの制御
    const modal = document.getElementById('startModal');
    const startButton = document.getElementById('startButton');
    const container = document.querySelector('.container');
    
    // 最初は全て非表示
    modal.style.visibility = 'hidden';
    container.style.visibility = 'hidden';

    // アセットのロード（Safari 対応版）
    const loader = new AssetLoader();
    const loadSuccess = await loader.loadAll2();

    if (!loadSuccess) {
        return; // ロード失敗時は初期化中止
    }

    // ロード完了後にモーダルを表示
    modal.style.visibility = 'visible';
    
    // ゲーム開始を遅延させる
    const startGame = async () => {
        modal.style.display = 'none';
        // 最初にステージ画像が確実に用意されてから表示する（ほんの一瞬）
        try {
            const cache = window.__imageCache;
            const firstImage = (typeof PUZZLE_IMAGES !== 'undefined') ? PUZZLE_IMAGES[currentStage] : null;
            const cachedImg = firstImage && cache ? cache.get(firstImage) : null;
            if (cachedImg && typeof cachedImg.decode === 'function') {
                await cachedImg.decode();
            }
        } catch (_) {}
        container.style.visibility = 'visible';
        // ユーザー操作のタイミングで AudioContext を初期化 + 事前フェッチ済みバッファを提供
        if (audio && typeof audio._ensureContext === 'function') {
            try {
                await audio._ensureContext();
                const map = window.__audioBuffers || {};
                const buf = map[AUDIO_URLS.test];
                if (buf) audio.provideArrayBuffer(buf);
                await audio._load();
            } catch (_) {}
        }
        // Start background visualizer after audio is ready
        try {
            const canvas = document.getElementById('bgVisualizer');
            if (canvas) {
                window.bgVisualizer = bgVisualizer = new BackgroundVisualizer(audio, canvas);
                // 右側1/4を省く（必要に応じて調整可）
                bgVisualizer.setRange(0, 0.68);
                bgVisualizer.direction = 'lowLeft';
                bgVisualizer.updateColorForStage(currentStage);
                bgVisualizer.start();
            }
        } catch (_) {}
        updateStageContent();
        updateProgress();
        requestAnimationFrame(update);
        debugTools.initialize();

        // レイアウトが安定してからもう一度描画（初回のズレ対策）
        const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
        try {
            await nextFrame();
            await nextFrame();
            updateStageContent();
            updateProblemElements();
        } catch (_) {}
    };

    // OKボタンのクリックイベント
    if (startButton && container) {
        startButton.addEventListener('click', startGame);
    } else {
        console.error('Required elements not found');
    }
}


document.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    // エンターキー(13)またはスペースキー(32)が押された場合
    if (event.keyCode === 13 || event.keyCode === 32) {
        // デフォルトの動作を防止（スペースキーでのスクロールなど）
        event.preventDefault();
        
        // 次へボタンのクリックをシミュレート
        const nextButton = document.getElementById('nextButton');
        if (nextButton) {
            nextButton.click();
            
            // クリックエフェクトを追加（オプション）
            nextButton.style.transform = 'scale(0.95)';
            setTimeout(() => {
                nextButton.style.transform = 'scale(1)';
            }, 100);
        }
    }
});

// 初期化実行
// Keyboard shortcuts (PC): F/ArrowLeft = NEXT1 (left), J/ArrowRight = NEXT2 (right)
document.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const key = (event.key || '').toLowerCase();
    if (key === 'f' || key === 'arrowleft') {
        const btn = document.getElementById('next1Button');
        if (btn && isLeftNextEnabledForStage(currentStage)) {
            event.preventDefault();
            btn.click();
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => { btn.style.transform = 'scale(1)'; }, 100);
        }
        return;
    }
    if (key === 'j' || key === 'arrowright') {
        const btn = document.getElementById('nextButton');
        if (btn) {
            event.preventDefault();
            btn.click();
            btn.style.transform = 'scale(0.95)';
            setTimeout(() => { btn.style.transform = 'scale(1)'; }, 100);
        }
        return;
    }
});

initialize();

// Ensure secret-clear timer flags reset when entering tutorial (stage 0)
try {
  const __origUSC = updateStageContent;
  updateStageContent = function() {
    __origUSC.apply(this, arguments);
    try {
      window.__prevStageForNoNext = (typeof window.__prevStageForNoNext === 'number') ? window.__prevStageForNoNext : null;
      if (currentStage === 0 && window.__prevStageForNoNext !== 0) {
        tutorialNoNextTimerSec = 0;
        tutorialNoNextLastTs = null;
        tutorialNoNextTriggered = false;
        tutorialNextPressed = false;
      }
      window.__prevStageForNoNext = currentStage;
    } catch (_) {}
  };
} catch (_) {}

// Wrap updateProblemElements to render stage 17/18 clear pages (safe override)
try {
  const __origUPE = updateProblemElements;
  updateProblemElements = function() {
    if (currentStage === 17 || currentStage === 18) {
      const isSpecial = (currentStage === 18);
      const title = isSpecial ? 'SPECIAL CLEAR' : 'CLEAR';
      problemArea.innerHTML = `
        <div style="
          width: 100%; height: 100%; display: flex; flex-direction: column;
          align-items: center; justify-content: center; background: white;
          border-radius: 10px; padding: 20px; font-family: 'M PLUS Rounded 1c', sans-serif; color:#333;">
          <p style="font-size:16px; margin-bottom: 20px;">クリック数: ${clickCounts.getTotal()}回</p>
          <div style="font-size: 48px; font-weight: bold; margin-bottom: 30px;">${title}</div>
          <button onclick="shareToTwitter()" style="padding: 12px 24px; background-color: #1DA1F2; color: white; border: none; border-radius: 20px; font-size: 16px; cursor: pointer; font-family: 'M PLUS Rounded 1c', sans-serif; margin-top: 10px; z-index: 1000;">Xで共有</button>
        </div>
      `;
      const answerArea = document.querySelector('.answer-area');
      if (answerArea) {
        answerArea.innerHTML = `
          <p style="margin-bottom: 20px;">${isSpecial ? 'SPECIAL CLEAR' : 'CLEAR'}</p>
          <button onclick="shareToTwitter()" style="padding: 12px 24px; background-color: #1DA1F2; color: white; border: none; border-radius: 20px; font-size: 16px; cursor: pointer; font-family: 'M PLUS Rounded 1c', sans-serif; margin-top: 10px; z-index: 1000;">Xで共有</button>
        `;
      }
      return;
    }
    return __origUPE.apply(this, arguments);
  };
} catch (_) {}

// Override NEXT color mapping: swap left/right colors (left=blue, right=red)
try {
  if (typeof DEFAULT_NEXT_COLORS === 'object') {
    DEFAULT_NEXT_COLORS.left = '#007bff';
    DEFAULT_NEXT_COLORS.right = '#ff0000';
  }
} catch (_) {}
