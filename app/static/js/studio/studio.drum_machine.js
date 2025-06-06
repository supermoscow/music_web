// studio.drum_machine.js
// 重写鼓机逻辑

async function renderDrumMachineEditor(currentSegment) {
    const bottomContent = document.getElementById('studio-bottom-content');
    const bottomInfo = document.querySelector('.studio-bottom-info');
    // load presets and soundbank once
    if (!window._drumPresets) {
      const res = await fetch('/studio/drum-sounds');
      const data = await res.json();
      window._drumPresets = data.presets;
      window._drumSoundbank = data.soundbank;
      window._drumExtra = window._drumExtra || [];
    }
    // ensure current preset is remembered
    window._drumCurrentPreset = window._drumCurrentPreset || Object.keys(window._drumPresets)[0];
    if (currentSegment) {
        // 计算格子尺寸和总宽度
        const cellSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--drum-cell-size')) || 32;
        const subdivisions = 4; // 每拍4格
        const beatExact = currentSegment.segment.beats;
        const subdivisionsCount = beatExact * subdivisions;
        const cellWidth = cellSize;
        const totalPx = cellSize * subdivisionsCount;
        // 鼓机声音列表
        // build sounds from selected preset + extras
        const style = window._drumCurrentPreset;
        const baseSounds = window._drumPresets[style] || [];
        const sounds = baseSounds.concat(window._drumExtra);

        let trackGains = []; // 新增：单轨音量数组
        trackGains = sounds.map(() => 1); // 初始化每轨音量为1

        const segment = currentSegment.segment;
        // init or resize pattern matrix, preserve existing data
        if (!segment.pattern || segment.pattern.length !== sounds.length || segment.pattern[0].length !== subdivisionsCount) {
          const old = segment.pattern || [];
          segment.pattern = sounds.map((_, i) =>
            Array.from({ length: subdivisionsCount }, (_, j) => (old[i] && old[i][j]) || false)
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
        // preset selector UI appended inside bottomContent so it clears on panel switch
        let presetSelect = document.getElementById('drum-preset-select');
        if (!presetSelect) {
          const presetBar = document.createElement('div');
          presetBar.className = 'drum-preset-bar';
          presetBar.innerHTML = '风格预设: ';
          presetSelect = document.createElement('select');
          presetSelect.id = 'drum-preset-select';
          Object.keys(window._drumPresets).forEach(style => {
            const opt = document.createElement('option'); opt.value = style; opt.textContent = style;
            presetSelect.appendChild(opt);
          });
          // 保持已选风格
          presetSelect.value = window._drumCurrentPreset;
          presetBar.appendChild(presetSelect);
          bottomContent.insertBefore(presetBar, bottomContent.firstChild);
          presetSelect.addEventListener('change', () => {
            window._drumCurrentPreset = presetSelect.value;
            renderDrumMachineEditor(currentSegment);
          });
        }
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

            const volSlider = document.createElement('input');
            volSlider.type = 'range'; volSlider.min = 0; volSlider.max = 1; volSlider.step = 0.01; volSlider.value = trackGains[rowIdx];
            volSlider.className = 'drum-volume-slider';
            volSlider.addEventListener('input', () => { trackGains[rowIdx] = parseFloat(volSlider.value); });
            rowEl.appendChild(volSlider);

            const rowGrid = document.createElement('div');
            rowGrid.className = 'drum-row-grid';
            rowGrid.style.width = totalPx + 'px';
            for (let b = 0; b < subdivisionsCount; b++) {
                const cell = document.createElement('div');
                cell.className = 'drum-cell';
                cell.style.width = cellWidth + 'px';
                cell.dataset.file = sound.file;
                // restore active state
                if (segment.pattern[rowIdx][b]) cell.classList.add('active');
                cell.addEventListener('click', () => {
                    cell.classList.toggle('active');
                    segment.pattern[rowIdx][b] = cell.classList.contains('active');
                    // 通知鼓块模式更新，用于刷新缩略图
                    window.dispatchEvent(new CustomEvent('segmentUpdated', { detail: { segment } }));
                });
                rowGrid.appendChild(cell);
            }
            rowEl.appendChild(rowGrid);
            grid.appendChild(rowEl);
        });
        // 添加新音色按钮
        let addBtn = document.getElementById('drum-add-sound-btn');
        if (!addBtn) {
          addBtn = document.createElement('button'); addBtn.id = 'drum-add-sound-btn'; addBtn.textContent = '+';
          addBtn.style.margin = '8px';
          grid.parentNode.appendChild(addBtn);
          addBtn.addEventListener('click', () => {
            // remove existing menu if any
            const prev = document.querySelector('.drum-sound-menu'); if (prev) prev.remove();
            // show selection menu near button
            const sel = document.createElement('div'); sel.className = 'drum-sound-menu';
            sel.style.position = 'fixed';
            sel.style.background = '#333'; sel.style.color = '#fff'; sel.style.zIndex = '1000';
            sel.style.maxHeight = '300px'; // allow overflow for submenus
            // position popup
            const rect = addBtn.getBoundingClientRect();
            sel.style.left = `${rect.left}px`;
            sel.style.top = `${rect.bottom}px`;
            // build hover-based hierarchical menu
            sel.innerHTML = ''; // clear any previous content
            // Drum 预设 root item
            const drumItem = document.createElement('div'); drumItem.className = 'menu-item has-children'; drumItem.textContent = '鼓机预设';
            const drumSub = document.createElement('div'); drumSub.className = 'submenu';
            Object.entries(window._drumPresets).forEach(([style, items]) => {
              const styleItem = document.createElement('div'); styleItem.className = 'menu-item has-children'; styleItem.textContent = style;
              const styleSub = document.createElement('div'); styleSub.className = 'submenu';
              items.forEach(s => {
                const leaf = document.createElement('div'); leaf.className = 'menu-item'; leaf.textContent = s.name; leaf.dataset.file = s.file;
                leaf.addEventListener('click', () => { window._drumExtra.push({ name: s.name, file: s.file }); sel.remove(); renderDrumMachineEditor(currentSegment); });
                styleSub.appendChild(leaf);
              });
              styleItem.appendChild(styleSub);
              drumSub.appendChild(styleItem);
            });
            drumItem.appendChild(drumSub);
            sel.appendChild(drumItem);
            // Soundbank root item
            const sbItem = document.createElement('div'); sbItem.className = 'menu-item has-children'; sbItem.textContent = 'Soundbank';
            const sbSub = document.createElement('div'); sbSub.className = 'submenu';
            Object.entries(window._drumSoundbank).forEach(([folder, items]) => {
              const folderItem = document.createElement('div'); folderItem.className = 'menu-item has-children'; folderItem.textContent = folder;
              const folderSub = document.createElement('div'); folderSub.className = 'submenu';
              items.forEach(s => {
                const leaf = document.createElement('div'); leaf.className = 'menu-item'; leaf.textContent = s.name; leaf.dataset.file = s.file;
                leaf.addEventListener('click', () => { window._drumExtra.push({ name: s.name, file: s.file }); sel.remove(); renderDrumMachineEditor(currentSegment); });
                folderSub.appendChild(leaf);
              });
              folderItem.appendChild(folderSub);
              sbSub.appendChild(folderItem);
            });
            sbItem.appendChild(sbSub);
            sel.appendChild(sbItem);
            document.body.appendChild(sel);
            // adjust position to fit within viewport
            const { innerWidth, innerHeight } = window;
            const menuRect = sel.getBoundingClientRect();
            if (menuRect.bottom > innerHeight) {
              sel.style.top = `${Math.max(0, rect.top - menuRect.height)}px`;
            }
            if (menuRect.right > innerWidth) {
              sel.style.left = `${Math.max(0, innerWidth - menuRect.width)}px`;
            }

            // adjust position of nested submenus on hover to keep within viewport
            sel.querySelectorAll('.menu-item.has-children').forEach(item => {
              const sub = item.querySelector('.submenu');
              item.addEventListener('mouseenter', () => {
                const rect = sub.getBoundingClientRect();
                // horizontal
                if (rect.right > window.innerWidth) {
                  sub.style.left = `-${rect.width}px`;
                } else {
                  sub.style.left = `100%`;
                }
                // vertical
                if (rect.bottom > window.innerHeight) {
                  const diff = rect.bottom - window.innerHeight;
                  sub.style.top = `-${diff}px`;
                } else {
                  sub.style.top = `0`;
                }
              });
            });

            // close popup when clicking outside
            const closeHandler = e => {
              if (!sel.contains(e.target) && e.target !== addBtn) {
                sel.remove();
                document.removeEventListener('click', closeHandler);
              }
            };
            setTimeout(() => document.addEventListener('click', closeHandler), 0);
          });
        }

        // 鼓机播放控制UI
        const controls = document.createElement('div');
        controls.className = 'drum-controls';
        controls.innerHTML = `
          <button id="drum-play-btn">▶️ 播放</button>
          <button id="drum-pause-btn" disabled>⏸ 暂停</button>
          <progress id="drum-play-progress" value="0" max="100" style="width:120px;vertical-align:middle;"></progress>
        `;
        bottomContent.prepend(controls);

        // 事件绑定必须在DOM插入后
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
              if (idx === step) {
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
              if (cell && cell.classList.contains('active')) {
                // 只允许每个cell在一个完整循环内被调度一次
                const lastStep = scheduledMap[rowIdx][cellIdx];
                if (lastStep >= 0 && step - lastStep < subdivisionsCount) return;
                scheduledMap[rowIdx][cellIdx] = step;
                const file = cell.dataset.file;
                const buffer = drumBuffers[file];
                if (!buffer) return; // 未加载则跳过
                const src = audioCtx.createBufferSource();
                src.buffer = buffer;
                const gainNode = audioCtx.createGain();
                gainNode.gain.value = trackGains[rowIdx];
                src.connect(gainNode).connect(audioCtx.destination);
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
          if (isPlaying) return;
          playBtn.disabled = true;
          pauseBtn.disabled = false;
          drumPlayStep = 0;
          scheduledStep = 0;
          scheduledSources = [];
          // 初始化调度去重Map
          scheduledMap = Array.from({ length: allRows.length }, () => Array(subdivisionsCount).fill(-1));
          // --- 新增：播放前预加载所有鼓样本 ---
          await preloadAllBuffers();
          isPlaying = true;
          playStartTime = audioCtx.currentTime + 0.05; // 稍微延迟，避免首音丢失
          const bpm = getCurrentBPM();
          const interval = 60 / bpm / subdivisions;
          // 预调度前2小节
          scheduleDrumNotes(bpm, playStartTime, 0, subdivisionsCount * 2);
          function rafLoop() {
            if (!isPlaying) return;
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
            try { src.stop && src.stop(); } catch (e) { }
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
            scheduledMap = Array.from({ length: allRows.length }, () => Array(subdivisionsCount).fill(-1));
            playStartTime = audioCtx.currentTime - offsetTime;
            // 只调度当前及后续音符
            scheduleDrumNotes(bpm, playStartTime, startStep, startStep + totalSteps);
            function rafLoop() {
              if (!isPlaying) return;
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

        if (bottomInfo) bottomInfo.textContent = '';
    } else {
        bottomContent.innerHTML = '<div class="no-selection">请选择鼓机块</div>';
        if (bottomInfo) bottomInfo.textContent = '';
    }
}

window.renderDrumMachineEditor = renderDrumMachineEditor;

