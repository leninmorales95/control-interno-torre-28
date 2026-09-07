package com.torre28.control

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.torre28.control.data.HomeSummary

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
                    NativePage.MORE -> MoreScreen(state, logout, Modifier.padding(padding))
                    else -> PendingScreen(page.label, Modifier.padding(padding))
                }
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
