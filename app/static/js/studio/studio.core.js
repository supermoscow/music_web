// 主入口，协调各模块初始化
window.studio = window.studio || {};

// 设置全局主音量，默认 80%
window.masterVolume = 0.8;
// Set up shared AudioContext and master gain node for mixer integration
window.studioAudioCtx = window.studioAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
window.masterGainNode = window.masterGainNode || window.studioAudioCtx.createGain();
window.masterGainNode.gain.value = window.masterVolume;
window.masterGainNode.connect(window.studioAudioCtx.destination);
// Monkey-patch Audio.play to route through AudioContext masterGainNode
(function(){
    const originalPlay = Audio.prototype.play;
    Audio.prototype.play = function(){
        try {
            // Prevent multiple source creation
            if (!this._mediaSource) {
                this._mediaSource = window.studioAudioCtx.createMediaElementSource(this);
                this._mediaSource.connect(window.masterGainNode);
            }
        } catch (e) {
            console.warn('Failed to connect media element to AudioContext', e);
        }
        this.volume = 1; // volume controlled by masterGainNode
        return originalPlay.apply(this, arguments);
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    // 音量滑块逻辑
    const volSlider = document.getElementById('studio-master-volume');
    if(volSlider) {
        volSlider.value = window.masterVolume * 100;
        volSlider.addEventListener('input', () => {
            window.masterVolume = volSlider.value / 100;
            window.masterGainNode.gain.value = window.masterVolume;
        });
    }

    // 先 arrangement，后 track，确保 arrangementArea 初始化
    if(window.studio.arrangement) window.studio.arrangement.refreshArrangement();
    if(window.studio.track) window.studio.track.init();
    if(window.studio.controls) window.studio.controls.init();
    if(window.studio.bottom) window.studio.bottom.init();
});

