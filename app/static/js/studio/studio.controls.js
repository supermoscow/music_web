// studio.controls.js
// 顶部控制栏（播放、录音、BPM等）
window.studio = window.studio || {};
window.studio.controls = (function() {
    let playing = false;
    let playInterval = null;
    let sec = 0;
    let recordOffset = 0;
    function init() {
        const timer = document.querySelector('.studio-timer');
        const playBtn = document.querySelector('.studio-controls button[title="播放"]');
        const rewindBtn = document.querySelector('.studio-controls button[title="回到开头"]');
        const recordBtn = document.querySelector('.studio-controls button[title="录音"]');
        playBtn.addEventListener('click', function() {
            // if currently recording, stop both recording and playback
            if(window.studio.controls.isRecording) {
                // stop recording
                window.studio.controls.isRecording = false;
                recordBtn.textContent = '⏺️';
                if(window.studio.controls.mediaRecorder) window.studio.controls.mediaRecorder.stop();
                // stop playback
                if(playing) {
                    clearInterval(playInterval);
                    if(window.studio.arrangement) window.studio.arrangement.stopPlayhead();
                    playing = false;
                    playBtn.textContent = '▶️';
                }
                return;
            }
            // normal toggle playback
            playing = !playing;
            playBtn.textContent = playing ? '⏸️' : '▶️';
            if(playing) {
                // resume audio context if suspended
                if(window.studio.controls.audioCtx && window.studio.controls.audioCtx.state === 'suspended') window.studio.controls.audioCtx.resume();
                sec = 0;
                playInterval = setInterval(() => {
                    sec++;
                    let h = String(Math.floor(sec/3600)).padStart(2,'0');
                    let m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
                    let s = String(sec%60).padStart(2,'0');
                    timer.textContent = `${h}:${m}:${s}`;
                }, 1000);
                if(window.studio.arrangement) window.studio.arrangement.startPlayhead();
            } else {
                clearInterval(playInterval);
                if(window.studio.arrangement) window.studio.arrangement.stopPlayhead();
            }
        });
        rewindBtn.addEventListener('click', function() {
            timer.textContent = '00:00:00';
            clearInterval(playInterval);
            playing = false;
            playBtn.textContent = '▶️';
            if(window.studio.arrangement) window.studio.arrangement.resetPlayhead();
        });
        recordBtn.addEventListener('click', async function() {
            // if recording ongoing, stop recording and continue playback
            if(window.studio.controls.isRecording) {
                console.log('[录���] 停止录音，继续播放');
                window.studio.controls.isRecording = false;
                recordBtn.textContent = '⏺️';
                if(window.studio.controls.mediaRecorder) window.studio.controls.mediaRecorder.stop();
                return;
            }
            // start recording only when playback is active
            if(!playing) {
                // trigger playback
                playBtn.click();
            }
            // record start offset
            if(window.studio.arrangement) recordOffset = window.studio.arrangement.getCurrentTime();
            // select armed track for recording
            const trackItems = document.querySelectorAll('.studio-track-scroll .track-list .track-item');
            let targetTrackIdx = -1;
            trackItems.forEach((track, idx) => {
                if(track.dataset.armed === 'true') targetTrackIdx = idx;
            });
            console.log('[录音] 开始录音，targetTrackIdx:', targetTrackIdx);
            if(targetTrackIdx === -1) {
                alert('请先点击轨道上的录音小红点选择录音轨');
                return;
            }
            // start recording
            window.studio.controls.isRecording = true;
            recordBtn.textContent = '⏹️';
            if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                let chunks = [];
                mediaRecorder.ondataavailable = function(e) { chunks.push(e.data); };
                mediaRecorder.onstop = function() {
                    console.log('[录音] onstop，chunks:', chunks);
                    const blob = new Blob(chunks, { 'type' : 'audio/ogg; codecs=opus' });
                    const url = URL.createObjectURL(blob);
                    if(window.studio.arrangement && window.studio.arrangement.addWaveformBlock) {
                        // get current playhead time for segment offset
                        window.studio.arrangement.addWaveformBlock(targetTrackIdx, url, blob, recordOffset);
                    }
                    stream.getTracks().forEach(track => track.stop());
                };
                window.studio.controls.mediaRecorder = mediaRecorder;
                mediaRecorder.start();
            } else {
                alert('浏览器不支持录音');
            }
        });
        window.addEventListener('resize', function() {
            if(window.studio.arrangement) window.studio.arrangement.resizePlayhead();
        });
    }
    return { init };
})();

