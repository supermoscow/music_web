// studio.bottom.js
// 底部面板切换与内容管理
window.studio = window.studio || {};
window.studio.bottom = (function() {
    function init() {
        const bottomTabs = document.querySelectorAll('.bottom-tab');
        const bottomContent = document.getElementById('studio-bottom-content');
        const tabContents = {
            inspector: '<div>Track Inspector 面板</div>',
            keyboard: '<div>Virtual Keyboard 面板</div>',
            editor: '<div>钢琴窗/鼓机编辑面板</div>',
            mixer: '<div>Mixer 面板</div>'
        };
        bottomTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                bottomTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const tabType = tab.getAttribute('data-tab');
                bottomContent.innerHTML = tabContents[tabType] || '';
            });
        });
        // 默认选中第一个tab
        if(bottomTabs.length) bottomTabs[0].click();
        // 右下角“＋”按钮
        const addBottomPanelBtn = document.getElementById('add-bottom-panel-btn');
        addBottomPanelBtn.addEventListener('click', function() {
            alert('后续可添加更多底部面板功能');
        });
    }
    return { init };
})();

