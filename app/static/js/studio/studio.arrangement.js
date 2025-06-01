window.studio = window.studio || {};
window.studio.arrangement = (function() {
    const pxPerSec = 100; // base pixels per second
    const defaultBPM = 120; // grid tempo for static grid
    let playheadEl, arrangementArea, playheadTimer, isPlaying = false;
    let currentPos = 0; // current playhead position in pixels
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let tracks = [];
    let activeSources = []; // track playing AudioBufferSourceNodes for stop control
    const snapThreshold = 8; // px proximity for snap
    let currentPxPerBar = 0;
    let currentPxPerBeat = 0; // spacing for beats
    let drumBlockCounter = 1; // counter for drum-block numbering
    let instrumentBlockCounter = 1; // counter for instrument-block numbering
    let clipboard = null; // store copied segment

    // 新增：生成鼓机缩略图的函数
    function generateDrumThumbnail(el, segment) {
        // 移除旧的缩略图
        const old = el.querySelector('.drum-block-thumbnail');
        if (old) old.remove();
        const pattern = segment.pattern || [];
        const rows = pattern.length;
        const cols = pattern[0] ? pattern[0].length : 0;
        // 创建canvas
        const canvas = document.createElement('canvas');
        canvas.className = 'drum-block-thumbnail';
        // 分辨率: 列数 x 行数，对应每个step一个像素
        canvas.width = cols;
        canvas.height = rows;
        // css拉伸至父容器大小，像素渲染
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        const ctx = canvas.getContext('2d');
        // 背景填充
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(0, 0, cols, rows);
        // 绘制活跃step
        ctx.fillStyle = '#4caf50';
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (pattern[r][c]) ctx.fillRect(c, r, 1, 1);
            }
        }
        el.appendChild(canvas);
    }

    // duplicate a segment (drum-block or waveform-block)
    function duplicateSegment(trackIndex, originalSeg) {
        const pasteStart = originalSeg.start;
        const type = originalSeg.el.classList.contains('drum-block') ? 'drum-block' : originalSeg.el.classList.contains('instrument-block') ? 'instrument-block' : 'waveform-block';
        const row = document.querySelector(`.arrangement-track-row[data-index='${trackIndex}']`);
        const segEl = document.createElement('div');
        segEl.className = 'arr-segment ' + type;
        const leftPx = pasteStart * pxPerSec;
        const widthPx = originalSeg.duration * pxPerSec;
        segEl.style.left = leftPx + 'px';
        segEl.style.width = widthPx + 'px';
        row.appendChild(segEl);
        const newSeg = {
            start: pasteStart,
            duration: originalSeg.duration,
            el: segEl,
            buffer: originalSeg.buffer,
            played: false,
            volume: originalSeg.volume ?? 1,
            pitch: originalSeg.pitch ?? 1
        };
        if (type === 'drum-block') {
            newSeg.beats = originalSeg.beats;
            newSeg.name = originalSeg.name + ' copy';
            newSeg.number = drumBlockCounter++;
            segEl.segment = newSeg;
            const numSpan = document.createElement('span');
            numSpan.className = 'drum-block-number';
            numSpan.textContent = newSeg.number;
            segEl.appendChild(numSpan);
            generateDrumThumbnail(segEl, newSeg);
        } else if (type === 'instrument-block') {
            newSeg.name = originalSeg.name + ' copy';
            newSeg.number = instrumentBlockCounter++;
            newSeg.beats = originalSeg.beats;
            segEl.segment = newSeg;
            const numSpan = document.createElement('span');
            numSpan.className = 'instrument-block-number';
            numSpan.textContent = newSeg.number;
            segEl.appendChild(numSpan);
        } else {
            // clone waveform canvas if present
            const origCanvas = originalSeg.el.querySelector('canvas');
            if (origCanvas) {
                const canvas = document.createElement('canvas');
                canvas.width = origCanvas.width;
                canvas.height = origCanvas.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(origCanvas, 0, 0);
                segEl.appendChild(canvas);
            }
        }
        tracks[trackIndex].segments.push(newSeg);
        segEl.addEventListener('click', e => {
            e.stopPropagation();
            document.querySelectorAll('.arr-segment.selected').forEach(el => el.classList.remove('selected'));
            segEl.classList.add('selected');
            window.dispatchEvent(new CustomEvent('segmentSelected', {detail: {trackIndex, segment: newSeg}}));
        });
        makeDraggableResizable(segEl, newSeg, trackIndex);
        return {el: segEl, segment: newSeg};
    }

    // 监听鼓机编辑更新事件，实时更新缩略图
    window.addEventListener('segmentUpdated', e => {
        const segment = e.detail.segment;
        if (segment && segment.el && segment.el.classList.contains('drum-block')) {
            generateDrumThumbnail(segment.el, segment);
        }
    });

    function refreshArrangement() {
        arrangementArea = document.querySelector('.arrangement-area');
        arrangementArea.innerHTML = '';
        tracks = [];
        const trackItems = document.querySelectorAll('.studio-track-scroll .track-list .track-item');
        if (trackItems.length) {
            const headerHeight = trackItems[0].getBoundingClientRect().height;
            document.documentElement.style.setProperty('--track-row-height', headerHeight + 'px');
        }
        trackItems.forEach((item, idx) => {
            const type = item.dataset.type;
            const isInstrument = (type === 'piano');
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
            if (type === 'drum') {
                row.addEventListener('mousedown', function (e) {
                    console.log('[debug] mousedown on drum row');
                    if (!document.body.classList.contains('paint-mode')) return;
                    e.preventDefault();
                    const scrollContainer = document.querySelector('.studio-arrangement-scroll');
                    // use scroll container bounds to calculate correct positions when scrolled
                    const rect = scrollContainer.getBoundingClientRect();
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
                        if (width < 0) width = 0;
                        segEl.style.width = width + 'px';
                    }

                    function onUp(ev) {
                        console.log('[debug] mouseup on drum row');
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                        const mx = ev.clientX - rect.left + scrollContainer.scrollLeft;
                        const endSnap = Math.round(mx / currentPxPerBeat) * currentPxPerBeat;
                        if (endSnap > startSnap) {
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
                            segEl.segment = segment; // 关键 segment 赋值给 segEl，便于后续读取编号
                            // 用span包裹编号，便于样��控制
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
                                    document.querySelectorAll('.arr-segment.drum-block.selected').forEach(el => el.classList.remove('selected'));
                                    segEl.classList.add('selected');
                                    // select corresponding track-item
                                    const items = document.querySelectorAll('.studio-track-scroll .track-list .track-item');
                                    items.forEach(i => i.classList.remove('selected'));
                                    const ti = items[trackIndex];
                                    if (ti) ti.classList.add('selected');
                                    // notify bottom panel
                                    window.dispatchEvent(new CustomEvent('segmentSelected', {
                                        detail: {
                                            trackIndex,
                                            segment
                                        }
                                    }));
                                }
                            });
                            // enable dragging and resizing in select-mode
                            makeDraggableResizable(segEl, segment, idx);
                            // 生成缩略图
                            generateDrumThumbnail(segEl, segment);
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
            // enable paint-mode instrument block creation
            else if (isInstrument) {
                row.addEventListener('mousedown', function (e) {
                    if (!document.body.classList.contains('paint-mode')) return;
                    e.preventDefault();
                    const scrollContainer = document.querySelector('.studio-arrangement-scroll');
                    const rect = scrollContainer.getBoundingClientRect();
                    const startX = e.clientX - rect.left + scrollContainer.scrollLeft;
                    const startSnap = Math.round(startX / currentPxPerBeat) * currentPxPerBeat;
                    const segEl = document.createElement('div');
                    segEl.className = 'arr-segment instrument-block';
                    segEl.style.left = startSnap + 'px';
                    segEl.style.width = '0px';
                    row.appendChild(segEl);

                    function onMove(ev) {
                        ev.preventDefault();
                        const mx = ev.clientX - rect.left + scrollContainer.scrollLeft;
                        let snapX = Math.round(mx / currentPxPerBeat) * currentPxPerBeat;
                        let width = snapX - startSnap;
                        if (width < 0) width = 0;
                        segEl.style.width = width + 'px';
                    }

                    function onUp(ev) {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                        const mx = ev.clientX - rect.left + scrollContainer.scrollLeft;
                        const endSnap = Math.round(mx / currentPxPerBeat) * currentPxPerBeat;
                        if (endSnap > startSnap) {
                            segEl.style.width = (endSnap - startSnap) + 'px';
                            const segment = {
                                start: startSnap / pxPerSec,
                                duration: (endSnap - startSnap) / pxPerSec,
                                el: segEl,
                                buffer: null,
                                played: false,
                                name: 'Instrument ' + instrumentBlockCounter,
                                number: instrumentBlockCounter
                            };
                            instrumentBlockCounter++;
                            // 新增：记录 instrument-block 的 beats 属性
                            segment.beats = (endSnap - startSnap) / currentPxPerBeat;
                            const numSpan = document.createElement('span');
                            numSpan.className = 'instrument-block-number';
                            numSpan.textContent = segment.number;
                            segEl.appendChild(numSpan);
                            tracks[idx].segments.push(segment);
                            segEl.segment = segment;
                            segEl.addEventListener('click', function (ev) {
                                ev.stopPropagation();
                                document.querySelectorAll('.arr-segment.instrument-block.selected').forEach(el => el.classList.remove('selected'));
                                segEl.classList.add('selected');
                                window.dispatchEvent(new CustomEvent('segmentSelected', {
                                    detail: {
                                        trackIndex: idx,
                                        segment
                                    }
                                }));
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
        });
        // sync vertical scroll between track panel and arrangement
        const trackScroll = document.querySelector('.studio-track-scroll');
        const arrangeScroll = document.querySelector('.studio-arrangement-scroll');
        trackScroll.addEventListener('scroll', () => {
            arrangeScroll.scrollTop = trackScroll.scrollTop;
        });
        arrangeScroll.addEventListener('scroll', () => {
            trackScroll.scrollTop = arrangeScroll.scrollTop;
        });
        initPlayhead();
        initTimeline();
        setPosition(currentPos / pxPerSec); // restore position

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
                    // 确保渲染缩略图
                    if (block.segment) generateDrumThumbnail(block, block.segment);
                }
            });
        }, 100);

        // 立即调试：每次新建 drum-block 时打印
        document.querySelectorAll('.arr-segment.drum-block').forEach((block, idx) => {
            console.log('[debug][immediate] drum-block', idx, block, block.textContent, block.querySelector('.drum-block-number'));
        });
    }

    function initPlayhead() {
        const scroll = document.querySelector('.studio-arrangement-scroll');
        if (playheadEl) playheadEl.remove();
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
                if (currentPxPerBeat > 0) {
                    const snapLine = Math.round(newLeft / currentPxPerBeat) * currentPxPerBeat;
                    if (Math.abs(snapLine - newLeft) <= snapThreshold) newLeft = snapLine;
                }
                playheadEl.style.left = newLeft + 'px';
                currentPos = newLeft;
                // update timer
                const sec = currentPos / pxPerSec;
                const h = String(Math.floor(sec / 3600)).padStart(2, '0');
                const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
                const s = String(Math.floor(sec % 60)).padStart(2, '0');
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
        window.dispatchEvent(new CustomEvent('playheadMoved', {detail: {position: currentPos}}));
    }

    // ========== 优化播放头移动逻辑 ==========
    // 用 requestAnimationFrame 替代 setInterval，提升流畅度
    let playheadRAF = null;
    function startPlayback() {
        isPlaying = true;
        let lastTimestamp = null;
        function rafStep(timestamp) {
            if (!isPlaying) return;
            if (!lastTimestamp) lastTimestamp = timestamp;
            // 计算每帧应移动的像素，基于 BPM
            const bpm = parseFloat(document.querySelector('.studio-bpm input').value) || defaultBPM;
            const pxPerBeat = currentPxPerBeat || (pxPerSec * 4 / bpm); // 兜底
            const pxPerSecEff = (bpm / 60) * currentPxPerBeat * (4 / (parseInt(document.getElementById('studio-meter-select').value.split('/')[0]) || 4));
            const elapsed = (timestamp - lastTimestamp) / 1000;
            // 以 pxPerSecEff 为基准，移动距离
            const movePx = pxPerSecEff * elapsed;
            updatePlayheadPosition(currentPos + movePx);
            lastTimestamp = timestamp;
            playheadRAF = requestAnimationFrame(rafStep);
        }
        playheadRAF = requestAnimationFrame(rafStep);
    }
    function stopPlayback() {
        isPlaying = false;
        if (playheadRAF) cancelAnimationFrame(playheadRAF);
        playheadRAF = null;
    }

    // startPlayhead 也用 requestAnimationFrame
    function startPlayhead() {
        if (isPlaying) return;
        activeSources = []; // clear previous sources
        isPlaying = true;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        tracks.forEach(t => t.segments.forEach(s => s.played = false));
        let lastTimestamp = null;
        function rafStep(timestamp) {
            if (!isPlaying) return;
            if (!lastTimestamp) lastTimestamp = timestamp;
            const bpm = parseFloat(document.querySelector('.studio-bpm input').value) || defaultBPM;
            const pxPerBeat = currentPxPerBeat || (pxPerSec * 4 / bpm);
            const pxPerSecEff = (bpm / 60) * currentPxPerBeat * (4 / (parseInt(document.getElementById('studio-meter-select').value.split('/')[0]) || 4));
            const elapsed = (timestamp - lastTimestamp) / 1000;
            const movePx = pxPerSecEff * elapsed;
            const newPos = currentPos + movePx;
            updatePlayheadPosition(newPos);
            if (window.metronomeOn && typeof window.tickMetronome === 'function') window.tickMetronome(currentPos / pxPerSec);
            checkPlaySegments(currentPos / pxPerSec);
            lastTimestamp = timestamp;
            playheadRAF = requestAnimationFrame(rafStep);
        }
        playheadRAF = requestAnimationFrame(rafStep);
    }
    function stopPlayhead() {
        if (playheadRAF) cancelAnimationFrame(playheadRAF);
        playheadRAF = null;
        // stop all currently playing audio sources immediately
        activeSources.forEach(src => {
            try {
                src.stop(0);
            } catch (e) {
            }
        });
        activeSources = [];
        isPlaying = false;
        if (typeof window.resetMetronome === 'function') window.resetMetronome();
    }

    function resetPlayhead() {
        stopPlayhead();
        currentPos = 0;
        if (playheadEl) playheadEl.style.left = '0';
        if (typeof window.resetMetronome === 'function') window.resetMetronome();
    }

    function resizePlayhead() {
        const scroll = document.querySelector('.studio-arrangement-scroll');
        if (playheadEl && scroll) {
            playheadEl.style.height = scroll.scrollHeight + 'px';
        }
    }

    // ====== 波形块调试面板 ======
    let debugPanel = null;
    function showWaveformDebugPanel(segment, segEl, pageX, pageY) {
        if (debugPanel) debugPanel.remove();
        debugPanel = document.createElement('div');
        debugPanel.className = 'waveform-debug-panel';
        debugPanel.style.position = 'fixed';
        debugPanel.style.left = pageX + 'px';
        debugPanel.style.top = pageY + 'px';
        debugPanel.style.zIndex = 99999;
        debugPanel.style.background = '#222';
        debugPanel.style.color = '#fff';
        debugPanel.style.padding = '16px 20px 12px 20px';
        debugPanel.style.borderRadius = '8px';
        debugPanel.style.boxShadow = '0 2px 12px rgba(0,0,0,0.3)';
        debugPanel.innerHTML = `
            <div style="font-weight:bold;margin-bottom:8px;">波形块调试</div>
            <div style="margin-bottom:8px;">
                <label>音量 <input type="range" min="0" max="2" step="0.01" value="${segment.volume ?? 1}" id="waveform-volume-slider" style="width:120px;vertical-align:middle;"> <span id="waveform-volume-val">${(segment.volume ?? 1).toFixed(2)}</span></label>
            </div>
            <div style="margin-bottom:8px;">
                <label>音高 <input type="range" min="0.5" max="2" step="0.01" value="${segment.pitch ?? 1}" id="waveform-pitch-slider" style="width:120px;vertical-align:middle;"> <span id="waveform-pitch-val">${(segment.pitch ?? 1).toFixed(2)}</span></label>
            </div>
            <button id="waveform-debug-close" style="margin-top:4px;">关闭</button>
        `;
        document.body.appendChild(debugPanel);
        // 音量滑块
        debugPanel.querySelector('#waveform-volume-slider').addEventListener('input', e => {
            segment.volume = parseFloat(e.target.value);
            debugPanel.querySelector('#waveform-volume-val').textContent = segment.volume.toFixed(2);
        });
        // 音高滑块
        debugPanel.querySelector('#waveform-pitch-slider').addEventListener('input', e => {
            segment.pitch = parseFloat(e.target.value);
            debugPanel.querySelector('#waveform-pitch-val').textContent = segment.pitch.toFixed(2);
        });
        // 关闭按钮
        debugPanel.querySelector('#waveform-debug-close').onclick = () => debugPanel.remove();
        // 点击面板外关闭
        setTimeout(() => {
            function closeOnClick(e) {
                if (!debugPanel.contains(e.target)) {
                    debugPanel.remove();
                    document.removeEventListener('mousedown', closeOnClick);
                }
            }
            document.addEventListener('mousedown', closeOnClick);
        }, 0);
    }

    function checkPlaySegments(time) {
        const soloExists = tracks.some(t => t.solo);
        tracks.forEach(track => {
            // skip tracks based on solo/mute state
            if (soloExists ? !track.solo : track.muted) return;
            track.segments.forEach(seg => {
                if (!seg.played && time >= seg.start && time <= seg.start + seg.duration) {
                    // handle drum-block segments via drum machine control
                    if (seg.el && seg.el.classList.contains('drum-block')) {
                        if (window.playDrumMachine) window.playDrumMachine();
                    } else if (seg.buffer) {
                        const src = audioCtx.createBufferSource();
                        src.buffer = seg.buffer;
                        // 保持音高不变，播放速率固定为1
                        src.playbackRate.value = 1;
                        // 音量
                        const gainNode = audioCtx.createGain();
                        gainNode.gain.value = seg.volume != null ? seg.volume : 1;
                        src.connect(gainNode).connect(track.gainNode);
                        src.start(0, time - seg.start);
                        activeSources.push(src);
                    }
                    seg.played = true;
                }
                // pause drum-machine when playhead exits segment
                if (seg.played && seg.el && seg.el.classList.contains('drum-block') && time > seg.start + seg.duration) {
                    if (window.pauseDrumMachine) window.pauseDrumMachine();
                    // allow replay if needed
                    seg.played = false;
                }
            });
        });
    }

    // ========== 修改点1：动态获取 pxPerSec ===========
    function getPxPerSec() {
        // 以当前BPM动态计算每秒多少像素
        const bpm = parseFloat(document.querySelector('.studio-bpm input').value) || defaultBPM;
        const meter = parseInt(document.getElementById('studio-meter-select').value.split('/')[0]) || 4;
        // pxPerSec = 每拍像素 * 每分钟拍数 / 60
        return (currentPxPerBeat || (pxPerSec * 4 / bpm)) * (bpm / 60) * (4 / meter);
    }

    // ========== 修改点2：addWaveformBlock 使用动态 pxPerSec ===========
    function addWaveformBlock(trackIndex, url, blob, offset = 0) {
        const track = tracks[trackIndex];
        const segment = {start: offset, duration: 0, el: null, buffer: null, played: false, volume: 1, pitch: 1};
        track.segments.push(segment);
        const row = document.querySelector(`.arrangement-track-row[data-index='${trackIndex}']`);
        const segEl = document.createElement('div');
        segEl.className = 'arr-segment waveform-block';
        // 动态获取 pxPerSec
        const pxPerSecNow = getPxPerSec();
        segEl.style.left = (offset * pxPerSecNow) + 'px';
        const canvas = document.createElement('canvas');
        segEl.appendChild(canvas);
        blob.arrayBuffer().then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer)).then(buffer => {
            segment.buffer = buffer;
            const raw = buffer.getChannelData(0);
            const duration = buffer.duration;
            segment.duration = duration;
            // 动态获取 pxPerSec
            const pxPerSecNow = getPxPerSec();
            const width = duration * pxPerSecNow;
            canvas.width = width;
            canvas.height = segment.el ? segment.el.getBoundingClientRect().height : canvas.height;
            segEl.style.width = width + 'px';
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#444';
            ctx.fillRect(0, 0, width, canvas.height);
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#fff';
            const step = Math.ceil(raw.length / width);
            const amp = canvas.height / 2;
            for (let x = 0; x < width; x++) {
                let min = 1.0, max = -1.0;
                for (let i = 0; i < step; i++) {
                    const datum = raw[x * step + i];
                    if (datum < min) min = datum;
                    if (datum > max) max = datum;
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
                window.dispatchEvent(new CustomEvent('segmentSelected', {detail: {trackIndex, segment}}));
            }
        });
        // 右键弹出调试面板
        segEl.addEventListener('contextmenu', e => {
            e.preventDefault();
            showWaveformDebugPanel(segment, segEl, e.clientX, e.clientY);
        });
        makeDraggableResizable(segEl, segment, trackIndex);
    }

    // ========== 修改点3：BPM变化时重绘波形 ===========
    function updateWaveformBlockWidths() {
        const bpm = parseFloat(document.querySelector('.studio-bpm input').value) || defaultBPM;
        const meter = parseInt(document.getElementById('studio-meter-select').value.split('/')[0]) || 4;
        const newPxPerSec = (currentPxPerBeat || (pxPerSec * 4 / bpm)) * (bpm / 60) * (4 / meter);
        tracks.forEach((track, trackIdx) => {
            track.segments.forEach(segment => {
                if (segment.el && segment.el.classList.contains('waveform-block')) {
                    const newWidth = segment.duration * newPxPerSec;
                    segment.el.style.width = newWidth + 'px';
                    const canvas = segment.el.querySelector('canvas');
                    if (canvas && segment.buffer) {
                        canvas.width = newWidth;
                        canvas.height = segment.el.getBoundingClientRect().height;
                        // 重新绘制波形
                        const raw = segment.buffer.getChannelData(0);
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#444';
                        ctx.fillRect(0, 0, newWidth, canvas.height);
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = '#fff';
                        const step = Math.ceil(raw.length / newWidth);
                        const amp = canvas.height / 2;
                        for (let x = 0; x < newWidth; x++) {
                            let min = 1.0, max = -1.0;
                            for (let i = 0; i < step; i++) {
                                const datum = raw[x * step + i];
                                if (datum < min) min = datum;
                                if (datum > max) max = datum;
                            }
                            const yLow = (1 + min) * amp;
                            const yHigh = (1 + max) * amp;
                            ctx.beginPath();
                            ctx.moveTo(x, canvas.height - yLow);
                            ctx.lineTo(x, canvas.height - yHigh);
                            ctx.stroke();
                        }
                    }
                }
            });
        });
    }

    // 绑定BPM输入框事件
    const bpmInput = document.querySelector('.studio-bpm input');
    if (bpmInput) {
        bpmInput.addEventListener('change', updateWaveformBlockWidths);
        bpmInput.addEventListener('input', updateWaveformBlockWidths);
    }

    function makeDraggableResizable(el, segment, trackIndex) {
        let mode = null, startX = 0, origLeft = 0, origWidth = 0;
        el.addEventListener('mousedown', e => {
            // only allow drag/resize in select-mode
            if (!document.body.classList.contains('select-mode')) return;
            e.preventDefault();
            // shift-drag to copy: only duplicate, do not override original listener
            if (e.shiftKey) {
                e.preventDefault();
                const {el: newEl, segment: newSegment} = duplicateSegment(trackIndex, segment);
                // initialize dragging for the new element
                let startX = e.clientX;
                let origLeft = parseFloat(newEl.style.left);

                function onMove(ev) {
                    const dx = ev.clientX - startX;
                    let rawLeft = origLeft + dx;
                    const parentW = newEl.parentElement.getBoundingClientRect().width;
                    if (newEl.classList.contains('drum-block')) {
                        let newLeft = Math.round(rawLeft / currentPxPerBeat) * currentPxPerBeat;
                        newLeft = Math.max(0, Math.min(newLeft, parentW - parseFloat(newEl.style.width)));
                        let overlap = false;
                        tracks[trackIndex].segments.forEach(s => {
                            if (s === newSegment) return;
                            const oL = parseFloat(s.el.style.left);
                            const oR = oL + parseFloat(s.el.style.width);
                            if (newLeft < oR && newLeft + parseFloat(newEl.style.width) > oL) overlap = true;
                        });
                        if (!overlap) {
                            newEl.style.left = newLeft + 'px';
                            newSegment.start = newLeft / pxPerSec;
                        }
                    } else {
                        let newLeft = rawLeft;
                        if (currentPxPerBeat > 0) {
                            const snapLine = Math.round(rawLeft / currentPxPerBeat) * currentPxPerBeat;
                            if (Math.abs(snapLine - rawLeft) <= snapThreshold) newLeft = snapLine;
                        }
                        newLeft = Math.max(0, Math.min(newLeft, parentW - parseFloat(newEl.style.width)));
                        newEl.style.left = newLeft + 'px';
                        newSegment.start = newLeft / pxPerSec;
                        let overlapUi = false;
                        tracks[trackIndex].segments.forEach(s => {
                            if (s === newSegment || !s.el.classList.contains('waveform-block')) return;
                            const oL = parseFloat(s.el.style.left);
                            const oR = oL + parseFloat(s.el.style.width);
                            if (newLeft < oR && newLeft + parseFloat(newEl.style.width) > oL) overlapUi = true;
                        });
                        if (overlapUi) newEl.classList.add('overlap'); else newEl.classList.remove('overlap');
                    }
                }

                function onUp() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    if (newEl.classList.contains('drum-block')) {
                        window.dispatchEvent(new CustomEvent('segmentUpdated', {
                            detail: {
                                trackIndex,
                                segment: newSegment
                            }
                        }));
                    }
                }

                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
                return;
            }
            startX = e.clientX;
            origLeft = parseFloat(el.style.left);
            origWidth = parseFloat(el.style.width);
            const localX = e.offsetX;
            if (localX < 10) mode = 'resize-left';
            else if (localX > origWidth - 10) mode = 'resize-right';
            else mode = 'move';

            function onMove(ev) {
                const dx = ev.clientX - startX;
                if (mode === 'move') {
                    const rawLeft = origLeft + dx;
                    let newLeft = rawLeft;
                    // clamp within container
                    const parentW = el.parentElement.getBoundingClientRect().width;
                    if (el.classList.contains('waveform-block')) {
                        // free move with magnetic snap for waveform
                        if (currentPxPerBeat > 0) {
                            const snapLine = Math.round(rawLeft / currentPxPerBeat) * currentPxPerBeat;
                            if (Math.abs(snapLine - rawLeft) <= snapThreshold) newLeft = snapLine;
                        }
                        newLeft = Math.max(0, Math.min(newLeft, parentW - origWidth));
                        // apply position
                        el.style.left = newLeft + 'px';
                        segment.start = newLeft / pxPerSec;
                        // check overlap UI for waveform
                        let overlapUi = false;
                        tracks[trackIndex].segments.forEach(s => {
                            if (s === segment || !s.el.classList.contains('waveform-block')) return;
                            const oL = parseFloat(s.el.style.left);
                            const oR = oL + parseFloat(s.el.style.width);
                            if (newLeft < oR && newLeft + origWidth > oL) overlapUi = true;
                        });
                        if (overlapUi) el.classList.add('overlap'); else el.classList.remove('overlap');
                    } else {
                        // strict snap and no-overlap for drum blocks
                        newLeft = Math.round(rawLeft / currentPxPerBeat) * currentPxPerBeat;
                        newLeft = Math.max(0, Math.min(newLeft, parentW - origWidth));
                        let overlap = false;
                        tracks[trackIndex].segments.forEach(s => {
                            if (s === segment) return;
                            const oL = parseFloat(s.el.style.left);
                            const oR = oL + parseFloat(s.el.style.width);
                            if (newLeft < oR && newLeft + origWidth > oL) overlap = true;
                        });
                        if (!overlap) {
                            el.style.left = newLeft + 'px';
                            segment.start = newLeft / pxPerSec;
                        }
                    }
                } else if (mode === 'resize-right') {
                    let newW = origWidth + dx;
                    newW = Math.max(currentPxPerBeat, newW);
                    newW = Math.round(newW / currentPxPerBeat) * currentPxPerBeat;
                    el.style.width = newW + 'px';
                    segment.duration = newW / pxPerSec;
                    // 新增：如果是 instrument-block 也同步 beats
                    if (el.classList.contains('instrument-block')) {
                        segment.beats = newW / currentPxPerBeat;
                        // 新增：缩放时立即刷新钢琴窗
                        window.dispatchEvent(new CustomEvent('segmentSelected', {
                            detail: {
                                trackIndex: trackIndex,
                                segment: segment
                            }
                        }));
                    }
                    if (el.classList.contains('drum-block')) {
                        segment.beats = newW / currentPxPerBeat;
                    }
                } else if (mode === 'resize-left') {
                    let newL = origLeft + dx;
                    let newW = origWidth - dx;
                    // clamp
                    if (newL < 0) {
                        newW += newL;
                        newL = 0;
                    }
                    newW = Math.max(currentPxPerBeat, newW);
                    newL = Math.round(newL / currentPxPerBeat) * currentPxPerBeat;
                    const delta = newL - origLeft;
                    newW = origWidth - delta;
                    el.style.left = newL + 'px';
                    el.style.width = newW + 'px';
                    segment.start = newL / pxPerSec;
                    segment.duration = newW / pxPerSec;
                    // 新增：如果是 instrument-block 也同步 beats
                    if (el.classList.contains('instrument-block')) {
                        segment.beats = newW / currentPxPerBeat;
                        // 新增：缩放时立即刷新钢琴窗
                        window.dispatchEvent(new CustomEvent('segmentSelected', {
                            detail: {
                                trackIndex: trackIndex,
                                segment: segment
                            }
                        }));
                    }
                    if (el.classList.contains('drum-block')) {
                        segment.beats = newW / currentPxPerBeat;
                    }
                }
            }

            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                // notify that segment was updated (for live editor refresh)
                if (el.classList.contains('drum-block')) {
                    window.dispatchEvent(new CustomEvent('segmentUpdated', {detail: {trackIndex, segment}}));
                }
            }

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    // keyboard copy-paste
    document.addEventListener('keydown', e => {
        // CTRL+C
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            const sel = document.querySelector('.arr-segment.selected');
            if (sel && sel.segment) {
                const idx = parseInt(sel.closest('.arrangement-track-row').dataset.index, 10);
                clipboard = {trackIndex: idx, segment: sel.segment};
            }
        }
        // CTRL+V
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            if (clipboard) {
                duplicateSegment(clipboard.trackIndex, clipboard.segment);
            }
        }
    });

    // set playhead to specific time position
    function setPosition(seconds) {
        currentPos = seconds * pxPerSec;
        if (playheadEl) playheadEl.style.left = currentPos + 'px';
    }

    // initialize timeline ticks and click-to-seek
    function initTimeline() {
        const wrapper = document.querySelector('.studio-timeline-wrapper');
        // grid uses default BPM
        const bpm = defaultBPM;
        const meter = document.getElementById('studio-meter-select').value;
        const beatsPerBar = parseInt(meter.split('/')[0]);
        const secondsPerBar = (60 / bpm) * beatsPerBar;
        const pxPerBar = secondsPerBar * pxPerSec;
        const numBars = 128;
        // store pxPerBar and pxPerBeat for snapping
        currentPxPerBar = pxPerBar;
        currentPxPerBeat = pxPerBar / beatsPerBar;
        const totalWidth = numBars * pxPerBar;
        // set wrapper and arrangement-area widths
        wrapper.innerHTML = '';
        wrapper.style.width = totalWidth + 'px';
        const area = document.querySelector('.arrangement-area');
        if (area) {
            area.style.width = totalWidth + 'px';
            area.style.setProperty('--beat-width', (pxPerBar / beatsPerBar) + 'px');
            area.style.setProperty('--bar-width', pxPerBar + 'px');
        }
        for (let i = 0; i < numBars; i++) {
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
            if (currentPxPerBeat > 0) {
                const snapLine = Math.round(x / currentPxPerBeat) * currentPxPerBeat;
                if (Math.abs(snapLine - x) <= snapThreshold) x = snapLine;
            }
            setPosition(x / pxPerSec);
            // update timer display
            const sec = currentPos / pxPerSec;
            const h = String(Math.floor(sec / 3600)).padStart(2, '0');
            const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
            const s = String(Math.floor(sec % 60)).padStart(2, '0');
            document.querySelector('.studio-timer').textContent = `${h}:${m}:${s}`;
        });
        // sync scrolling
        const arrScroll = document.querySelector('.studio-arrangement-scroll');
        timelineScroll.addEventListener('scroll', () => {
            arrScroll.scrollLeft = timelineScroll.scrollLeft;
        });
        arrScroll.addEventListener('scroll', () => {
            timelineScroll.scrollLeft = arrScroll.scrollLeft;
        });
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
                if (currentPxPerBeat > 0) {
                    const snapLine = Math.round(x / currentPxPerBeat) * currentPxPerBeat;
                    if (Math.abs(snapLine - x) <= snapThreshold) x = snapLine;
                }
                playheadEl.style.left = x + 'px';
                currentPos = x;
                // update timer
                const sec = currentPos / pxPerSec;
                const h = String(Math.floor(sec / 3600)).padStart(2, '0');
                const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
                const s = String(Math.floor(sec % 60)).padStart(2, '0');
                document.querySelector('.studio-timer').textContent = `${h}:${m}:${s}`;
            }

            function onUp(ev) {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    function getCurrentTime() {
        return currentPos / pxPerSec;
    }

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
        if (type === 'drum') {
            row.addEventListener('mousedown', function (e) {
                console.log('[debug] mousedown on drum row');
                if (!document.body.classList.contains('paint-mode')) return;
                e.preventDefault();
                const scrollContainer = document.querySelector('.studio-arrangement-scroll');
                // use scroll container bounds to calculate correct positions when scrolled
                const rect = scrollContainer.getBoundingClientRect();
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
                    if (width < 0) width = 0;
                    segEl.style.width = width + 'px';
                }

                function onUp(ev) {
                    console.log('[debug] mouseup on drum row');
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    const mx = ev.clientX - rect.left + scrollContainer.scrollLeft;
                    const endSnap = Math.round(mx / currentPxPerBeat) * currentPxPerBeat;
                    if (endSnap > startSnap) {
                        segEl.style.width = (endSnap - startSnap) + 'px';
                        const segment = {
                            start: startSnap / pxPerSec,
                            duration: (endSnap - startSnap) / pxPerSec,
                            el: segEl,
                            buffer: null,
                            played: false
                        };
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
                                document.querySelectorAll('.arr-segment.drum-block.selected').forEach(el => el.classList.remove('selected'));
                                segEl.classList.add('selected');
                                const items = document.querySelectorAll('.studio-track-scroll .track-list .track-item');
                                items.forEach(i => i.classList.remove('selected'));
                                const ti = items[trackIndex];
                                if (ti) ti.classList.add('selected');
                                window.dispatchEvent(new CustomEvent('segmentSelected', {
                                    detail: {
                                        trackIndex,
                                        segment
                                    }
                                }));
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
        // enable paint-mode instrument block creation for new row
        else if (type === 'piano') {
            row.addEventListener('mousedown', function (e) {
                if (!document.body.classList.contains('paint-mode')) return;
                e.preventDefault();
                const scrollContainer = document.querySelector('.studio-arrangement-scroll');
                const rect = scrollContainer.getBoundingClientRect();
                const startX = e.clientX - rect.left + scrollContainer.scrollLeft;
                const startSnap = Math.round(startX / currentPxPerBeat) * currentPxPerBeat;
                const segEl = document.createElement('div');
                segEl.className = 'arr-segment instrument-block';
                segEl.style.left = startSnap + 'px';
                segEl.style.width = '0px';
                row.appendChild(segEl);

                function onMove(ev) {
                    ev.preventDefault();
                    const mx = ev.clientX - rect.left + scrollContainer.scrollLeft;
                    let snapX = Math.round(mx / currentPxPerBeat) * currentPxPerBeat;
                    let width = snapX - startSnap;
                    if (width < 0) width = 0;
                    segEl.style.width = width + 'px';
                }

                function onUp(ev) {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    const mx = ev.clientX - rect.left + scrollContainer.scrollLeft;
                    const endSnap = Math.round(mx / currentPxPerBeat) * currentPxPerBeat;
                    if (endSnap > startSnap) {
                        segEl.style.width = (endSnap - startSnap) + 'px';
                        const segment = {
                            start: startSnap / pxPerSec,
                            duration: (endSnap - startSnap) / pxPerSec,
                            el: segEl,
                            buffer: null,
                            played: false,
                            name: 'Instrument ' + instrumentBlockCounter,
                            number: instrumentBlockCounter
                        };
                        instrumentBlockCounter++;
                        // 新增：记录 instrument-block 的 beats 属性
                        segment.beats = (endSnap - startSnap) / currentPxPerBeat;
                        const numSpan = document.createElement('span');
                        numSpan.className = 'instrument-block-number';
                        numSpan.textContent = segment.number;
                        segEl.appendChild(numSpan);
                        tracks[idx].segments.push(segment);
                        segEl.segment = segment;
                        segEl.addEventListener('click', function (ev) {
                            ev.stopPropagation();
                            document.querySelectorAll('.arr-segment.instrument-block.selected').forEach(el => el.classList.remove('selected'));
                            segEl.classList.add('selected');
                            window.dispatchEvent(new CustomEvent('segmentSelected', {
                                detail: {
                                    trackIndex: idx,
                                    segment
                                }
                            }));
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
        if (origIndex === newIndex) return;
        // reorder data
        const track = tracks.splice(origIndex, 1)[0];
        tracks.splice(newIndex, 0, track);
        // reorder DOM rows
        const rows = Array.from(arrangementArea.querySelectorAll('.arrangement-track-row'));
        const moved = rows[origIndex];
        if (moved) {
            moved.remove();
            const before = rows[newIndex] && rows[newIndex] !== moved ? rows[newIndex] : null;
            if (before) arrangementArea.insertBefore(moved, before);
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
        const soloExists = tracks.some(t => t.solo);
        tracks.forEach(t => {
            let gainVal = t.volume;
            if (soloExists) gainVal = t.solo ? t.volume : 0;
            else if (t.muted) gainVal = 0;
            t.gainNode.gain.value = gainVal;
        });
    }

    // ===== 鼓机联动播放逻辑 =====
    let drumBlockPlaybackState = { block: null, step: null };
    window.addEventListener('playheadMoved', e => {
        const px = e.detail.position;
        const bpm = parseFloat(document.querySelector('.studio-bpm input').value) || 120;
        // 只查找当前 playhead 所在 drum-block
        let foundBlock = null, foundStep = null, foundParams = null;
        document.querySelectorAll('.arr-segment.drum-block').forEach(block => {
            if (!block.segment) {
                for (const t of tracks) {
                    const seg = t.segments.find(s => s.el === block);
                    if (seg) {
                        block.segment = seg;
                        break;
                    }
                }
            }
            const left = parseFloat(block.style.left);
            const width = parseFloat(block.style.width);
            const startPx = left;
            const endPx = left + width;
            const blockBeats = block.segment ? block.segment.beats : (width / currentPxPerBeat);
            const totalSteps = blockBeats * 4; // subdivisions=4
            const blockStartSec = startPx / pxPerSec;
            const blockDurationSec = width / pxPerSec;
            if (px >= startPx && px < endPx) {
                const playheadSec = px / pxPerSec;
                const offsetSec = playheadSec - blockStartSec;
                const step = Math.floor((offsetSec / blockDurationSec) * totalSteps);
                foundBlock = block;
                foundStep = step;
                foundParams = { step, offsetSec, bpm, totalSteps };
            }
        });
        // 只在 step 变化时触发 playFromStep
        if (foundBlock) {
            if (drumBlockPlaybackState.block !== foundBlock || drumBlockPlaybackState.step !== foundStep) {
                if (window.studioDrumMachineControl) {
                    window.studioDrumMachineControl.playFromStep(foundParams.step, foundParams.offsetSec, foundParams.bpm, foundParams.totalSteps);
                }
                drumBlockPlaybackState = { block: foundBlock, step: foundStep };
            }
        } else {
            // 离开 drum-block 区域才 stop
            if (drumBlockPlaybackState.block) {
                if (window.studioDrumMachineControl) {
                    window.studioDrumMachineControl.stop();
                }
                drumBlockPlaybackState = { block: null, step: null };
            }
        }
    });

    // ===== 乐器轨（instrument-block）联动播放逻辑 =====
    let instrumentBlockPlaybackState = { block: null, step: null };
    window.addEventListener('playheadMoved', e => {
        const px = e.detail.position;
        const bpm = parseFloat(document.querySelector('.studio-bpm input').value) || 120;
        let foundBlock = null, foundStep = null, foundParams = null;
        document.querySelectorAll('.arr-segment.instrument-block').forEach(block => {
            if (!block.segment) {
                for (const t of tracks) {
                    const seg = t.segments.find(s => s.el === block);
                    if (seg) {
                        block.segment = seg;
                        break;
                    }
                }
            }
            const left = parseFloat(block.style.left);
            const width = parseFloat(block.style.width);
            const startPx = left;
            const endPx = left + width;
            const blockBeats = block.segment ? block.segment.beats : (width / currentPxPerBeat);
            const totalSteps = Math.round(blockBeats * 4); // subdivisions=4
            const blockStartSec = startPx / pxPerSec;
            const blockDurationSec = width / pxPerSec;
            if (px >= startPx && px < endPx) {
                const playheadSec = px / pxPerSec;
                const offsetSec = playheadSec - blockStartSec;
                const step = Math.floor((offsetSec / blockDurationSec) * totalSteps);
                foundBlock = block;
                foundStep = step;
                foundParams = { step, offsetSec, bpm, totalSteps, block };
            }
        });
        if (foundBlock) {
            if (instrumentBlockPlaybackState.block !== foundBlock || instrumentBlockPlaybackState.step !== foundStep) {
                if (window.studio && window.studio.instrument && typeof window.studio.instrument.playFromStep === 'function') {
                    window.studio.instrument.playFromStep(foundParams.step, foundParams.offsetSec, foundParams.bpm, foundParams.totalSteps, foundParams.block);
                }
                instrumentBlockPlaybackState = { block: foundBlock, step: foundStep };
            }
        } else {
            if (instrumentBlockPlaybackState.block) {
                if (window.studio && window.studio.instrument && typeof window.studio.instrument.stop === 'function') {
                    window.studio.instrument.stop();
                }
                instrumentBlockPlaybackState = { block: null, step: null };
            }
        }
    });

    // 监听 instrument-block 选中事件，打开钢琴窗并传递网格数
    window.addEventListener('segmentSelected', function(e) {
        const segment = e.detail.segment;
        if (segment && segment.el && segment.el.classList.contains('instrument-block')) {
            // 计算网格数：beats × 4
            const beats = segment.beats || (segment.duration && currentPxPerBeat ? segment.duration * pxPerSec / currentPxPerBeat : 4);
            const gridCols = Math.round(beats * 4);
            // 假设钢琴窗容器id为 piano-window-container
            if (window.studio && window.studio.instrument && typeof window.studio.instrument.createPianoWindow === 'function') {
                const container = document.getElementById('piano-window-container');
                if (container) {
                    window.studio.instrument.createPianoWindow(container, gridCols);
                }
            }
        }
    });

    return {
        refreshArrangement,
        startPlayhead,
        stopPlayhead,
        resetPlayhead,
        resizePlayhead,
        addWaveformBlock,
        setPosition,
        getCurrentTime,
        addTrackRow,
        moveTrack,
        setTrackMute,
        setTrackSolo,
        setTrackVolume,
        setTrackPan,
        armTrack,
        getTrackSettings,
        updateGainStates,
        updatePlayheadPosition,
        startPlayback,
        stopPlayback
};
})();

