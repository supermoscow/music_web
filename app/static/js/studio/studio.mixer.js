// studio.mixer.js
// Mixer面板逻辑，支持音量、静音、独奏、声像调节

class MixerTrack {
    constructor(id, name, onChange) {
        this.id = id;
        this.name = name;
        this.volume = 1.0;
        this.muted = false;
        this.solo = false;
        this.pan = 0; // -1:左, 0:中, 1:右
        this.onChange = onChange;
        // Web Audio 节点链
        this.audioCtx = window._studioAudioCtx = window._studioAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
        this.inputNode = this.audioCtx.createGain();
        this.gainNode = this.audioCtx.createGain();
        this.reverbNode = this.audioCtx.createConvolver();
        this.reverbGain = this.audioCtx.createGain();
        this.delayNode = this.audioCtx.createDelay();
        this.delayGain = this.audioCtx.createGain();
        this.outputNode = this.audioCtx.createGain();
        // 默认连接链: input -> gain -> reverb -> delay -> output
        this.inputNode.connect(this.gainNode);
        this.gainNode.connect(this.reverbNode);
        this.reverbNode.connect(this.reverbGain);
        this.reverbGain.connect(this.delayNode);
        this.delayNode.connect(this.delayGain);
        this.delayGain.connect(this.outputNode);
        // 默认参数
        this.gainNode.gain.value = 1;
        this.reverbGain.gain.value = 0;
        this.delayNode.delayTime.value = 0;
        this.delayGain.gain.value = 0;
        // 可选: outputNode.connect(audioCtx.destination); // 由主控统一连接
    }

    setVolume(val) {
        this.volume = val;
        this.gainNode.gain.value = val;
        this.onChange && this.onChange(this);
    }
    setMute(val) {
        this.muted = val;
        this.onChange && this.onChange(this);
    }
    setSolo(val) {
        this.solo = val;
        this.onChange && this.onChange(this);
    }
    setPan(val) {
        this.pan = val;
        this.onChange && this.onChange(this);
    }

    setPluginParam(type, value) {
        if(type === 'volume') {
            this.gainNode.gain.value = value;
        }
        if(type === 'reverb') {
            this.reverbGain.gain.value = value;
        }
        if(type === 'delay') {
            this.delayGain.gain.value = value;
            this.delayNode.delayTime.value = value * 0.5; // 0~0.5秒
        }
    }

    // 提供连接音频源和主输出的方法
    connectSource(audioSourceNode) {
        // audioSourceNode: AudioBufferSourceNode 或 MediaElementAudioSourceNode
        audioSourceNode.connect(this.inputNode);
    }
    connectToMaster(masterNode) {
        // masterNode: AudioContext.destination 或主输出GainNode
        this.outputNode.connect(masterNode);
    }
}

class MixerPanel {
    constructor(container, tracks) {
        this.container = container;
        this.tracks = tracks.map(t => new MixerTrack(t.id, t.name, this.handleChange.bind(this)));
        this.render();
    }

    handleChange(track) {
        // 这里可以触发全局事件或回调，通知音频引擎
        // 如 window.dispatchEvent(new CustomEvent('mixerChange', {detail: track}))
    }

    render() {
        // 横向布局容器
        this.container.innerHTML = '';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'row';
        this.container.style.gap = '16px';
        this.container.style.padding = '16px 0';
        this.container.style.overflowX = 'auto';

        // 添加总音轨（Master）
        const masterTrack = new MixerTrack('master', '总音轨', this.handleChange.bind(this));
        // 默认连接到 audioCtx.destination
        masterTrack.connectToMaster(masterTrack.audioCtx.destination);
        // 渲染总音轨UI
        const masterDiv = document.createElement('div');
        masterDiv.className = 'mixer-track master-track';
        masterDiv.style.display = 'flex';
        masterDiv.style.flexDirection = 'column';
        masterDiv.style.alignItems = 'center';
        masterDiv.style.background = '#1a1d20';
        masterDiv.style.borderRadius = '8px';
        masterDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
        masterDiv.style.padding = '16px 12px 12px 12px';
        masterDiv.style.minWidth = '120px';
        masterDiv.style.maxWidth = '140px';
        masterDiv.style.border = '2px solid #f1c40f';
        masterDiv.style.marginBottom = '8px';
        masterDiv.innerHTML = `
            <div class="mixer-track-name" style="font-weight:bold;font-size:15px;margin-bottom:12px;color:#ffe066;">总音轨 (Master)</div>
            <input type="range" min="0" max="2" step="0.01" value="1" class="mixer-master-volume" style="width:80px;">
            <div style="font-size:12px;color:#ffe066;margin:4px 0 8px 0;">主音量</div>
        `;
        // 主音量事件
        masterDiv.querySelector('.mixer-master-volume').addEventListener('input', e => {
            masterTrack.gainNode.gain.value = parseFloat(e.target.value);
        });
        this.container.appendChild(masterDiv);
        // connect each track output to master input for volume control
        this.tracks.forEach(track => track.connectToMaster(masterTrack.inputNode));

        this.tracks.forEach(track => {
            const trackDiv = document.createElement('div');
            trackDiv.className = 'mixer-track';
            // 美化样式
            trackDiv.style.display = 'flex';
            trackDiv.style.flexDirection = 'column';
            trackDiv.style.alignItems = 'center';
            trackDiv.style.background = '#23272a';
            trackDiv.style.borderRadius = '8px';
            trackDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
            trackDiv.style.padding = '16px 12px 12px 12px';
            trackDiv.style.minWidth = '120px';
            trackDiv.style.maxWidth = '140px';
            trackDiv.style.border = '1px solid #333';
            trackDiv.style.transition = 'box-shadow 0.2s';
            trackDiv.style.marginBottom = '8px';
            // 80%为1，80-100%为增益区间
            const volumeValue = track.volume;
            let displayVolume = volumeValue;
            let gainLabel = '';
            if (volumeValue > 0.8) {
                displayVolume = 0.8 + (volumeValue - 0.8) * 2;
                gainLabel = `<span style='color:#f1c40f;font-size:12px;'>(+增益)</span>`;
            }
            trackDiv.innerHTML = `
                <div class="mixer-track-name" style="font-weight:bold;font-size:15px;margin-bottom:12px;color:#fff;">${track.name}</div>
                <input type="range" min="0" max="1" step="0.01" value="${track.volume}" class="mixer-volume" style="width:80px;">
                <div style="font-size:12px;color:#aaa;margin:4px 0 8px 0;">音量 ${gainLabel}</div>
                <button class="mixer-mute" style="margin:2px 0 2px 0;padding:2px 10px;border-radius:4px;background:${track.muted ? '#e74c3c':'#444'};color:#fff;border:none;">${track.muted ? 'Unmute' : 'Mute'}</button>
                <button class="mixer-solo" style="margin:2px 0 8px 0;padding:2px 10px;border-radius:4px;background:${track.solo ? '#f1c40f':'#444'};color:#fff;border:none;">${track.solo ? 'Unsolo' : 'Solo'}</button>
                <input type="range" min="-1" max="1" step="0.01" value="${track.pan}" class="mixer-pan" style="width:80px;">
                <div style="font-size:12px;color:#aaa;margin-top:4px;">声像</div>
            `;
            // 事件绑定
            const volumeSlider = trackDiv.querySelector('.mixer-volume');
            volumeSlider.value = 0.8;
            volumeSlider.addEventListener('input', e => {
                let v = parseFloat(e.target.value);
                // 80%为1，80-100%为增益区间
                if (v > 0.8) {
                    track.setVolume(0.8 + (v - 0.8) * 2);
                } else {
                    track.setVolume(v);
                }
            });
            trackDiv.querySelector('.mixer-mute').addEventListener('click', () => {
                track.setMute(!track.muted);
                this.render();
            });
            trackDiv.querySelector('.mixer-solo').addEventListener('click', () => {
                track.setSolo(!track.solo);
                this.render();
            });
            trackDiv.querySelector('.mixer-pan').addEventListener('input', e => {
                track.setPan(parseFloat(e.target.value));
            });

            // 插件插槽区域
            const pluginSlot = document.createElement('div');
            pluginSlot.className = 'mixer-plugin-slot';
            pluginSlot.style.marginTop = '12px';
            pluginSlot.style.width = '100%';
            pluginSlot.style.display = 'flex';
            pluginSlot.style.flexDirection = 'column';
            pluginSlot.style.alignItems = 'center';
            pluginSlot.style.gap = '6px';
            // 插件选择下拉框
            const pluginSelect = document.createElement('select');
            pluginSelect.innerHTML = `
                <option value="">＋ 添加插件</option>
                <option value="volume">音量均衡</option>
                <option value="reverb">混响</option>
                <option value="delay">延迟</option>
            `;
            pluginSelect.style.width = '100%';
            pluginSelect.style.marginBottom = '4px';
            pluginSlot.appendChild(pluginSelect);
            // 插件容器
            const pluginContainer = document.createElement('div');
            pluginContainer.className = 'plugin-container';
            pluginContainer.style.width = '100%';
            pluginSlot.appendChild(pluginContainer);
            // 插件数据存储
            track.plugins = [];
            // 插件渲染函数
            function renderPlugins() {
                pluginContainer.innerHTML = '';
                track.plugins.forEach((plugin, idx) => {
                    let pluginDiv = document.createElement('div');
                    pluginDiv.className = 'plugin-item';
                    pluginDiv.style.background = '#292d31';
                    pluginDiv.style.borderRadius = '4px';
                    pluginDiv.style.padding = '6px 8px';
                    pluginDiv.style.marginBottom = '4px';
                    pluginDiv.style.display = 'flex';
                    pluginDiv.style.flexDirection = 'column';
                    pluginDiv.style.alignItems = 'flex-start';
                    pluginDiv.style.position = 'relative';
                    // 插件标题
                    let title = '';
                    if(plugin.type === 'volume') title = '音量均衡';
                    if(plugin.type === 'reverb') title = '混响';
                    if(plugin.type === 'delay') title = '延迟';
                    pluginDiv.innerHTML = `<div style='font-weight:bold;color:#fff;font-size:13px;margin-bottom:4px;'>${title}</div>`;
                    // 插件参数UI
                    if(plugin.type === 'volume') {
                        const slider = document.createElement('input');
                        slider.type = 'range';
                        slider.min = '0';
                        slider.max = '2';
                        slider.step = '0.01';
                        slider.value = plugin.value;
                        slider.style.width = '80px';
                        slider.addEventListener('input', e => {
                            plugin.value = parseFloat(e.target.value);
                            track.setPluginParam('volume', plugin.value);
                        });
                        pluginDiv.appendChild(slider);
                        const label = document.createElement('span');
                        label.textContent = '增益: ';
                        label.style.color = '#aaa';
                        label.style.fontSize = '12px';
                        pluginDiv.appendChild(label);
                    }
                    if(plugin.type === 'reverb') {
                        const slider = document.createElement('input');
                        slider.type = 'range';
                        slider.min = '0';
                        slider.max = '1';
                        slider.step = '0.01';
                        slider.value = plugin.value;
                        slider.style.width = '80px';
                        slider.addEventListener('input', e => {
                            plugin.value = parseFloat(e.target.value);
                            track.setPluginParam('reverb', plugin.value);
                        });
                        pluginDiv.appendChild(slider);
                        const label = document.createElement('span');
                        label.textContent = '混响量';
                        label.style.color = '#aaa';
                        label.style.fontSize = '12px';
                        pluginDiv.appendChild(label);
                    }
                    if(plugin.type === 'delay') {
                        const slider = document.createElement('input');
                        slider.type = 'range';
                        slider.min = '0';
                        slider.max = '1';
                        slider.step = '0.01';
                        slider.value = plugin.value;
                        slider.style.width = '80px';
                        slider.addEventListener('input', e => {
                            plugin.value = parseFloat(e.target.value);
                            track.setPluginParam('delay', plugin.value);
                        });
                        pluginDiv.appendChild(slider);
                        const label = document.createElement('span');
                        label.textContent = '延迟量';
                        label.style.color = '#aaa';
                        label.style.fontSize = '12px';
                        pluginDiv.appendChild(label);
                    }
                    // 删除按钮
                    const delBtn = document.createElement('button');
                    delBtn.textContent = '✖';
                    delBtn.style.position = 'absolute';
                    delBtn.style.right = '4px';
                    delBtn.style.top = '4px';
                    delBtn.style.background = 'none';
                    delBtn.style.border = 'none';
                    delBtn.style.color = '#aaa';
                    delBtn.style.cursor = 'pointer';
                    delBtn.addEventListener('click', () => {
                        track.plugins.splice(idx, 1);
                        renderPlugins();
                    });
                    pluginDiv.appendChild(delBtn);
                    pluginContainer.appendChild(pluginDiv);
                });
            }
            pluginSelect.addEventListener('change', function() {
                if(this.value) {
                    // 防止重复添加同类插件
                    if(!track.plugins.find(p=>p.type===this.value)) {
                        let plugin = { type: this.value, value: this.value==='volume'?1:0 };
                        track.plugins.push(plugin);
                        renderPlugins();
                    }
                    this.value = '';
                }
            });
            renderPlugins();
            trackDiv.appendChild(pluginSlot);

            this.container.appendChild(trackDiv);
        });
    }
}

// 用法示例：
// const mixer = new MixerPanel(document.getElementById('mixer-panel'), [
//   {id: 'track1', name: '鼓组'},
//   {id: 'track2', name: '贝斯'},
//   {id: 'track3', name: '钢琴'}
// ]);

window.MixerPanel = MixerPanel;

