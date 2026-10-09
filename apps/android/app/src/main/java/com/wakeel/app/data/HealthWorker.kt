package com.wakeel.app.data

import android.content.Context
import androidx.work.*
import com.wakeel.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/** Deferred public connectivity check only; agent execution always remains on the server. */
class HealthWorker(context: Context, params: WorkerParameters): CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try { OkHttpClient.Builder().callTimeout(20, TimeUnit.SECONDS).build().newCall(Request.Builder().url(BuildConfig.API_ORIGIN + "health/ready").build()).execute().use {
            if (it.isSuccessful) Result.success() else if (runAttemptCount < 2) Result.retry() else Result.failure()
        } } catch (_: Exception) { if (runAttemptCount < 2) Result.retry() else Result.failure() }
    }
}
