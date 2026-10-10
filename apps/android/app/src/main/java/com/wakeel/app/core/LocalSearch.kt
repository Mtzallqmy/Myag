package com.wakeel.app.core

data class LocalHit(val kind: String, val path: String, val line: Int, val preview: String)
object LocalSearch {
    /** Searches only previously cached files; never executes project code. */
    fun find(files: List<Pair<String, String>>, query: String, limit: Int = 200): List<LocalHit> {
        val needle = query.trim()
        if (needle.isEmpty() || needle.length > 200 || limit <= 0) return emptyList()
        val hits = mutableListOf<LocalHit>()
        for ((path, content) in files) {
            if (path.contains(needle, ignoreCase = true)) hits += LocalHit("file", path, 1, path)
            if (hits.size >= limit) return hits.take(limit)
            content.lineSequence().forEachIndexed { index, line ->
                if (line.contains(needle, ignoreCase = true)) hits += LocalHit("text", path, index + 1, line.take(240))
                if (hits.size >= limit) return hits.take(limit)
            }
        }
        return hits
    }
}
