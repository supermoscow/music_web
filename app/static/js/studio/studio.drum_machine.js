// studio.drum_machine.js
// 重写鼓机逻辑

function renderDrumMachineEditor(currentSegment) {
    const bottomContent = document.getElementById('studio-bottom-content');
    const bottomInfo = document.querySelector('.studio-bottom-info');
    const meter = document.getElementById('studio-meter-select').value;
    const beatsPerBar = parseInt(meter.split('/')[0]);
    if(currentSegment) {
        // 计算格子尺寸和总宽度
        const cellSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--drum-cell-size')) || 32;
        const subdivisions = 4; // 每拍4格
        const beatExact = currentSegment.segment.beats;
        const subdivisionsCount = beatExact * subdivisions;
        const cellWidth = cellSize;
        const totalPx = cellSize * subdivisionsCount;
        bottomContent.innerHTML = `
          <div id="drum-editor">
            <div class="drum-editor-header">
              <div class="drum-header-label-space"></div>
              <div class="drum-header-ticks"></div>
            </div>
            <div class="drum-editor-body"><div class="drum-grid"></div></div>
          </div>`;
        const header = bottomContent.querySelector('.drum-editor-header');
        const ticksContainer = header.querySelector('.drum-header-ticks');
        const labelSpace = header.querySelector('.drum-header-label-space');
        const grid = bottomContent.querySelector('.drum-grid');
        const labelWidth = 60;
        grid.style.width = totalPx + 'px';
        labelSpace.style.width = labelWidth + 'px';
        ticksContainer.style.width = totalPx + 'px';
        // 同步滚动
        const body = bottomContent.querySelector('.drum-editor-body');
        body.addEventListener('scroll', () => { ticksContainer.scrollLeft = body.scrollLeft; });
        // 生成header
        ticksContainer.innerHTML = '';
        for (let i = 0; i < subdivisionsCount; i++) {
            const cell = document.createElement('div');
            cell.className = 'drum-header-cell';
            cell.style.width = cellWidth + 'px';
            cell.textContent = i + 1;
            ticksContainer.appendChild(cell);
        }
        // 生成鼓机行
        const sounds = [
            {name: 'Kick', file: '/static/audio/drum/boombap/kick.wav'},
            {name: 'Snare', file: '/static/audio/drum/boombap/snare.wav'},
            {name: 'Hi-hat', file: '/static/audio/drum/boombap/hihat.wav'}
        ];
        sounds.forEach(sound => {
            const rowEl = document.createElement('div');
            rowEl.className = 'drum-row';
            const label = document.createElement('div');
            label.className = 'drum-sound-label';
            label.textContent = sound.name;
            rowEl.appendChild(label);
            const rowGrid = document.createElement('div');
            rowGrid.className = 'drum-row-grid';
            rowGrid.style.width = totalPx + 'px';
            for(let b=0; b<subdivisionsCount; b++) {
                const cell = document.createElement('div');
                cell.className = 'drum-cell';
                cell.style.width = cellWidth + 'px';
                cell.dataset.file = sound.file;
                cell.addEventListener('click', () => {
                    cell.classList.toggle('active');
                    const audio = new Audio(sound.file);
                    audio.play();
                });
                rowGrid.appendChild(cell);
            }
            rowEl.appendChild(rowGrid);
            grid.appendChild(rowEl);
        });
        if(bottomInfo) bottomInfo.textContent = '';
    } else {
        bottomContent.innerHTML = '<div class="no-selection">请选择鼓机块</div>';
        if(bottomInfo) bottomInfo.textContent = '';
    }
}

window.renderDrumMachineEditor = renderDrumMachineEditor;

