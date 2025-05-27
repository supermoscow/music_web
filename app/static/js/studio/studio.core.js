// studio.core.js
// 主入口，协调各模块初始化
window.studio = window.studio || {};
document.addEventListener('DOMContentLoaded', function() {
    if(window.studio.track) window.studio.track.init();
    if(window.studio.arrangement) window.studio.arrangement.refreshArrangement();
    if(window.studio.controls) window.studio.controls.init();
    if(window.studio.bottom) window.studio.bottom.init();
});

