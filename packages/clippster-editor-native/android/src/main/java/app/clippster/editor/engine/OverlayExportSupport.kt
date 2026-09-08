package app.clippster.editor.engine

import org.json.JSONObject

/**
 * Returns true when a scene contains graph layers that cannot be represented by
 * the decoder-to-encoder surface path and therefore must be rasterized.
 */
fun sceneRequiresOverlayBurnIn(sceneJson: String): Boolean {
  val root = JSONObject(sceneJson)
  val caption = root.optJSONObject("captionDocument")
  if (caption?.optBoolean("enabled", false) == true) return true

  val tracks = root.optJSONArray("tracks") ?: return false
  for (index in 0 until tracks.length()) {
    val track = tracks.optJSONObject(index) ?: continue
    val kind = track.optString("kind")
    val items = track.optJSONArray("items") ?: continue
    if (kind in setOf("text", "overlay") && items.length() > 0) return true
    if (kind == "video") {
      for (itemIndex in 0 until items.length()) {
        val item = items.optJSONObject(itemIndex) ?: continue
        if ((item.optJSONArray("effectStack")?.length() ?: 0) > 0) return true
      }
      val transitions = track.optJSONArray("transitions") ?: continue
      for (transitionIndex in 0 until transitions.length()) {
        val transition = transitions.optJSONObject(transitionIndex) ?: continue
        val type = transition.optString("transition")
        if (type in setOf("wipe", "fade", "dissolve") &&
          transition.optLong("durationTicks", 0L) > 0L
        ) {
          return true
        }
      }
    }
  }
  return false
}
