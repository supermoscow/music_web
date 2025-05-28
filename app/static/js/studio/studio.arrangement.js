// filepath: app/static/js/studio/studio.arrangement.js
window.studio = window.studio || {};
window.studio.arrangement = (function(){
    const pxPerSec = 100; // pixels per second timeline scale
    let playheadEl, arrangementArea, playheadTimer, isPlaying=false;
    let currentPos = 0; // current playhead position in pixels
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
        initTimeline();
        setPosition(currentPos/pxPerSec); // restore position
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
        // full height of arrangement scroll
        const container = scroll;
        playheadEl.style.height = container.scrollHeight + 'px';
        playheadEl.style.background = 'red';
        scroll.appendChild(playheadEl);
    }

    function startPlayhead(){
        if(isPlaying) return;
        isPlaying = true;
        // resume audio context if needed
        if(audioCtx.state === 'suspended') audioCtx.resume();
        // reset played flags
        tracks.forEach(t => t.segments.forEach(s => s.played = false));
        playheadTimer = setInterval(() => {
            currentPos += pxPerSec/60;
            playheadEl.style.left = currentPos + 'px';
            const time = currentPos / pxPerSec;
            checkPlaySegments(time);
        }, 1000/60);
    }

    function stopPlayhead(){
        clearInterval(playheadTimer);
        isPlaying = false;
    }

    function resetPlayhead(){
        stopPlayhead();
        currentPos = 0;
        if(playheadEl) playheadEl.style.left = '0';
    }

    function resizePlayhead(){
        const scroll = document.querySelector('.studio-arrangement-scroll');
        if(playheadEl && scroll) {
            playheadEl.style.height = scroll.scrollHeight + 'px';
        }
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

    // set playhead to specific time position
    function setPosition(seconds){
        currentPos = seconds * pxPerSec;
        if(playheadEl) playheadEl.style.left = currentPos + 'px';
    }

    // initialize timeline ticks and click-to-seek
    function initTimeline(){
        const wrapper = document.querySelector('.studio-timeline-wrapper');
        const bpm = parseInt(document.querySelector('.studio-bpm input').value) || 120;
        const meter = document.getElementById('studio-meter-select').value;
        const beatsPerBar = parseInt(meter.split('/')[0]);
        const secondsPerBar = (60 / bpm) * beatsPerBar;
        const pxPerBar = secondsPerBar * pxPerSec;
        const numBars = 32;
        wrapper.innerHTML = '';
        wrapper.style.width = (numBars * pxPerBar) + 'px';
        for(let i=0; i<numBars; i++){
            const tick = document.createElement('div');
            tick.className = 'timeline-tick';
            tick.style.left = (i * pxPerBar) + 'px';
            tick.textContent = i + 1;
            wrapper.appendChild(tick);
        }
        const timelineScroll = document.querySelector('.studio-timeline-scroll');
        // click-to-seek
        timelineScroll.addEventListener('click', e => {
            const rect = wrapper.getBoundingClientRect();
            const x = e.clientX - rect.left;
            setPosition(x / pxPerSec);
            // update timer display
            const sec = currentPos / pxPerSec;
            const h = String(Math.floor(sec/3600)).padStart(2,'0');
            const m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
            const s = String(Math.floor(sec%60)).padStart(2,'0');
            document.querySelector('.studio-timer').textContent = `${h}:${m}:${s}`;
        });
        // sync scrolling
        const arrScroll = document.querySelector('.studio-arrangement-scroll');
        timelineScroll.addEventListener('scroll', () => { arrScroll.scrollLeft = timelineScroll.scrollLeft; });
        arrScroll.addEventListener('scroll', () => { timelineScroll.scrollLeft = arrScroll.scrollLeft; });
    }

    function getCurrentTime(){ return currentPos / pxPerSec; }

    // add a single new track row without clearing existing tracks
    function addTrackRow(type) {
        const idx = tracks.length;
        tracks.push({type, segments: []});
        const row = document.createElement('div');
        row.className = 'arrangement-track-row';
        row.dataset.index = idx;
        row.style.position = 'relative';
        row.style.height = '40px';
        row.style.borderBottom = '1px solid #444';
        arrangementArea.appendChild(row);
        // adjust playhead height
        resizePlayhead();
    }

    // move track at origIndex to newIndex, preserving segments
    function moveTrack(origIndex, newIndex) {
        if(origIndex === newIndex) return;
        // reorder data
        const track = tracks.splice(origIndex, 1)[0];
        tracks.splice(newIndex, 0, track);
        // reorder DOM rows
        const rows = Array.from(arrangementArea.querySelectorAll('.arrangement-track-row'));
        const moved = rows[origIndex];
        if(moved) {
            moved.remove();
            const before = rows[newIndex] && rows[newIndex] !== moved ? rows[newIndex] : null;
            if(before) arrangementArea.insertBefore(moved, before);
            else arrangementArea.appendChild(moved);
        }
        // update data-index
        Array.from(arrangementArea.querySelectorAll('.arrangement-track-row')).forEach((row, i) => {
            row.dataset.index = i;
        });
    }

    return {refreshArrangement, startPlayhead, stopPlayhead, resetPlayhead, resizePlayhead, addWaveformBlock, setPosition, getCurrentTime, addTrackRow, moveTrack};
})();
