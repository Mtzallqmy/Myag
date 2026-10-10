package com.wakeel.app.core

import com.wakeel.app.data.text
import kotlinx.serialization.json.*

object ModelCatalog {
    fun tier(model: JsonObject): String = when (model.text("price_class")) {
        "FREE_VERIFIED" -> "FREE_VERIFIED"
        "FREE_REPORTED" -> "FREE_REPORTED"
        "PAID" -> "PAID"
        else -> "UNKNOWN"
    }
    fun filter(models: List<JsonObject>, query: String, price: String, capability: String, sort: String): List<JsonObject> {
        val selected = models.filter { model ->
            val name = model.text("display_name") + " " + model.text("external_model_id")
            val tier = tier(model)
            val caps = model["capabilities_json"] as? JsonObject
            name.contains(query.trim(), ignoreCase = true) &&
                (price == "ALL" || if (price == "FREE") tier.startsWith("FREE_") else price == tier) &&
                (capability == "ALL" || caps?.text(capability) in listOf("SUPPORTED", "INFERRED"))
        }
        return when (sort) {
            "CONTEXT" -> selected.sortedByDescending { (it["context_length"] as? JsonPrimitive)?.longOrNull ?: 0 }
            "PRICE" -> selected.sortedWith(compareBy<JsonObject> { when (tier(it)) { "FREE_VERIFIED" -> 0; "FREE_REPORTED" -> 1; "PAID" -> 2; else -> 3 } }.thenBy { it.text("display_name") })
            else -> selected.sortedBy { it.text("display_name").lowercase() }
        }
    }
}
