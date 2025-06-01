// static/js/tool/track_separate.js
window.addEventListener('DOMContentLoaded', function() {
    document.getElementById('fileButton').addEventListener('click', function() {
        document.getElementById('audioFile').click();
    });
    document.getElementById('separateBtn').addEventListener('click', separate);
});

function updateFileName(input) {
    const fileNameSpan = document.getElementById('fileName');
    if (input.files && input.files[0]) {
        fileNameSpan.textContent = input.files[0].name;
    } else {
        fileNameSpan.textContent = '未选择文件';
    }
}

function separate() {
    const fileInput = document.getElementById('audioFile');
    const loadingArea = document.getElementById('loadingArea');
    const resultArea = document.getElementById('resultArea');
    const resultDiv = document.getElementById('result');

    if (!fileInput.files[0]) {
        alert('请先选择音频文件');
        return;
    }
    loadingArea.style.display = 'block';
    resultArea.style.display = 'none';

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    fetch('/tool/api/track_separate', {
        method: 'POST',
        body: formData
    })
    .then(r => r.json())
    .then(data => {
        loadingArea.style.display = 'none';
        if (data.error) {
            alert('错误：' + data.error);
            return;
        }
        let html = '';
        for (const [name, url] of Object.entries(data.stems)) {
            html += `
                <div class="audio-card bg-white rounded-lg shadow p-4">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-lg font-semibold text-gray-800">
                            <i class="fas fa-volume-up text-blue-500 mr-2"></i>${name}
                        </h3>
                        <span class="bg-blue-100 text-blue-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded">
                            可下载
                        </span>
                    </div>
                    <audio controls class="w-full mb-3" src="${url}"></audio>
                    <a href="${url}" download class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                        <i class="fas fa-download mr-2"></i>下载音轨
                    </a>
                </div>
            `;
        }
        resultDiv.innerHTML = html;
        resultArea.style.display = 'block';
    })
    .catch(e => {
        loadingArea.style.display = 'none';
        alert('分离失败：' + e);
    });
}