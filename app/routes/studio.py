from flask import Blueprint, render_template, current_app, jsonify, request
import os
import json

studio_bp = Blueprint('studio', __name__, url_prefix='/studio')

def get_project_dir():
    return os.path.join(current_app.static_folder, 'projects')

def ensure_project_dir():
    project_dir = get_project_dir()
    if not os.path.exists(project_dir):
        os.makedirs(project_dir)

@studio_bp.route('/')
def studio():
    return render_template('studio/studio.html')

@studio_bp.route('/drum-sounds')
def drum_sounds():
    # List drum presets from static/audio/drum
    drum_dir = os.path.join(current_app.static_folder, 'audio', 'drum')
    presets = {}
    if os.path.isdir(drum_dir):
        for name in os.listdir(drum_dir):
            path = os.path.join(drum_dir, name)
            if os.path.isdir(path):
                presets[name] = []
                for f in os.listdir(path):
                    if f.lower().endswith(('.wav','.mp3','.ogg')):
                        sound_name = os.path.splitext(f)[0]
                        file_path = f"/static/audio/drum/{name}/{f}"
                        presets[name].append({'name': sound_name, 'file': file_path})
    # Group soundbank by folders
    soundbank = {}
    sb_dir = os.path.join(current_app.static_folder, 'audio', 'soundbank')
    if os.path.isdir(sb_dir):
        for name in os.listdir(sb_dir):
            path = os.path.join(sb_dir, name)
            if os.path.isdir(path):
                items = []
                for f in os.listdir(path):
                    if f.lower().endswith(('.wav', '.mp3', '.ogg')):
                        sound_name = os.path.splitext(f)[0]
                        file_path = f"/static/audio/soundbank/{name}/{f}"
                        items.append({'name': sound_name, 'file': file_path})
                if items:
                    soundbank[name] = items
    return jsonify(presets=presets, soundbank=soundbank)

@studio_bp.route('/instrument-sounds')
def instrument_sounds():
    # 调试：打印 soundbank 目录内容
    sb_dir = os.path.join(current_app.static_folder, 'audio', 'soundbank')
    print('DEBUG: soundbank dir:', sb_dir)
    print('DEBUG: soundbank dir list:', os.listdir(sb_dir))
    soundbank = {}
    if os.path.isdir(sb_dir):
        for name in os.listdir(sb_dir):
            path = os.path.join(sb_dir, name)
            print('DEBUG: checking', name, 'isdir:', os.path.isdir(path))
            if os.path.isdir(path):
                items = []
                print('DEBUG: folder', name, 'files:', os.listdir(path))
                for f in os.listdir(path):
                    if f.lower().endswith(('.wav', '.mp3', '.ogg')):
                        sound_name = os.path.splitext(f)[0]
                        file_path = f"/static/audio/soundbank/{name}/{f}"
                        items.append({'name': sound_name, 'file': file_path})
                if items:
                    soundbank[name] = items
            else:
                if name.lower().endswith(('.wav', '.mp3', '.ogg')):
                    sound_name = os.path.splitext(name)[0]
                    file_path = f"/static/audio/soundbank/{name}"
                    if 'Root' not in soundbank:
                        soundbank['Root'] = []
                    soundbank['Root'].append({'name': sound_name, 'file': file_path})
    print('DEBUG: final soundbank:', soundbank)
    return jsonify(soundbank=soundbank)

@studio_bp.route('/save_project', methods=['POST'])
def save_project():
    ensure_project_dir()
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'error': '工程名不能为空'}), 400
    # 文件名安全处理
    safe_name = ''.join(c for c in name if c.isalnum() or c in ('_', '-'))
    # 保存路径
    path = os.path.join(get_project_dir(), f'{safe_name}.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return jsonify({'success': True})

# 列出所有工程名称
@studio_bp.route('/list_projects')
def list_projects():
    ensure_project_dir()
    files = [f[:-5] for f in os.listdir(get_project_dir()) if f.endswith('.json')]
    return jsonify(files)

# 加载指定工程
@studio_bp.route('/load_project')
def load_project():
    ensure_project_dir()
    name = request.args.get('name')
    if not name:
        return jsonify({'error': '缺少工程名'}), 400
    safe_name = ''.join(c for c in name if c.isalnum() or c in ('_', '-'))
    path = os.path.join(get_project_dir(), f'{safe_name}.json')
    if not os.path.exists(path):
        return jsonify({'error': '工程不存在'}), 404
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return jsonify(data)
