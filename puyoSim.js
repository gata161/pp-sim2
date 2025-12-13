// puyoSim.js

// --- ぷよぷよシミュレーションの定数と設定 ---

// 盤面サイズ
const WIDTH = 6;
const HEIGHT = 14; // 可視領域12 + 隠し領域2 (Y=0 から Y=13)
const NUM_NEXT_PUYOS = 2; // NEXT 1 と NEXT 2 の 2組

// ぷよの色定義
const COLORS = {
    EMPTY: 0,
    RED: 1,
    BLUE: 2,
    GREEN: 3,
    YELLOW: 4,
    GARBAGE: 5
};

// スコア計算に必要なボーナス値（ぷよぷよ通準拠）
const BONUS_TABLE = {
    // 連鎖ボーナス (CB): 1連鎖=0, 2連鎖=8, 3連鎖=16...
    CHAIN: [0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512],
    // 連結ボーナス (PB): 4個=0, 5個=2, 6個=3...
    GROUP: [0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    // 色数ボーナス (Color): 1色=0, 2色=3, 3色=6, 4色=12
    COLOR: [0, 0, 3, 6, 12]
};


// --- ゲームの状態管理 ---

let board = []; 
let currentPuyo = null; 
let nextPuyoColors = []; 
let score = 0;
let chainCount = 0;
let gameState = 'playing'; 
let currentEditColor = COLORS.EMPTY; 
let editingNextPuyos = []; 

// --- 落下ループのための変数 ---
let dropInterval = 1000; 
let dropTimer = null; 
let autoDropEnabled = false; 


// --- 初期化関数 ---

/**
 * 盤面のDOM要素を一度だけ生成する (6列x14行)
 */
function createBoardDOM() {
    const boardElement = document.getElementById('puyo-board');
    if (boardElement.hasChildNodes()) {
        // 既にDOMが存在する場合は再生成しない
        return; 
    }
    boardElement.innerHTML = ''; 

    for (let y = HEIGHT - 1; y >= 0; y--) { 
        for (let x = 0; x < WIDTH; x++) {
            const cell = document.createElement('div');
            cell.id = `cell-${x}-${y}`; 
            
            const puyo = document.createElement('div');
            puyo.className = 'puyo puyo-0'; 
            puyo.setAttribute('data-color', 0);
            
            cell.appendChild(puyo);
            boardElement.appendChild(cell);
        }
    }
}

/**
 * モバイル操作ボタンの表示/非表示をチェックし、設定する
 */
function checkMobileControlsVisibility() {
    const mobileControls = document.getElementById('mobile-controls');
    if (!mobileControls) return;

    if (gameState === 'playing' && window.innerWidth <= 650) {
        mobileControls.style.display = 'flex';
    } else {
        mobileControls.style.display = 'none';
    }
}


function initializeGame() {
    // 1. 盤面DOMを一度だけ構築 (DOMContentLoadedで実行されていることを前提とする)
    // createBoardDOM(); // <--- initializeGameからは削除

    // 2. 盤面データを空で初期化
    for (let y = 0; y < HEIGHT; y++) {
        board[y] = Array(WIDTH).fill(COLORS.EMPTY);
    }

    score = 0;
    chainCount = 0;
    gameState = 'playing';

    // ネクストぷよリストを完全にランダムなぷよで初期化
    nextPuyoColors = [getRandomPair(), getRandomPair()];
    editingNextPuyos = JSON.parse(JSON.stringify(nextPuyoColors));
    currentEditColor = COLORS.EMPTY; 

    // UIリセット
    const modeToggleButton = document.getElementById('mode-toggle-button');
    if (modeToggleButton) modeToggleButton.textContent = 'edit';
    const infoPanel = document.getElementById('info-panel');
    if (infoPanel) infoPanel.classList.remove('edit-mode-active');
    
    // 自動落下ボタンの初期化
    const autoDropButton = document.getElementById('auto-drop-toggle-button');
    if (autoDropButton) {
        if (autoDropEnabled) {
            autoDropButton.textContent = '自動落下: ON';
            autoDropButton.classList.remove('disabled');
        } else {
            autoDropButton.textContent = '自動落下: OFF';
            autoDropButton.classList.add('disabled');
        }
    }

    // 最初のぷよを生成
    generateNewPuyo(); 
    startPuyoDropLoop(); 
    
    updateUI();
    
    // イベントリスナーの設定 (初回のみ)
    if (!document.initializedKeyHandler) {
        document.addEventListener('keydown', handleInput);
        
        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const btnRotateCW = document.getElementById('btn-rotate-cw'); 
        const btnRotateCCW = document.getElementById('btn-rotate-ccw'); 
        const btnHardDrop = document.getElementById('btn-hard-drop');

        if (btnLeft) btnLeft.addEventListener('click', () => movePuyo(-1, 0));
        if (btnRight) btnRight.addEventListener('click', () => movePuyo(1, 0));
        if (btnRotateCW) btnRotateCW.addEventListener('click', rotatePuyoCW); 
        if (btnRotateCCW) btnRotateCCW.addEventListener('click', rotatePuyoCCW); 
        if (btnHardDrop) btnHardDrop.addEventListener('click', hardDrop);
        
        setupEditModeListeners(); 
        document.initializedKeyHandler = true;
    }
    
    checkMobileControlsVisibility();
    renderBoard();
}

/**
 * 盤面リセット関数 (グローバル公開)
 */
window.resetGame = function() { 
    clearInterval(dropTimer); 
    initializeGame();
}

/**
 * モード切り替え関数 (グローバル公開)
 */
window.toggleMode = function() {
    const infoPanel = document.getElementById('info-panel');
    const modeToggleButton = document.getElementById('mode-toggle-button');
    const boardElement = document.getElementById('puyo-board');
    
    if (gameState === 'playing' || gameState === 'gameover') {
        // -> エディットモードへ切り替え
        clearInterval(dropTimer); 
        gameState = 'editing';
        infoPanel.classList.add('edit-mode-active');
        
        if (modeToggleButton) modeToggleButton.textContent = 'play';
        
        checkMobileControlsVisibility();
        
        boardElement.addEventListener('click', handleBoardClickEditMode);
        
        selectPaletteColor(COLORS.EMPTY); 
        renderEditNextPuyos(); 
        renderBoard(); 
        
    } else if (gameState === 'editing') {
        // -> プレイモードへ切り替え (★修正箇所★: createBoardDOMを削除)
        gameState = 'playing';
        infoPanel.classList.remove('edit-mode-active');
        
        if (modeToggleButton) modeToggleButton.textContent = 'edit';
        
        checkMobileControlsVisibility();

        boardElement.removeEventListener('click', handleBoardClickEditMode);
        
        currentPuyo = null; 
        
        // エディットモードで編集したネクストリストをプレイモードのネクストリストに適用
        nextPuyoColors = JSON.parse(JSON.stringify(editingNextPuyos));

        generateNewPuyo(); 
        startPuyoDropLoop(); 
        
        renderBoard();
    }
}


// --- メインゲームループ ---
// (中略 - 変更なし)
function startPuyoDropLoop() {
    if (dropTimer) clearInterval(dropTimer);
    if (gameState === 'playing' && autoDropEnabled) { 
        dropTimer = setInterval(dropPuyo, dropInterval);
    }
}

function dropPuyo() {
    if (gameState !== 'playing' || !currentPuyo) return;

    const moved = movePuyo(0, -1, undefined, true);

    if (!moved) {
        clearInterval(dropTimer);
        lockPuyo();
    }
}


window.toggleAutoDrop = function() {
    const button = document.getElementById('auto-drop-toggle-button');
    if (!button) return;
    
    autoDropEnabled = !autoDropEnabled;

    if (autoDropEnabled) {
        button.textContent = '自動落下: ON';
        button.classList.remove('disabled');
        if (gameState === 'playing') {
            startPuyoDropLoop();
        }
    } else {
        button.textContent = '自動落下: OFF';
        button.classList.add('disabled');
        if (dropTimer) {
            clearInterval(dropTimer);
        }
    }
};


// --- エディットモード機能 ---
// (中略 - 変更なし)

function setupEditModeListeners() {
    const palette = document.getElementById('color-palette');
    if (palette) {
        palette.querySelectorAll('.palette-color').forEach(puyoElement => {
            puyoElement.addEventListener('click', () => {
                const color = parseInt(puyoElement.getAttribute('data-color'));
                selectPaletteColor(color);
            });
        });
    }
}

function selectPaletteColor(color) {
    currentEditColor = color;
    document.querySelectorAll('.palette-color').forEach(p => p.classList.remove('selected'));
    const selectedPuyo = document.querySelector(`.palette-color[data-color="${color}"]`);
    if (selectedPuyo) {
        selectedPuyo.classList.add('selected');
    }
}

function handleBoardClickEditMode(event) {
    if (gameState !== 'editing') return;
    
    const boardElement = document.getElementById('puyo-board');
    const rect = boardElement.getBoundingClientRect();
    const cellSize = rect.width / WIDTH; 

    let x = Math.floor((event.clientX - rect.left) / cellSize);
    let y_dom = Math.floor((event.clientY - rect.top) / cellSize); 

    let y = HEIGHT - 1 - y_dom;

    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) { 
        board[y][x] = currentEditColor;
        renderBoard(); 
    }
}

window.applyNextPuyos = function() {
    if (gameState === 'editing') {
        nextPuyoColors = JSON.parse(JSON.stringify(editingNextPuyos));
        alert('ネクストぷよの設定を保存しました。プレイモードで適用されます。');
    }
}


// --- ぷよの生成と操作 ---
// (中略 - 変更なし)
function getRandomColor() {
    return Math.floor(Math.random() * 4) + 1; 
}

function getRandomPair() {
    return [getRandomColor(), getRandomColor()];
}

function generateNewPuyo() {
    if (gameState !== 'playing') return;

    while (nextPuyoColors.length < NUM_NEXT_PUYOS) {
        nextPuyoColors.push(getRandomPair());
    }
    
    const [c1, c2] = nextPuyoColors.shift();

    currentPuyo = {
        mainColor: c1,
        subColor: c2,
        mainX: 2, 
        mainY: HEIGHT - 2, 
        rotation: 0 
    };
    
    const startingCoords = getCoordsFromState(currentPuyo);
    if (checkCollision(startingCoords)) {
        gameState = 'gameover';
        alert('ゲームオーバーです！');
        clearInterval(dropTimer); 
        updateUI();
        renderBoard();
        return; 
    }

    nextPuyoColors.push(getRandomPair());
}

function getCoordsFromState(puyoState) {
    const { mainX, mainY, rotation } = puyoState;
    let subX = mainX;
    let subY = mainY;

    if (rotation === 0) subY = mainY + 1; 
    if (rotation === 1) subX = mainX - 1; 
    if (rotation === 2) subY = mainY - 1; 
    if (rotation === 3) subX = mainX + 1; 

    return [
        { x: mainX, y: mainY },
        { x: subX, y: subY }
    ];
}


function getPuyoCoords() {
    if (!currentPuyo) return [];
    
    const coords = getCoordsFromState(currentPuyo);

    coords[0].color = currentPuyo.mainColor;
    coords[1].color = currentPuyo.subColor;
    
    return coords;
}

function getGhostFinalPositions() {
    if (!currentPuyo || gameState !== 'playing') return [];
    
    let tempBoard = board.map(row => [...row]);

    let tempPuyo = { ...currentPuyo };
    while (true) {
        let testPuyo = { ...tempPuyo, mainY: tempPuyo.mainY - 1 };
        const testCoords = getCoordsFromState(testPuyo);
        
        if (checkCollision(testCoords)) {
            break; 
        }
        tempPuyo.mainY -= 1; 
    }
    
    const fixedCoords = getCoordsFromState(tempPuyo);
    const puyoColors = [tempPuyo.mainColor, tempPuyo.subColor];
    
    fixedCoords.forEach(p => {
        if (p.y >= 0 && p.y < HEIGHT) {
            const color = (p.x === tempPuyo.mainX && p.y === tempPuyo.mainY) 
                          ? tempPuyo.mainColor 
                          : tempPuyo.subColor;
            
            tempBoard[p.y][p.x] = color;
        }
    });

    simulateGravity(tempBoard); 

    let ghostPositions = [];
    let puyoCount = 0;
    
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            const tempColor = tempBoard[y][x];
            const originalColor = board[y][x];
            
            if (originalColor === COLORS.EMPTY && 
                tempColor !== COLORS.EMPTY &&
                puyoColors.includes(tempColor) && 
                puyoCount < 2) 
            {
                ghostPositions.push({ x: x, y: y, color: tempColor });
                puyoCount++;
            }
        }
    }
    
    return ghostPositions.filter(p => p.y < HEIGHT - 2); 
}


function checkCollision(coords) {
    for (const puyo of coords) {
        if (puyo.x < 0 || puyo.x >= WIDTH || puyo.y < 0) return true;

        if (puyo.y < HEIGHT && puyo.y >= 0 && board[puyo.y][puyo.x] !== COLORS.EMPTY) {
            return true;
        }
    }
    return false;
}

function movePuyo(dx, dy, newRotation, shouldRender = true) {
    if (gameState !== 'playing' || !currentPuyo) return false; 

    const { mainX, mainY, rotation } = currentPuyo;
    const testPuyo = { 
        mainX: mainX + dx, 
        mainY: mainY + dy, 
        rotation: newRotation !== undefined ? newRotation : rotation 
    };
    
    const testCoords = getCoordsFromState(testPuyo);

    if (!checkCollision(testCoords)) {
        currentPuyo.mainX = testPuyo.mainX;
        currentPuyo.mainY = testPuyo.mainY;
        if (newRotation !== undefined) {
            currentPuyo.rotation = newRotation;
        }
        
        if (shouldRender) { 
            renderBoard();
        }
        return true;
    }
    return false;
}

function rotatePuyoCW() {
    if (gameState !== 'playing') return false;
    const newRotation = (currentPuyo.rotation + 1) % 4;
    if (movePuyo(0, 0, newRotation)) return true; 
    if (movePuyo(1, 0, newRotation)) return true; 
    if (movePuyo(-1, 0, newRotation)) return true; 
    return false;
}

function rotatePuyoCCW() {
    if (gameState !== 'playing') return false;
    const newRotation = (currentPuyo.rotation - 1 + 4) % 4;
    if (movePuyo(0, 0, newRotation)) return true; 
    if (movePuyo(1, 0, newRotation)) return true; 
    if (movePuyo(-1, 0, newRotation)) return true; 
    return false;
}

function hardDrop() {
    if (gameState !== 'playing' || !currentPuyo) return;

    clearInterval(dropTimer); 

    while (movePuyo(0, -1, undefined, false)); 

    renderBoard(); 
    
    lockPuyo(); 
}

function lockPuyo() {
    if (gameState !== 'playing' || !currentPuyo) return;

    const coords = getPuyoCoords();
    let isGameOver = false;

    for (const puyo of coords) {
        if (puyo.y >= HEIGHT - 1) { 
            isGameOver = true;
            break;
        }
        if (puyo.y >= 0) {
            board[puyo.y][puyo.x] = puyo.color;
        }
    }

    if (isGameOver) {
        gameState = 'gameover';
        alert('ゲームオーバーです！');
        clearInterval(dropTimer); 
        updateUI();
        renderBoard();
        return;
    }
    
    currentPuyo = null;
    gameState = 'chaining';
    chainCount = 0;
    
    runChain();
}

function findConnectedPuyos() {
    let disappearingGroups = [];
    let visited = Array(HEIGHT).fill(0).map(() => Array(WIDTH).fill(false));

    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            const color = board[y][x];
            
            if (color === COLORS.EMPTY || color === COLORS.GARBAGE || visited[y][x]) continue;

            let group = [];
            let stack = [{ x, y }];
            visited[y][x] = true;

            while (stack.length > 0) {
                const current = stack.pop();
                group.push(current);

                [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
                    const nx = current.x + dx;
                    const ny = current.y + dy;

                    if (nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT &&
                        !visited[ny][nx] && board[ny][nx] === color) {
                        
                        visited[ny][nx] = true;
                        stack.push({ x: nx, y: ny });
                    }
                });
            }

            if (group.length >= 4) {
                disappearingGroups.push({ group, color });
            }
        }
    }
    return disappearingGroups;
}

async function runChain() {
    
    // フェーズ1: 重力処理
    gravity(); 
    renderBoard(); 
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // フェーズ2: 連鎖チェック
    const groups = findConnectedPuyos();

    if (groups.length === 0) {
        // 連鎖終了。次のぷよへ
        gameState = 'playing';
        generateNewPuyo(); 
        startPuyoDropLoop(); 
        checkMobileControlsVisibility(); 
        renderBoard();
        return;
    }

    // フェーズ3: ぷよの削除とスコア計算
    chainCount++;

    let chainScore = calculateScore(groups, chainCount);
    score += chainScore;

    groups.forEach(({ group }) => {
        group.forEach(({ x, y }) => {
            board[y][x] = COLORS.EMPTY; 
        });
    });

    renderBoard(); 
    updateUI();

    await new Promise(resolve => setTimeout(resolve, 300));

    // フェーズ4: 次の連鎖へ
    runChain();
}

function calculateScore(groups, currentChain) {
    let totalPuyos = 0;
    let colorCount = new Set();
    let bonusTotal = 0;

    groups.forEach(({ group, color }) => {
        totalPuyos += group.length;
        colorCount.add(color);

        const groupBonusIndex = Math.min(group.length, BONUS_TABLE.GROUP.length - 1);
        bonusTotal += BONUS_TABLE.GROUP[groupBonusIndex]; 
    });

    const chainBonusIndex = Math.min(currentChain, BONUS_TABLE.CHAIN.length - 1);
    bonusTotal += BONUS_TABLE.CHAIN[chainBonusIndex]; 

    const colorBonusIndex = Math.min(colorCount.size, BONUS_TABLE.COLOR.length - 1);
    bonusTotal += BONUS_TABLE.COLOR[colorBonusIndex]; 

    const finalBonus = Math.max(1, bonusTotal);

    const totalScore = (10 * totalPuyos) * finalBonus;

    return totalScore;
}

function simulateGravity(targetBoard) {
    for (let x = 0; x < WIDTH; x++) {
        let newColumn = [];

        for (let y = 0; y < HEIGHT; y++) {
            if (targetBoard[y][x] !== COLORS.EMPTY) {
                newColumn.push(targetBoard[y][x]);
            }
        }

        for (let y = 0; y < HEIGHT; y++) {
            if (y < newColumn.length) {
                targetBoard[y][x] = newColumn[y];
            } else {
                targetBoard[y][x] = COLORS.EMPTY;
            }
        }
    }
}


function gravity() {
    simulateGravity(board);
}


// --- 描画とUI更新 ---

function renderBoard() {
    const isPlaying = gameState === 'playing';
    const currentPuyoCoords = isPlaying ? getPuyoCoords() : [];
    const ghostPuyoCoords = isPlaying ? getGhostFinalPositions() : []; 

    for (let y = HEIGHT - 1; y >= 0; y--) { 
        for (let x = 0; x < WIDTH; x++) {
            const cellElement = document.getElementById(`cell-${x}-${y}`);
            if (!cellElement) continue;

            const puyoElement = cellElement.firstChild; 
            
            let cellColor = board[y][x]; 
            let puyoClasses = `puyo puyo-${cellColor}`;
            
            const puyoInFlight = currentPuyoCoords.find(p => p.x === x && p.y === y);
            if (puyoInFlight) {
                cellColor = puyoInFlight.color; 
                puyoClasses = `puyo puyo-${cellColor}`; 
            } 
            else {
                const puyoGhost = ghostPuyoCoords.find(p => p.x === x && p.y === y);
                if (puyoGhost) {
                    cellColor = puyoGhost.color; 
                    puyoClasses = `puyo puyo-${cellColor} puyo-ghost`;
                }
            }
            
            puyoElement.className = puyoClasses;
            puyoElement.setAttribute('data-color', cellColor);
        }
    }

    if (gameState === 'playing') {
        renderPlayNextPuyo();
    } else if (gameState === 'editing') {
        renderEditNextPuyos(); 
    }
}

function renderPlayNextPuyo() {
    const slots = [document.getElementById('next-puyo-1'), document.getElementById('next-puyo-2')];
    
    const createPuyo = (color) => {
        let puyo = document.createElement('div');
        puyo.className = `puyo puyo-${color}`;
        return puyo;
    };
    
    slots.forEach((slot, index) => {
        if (!slot) return;
        slot.innerHTML = '';
        if (nextPuyoColors.length > index) {
            const [c_main, c_sub] = nextPuyoColors[index]; 
            
            slot.appendChild(createPuyo(c_main)); // 下のぷよ (メイン)
            slot.appendChild(createPuyo(c_sub)); // 上のぷよ (サブ)
        }
    });
}

function renderEditNextPuyos() {
    const slots = [document.getElementById('edit-next-1'), document.getElementById('edit-next-2')];
    
    const createPuyo = (color, listIndex, puyoIndex) => {
        let puyo = document.createElement('div');
        puyo.className = `puyo puyo-${color}`;
        
        puyo.addEventListener('click', (event) => {
            event.stopPropagation(); 
            if (gameState !== 'editing') return;
            
            if (editingNextPuyos.length > listIndex) {
                editingNextPuyos[listIndex][puyoIndex] = currentEditColor; 
                renderEditNextPuyos(); 
            }
        });
        
        return puyo;
    };
    
    slots.forEach((slot, listIndex) => { 
        if (!slot) return;
        slot.innerHTML = '';
        if (editingNextPuyos.length > listIndex) {
            const [c_main, c_sub] = editingNextPuyos[listIndex];
            
            slot.appendChild(createPuyo(c_main, listIndex, 0)); // 下のぷよ (メイン)
            slot.appendChild(createPuyo(c_sub, listIndex, 1)); // 上のぷよ (サブ)
        }
    });
}


function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('chain-count').textContent = chainCount;
}

// --- 入力処理 ---

function handleInput(event) {
    if (gameState !== 'playing') return; 

    switch (event.key) {
        case 'ArrowLeft':
            movePuyo(-1, 0); 
            break;
        case 'ArrowRight':
            movePuyo(1, 0); 
            break;
        case 'z':
        case 'Z':
            rotatePuyoCW(); 
            break;
        case 'x':
        case 'X':
            rotatePuyoCCW(); 
            break;
        case 'ArrowDown':
            clearInterval(dropTimer);
            movePuyo(0, -1); 
            // 自動落下ONの場合のみタイマーを再開
            if (autoDropEnabled) { 
                startPuyoDropLoop(); 
            }
            break;
        case ' ': 
            event.preventDefault(); 
            hardDrop(); 
            break;
    }
}

// ゲーム開始
document.addEventListener('DOMContentLoaded', () => {
    // 最初に一度だけDOMを構築
    createBoardDOM();
    initializeGame();
    window.addEventListener('resize', checkMobileControlsVisibility);
});
