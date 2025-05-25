from flask import Blueprint, render_template, jsonify, request
from app.services.chord_analysis import ChordAnalyzer
import tempfile
import os
bp = Blueprint('tool', __name__, url_prefix='/tool')

@bp.route('/')
def tool():
    return render_template('tool/tool.html')

@bp.route('/analyse')
def analyse():
    return render_template('tool/analyse.html')


@bp.route('/api/analyze', methods=['POST'])
def analyze_audio():
    """音频分析API"""
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Empty filename"}), 400

    # 创建临时文件
    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, file.filename)
    file.save(temp_path)

    try:
        analyzer = ChordAnalyzer()
        chords, duration = analyzer.analyze(temp_path)
        return jsonify({
            "status": "success",
            "chords": chords,
            "duration": duration
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        os.rmdir(temp_dir)
