package com.kdsstatus.app.data

class BuiltInConfigRepository {
    fun readConfig(): AppConfig = AppConfigParser.builtIn()
}
