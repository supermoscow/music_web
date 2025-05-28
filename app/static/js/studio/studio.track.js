// studio.track.js
// 轨道面板相关逻辑
window.studio = window.studio || {};
window.studio.track = (function() {
    let trackCount = 0;

    function syncScroll(scrollEl, targetEl) {
        scrollEl.addEventListener('scroll', function() {
            targetEl.scrollTop = scrollEl.scrollTop;
        });
        targetEl.addEventListener('scroll', function() {
            scrollEl.scrollTop = targetEl.scrollTop;
        });
    }

    function init() {
        const addTrackBtn = document.getElementById('add-track-btn');
        const addTrackMenu = document.getElementById('add-track-menu');
        // 适配新结构：track-list 在 .studio-track-scroll 内
        const trackList = document.querySelector('.studio-track-scroll .track-list');
        addTrackBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            addTrackMenu.style.display = addTrackMenu.style.display === 'block' ? 'none' : 'block';
        });
        document.body.addEventListener('click', function() {
            addTrackMenu.style.display = 'none';
        });
        addTrackMenu.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                trackCount++;
                const type = btn.getAttribute('data-type');
                const track = document.createElement('div');
                track.className = 'track-item';
                track.setAttribute('data-type', type);
                // initialize unarmed
                track.dataset.armed = 'false';
                let icon = '';
                if(type === 'audio') icon = '🎤';
                if(type === 'drum') icon = '🥁';
                if(type === 'piano') icon = '🎹';
                track.innerHTML = `
                    <span>${icon} 轨道${trackCount} (${type})</span>
                    <button class="mute-btn">Mute</button>
                    <button class="solo-btn">Solo</button>
                `;
                // add record-arm dot
                const armDot = document.createElement('span');
                armDot.className = 'arm-dot';
                armDot.title = '录音轨';
                armDot.addEventListener('click', function(ev) {
                    ev.stopPropagation();
                    // unarm others
                    document.querySelectorAll('.studio-track-scroll .track-list .track-item').forEach(t=>{
                        t.dataset.armed = 'false';
                    });
                    // arm this
                    track.dataset.armed = 'true';
                });
                track.appendChild(armDot);
                trackList.appendChild(track);
                addTrackMenu.style.display = 'none';
                // add only new track row, preserve existing recordings
                if(window.studio.arrangement && window.studio.arrangement.addTrackRow) {
                    window.studio.arrangement.addTrackRow(type);
                } else if(window.studio.arrangement) {
                    window.studio.arrangement.refreshArrangement();
                }
            });
        });
        // 拖动排序
        trackList.addEventListener('mousedown', function(e) {
            if(e.target.classList.contains('track-item')) {
                let drag = e.target;
                let startY = e.clientY;
                let origIndex = Array.from(trackList.children).indexOf(drag);
                function onMove(ev) {
                    let dy = ev.clientY - startY;
                    drag.style.transform = `translateY(${dy}px)`;
                }
                function onUp(ev) {
                    drag.style.transform = '';
                    let tracks = Array.from(trackList.children);
                    let newIndex = Math.round((ev.clientY - trackList.getBoundingClientRect().top) / drag.offsetHeight);
                    newIndex = Math.max(0, Math.min(tracks.length-1, newIndex));
                    if(newIndex !== origIndex) {
                        trackList.insertBefore(drag, tracks[newIndex]);
                    }
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    if(window.studio.arrangement) window.studio.arrangement.refreshArrangement();
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            }
        });

        // 滚动同步
        const trackScroll = document.querySelector('.studio-track-scroll');
        const arrangeScroll = document.querySelector('.studio-arrangement-scroll');
        if(trackScroll && arrangeScroll) {
            syncScroll(trackScroll, arrangeScroll);
        }
    }
    return { init };
})();

