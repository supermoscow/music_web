import librosa
import numpy as np

import os
import subprocess

class KeyAnalyzer:
    def __init__(self, sr=22050):
        self.sr = sr
        self.key_profiles = {
            'major': [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
            'minor': [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
        }

    def analyze_key(self, audio_path: str) -> str:
        """核心调式分析方法"""
        try:
            y, sr = librosa.load(audio_path, sr=self.sr)
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
            return self._detect_key(chroma)
        except Exception as e:
            return f"Error: {str(e)}"

    def _detect_key(self, chroma: np.ndarray) -> str:
        """使用Krumhansl-Schmuckler算法检测调式"""
        chroma_profile = np.mean(chroma, axis=1)
        max_corr = -1
        best_key = "C major"

        for mode in ['major', 'minor']:
            for shift in range(12):
                shifted = np.roll(self.key_profiles[mode], shift)
                corr = np.corrcoef(chroma_profile, shifted)[0, 1]
                if corr > max_corr:
                    max_corr = corr
                    root = librosa.midi_to_note(60 + shift)[:-1]
                    best_key = f"{root} {mode}"
        return best_key



class TrackSeparator:
    def __init__(self, model='htdemucs'):
        self.model = model

    def separate(self, audio_path, output_dir):
        # 使用 htdemucs 进行音轨分离
        cmd = [
            'demucs',
            '-n', self.model,
            '-o', output_dir,
            audio_path
        ]
        subprocess.run(cmd, check=True)
        base = os.path.splitext(os.path.basename(audio_path))[0]
        stem_dir = os.path.join(output_dir, self.model, base)
        stems = {
            "vocals": os.path.join(stem_dir, "vocals.wav"),
            "drums": os.path.join(stem_dir, "drums.wav"),
            "bass": os.path.join(stem_dir, "bass.wav"),
            "other": os.path.join(stem_dir, "other.wav")
        }
        return stems
