// studio.dragdrop.js
// 录音轨支持拖拽外部音频文件生成波形块
(function() {
    // 轨道容器选择器，根据实际结构调整
    const trackList = document.querySelector('.studio-track-scroll .track-list');
    if (!trackList) return;

    // 新增：为所有arrangement-track-row绑定拖拽事件
    function bindDragDropToRow(row) {
        row.addEventListener('dragenter', function(e) {
            e.preventDefault();
            row.classList.add('dragover');
        });
        row.addEventListener('dragover', function(e) {
            e.preventDefault();
            row.classList.add('dragover');
        });
        row.addEventListener('dragleave', function(e) {
            row.classList.remove('dragover');
        });
        row.addEventListener('drop', function(e) {
            e.preventDefault();
            row.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (!files || files.length === 0) return;
            const file = Array.from(files).find(f => f.type.startsWith('audio/'));
            if (!file) return alert('请拖入音频文件');
            // 获取当前轨道索引
            const trackIdx = row.dataset.index ? parseInt(row.dataset.index, 10) : 0;
            const url = URL.createObjectURL(file);
            let offset = 0;
            // 触发自定义事件或调用已有导入逻辑（可根据实际情况调整）
            if (window.handleAudioFileDrop) {
                window.handleAudioFileDrop({ file, url, trackIdx, offset });
            } else {
                alert('音频文件已拖入轨道 ' + trackIdx + '，请实现 handleAudioFileDrop 处理逻辑');
            }
        });
    }
    // 绑定到所有arrangement-track-row
    document.querySelectorAll('.arrangement-track-row').forEach(bindDragDropToRow);

    // 新增 dragenter 事件，彻底阻止浏览器默认行为
    trackList.addEventListener('dragenter', function(e) {
        e.preventDefault();
        trackList.classList.add('dragover');
    });
    trackList.addEventListener('dragover', function(e) {
        e.preventDefault();
        trackList.classList.add('dragover');
    });
    trackList.addEventListener('dragleave', function(e) {
        trackList.classList.remove('dragover');
    });
    trackList.addEventListener('drop', function(e) {
        e.preventDefault();
        trackList.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;
        // 只处理第一个音频文件
        const file = Array.from(files).find(f => f.type.startsWith('audio/'));
        if (!file) return alert('请拖入音频文件');
        // 计算拖入位置对应的轨道索引
        const rect = trackList.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const trackItems = trackList.querySelectorAll('.track-item');
        let trackIdx = 0;
        let acc = 0;
        for (let i = 0; i < trackItems.length; i++) {
            acc += trackItems[i].offsetHeight;
            if (y < acc) { trackIdx = i; break; }
        }
        // 生成音频URL
        const url = URL.createObjectURL(file);
        // 计算当前时间轴位置（可选，默认0）
        let offset = 0;
        if (window.studio.arrangement && window.studio.arrangement.getCurrentTime) {
            offset = window.studio.arrangement.getCurrentTime();
        }
        // 添加波形块
        if (window.studio.arrangement && window.studio.arrangement.addWaveformBlock) {
            window.studio.arrangement.addWaveformBlock(trackIdx, url, file, offset);
        } else {
            alert('波形块添加功能未就绪');
        }
    });
})();

