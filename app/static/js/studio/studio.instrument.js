// filepath: app/static/js/studio/studio.instrument.js
// studio.instrument.js 重构版

// 配置参数
const NOTE_HEIGHT = 24;
const NOTE_WIDTH = 32;

// 全局变量，保证各处都能访问
let COLS = 16;

// 生成音高数组（c3-b5），从下到上
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function getPianoKeys() {
    const keys = [];
    for (let octave = 3; octave <= 5; octave++) {
        for (let i = 0; i < 12; i++) {
            keys.push({ name: NOTE_NAMES[i], octave });
        }
    }
    return keys;
}
const PIANO_KEYS = getPianoKeys(); // 36个音，从C3到B5
const ROWS = PIANO_KEYS.length;

function getNoteName(row) {
    // 从下到上排列
    const key = PIANO_KEYS[ROWS - 1 - row];
    return key.name + key.octave;
}

function isBlackKey(noteName) {
    return noteName.includes('#');
}

// 音符数据结构
let notes = []; // 改为二维数组：notes[row][col] = true/false
let selectedNotes = []; // 新增：记录选中状态的二维数组
let mode = 'edit'; // edit/select
let dragInfo = null;
let playhead = null;
let isPlaying = false;
let playheadTimer = null;
let playheadRAF = null;
let selectionBoxElem = null;

// DOM 元素
let grid, piano, playheadElem, modeBtns;

function defaultSelectedNotes() {
    selectedNotes = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
}

// instrument sample soundbank
window._instrumentSoundbank = null;
(function(){ fetch('/studio/instrument-sounds').then(r=>r.json()).then(d=>{ window._instrumentSoundbank = d.soundbank; }); })();
let instrumentSample = '/static/audio/soundbank/c4.mp3';

let c4Buffer = null;

// 预加载c4.mp3
function loadC4Buffer() {
    if (c4Buffer) return Promise.resolve();
    return fetch(instrumentSample)
        .then(res => res.arrayBuffer())
        .then(buf => audioCtx.decodeAudioData(buf))
        .then(buffer => { c4Buffer = buffer; });
}

function bindEvents() {
    // 模式按钮
    const editBtn = modeBtns.querySelector('#edit-btn');
    const selectBtn = modeBtns.querySelector('#select-btn');
    let currentMode = 'edit';
    function updateModeUI() {
        if (currentMode === 'edit') {
            editBtn.classList.add('active');
            selectBtn.classList.remove('active');
        } else {
            editBtn.classList.remove('active');
            selectBtn.classList.add('active');
        }
    }
    editBtn.onclick = () => { currentMode = 'edit'; updateModeUI(); };
    selectBtn.onclick = () => { currentMode = 'select'; updateModeUI(); };
    updateModeUI();

    // 网格交互
    let mouseDown = false;
    let dragStart = null;
    let dragType = null;
    let dragOrigin = null;
    let dragMoved = false;
    let dragSelectedOrigin = null;
    let dragNotesOrigin = null;
    let selectionBox = null;

    grid.onmousedown = function(e) {
        if (e.button !== 0 && e.button !== 2) return;
        const gridRect = grid.getBoundingClientRect();
        const x = e.clientX - gridRect.left;
        const y = e.clientY - gridRect.top;
        const col = Math.max(0, Math.min(COLS - 1, Math.floor(x / NOTE_WIDTH)));
        const row = Math.max(0, Math.min(ROWS - 1, Math.floor(y / NOTE_HEIGHT)));
        mouseDown = true;
        dragMoved = false;
        if (currentMode === 'edit') {
            if (!notes[row][col] && e.button === 0) {
                // 左键画音符
                notes[row][col] = true;
                renderNotes();
                return;
            }
            if (notes[row][col] && e.button === 2) {
                // 右键删除
                notes[row][col] = false;
                selectedNotes[row][col] = false;
                renderNotes();
                return;
            }
            if (notes[row][col] && e.button === 0) {
                // 左键拖动单音符
                dragType = 'move-single';
                dragOrigin = { row, col, x: e.clientX, y: e.clientY };
            }
        } else if (currentMode === 'select') {
            if (!notes[row][col]) {
                // 框选起点
                dragType = 'select';
                dragOrigin = { row, col, x: e.clientX, y: e.clientY };
                if (!selectionBox) {
                    selectionBox = document.createElement('div');
                    selectionBox.className = 'selection-box';
                    grid.appendChild(selectionBox);
                }
                selectionBox.style.display = 'block';
                selectionBox.style.left = (col * NOTE_WIDTH) + 'px';
                selectionBox.style.top = (row * NOTE_HEIGHT) + 'px';
                selectionBox.style.width = '0px';
                selectionBox.style.height = '0px';
            } else if (selectedNotes[row][col]) {
                // 拖动选中音符
                dragType = 'move-multi';
                dragOrigin = { row, col, x: e.clientX, y: e.clientY };
                dragSelectedOrigin = selectedNotes.map(r => r.slice());
                dragNotesOrigin = notes.map(r => r.slice());
            } else {
                // 选中单个音符
                defaultSelectedNotes();
                selectedNotes[row][col] = true;
                renderNotes();
            }
        }
    };
    grid.onmousemove = function(e) {
        if (!mouseDown || !dragType) return;
        const gridRect = grid.getBoundingClientRect();
        const x = e.clientX - gridRect.left;
        const y = e.clientY - gridRect.top;
        const col = Math.max(0, Math.min(COLS - 1, Math.floor(x / NOTE_WIDTH)));
        const row = Math.max(0, Math.min(ROWS - 1, Math.floor(y / NOTE_HEIGHT)));
        if (dragType === 'move-single') {
            const dx = Math.round((e.clientX - dragOrigin.x) / NOTE_WIDTH);
            const dy = Math.round((e.clientY - dragOrigin.y) / NOTE_HEIGHT);
            if ((dx !== 0 || dy !== 0) && notes[dragOrigin.row][dragOrigin.col]) {
                const nr = dragOrigin.row + dy;
                const nc = dragOrigin.col + dx;
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !notes[nr][nc]) {
                    notes[dragOrigin.row][dragOrigin.col] = false;
                    notes[nr][nc] = true;
                    dragOrigin.row = nr;
                    dragOrigin.col = nc;
                    dragOrigin.x = e.clientX;
                    dragOrigin.y = e.clientY;
                    renderNotes();
                }
            }
        } else if (dragType === 'select') {
            // 框选
            const minR = Math.min(dragOrigin.row, row), maxR = Math.max(dragOrigin.row, row);
            const minC = Math.min(dragOrigin.col, col), maxC = Math.max(dragOrigin.col, col);
            selectionBox.style.left = (minC * NOTE_WIDTH) + 'px';
            selectionBox.style.top = (minR * NOTE_HEIGHT) + 'px';
            selectionBox.style.width = ((maxC - minC + 1) * NOTE_WIDTH) + 'px';
            selectionBox.style.height = ((maxR - minR + 1) * NOTE_HEIGHT) + 'px';
            defaultSelectedNotes();
            for (let r = minR; r <= maxR; r++) for (let c = minC; c <= maxC; c++) if (notes[r][c]) selectedNotes[r][c] = true;
            renderNotes();
        } else if (dragType === 'move-multi') {
            // 拖动多音符
            const dx = Math.round((e.clientX - dragOrigin.x) / NOTE_WIDTH);
            const dy = Math.round((e.clientY - dragOrigin.y) / NOTE_HEIGHT);
            if (dx !== 0 || dy !== 0) {
                let canMove = true;
                for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
                    if (dragSelectedOrigin[r][c]) {
                        const nr = r + dy, nc = c + dx;
                        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || (dragNotesOrigin[nr][nc] && !dragSelectedOrigin[nr][nc])) canMove = false;
                    }
                }
                if (canMove) {
                    notes = dragNotesOrigin.map(r => r.slice());
                    selectedNotes = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
                    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
                        if (dragSelectedOrigin[r][c]) {
                            notes[r][c] = false;
                        }
                    }
                    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
                        if (dragSelectedOrigin[r][c]) {
                            const nr = r + dy, nc = c + dx;
                            notes[nr][nc] = true;
                            selectedNotes[nr][nc] = true;
                        }
                    }
                    renderNotes();
                }
            }
        }
    };
    grid.onmouseup = function(e) {
        mouseDown = false;
        dragType = null;
        dragOrigin = null;
        if (selectionBox) selectionBox.style.display = 'none';
    };
    grid.onmouseleave = function(e) {
        mouseDown = false;
        dragType = null;
        dragOrigin = null;
        if (selectionBox) selectionBox.style.display = 'none';
    };
    grid.oncontextmenu = e => e.preventDefault();

    // 播放按钮与播放逻辑
    const playBtn = modeBtns.querySelector('#play-btn');
    const pauseBtn = modeBtns.querySelector('#pause-btn');
    let localPlayRAF = null;
    let localIsPlaying = false;
    playBtn.onclick = function() {
        if (localIsPlaying) return;
        localIsPlaying = true;
        let col = 0;
        let lastCol = -1;
        const bpm = getCurrentBPM();
        const interval = 60 / bpm / 4; // 秒/格
        const startTime = performance.now() / 1000;
        function animate() {
            if (!localIsPlaying) return;
            const now = performance.now() / 1000;
            const elapsed = now - startTime;
            const pos = elapsed / interval;
            col = Math.floor(pos);
            renderPlayhead(pos);
            if (col !== lastCol && col < COLS) {
                for (let r = 0; r < ROWS; r++) {
                    if (notes[r][col]) {
                        playPianoNote(getNoteName(r));
                    }
                }
                lastCol = col;
            }
            if (col >= COLS) {
                localIsPlaying = false;
                renderPlayhead(0);
                return;
            }
            localPlayRAF = requestAnimationFrame(animate);
        }
        animate();
    };
    pauseBtn.onclick = function() {
        localIsPlaying = false;
        if (localPlayRAF) cancelAnimationFrame(localPlayRAF);
        renderPlayhead(0);
    };

    // arrangement同步播放支持
    window.studio = window.studio || {};
    window.studio.instrument = window.studio.instrument || {};
    let lastStepCol = null;
    window.studio.instrument.playFromStep = function(step, offsetSec, bpm, totalSteps, block) {
        if (!grid) return;
        let col = Math.floor(step * COLS / totalSteps);
        if (col < 0) col = 0;
        if (col >= COLS) col = COLS - 1;
        renderPlayhead(col);
        if (lastStepCol !== col) {
            for (let r = 0; r < ROWS; r++) {
                if (notes[r][col]) {
                    playPianoNote(getNoteName(r));
                }
            }
            lastStepCol = col;
        }
    };
    window.studio.instrument.stop = function() {
        renderPlayhead(0);
        lastStepCol = null;
        localIsPlaying = false;
        if (localPlayRAF) cancelAnimationFrame(localPlayRAF);
    };

    // 辅助函数
    function getCurrentBPM() {
        const bpmInput = document.querySelector('.studio-bpm input[type="number"]');
        if (bpmInput) return parseFloat(bpmInput.value) || 120;
        return 120;
    }
}

function createPianoWindow(container, gridCols) {
    container.innerHTML = '';
    // 创建主容器
    const editorRow = document.createElement('div');
    editorRow.className = 'piano-editor-row';
    // 创建钢琴键
    piano = document.createElement('div');
    piano.className = 'piano-keys';
    for (let i = 0; i < ROWS; i++) {
        const noteName = getNoteName(i);
        const key = document.createElement('div');
        key.className = 'piano-key ' + (isBlackKey(noteName) ? 'black-key' : 'white-key');
        key.innerText = noteName;
        key.addEventListener('mousedown', function(e) {
            playPianoNote(noteName);
        });
        piano.appendChild(key);
    }
    // 如果已有旧grid，先移除
    if (grid && grid.parentNode) {
        grid.parentNode.removeChild(grid);
    }
    // 创建新网格
    grid = document.createElement('div');
    grid.className = 'piano-grid';
    COLS = gridCols || 16;
    // 初始化二维数组，保留已存在音符
    if (!Array.isArray(notes) || notes.length !== ROWS || !Array.isArray(notes[0]) || notes[0].length !== COLS) {
        const old = notes;
        notes = Array.from({ length: ROWS }, (_, r) =>
            Array.from({ length: COLS }, (_, c) => (old && old[r] && old[r][c]) || false)
        );
    }
    defaultSelectedNotes();
    // 先按行生成二维数组，再一行一行append，保证结构和data-row/data-col语义一致
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            // 列分色逻辑：每8列循环，前4列浅色，后4列深色
            const colorClass = (Math.floor((c % 8) / 4) === 0) ? 'col-light' : 'col-dark';
            cell.className = 'piano-cell ' + colorClass;
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.style.position = 'absolute';
            cell.style.top = (r * NOTE_HEIGHT) + 'px';
            cell.style.left = (c * NOTE_WIDTH) + 'px';
            cell.style.width = NOTE_WIDTH + 'px';
            cell.style.height = NOTE_HEIGHT + 'px';
            grid.appendChild(cell);
        }
    }
    grid.style.position = 'relative';
    grid.style.width = (COLS * NOTE_WIDTH) + 'px';
    grid.style.height = (ROWS * NOTE_HEIGHT) + 'px';
    playheadElem = document.createElement('div');
    playheadElem.className = 'playhead';
    grid.appendChild(playheadElem);
    modeBtns = document.createElement('div');
    modeBtns.className = 'mode-btns';
    modeBtns.innerHTML = `
      <button id="edit-btn">编辑/绘笔/删除</button>
      <button id="select-btn">框选</button>
      <button id="play-btn">播放</button>
      <button id="pause-btn">暂停</button>
    `;
    container.appendChild(modeBtns);
    editorRow.appendChild(piano);
    editorRow.appendChild(grid);
    container.appendChild(editorRow);
    // 绑定交互事件
    bindEvents();
    renderNotes();
    renderPlayhead(0);
    // 添加切换音色按钮，位于钢琴窗口上方
    let instBtn = document.getElementById('instrument-add-sound-btn');
    if (!instBtn) {
        instBtn = document.createElement('button');
        instBtn.id = 'instrument-add-sound-btn'; instBtn.textContent = '切换音色';
        instBtn.style.margin = '8px';
        // 插入到 editorRow 之前，确保按钮在上方
        container.insertBefore(instBtn, editorRow);
        instBtn.addEventListener('click', function(e) {
            // remove existing menu
            const prev = document.querySelector('.instrument-sound-menu'); if (prev) prev.remove();
            const menu = document.createElement('div'); menu.className = 'instrument-sound-menu';
            menu.style.position = 'fixed'; menu.style.background = '#333'; menu.style.color = '#fff'; menu.style.zIndex = '1000';
            menu.style.maxHeight = '300px';
            menu.style.minWidth = '120px';
            menu.style.fontSize = '15px';
            menu.style.borderRadius = '6px';
            menu.style.boxShadow = '0 2px 12px #0008';
            const rect = instBtn.getBoundingClientRect(); menu.style.left = `${rect.left}px`; menu.style.top = `${rect.bottom}px`;
            // 多级菜单构建
            const sbData = window._instrumentSoundbank || {};
            Object.entries(sbData).forEach(([category, items]) => {
                const catItem = document.createElement('div');
                catItem.className = 'menu-item has-children';
                catItem.textContent = category;
                catItem.style.position = 'relative';
                catItem.style.padding = '6px 24px 6px 16px';
                catItem.style.cursor = 'pointer';
                catItem.style.whiteSpace = 'nowrap';
                // 子菜单
                const catSub = document.createElement('div');
                catSub.className = 'submenu';
                catSub.style.display = 'none';
                catSub.style.position = 'absolute';
                catSub.style.left = '100%';
                catSub.style.top = '0';
                catSub.style.background = '#333';
                catSub.style.minWidth = '120px';
                catSub.style.borderRadius = '6px';
                catSub.style.boxShadow = '0 2px 12px #0008';
                catSub.style.zIndex = '1001';
                items.forEach(s => {
                    const leaf = document.createElement('div');
                    leaf.className = 'menu-item';
                    leaf.textContent = s.name;
                    leaf.dataset.file = s.file;
                    leaf.style.padding = '6px 16px';
                    leaf.style.cursor = 'pointer';
                    leaf.style.whiteSpace = 'nowrap';
                    if (instrumentSample === s.file) leaf.style.background = '#555';
                    leaf.addEventListener('click', () => {
                        instrumentSample = s.file; c4Buffer = null; menu.remove();
                        instBtn.style.transition = 'background 0.2s';
                        instBtn.style.background = '#6c6';
                        setTimeout(()=>{instBtn.style.background='';}, 300);
                        if (typeof playPianoNote === 'function') playPianoNote('C4');
                    });
                    catSub.appendChild(leaf);
                });
                catItem.appendChild(catSub);
                // 悬停展开子菜单
                catItem.addEventListener('mouseenter', () => { catSub.style.display = 'block'; });
                catItem.addEventListener('mouseleave', () => { catSub.style.display = 'none'; });
                menu.appendChild(catItem);
            });
            document.body.appendChild(menu);
            // adjust menu position within viewport
            const { innerWidth, innerHeight } = window;
            const mRect = menu.getBoundingClientRect();
            if (mRect.bottom > innerHeight) menu.style.top = `${rect.top - mRect.height}px`;
            if (mRect.right > innerWidth) menu.style.left = `${innerWidth - mRect.width}px`;
            // close on outside click
            const closeHandler = ev => { if (!menu.contains(ev.target) && ev.target !== instBtn) { menu.remove(); document.removeEventListener('click', closeHandler); document.removeEventListener('keydown', escHandler); window.removeEventListener('resize', closeHandler); window.removeEventListener('scroll', closeHandler, true); } };
            document.addEventListener('click', closeHandler);
            // esc关闭
            const escHandler = ev => { if (ev.key === 'Escape') { menu.remove(); document.removeEventListener('click', closeHandler); document.removeEventListener('keydown', escHandler); window.removeEventListener('resize', closeHandler); window.removeEventListener('scroll', closeHandler, true); } };
            document.addEventListener('keydown', escHandler);
            // 窗口变化关闭
            window.addEventListener('resize', closeHandler);
            window.addEventListener('scroll', closeHandler, true);
        });
    }
}

// Audio playback utilities
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function getSemitoneDiff(noteName) {
    const match = noteName.match(/([A-G]#?)(\d)/);
    if (!match) return 0;
    const noteIdx = NOTE_NAMES.indexOf(match[1]);
    const octave = parseInt(match[2], 10);
    return (octave - 4) * 12 + noteIdx;
}
function playPianoNote(noteName) {
    loadC4Buffer().then(() => {
        const src = audioCtx.createBufferSource();
        src.buffer = c4Buffer;
        const semitone = getSemitoneDiff(noteName);
        src.playbackRate.value = Math.pow(2, semitone/12);
        src.connect(audioCtx.destination);
        src.start();
    });
}

// Export instrument API
window.studio = window.studio || {};
window.studio.instrument = window.studio.instrument || {};
Object.assign(window.studio.instrument, {
    playPianoNote,
    createPianoWindow
});

// Expose rendering entry for bottom panel
window.renderInstrumentEditor = function(container, segment) {
    let gridCols = 32;
    if (segment && segment.beats) {
        gridCols = Math.round(segment.beats * 4);
    } else if (segment && segment.duration) {
        try {
            const bpm = parseFloat(document.querySelector('.studio-bpm input[type="number"]').value) || 120;
            const beats = segment.duration / (60 / bpm);
            gridCols = Math.round(beats * 4);
        } catch (e) { console.warn('计算钢琴窗列数失败', e); }
    }
    createPianoWindow(container, gridCols);
};

function renderNotes() {
    // 清除旧音符
    grid.querySelectorAll('.note').forEach(n => n.remove());
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (notes[r][c]) {
                const noteElem = document.createElement('div');
                noteElem.className = 'note';
                if (selectedNotes[r][c]) noteElem.classList.add('selected');
                noteElem.style.top = r * NOTE_HEIGHT + 'px';
                noteElem.style.left = c * NOTE_WIDTH + 'px';
                noteElem.style.width = NOTE_WIDTH + 'px';
                noteElem.style.height = NOTE_HEIGHT + 'px';
                noteElem.dataset.row = r;
                noteElem.dataset.col = c;
                grid.appendChild(noteElem);
            }
        }
    }
}

function renderPlayhead(col) {
    if (!playheadElem) return;
    playheadElem.style.left = (col * NOTE_WIDTH) + 'px';
    playheadElem.style.top = '0px';
    playheadElem.style.height = (ROWS * NOTE_HEIGHT) + 'px';
    playheadElem.style.width = '2px';
}

