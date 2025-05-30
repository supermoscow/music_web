// studio.metronome.js
// 节拍器逻辑，独立于 HTML
window.studio = window.studio || {};
(function(){
    const metronomeBtn = document.getElementById('metronome-btn');
    const bpmInput = document.querySelector('.studio-bpm input');
    const meterSelect = document.getElementById('studio-meter-select');
    const downbeatAudio = new Audio('/static/audio/studio/metronome/m1.wav');
    const beatAudio = new Audio('/static/audio/studio/metronome/m2.wav');
    // 上次播放的全局 beat 序号，用于避免重复
    let lastBeatIndex = null;

    // 根据播放指针当前秒数，按小时间窗检测节拍并触发，只在窗口内且序号改变时播放
    window.tickMetronome = function(currentTime) {
        const bpm = parseInt(bpmInput.value) || 120;
        const beatsPerMeasure = parseInt(meterSelect.value.split('/')[0]) || 4;
        const secPerBeat = 60 / bpm;
        // 最近拍的序号
        const rawIndex = currentTime / secPerBeat;
        const roundIndex = Math.round(rawIndex);
        // 进入小窗口才触发，窗口宽度=1/60秒
        if (Math.abs(rawIndex - roundIndex) < 1/60 && roundIndex !== lastBeatIndex) {
            const measureBeat = roundIndex % beatsPerMeasure;
            if (measureBeat === 0) downbeatAudio.play();
            else beatAudio.play();
            lastBeatIndex = roundIndex;
        }
    };

    // 播放停止或重置时调用
    window.resetMetronome = function() { lastBeatIndex = null; };

    metronomeBtn.addEventListener('click', () => {
        window.metronomeOn = !window.metronomeOn;
        metronomeBtn.classList.toggle('active', window.metronomeOn);
        window.resetMetronome();
    });
    bpmInput.addEventListener('change', window.resetMetronome);
    meterSelect.addEventListener('change', window.resetMetronome);
})();
