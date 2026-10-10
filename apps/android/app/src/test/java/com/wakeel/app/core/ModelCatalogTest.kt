package com.wakeel.app.core
import org.junit.Assert.*
import org.junit.Test
import kotlinx.serialization.json.*
class ModelCatalogTest {
 @Test fun unknownIsNotFreeAndFiltersRespectContextAndCapabilities() {
  fun model(id: String, tier: String, context: Int, tools: String) = buildJsonObject { put("id", id); put("display_name", id); put("price_class", tier); put("context_length", context); put("capabilities_json", buildJsonObject { put("tool_calling", tools) }) }
  val models = listOf(model("Free", "FREE_VERIFIED", 8000, "SUPPORTED"), model("Unknown", "UNKNOWN", 128000, "UNSUPPORTED"), model("Paid", "PAID", 64000, "INFERRED"))
  assertEquals(1, ModelCatalog.filter(models, "", "FREE", "ALL", "NAME").size)
  assertEquals(2, ModelCatalog.filter(models, "", "ALL", "tool_calling", "NAME").size)
  assertEquals("Unknown", ModelCatalog.filter(models, "", "ALL", "ALL", "CONTEXT").first()["id"]!!.jsonPrimitive.content)
  assertTrue(ModelCatalog.filter(models, "absent", "ALL", "ALL", "NAME").isEmpty())
 }
}
