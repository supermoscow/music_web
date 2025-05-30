// 主入口，协调各模块初始化
window.studio = window.studio || {};

// 设置全局主音量，默认 80%
window.masterVolume = 0.8;
// Monkey-patch Audio.play to apply master volume
(function(){
    const originalPlay = Audio.prototype.play;
    Audio.prototype.play = function(){
        this.volume = window.masterVolume;
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
        });
    }

    if(window.studio.track) window.studio.track.init();
    if(window.studio.arrangement) window.studio.arrangement.refreshArrangement();
    if(window.studio.controls) window.studio.controls.init();
    if(window.studio.bottom) window.studio.bottom.init();
});

