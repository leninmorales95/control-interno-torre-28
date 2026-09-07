package com.torre28.control

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items as listItems
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.torre28.control.data.HomeSummary
import com.torre28.control.data.Movement

private val Wine = Color(0xFF941F3B)
private val WineDark = Color(0xFF3C101C)
private val Amber = Color(0xFFF3A400)
private val Canvas = Color(0xFFF7F3F4)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState); enableEdgeToEdge()
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = Wine, secondary = Amber, background = Canvas)) {
                Torre28App()
            }
        }
    }
}

@Composable
private fun Torre28App(vm: MainViewModel = viewModel()) {
    val state by vm.state
    when {
        state.checkingSession -> LoadingScreen("Recuperando tu sesión…")
        state.user == null -> LoginScreen(state.loading, state.error, vm::login)
        else -> NativeShell(state, vm::refresh, vm::logout)
    }
}

@Composable
private fun LoadingScreen(text: String) = Box(Modifier.fillMaxSize().background(Canvas), contentAlignment = Alignment.Center) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        BrandMark(); CircularProgressIndicator(color = Wine); Text(text, color = Wine, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun BrandMark() = Box(Modifier.size(58.dp).background(Amber, RoundedCornerShape(18.dp)), contentAlignment = Alignment.Center) {
    Text("T28", color = WineDark, fontWeight = FontWeight.Black, fontSize = 17.sp)
}

@Composable
private fun LoginScreen(loading: Boolean, error: String, login: (String, String) -> Unit) {
    var username by remember { mutableStateOf("") }; var pin by remember { mutableStateOf("") }
    Box(Modifier.fillMaxSize().background(WineDark).padding(22.dp), contentAlignment = Alignment.Center) {
        Card(shape = RoundedCornerShape(28.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
            Column(Modifier.widthIn(max = 440.dp).padding(26.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    BrandMark(); Column { Text("TORRE 28", fontWeight = FontWeight.Black); Text("CONTROL DE ESTACIONAMIENTOS", fontSize = 10.sp, color = Color.Gray) }
                }
                Spacer(Modifier.height(4.dp)); Text("Bienvenido", fontSize = 28.sp, fontWeight = FontWeight.Black)
                Text("Ingresa tus credenciales para acceder al panel.", color = Color.Gray)
                OutlinedTextField(username, { username = it }, Modifier.fillMaxWidth(), label = { Text("Usuario") }, singleLine = true)
                OutlinedTextField(pin, { pin = it }, Modifier.fillMaxWidth(), label = { Text("PIN") }, singleLine = true,
                    visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword))
                if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                Button({ login(username, pin) }, Modifier.fillMaxWidth().height(52.dp), enabled = !loading && username.isNotBlank() && pin.isNotBlank()) {
                    if (loading) CircularProgressIndicator(Modifier.size(22.dp), color = Color.White, strokeWidth = 2.dp) else Text("Ingresar al panel", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

private enum class NativePage(val label: String, val symbol: String) { HOME("Inicio", "⌂"), MOVEMENTS("Movimientos", "↔"), USERS("Usuarios", "♙"), MORE("Más", "•••") }

@Composable
private fun NativeShell(state: AppState, refresh: () -> Unit, logout: () -> Unit) {
    var page by rememberSaveable { mutableStateOf(NativePage.HOME) }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val tablet = maxWidth >= 700.dp
        Row(Modifier.fillMaxSize().background(Canvas)) {
            if (tablet) NavigationRail(containerColor = WineDark) {
                Spacer(Modifier.height(18.dp)); BrandMark(); Spacer(Modifier.height(24.dp))
                NativePage.entries.forEach { item -> NavigationRailItem(page == item, { page = item }, { Text(item.symbol, color = Color.White) }, label = { Text(item.label, color = Color.White) }) }
            }
            Scaffold(
                modifier = Modifier.weight(1f), containerColor = Canvas,
                bottomBar = { if (!tablet) NavigationBar { NativePage.entries.forEach { item -> NavigationBarItem(page == item, { page = item }, { Text(item.symbol, fontWeight = FontWeight.Black) }, label = { Text(item.label) }) } } }
            ) { padding ->
                when (page) {
                    NativePage.HOME -> HomeScreen(state, refresh, Modifier.padding(padding))
                    NativePage.MOVEMENTS -> MovementsScreen(state, refresh, Modifier.padding(padding))
                    NativePage.MORE -> MoreScreen(state, logout, Modifier.padding(padding))
                    else -> PendingScreen(page.label, Modifier.padding(padding))
                }
            }
        }
    }
}

private enum class MovementFilter(val label: String) { ALL("Todos"), OPEN("Abiertos"), CLOSED("Finalizados") }

@Composable
private fun MovementsScreen(state: AppState, refresh: () -> Unit, modifier: Modifier = Modifier) {
    var query by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf(MovementFilter.ALL) }
    val visible = remember(state.movements, query, filter) {
        state.movements.filter { movement ->
            val statusMatches = when (filter) {
                MovementFilter.ALL -> true
                MovementFilter.OPEN -> movement.isOpen
                MovementFilter.CLOSED -> !movement.isOpen
            }
            val haystack = listOf(movement.plate, movement.name, movement.company, movement.parking, movement.entryType)
                .joinToString(" ").lowercase()
            statusMatches && (query.isBlank() || haystack.contains(query.trim().lowercase()))
        }
    }
    Column(modifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Movimientos hoy", fontSize = 25.sp, fontWeight = FontWeight.Black)
                Text("${visible.size} de ${state.movements.size} registros", color = Color.Gray, fontSize = 13.sp)
            }
            FilledTonalButton(refresh, enabled = !state.loading) { Text(if (state.loading) "…" else "↻") }
        }
        OutlinedTextField(
            value = query, onValueChange = { query = it }, modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Buscar placa, persona o empresa") }, singleLine = true,
            leadingIcon = { Text("⌕", fontWeight = FontWeight.Bold) },
            trailingIcon = { if (query.isNotEmpty()) TextButton({ query = "" }) { Text("×") } }
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MovementFilter.entries.forEach { item ->
                FilterChip(selected = filter == item, onClick = { filter = item }, label = { Text(item.label) })
            }
        }
        if (state.loading && state.movements.isEmpty()) {
            repeat(6) { MovementSkeleton() }
        } else if (visible.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("No hay movimientos que coincidan.", color = Color.Gray) }
        } else {
            LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                listItems(visible, key = { "${it.id}-${it.rowIndex}" }) { MovementRow(it) }
            }
        }
    }
}

@Composable
private fun MovementRow(movement: Movement) {
    val statusColor = if (movement.isOpen) Color(0xFF087A51) else Color(0xFF686168)
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(16.dp)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 13.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(38.dp).background(if (movement.isOpen) Color(0xFFE7F7F0) else Color(0xFFF2ECEE), RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                Text("▰", color = statusColor, fontWeight = FontWeight.Black)
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(movement.plate, fontWeight = FontWeight.Black, fontSize = 16.sp)
                    Spacer(Modifier.width(7.dp))
                    Text(movement.company, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 10.sp,
                        maxLines = 1, overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.background(Wine, RoundedCornerShape(5.dp)).padding(horizontal = 6.dp, vertical = 2.dp))
                }
                Text("${movement.name} · Est. ${movement.parking}", maxLines = 1, overflow = TextOverflow.Ellipsis, color = Color(0xFF625A5D), fontSize = 13.sp)
                Text("Ingreso ${movement.entryTime}", maxLines = 1, overflow = TextOverflow.Ellipsis, color = Color.Gray, fontSize = 11.sp)
            }
            Text(if (movement.isOpen) "ABIERTO" else "CERRADO", color = statusColor, fontWeight = FontWeight.Bold, fontSize = 10.sp,
                modifier = Modifier.border(1.dp, statusColor.copy(alpha = .25f), RoundedCornerShape(8.dp)).padding(horizontal = 7.dp, vertical = 5.dp))
        }
    }
}

@Composable
private fun MovementSkeleton() {
    Card(Modifier.fillMaxWidth().height(74.dp), colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = .72f)), shape = RoundedCornerShape(16.dp)) {
        Row(Modifier.fillMaxSize().padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(38.dp).background(Color(0xFFE9E2E4), RoundedCornerShape(12.dp)))
            Spacer(Modifier.width(11.dp))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.width(170.dp).height(11.dp).background(Color(0xFFE9E2E4), RoundedCornerShape(6.dp)))
                Box(Modifier.width(230.dp).height(9.dp).background(Color(0xFFF0EAEC), RoundedCornerShape(6.dp)))
            }
        }
    }
}

@Composable
private fun HomeScreen(state: AppState, refresh: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize().padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text("Inicio", fontSize = 27.sp, fontWeight = FontWeight.Black); Text("Hola, ${state.user?.name}", color = Color.Gray) }
            FilledTonalButton(refresh, enabled = !state.loading) { Text(if (state.loading) "Actualizando…" else "Sincronizar") }
        }
        if (state.error.isNotBlank()) Text(state.error, color = if (state.error.contains("sin conexión", true)) Color(0xFF9A6500) else MaterialTheme.colorScheme.error)
        SummaryGrid(state.summary, Modifier.weight(1f))
    }
}

@Composable
private fun SummaryGrid(summary: HomeSummary, modifier: Modifier = Modifier) {
    val cards = listOf("Movimientos hoy" to summary.movements, "Abiertos" to summary.open, "Finalizados" to summary.finished, "Empresas" to summary.companies, "Estacionamientos" to summary.parking)
    LazyVerticalGrid(GridCells.Adaptive(155.dp), modifier, horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(cards) { (title, value) -> Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp)) {
            Column(Modifier.padding(18.dp)) { Text(title.uppercase(), fontSize = 11.sp, color = Wine, fontWeight = FontWeight.Bold); Spacer(Modifier.height(12.dp)); Text(value.toString(), fontSize = 34.sp, fontWeight = FontWeight.Black) }
        } }
    }
}

@Composable
private fun PendingScreen(title: String, modifier: Modifier = Modifier) = Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(title, fontSize = 26.sp, fontWeight = FontWeight.Black); Text("Próximo módulo nativo", color = Color.Gray) }
}

@Composable
private fun MoreScreen(state: AppState, logout: () -> Unit, modifier: Modifier = Modifier) = Column(modifier.fillMaxSize().padding(22.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
    Text("Configuración", fontSize = 27.sp, fontWeight = FontWeight.Black)
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color.White)) { Column(Modifier.padding(18.dp)) { Text(state.user?.name.orEmpty(), fontWeight = FontWeight.Bold); Text(state.user?.role.orEmpty(), color = Color.Gray) } }
    OutlinedButton(logout, Modifier.fillMaxWidth()) { Text("Cerrar sesión") }
}

