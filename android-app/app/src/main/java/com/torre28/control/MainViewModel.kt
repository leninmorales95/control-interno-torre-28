package com.torre28.control

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.torre28.control.data.HomeSummary
import com.torre28.control.data.Movement
import com.torre28.control.data.ApiException
import com.torre28.control.data.SessionStore
import com.torre28.control.data.Torre28Api
import com.torre28.control.data.UserSession
import kotlinx.coroutines.async
import kotlinx.coroutines.launch

data class AppState(
    val checkingSession: Boolean = true,
    val loading: Boolean = false,
    val user: UserSession? = null,
    val summary: HomeSummary = HomeSummary(),
    val movements: List<Movement> = emptyList(),
    val error: String = ""
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val api = Torre28Api()
    private val session = SessionStore(application)
    var state = androidx.compose.runtime.mutableStateOf(AppState())
        private set

    init { restoreSession() }

    private fun restoreSession() = viewModelScope.launch {
        val token = session.token()
        if (token.isBlank()) { state.value = AppState(checkingSession = false); return@launch }
        runCatching { api.validate(token) }
            .onSuccess { user -> session.save(token, user); state.value = AppState(checkingSession = false, user = user); refresh() }
            .onFailure { error ->
                if (error is ApiException && (error.code == "AUTH_INVALID" || error.code == "AUTH_REQUIRED")) {
                    session.clear(); state.value = AppState(checkingSession = false)
                } else {
                    val cached = session.cachedUser()
                    state.value = AppState(checkingSession = false, user = cached, error = if (cached == null) "Sin conexión" else "Modo sin conexión")
                }
            }
    }

    fun login(username: String, pin: String) = viewModelScope.launch {
        state.value = state.value.copy(loading = true, error = "")
        runCatching { api.login(username.trim(), pin.trim()) }
            .onSuccess { (token, user) -> session.save(token, user); state.value = AppState(checkingSession = false, user = user); refresh() }
            .onFailure { state.value = state.value.copy(loading = false, error = it.message ?: "No se pudo ingresar") }
    }

    fun refresh() = viewModelScope.launch {
        if (state.value.user == null) return@launch
        state.value = state.value.copy(loading = true, error = "")
        runCatching {
            val summary = async { api.home(session.token()) }
            val movements = async { api.todayMovements(session.token()) }
            summary.await() to movements.await()
        }
            .onSuccess { (summary, movements) -> state.value = state.value.copy(loading = false, summary = summary, movements = movements) }
            .onFailure { state.value = state.value.copy(loading = false, error = it.message ?: "Sin conexión") }
    }

    fun logout() = viewModelScope.launch {
        val token = session.token(); session.clear(); state.value = AppState(checkingSession = false)
        runCatching { api.logout(token) }
    }
}

