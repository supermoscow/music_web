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
                // initialize unarmed, mute, solo
                track.dataset.armed = 'false';
                track.dataset.muted = 'false';
                track.dataset.solo = 'false';
                let icon = '';
                if(type === 'audio') icon = '🎤';
                if(type === 'drum') icon = '🥁';
                if(type === 'piano') icon = '🎹';
                track.innerHTML = `
                    <span>${icon} 轨道${trackCount} (${type})</span>
                    <button class="mute-btn">M</button>
                    <button class="solo-btn">S</button>
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
                // add mute/solo button handlers
                const muteBtn = track.querySelector('.mute-btn');
                const soloBtn = track.querySelector('.solo-btn');
                muteBtn.addEventListener('click', function(ev) {
                    ev.stopPropagation();
                    const isMuted = track.dataset.muted === 'true';
                    track.dataset.muted = (!isMuted).toString();
                    muteBtn.classList.toggle('active', !isMuted);
                    const idx = Array.from(trackList.children).indexOf(track);
                    if(window.studio.arrangement && window.studio.arrangement.setTrackMute) {
                        window.studio.arrangement.setTrackMute(idx, !isMuted);
                    }
                });
                soloBtn.addEventListener('click', function(ev) {
                    ev.stopPropagation();
                    const isSolo = track.dataset.solo === 'true';
                    track.dataset.solo = (!isSolo).toString();
                    soloBtn.classList.toggle('active', !isSolo);
                    const idx = Array.from(trackList.children).indexOf(track);
                    if(window.studio.arrangement && window.studio.arrangement.setTrackSolo) {
                        window.studio.arrangement.setTrackSolo(idx, !isSolo);
                    }
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
        // 默认添加一个录音轨道并选中
        const defaultBtn = addTrackMenu.querySelector('button[data-type="audio"]');
        if (defaultBtn) {
            defaultBtn.click();
            // 选中新增轨道以触发 inspector
            setTimeout(() => {
                const firstTrack = trackList.querySelector('.track-item');
                if (firstTrack) firstTrack.click();
            }, 0);
        }
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
                    if(window.studio.arrangement && window.studio.arrangement.moveTrack) {
                        window.studio.arrangement.moveTrack(origIndex, newIndex);
                    }
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

        // track selection delegation
        trackList.addEventListener('click', function(ev) {
            const trackEl = ev.target.closest('.track-item');
            if (trackEl) {
                // deselect others
                document.querySelectorAll('.studio-track-scroll .track-list .track-item').forEach(t => {
                    t.classList.remove('selected');
                });
                // select this
                trackEl.classList.add('selected');
                const index = Array.from(trackList.children).indexOf(trackEl);
                const type = trackEl.getAttribute('data-type');
                window.dispatchEvent(new CustomEvent('trackSelected', { detail: { index, type } }));
            }
        });
    }
    return { init };
})();

