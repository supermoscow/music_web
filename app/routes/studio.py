from flask import Blueprint, render_template, current_app, jsonify
import os

studio_bp = Blueprint('studio', __name__, url_prefix='/studio')

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
