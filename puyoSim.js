// ==========================================================
// Puyo Puyo Simulator Core Logic (Assumed and Extended)
// ==========================================================

// --- Constants & Global States ---
const BOARD_WIDTH = 6;
const BOARD_HEIGHT = 14;
const NEXT_MAX_COUNT = 50; // 50手先まで設定可能
const PUYO_COLORS = [1, 2, 3, 4, 5]; // 実際のぷよの色
const PUYO_EMPTY = 0;

let puyoBoard = [];
let isEditMode = false;
let selectedColor = 1; // パレットで選択されている色 (デフォルトは赤)
let autoDropEnabled = true;

// 編集モード専用のネクストリスト (50組の [puyo1, puyo2] のペア)
let editNextPuyos = [];
// プレイモードで実際に使用されるネクストキュー
let gameNextPuyos = []; 

// --- Core Utility Functions (Mocked) ---

/**
 * ぷよの色を描画するヘルパー関数
 * @param {HTMLElement} element - 描画対象のDOM要素
 * @param {number} color - ぷよの色コード (0: 空, 1-5: 色)
 */
function drawPuyo(element, color) {
    // 既存の puyo クラスを維持しつつ、色クラスのみを更新
    element.className = element.className.replace(/puyo-\d/g, ' '); 
    element.classList.add(`puyo-${color}`);
    element.classList.add('puyo'); // 念のためpuyoクラスを再保証
}

/**
 * ランダムな色を生成する (編集モードクリア時などに使用)
 * @returns {number}
 */
function getRandomColor() {
    return PUYO_COLORS[Math.floor(Math.random() * PUYO_COLORS.length)];
}

// --- Mode & Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    initializeBoard();
    initializeEditNextPuyos(); // 50手ネクストリストを初期化
    renderEditNextList();      // 50手ネクストリストをHTMLに描画
    updatePlayNextDisplay(true); // プレイモードのネクスト初期描画
    // 初期状態はプレイモードとして、EditModeの表示を制御
    document.body.classList.remove('edit-mode-active');
});

function initializeBoard() {
    const boardElement = document.getElementById('puyo-board');
    boardElement.innerHTML = '';
    // 盤面配列を初期化 (高さ14 * 幅6)
    puyoBoard = Array(BOARD_HEIGHT * BOARD_WIDTH).fill(PUYO_EMPTY);

    for (let i = 0; i < BOARD_HEIGHT * BOARD_WIDTH; i++) {
        const cell = document.createElement('div');
        cell.setAttribute('data-index', i);
        // エディットモード時のクリックハンドラ
        cell.addEventListener('click', () => handleBoardClick(i)); 
        
        const puyo = document.createElement('div');
        puyo.className = 'puyo puyo-0';
        cell.appendChild(puyo);
        boardElement.appendChild(cell);
    }
    renderBoard();
    // パレットのクリックイベントを設定
    document.querySelectorAll('#color-palette .palette-color').forEach(puyo => {
        puyo.addEventListener('click', handlePaletteClick);
    });
}

function renderBoard() {
    const cells = document.querySelectorAll('#puyo-board > div');
    puyoBoard.forEach((color, index) => {
        const puyoElement = cells[index].querySelector('.puyo');
        drawPuyo(puyoElement, color);
    });
}

function handleBoardClick(index) {
    if (isEditMode) {
        // 現在のボードの状態を更新
        puyoBoard[index] = selectedColor;
        renderBoard();
    }
}

function handlePaletteClick(event) {
    const newColor = parseInt(event.target.dataset.color);
    selectedColor = newColor;

    // 選択状態の更新 (UI)
    document.querySelectorAll('#color-palette .palette-color').forEach(p => p.classList.remove('selected'));
    event.target.classList.add('selected');
}

/**
 * ゲームモードを切り替える
 */
function toggleMode() {
    isEditMode = !isEditMode;
    document.body.classList.toggle('edit-mode-active', isEditMode);
    
    if (!isEditMode) {
        // プレイモードに入る際、ネクストキューを編集リストから初期化
        initializeGameNextFromEdit();
    } else {
        // エディットモードに入る際、リストを再描画
        renderEditNextList();
    }
}

/**
 * ゲームをリセットする (モードによって動作が異なる)
 */
function resetGame() {
    // 盤面をクリア
    puyoBoard.fill(PUYO_EMPTY);
    renderBoard();
    
    // プレイモードの場合、ネクストもリセット
    if (!isEditMode) {
        initializeGameNextFromEdit();
    }
}


// --- Play Mode Logic (Simplified Mock) ---

/**
 * プレイモードのネクスト表示を更新する
 * @param {boolean} isInitial - 初回呼び出しまたはリセット時か
 */
function updatePlayNextDisplay(isInitial = false) {
    if (isInitial) {
        // 初回はランダムで2組作成
        gameNextPuyos = [
            [getRandomColor(), getRandomColor()], // NEXT 1
            [getRandomColor(), getRandomColor()]  // NEXT 2
        ];
    }
    
    // 画面上のNEXT 1 (2つのぷよ)
    const next1Puyos = document.querySelectorAll('#next-puyo-1 .puyo');
    if (next1Puyos.length >= 2) {
        drawPuyo(next1Puyos[0], gameNextPuyos[0][0]);
        drawPuyo(next1Puyos[1], gameNextPuyos[0][1]);
    }

    // 画面上のNEXT 2 (2つのぷよ)
    const next2Puyos = document.querySelectorAll('#next-puyo-2 .puyo');
    if (next2Puyos.length >= 2) {
        drawPuyo(next2Puyos[0], gameNextPuyos[1][0]);
        drawPuyo(next2Puyos[1], gameNextPuyos[1][1]);
    }
}

/**
 * プレイモード開始時/リセット時、編集リストからネクストキューを初期化する
 */
function initializeGameNextFromEdit() {
    // 編集モードで設定された50手先をゲームのネクストキューとして使用する
    gameNextPuyos = JSON.parse(JSON.stringify(editNextPuyos));
    
    // ネクストが不足している場合、ランダムなぷよで埋める (最低2組必要)
    while (gameNextPuyos.length < 2) {
        gameNextPuyos.push([getRandomColor(), getRandomColor()]);
    }
    
    updatePlayNextDisplay(false);
}

function toggleAutoDrop() {
    autoDropEnabled = !autoDropEnabled;
    const button = document.getElementById('auto-drop-toggle-button');
    button.textContent = `自動落下: ${autoDropEnabled ? 'ON' : 'OFF'}`;
    button.classList.toggle('disabled', !autoDropEnabled);
}


// --- Edit Mode NEXT List Logic ---

/**
 * 50手先ネクストリストの配列を初期化
 */
function initializeEditNextPuyos() {
    // 初期は全てランダムな色で埋める
    editNextPuyos = [];
    for (let i = 0; i < NEXT_MAX_COUNT; i++) {
        editNextPuyos.push([getRandomColor(), getRandomColor()]);
    }
}

/**
 * 50手先ネクストリストをクリア（全て空にする）
 */
function clearEditNext() {
    if (confirm('ネクスト設定を全て空にしますか？')) {
        editNextPuyos = Array(NEXT_MAX_COUNT).fill(0).map(() => [PUYO_EMPTY, PUYO_EMPTY]);
        renderEditNextList();
    }
}

/**
 * ネクストリストのHTMLを生成し、描画する (表示バグ修正)
 */
function renderEditNextList() {
    const container = document.getElementById('edit-next-list-container');
    container.innerHTML = ''; 
    
    editNextPuyos.forEach((puyoPair, index) => {
        const [color1, color2] = puyoPair;
        
        const pairDiv = document.createElement('div');
        pairDiv.className = 'next-puyo-slot-pair';
        
        const indexSpan = document.createElement('span');
        indexSpan.textContent = `(${index + 1})`;
        pairDiv.appendChild(indexSpan);

        const rowDiv = document.createElement('div');
        rowDiv.className = 'next-puyo-row';
        
        // ぷよ1 (Slot: 0)
        const slot1 = document.createElement('div');
        slot1.className = 'next-puyo-slot';
        const puyo1 = document.createElement('div');
        puyo1.classList.add('puyo');
        drawPuyo(puyo1, color1);
        puyo1.addEventListener('click', () => handleEditNextClick(index, 0));
        slot1.appendChild(puyo1); 
        rowDiv.appendChild(slot1);

        // ぷよ2 (Slot: 1)
        const slot2 = document.createElement('div');
        slot2.className = 'next-puyo-slot';
        const puyo2 = document.createElement('div');
        puyo2.classList.add('puyo');
        drawPuyo(puyo2, color2);
        puyo2.addEventListener('click', () => handleEditNextClick(index, 1));
        slot2.appendChild(puyo2);
        rowDiv.appendChild(slot2);
        
        pairDiv.appendChild(rowDiv);
        container.appendChild(pairDiv);
    });
}

/**
 * エディットネクストリストのぷよがクリックされた時の処理
 * @param {number} index - 50手リストのインデックス (0-49)
 * @param {number} slotNum - ぷよのペア内の位置 (0: 親ぷよ, 1: 子ぷよ)
 */
function handleEditNextClick(index, slotNum) {
    if (!isEditMode) return;
    
    // 現在選択されているパレットの色に更新
    editNextPuyos[index][slotNum] = selectedColor;
    
    // UIを更新
    renderEditNextList();
    
    // (オプション) クリック後、最新の設定箇所までスクロールさせる
    const container = document.getElementById('edit-next-list-container');
    const targetElement = container.querySelector(`.next-puyo-slot-pair:nth-child(${index + 1})`);
    if (targetElement) {
        container.scrollTop = targetElement.offsetTop - container.offsetTop;
    }
}
