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
        const ctrlBar = document.querySelector('.studio-controls');
        const playBtn = ctrlBar.querySelector('button[title="播放"]');
        const rewindBtn = ctrlBar.querySelector('button[title="回到开头"]');
        const recordBtn = ctrlBar.querySelector('button[title="录音"]');
        // 新增：切割按钮
        const cutBtn = document.createElement('button');
        cutBtn.id = 'cut-btn';
        cutBtn.title = '切割';
        cutBtn.textContent = '✂️';
        ctrlBar.appendChild(cutBtn);
        let cutMode = false;
        cutBtn.addEventListener('click', () => {
            cutMode = !cutMode;
            document.body.classList.toggle('cut-mode', cutMode);
            cutBtn.classList.toggle('active', cutMode);
            document.body.style.cursor = cutMode ? 'crosshair' : 'default';
        });

        // 项目相关按钮
        const newBtn = document.getElementById('new-project-btn');
        const saveBtn = document.getElementById('save-project-btn');
        const openBtn = document.getElementById('open-project-btn');

        // 新建工程
        newBtn && newBtn.addEventListener('click', function() {
            if(confirm('确定要新建工程吗？当前未保存内容将丢失。')) {
                if(window.studio.arrangement && window.studio.arrangement.reset) window.studio.arrangement.reset();
                if(window.studio.track && window.studio.track.reset) window.studio.track.reset();
                // 可扩展：mixer等其他模块
                alert('已新建空白工程');
            }
        });

        // 保存工程
        saveBtn && saveBtn.addEventListener('click', async function() {
            let project = {};
            if(window.studio.arrangement && window.studio.arrangement.serialize) project.arrangement = window.studio.arrangement.serialize();
            if(window.studio.track && window.studio.track.serialize) project.track = window.studio.track.serialize();
            // 可扩展：mixer等其他模块
            const name = prompt('请输入工程名称：');
            if(!name) return;
            project.name = name;
            const res = await fetch('/studio/save_project', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(project)
            });
            if(res.ok) alert('保存成功');
            else alert('保存失败');
        });

        // 打开工程
        openBtn && openBtn.addEventListener('click', async function() {
            const res = await fetch('/studio/list_projects');
            if(!res.ok) return alert('获取项目列表失败');
            const list = await res.json();
            const name = prompt('输入要打开的工程名：\n' + list.join('\n'));
            if(!name) return;
            const res2 = await fetch('/studio/load_project?name=' + encodeURIComponent(name));
            if(!res2.ok) return alert('加载失败');
            const project = await res2.json();
            // 先加载轨道面板，再加载编排，避免刷新顺序覆盖段落
            if(window.studio.track && window.studio.track.load) window.studio.track.load(project.track);
            if(window.studio.arrangement && window.studio.arrangement.load) window.studio.arrangement.load(project.arrangement);
            // 可扩展：mixer等其他模块
            alert('工程已加载');
        });

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
                // 重置节拍器状态
                if(window.metronomeOn && typeof window.resetMetronome === 'function') window.resetMetronome();
            } else {
                clearInterval(playInterval);
                if(window.studio.arrangement) window.studio.arrangement.stopPlayhead();
                if(window.studioDrumMachineControl) window.studioDrumMachineControl.stop();
            }
        });
        rewindBtn.addEventListener('click', function() {
            timer.textContent = '00:00:00';
            clearInterval(playInterval);
            playing = false;
            playBtn.textContent = '▶️';
            if(window.studio.arrangement) window.studio.arrangement.resetPlayhead();
            // 重置节拍器状态
            if(typeof window.resetMetronome === 'function') window.resetMetronome();
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

