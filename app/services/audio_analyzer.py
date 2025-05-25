import librosa
import numpy as np
from typing import Tuple, List, Dict
from scipy.ndimage import median_filter
from scipy.stats import pearsonr
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AudioAnalyzer:
    def __init__(self, sr=44100, hop_length=32768):
        self.sr = sr
        self.hop_length = hop_length
        self.chord_labels = self._generate_chord_labels()
        self.templates = self._generate_chord_templates()

        # 调式模板（原_load_key_profiles内容整合到此处）
        self.key_profiles = {
            'major': [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
            'minor': [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
        }

    def full_analysis(self, audio_path: str) -> Dict:
        """完整分析流程"""
        try:
            y, sr = librosa.load(audio_path, sr=self.sr)
            chroma = self._extract_chroma(y, sr)
            key = self._detect_key(chroma)
            chord_sequence = self._analyze_chords(chroma, sr)
            progression = self._find_progression_pattern(chord_sequence)

            return {
                "key": key,
                "chords": chord_sequence,
                "progression_pattern": progression
            }

        except Exception as e:
            logger.error(f"Analysis failed: {str(e)}")
            raise

    def _extract_chroma(self, y: np.ndarray, sr: int) -> np.ndarray:
        chroma = librosa.feature.chroma_cqt(
            y=y, sr=sr,
            hop_length=self.hop_length,
            bins_per_octave=36,
            n_octaves=6
        )
        return median_filter(chroma, size=(1, 5))

    def _detect_key(self, chroma: np.ndarray) -> str:
        chroma_profile = np.mean(chroma, axis=1)
        max_corr = -1
        best_key = "C major"

        for mode in ['major', 'minor']:
            for shift in range(12):
                shifted = np.roll(self.key_profiles[mode], shift)
                corr, _ = pearsonr(chroma_profile, shifted)
                if corr > max_corr:
                    max_corr = corr
                    root = librosa.midi_to_note(60 + shift)[:-1]
                    best_key = f"{root} {mode}"
        return best_key

    def _analyze_chords(self, chroma: np.ndarray, sr: int) -> List[Dict]:
        similarity = self.templates.T @ chroma
        chord_ids = np.argmax(similarity, axis=0)
        times = librosa.times_like(chroma, sr=sr, hop_length=self.hop_length)
        smoothed_ids = self._smooth_sequence(chord_ids)

        return [{
            "time": float(t),
            "chord": self.chord_labels[i],
            "confidence": float(similarity[i, idx])
        } for idx, (t, i) in enumerate(zip(times, smoothed_ids))]

    def _smooth_sequence(self, sequence: np.ndarray) -> np.ndarray:
        """基于音乐理论的和弦序列平滑"""
        # 常见和弦转移规则
        transition_rules = {
            # I → IV → V → I
            (0, 5): 0.9, (5, 7): 0.9, (7, 0): 0.9,
            # ii → V → I
            (2, 7): 0.8, (7, 0): 0.8,
            # 其他常见规则...
        }

        smoothed = [sequence[0]]
        for i in range(1, len(sequence)):
            prev = smoothed[-1]
            curr = sequence[i]

            # 检查转移概率
            if (prev, curr) in transition_rules:
                if np.random.rand() < transition_rules[(prev, curr)]:
                    smoothed.append(curr)
                else:
                    smoothed.append(prev)
            else:
                smoothed.append(curr)

        return np.array(smoothed)

    def _find_progression_pattern(self, chords: List[Dict]) -> str:
        """识别常见和弦进行模式"""
        sequence = [c['chord'] for c in chords]

        # 检测I-IV-V-I模式
        for i in range(len(sequence) - 3):
            if (sequence[i] == "C" and sequence[i + 1] == "F"
                    and sequence[i + 2] == "G" and sequence[i + 3] == "C"):
                return "C → F → G → C (I-IV-V-I)"

        # 其他模式检测...
        return "Common progression not detected"

    def _generate_chord_labels(self) -> List[str]:
        """生成和弦标签"""
        return [f"{note}{suffix}"
                for suffix in ['', 'm']
                for note in ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']]

    def _generate_chord_templates(self) -> np.ndarray:
        """生成和弦模板矩阵"""
        # 大三和弦模板
        maj = np.array([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0])
        # 小三和弦模板
        min = np.array([1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0])

        templates = np.zeros((12, 24))
        for i in range(12):
            templates[:, i] = np.roll(maj, i)
            templates[:, i + 12] = np.roll(min, i)

        # 归一化
        return templates / np.linalg.norm(templates, axis=0)