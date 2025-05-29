// studio.controls.js
// 顶部控制栏（播放、录音、BPM等）
window.studio = window.studio || {};
window.studio.controls = (function() {
    let playing = false;
    let playInterval = null;
    let sec = 0;
    let recordOffset = 0;
    let mediaStream, mediaRecorder, mediaChunks = [], recordTrackIdx = -1;
    function init() {
        const timer = document.querySelector('.studio-timer');
        const playBtn = document.querySelector('.studio-controls button[title="播放"]');
        const rewindBtn = document.querySelector('.studio-controls button[title="回到开头"]');
        const recordBtn = document.querySelector('.studio-controls button[title="录音"]');
        // prepare microphone and recorder ahead of time
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    mediaStream = stream;
                    mediaRecorder = new MediaRecorder(stream);
                    mediaRecorder.ondataavailable = e => mediaChunks.push(e.data);
                    mediaRecorder.onstop = () => {
                        console.log('[录音] onstop，chunks:', mediaChunks);
                        const blob = new Blob(mediaChunks, { 'type': 'audio/ogg; codecs=opus' });
                        const url = URL.createObjectURL(blob);
                        if (window.studio.arrangement && window.studio.arrangement.addWaveformBlock) {
                            window.studio.arrangement.addWaveformBlock(recordTrackIdx, url, blob, recordOffset);
                        }
                        // note: keep stream active for subsequent recordings
                    };
                })
                .catch(err => console.error('麦克风权限拒绝', err));
        }
        playBtn.addEventListener('click', function() {
            // if currently recording, stop both recording and playback
            if(window.studio.controls.isRecording) {
                // stop recording
                window.studio.controls.isRecording = false;
                recordBtn.textContent = '⏺️';
                if(mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
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
        recordBtn.addEventListener('click', function() {
            // if recording ongoing, stop recording and continue playback
            if(window.studio.controls.isRecording) {
                console.log('[录音] 停止录音');
                window.studio.controls.isRecording = false;
                recordBtn.textContent = '⏺️';
                if(mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
                return;
            }
            // start recording only when playback is active
            if(!playing) {
                // trigger playback
                playBtn.click();
            }
            // record start offset
            recordOffset = window.studio.arrangement ? window.studio.arrangement.getCurrentTime() : 0;
            // select armed track for recording
            const trackItems = document.querySelectorAll('.studio-track-scroll .track-list .track-item');
            let target = -1;
            trackItems.forEach((t, i) => { if (t.dataset.armed === 'true') target = i; });
            if (target === -1) return alert('请先点击轨道上的录音小红点选择录音轨');
            recordTrackIdx = target;
            console.log('[录音] 开始录音，trackIdx:', recordTrackIdx);
            // start recording
            window.studio.controls.isRecording = true;
            recordBtn.textContent = '⏹️';
            if (!mediaRecorder) return alert('录音尚未准备好');
            mediaChunks = [];
            mediaRecorder.start();
        });
        window.addEventListener('resize', function() {
            if(window.studio.arrangement) window.studio.arrangement.resizePlayhead();
        });
    }
    return { init };
})();

