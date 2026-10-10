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
@Entity(primaryKeys = ["owner", "projectId", "path"])
data class CachedFile(val owner: String, val projectId: String, val path: String, val content: String, val savedAt: Long)
@Dao interface FileCacheDao {
    @Query("DELETE FROM CachedFile WHERE owner = :owner AND projectId = :projectId AND path = :path") suspend fun remove(owner: String, projectId: String, path: String)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun save(file: CachedFile)
    @Query("SELECT * FROM CachedFile WHERE owner = :owner AND projectId = :projectId AND path = :path LIMIT 1") suspend fun read(owner: String, projectId: String, path: String): CachedFile?
    @Query("SELECT * FROM CachedFile WHERE owner = :owner AND projectId = :projectId ORDER BY savedAt DESC LIMIT 50") suspend fun files(owner: String, projectId: String): List<CachedFile>
    @Query("DELETE FROM CachedFile WHERE owner = :owner AND projectId = :projectId AND path NOT IN (SELECT path FROM CachedFile WHERE owner = :owner AND projectId = :projectId ORDER BY savedAt DESC LIMIT 50)") suspend fun trim(owner: String, projectId: String)
    @Query("DELETE FROM CachedFile") suspend fun clear()
}
@Database(entities = [CachedRows::class, CachedFile::class], version = 2, exportSchema = false)
abstract class WakeelDatabase : RoomDatabase() { abstract fun cache(): CacheDao; abstract fun files(): FileCacheDao }
