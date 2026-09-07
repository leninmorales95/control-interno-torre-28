package com.torre28.control.data

data class UserSession(
    val id: String,
    val name: String,
    val username: String,
    val role: String,
    val permissions: List<String>
)

data class HomeSummary(
    val movements: Int = 0,
    val open: Int = 0,
    val finished: Int = 0,
    val companies: Int = 0,
    val parking: Int = 0
)
