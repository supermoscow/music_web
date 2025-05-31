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
            if (item) {
                bottomInfo.textContent = item.querySelector('span').textContent;
            }
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
        // listen for drum block selection: update bottomInfo with track and block name
        window.addEventListener('segmentSelected', function(e) {
            currentSegment = e.detail;
            const trackItems = document.querySelectorAll('.studio-track-scroll .track-list .track-item');
            const trackName = trackItems[e.detail.trackIndex]?.querySelector('span').textContent || '';
            const blockName = e.detail.segment.name || '';
            const blockNumber = e.detail.segment.number ? (' #' + e.detail.segment.number) : '';
            bottomInfo.textContent = trackName + (blockName ? ' - ' + blockName : '') + blockNumber;
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
                    // 鼓机编辑器：如果有 currentSegment，调用新版 drum 机渲染，否则提示选择鼓机块
                    if (window.renderDrumMachineEditor) {
                        window.renderDrumMachineEditor(currentSegment);
                    } else {
                        console.error('renderDrumMachineEditor 未定义，请检查 drum_machine.js 是否已正确加载');
                        bottomContent.innerHTML = '<div style="color:red">鼓机模块加载失败</div>';
                    }
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
        window.addEventListener('segmentUpdated', function() {
            const editorTab = Array.from(bottomTabs).find(t => t.getAttribute('data-tab') === 'editor');
            if (editorTab && editorTab.classList.contains('active')) {
                editorTab.click();
            }
        });
    }

    return {
        init
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    window.studio.bottom.init();
});

window.renderDrumEditorWithPlayButton = function() {
    const bottomContent = document.getElementById('studio-bottom-content');
    bottomContent.innerHTML = `
        <div id="drum-editor">
            <button id="play-drum-button">播放鼓机</button>
            <div class="drum-grid">
                <!-- Example grid cells -->
                <div class="drum-cell active" data-file="/static/audio/drum/boombap/kick.wav"></div>
                <div class="drum-cell" data-file="/static/audio/drum/boombap/snare.wav"></div>
                <div class="drum-cell active" data-file="/static/audio/drum/boombap/hihat.wav"></div>
            </div>
        </div>
    `;

    const playButton = document.getElementById('play-drum-button');
    playButton.addEventListener('click', () => {
        const activeCells = document.querySelectorAll('.drum-cell.active');
        let index = 0;

        function playNextCell() {
            if (index >= activeCells.length) {
                return;
            }

            const cell = activeCells[index];
            const audio = new Audio(cell.dataset.file);
            audio.play();

            // Highlight the current cell
            activeCells.forEach(c => c.classList.remove('playing'));
            cell.classList.add('playing');

            index++;
            setTimeout(playNextCell, 500); // Adjust timing as needed
        }

        playNextCell();
    });
};
