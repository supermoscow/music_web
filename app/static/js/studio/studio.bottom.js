// studio.bottom.js
// 底部面板切换与内容管理
window.studio = window.studio || {};
window.studio.bottom = (function() {
    function init() {
        const bottomTabs = document.querySelectorAll('.bottom-tab');
        const bottomContent = document.getElementById('studio-bottom-content');
        const tabContents = {
            inspector: '<div>Track Inspector 面板</div>',
            keyboard: '<div>Virtual Keyboard 面板</div>',
            editor: '<div>钢琴窗/鼓机编辑面板</div>',
            mixer: '<div>Mixer 面板</div>'
        };
        bottomTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                bottomTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const tabType = tab.getAttribute('data-tab');
                bottomContent.innerHTML = tabContents[tabType] || '';
            });
        });

        // handle track selection to show inspector
        let currentSelection = null;
        window.addEventListener('trackSelected', function(e) {
            currentSelection = e.detail;
            const activeTab = document.querySelector('.bottom-tab.active');
            if (activeTab && activeTab.getAttribute('data-tab') === 'inspector') {
                renderInspector(currentSelection);
            }
        });

        // override inspector tab content
        bottomTabs.forEach(tab => {
            if (tab.getAttribute('data-tab') === 'inspector') {
                tab.addEventListener('click', function() {
                    bottomTabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    if (currentSelection) {
                        renderInspector(currentSelection);
                    } else {
                        bottomContent.innerHTML = '<div id="track-inspector"><div class="no-selection">请选择轨道</div></div>';
                    }
                });
            }
        });

        function renderInspector(detail) {
            const { index, type } = detail;
            bottomContent.innerHTML = `
                <div id="track-inspector">
                    <div class="inspector-left">
                        <div class="volume-section">
                            <label>音量</label>
                            <input type="range" min="0" max="100" value="100" class="volume-slider" />
                        </div>
                        <div class="actions-section">
                            <div class="action-buttons">
                                <button class="mute-btn">M</button>
                                <button class="solo-btn">S</button>
                                <span class="arm-dot"></span>
                            </div>
                            <div class="pan-section">
                                <label>声像</label>
                                <input type="range" min="-50" max="50" value="0" class="pan-slider" />
                            </div>
                        </div>
                    </div>
                    <div class="inspector-right">
                        <div class="device-chain-placeholder">Device Chain</div>
                    </div>
                </div>
            `;
            // attach control handlers
            const inspector = document.getElementById('track-inspector');
            const volumeSlider = inspector.querySelector('.volume-slider');
            const panSlider = inspector.querySelector('.pan-slider');
            const muteBtn = inspector.querySelector('.mute-btn');
            const soloBtn = inspector.querySelector('.solo-btn');
            const armDot = inspector.querySelector('.arm-dot');
            // initial state from arrangement if available
            if (window.studio.arrangement && window.studio.arrangement.getTrackSettings) {
                const settings = window.studio.arrangement.getTrackSettings(index);
                volumeSlider.value = settings.volume * 100;
                panSlider.value = settings.pan;
                muteBtn.classList.toggle('active', settings.muted);
                soloBtn.classList.toggle('active', settings.solo);
                armDot.classList.toggle('active', settings.armed);
            }
            volumeSlider.addEventListener('input', e => {
                const vol = e.target.value / 100;
                if (window.studio.arrangement && window.studio.arrangement.setTrackVolume) {
                    window.studio.arrangement.setTrackVolume(index, vol);
                }
            });
            panSlider.addEventListener('input', e => {
                const pan = parseInt(e.target.value, 10);
                if (window.studio.arrangement && window.studio.arrangement.setTrackPan) {
                    window.studio.arrangement.setTrackPan(index, pan);
                }
            });
            muteBtn.addEventListener('click', () => {
                const newMute = !muteBtn.classList.contains('active');
                muteBtn.classList.toggle('active', newMute);
                if (window.studio.arrangement && window.studio.arrangement.setTrackMute) {
                    window.studio.arrangement.setTrackMute(index, newMute);
                }
            });
            soloBtn.addEventListener('click', () => {
                const newSolo = !soloBtn.classList.contains('active');
                soloBtn.classList.toggle('active', newSolo);
                if (window.studio.arrangement && window.studio.arrangement.setTrackSolo) {
                    window.studio.arrangement.setTrackSolo(index, newSolo);
                }
            });
            armDot.addEventListener('click', () => {
                const newArm = !armDot.classList.contains('active');
                armDot.classList.toggle('active', newArm);
                if (window.studio.arrangement && window.studio.arrangement.armTrack) {
                    window.studio.arrangement.armTrack(index, newArm);
                }
            });
        }
    }

    return {
        init
    };
})();

