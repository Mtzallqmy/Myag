package com.wakeel.app.data

import android.content.Context
import androidx.room.Room
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.wakeel.app.BuildConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.*
import okhttp3.OkHttpClient
import okhttp3.MediaType.Companion.toMediaType
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.*
import javax.inject.Singleton
import java.util.concurrent.TimeUnit

interface WakeelApi {
    @PUT suspend fun updateUser(@Url url: String, @Header("apikey") key: String, @Header("Authorization") auth: String, @Body body: JsonObject): JsonObject
    @POST suspend fun signup(@Url url: String, @Header("apikey") key: String, @Body body: JsonObject): JsonObject
    @GET @Headers("Accept: application/json") suspend fun get(@Url path: String, @Header("Authorization") auth: String): JsonObject
    @POST @Headers("Accept: application/json") suspend fun post(@Url path: String, @Body body: JsonObject, @Header("Authorization") auth: String? = null): JsonObject
}
@Module @InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides @Singleton fun client(): OkHttpClient = OkHttpClient.Builder().connectTimeout(20, TimeUnit.SECONDS).readTimeout(180, TimeUnit.SECONDS).callTimeout(0, TimeUnit.SECONDS).build()
    @Provides @Singleton fun api(client: OkHttpClient): WakeelApi = Retrofit.Builder().baseUrl(BuildConfig.API_ORIGIN).client(client)
        .addConverterFactory(Json { ignoreUnknownKeys = true }.asConverterFactory("application/json".toMediaType())).build().create(WakeelApi::class.java)
    @Provides @Singleton fun database(@ApplicationContext context: Context): WakeelDatabase = Room.databaseBuilder(context, WakeelDatabase::class.java, "wakeel-cache.db")
        .addMigrations(object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("CREATE TABLE IF NOT EXISTS CachedFile (owner TEXT NOT NULL, projectId TEXT NOT NULL, path TEXT NOT NULL, content TEXT NOT NULL, savedAt INTEGER NOT NULL, PRIMARY KEY(owner, projectId, path))")
            }
        }, object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("CREATE TABLE IF NOT EXISTS CachedMedia (owner TEXT NOT NULL, uri TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, metadata TEXT NOT NULL, preview TEXT, savedAt INTEGER NOT NULL, PRIMARY KEY(owner, uri))")
            }
        }).build()
}
fun JsonObject.text(key: String): String = (get(key) as? JsonPrimitive)?.contentOrNull.orEmpty()
fun payload(vararg fields: Pair<String, String>): JsonObject = buildJsonObject { fields.forEach { (key, value) -> put(key, value) } }
