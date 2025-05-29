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
            const name = item ? item.querySelector('span').textContent : '未知轨道';
            bottomContent.innerHTML = `
              <div id="track-inspector">
                <div>Track Inspector: ${name}</div>
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
              const isMuted = !this.classList.toggle('active');
              window.studio.arrangement.setTrackMute(idx, this.classList.contains('active'));
            });
            const soloBtn = bottomContent.querySelector('#solo-btn');
            soloBtn.addEventListener('click', function() {
              const isSolo = !this.classList.toggle('active');
              window.studio.arrangement.setTrackSolo(idx, this.classList.contains('active'));
            });
            // update info bar as well
            updateInfo(detail);
        }

        let currentSelection = null;
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
    }

    return {
        init
    };
})();

