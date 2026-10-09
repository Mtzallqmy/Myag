package com.wakeel.app.data

import androidx.room.*

@Entity(tableName = "cached_rows", primaryKeys = ["owner", "collection"])
data class CachedRows(val owner: String, val collection: String, val payload: String)
@Dao
interface CacheDao {
    @Query("SELECT payload FROM cached_rows WHERE owner = :owner AND collection = :collection") suspend fun read(owner: String, collection: String): String?
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun save(rows: CachedRows)
    @Query("DELETE FROM cached_rows") suspend fun clear()
}
@Database(entities = [CachedRows::class], version = 1, exportSchema = false)
abstract class WakeelDatabase : RoomDatabase() { abstract fun cache(): CacheDao }
