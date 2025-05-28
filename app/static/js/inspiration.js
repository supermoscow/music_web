document.addEventListener('DOMContentLoaded', () => {
    const startRecordingButton = document.getElementById('startRecording');
    const stopRecordingButton = document.getElementById('stopRecording');
    const recordingsList = document.getElementById('recordingsList');
    const playBackingTrackButton = document.getElementById('playBackingTrack');
    const backingTrackSelect = document.getElementById('backingTrack');

    let mediaRecorder;
    let audioChunks = [];

    // Start recording
    startRecordingButton.addEventListener('click', async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = audioUrl;

            const downloadLink = document.createElement('a');
            downloadLink.href = audioUrl;
            downloadLink.download = 'recording.wav';
            downloadLink.textContent = '下载录音';

            const listItem = document.createElement('li');
            listItem.appendChild(audio);
            listItem.appendChild(downloadLink);
            recordingsList.appendChild(listItem);

            audioChunks = []; // Clear the chunks for the next recording
        };

        mediaRecorder.start();
        startRecordingButton.disabled = true;
        stopRecordingButton.disabled = false;
    });

    // Stop recording
    stopRecordingButton.addEventListener('click', () => {
        mediaRecorder.stop();
        startRecordingButton.disabled = false;
        stopRecordingButton.disabled = true;
    });

    // Remove the old playBackingTrackButton and backingTrackSelect
    if (playBackingTrackButton) playBackingTrackButton.remove();
    if (backingTrackSelect) backingTrackSelect.remove();

    // Update existing buttons to separate play and pause functionality
    const tracks = [
        { id: 'Pop', file: '/static/audio/pop.wav', progressId: 'playPopProgress', timeId: 'playPopTime' },
        { id: 'Rock', file: '/static/audio/rock.wav', progressId: 'playRockProgress', timeId: 'playRockTime' },
        { id: 'Jazz', file: '/static/audio/jazz.wav', progressId: 'playJazzProgress', timeId: 'playJazzTime' }
    ];

    tracks.forEach(track => {
        const playButton = document.getElementById(`play${track.id}`);
        const pauseButton = document.getElementById(`pause${track.id}`);
        const progressBar = document.getElementById(track.progressId);
        const timeLabel = document.getElementById(track.timeId);

        let audio = new Audio(track.file);

        playButton.addEventListener('click', () => {
            audio.play();
        });

        pauseButton.addEventListener('click', () => {
            audio.pause();
        });

        audio.addEventListener('timeupdate', () => {
            progressBar.value = (audio.currentTime / audio.duration) * 100;
            const currentTime = formatTime(audio.currentTime);
            const duration = formatTime(audio.duration);
            timeLabel.textContent = `${currentTime} / ${duration}`;
        });

        audio.addEventListener('ended', () => {
            progressBar.value = 0;
        });

        progressBar.addEventListener('click', (event) => {
            const rect = progressBar.getBoundingClientRect();
            const offsetX = event.clientX - rect.left;
            const percentage = offsetX / rect.width;
            audio.currentTime = percentage * audio.duration;
        });
    });

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // 平面虚拟钢琴自动生成（重写fileNote生成，确保与音频文件名严格一致）
    const pianoContainer = document.getElementById('piano-container');
    if (pianoContainer) {
        // 只生成c3-b5区间的琴键，文件名与目录一致
        const notes = [
            { note: 'C', isWhite: true },
            { note: 'C#', isWhite: false },
            { note: 'D', isWhite: true },
            { note: 'D#', isWhite: false },
            { note: 'E', isWhite: true },
            { note: 'F', isWhite: true },
            { note: 'F#', isWhite: false },
            { note: 'G', isWhite: true },
            { note: 'G#', isWhite: false },
            { note: 'A', isWhite: true },
            { note: 'A#', isWhite: false },
            { note: 'B', isWhite: true }
        ];
        let keys = [];
        for (let octave = 3; octave <= 5; octave++) {
            for (let i = 0; i < notes.length; i++) {
                const n = notes[i];
                // fileNote规则：升号用“-”，如C#3→c-3.mp3
                let fileNote = n.note.length === 2 ? n.note[0].toLowerCase() + '-' + octave : n.note.toLowerCase() + octave;
                let dataNote = n.note + octave;
                console.log(dataNote, fileNote);

                keys.push({
                    isWhite: n.isWhite,
                    fileNote,
                    dataNote,
                    octave,
                    note: n.note,
                    idx: i
                });
            }
        }
        // 先生成白键，记录每个白键的left
        let whiteIndex = 0;
        let whiteKeyLefts = [];
        keys.forEach((k) => {
            if (k.isWhite) {
                const key = document.createElement('div');
                key.className = 'piano-key white-key';
                key.setAttribute('data-note', k.dataNote);
                key.setAttribute('title', k.dataNote);
                key.style.left = (whiteIndex * 40) + 'px';
                key.dataset.file = k.fileNote;
                pianoContainer.appendChild(key);
                whiteKeyLefts.push(whiteIndex * 40);
                whiteIndex++;
            }
        });
        // 再生成黑键，插入到相应位置
        let whiteIndexForBlack = 0;
        keys.forEach((k, idx) => {
            if (k.isWhite) {
                whiteIndexForBlack++;
            } else {
                // 黑键只出现在C、D、F、G、A后面
                // 其前一个白键的序号 = whiteIndexForBlack - 1
                // 其left = 前一个白键left + 28
                const prevWhiteIdx = whiteIndexForBlack - 1;
                if (prevWhiteIdx >= 0 && prevWhiteIdx < whiteKeyLefts.length) {
                    const key = document.createElement('div');
                    key.className = 'piano-key black-key';
                    key.setAttribute('data-note', k.dataNote);
                    key.setAttribute('title', k.dataNote);
                    key.style.left = (whiteKeyLefts[prevWhiteIdx] + 28) + 'px';
                    key.dataset.file = k.fileNote;
                    pianoContainer.appendChild(key);
                }
            }
        });
        // 绑定事件
        pianoContainer.querySelectorAll('.piano-key').forEach(key => {
            key.addEventListener('mousedown', () => {
                key.classList.add('active');
                const fileName = key.dataset.file + '.mp3';
                const audio = new Audio(`/static/audio/piano/${fileName}`);
                audio.play();
            });
            key.addEventListener('mouseup', () => {
                key.classList.remove('active');
            });
            key.addEventListener('mouseleave', () => {
                key.classList.remove('active');
            });
        });
    }

    // ========== 虚拟钢琴键盘控制功能（新版映射） ===========
    // 白键映射
    const WHITE_KEYS = [
        // 低八度c3-b3
        { key: 'z', note: 'C3' },
        { key: 'x', note: 'D3' },
        { key: 'c', note: 'E3' },
        { key: 'v', note: 'F3' },
        { key: 'b', note: 'G3' },
        { key: 'n', note: 'A3' },
        { key: 'm', note: 'B3' },
        // 高八度c4-b4
        { key: 'q', note: 'C4' },
        { key: 'w', note: 'D4' },
        { key: 'e', note: 'E4' },
        { key: 'r', note: 'F4' },
        { key: 't', note: 'G4' },
        { key: 'y', note: 'A4' },
        { key: 'u', note: 'B4' }
    ];
    // 黑键映射
    const BLACK_KEYS = [
        // 低八度c#3, d#3, f#3, g#3, a#3
        { key: 's', note: 'C#3' },
        { key: 'd', note: 'D#3' },
        { key: 'g', note: 'F#3' },
        { key: 'h', note: 'G#3' },
        { key: 'j', note: 'A#3' },
        // 高八度c#4, d#4, f#4, g#4, a#4
        { key: '2', note: 'C#4' },
        { key: '3', note: 'D#4' },
        { key: '5', note: 'F#4' },
        { key: '6', note: 'G#4' },
        { key: '7', note: 'A#4' }
    ];
    // 八度切换
    let octaveMode = 0; // 0: c3-b3/c4-b4, 1: c4-b4/c5-b5
    // 键盘事件
    document.addEventListener('keydown', function(e) {
        if (e.repeat) return;
        const key = e.key.toLowerCase();
        // 八度切换
        if (key === '=') {
            octaveMode = 1;
            return;
        }
        if (key === '-') {
            octaveMode = 0;
            return;
        }
        // 白键
        let match = WHITE_KEYS.find(wk => wk.key === key);
        if (match) {
            let note = match.note;
            if (octaveMode === 1) {
                // c3-b3->c4-b4, c4-b4->c5-b5
                let base = parseInt(note[note.length-1]);
                note = note.slice(0, -1) + (base+1);
            }
            const pianoKey = Array.from(pianoContainer.querySelectorAll('.piano-key')).find(k => k.getAttribute('data-note') === note);
            if (pianoKey) {
                pianoKey.classList.add('active');
                const fileName = pianoKey.dataset.file + '.mp3';
                const audio = new Audio(`/static/audio/piano/${fileName}`);
                audio.play();
            }
            return;
        }
        // 黑键
        match = BLACK_KEYS.find(bk => bk.key === key);
        if (match) {
            let note = match.note;
            if (octaveMode === 1) {
                let base = parseInt(note[note.length-1]);
                note = note.slice(0, -1) + (base+1);
            }
            const pianoKey = Array.from(pianoContainer.querySelectorAll('.piano-key')).find(k => k.getAttribute('data-note') === note);
            if (pianoKey) {
                pianoKey.classList.add('active');
                const fileName = pianoKey.dataset.file + '.mp3';
                const audio = new Audio(`/static/audio/piano/${fileName}`);
                audio.play();
            }
            return;
        }
    });
    document.addEventListener('keyup', function(e) {
        const key = e.key.toLowerCase();
        let match = WHITE_KEYS.find(wk => wk.key === key);
        if (match) {
            let note = match.note;
            if (octaveMode === 1) {
                let base = parseInt(note[note.length-1]);
                note = note.slice(0, -1) + (base+1);
            }
            const pianoKey = Array.from(pianoContainer.querySelectorAll('.piano-key')).find(k => k.getAttribute('data-note') === note);
            if (pianoKey) pianoKey.classList.remove('active');
            return;
        }
        match = BLACK_KEYS.find(bk => bk.key === key);
        if (match) {
            let note = match.note;
            if (octaveMode === 1) {
                let base = parseInt(note[note.length-1]);
                note = note.slice(0, -1) + (base+1);
            }
            const pianoKey = Array.from(pianoContainer.querySelectorAll('.piano-key')).find(k => k.getAttribute('data-note') === note);
            if (pianoKey) pianoKey.classList.remove('active');
            return;
        }
    });
    // ========== 说明按钮（JS生成，内容支持换行） ==========
    // 只插入一次
    if (!document.getElementById('piano-info-btn')) {
        const octaveControlDiv = document.createElement('div');
        octaveControlDiv.style.display = 'flex';
        octaveControlDiv.style.alignItems = 'center';
        octaveControlDiv.style.gap = '10px';
        octaveControlDiv.style.marginBottom = '8px';
        // 八度按钮
        const downBtn = document.createElement('button');
        downBtn.id = 'octave-down';
        downBtn.textContent = '低八度';
        downBtn.onclick = function() { octaveMode = 0; };
        const upBtn = document.createElement('button');
        upBtn.id = 'octave-up';
        upBtn.textContent = '高八度';
        upBtn.onclick = function() { octaveMode = 1; };
        octaveControlDiv.appendChild(downBtn);
        octaveControlDiv.appendChild(upBtn);
        // 说明按钮
        const infoBtn = document.createElement('button');
        infoBtn.id = 'piano-info-btn';
        infoBtn.textContent = '说明';
        infoBtn.style.position = 'relative';
        infoBtn.style.cursor = 'pointer';
        // 说明内容
        const infoTip = document.createElement('div');
        infoTip.id = 'piano-info-tip';
        infoTip.style.display = 'none';
        infoTip.style.position = 'absolute';
        infoTip.style.left = '0';
        infoTip.style.top = '36px'; // 向下偏移更大，避免被按钮遮挡
        infoTip.style.background = '#fff';
        infoTip.style.border = '1px solid #ccc';
        infoTip.style.padding = '10px';
        infoTip.style.borderRadius = '6px';
        infoTip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        infoTip.style.whiteSpace = 'pre-line';
        infoTip.style.zIndex = '10000'; // 提高层级，避免被遮挡
        infoTip.style.minWidth = '260px'; // 增大宽度
        infoTip.style.color = 'black'; // 明确字体颜色
        infoTip.style.pointerEvents = 'none'; // 避免鼠标移入说明框导致消失
        infoTip.innerHTML =
            '键盘与琴键对应关系：<br>' +
            'Z X C V B N M : C D E F G A B<br>' +
            'S D G H J : C# D# F# G# A#<br>' +
            'Q W E R T Y U : C D E F G A B<br>' +
            '2 3 5 6 7 : C# D# F# G# A#<br>' +
            '（- 低八度，= 高八度）';
        infoBtn.onmouseenter = function() { infoTip.style.display = 'block'; };
        infoBtn.onmouseleave = function() { infoTip.style.display = 'none'; };
        infoBtn.appendChild(infoTip);
        octaveControlDiv.appendChild(infoBtn);
        // 插入到钢琴上方
        pianoContainer.parentNode.insertBefore(octaveControlDiv, pianoContainer);
    }

    // ========== 测音准功能 ===========
    // 1. 添加测音准按钮和结果区
    if (!document.getElementById('pitch-detect-btn')) {
        const pitchDiv = document.createElement('div');
        pitchDiv.style.margin = '20px 0';
        pitchDiv.style.display = 'flex';
        pitchDiv.style.alignItems = 'center';
        pitchDiv.style.gap = '20px';
        // 按钮
        const btn = document.createElement('button');
        btn.id = 'pitch-detect-btn';
        btn.textContent = '开始测音准';
        pitchDiv.appendChild(btn);
        // 仪表盘区
        const gauge = document.createElement('div');
        gauge.id = 'pitch-gauge';
        gauge.style.width = '220px';
        gauge.style.height = '80px';
        gauge.style.position = 'relative';
        gauge.style.background = '#f8f8f8';
        gauge.style.border = '1px solid #ccc';
        gauge.style.borderRadius = '10px';
        gauge.style.display = 'flex';
        gauge.style.flexDirection = 'column';
        gauge.style.justifyContent = 'center';
        gauge.style.alignItems = 'center';
        // 当前音高
        const pitchText = document.createElement('div');
        pitchText.id = 'pitch-text';
        pitchText.style.fontSize = '1.2em';
        pitchText.textContent = '音高: --';
        gauge.appendChild(pitchText);
        // 偏移量
        const offsetText = document.createElement('div');
        offsetText.id = 'pitch-offset';
        offsetText.style.fontSize = '1em';
        offsetText.textContent = '偏移: --';
        gauge.appendChild(offsetText);
        // 仪表盘进度条
        const barWrap = document.createElement('div');
        barWrap.style.width = '160px';
        barWrap.style.height = '16px';
        barWrap.style.background = '#eee';
        barWrap.style.borderRadius = '8px';
        barWrap.style.marginTop = '8px';
        barWrap.style.overflow = 'hidden';
        const bar = document.createElement('div');
        bar.id = 'pitch-bar';
        bar.style.height = '100%';
        bar.style.width = '50%';
        bar.style.background = '#4caf50';
        bar.style.transition = 'width 0.1s';
        barWrap.appendChild(bar);
        gauge.appendChild(barWrap);
        pitchDiv.appendChild(gauge);
        pianoContainer.parentNode.insertBefore(pitchDiv, pianoContainer);
    }

    // 2. 实现音高检测功能（使用Web Audio API + autocorrelation算法）
    let pitchStream = null;
    let pitchAudioCtx = null;
    let pitchAnalyser = null;
    let pitchSource = null;
    let pitchDataArray = null;
    let pitchDetecting = false;
    let pitchAnimId = null;
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    function freqToNote(freq) {
        if (!freq || freq < 50) return {note: '--', offset: 0, midi: null};
        const midi = Math.round(12 * Math.log2(freq / 440) + 69);
        const note = NOTE_NAMES[midi % 12] + Math.floor(midi / 12 - 1);
        const noteFreq = 440 * Math.pow(2, (midi - 69) / 12);
        const offset = Math.round(100 * 12 * Math.log2(freq / noteFreq)); // 音分
        return {note, offset, midi};
    }
    function autoCorrelate(buf, sampleRate) {
        // 简单自相关算法
        let SIZE = buf.length;
        let rms = 0;
        for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) return null;
        let bestOffset = -1, bestCorr = 0, foundGoodCorr = false;
        let correlations = new Array(SIZE).fill(0);
        for (let offset = 50; offset < 1000; offset++) {
            let corr = 0;
            for (let i = 0; i < SIZE - offset; i++) {
                corr += buf[i] * buf[i + offset];
            }
            correlations[offset] = corr;
            if (corr > 0.9 * bestCorr) foundGoodCorr = true;
            if (corr > bestCorr) {
                bestCorr = corr;
                bestOffset = offset;
            }
        }
        if (foundGoodCorr && bestCorr > 0.01) {
            let T = bestOffset;
            let freq = sampleRate / T;
            return freq;
        }
        return null;
    }
    async function startPitchDetect() {
        if (pitchDetecting) return;
        pitchDetecting = true;
        document.getElementById('pitch-detect-btn').textContent = '测音准中...';
        pitchStream = await navigator.mediaDevices.getUserMedia({audio:true});
        pitchAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        pitchSource = pitchAudioCtx.createMediaStreamSource(pitchStream);
        pitchAnalyser = pitchAudioCtx.createAnalyser();
        pitchAnalyser.fftSize = 2048;
        pitchSource.connect(pitchAnalyser);
        pitchDataArray = new Float32Array(pitchAnalyser.fftSize);
        function updatePitch() {
            pitchAnalyser.getFloatTimeDomainData(pitchDataArray);
            const freq = autoCorrelate(pitchDataArray, pitchAudioCtx.sampleRate);
            const {note, offset} = freqToNote(freq);
            document.getElementById('pitch-text').textContent = '音高: ' + note;
            document.getElementById('pitch-offset').textContent = '偏移: ' + (offset ? offset + ' 音分' : '--');
            // 偏移量绝对值最大50音分，映射到进度条
            let percent = Math.min(1, Math.abs(offset) / 50);
            document.getElementById('pitch-bar').style.width = (percent * 100) + '%';
            document.getElementById('pitch-bar').style.background = offset === 0 ? '#4caf50' : (offset > 0 ? '#2196f3' : '#f44336');
            pitchAnimId = requestAnimationFrame(updatePitch);
        }
        updatePitch();
    }
    function stopPitchDetect() {
        pitchDetecting = false;
        document.getElementById('pitch-detect-btn').textContent = '开始测音准';
        if (pitchAnimId) cancelAnimationFrame(pitchAnimId);
        if (pitchAudioCtx) pitchAudioCtx.close();
        if (pitchStream) pitchStream.getTracks().forEach(t => t.stop());
    }
    document.getElementById('pitch-detect-btn').onclick = function() {
        if (!pitchDetecting) startPitchDetect();
        else stopPitchDetect();
    };

    // ========== 虚拟钢琴混响功能 ===========
    let pianoAudioCtx = null;
    let reverbNodes = {};
    // 初始化时同步变量与控件
    const reverbTypeSelect = document.getElementById('reverb-type');
    const reverbMixSlider = document.getElementById('reverb-mix');
    const reverbMixValue = document.getElementById('reverb-mix-value');
    let reverbMix = reverbMixSlider ? parseFloat(reverbMixSlider.value) : 0.5;
    let currentReverbType = reverbTypeSelect ? reverbTypeSelect.value : 'none';
    const reverbIRFiles = {
        'hall': '/static/audio/hall.wav',
        'room': '/static/audio/room.wav',
        'plate': '/static/audio/plate.wav'
    };

    // 缓存每种混响类型的 AudioBuffer，避免重复加载
    let reverbBuffers = {};
    async function loadReverbBuffer(type) {
        if (!pianoAudioCtx) pianoAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (type === 'none') return null;
        if (reverbBuffers[type]) return reverbBuffers[type];
        const response = await fetch(reverbIRFiles[type]);
        const arraybuffer = await response.arrayBuffer();
        const audioBuffer = await pianoAudioCtx.decodeAudioData(arraybuffer);
        reverbBuffers[type] = audioBuffer;
        return audioBuffer;
    }

    async function playPianoWithReverb(url) {
        if (!pianoAudioCtx) pianoAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch(url);
        const arraybuffer = await response.arrayBuffer();
        const buffer = await pianoAudioCtx.decodeAudioData(arraybuffer);
        const source = pianoAudioCtx.createBufferSource();
        source.buffer = buffer;
        // 只在有混响时创建干湿通道，否则只输出原声
        if (currentReverbType !== 'none') {
            let dry = pianoAudioCtx.createGain();
            let wet = pianoAudioCtx.createGain();
            dry.gain.value = 1 - reverbMix;
            wet.gain.value = reverbMix;
            const convolver = pianoAudioCtx.createConvolver();
            const irBuffer = await loadReverbBuffer(currentReverbType);
            convolver.buffer = irBuffer;
            convolver.normalize = false;
            source.connect(dry).connect(pianoAudioCtx.destination);
            source.connect(convolver).connect(wet).connect(pianoAudioCtx.destination);
        } else {
            // 只输出原声
            source.connect(pianoAudioCtx.destination);
        }
        source.start();
    }

    // 绑定混响类型和混响程度控件
    if (reverbTypeSelect && reverbMixSlider && reverbMixValue) {
        reverbTypeSelect.addEventListener('change', function() {
            currentReverbType = this.value;
        });
        reverbMixSlider.addEventListener('input', function() {
            reverbMix = parseFloat(this.value);
            reverbMixValue.textContent = reverbMix.toFixed(2);
        });
        // 页面初始时显示混响程度数值
        reverbMixValue.textContent = reverbMixSlider.value;
    }

    // 修改琴键播放事件，使用混响
    if (pianoContainer) {
        pianoContainer.querySelectorAll('.piano-key').forEach(key => {
            key.addEventListener('mousedown', () => {
                key.classList.add('active');
                const fileName = key.dataset.file + '.mp3';
                playPianoWithReverb(`/static/audio/piano/${fileName}`);
            });
            key.addEventListener('mouseup', () => {
                key.classList.remove('active');
            });
            key.addEventListener('mouseleave', () => {
                key.classList.remove('active');
            });
        });
    }

    // ========== 鼓机（电子音序器） ==========
    // 新增：鼓组风格选择
    const DRUM_STYLE_PATH = '/static/audio/drum/';
    let drumStyles = ['default']; // 默认风格
    let currentDrumStyle = 'default';

    // 新增：动态鼓音色
    let DRUM_SOUNDS = [];
    let drumVolumes = [];
    let DRUM_STEPS = 16;
    let drumPattern = [];
    let drumCurrentStep = 0;
    let drumPlaying = false;
    let drumTimer = null;
    let drumAudioCtx = null;
    let drumBuffers = {};

    // 新增：获取所有鼓风格（目录名）
    async function fetchDrumStyles() {
        // 假设后端提供 /api/drum_styles 返回 ['default','jazz','pop','rock']
        try {
            const res = await fetch('/tool/api/drum_styles');
            drumStyles = await res.json();
        } catch {
            drumStyles = ['default'];
        }
    }
    // 新增：获取某风格下所有音色文件
    async function fetchDrumSounds(style) {
        // 假设后端提供 /api/drum_sounds?style=xxx 返回 ['kick.wav','snare.wav',...]
        try {
            const res = await fetch(`/tool/api/drum_sounds?style=${encodeURIComponent(style)}`);
            const files = await res.json();
            DRUM_SOUNDS = files.map(f => ({ name: f.replace(/\.wav$/i, ''), file: `${DRUM_STYLE_PATH}${style}/${f}` }));
        } catch {
            DRUM_SOUNDS = [];
        }
        // 音量和pattern重置
        drumVolumes = Array(DRUM_SOUNDS.length).fill(0.8);
        drumPattern = Array(DRUM_SOUNDS.length).fill(0).map(() => Array(DRUM_STEPS).fill(false));
        drumBuffers = {};
    }
    // 新增：鼓组风格选择器
    function renderDrumStyleSelector() {
        const container = document.getElementById('drum-style-selector');
        if (!container) return;
        container.innerHTML = '';
        if (!drumStyles || drumStyles.length === 0) {
            container.textContent = '无可用鼓组风格';
            return;
        }
        const label = document.createElement('label');
        label.textContent = '鼓组风格：';
        const select = document.createElement('select');
        drumStyles.forEach(style => {
            const opt = document.createElement('option');
            opt.value = style;
            opt.textContent = style;
            select.appendChild(opt);
        })
        select.value = currentDrumStyle;
        select.addEventListener('change', async (e) => {
            currentDrumStyle = e.target.value;
            await fetchDrumSounds(currentDrumStyle);
            renderDrumSequencer();
        });
        label.appendChild(select);
        container.appendChild(label);
    }

    // 加载鼓样本
    async function loadDrumBuffers() {
        if (!drumAudioCtx) drumAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        for (const sound of DRUM_SOUNDS) {
            if (!drumBuffers[sound.name]) {
                const resp = await fetch(sound.file);
                const arr = await resp.arrayBuffer();
                drumBuffers[sound.name] = await drumAudioCtx.decodeAudioData(arr);
            }
        }
    }

    // 播放某个鼓音色，增加音量参数
    function playDrum(name, volume = 1) {
        if (!drumAudioCtx) drumAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = drumBuffers[name];
        if (buffer) {
            const src = drumAudioCtx.createBufferSource();
            src.buffer = buffer;
            // 新增：通过GainNode调节音量
            const gainNode = drumAudioCtx.createGain();
            gainNode.gain.value = volume;
            src.connect(gainNode).connect(drumAudioCtx.destination);
            src.start();
        }
    }

    // 鼓机网格样式增强，确保16步网格可见
    const style = document.createElement('style');
    style.innerHTML = `
    .drum-table { border-collapse: collapse; }
    .drum-table td { width: 28px; height: 28px; border: 1px solid #bbb; text-align: center; cursor: pointer; padding: 0; }
    .drum-table td:first-child { width: 60px; font-weight: bold; background: #f5f5f5; cursor: default; }
    .drum-cell.active { background: #4caf50; }
    .drum-cell.playing { border: 2px solid #f44336; }
    .drum-cell { background: #fff; transition: background 0.2s, border 0.2s; }
    `;
    document.head.appendChild(style);

    // 新增：步数切换控件
    function renderDrumStepSelector() {
        const container = document.getElementById('drum-step-selector');
        if (!container) return;
        container.innerHTML = '';
        const label = document.createElement('label');
        label.textContent = '步数：';
        const select = document.createElement('select');
        select.innerHTML = '<option value="16">16步</option><option value="32">32步</option>';
        select.value = DRUM_STEPS;
        select.addEventListener('change', (e) => {
            const newSteps = parseInt(e.target.value);
            if (newSteps !== DRUM_STEPS) {
                // 保留原有pattern，扩展或截断
                drumPattern = drumPattern.map(row => {
                    if (row.length < newSteps) {
                        return row.concat(Array(newSteps - row.length).fill(false));
                    } else {
                        return row.slice(0, newSteps);
                    }
                });
                DRUM_STEPS = newSteps;
                drumCurrentStep = 0;
                renderDrumSequencer();
            }
        });
        label.appendChild(select);
        container.appendChild(label);
    }

    // 生成鼓机网格UI，增加音量滑块
    function renderDrumSequencer() {
        renderDrumStyleSelector(); // 新增：渲染步数选择器
        const container = document.getElementById('drum-sequencer');
        container.innerHTML = '';
        const table = document.createElement('table');
        table.className = 'drum-table';
        for (let i = 0; i < DRUM_SOUNDS.length; i++) {
            const tr = document.createElement('tr');
            const label = document.createElement('td');
            label.textContent = DRUM_SOUNDS[i].name;
            tr.appendChild(label);
            // 音量滑块
            const volTd = document.createElement('td');
            volTd.style.width = '60px';
            const volSlider = document.createElement('input');
            volSlider.type = 'range';
            volSlider.min = '0';
            volSlider.max = '1';
            volSlider.step = '0.01';
            volSlider.value = drumVolumes[i];
            volSlider.title = '音量';
            volSlider.style.width = '48px';
            volSlider.addEventListener('input', (e) => {
                drumVolumes[i] = parseFloat(e.target.value);
            });
            volTd.appendChild(volSlider);
            // 显示百分比
            const volVal = document.createElement('span');
            volVal.textContent = ' ' + Math.round(drumVolumes[i]*100) + '%';
            volSlider.addEventListener('input', (e) => {
                volVal.textContent = ' ' + Math.round(parseFloat(e.target.value)*100) + '%';
            });
            volTd.appendChild(volVal);
            tr.appendChild(volTd);
            for (let j = 0; j < DRUM_STEPS; j++) {
                const td = document.createElement('td');
                td.className = 'drum-cell';
                td.title = `第${j+1}步`;
                if (drumPattern[i][j]) td.classList.add('active');
                if (j === drumCurrentStep && drumPlaying) td.classList.add('playing');
                td.addEventListener('click', () => {
                    drumPattern[i][j] = !drumPattern[i][j];
                    renderDrumSequencer();
                });
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }
        container.appendChild(table);
    }

    // 鼓机播放主循环，调用playDrum时传入音量
    async function drumStepLoop() {
        await loadDrumBuffers();
        const bpm = parseInt(document.getElementById('drum-bpm').value) || 120;
        const interval = 60 / bpm / 4 * 1000; // 16步
        drumPlaying = true;
        function step() {
            if (!drumPlaying) return;
            for (let i = 0; i < DRUM_SOUNDS.length; i++) {
                if (drumPattern[i][drumCurrentStep]) playDrum(DRUM_SOUNDS[i].name, drumVolumes[i]);
            }
            renderDrumSequencer();
            drumCurrentStep = (drumCurrentStep + 1) % DRUM_STEPS;
            drumTimer = setTimeout(step, interval);
        }
        step();
    }
    function stopDrum() {
        drumPlaying = false;
        clearTimeout(drumTimer);
        drumCurrentStep = 0;
        renderDrumSequencer();
    }

    // 鼓机按钮事件
    const drumPlayBtn = document.getElementById('drum-play');
    const drumStopBtn = document.getElementById('drum-stop');
    if (drumPlayBtn && drumStopBtn) {
        drumPlayBtn.addEventListener('click', () => {
            if (!drumPlaying) drumStepLoop();
        });
        drumStopBtn.addEventListener('click', stopDrum);
    }
    const drumBpmInput = document.getElementById('drum-bpm');
    if (drumBpmInput) {
        drumBpmInput.addEventListener('change', () => {
            if (drumPlaying) {
                stopDrum();
                drumStepLoop();
            }
        });
    }
    // 鼓机主入口：初始化风格、音色、UI
    (async function initDrumMachine() {
        if (document.getElementById('drum-style-selector')) {
            await fetchDrumStyles();
            if (drumStyles.length > 0) {
                currentDrumStyle = drumStyles[0];
                await fetchDrumSounds(currentDrumStyle);
            }
            renderDrumStyleSelector();
        }
        if (document.getElementById('drum-step-selector')) {
            renderDrumStepSelector();
        }
        renderDrumSequencer();
    })();
});
