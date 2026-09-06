package app.clippster.editor.engine

import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.pow

/** SDR color-matrix filters shared by preview TextureView and overlay bitmaps. */
internal object EffectColorMatrices {
  fun colorFilter(effects: JSONArray?): ColorMatrixColorFilter? {
    val matrix = combinedMatrix(effects) ?: return null
    return ColorMatrixColorFilter(matrix)
  }

  fun combinedMatrix(effects: JSONArray?): ColorMatrix? {
    if (effects == null || effects.length() == 0) return null
    var result: ColorMatrix? = null
    for (index in 0 until effects.length()) {
      val effect = effects.optJSONObject(index) ?: continue
      val next = matrixFor(effect) ?: continue
      result = (result ?: ColorMatrix()).also { it.postConcat(next) }
    }
    return result
  }

  private fun matrixFor(effect: JSONObject): ColorMatrix? {
    val type = effect.optString("type")
      .lowercase()
      .replace('-', '_')
      .removePrefix("adjust_")
    val rawIntensity = effect.optDouble("intensity", 100.0).toFloat().coerceIn(0f, 100f)
    val amount = rawIntensity / 100f
    val bipolar = ((rawIntensity - 50f) / 50f).coerceIn(-1f, 1f)
    val identity = ColorMatrix()
    val target = when (type) {
      "grayscale" -> ColorMatrix().apply { setSaturation(0f) }
      "sepia" -> ColorMatrix(
        floatArrayOf(
          0.393f, 0.769f, 0.189f, 0f, 0f,
          0.349f, 0.686f, 0.168f, 0f, 0f,
          0.272f, 0.534f, 0.131f, 0f, 0f,
          0f, 0f, 0f, 1f, 0f,
        ),
      )
      "negative" -> ColorMatrix(
        floatArrayOf(
          -1f, 0f, 0f, 0f, 255f,
          0f, -1f, 0f, 0f, 255f,
          0f, 0f, -1f, 0f, 255f,
          0f, 0f, 0f, 1f, 0f,
        ),
      )
      "warm" -> ColorMatrix(
        floatArrayOf(
          1.1f, 0f, 0f, 0f, 10f,
          0f, 1f, 0f, 0f, 0f,
          0f, 0f, 0.9f, 0f, -10f,
          0f, 0f, 0f, 1f, 0f,
        ),
      )
      "cool" -> ColorMatrix(
        floatArrayOf(
          0.9f, 0f, 0f, 0f, -10f,
          0f, 1f, 0f, 0f, 0f,
          0f, 0f, 1.1f, 0f, 10f,
          0f, 0f, 0f, 1f, 0f,
        ),
      )
      "sharpen" -> ColorMatrix(
        floatArrayOf(
          1.18f, -0.06f, -0.06f, 0f, 0f,
          -0.06f, 1.18f, -0.06f, 0f, 0f,
          -0.06f, -0.06f, 1.18f, 0f, 0f,
          0f, 0f, 0f, 1f, 0f,
        ),
      )
      "brightness" -> scaleAndOffset(1f, 1f, 1f, bipolar * 40f)
      "exposure" -> {
        val scale = 2f.pow(bipolar * 0.5f)
        scaleAndOffset(scale, scale, scale)
      }
      "contrast" -> {
        val scale = 1f + bipolar * 0.5f
        scaleAndOffset(scale, scale, scale, 128f * (1f - scale))
      }
      "saturation" -> ColorMatrix().apply { setSaturation(1f + bipolar) }
      "temperature" -> scaleAndOffset(
        1f + bipolar * 0.16f,
        1f,
        1f - bipolar * 0.16f,
      )
      "tint" -> scaleAndOffset(
        1f + bipolar * 0.08f,
        1f - bipolar * 0.08f,
        1f + bipolar * 0.08f,
      )
      else -> return null
    }
    if (type in BIPOLAR_TYPES) return target.takeUnless { bipolar == 0f }
    return if (amount <= 0f) null else lerp(identity, target, amount)
  }

  private fun scaleAndOffset(
    red: Float,
    green: Float,
    blue: Float,
    offset: Float = 0f,
  ): ColorMatrix = ColorMatrix(
    floatArrayOf(
      red, 0f, 0f, 0f, offset,
      0f, green, 0f, 0f, offset,
      0f, 0f, blue, 0f, offset,
      0f, 0f, 0f, 1f, 0f,
    ),
  )

  private fun lerp(from: ColorMatrix, to: ColorMatrix, amount: Float): ColorMatrix {
    val a = from.array
    val b = to.array
    val out = FloatArray(20)
    for (i in 0 until 20) {
      out[i] = from.array[i] + (b[i] - a[i]) * amount
    }
    return ColorMatrix(out)
  }

  private val BIPOLAR_TYPES = setOf(
    "brightness",
    "exposure",
    "contrast",
    "saturation",
    "temperature",
    "tint",
  )
}
