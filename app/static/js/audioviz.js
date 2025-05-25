// 整合wavesurfer.js用于波形可视化
import WaveSurfer from 'https://unpkg.com/wavesurfer.js@6.6.3/dist/wavesurfer.esm.js'

const wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: '#4a90e2',
    progressColor: '#0056b3',
    cursorColor: '#ff0000',
    height: 100,
    responsive: true,
})

// 和弦时间轴渲染逻辑
function renderChordTimeline(chords) {
    const canvas = document.getElementById('chordCanvas')
    const ctx = canvas.getContext('2d')

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 绘制和弦块
    chords.forEach((chord, index) => {
        const x = (index / chords.length) * canvas.width
        ctx.fillStyle = getChordColor(chord.chord)
        ctx.fillRect(x, 0, 20, 50)
        ctx.fillText(chord.chord, x+5, 30)
    })
}

function getChordColor(chord) {
    const colorMap = {
        'C': '#ff4757', 'Cm': '#ff6b81',
        'D': '#2ed573', 'Dm': '#7bed9f',
        // 补充其他和弦颜色...
    }
    return colorMap[chord] || '#a4b0be'
}