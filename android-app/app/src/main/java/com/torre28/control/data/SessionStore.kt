package com.torre28.control.data

import android.content.Context

class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("torre28_session", Context.MODE_PRIVATE)
    fun token(): String = prefs.getString("token", "").orEmpty()
    fun save(token: String, user: UserSession) = prefs.edit()
        .putString("token", token).putString("id", user.id).putString("name", user.name)
        .putString("username", user.username).putString("role", user.role)
        .putString("permissions", user.permissions.joinToString("\u001f")).apply()
    fun cachedUser(): UserSession? {
        if (token().isBlank()) return null
        return UserSession(
            prefs.getString("id", "").orEmpty(), prefs.getString("name", "Usuario").orEmpty(),
            prefs.getString("username", "").orEmpty(), prefs.getString("role", "Acceso").orEmpty(),
            prefs.getString("permissions", "").orEmpty().split("\u001f").filter { it.isNotBlank() }
        )
    }
    fun clear() = prefs.edit().clear().apply()
}
