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
        const sounds = [
            {name: 'Kick', file: '/static/audio/drum/boombap/kick.wav'},
            {name: 'Snare', file: '/static/audio/drum/boombap/snare.wav'},
            {name: 'Hi-hat', file: '/static/audio/drum/boombap/hihat.wav'}
        ];
        sounds.forEach(sound => {
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
                cell.addEventListener('click', () => {
                    cell.classList.toggle('active');
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
        // 预加载所有鼓样本
        Promise.all(sounds.map(s => loadBuffer(s.file)));

        // 鼓机播放逻辑（Web Audio精准调度）
        let drumPlayRAF = null;
        let drumPlayStep = 0;
        let isPlaying = false;
        let playStartTime = 0;
        let scheduledStep = 0;
        let scheduledSources = [];
        const playBtn = controls.querySelector('#drum-play-btn');
        const pauseBtn = controls.querySelector('#drum-pause-btn');
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
            allRows.forEach(row => {
              const cells = row.querySelectorAll('.drum-cell');
              const cell = cells[step % subdivisionsCount];
              if(cell && cell.classList.contains('active')) {
                const file = cell.dataset.file;
                loadBuffer(file).then(buffer => {
                  // 检查是否已为该step调度过（防止重复）
                  if (!cell._lastScheduledStep || cell._lastScheduledStep !== step) {
                    cell._lastScheduledStep = step;
                    const src = audioCtx.createBufferSource();
                    src.buffer = buffer;
                    src.connect(audioCtx.destination);
                    src.start(playTime);
                    scheduledSources.push(src);
                  }
                });
              }
            });
          }
        }
        function playDrumMachine() {
          if(isPlaying) return;
          isPlaying = true;
          playBtn.disabled = true;
          pauseBtn.disabled = false;
          drumPlayStep = 0;
          scheduledStep = 0;
          playStartTime = audioCtx.currentTime + 0.05; // 稍微延迟，避免首音丢失
          const bpm = getCurrentBPM();
          const interval = 60 / bpm / subdivisions;
          scheduledSources = [];
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
          // 立即停止所有已调度但未播放的音频
          scheduledSources.forEach(src => {
            try { src.stop && src.stop(); } catch(e){}
          });
          scheduledSources = [];
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

        if(bottomInfo) bottomInfo.textContent = '';
    } else {
        bottomContent.innerHTML = '<div class="no-selection">请选择鼓机块</div>';
        if(bottomInfo) bottomInfo.textContent = '';
    }
}

window.renderDrumMachineEditor = renderDrumMachineEditor;

