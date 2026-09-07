package com.torre28.control.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class Torre28Api {
    companion object {
        const val ENDPOINT = "https://script.google.com/macros/s/AKfycbwjxLoSPVRl-amJKPGCqz6OR_ksRHdtp9E3_Pz1rZjlGosBtGyh3c4b_uv0Hv9xVr3M/exec"
    }

    suspend fun login(username: String, pin: String): Pair<String, UserSession> {
        val payload = JSONObject().put("usuario", username).put("pin", pin)
            .put("dispositivo", JSONObject().put("dispositivo", "Android nativo").put("sistema", "Android"))
        val json = call("auth.login", payload, "")
        return json.getString("token") to parseUser(json.getJSONObject("usuario"))
    }

    suspend fun validate(token: String): UserSession =
        parseUser(call("auth.validar", JSONObject().put("token", token), "").getJSONObject("usuario"))

    suspend fun logout(token: String) { call("auth.logout", JSONObject().put("token", token), "") }

    suspend fun home(token: String): HomeSummary {
        val movements = movementsJson(token)
        val parking = call("inicio.estacionamientos", JSONObject(), token).optJSONArray("data") ?: JSONArray()
        val companies = call("inicio.empresas", JSONObject().put("incluirLogos", false), token).optJSONArray("data") ?: JSONArray()
        var opened = 0
        for (i in 0 until movements.length()) {
            if (movements.optJSONObject(i)?.optString("estado").orEmpty().contains("abiert", true)) opened++
        }
        return HomeSummary(movements.length(), opened, movements.length() - opened, companies.length(), parking.length())
    }

    suspend fun todayMovements(token: String): List<Movement> {
        val rows = movementsJson(token)
        return List(rows.length()) { index ->
            val row = rows.optJSONObject(index) ?: JSONObject()
            Movement(
                rowIndex = row.optInt("filaIndex", -1),
                id = row.optString("id"),
                entryTime = row.optString("horaEntrada"),
                exitTime = row.optString("horaSalida"),
                plate = row.optString("placa", "---"),
                name = row.optString("nombre", "Sin nombre"),
                document = row.optString("documento"),
                company = row.optString("empresa", "Sin empresa"),
                parking = row.optString("est", "---"),
                entryType = row.optString("tipoIngreso"),
                observations = row.optString("observaciones"),
                registeredBy = row.optString("registradoPor"),
                status = row.optString("estado", "Abierto")
            )
        }
    }

    private suspend fun movementsJson(token: String): JSONArray =
        call("inicio.movimientosHoy", JSONObject(), token).optJSONArray("data") ?: JSONArray()

    private fun parseUser(json: JSONObject): UserSession {
        val permissions = json.optJSONArray("permisos") ?: JSONArray()
        return UserSession(
            json.optString("id"), json.optString("nombre", "Usuario"), json.optString("usuario"),
            json.optString("rol", "Acceso"), List(permissions.length()) { permissions.optString(it) }
        )
    }

    private suspend fun call(action: String, payload: JSONObject, token: String): JSONObject = withContext(Dispatchers.IO) {
        val connection = (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"; instanceFollowRedirects = true
            connectTimeout = 20_000; readTimeout = 45_000; doOutput = true
            setRequestProperty("Content-Type", "text/plain;charset=utf-8")
        }
        try {
            val body = JSONObject().put("action", action).put("token", token).put("payload", payload).toString()
            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
            val response = stream.bufferedReader().use { it.readText() }
            val json = JSONObject(response)
            if (!json.optBoolean("ok", true)) throw ApiException(json.optString("code"), json.optString("error", "Error de Torre 28"))
            json
        } finally { connection.disconnect() }
    }
}

class ApiException(val code: String, override val message: String) : Exception(message)

