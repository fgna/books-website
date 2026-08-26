package de.fgna.library

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class BookBackupWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : Worker(appContext, workerParams) {
    override fun doWork(): Result = runCatching {
        BookBackupManager.createBackupIfNeeded(applicationContext)
        Result.success()
    }.getOrElse {
        Result.retry()
    }
}
