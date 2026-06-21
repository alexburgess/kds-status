package com.kdsstatus.app.data

import android.content.Context
import android.content.RestrictionsManager

class ManagedConfigRepository(private val context: Context) {
    fun readConfig(): AppConfig {
        val restrictionsManager = context.getSystemService(Context.RESTRICTIONS_SERVICE) as RestrictionsManager
        val bundle = restrictionsManager.applicationRestrictions
        val values = bundle.keySet().associateWith { key -> bundle.getString(key) }

        return AppConfigParser.parse(values)
    }
}
