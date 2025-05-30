window.studio = window.studio || {};
window.studio.arrangement = (function(){
    const pxPerSec = 100; // base pixels per second
    const defaultBPM = 120; // grid tempo for static grid
    let playheadEl, arrangementArea, playheadTimer, isPlaying=false;
    let currentPos = 0; // current playhead position in pixels
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let tracks = [];
    let activeSources = []; // track playing AudioBufferSourceNodes for stop control

    function refreshArrangement(){
        arrangementArea = document.querySelector('.arrangement-area');
        arrangementArea.innerHTML = '';
        tracks = [];
        const trackItems = document.querySelectorAll('.studio-track-scroll .track-list .track-item');
        if(trackItems.length) {
            const headerHeight = trackItems[0].getBoundingClientRect().height;
            document.documentElement.style.setProperty('--track-row-height', headerHeight + 'px');
        }
        trackItems.forEach((item, idx) => {
            const type = item.dataset.type;
            tracks.push({type, segments: [], muted: false, solo: false});
            const row = document.createElement('div');
            row.className = 'arrangement-track-row';
            row.dataset.index = idx;
            row.style.position = 'relative';
            arrangementArea.appendChild(row);
        });
        // sync vertical scroll between track panel and arrangement
        const trackScroll = document.querySelector('.studio-track-scroll');
        const arrangeScroll = document.querySelector('.studio-arrangement-scroll');
        trackScroll.addEventListener('scroll', () => { arrangeScroll.scrollTop = trackScroll.scrollTop; });
        arrangeScroll.addEventListener('scroll', () => { trackScroll.scrollTop = arrangeScroll.scrollTop; });
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
        playheadEl.style.height = scroll.scrollHeight + 'px';
        playheadEl.style.background = 'red';
        scroll.appendChild(playheadEl);
    }

    function startPlayhead(){
        if(isPlaying) return;
        activeSources = []; // clear previous sources
        isPlaying = true;
        if(audioCtx.state === 'suspended') audioCtx.resume();
        tracks.forEach(t => t.segments.forEach(s => s.played = false));
        playheadTimer = setInterval(() => {
            // adjust speed based on BPM input
            const bpm = parseInt(document.querySelector('.studio-bpm input').value) || defaultBPM;
            const factor = bpm / defaultBPM;
            currentPos += (pxPerSec * factor) / 60;
            playheadEl.style.left = currentPos + 'px';
            checkPlaySegments(currentPos / pxPerSec);
        }, 1000/60);
    }

    function stopPlayhead(){
        clearInterval(playheadTimer);
        // stop all currently playing audio sources immediately
        activeSources.forEach(src => { try { src.stop(0); } catch(e) {} });
        activeSources = [];
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
        const soloExists = tracks.some(t => t.solo);
        tracks.forEach(track => {
            // skip tracks based on solo/mute state
            if(soloExists ? !track.solo : track.muted) return;
            track.segments.forEach(seg => {
                if(!seg.played && time >= seg.start && time <= seg.start + seg.duration){
                    if(seg.buffer){
                        const src = audioCtx.createBufferSource();
                        src.buffer = seg.buffer;
                        // adjust playback rate per current BPM
                        const bpm = parseInt(document.querySelector('.studio-bpm input').value) || defaultBPM;
                        src.playbackRate.value = bpm / defaultBPM;
                        src.connect(audioCtx.destination);
                        src.start(0, time - seg.start);
                        activeSources.push(src);
                    }
                    seg.played = true;
                }
            });
        });
    }

    // add waveform block at optional offset (in seconds)
    function addWaveformBlock(trackIndex, url, blob, offset = 0){
        const track = tracks[trackIndex];
        const segment = {start: offset, duration: 0, el: null, buffer: null, played: false};
        track.segments.push(segment);
        const row = document.querySelector(`.arrangement-track-row[data-index='${trackIndex}']`);
        const segEl = document.createElement('div');
        segEl.className = 'arr-segment waveform-block';
        segEl.style.left = (offset * pxPerSec) + 'px';
        // create canvas for waveform
        const canvas = document.createElement('canvas');
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
            canvas.width = width;
            canvas.height = segment.el ? segment.el.getBoundingClientRect().height : canvas.height;
            segEl.style.width = width + 'px';
            const ctx = canvas.getContext('2d');
            // draw background
            ctx.fillStyle = '#444';
            ctx.fillRect(0, 0, width, canvas.height);
            // draw waveform
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#fff';
            const step = Math.ceil(raw.length / width);
            const amp = canvas.height / 2;
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
                ctx.moveTo(x, canvas.height - yLow);
                ctx.lineTo(x, canvas.height - yHigh);
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
        // grid uses default BPM
        const bpm = defaultBPM;
        const meter = document.getElementById('studio-meter-select').value;
        const beatsPerBar = parseInt(meter.split('/')[0]);
        const secondsPerBar = (60 / bpm) * beatsPerBar;
        const pxPerBar = secondsPerBar * pxPerSec;
        const numBars = 32;
        const totalWidth = numBars * pxPerBar;
        // set wrapper and arrangement-area widths
        wrapper.innerHTML = '';
        wrapper.style.width = totalWidth + 'px';
        const area = document.querySelector('.arrangement-area');
        if(area) {
            area.style.width = totalWidth + 'px';
            area.style.setProperty('--beat-width', (pxPerBar / beatsPerBar) + 'px');
            area.style.setProperty('--bar-width', pxPerBar + 'px');
        }
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
        tracks.push({type, segments: [], muted: false, solo: false});
        const row = document.createElement('div');
        row.className = 'arrangement-track-row';
        row.dataset.index = idx;
        row.style.position = 'relative';
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

    // add methods to control mute/solo per track
    function setTrackMute(index, muted) {
        tracks[index].muted = muted;
    }

    function setTrackSolo(index, solo) {
        tracks[index].solo = solo;
    }

    return {refreshArrangement, startPlayhead, stopPlayhead, resetPlayhead, resizePlayhead, addWaveformBlock, setPosition, getCurrentTime, addTrackRow, moveTrack, setTrackMute, setTrackSolo};
})();
