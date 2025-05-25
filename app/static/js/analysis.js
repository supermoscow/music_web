document.getElementById('audioFile').addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
        analyzeAudio(e.target.files[0]);
    }
});

async function analyzeAudio(file) {
    const formData = new FormData();
    formData.append('file', file);

    showLoading(true);

    try {
        const response = await fetch('/tool/api/analyse', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // 更新结果
        document.getElementById('keyResult').textContent = data.key;
        document.getElementById('progressionResult').textContent = data.progression;

        // 渲染时间轴
        renderTimeline(data.chords);

        // 填充表格
        updateTable(data.chords);

    } catch (error) {
        alert('分析失败: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function renderTimeline(chords) {
    const options = {
        chart: { type: 'line', height: 200 },
        series: [{
            name: '和弦',
            data: chords.map(c => ({
                x: c.time.toFixed(2),
                y: c.confidence,
                chord: c.chord
            }))
        }],
        xaxis: { type: 'numeric' },
        tooltip: {
            custom: function({ seriesIndex, dataPointIndex, w }) {
                const data = w.globals.series[seriesIndex][dataPointIndex]
                return `<div class="chart-tooltip">
                    <div>时间: ${data.x}s</div>
                    <div>和弦: ${data.chord}</div>
                    <div>置信度: ${data.y.toFixed(2)}</div>
                </div>`
            }
        }
    };

    const chart = new ApexCharts(
        document.querySelector('#timelineChart'),
        options
    );
    chart.render();
}

function updateTable(chords) {
    const tbody = document.getElementById('chordTableBody');
    tbody.innerHTML = chords.map(c => `
        <tr>
            <td>${c.time.toFixed(2)}s</td>
            <td>${c.chord}</td>
            <td>${(c.confidence * 100).toFixed(1)}%</td>
        </tr>
    `).join('');
}

function showLoading(show) {
    document.querySelector('.progress-bar').style.display =
        show ? 'block' : 'none';
}