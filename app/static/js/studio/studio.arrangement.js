// filepath: app/static/js/studio/studio.arrangement.js
window.studio = window.studio || {};
window.studio.arrangement = (function(){
    const pxPerSec = 100; // pixels per second timeline scale
    let playheadEl, arrangementArea, playheadTimer, isPlaying=false;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let tracks = [];

    function refreshArrangement(){
        arrangementArea = document.querySelector('.arrangement-area');
        arrangementArea.innerHTML = '';
        tracks = [];
        const trackItems = document.querySelectorAll('.studio-track-scroll .track-list .track-item');
        trackItems.forEach((item, idx) => {
            const type = item.dataset.type;
            tracks.push({type, segments: []});
            const row = document.createElement('div');
            row.className = 'arrangement-track-row';
            row.dataset.index = idx;
            row.style.position = 'relative';
            row.style.height = '40px';
            row.style.borderBottom = '1px solid #444';
            arrangementArea.appendChild(row);
        });
        initPlayhead();
    }

    function initPlayhead(){
        const scroll = document.querySelector('.studio-arrangement-scroll');
        if(playheadEl) playheadEl.remove();
        playheadEl = document.createElement('div');
        playheadEl.className = 'playhead';
        playheadEl.style.position = 'absolute';
        playheadEl.style.left = '0';
        playheadEl.style.top = '0';
        playheadEl.style.width = '2px';
        playheadEl.style.height = `${tracks.length * 40}px`;
        playheadEl.style.background = 'red';
        scroll.appendChild(playheadEl);
    }

    function startPlayhead(){
        if(isPlaying) return;
        isPlaying = true;
        let pos = 0;
        // reset played flags
        tracks.forEach(t => t.segments.forEach(s => s.played = false));
        playheadTimer = setInterval(() => {
            pos += pxPerSec/60;
            playheadEl.style.left = pos + 'px';
            const time = pos / pxPerSec;
            checkPlaySegments(time);
        }, 1000/60);
    }

    function stopPlayhead(){
        clearInterval(playheadTimer);
        isPlaying = false;
    }

    function resetPlayhead(){
        stopPlayhead();
        if(playheadEl) playheadEl.style.left = '0';
    }

    function resizePlayhead(){
        if(playheadEl) playheadEl.style.height = `${tracks.length * 40}px`;
    }

    function checkPlaySegments(time){
        tracks.forEach(track => {
            track.segments.forEach(seg => {
                if(!seg.played && time >= seg.start && time <= seg.start + seg.duration){
                    // play audio via AudioContext buffer source
                    if(seg.buffer){
                        const src = audioCtx.createBufferSource();
                        src.buffer = seg.buffer;
                        src.connect(audioCtx.destination);
                        src.start(0, time - seg.start);
                    }
                    seg.played = true;
                }
            });
        });
    }

    function addWaveformBlock(trackIndex, url, blob){
        const track = tracks[trackIndex];
        const segment = {start: 0, duration: 0, el: null, buffer: null, played: false};
        track.segments.push(segment);
        const row = document.querySelector(`.arrangement-track-row[data-index='${trackIndex}']`);
        const segEl = document.createElement('div');
        segEl.className = 'arr-segment waveform-block';
        segEl.style.position = 'absolute';
        segEl.style.left = '0';
        segEl.style.top = '0px';
        segEl.style.height = '40px';
        segEl.style.background = '#888';
        segEl.style.cursor = 'pointer';
        // create canvas for waveform
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.left = '0';
        canvas.style.top = '0px';
        canvas.style.height = '40px';
        canvas.style.cursor = 'pointer';
        segEl.appendChild(canvas);
        // decode blob and draw waveform
        blob.arrayBuffer().then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer)).then(buffer => {
            // store decoded buffer for playback
            segment.buffer = buffer;
            const raw = buffer.getChannelData(0);
            const duration = buffer.duration;
            // set segment duration
            segment.duration = duration;
            // set sizes based on duration
            const width = duration * pxPerSec;
            const height = 40;
            canvas.width = width;
            canvas.height = height;
            canvas.style.width = width + 'px';
            segEl.style.width = width + 'px';
            const ctx = canvas.getContext('2d');
            // draw background
            ctx.fillStyle = '#444';
            ctx.fillRect(0, 0, width, height);
            // draw waveform
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#fff';
            const step = Math.ceil(raw.length / width);
            const amp = height / 2;
            for(let x=0; x<width; x++){
                let min = 1.0, max = -1.0;
                for(let i=0; i<step; i++){
                    const datum = raw[x*step + i];
                    if(datum < min) min = datum;
                    if(datum > max) max = datum;
                }
                const yLow = (1 + min) * amp;
                const yHigh = (1 + max) * amp;
                ctx.beginPath();
                ctx.moveTo(x, height - yLow);
                ctx.lineTo(x, height - yHigh);
                ctx.stroke();
            }
        });
        segment.el = segEl;
        // segment.elAudio no longer used
        row.appendChild(segEl);
        makeDraggableResizable(segEl, segment);
    }

    function makeDraggableResizable(el, segment){
        let mode = null, startX = 0, origLeft = 0, origWidth = 0;
        el.addEventListener('mousedown', e => {
            e.preventDefault();
            startX = e.clientX;
            origLeft = parseFloat(el.style.left);
            origWidth = parseFloat(el.style.width);
            if(e.offsetX > origWidth - 10) mode = 'resize'; else mode = 'move';
            function onMove(ev){
                const dx = ev.clientX - startX;
                if(mode === 'move'){
                    const newLeft = origLeft + dx;
                    el.style.left = newLeft + 'px';
                    segment.start = newLeft / pxPerSec;
                } else if(mode === 'resize'){
                    const newW = Math.max(10, origWidth + dx);
                    el.style.width = newW + 'px';
                    segment.duration = newW / pxPerSec;
                }
            }
            function onUp(){
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    return {refreshArrangement, startPlayhead, stopPlayhead, resetPlayhead, resizePlayhead, addWaveformBlock};
})();
