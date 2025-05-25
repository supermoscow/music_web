import librosa
import numpy as np
from typing import Tuple
import tempfile
import os


class ChordAnalyzer:
    def __init__(self, sr=22050, hop_length=512):
        self.sr = sr
        self.hop_length = hop_length
        self.chord_labels = self._get_chord_labels()

    def _get_chord_labels(self):
        """生成和弦标签（参考你提供的代码）"""
        majors = [f'{note}' for note in ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']]
        minors = [f'{note}m' for note in ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']]
        return majors + minors

    def analyze(self, audio_path: str) -> Tuple[list, float]:
        """核心分析方法"""
        # 加载音频
        y, sr = librosa.load(audio_path, sr=self.sr)

        # 提取chroma特征（使用你的代码）
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=self.hop_length)

        # 和弦模板匹配（使用你提供的chord_recognition_template函数）
        chord_sim, chord_max = self._template_matching(chroma)

        # 生成时间轴
        times = librosa.times_like(chroma, sr=sr, hop_length=self.hop_length)
        duration = len(y) / sr

        return [{
            "time": float(t),
            "chord": self.chord_labels[np.argmax(chord_max[:, i])]
        } for i, t in enumerate(times)], duration

    def _template_matching(self, chroma: np.ndarray):
        """使用你提供的模板匹配逻辑"""
        # 此处调用你提供的generate_chord_templates和chord_recognition_template函数
        templates = self._generate_templates()
        chroma_norm = self._normalize(chroma)
        templates_norm = self._normalize(templates)
        sim_matrix = templates_norm.T @ chroma_norm
        chord_max = np.argmax(sim_matrix, axis=0)
        return sim_matrix, chord_max

    @staticmethod
    def _generate_templates():
        """生成和弦模板（使用你提供的代码）"""
        # 这里实现你的generate_chord_templates函数逻辑
        pass

    @staticmethod
    def _normalize(matrix: np.ndarray, norm_type='max'):
        """特征归一化"""
        return librosa.util.normalize(matrix, norm=norm_type, axis=0)