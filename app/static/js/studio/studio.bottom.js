// studio.bottom.js
// 底部面板切换与内容管理
window.studio = window.studio || {};
window.studio.bottom = (function() {
    function init() {
        const bottomTabs = document.querySelectorAll('.bottom-tab');
        const bottomContent = document.getElementById('studio-bottom-content');
        const bottomInfo = document.querySelector('.studio-bottom-info');

        // helper to update info bar
        function updateInfo(detail) {
            const items = document.querySelectorAll('.studio-track-scroll .track-list .track-item');
            const item = items[detail.index];
            bottomInfo.textContent = item ? item.querySelector('span').textContent : '';
        }

        const tabContents = {
            inspector: '<div>Track Inspector 面板</div>',
            keyboard: '<div>Virtual Keyboard 面板</div>',
            editor: '<div>钢琴窗/鼓机编辑面板</div>',
            mixer: '<div>Mixer 面板</div>'
        };

        // render inspector UI for selected track
        function renderInspector(detail) {
            // get selected track name
            const items = document.querySelectorAll('.studio-track-scroll .track-list .track-item');
            const item = items[detail.index];
            bottomContent.innerHTML = `
              <div id="track-inspector">
                <label>Volume: <input type="range" id="volume-slider" min="0" max="1" step="0.01" value="${window.studio.arrangement.getTrackSettings(detail.index).volume}"></label>
                <label>Pan: <input type="range" id="pan-slider" min="-50" max="50" step="1" value="${window.studio.arrangement.getTrackSettings(detail.index).pan}"></label>
                <button id="mute-btn" class="${window.studio.arrangement.getTrackSettings(detail.index).muted ? 'active' : ''}">Mute</button>
                <button id="solo-btn" class="${window.studio.arrangement.getTrackSettings(detail.index).solo ? 'active' : ''}">Solo</button>
              </div>
            `;
            // attach control listeners
            const idx = detail.index;
            const volSlider = bottomContent.querySelector('#volume-slider');
            volSlider.addEventListener('input', function() {
              window.studio.arrangement.setTrackVolume(idx, parseFloat(this.value));
            });
            const panSlider = bottomContent.querySelector('#pan-slider');
            panSlider.addEventListener('input', function() {
              window.studio.arrangement.setTrackPan(idx, parseInt(this.value, 10));
            });
            const muteBtn = bottomContent.querySelector('#mute-btn');
            muteBtn.addEventListener('click', function() {
              this.classList.toggle('active');
              window.studio.arrangement.setTrackMute(idx, this.classList.contains('active'));
            });
            const soloBtn = bottomContent.querySelector('#solo-btn');
            soloBtn.addEventListener('click', function() {
              this.classList.toggle('active');
              window.studio.arrangement.setTrackSolo(idx, this.classList.contains('active'));
            });
            // update info bar as well
            updateInfo(detail);
        }

        let currentSelection = null;
        let currentSegment = null;
        // listen for drum block selection
        window.addEventListener('segmentSelected', function(e) {
            currentSegment = e.detail;
        });
        bottomTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                bottomTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const tabType = tab.getAttribute('data-tab');
                if(tabType === 'inspector') {
                    if(currentSelection) {
                        renderInspector(currentSelection);
                        updateInfo(currentSelection);
                    } else {
                        bottomContent.innerHTML = '<div id="track-inspector"><div class="no-selection">请选择轨道</div></div>';
                        bottomInfo.textContent = '';
                    }
                } else if(tabType === 'editor') {
                    // render drum editor if a drum block is selected
                    const meter = document.getElementById('studio-meter-select').value;
                    const beatsPerBar = parseInt(meter.split('/')[0]);
                    if(currentSegment) {
                        // compute cell size and total width based on CSS variable for square cells
                        const cellSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--drum-cell-size'));
                        const subdivisions = 4; // 4 cells per beat
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
                        const labelWidth = 60; // width of sound-label column
                        grid.style.width = totalPx + 'px';
                        // setup header label-space and ticks container
                        labelSpace.style.width = labelWidth + 'px';
                        ticksContainer.style.width = totalPx + 'px';
                        // sync scrolling between body and ticks container
                        const body = bottomContent.querySelector('.drum-editor-body');
                        body.addEventListener('scroll', () => { ticksContainer.scrollLeft = body.scrollLeft; });
                        // generate header cells matching grid subdivisions
                        ticksContainer.innerHTML = '';
                        for (let i = 0; i < subdivisionsCount; i++) {
                            const cell = document.createElement('div');
                            cell.className = 'drum-header-cell';
                            cell.style.width = cellWidth + 'px';
                            cell.textContent = i + 1;
                            ticksContainer.appendChild(cell);
                        }
                        // add drum machine rows
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
                                    const audio = new Audio(sound.file);
                                    audio.play();
                                });
                                rowGrid.appendChild(cell);
                            }
                            rowEl.appendChild(rowGrid);
                            grid.appendChild(rowEl);
                        });
                    } else {
                        bottomContent.innerHTML = '<div class="no-selection">请选择鼓机块</div>';
                    }
                    bottomInfo.textContent = '';
                } else if(tabType === 'keyboard') {
                    bottomContent.innerHTML = tabContents[tabType] || '';
                    bottomInfo.textContent = '';
                } else {
                    bottomContent.innerHTML = tabContents[tabType] || '';
                    bottomInfo.textContent = '';
                }
            });
        });

        // 默认打开 Inspector tab
        const defaultTab = Array.from(bottomTabs).find(t => t.getAttribute('data-tab') === 'inspector');
        if(defaultTab) defaultTab.click();

        // get reference to inspector tab
        const inspectorTab = Array.from(bottomTabs).find(t => t.getAttribute('data-tab') === 'inspector');

        // handle track selection to show inspector
        window.addEventListener('trackSelected', function(e) {
            currentSelection = e.detail;
            // activate inspector tab
            if(inspectorTab) inspectorTab.click();
        });
        // 初始选择第一轨道
        const firstTrack = document.querySelector('.studio-track-scroll .track-list .track-item');
        if (firstTrack) firstTrack.click();

        // live update editor when segment changes size/move
        const editorTab = Array.from(bottomTabs).find(t => t.getAttribute('data-tab') === 'editor');
        window.addEventListener('segmentUpdated', function(e) {
            if (editorTab && editorTab.classList.contains('active')) {
                editorTab.click();
            }
        });

        // handle playhead movement to trigger drum block playback
        window.addEventListener('playheadMoved', function(e) {
            const playheadPosition = e.detail.position;
            const drumBlocks = document.querySelectorAll('.track-item[data-type="drum"]');

            drumBlocks.forEach(block => {
                const startTime = parseFloat(block.dataset.startTime);
                const endTime = parseFloat(block.dataset.endTime);
                const audio = block.audioInstance || new Audio(block.dataset.audioSrc);

                if (playheadPosition >= startTime && playheadPosition <= endTime) {
                    if (audio.paused) {
                        audio.play();
                        block.audioInstance = audio;
                    }
                } else {
                    if (!audio.paused) {
                        audio.pause();
                    }
                }
            });
        });
    }

    return {
        init
    };
})();

