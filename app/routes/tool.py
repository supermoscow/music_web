from flask import Blueprint, render_template, jsonify, request
from app.services.audio_analyzer import KeyAnalyzer
import tempfile
import os
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