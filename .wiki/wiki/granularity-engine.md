# Granularity Engine (Inherited from session-3e15545d)

`GranularityFilter` (`src/client/core/GranularityFilter.ts`) prevents SA-1B-trained models like `FastSAM-s` from over-segmenting sub-parts (mouth, eyes, glasses inside faces; doors, handles, wheels inside cars) while giving the user real-time control over object coarseness.

## 1. Comprehensive Slider Mapping

A master granularity slider `g` in `[0, 100]` (`gNorm = g / 100`) continuously maps to three parameters:
- **Containment Threshold**: $\tau_{\text{nest}} = 0.60 + 0.36 \cdot g_{\text{norm}}$
- **Min Relative Area (%)**: $\text{minAreaPct} = 3.4 - 3.1 \cdot g_{\text{norm}}$
- **Confidence Threshold**: $\text{conf} = 0.55 - 0.35 \cdot g_{\text{norm}}$

### Standard Presets
| Preset | Master `g` | $\tau_{\text{nest}}$ | Min Area (%) | Confidence |
| :--- | :---: | :---: | :---: | :---: |
| **Coarse (偏粗)** | `12` | `0.65` | `2.6%` | `0.48` |
| **Balanced (均衡)** | `48` | `0.78` | `1.4%` | `0.38` |
| **Fine (偏细)** | `88` | `0.92` | `0.4%` | `0.22` |

## 2. Containment NMS Algorithm
1. Sort candidate boxes in **descending order of area**.
2. Discard any box with `score < conf` or `(area / imageArea) < minAreaRatio` (moved to `suppressed`).
3. For each remaining box $B$, compare against every already-kept larger box $A$:
   $$\text{Containment}(A, B) = \frac{\text{Area}(A \cap B)}{\text{Area}(B)}$$
   If $\text{Containment}(A, B) \ge \tau_{\text{nest}}$ and `B.score < 0.88`, suppress $B$ as a nested sub-part.
4. Output `{ kept, suppressed, durationMs }` for immediate canvas rendering.
