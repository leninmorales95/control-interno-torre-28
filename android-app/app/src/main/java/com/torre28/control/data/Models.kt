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

data class Movement(
    val rowIndex: Int,
    val id: String,
    val entryTime: String,
    val exitTime: String,
    val plate: String,
    val name: String,
    val document: String,
    val company: String,
    val parking: String,
    val entryType: String,
    val observations: String,
    val registeredBy: String,
    val status: String
) {
    val isOpen: Boolean get() = status.contains("abiert", ignoreCase = true)
}

