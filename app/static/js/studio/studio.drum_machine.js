// studio.drum_machine.js
// 重写鼓机逻辑

function renderDrumMachineEditor(currentSegment) {
    const bottomContent = document.getElementById('studio-bottom-content');
    const bottomInfo = document.querySelector('.studio-bottom-info');
    const meter = document.getElementById('studio-meter-select').value;
    const beatsPerBar = parseInt(meter.split('/')[0]);
    if(currentSegment) {
        // 计算格子尺寸和总宽度
        const cellSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--drum-cell-size')) || 32;
        const subdivisions = 4; // 每拍4格
        const beatExact = currentSegment.segment.beats;
        const subdivisionsCount = beatExact * subdivisions;
        const cellWidth = cellSize;
        const totalPx = cellSize * subdivisionsCount;
        // 鼓机声音列表
        const sounds = [
            {name: 'Kick', file: '/static/audio/drum/boombap/kick.wav'},
            {name: 'Snare', file: '/static/audio/drum/boombap/snare.wav'},
            {name: 'Hi-hat', file: '/static/audio/drum/boombap/hihat.wav'}
        ];

        const segment = currentSegment.segment;
        // init or resize pattern matrix, preserve existing data
        if(!segment.pattern || segment.pattern.length !== sounds.length || segment.pattern[0].length !== subdivisionsCount) {
          const old = segment.pattern || [];
          segment.pattern = sounds.map((_, i) =>
            Array.from({length: subdivisionsCount}, (_, j) => (old[i] && old[i][j]) || false)
          );
        }

        bottomContent.innerHTML = `
          <div id="drum-editor">
            <div class="drum-editor-header">
              <div class="drum-header-label-space"></div>
              <div class="drum-header-ticks"></div>
            </div>
            <div class="drum-editor-body"><div class="drum-grid"></div></div>
          </div>`;
        const header = bottomContent.querySelector('.drum-editor-header');
        const ticksContainer = header.querySelector('.drum-header-ticks');
        const labelSpace = header.querySelector('.drum-header-label-space');
        const grid = bottomContent.querySelector('.drum-grid');
        const labelWidth = 60;
        grid.style.width = totalPx + 'px';
        labelSpace.style.width = labelWidth + 'px';
        ticksContainer.style.width = totalPx + 'px';
        // 同步滚动
        const body = bottomContent.querySelector('.drum-editor-body');
        body.addEventListener('scroll', () => { ticksContainer.scrollLeft = body.scrollLeft; });
        // 生成header
        ticksContainer.innerHTML = '';
        for (let i = 0; i < subdivisionsCount; i++) {
            const cell = document.createElement('div');
            cell.className = 'drum-header-cell';
            cell.style.width = cellWidth + 'px';
            cell.textContent = i + 1;
            ticksContainer.appendChild(cell);
        }
        // 生成鼓机行
        // sounds 已在上方声明
        sounds.forEach((sound, rowIdx) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'drum-row';
            const label = document.createElement('div');
            label.className = 'drum-sound-label';
            label.textContent = sound.name;
            rowEl.appendChild(label);
            const rowGrid = document.createElement('div');
            rowGrid.className = 'drum-row-grid';
            rowGrid.style.width = totalPx + 'px';
            for(let b=0; b<subdivisionsCount; b++) {
                const cell = document.createElement('div');
                cell.className = 'drum-cell';
                cell.style.width = cellWidth + 'px';
                cell.dataset.file = sound.file;
                // restore active state
                if(segment.pattern[rowIdx][b]) cell.classList.add('active');
                cell.addEventListener('click', () => {
                    const active = cell.classList.toggle('active');
                    segment.pattern[rowIdx][b] = active;
                    // 通知鼓块模式更新，用于刷新缩略图
                    window.dispatchEvent(new CustomEvent('segmentUpdated', { detail: { segment } }));
                });
                rowGrid.appendChild(cell);
            }
            rowEl.appendChild(rowGrid);
            grid.appendChild(rowEl);
        });

        // 鼓机播放控制UI
        const controls = document.createElement('div');
        controls.className = 'drum-controls';
        controls.innerHTML = `
          <button id="drum-play-btn">▶️ 播放</button>
          <button id="drum-pause-btn" disabled>⏸ 暂停</button>
          <progress id="drum-play-progress" value="0" max="100" style="width:120px;vertical-align:middle;"></progress>
        `;
        bottomContent.prepend(controls);

        // 事件绑定必���在DOM插入后
        const playBtn = controls.querySelector('#drum-play-btn');
        const pauseBtn = controls.querySelector('#drum-pause-btn');
        playBtn.onclick = playDrumMachine;
        pauseBtn.onclick = pauseDrumMachine;

        // 获取BPM（直接从主控栏bpm输入框获取）
        function getCurrentBPM() {
          const bpmInput = document.querySelector('.studio-bpm input[type="number"]');
          if (bpmInput) return parseFloat(bpmInput.value) || 120;
          return 120;
        }

        // Web Audio API: 预加载鼓样本
        const audioCtx = window._drumAudioCtx || (window._drumAudioCtx = new (window.AudioContext || window.webkitAudioContext)());
        const drumBuffers = {};
        async function loadBuffer(url) {
          if (drumBuffers[url]) return drumBuffers[url];
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          drumBuffers[url] = audioBuffer;
          return audioBuffer;
        }
        // 预加载所有鼓样本，返回Promise
        function preloadAllBuffers() {
          return Promise.all(sounds.map(s => loadBuffer(s.file)));
        }

        // --- 新增：全局调度去重Map ---
        let scheduledMap = [];

        // 鼓机播放逻辑（Web Audio精准调度）
        let drumPlayRAF = null;
        let drumPlayStep = 0;
        let isPlaying = false;
        let playStartTime = 0;
        let scheduledStep = 0;
        let scheduledSources = [];
        const progressBar = controls.querySelector('#drum-play-progress');
        const allRows = Array.from(grid.querySelectorAll('.drum-row'));
        function highlightStep(step) {
          allRows.forEach(row => {
            const cells = row.querySelectorAll('.drum-cell');
            cells.forEach((cell, idx) => {
              if(idx === step) {
                cell.classList.add('playing');
                cell.style.backgroundColor = '#ffe066';
              } else {
                cell.classList.remove('playing');
                cell.style.backgroundColor = '';
              }
            });
          });
        }
        function updateProgress(step) {
          progressBar.value = Math.round((step / subdivisionsCount) * 100);
        }
        async function scheduleDrumNotes(bpm, startTime, fromStep, toStep) {
          const interval = 60 / bpm / subdivisions;
          for (let step = fromStep; step < toStep; step++) {
            const playTime = startTime + (step * interval);
            allRows.forEach((row, rowIdx) => {
              const cells = row.querySelectorAll('.drum-cell');
              const cellIdx = step % subdivisionsCount;
              const cell = cells[cellIdx];
              if(cell && cell.classList.contains('active')) {
                // 只允许每个cell在一个完整循环内被调度一次
                const lastStep = scheduledMap[rowIdx][cellIdx];
                if (lastStep >= 0 && step - lastStep < subdivisionsCount) return;
                scheduledMap[rowIdx][cellIdx] = step;
                const file = cell.dataset.file;
                const buffer = drumBuffers[file];
                if (!buffer) return; // 未加载则跳过
                const src = audioCtx.createBufferSource();
                src.buffer = buffer;
                src.connect(audioCtx.destination);
                src.start(playTime);
                scheduledSources.push(src);
              }
            });
          }
        }
        async function playDrumMachine() {
          console.log('playDrumMachine called');
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }
          if(isPlaying) return;
          playBtn.disabled = true;
          pauseBtn.disabled = false;
          drumPlayStep = 0;
          scheduledStep = 0;
          scheduledSources = [];
          // 初始化调度去重Map
          scheduledMap = Array.from({length: allRows.length}, () => Array(subdivisionsCount).fill(-1));
          // --- 新增：播放前预加载所有鼓样本 ---
          await preloadAllBuffers();
          isPlaying = true;
          playStartTime = audioCtx.currentTime + 0.05; // 稍微延迟，避免首音丢失
          const bpm = getCurrentBPM();
          const interval = 60 / bpm / subdivisions;
          // 预调度前2小节
          scheduleDrumNotes(bpm, playStartTime, 0, subdivisionsCount * 2);
          function rafLoop() {
            if(!isPlaying) return;
            const now = audioCtx.currentTime;
            const elapsed = now - playStartTime;
            const step = Math.floor(elapsed / interval) % subdivisionsCount;
            highlightStep(step);
            updateProgress(step);
            // 滚动调度后续音符
            if (elapsed + 0.2 > (scheduledStep * interval)) {
              scheduleDrumNotes(bpm, playStartTime, scheduledStep, scheduledStep + subdivisionsCount);
              scheduledStep += subdivisionsCount;
            }
            drumPlayRAF = requestAnimationFrame(rafLoop);
          }
          rafLoop();
        }
        function pauseDrumMachine() {
          isPlaying = false;
          playBtn.disabled = false;
          pauseBtn.disabled = true;
          highlightStep(-1);
          if (drumPlayRAF) cancelAnimationFrame(drumPlayRAF);
          // ���即停止所有已调度但未播放的音频
          scheduledSources.forEach(src => {
            try { src.stop && src.stop(); } catch(e){}
          });
          scheduledSources = [];
          // --- 新增：暂停时清空调度Map ---
          scheduledMap = [];
        }
        function resetDrumMachine() {
          isPlaying = false;
          highlightStep(-1);
          updateProgress(0);
          playBtn.disabled = false;
          pauseBtn.disabled = true;
          if (drumPlayRAF) cancelAnimationFrame(drumPlayRAF);
        }
        window.resetDrumMachine = resetDrumMachine;

        // ======= 鼓机外部控制API =======
        // 支持外部调用：window.studioDrumMachineControl.playFromStep/stop
        window.studioDrumMachineControl = {
          /**
           * 播放鼓机，从指定step（格）开始
           * @param {number} startStep - 从第几个格子开始播放
           * @param {number} offsetTime - 当前播放头相对drum-block起点的秒数
           * @param {number} bpm - 当前BPM
           * @param {number} totalSteps - 总格数
           */
          async playFromStep(startStep, offsetTime, bpm, totalSteps) {
            if (audioCtx.state === 'suspended') await audioCtx.resume();
            await preloadAllBuffers();
            // 立即停止之前的播放
            if (isPlaying) pauseDrumMachine();
            isPlaying = true;
            playBtn && (playBtn.disabled = true);
            pauseBtn && (pauseBtn.disabled = false);
            drumPlayStep = startStep;
            scheduledStep = startStep;
            scheduledSources = [];
            scheduledMap = Array.from({length: allRows.length}, () => Array(subdivisionsCount).fill(-1));
            playStartTime = audioCtx.currentTime - offsetTime;
            // 只调度当前及后续音符
            scheduleDrumNotes(bpm, playStartTime, startStep, startStep + totalSteps);
            function rafLoop() {
              if(!isPlaying) return;
              const now = audioCtx.currentTime;
              const elapsed = now - playStartTime;
              const step = (Math.floor(elapsed / (60 / bpm / subdivisions))) % totalSteps;
              highlightStep(step);
              updateProgress(step);
              drumPlayRAF = requestAnimationFrame(rafLoop);
            }
            rafLoop();
          },
          stop() {
            pauseDrumMachine();
          }
        };

        if(bottomInfo) bottomInfo.textContent = '';
    } else {
        bottomContent.innerHTML = '<div class="no-selection">请选择鼓机块</div>';
        if(bottomInfo) bottomInfo.textContent = '';
    }
}

window.renderDrumMachineEditor = renderDrumMachineEditor;

