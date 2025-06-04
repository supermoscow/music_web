from flask import Blueprint, render_template, jsonify, request, current_app
from ..services.audio_analyzer import KeyAnalyzer
import tempfile
import os
from flask import send_file
from flask import send_file
bp = Blueprint('tool', __name__, url_prefix='/tool')


@bp.route('/')
def tool():
    return render_template('tool/tool.html')


@bp.route('/analyse')
def analyse():
    return render_template('tool/analyse.html')


@bp.route('/api/analyse', methods=['POST'])
def handle_key_analysis():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({"error": "Invalid file"}), 400

    if file.filename.split('.')[-1].lower() not in ['wav', 'mp3']:
        return jsonify({"error": "Only WAV/MP3 files allowed"}), 400

    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, file.filename)

    try:
        file.save(temp_path)
        analyzer = KeyAnalyzer()
        key = analyzer.analyze_key(temp_path)

        return jsonify({
            "status": "success",
            "key": key
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        os.rmdir(temp_dir)


@bp.route('/track_separate')
def track_separate():
    return render_template('tool/track_separate.html')

@bp.route('/api/track_separate', methods=['POST'])
def handle_track_separate():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({"error": "Invalid file"}), 400
    if file.filename.split('.')[-1].lower() not in ['wav', 'mp3']:
        return jsonify({"error": "Only WAV/MP3 files allowed"}), 400

    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, file.filename)
    try:
        file.save(temp_path)
        from app.services.audio_analyzer import TrackSeparator
        separator = TrackSeparator()
        stems = separator.separate(temp_path, temp_dir)
        # 返回各音轨的下载url
        return jsonify({
            "status": "success",
            "stems": {
                k: f"/tool/api/download_stem?dir={temp_dir}&stem={v}"
                for k, v in stems.items()
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@bp.route('/api/download_stem')
def download_stem():
    dir_ = request.args.get('dir')
    stem = request.args.get('stem')
    file_path = os.path.join(dir_, stem)
    if not os.path.exists(file_path):
        return "File not found", 404
    return send_file(file_path, as_attachment=True)

@bp.route('/inspiration', methods=['GET'])
def inspiration():
    return render_template('tool/inspiration.html')

@bp.route('/api/drum_styles')
def api_drum_styles():
    drum_root = os.path.join(current_app.root_path, 'static', 'audio', 'drum')
    print('[调试] drum_root 路径:', drum_root)
    if not os.path.isdir(drum_root):
        print('[调试] drum_root 目录不存在')
        return jsonify([])
    styles = [d for d in os.listdir(drum_root) if os.path.isdir(os.path.join(drum_root, d))]
    print('[调试] drum_styles:', styles)
    return jsonify(styles)

@bp.route('/api/drum_sounds')
def api_drum_sounds():
    style = request.args.get('style', '')
    drum_root = os.path.join(current_app.root_path, 'static', 'audio', 'drum')
    style_dir = os.path.join(drum_root, style)
    print('[调试] drum_sounds style_dir 路径:', style_dir)
    if not os.path.isdir(style_dir):
        print('[调试] style_dir 目录不存在')
        return jsonify([])
    files = [f for f in os.listdir(style_dir) if f.lower().endswith('.wav') and os.path.isfile(os.path.join(style_dir, f))]
    print('[调试] drum_sounds:', files)
    return jsonify(files)