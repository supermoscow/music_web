window.studio = window.studio || {};
window.studio.arrangement = (function(){
    const pxPerSec = 100; // base pixels per second
    const defaultBPM = 120; // grid tempo for static grid
    let playheadEl, arrangementArea, playheadTimer, isPlaying=false;
    let currentPos = 0; // current playhead position in pixels
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let tracks = [];
    let activeSources = []; // track playing AudioBufferSourceNodes for stop control
    const snapThreshold = 8; // px proximity for snap
    let currentPxPerBar = 0;
    let currentPxPerBeat = 0; // spacing for beats
    let drumBlockCounter = 1; // counter for drum-block numbering

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
            const trackObj = {type, segments: [], muted: false, solo: false, volume: 1, pan: 0, armed: false};
            // create audio chain nodes for this track
            trackObj.gainNode = audioCtx.createGain();
            trackObj.panner = audioCtx.createStereoPanner();
            trackObj.gainNode.connect(trackObj.panner).connect(audioCtx.destination);
            tracks.push(trackObj);
            const row = document.createElement('div');
            row.className = 'arrangement-track-row';
            row.dataset.index = idx;
            row.style.position = 'relative';
            arrangementArea.appendChild(row);

            // enable paint-mode drum block creation
            if(type === 'drum') {
                row.addEventListener('mousedown', function(e) {
                    console.log('[debug] mousedown on drum row');
                    if(!document.body.classList.contains('paint-mode')) return;
                    e.preventDefault();
                    const scrollContainer = document.querySelector('.studio-arrangement-scroll');
                    const rect = arrangementArea.getBoundingClientRect();
                    const startX = e.clientX - rect.left + scrollContainer.scrollLeft;
                    const startSnap = Math.round(startX / currentPxPerBeat) * currentPxPerBeat;
                    const segEl = document.createElement('div');
                    segEl.className = 'arr-segment drum-block';
                    segEl.style.left = startSnap + 'px';
                    segEl.style.width = '0px';
                    row.appendChild(segEl);
                    function onMove(ev) {
                        console.log('[debug] mousemove on drum row');
                        ev.preventDefault();
                        const mx = ev.clientX - rect.left + scrollContainer.scrollLeft;
                        let snapX = Math.round(mx / currentPxPerBeat) * currentPxPerBeat;
                        let width = snapX - startSnap;
                        if(width < 0) width = 0;
                        segEl.style.width = width + 'px';
                    }
                    function onUp(ev) {
                        console.log('[debug] mouseup on drum row');
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                        const mx = ev.clientX - rect.left + scrollContainer.scrollLeft;
                        const endSnap = Math.round(mx / currentPxPerBeat) * currentPxPerBeat;
                        if(endSnap > startSnap) {
                            segEl.style.width = (endSnap - startSnap) + 'px';
                            const segment = {
                                start: startSnap / pxPerSec,
                                duration: (endSnap - startSnap) / pxPerSec,
                                el: segEl,
                                buffer: null,
                                played: false
                            };
                            // assign block number and label
                            segment.name = 'Block ' + drumBlockCounter;
                            segment.number = drumBlockCounter; // 新增编号属性
                            segEl.segment = segment; // 关键：将 segment 赋值给 segEl，便于后续读取编号
                            // 用span包裹编号，便于样式控制
                            const numSpan = document.createElement('span');
                            numSpan.className = 'drum-block-number';
                            numSpan.textContent = drumBlockCounter;
                            segEl.appendChild(numSpan);
                            drumBlockCounter++;
                            segment.beats = (endSnap - startSnap) / currentPxPerBeat;
                            tracks[idx].segments.push(segment);
                            // selection in select-mode and removal in delete-mode
                            segEl.addEventListener('click', e => {
                                e.stopPropagation();
                                const rowEl = segEl.closest('.arrangement-track-row');
                                const trackIndex = parseInt(rowEl.dataset.index, 10);
                                if (document.body.classList.contains('delete-mode')) {
                                    const arr = tracks[trackIndex].segments;
                                    const i = arr.indexOf(segment);
                                    if (i > -1) arr.splice(i, 1);
                                    segEl.remove();
                                } else {
                                    // deselect other blocks
                                    document.querySelectorAll('.arr-segment.drum-block.selected').forEach(el=>el.classList.remove('selected'));
                                    segEl.classList.add('selected');
                                    // select corresponding track-item
                                    const items = document.querySelectorAll('.studio-track-scroll .track-list .track-item');
                                    items.forEach(i=>i.classList.remove('selected'));
                                    const ti = items[trackIndex]; if(ti) ti.classList.add('selected');
                                    // notify bottom panel
                                    window.dispatchEvent(new CustomEvent('segmentSelected', { detail: { trackIndex, segment } }));
                                }
                            });
                            // enable dragging and resizing in select-mode
                            makeDraggableResizable(segEl, segment, idx);
                            // 调试：每次新建 drum-block 时打印
                            console.log('[debug][create] drum-block', segEl, segEl.textContent, segEl.querySelector('.drum-block-number'));
                        } else {
                            row.removeChild(segEl);
                        }
                    }
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                });
            }
        });
        // sync vertical scroll between track panel and arrangement
        const trackScroll = document.querySelector('.studio-track-scroll');
        const arrangeScroll = document.querySelector('.studio-arrangement-scroll');
        trackScroll.addEventListener('scroll', () => { arrangeScroll.scrollTop = trackScroll.scrollTop; });
        arrangeScroll.addEventListener('scroll', () => { trackScroll.scrollTop = arrangeScroll.scrollTop; });
        initPlayhead();
        initTimeline();
        setPosition(currentPos/pxPerSec); // restore position

        // --- 保证所有 drum-block 都有编号 ---
        setTimeout(() => {
            const blocks = document.querySelectorAll('.arr-segment.drum-block');
            blocks.forEach((block, idx) => {
                // 如果没有编号span则补充
                if (!block.querySelector('.drum-block-number')) {
                    let number = '?';
                    if (block.segment && block.segment.number) {
                        number = block.segment.number;
                    } else {
                        number = idx + 1;
                    }
                    const numSpan = document.createElement('span');
                    numSpan.className = 'drum-block-number';
                    numSpan.textContent = number;
                    block.appendChild(numSpan);
                }
            });
        }, 100);

        // 立即调试：每次新建 drum-block 时打印
        document.querySelectorAll('.arr-segment.drum-block').forEach((block, idx) => {
            console.log('[debug][immediate] drum-block', idx, block, block.textContent, block.querySelector('.drum-block-number'));
        });
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
        playheadEl.style.zIndex = '9999';
        scroll.appendChild(playheadEl);
        // make playhead draggable with snap
        let phStartX, phOrigLeft;
        playheadEl.addEventListener('mousedown', e => {
            e.preventDefault();
            const scrollArea = document.querySelector('.studio-arrangement-scroll');
            phStartX = e.clientX;
            phOrigLeft = parseFloat(playheadEl.style.left);
            function onMove(ev) {
                let dx = ev.clientX - phStartX;
                let newLeft = phOrigLeft + dx;
                // clamp
                const max = scrollArea.scrollWidth;
                newLeft = Math.max(0, Math.min(newLeft, max));
                // snap to nearest beat line if within threshold
                if(currentPxPerBeat > 0) {
                    const snapLine = Math.round(newLeft / currentPxPerBeat) * currentPxPerBeat;
                    if(Math.abs(snapLine - newLeft) <= snapThreshold) newLeft = snapLine;
                }
                playheadEl.style.left = newLeft + 'px';
                currentPos = newLeft;
                // update timer
                const sec = currentPos / pxPerSec;
                const h = String(Math.floor(sec/3600)).padStart(2,'0');
                const m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
                const s = String(Math.floor(sec%60)).padStart(2,'0');
                document.querySelector('.studio-timer').textContent = `${h}:${m}:${s}`;
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    function updatePlayheadPosition(newPosition) {
        currentPos = newPosition;
        if (playheadEl) {
            playheadEl.style.left = `${currentPos}px`;
        }
        // Trigger playheadMoved event
        window.dispatchEvent(new CustomEvent('playheadMoved', { detail: { position: currentPos } }));
    }

    function startPlayback() {
        isPlaying = true;
        playheadTimer = setInterval(() => {
            updatePlayheadPosition(currentPos + 1); // Example increment, adjust based on tempo
        }, 1000 / pxPerSec);
    }

    function stopPlayback() {
        isPlaying = false;
        clearInterval(playheadTimer);
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
            // update position and dispatch event for drum-machine linkage
            const newPos = currentPos + (pxPerSec * factor) / 60;
            updatePlayheadPosition(newPos);
            if (window.metronomeOn && typeof window.tickMetronome === 'function') window.tickMetronome(currentPos / pxPerSec);
            checkPlaySegments(currentPos / pxPerSec);
        }, 1000/60);
    }

    function stopPlayhead(){
        clearInterval(playheadTimer);
        // stop all currently playing audio sources immediately
        activeSources.forEach(src => { try { src.stop(0); } catch(e) {} });
        activeSources = [];
        isPlaying = false;
        if (typeof window.resetMetronome === 'function') window.resetMetronome();
    }

    function resetPlayhead(){
        stopPlayhead();
        currentPos = 0;
        if(playheadEl) playheadEl.style.left = '0';
        if (typeof window.resetMetronome === 'function') window.resetMetronome();
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
                    // handle drum-block segments via drum machine control
                    if(seg.el && seg.el.classList.contains('drum-block')){
                        if(window.playDrumMachine) window.playDrumMachine();
                    } else if(seg.buffer){
                        const src = audioCtx.createBufferSource();
                        src.buffer = seg.buffer;
                        // adjust playback rate per current BPM
                        const bpm = parseInt(document.querySelector('.studio-bpm input').value) || defaultBPM;
                        src.playbackRate.value = bpm / defaultBPM;
                        // connect source through persistent track nodes
                        src.connect(track.gainNode);
                        src.start(0, time - seg.start);
                        activeSources.push(src);
                    }
                    seg.played = true;
                }
                // pause drum-machine when playhead exits segment
                if(seg.played && seg.el && seg.el.classList.contains('drum-block') && time > seg.start + seg.duration){
                    if(window.pauseDrumMachine) window.pauseDrumMachine();
                    // allow replay if needed
                    seg.played = false;
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
        row.appendChild(segEl);
        // selection and deletion in modes
        segEl.addEventListener('click', e => {
            e.stopPropagation();
            const rowEl = segEl.closest('.arrangement-track-row');
            const trackIndex = parseInt(rowEl.dataset.index, 10);
            if (document.body.classList.contains('delete-mode')) {
                const arr = tracks[trackIndex].segments;
                const i = arr.indexOf(segment);
                if (i > -1) arr.splice(i, 1);
                segEl.remove();
            } else {
                segEl.classList.toggle('selected');
                window.dispatchEvent(new CustomEvent('segmentSelected', { detail: { trackIndex, segment } }));
            }
        });
        makeDraggableResizable(segEl, segment, trackIndex);
    }

    function makeDraggableResizable(el, segment, trackIndex){
        let mode = null, startX = 0, origLeft = 0, origWidth = 0;
        el.addEventListener('mousedown', e => {
            // only allow drag/resize in select-mode
            if(!document.body.classList.contains('select-mode')) return;
            e.preventDefault();
            startX = e.clientX;
            origLeft = parseFloat(el.style.left);
            origWidth = parseFloat(el.style.width);
            const localX = e.offsetX;
            if(localX < 10) mode = 'resize-left';
            else if(localX > origWidth - 10) mode = 'resize-right';
            else mode = 'move';
            function onMove(ev){
                const dx = ev.clientX - startX;
                if(mode === 'move'){
                    let newLeft = Math.round((origLeft + dx) / currentPxPerBeat) * currentPxPerBeat;
                    // clamp within container
                    const parentW = el.parentElement.getBoundingClientRect().width;
                    newLeft = Math.max(0, Math.min(newLeft, parentW - origWidth));
                    // prevent overlap
                    let overlap = false;
                    tracks[trackIndex].segments.forEach(s=>{
                        if(s === segment) return;
                        const oL = parseFloat(s.el.style.left);
                        const oR = oL + parseFloat(s.el.style.width);
                        if(newLeft < oR && newLeft + origWidth > oL) overlap = true;
                    });
                    if(!overlap) {
                        el.style.left = newLeft + 'px';
                        segment.start = newLeft / pxPerSec;
                    }
                } else if(mode === 'resize-right'){
                    let newW = origWidth + dx;
                    newW = Math.max(currentPxPerBeat, newW);
                    newW = Math.round(newW / currentPxPerBeat) * currentPxPerBeat;
                    el.style.width = newW + 'px';
                    segment.duration = newW / pxPerSec;
                    segment.beats = newW / currentPxPerBeat;
                } else if(mode === 'resize-left'){
                    let newL = origLeft + dx;
                    let newW = origWidth - dx;
                    // clamp
                    if(newL < 0){ newW += newL; newL = 0; }
                    newW = Math.max(currentPxPerBeat, newW);
                    newL = Math.round(newL / currentPxPerBeat) * currentPxPerBeat;
                    const delta = newL - origLeft;
                    newW = origWidth - delta;
                    el.style.left = newL + 'px';
                    el.style.width = newW + 'px';
                    segment.start = newL / pxPerSec;
                    segment.duration = newW / pxPerSec;
                    segment.beats = newW / currentPxPerBeat;
                }
            }
            function onUp(){
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                // notify that segment was updated (for live editor refresh)
                if(el.classList.contains('drum-block')){
                    window.dispatchEvent(new CustomEvent('segmentUpdated', { detail: { trackIndex, segment } }));
                }
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
        // store pxPerBar and pxPerBeat for snapping
        currentPxPerBar = pxPerBar;
        currentPxPerBeat = pxPerBar / beatsPerBar;
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
            let x = e.clientX - rect.left;
            // snap to nearest beat line if within threshold
            if(currentPxPerBeat > 0) {
                const snapLine = Math.round(x / currentPxPerBeat) * currentPxPerBeat;
                if(Math.abs(snapLine - x) <= snapThreshold) x = snapLine;
            }
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
        // enable drag anywhere on time-scroll
        timelineScroll.addEventListener('mousedown', e => {
            e.preventDefault();
            const wrapper = document.querySelector('.studio-timeline-wrapper');
            const rect = wrapper.getBoundingClientRect();
            const totalW = rect.width;
            let startX = e.clientX;
            let origLeft = currentPos;
            function onMove(ev) {
                let x = ev.clientX - rect.left;
                x = Math.max(0, Math.min(x, totalW));
                // snap to nearest beat
                if(currentPxPerBeat > 0) {
                    const snapLine = Math.round(x / currentPxPerBeat) * currentPxPerBeat;
                    if(Math.abs(snapLine - x) <= snapThreshold) x = snapLine;
                }
                playheadEl.style.left = x + 'px';
                currentPos = x;
                // update timer
                const sec = currentPos / pxPerSec;
                const h = String(Math.floor(sec/3600)).padStart(2,'0');
                const m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
                const s = String(Math.floor(sec%60)).padStart(2,'0');
                document.querySelector('.studio-timer').textContent = `${h}:${m}:${s}`;
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    function getCurrentTime(){ return currentPos / pxPerSec; }

    // add a single new track row without clearing existing tracks
    function addTrackRow(type) {
        if (!arrangementArea) {
            console.error('arrangementArea is not initialized. Ensure .arrangement-area exists in the DOM.');
            return;
        }
        const idx = tracks.length;
        const trackObj = {type, segments: [], muted: false, solo: false, volume: 1, pan: 0, armed: false};
        trackObj.gainNode = audioCtx.createGain();
        trackObj.panner = audioCtx.createStereoPanner();
        trackObj.gainNode.connect(trackObj.panner).connect(audioCtx.destination);
        tracks.push(trackObj);
        const row = document.createElement('div');
        row.className = 'arrangement-track-row';
        row.dataset.index = idx;
        row.style.position = 'relative';
        arrangementArea.appendChild(row);
        // enable paint-mode drum block creation for new row
        if(type === 'drum') {
            row.addEventListener('mousedown', function(e) {
                console.log('[debug] mousedown on drum row');
                if(!document.body.classList.contains('paint-mode')) return;
                e.preventDefault();
                const scrollContainer = document.querySelector('.studio-arrangement-scroll');
                const rect = arrangementArea.getBoundingClientRect();
                const startX = e.clientX - rect.left + scrollContainer.scrollLeft;
                const startSnap = Math.round(startX / currentPxPerBeat) * currentPxPerBeat;
                const segEl = document.createElement('div');
                segEl.className = 'arr-segment drum-block';
                segEl.style.left = startSnap + 'px';
                segEl.style.width = '0px';
                row.appendChild(segEl);
                function onMove(ev) {
                    console.log('[debug] mousemove on drum row');
                    ev.preventDefault();
                    const mx = ev.clientX - rect.left + scrollContainer.scrollLeft;
                    let snapX = Math.round(mx / currentPxPerBeat) * currentPxPerBeat;
                    let width = snapX - startSnap;
                    if(width < 0) width = 0;
                    segEl.style.width = width + 'px';
                }
                function onUp(ev) {
                    console.log('[debug] mouseup on drum row');
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    const mx = ev.clientX - rect.left + scrollContainer.scrollLeft;
                    const endSnap = Math.round(mx / currentPxPerBeat) * currentPxPerBeat;
                    if(endSnap > startSnap) {
                        segEl.style.width = (endSnap - startSnap) + 'px';
                        const segment = { start: startSnap / pxPerSec, duration: (endSnap - startSnap) / pxPerSec, el: segEl, buffer: null, played: false };
                        segment.beats = (endSnap - startSnap) / currentPxPerBeat;
                        tracks[idx].segments.push(segment);
                        segEl.addEventListener('click', e => {
                            e.stopPropagation();
                            const rowEl = segEl.closest('.arrangement-track-row');
                            const trackIndex = parseInt(rowEl.dataset.index, 10);
                            if (document.body.classList.contains('delete-mode')) {
                                const arr = tracks[trackIndex].segments;
                                const i = arr.indexOf(segment);
                                if (i > -1) arr.splice(i, 1);
                                segEl.remove();
                            } else {
                                document.querySelectorAll('.arr-segment.drum-block.selected').forEach(el=>el.classList.remove('selected'));
                                segEl.classList.add('selected');
                                const items = document.querySelectorAll('.studio-track-scroll .track-list .track-item');
                                items.forEach(i=>i.classList.remove('selected'));
                                const ti = items[trackIndex]; if(ti) ti.classList.add('selected');
                                window.dispatchEvent(new CustomEvent('segmentSelected', { detail: { trackIndex, segment } }));
                            }
                        });
                        makeDraggableResizable(segEl, segment, idx);
                    } else {
                        row.removeChild(segEl);
                    }
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        }
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
        updateGainStates();
    }

    function setTrackSolo(index, solo) {
        tracks[index].solo = solo;
        updateGainStates();
    }

    // set track volume (0.0 to 1.0)
    function setTrackVolume(index, volume) {
        const t = tracks[index];
        t.volume = volume;
        // if not muted or soloed, update gain immediately
        updateGainStates();
    }

    // set track pan (-50 to +50)
    function setTrackPan(index, pan) {
        const t = tracks[index];
        t.pan = pan;
        t.panner.pan.value = pan / 50;
    }

    // arm/unarm track for recording
    function armTrack(index, armed) {
        tracks[index].armed = armed;
        // reflect in track panel
        const items = document.querySelectorAll('.studio-track-scroll .track-list .track-item');
        const item = items[index];
        if (item) item.dataset.armed = armed.toString();
    }

    // get track settings for inspector
    function getTrackSettings(index) {
        const t = tracks[index] || {};
        return {
            volume: t.volume != null ? t.volume : 1,
            pan: t.pan != null ? t.pan : 0,
            muted: t.muted,
            solo: t.solo,
            armed: t.armed
        };
    }

    // update gain nodes based on mute/solo/volume
    function updateGainStates() {
        const soloExists = tracks.some(t=>t.solo);
        tracks.forEach(t=>{
            let gainVal = t.volume;
            if(soloExists) gainVal = t.solo ? t.volume : 0;
            else if(t.muted) gainVal = 0;
            t.gainNode.gain.value = gainVal;
        });
    }

    // ===== 鼓机联动播放逻辑 =====
    let drumBlockPlaybackState = null;
    window.addEventListener('playheadMoved', e => {
        const px = e.detail.position;
        const bpm = parseFloat(document.querySelector('.studio-bpm input').value) || 120;
        console.log('[drum-debug] playheadMoved px:', px, 'bpm:', bpm);
        // 遍历所有 drum-block
        document.querySelectorAll('.arr-segment.drum-block').forEach(block => {
            // 确保 block.segment 正确赋值
            if (!block.segment) {
                // 尝试从 tracks 中查找 segment
                for (const t of tracks) {
                    const seg = t.segments.find(s => s.el === block);
                    if (seg) { block.segment = seg; break; }
                }
            }
            const left = parseFloat(block.style.left);
            const width = parseFloat(block.style.width);
            const startPx = left;
            const endPx = left + width;
            // 鼓块参数
            const blockBeats = block.segment ? block.segment.beats : (width / currentPxPerBeat);
            const totalSteps = blockBeats * 4; // subdivisions=4
            const blockStartSec = startPx / pxPerSec;
            const blockDurationSec = width / pxPerSec;
            // 判断playhead是否在block内
            if(px >= startPx && px < endPx) {
                // 计算当前step和offset
                const playheadSec = px / pxPerSec;
                const offsetSec = playheadSec - blockStartSec;
                const step = Math.floor((offsetSec / blockDurationSec) * totalSteps);
                console.log('[drum-debug] playhead in drum-block step change:', step);
                // 首次进入或步数变化时重启鼓机
                if(!drumBlockPlaybackState || drumBlockPlaybackState.block !== block || drumBlockPlaybackState.step !== step) {
                    if(window.studioDrumMachineControl) {
                        console.log('[drum-debug] playFromStep', step, offsetSec, bpm, totalSteps);
                        window.studioDrumMachineControl.playFromStep(step, offsetSec, bpm, totalSteps);
                        drumBlockPlaybackState = { block, step };
                    }
                }
            } else {
                // 鼓块外，若正在播放则停止
                if(drumBlockPlaybackState && drumBlockPlaybackState.block === block) {
                    if(window.studioDrumMachineControl) {
                        console.log('[drum-debug] 调用stop');
                        window.studioDrumMachineControl.stop();
                    }
                    drumBlockPlaybackState = null;
                }
            }
        });
    });

    return {refreshArrangement, startPlayhead, stopPlayhead, resetPlayhead, resizePlayhead, addWaveformBlock, setPosition, getCurrentTime, addTrackRow, moveTrack, setTrackMute, setTrackSolo, setTrackVolume, setTrackPan, armTrack, getTrackSettings, updateGainStates, updatePlayheadPosition, startPlayback, stopPlayback};
})();
