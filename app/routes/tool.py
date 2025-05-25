from flask import Blueprint, render_template, jsonify, request
from app.services.audio_analyzer import AudioAnalyzer
import tempfile
import os

bp = Blueprint('tool', __name__, url_prefix='/tool')

@bp.route('/')
def tool():
    return render_template('tool/tool.html')


@bp.route('/analyse')
def analyse():
    return render_template('tool/analyse.html')


@bp.route('/api/analyse', methods=['POST'])
def analyse_audio():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    if file.filename.split('.')[-1].lower() not in ['wav', 'mp3']:
        return jsonify({"error": "Unsupported file type"}), 400

    try:
        # 保存临时文件
        temp_dir = tempfile.mkdtemp()
        temp_path = os.path.join(temp_dir, file.filename)
        file.save(temp_path)

        # 执行分析
        analyzer = AudioAnalyzer()
        result = analyzer.full_analysis(temp_path)

        return jsonify({
            "status": "success",
            "key": result["key"],
            "chords": result["chords"],
            "progression": result["progression_pattern"]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        os.rmdir(temp_dir)