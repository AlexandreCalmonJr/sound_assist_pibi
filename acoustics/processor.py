import math
import time

class AcousticProcessor:
    @staticmethod
    def eyring_rt60(volume, surface_area, alpha):
        """Mais preciso que Sabine para alpha > 0.2 (salas tratadas ou muito absortivas)"""
        if alpha >= 1: alpha = 0.99
        return (-0.161 * volume) / (surface_area * math.log(1 - alpha))

    @staticmethod
    def classify_room(rt60):
        if rt60 < 0.3: return "Sala morta (excesso de absorção)"
        if 0.3 <= rt60 <= 0.8: return "Ideal para palavra/pregação"
        if 0.8 < rt60 <= 1.5: return "Aceitável para louvor congregacional"
        return "Problemático (baixa inteligibilidade, muito eco)"

    @staticmethod
    def diagnose_patterns(analyses_history):
        if not analyses_history:
            return []
            
        peak_frequencies = [a.get('peakHz', 0) for a in analyses_history if a.get('peakHz')]
        if not peak_frequencies:
             return []

        # Agrupar por baldes de 50Hz
        from collections import Counter
        freq_counter = Counter([round(f / 50) * 50 for f in peak_frequencies])
        most_common = freq_counter.most_common(3)
        
        patterns = []
        for freq_bucket, count in most_common:
            if count >= 3:
                patterns.append({
                    'hz': freq_bucket,
                    'confidence': round(count / len(peak_frequencies), 2),
                    'suggestion': f"Ressonância recorrente em {freq_bucket}Hz detectada."
                })
        return patterns
