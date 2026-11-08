// ==========================================
// CONFIGURACIÓN DE SUPABASE Y VARIABLES GLOBALES
// ==========================================
const SUPABASE_URL = 'https://vdcvvfsomvzcamncerfz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkY3Z2ZnNvbXZ6Y2FtbmNlcmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NjA2MDEsImV4cCI6MjEwNjUzNjYwMX0.R9gjLlQ1BwIHNRymnX34tMmOpx7qPEPZGAYH9rPZWZ8';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let listaRepuestos = [];
let listaOfertas = [];
let archivosSeleccionadosParaSubir = [];
let archivosOfertaParaSubir = [];
let indicePrincipalSeleccionada = 0; // Índice de la foto marcada con la estrella
let fotosActualesModal = [];
let indiceFotoActual = 0;
let intentosLoginFallidos = 0;
let tiempoBloqueoLogin = false;

// ==========================================
// VARIABLES DE PAGINACIÓN Y FILTRO DE STOCK
// ==========================================
let paginaActual = 1;
const itemsPorPagina = 8; // Cantidad de repuestos por página
let repuestosUltimoFiltro = []; // Guarda los elementos filtrados actuales
let mostrandoSoloCriticos = false; // Estado del botón toggle de stock crítico

// Inicializar la aplicación y validar sesión al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error } = await _supabase.auth.getSession();
        if (error) {
            console.error("Error al verificar la sesión:", error.message);
            await _supabase.auth.signOut();
        } else if (session) {
            activarModoAdmin();
        } else {
            await _supabase.auth.signOut();
        }
    } catch (err) {
        console.error("Excepción al validar sesión:", err);
    }
    
    cargarRepuestos();
    cargarOfertas();
});

// ==========================================
// CARGAR Y RENDERIZAR REPUESTOS EN LA GRILLA
// ==========================================
async function cargarRepuestos() {
    const { data, error } = await _supabase
        .from('repuestos')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        mostrarToast("Error al cargar repuestos: " + error.message, "error");
        return;
    }

    listaRepuestos = data || [];
    renderRepuestos(listaRepuestos);
    actualizarPanelStock(listaRepuestos);
    
    // Detectar enlace directo por producto (?p=id) al finalizar la carga
    verificarEnlaceDirecto();
}

// ==========================================
// DETECTAR ENLACE DIRECTO POR PRODUCTO (?p=id)
// ==========================================
function verificarEnlaceDirecto() {
    const params = new URLSearchParams(window.location.search);
    const productoId = params.get('p');
    
    if (productoId) {
        const idNumerico = parseInt(productoId);
        const repExiste = listaRepuestos.find(r => r.id === idNumerico);
        if (repExiste) {
            abrirDetalleRepuesto(idNumerico);
        }
    }
}

function renderRepuestos(repuestos) {
    const grid = document.getElementById('grid-repuestos');
    const paginacionContainer = document.getElementById('paginacion-container');
    if (!grid) return;
    
    grid.innerHTML = '';
    repuestosUltimoFiltro = repuestos; // Guardamos el listado filtrado

    if (repuestos.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 text-slate-500 text-sm">
                No se encontraron repuestos cargados.
            </div>`;
        if (paginacionContainer) paginacionContainer.classList.add('hidden');
        return;
    }

    // Calcular total de páginas
    const totalPaginas = Math.ceil(repuestos.length / itemsPorPagina);
    if (paginaActual > totalPaginas) paginaActual = 1;

    // Obtener solo los elementos de la página actual
    const inicio = (paginaActual - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    const repuestosPagina = repuestos.slice(inicio, fin);

    const esAdmin = !document.getElementById('admin-actions-bar').classList.contains('hidden');

    repuestosPagina.forEach(rep => {
        const imagenesArray = rep.imagen ? rep.imagen.split(',').map(img => img.trim()).filter(img => img !== '') : [];
        const imagenPrincipal = imagenesArray.length > 0 ? imagenesArray[0] : 'img/sin-imagen.png';

        const sinStock = rep.stock === 0;
        const stockBajo = rep.stock === 1 || (rep.stock <= 2 && rep.stock > 0);

        let textoStock = '';
        if (rep.stock === 0) {
            textoStock = 'Sin Stock';
        } else if (rep.stock === 1) {
            textoStock = 'Stock: 1 unidad';
        } else {
            textoStock = `Stock: ${rep.stock} unidades`;
        }

        const card = document.createElement('div');
        card.className = "bg-cardBg border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between group transition-all hover:border-slate-700";

        card.innerHTML = `
            <div class="relative h-48 bg-slate-900 overflow-hidden">
                <img src="${imagenPrincipal}" alt="${rep.nombre}" onerror="this.src='img/sin-imagen.png'" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                <span class="absolute top-3 left-3 bg-darkBg/80 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full border border-slate-700">
                    ${rep.categoria}
                </span>
                ${imagenesArray.length > 1 ? `<span class="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-md"><i class="fa-regular fa-images mr-1"></i>${imagenesArray.length}</span>` : ''}
            </div>

            <div class="p-5 flex flex-col flex-grow justify-between space-y-4">
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-semibold px-2.5 py-0.5 rounded-md ${sinStock ? 'bg-red-500/20 text-red-400 border border-red-500/30' : (stockBajo ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30')}">
                            ${textoStock}
                        </span>
                        <span class="text-xl font-black text-accentYellow">$${formatearPrecio(rep.precio)}</span>
                    </div>
                    <h3 class="font-bold text-white text-base leading-snug line-clamp-2">${rep.nombre}</h3>
                </div>

                <div class="pt-2 flex items-center gap-2">
                    <button onclick="abrirDetalleRepuesto(${rep.id})" class="flex-grow bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 px-3 rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-eye text-accentYellow"></i> Ver Detalles
                    </button>
                    
                    ${esAdmin ? `
                        <button onclick="abrirModalEditar(${rep.id})" class="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2.5 rounded-xl transition-colors" title="Editar">
                            <i class="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button onclick="abrirModalEliminar(${rep.id})" class="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2.5 rounded-xl transition-colors" title="Eliminar">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    if (paginacionContainer) {
        if (totalPaginas > 1) {
            paginacionContainer.classList.remove('hidden');
            document.getElementById('pagina-indicador').textContent = `Página ${paginaActual} de ${totalPaginas}`;
            document.getElementById('btn-Anterior').disabled = paginaActual === 1;
            document.getElementById('btn-Siguiente').disabled = paginaActual === totalPaginas;
        } else {
            paginacionContainer.classList.add('hidden');
        }
    }
}

// Función para cambiar de página al hacer clic en los botones
function cambiarPagina(direccion) {
    const totalPaginas = Math.ceil(repuestosUltimoFiltro.length / itemsPorPagina);
    paginaActual += direccion;
    
    if (paginaActual < 1) paginaActual = 1;
    if (paginaActual > totalPaginas) paginaActual = totalPaginas;

    renderRepuestos(repuestosUltimoFiltro);
    window.scrollTo({ top: 400, behavior: 'smooth' });
}

function filtrarRepuestos() {
    paginaActual = 1;
    const texto = document.getElementById('input-buscar').value.toLowerCase();
    const orden = document.getElementById('select-orden') ? document.getElementById('select-orden').value : 'recientes';
    
    const precioMin = parseFloat(document.getElementById('precio-min')?.value) || 0;
    const precioMax = parseFloat(document.getElementById('precio-max')?.value) || Infinity;

    let categoriaActiva = 'Todos';
    const botonesCat = document.querySelectorAll('.cat-btn');
    botonesCat.forEach(btn => {
        if (btn.classList.contains('bg-accentRed')) {
            categoriaActiva = btn.textContent.trim();
        }
    });

    let baseRepuestos = [];
    if (categoriaActiva === 'Todos') {
        baseRepuestos = [...listaRepuestos];
    } else {
        baseRepuestos = listaRepuestos.filter(r => r.categoria.toLowerCase() === categoriaActiva.toLowerCase());
    }

    let filtrados = baseRepuestos.filter(r => {
        const precioRep = parseFloat(r.precio) || 0;
        const cumpleTexto = r.nombre.toLowerCase().includes(texto) || 
                            r.categoria.toLowerCase().includes(texto) || 
                            (r.descripcion && r.descripcion.toLowerCase().includes(texto));
        const cumplePrecio = precioRep >= precioMin && precioRep <= precioMax;

        return cumpleTexto && cumplePrecio;
    });

    filtrados.sort((a, b) => {
        const precioA = parseFloat(a.precio) || 0;
        const precioB = parseFloat(b.precio) || 0;
        const idA = parseInt(a.id) || 0;
        const idB = parseInt(b.id) || 0;

        if (orden === 'precio-asc') {
            return precioA - precioB;
        } else if (orden === 'precio-desc') {
            return precioB - precioA;
        } else {
            return idB - idA;
        }
    });

    renderRepuestos(filtrados);
}

function filtrarPorCategoria(categoria) {
    paginaActual = 1;
    
    document.querySelectorAll('.cat-btn').forEach(btn => {
        const textoBoton = btn.textContent.trim().toLowerCase();
        const catBuscada = categoria.trim().toLowerCase();
        
        if (textoBoton === catBuscada || (catBuscada === 'todos' && textoBoton === 'todos')) {
            btn.className = "cat-btn bg-accentRed text-white px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shadow shrink-0";
        } else {
            btn.className = "cat-btn bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0";
        }
    });

    const inputBuscar = document.getElementById('input-buscar');
    if (inputBuscar) inputBuscar.value = '';

    const orden = document.getElementById('select-orden') ? document.getElementById('select-orden').value : 'recientes';

    let filtrados = [];
    if (categoria === 'Todos') {
        filtrados = [...listaRepuestos];
    } else {
        filtrados = listaRepuestos.filter(r => r.categoria && r.categoria.toLowerCase() === categoria.toLowerCase());
    }

    filtrados.sort((a, b) => {
        const precioA = parseFloat(a.precio) || 0;
        const precioB = parseFloat(b.precio) || 0;
        const idA = parseInt(a.id) || 0;
        const idB = parseInt(b.id) || 0;

        if (orden === 'precio-asc') {
            return precioA - precioB;
        } else if (orden === 'precio-desc') {
            return precioB - precioA;
        } else {
            return idB - idA;
        }
    });

    renderRepuestos(filtrados);
}

// ==========================================
// GESTIÓN DE OFERTAS Y PROMOCIONES
// ==========================================
async function cargarOfertas() {
    const { data, error } = await _supabase
        .from('ofertas')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error("Error al cargar ofertas:", error.message);
        return;
    }

    listaOfertas = data || [];
    renderOfertas(listaOfertas);
}

function renderOfertas(ofertas) {
    const grid = document.getElementById('grid-ofertas');
    if (!grid) return;

    grid.innerHTML = '';
    const esAdmin = !document.getElementById('admin-actions-bar').classList.contains('hidden');

    if (ofertas.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-8 text-slate-500 text-sm">
                No hay ofertas vigentes por el momento.
            </div>`;
        return;
    }

    ofertas.forEach(o => {
        const imagenesArray = o.imagen ? o.imagen.split(',').map(img => img.trim()).filter(img => img !== '') : [];
        const imagenPrincipal = imagenesArray.length > 0 ? imagenesArray[0] : 'img/sin-imagen.png';

        const card = document.createElement('div');
        card.className = "bg-cardBg border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between group transition-all hover:border-slate-700";

        card.innerHTML = `
            <div class="relative h-48 bg-slate-900 overflow-hidden">
                <span class="absolute top-3 left-3 z-10 bg-accentRed text-white text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow">¡Oferta!</span>
                <img src="${imagenPrincipal}" alt="${o.nombre}" onerror="this.src='img/sin-imagen.png'" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
            </div>

            <div class="p-5 flex flex-col flex-grow justify-between space-y-4">
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Stock: ${o.stock}
                        </span>
                        <div class="text-right">
                            ${o.precio_anterior ? `<span class="text-xs text-slate-400 line-through block">$${formatearPrecio(o.precio_anterior)}</span>` : ''}
                            <span class="text-xl font-black text-accentYellow">$${formatearPrecio(o.precio)}</span>
                        </div>
                    </div>
                    <h3 class="font-bold text-white text-base leading-snug line-clamp-2">${o.nombre}</h3>
                </div>

                <div class="pt-2 flex items-center gap-2">
                    <button onclick="abrirDetalleOferta(${o.id})" class="flex-grow bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 px-3 rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-eye text-accentYellow"></i> Ver Detalles
                    </button>
                    
                    ${esAdmin ? `
                        <button onclick="abrirModalEditarOferta(${o.id})" class="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2.5 rounded-xl transition-colors" title="Editar Oferta">
                            <i class="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button onclick="eliminarOferta(${o.id})" class="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2.5 rounded-xl transition-colors" title="Eliminar Oferta">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function abrirDetalleOferta(id) {
    const oferta = listaOfertas.find(o => o.id === id);
    if (!oferta) return;

    const imagenesArray = oferta.imagen ? oferta.imagen.split(',').map(img => img.trim()).filter(img => img !== '') : [];
    const imagenPrincipal = imagenesArray.length > 0 ? imagenesArray[0] : 'img/sin-imagen.png';

    document.getElementById('detalle-oferta-img').src = imagenPrincipal;
    document.getElementById('detalle-oferta-nombre').textContent = oferta.nombre;
    document.getElementById('detalle-oferta-precio').textContent = `$${formatearPrecio(oferta.precio)}`;
    
    const precioAntEl = document.getElementById('detalle-oferta-precio-anterior');
    if (oferta.precio_anterior) {
        precioAntEl.textContent = `$${formatearPrecio(oferta.precio_anterior)}`;
        precioAntEl.classList.remove('hidden');
    } else {
        precioAntEl.classList.add('hidden');
    }

    document.getElementById('detalle-oferta-descripcion').textContent = oferta.descripcion || 'Sin descripción disponible.';

    const stockBadge = document.getElementById('detalle-oferta-stock');
    stockBadge.textContent = `Stock disponible: ${oferta.stock}`;
    stockBadge.className = `inline-block text-xs font-semibold px-2.5 py-0.5 rounded-md ${oferta.stock === 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`;

    const mensajeWp = encodeURIComponent(`Hola Darío! Vi la oferta de "${oferta.nombre}" a $${formatearPrecio(oferta.precio)} en la web y me interesa consultar stock.`);
    document.getElementById('detalle-oferta-whatsapp-btn').href = `https://wa.me/5493525615244?text=${mensajeWp}`;

    document.getElementById('detalle-oferta-modal').classList.remove('hidden');
}

function closeDetalleOfertaModal() {
    document.getElementById('detalle-oferta-modal').classList.add('hidden');
}

function abrirModalAgregarOferta() {
    archivosOfertaParaSubir = [];
    const container = document.getElementById('vistas-previas-oferta-container');
    if(container) container.innerHTML = '';
    document.getElementById('oferta-form').reset();
    document.getElementById('admin-oferta-modal').classList.remove('hidden');
}

function closeAdminOfertaModal() {
    document.getElementById('admin-oferta-modal').classList.add('hidden');
}

// ==========================================
// FUNCIONES DE EDICIÓN DE OFERTAS
// ==========================================
function abrirModalEditarOferta(id) {
    const oferta = listaOfertas.find(o => o.id === id);
    if (!oferta) return;

    document.getElementById('edit-oferta-id').value = oferta.id;
    document.getElementById('edit-oferta-nombre').value = oferta.nombre;
    document.getElementById('edit-oferta-categoria').value = oferta.categoria;
    document.getElementById('edit-oferta-stock').value = oferta.stock;
    document.getElementById('edit-oferta-precio').value = oferta.precio;
    document.getElementById('edit-oferta-precio-anterior').value = oferta.precio_anterior || '';
    document.getElementById('edit-oferta-descripcion').value = oferta.descripcion || '';
    
    const modal = document.getElementById('edit-oferta-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeEditOfertaModal() {
    const modal = document.getElementById('edit-oferta-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleEditarOferta(e) {
    e.preventDefault();
    const id = document.getElementById('edit-oferta-id').value;
    const nombre = document.getElementById('edit-oferta-nombre').value.trim();
    const categoria = document.getElementById('edit-oferta-categoria').value.trim();
    const stock = parseInt(document.getElementById('edit-oferta-stock').value) || 0;
    const precio = document.getElementById('edit-oferta-precio').value.trim();
    const precio_anterior = document.getElementById('edit-oferta-precio-anterior').value.trim() || null;
    const descripcion = document.getElementById('edit-oferta-descripcion').value.trim();

    if (!id || !nombre || !categoria || isNaN(stock) || stock < 0 || !precio || !descripcion) {
        mostrarToast("Completá todos los campos correctamente.", "error");
        return;
    }

    const { error } = await _supabase.from('ofertas').update({
        nombre, categoria, stock, precio, precio_anterior, descripcion
    }).eq('id', id);

    if (error) {
        mostrarToast("Error al actualizar oferta: " + error.message, "error");
        return;
    }

    closeEditOfertaModal();
    mostrarToast("¡Oferta actualizada con éxito!", "success");
    cargarOfertas();
}

function agregarArchivosOfertaNuevos(input) {
    if (!input.files || input.files.length === 0) return;
    for (let i = 0; i < input.files.length; i++) {
        archivosOfertaParaSubir.push(input.files[i]);
    }
    input.value = '';
    renderizarVistasPreviasOferta();
}

function manejarDropImagenOferta(e) {
    e.preventDefault();
    const dropZone = document.getElementById('drop-zone-oferta');
    if (dropZone) dropZone.classList.remove('border-accentRed');

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
            const file = e.dataTransfer.files[i];
            if (file.type.startsWith('image/')) {
                archivosOfertaParaSubir.push(file);
            }
        }
        renderizarVistasPreviasOferta();
        mostrarToast("Imágenes de oferta agregadas", "success");
    }
}

function renderizarVistasPreviasOferta() {
    const container = document.getElementById('vistas-previas-oferta-container');
    if (!container) return;
    container.innerHTML = '';

    archivosOfertaParaSubir.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const thumbDiv = document.createElement('div');
            thumbDiv.className = "relative h-20 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden flex items-center justify-center shadow-md";
            thumbDiv.innerHTML = `
                <img src="${e.target.result}" class="w-full h-full object-cover">
                <button type="button" onclick="archivosOfertaParaSubir.splice(${index},1); renderizarVistasPreviasOferta();" class="absolute top-1 right-1 bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow" title="Eliminar foto">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;
            container.appendChild(thumbDiv);
        }
        reader.readAsDataURL(file);
    });
}

async function handleAgregarOferta(e) {
    e.preventDefault();
    const nombre = document.getElementById('oferta-nombre').value.trim();
    const categoria = document.getElementById('oferta-categoria').value.trim();
    const stock = parseInt(document.getElementById('oferta-stock').value) || 0;
    const precio = document.getElementById('oferta-precio').value.trim();
    const precio_anterior = document.getElementById('oferta-precio-anterior').value.trim() || null;
    const descripcion = document.getElementById('oferta-descripcion').value.trim();

    if (!nombre || !categoria || !precio || !descripcion || archivosOfertaParaSubir.length === 0) {
        mostrarToast("Completá todos los campos y agregá al menos una foto.", "error");
        return;
    }

    let urlsImagenes = [];
    for (let i = 0; i < archivosOfertaParaSubir.length; i++) {
        const file = archivosOfertaParaSubir[i];
        const fileOptimizado = await comprimirImagen(file);
        const fileName = `oferta_${Date.now()}_${i}_${fileOptimizado.name}`;
        
        const { error: uploadError } = await _supabase.storage.from('repuestos').upload(fileName, fileOptimizado);
        if (uploadError) {
            mostrarToast("Error al subir imagen: " + uploadError.message, "error");
            return;
        }

        const { data: urlData } = _supabase.storage.from('repuestos').getPublicUrl(fileName);
        urlsImagenes.push(urlData.publicUrl);
    }

    const { error: insertError } = await _supabase.from('ofertas').insert([{
        nombre, categoria, stock, precio, precio_anterior, descripcion, imagen: urlsImagenes.join(',')
    }]);

    if (insertError) {
        mostrarToast("Error al publicar oferta: " + insertError.message, "error");
        return;
    }

    closeAdminOfertaModal();
    mostrarToast("¡Oferta publicada con éxito!", "success");
    cargarOfertas();
}

async function eliminarOferta(id) {
    if (!confirm("¿Estás seguro de eliminar esta oferta?")) return;
    const { error } = await _supabase.from('ofertas').delete().eq('id', id);
    if (error) {
        mostrarToast("Error al eliminar oferta", "error");
        return;
    }
    mostrarToast("Oferta eliminada", "success");
    cargarOfertas();
}

// ==========================================
// CARRUSEL Y MODAL DE DETALLES DE REPUESTOS
// ==========================================
function abrirDetalleRepuesto(id) {
    const rep = listaRepuestos.find(r => r.id === id);
    if (!rep) return;

    fotosActualesModal = rep.imagen ? rep.imagen.split(',').map(img => img.trim()).filter(img => img !== '') : [];
    indiceFotoActual = 0;

    actualizarImagenCarrusel();

    document.getElementById('detalle-categoria').textContent = rep.categoria;
    document.getElementById('detalle-nombre').textContent = rep.nombre;
    document.getElementById('detalle-precio').textContent = `$${formatearPrecio(rep.precio)}`;
    document.getElementById('detalle-descripcion').textContent = rep.descripcion || 'Sin descripción disponible.';

    const stockBadge = document.getElementById('detalle-stock-badge');
    const sinStock = rep.stock === 0;
    
    let textoStockModal = '';
    if (rep.stock === 0) {
        textoStockModal = 'Sin Stock';
    } else if (rep.stock === 1) {
        textoStockModal = 'Stock: 1 unidad disponible';
    } else {
        textoStockModal = `Stock: ${rep.stock} unidades disponibles`;
    }
    
    stockBadge.textContent = textoStockModal;
    stockBadge.className = `inline-block text-xs font-semibold px-2.5 py-0.5 rounded-md ${sinStock ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`;

    const mensajeWp = `Hola Darío! Me interesa consultar por el repuesto: *${rep.nombre}* (Precio: $${formatearPrecio(rep.precio)}). ¿Está disponible?`;
    const numeroDestino = '5493525615244';
    document.getElementById('detalle-whatsapp-btn').href = `https://wa.me/${numeroDestino}?text=${encodeURIComponent(mensajeWp)}`;

    document.getElementById('detalle-modal').classList.remove('hidden');
    actualizarOpenGraph(rep);
    window.history.pushState({}, '', `?p=${id}`);
}

function actualizarImagenCarrusel() {
    const imgEl = document.getElementById('detalle-img');
    const controlesEl = document.getElementById('carrusel-controles');
    const indicadorEl = document.getElementById('carrusel-indicador');

    if (!imgEl) return;

    if (fotosActualesModal.length > 0) {
        imgEl.src = fotosActualesModal[indiceFotoActual];
    } else {
        imgEl.src = 'img/sin-imagen.png';
    }

    if (fotosActualesModal.length > 1) {
        if (controlesEl) controlesEl.classList.remove('hidden');
        if (indicadorEl) {
            indicadorEl.classList.remove('hidden');
            indicadorEl.textContent = `${indiceFotoActual + 1} / ${fotosActualesModal.length}`;
        }
    } else {
        if (controlesEl) controlesEl.classList.add('hidden');
        if (indicadorEl) indicadorEl.classList.add('hidden');
    }
}

function cambiarFoto(direccion) {
    if (fotosActualesModal.length <= 1) return;
    indiceFotoActual += direccion;
    if (indiceFotoActual < 0) {
        indiceFotoActual = fotosActualesModal.length - 1;
    } else if (indiceFotoActual >= fotosActualesModal.length) {
        indiceFotoActual = 0;
    }
    actualizarImagenCarrusel();
}

function closeDetalleModal() {
    document.getElementById('detalle-modal').classList.add('hidden');
    actualizarOpenGraph(null);
    window.history.pushState({}, '', window.location.pathname);
}

// ==========================================
// COMPRESIÓN Y REDIMENSIONAMIENTO AUTOMÁTICO DE IMÁGENES
// ==========================================
async function comprimirImagen(file, maxWidth = 1000, quality = 0.8) {
    return new Promise((resolve) => {
        if (!file.type.startsWith('image/')) {
            resolve(file);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        resolve(file);
                        return;
                    }
                    const archivoComprimido = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(archivoComprimido);
                }, 'image/jpeg', quality);
            };
        };
    });
}

// ==========================================
// GESTIÓN DE IMÁGENES CON FLECHAS Y ESTRELLA
// ==========================================
function agregarArchivosNuevos(input) {
    if (!input.files || input.files.length === 0) return;

    for (let i = 0; i < input.files.length; i++) {
        archivosSeleccionadosParaSubir.push(input.files[i]);
    }

    input.value = '';
    renderizarVistasPrevias();
}

function eliminarFotoSeleccionada(index) {
    archivosSeleccionadosParaSubir.splice(index, 1);
    if (indicePrincipalSeleccionada >= archivosSeleccionadosParaSubir.length) {
        indicePrincipalSeleccionada = 0;
    }
    renderizarVistasPrevias();
}

function moverFoto(index, direccion) {
    const nuevoIndex = index + direccion;
    if (nuevoIndex < 0 || nuevoIndex >= archivosSeleccionadosParaSubir.length) return;
    
    const temp = archivosSeleccionadosParaSubir[index];
    archivosSeleccionadosParaSubir[index] = archivosSeleccionadosParaSubir[nuevoIndex];
    archivosSeleccionadosParaSubir[nuevoIndex] = temp;

    if (indicePrincipalSeleccionada === index) {
        indicePrincipalSeleccionada = nuevoIndex;
    } else if (indicePrincipalSeleccionada === nuevoIndex) {
        indicePrincipalSeleccionada = index;
    }

    renderizarVistasPrevias();
}

function hacerPrincipal(index) {
    indicePrincipalSeleccionada = index;
    renderizarVistasPrevias();
}

function renderizarVistasPrevias() {
    const container = document.getElementById('vistas-previas-container');
    if (!container) return;
    container.innerHTML = '';

    if (indicePrincipalSeleccionada >= archivosSeleccionadosParaSubir.length && archivosSeleccionadosParaSubir.length > 0) {
        indicePrincipalSeleccionada = 0;
    }

    archivosSeleccionadosParaSubir.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const thumbDiv = document.createElement('div');
            thumbDiv.className = "relative h-28 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden group shadow-md flex flex-col justify-between";
            
            const esPrincipal = (index === indicePrincipalSeleccionada);

            thumbDiv.innerHTML = `
                <div class="absolute inset-0">
                    <img src="${e.target.result}" class="w-full h-full object-cover">
                </div>
                
                <div class="relative z-10 p-1.5 flex justify-between items-start">
                    ${esPrincipal ? '<span class="bg-accentRed text-white text-[9px] px-2 py-0.5 rounded font-bold shadow">Principal ⭐</span>' : '<span></span>'}
                    <button type="button" onclick="eliminarFotoSeleccionada(${index})" class="bg-black/70 hover:bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors shadow" title="Borrar foto">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="relative z-10 bg-black/80 backdrop-blur-sm p-1.5 flex justify-between items-center text-xs text-white">
                    <button type="button" onclick="moverFoto(${index}, -1)" class="hover:text-accentYellow px-1.5 py-0.5 rounded bg-slate-800 ${index === 0 ? 'opacity-30 cursor-not-allowed' : ''}" title="Mover a la izquierda" ${index === 0 ? 'disabled' : ''}>
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    
                    <button type="button" onclick="hacerPrincipal(${index})" class="${esPrincipal ? 'text-accentYellow scale-110' : 'text-slate-400 hover:text-accentYellow'} transition-transform" title="Marcar como Principal">
                        <i class="fa-solid fa-star text-base"></i>
                    </button>

                    <button type="button" onclick="moverFoto(${index}, 1)" class="hover:text-accentYellow px-1.5 py-0.5 rounded bg-slate-800 ${index === archivosSeleccionadosParaSubir.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}" title="Mover a la derecha" ${index === archivosSeleccionadosParaSubir.length - 1 ? 'disabled' : ''}>
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
            `;
            container.appendChild(thumbDiv);
        }
        reader.readAsDataURL(file);
    });
}

// ==========================================
// MODALES Y ADMINISTRACIÓN
// ==========================================
async function abrirModalEditar(id) {
    const rep = listaRepuestos.find(r => r.id === id);
    if (!rep) return;

    document.getElementById('edit-rep-id').value = rep.id;
    document.getElementById('edit-rep-nombre').value = rep.nombre;
    document.getElementById('edit-rep-categoria').value = rep.categoria;
    document.getElementById('edit-rep-stock').value = rep.stock;
    document.getElementById('edit-rep-precio').value = rep.precio;
    document.getElementById('edit-rep-descripcion').value = rep.descripcion || '';
    
    const modalEdit = document.getElementById('edit-repuesto-modal');
    if (modalEdit) modalEdit.classList.remove('hidden');
}

function abrirModalEliminar(id) {
    document.getElementById('delete-rep-id').value = id;
    document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.add('hidden');
}

async function confirmarEliminarRepuesto() {
    const id = document.getElementById('delete-rep-id').value;
    closeDeleteModal();
    
    const { error } = await _supabase.from('repuestos').delete().eq('id', id);
    if (error) {
        mostrarToast("Error al eliminar: " + error.message, "error");
        return;
    }
    mostrarToast("Repuesto eliminado correctamente", "success");
    cargarRepuestos();
}

function abrirModalAgregar() {
    archivosSeleccionadosParaSubir = [];
    indicePrincipalSeleccionada = 0;
    renderizarVistasPrevias();
    document.getElementById('admin-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-repuesto-modal').classList.add('hidden');
}

function mostrarToast(mensaje, tipo = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl text-xs font-bold text-white shadow-2xl transition-all ${tipo === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`;
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function abrirModalAdmin() {
    const loginModal = document.getElementById('login-modal');
    if (loginModal) {
        document.getElementById('login-form').reset();
        document.getElementById('login-error-msg').classList.add('hidden');
        loginModal.classList.remove('hidden');
    }
}

function closeLoginModal() {
    const loginModal = document.getElementById('login-modal');
    if (loginModal) {
        loginModal.classList.add('hidden');
    }
}

// LOGIN CON RATE LIMITING (BLOQUEO DE 1 MINUTO)
async function handleLoginAdmin(e) {
    e.preventDefault();
    if (tiempoBloqueoLogin) return;

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorMsg = document.getElementById('login-error-msg');

    const { data, error } = await _supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        intentosLoginFallidos++;
        if (errorMsg) {
            errorMsg.textContent = `Credenciales incorrectas. Intentos: ${intentosLoginFallidos}/3`;
            errorMsg.classList.remove('hidden');
        }

        if (intentosLoginFallidos >= 3) {
            tiempoBloqueoLogin = true;
            const btnSubmit = document.querySelector('#login-form button[type="submit"]');
            if (btnSubmit) btnSubmit.disabled = true;

            let segundosRestantes = 60;
            if (errorMsg) errorMsg.textContent = `Demasiados intentos fallidos. Bloqueado por ${segundosRestantes}s.`;

            const intervalo = setInterval(() => {
                segundosRestantes--;
                if (errorMsg) errorMsg.textContent = `Demasiados intentos fallidos. Bloqueado por ${segundosRestantes}s.`;
                
                if (segundosRestantes <= 0) {
                    clearInterval(intervalo);
                    tiempoBloqueoLogin = false;
                    intentosLoginFallidos = 0;
                    if (btnSubmit) btnSubmit.disabled = false;
                    if (errorMsg) errorMsg.classList.add('hidden');
                }
            }, 1000);
        }
        return;
    }

    if (data.session) {
        intentosLoginFallidos = 0;
        closeLoginModal();
        activarModoAdmin();
        mostrarToast("Modo administrador activado", "success");
    }
}

function activarModoAdmin() {
    document.getElementById('admin-actions-bar').classList.remove('hidden');
    const adminOfertasActions = document.getElementById('admin-ofertas-actions');
    if (adminOfertasActions) adminOfertasActions.classList.remove('hidden');
    
    const authContainer = document.getElementById('auth-container');
    if (authContainer) {
        authContainer.innerHTML = `
            <span class="hidden sm:inline-block bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-xl text-xs font-bold">Admin Activo</span>
            <button onclick="cerrarSesionAdmin()" class="bg-slate-900 hover:bg-red-600/20 border border-slate-700 hover:border-red-500/40 text-slate-300 hover:text-red-400 px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2">
                <i class="fa-solid fa-right-from-bracket"></i> Cerrar Sesión
            </button>
        `;
    }
    actualizarPanelStock(listaRepuestos);
    renderRepuestos(listaRepuestos);
    renderOfertas(listaOfertas);
}

async function cerrarSesionAdmin() {
    await _supabase.auth.signOut();
    document.getElementById('admin-actions-bar').classList.add('hidden');
    const adminOfertasActions = document.getElementById('admin-ofertas-actions');
    if (adminOfertasActions) adminOfertasActions.classList.add('hidden');
    
    const authContainer = document.getElementById('auth-container');
    if (authContainer) {
        authContainer.innerHTML = '';
    }
    
    actualizarPanelStock(listaRepuestos);
    renderRepuestos(listaRepuestos);
    renderOfertas(listaOfertas);
    mostrarToast("Sesión cerrada correctamente", "success");
}

function enviarConsultaWeb(e) {
    e.preventDefault();
    const nombre = document.getElementById('consulta-nombre').value.trim();
    const mensaje = document.getElementById('consulta-mensaje').value.trim();

    const textoWp = `Hola Darío! Te escribo desde la web de Rep Motos.\n\n*Nombre:* ${nombre}\n*Consulta:* ${mensaje}`;
    const numeroDestino = '5493525615244';

    window.open(`https://wa.me/${numeroDestino}?text=${encodeURIComponent(textoWp)}`, '_blank');
}

function closeAdminModal() {
    const adminModal = document.getElementById('admin-modal');
    if (adminModal) {
        adminModal.classList.add('hidden');
    }
}

// ==========================================
// SOPORTE PARA ARRASTRAR Y PEGAR IMÁGENES
// ==========================================
document.addEventListener('paste', (e) => {
    const adminModal = document.getElementById('admin-modal');
    const adminOfertaModal = document.getElementById('admin-oferta-modal');
    
    if (adminModal && !adminModal.classList.contains('hidden')) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const archivoImagen = new File([blob], `imagen_pegada_${Date.now()}.png`, { type: blob.type });
                    archivosSeleccionadosParaSubir.push(archivoImagen);
                    renderizarVistasPrevias();
                    mostrarToast("Imagen pegada exitosamente", "success");
                }
            }
        }
    } else if (adminOfertaModal && !adminOfertaModal.classList.contains('hidden')) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const archivoImagen = new File([blob], `oferta_pegada_${Date.now()}.png`, { type: blob.type });
                    archivosOfertaParaSubir.push(archivoImagen);
                    renderizarVistasPreviasOferta();
                    mostrarToast("Imagen de oferta pegada", "success");
                }
            }
        }
    }
});

function manejarDropImagen(e) {
    e.preventDefault();
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) dropZone.classList.remove('border-accentRed');

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
            const file = e.dataTransfer.files[i];
            if (file.type.startsWith('image/')) {
                archivosSeleccionadosParaSubir.push(file);
            }
        }
        renderizarVistasPrevias();
        mostrarToast("Imágenes agregadas correctamente", "success");
    }
}

// ==========================================
// CONTROL DE VISIBILIDAD DEL BOTÓN "CATÁLOGO" EN CONTACTO
// ==========================================
window.addEventListener('scroll', () => {
    const seccionContacto = document.getElementById('contacto');
    const navCatalogoContacto = document.getElementById('nav-catalogo-contacto');
    
    if (!seccionContacto || !navCatalogoContacto) return;

    const rect = seccionContacto.getBoundingClientRect();
    
    if (rect.top <= 200 && rect.bottom >= 200) {
        navCatalogoContacto.classList.remove('hidden');
    } else {
        navCatalogoContacto.classList.add('hidden');
    }
});

// ==========================================
// VALIDACIÓN ESTRICTA EN AGREGAR REPUESTO
// ==========================================
async function handleAgregarRepuesto(e) {
    e.preventDefault();
    const nombre = document.getElementById('rep-nombre').value.trim();
    const categoria = document.getElementById('rep-categoria').value.trim();
    const stockStr = document.getElementById('rep-stock').value;
    const precio = document.getElementById('rep-precio').value.trim();
    const descripcion = document.getElementById('rep-descripcion').value.trim();
    const errorMsg = document.getElementById('form-error-msg');

    const stock = parseInt(stockStr);
    if (!nombre || !categoria || isNaN(stock) || stock < 0 || !precio || !descripcion || archivosSeleccionadosParaSubir.length === 0) {
        if (errorMsg) {
            errorMsg.textContent = "Por favor completá todos los campos correctamente (el stock no puede ser negativo y se requiere al menos una imagen).";
            errorMsg.classList.remove('hidden');
        }
        return;
    }
    if (errorMsg) errorMsg.classList.add('hidden');

    if (indicePrincipalSeleccionada > 0 && indicePrincipalSeleccionada < archivosSeleccionadosParaSubir.length) {
        const [fotoPrincipal] = archivosSeleccionadosParaSubir.splice(indicePrincipalSeleccionada, 1);
        archivosSeleccionadosParaSubir.unshift(fotoPrincipal);
        indicePrincipalSeleccionada = 0;
    }

    let urlsImagenes = [];

    for (let i = 0; i < archivosSeleccionadosParaSubir.length; i++) {
        const file = archivosSeleccionadosParaSubir[i];
        
        const fileOptimizado = await comprimirImagen(file);

        const fileName = `${Date.now()}_${i}_${fileOptimizado.name}`;
        const { error: uploadError } = await _supabase.storage
            .from('repuestos')
            .upload(fileName, fileOptimizado);

        if (uploadError) {
            mostrarToast("Error al subir imagen: " + uploadError.message, "error");
            return;
        }

        const { data: urlData } = _supabase.storage.from('repuestos').getPublicUrl(fileName);
        urlsImagenes.push(urlData.publicUrl);
    }

    const imagenesConcatenadas = urlsImagenes.join(',');

    const { error: insertError } = await _supabase.from('repuestos').insert([{
        nombre, categoria, stock, precio, descripcion, imagen: imagenesConcatenadas, destacado: false
    }]);

    if (insertError) {
        mostrarToast("Error al guardar repuesto: " + insertError.message, "error");
        return;
    }

    archivosSeleccionadosParaSubir = [];
    indicePrincipalSeleccionada = 0;
    renderizarVistasPrevias();
    closeAdminModal();
    document.getElementById('repuesto-form').reset();
    mostrarToast("Repuesto guardado con éxito", "success");
    cargarRepuestos();
}

// ==========================================
// VALIDACIÓN ESTRICTA EN EDITAR REPUESTO
// ==========================================
async function handleEditarRepuesto(e) {
    e.preventDefault();
    const id = document.getElementById('edit-rep-id').value;
    const nombre = document.getElementById('edit-rep-nombre').value.trim();
    const categoria = document.getElementById('edit-rep-categoria').value.trim();
    const stockStr = document.getElementById('edit-rep-stock').value;
    const precio = document.getElementById('edit-rep-precio').value.trim();
    const descripcion = document.getElementById('edit-rep-descripcion').value.trim();

    const stock = parseInt(stockStr);
    if (!id || !nombre || !categoria || isNaN(stock) || stock < 0 || !precio || !descripcion) {
        mostrarToast("Por favor completá todos los campos correctamente.", "error");
        return;
    }

    const { error } = await _supabase.from('repuestos').update({
        nombre, categoria, stock, precio, descripcion
    }).eq('id', id);

    if (error) {
        mostrarToast("Error al actualizar: " + error.message, "error");
        return;
    }

    closeEditModal();
    mostrarToast("Repuesto actualizado con éxito", "success");
    cargarRepuestos();
}

// ==========================================
// CIERRE DE SESIÓN AUTOMÁTICO POR INACTIVIDAD (15 MINUTOS)
// ==========================================
let temporizadorInactividad;
const TIEMPO_INACTIVIDAD_MS = 15 * 60 * 1000;

function reiniciarTemporizadorInactividad() {
    clearTimeout(temporizadorInactividad);
    
    const adminBar = document.getElementById('admin-actions-bar');
    if (adminBar && !adminBar.classList.contains('hidden')) {
        temporizadorInactividad = setTimeout(async () => {
            await cerrarSesionAdmin();
            mostrarToast("Sesión cerrada automáticamente por inactividad (15 min).", "error");
        }, TIEMPO_INACTIVIDAD_MS);
    }
}

['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evento => {
    window.addEventListener(evento, reiniciarTemporizadorInactividad);
});

// ==========================================
// MOSTRAR / OCULTAR CONTRASEÑA EN LOGIN
// ==========================================
function toggleMostrarPassword() {
    const inputPassword = document.getElementById('login-password');
    const eyeIcon = document.getElementById('eye-icon');
    
    if (!inputPassword || !eyeIcon) return;

    if (inputPassword.type === 'password') {
        inputPassword.type = 'text';
        eyeIcon.className = 'fa-solid fa-eye-slash text-sm text-accentYellow';
    } else {
        inputPassword.type = 'password';
        eyeIcon.className = 'fa-solid fa-eye text-sm';
    }
}

// ==========================================
// GESTIÓN DE STOCK EN TIEMPO REAL
// ==========================================
function actualizarPanelStock(lista) {
    const adminAlert = document.getElementById('admin-stock-alert');
    const alertText = document.getElementById('stock-alert-text');
    const esAdmin = document.getElementById('admin-actions-bar') && !document.getElementById('admin-actions-bar').classList.contains('hidden');

    if (!adminAlert || !esAdmin) {
        if (adminAlert) adminAlert.classList.add('hidden');
        return;
    }

    const sinStockCount = lista.filter(r => parseInt(r.stock) === 0).length;
    const stockBajoCount = lista.filter(r => parseInt(r.stock) > 0 && parseInt(r.stock) <= 2).length;

    const textoSinStock = sinStockCount === 1 ? '1 producto sin stock' : `${sinStockCount} productos sin stock`;
    const textoStockBajo = stockBajoCount === 1 ? '1 producto con stock crítico' : `${stockBajoCount} productos con stock crítico`;

    if (sinStockCount > 0 || stockBajoCount > 0) {
        adminAlert.classList.remove('hidden');
        alertText.innerHTML = `<span class="text-red-400 font-bold">${textoSinStock}</span> y <span class="text-amber-400 font-bold">${textoStockBajo}</span>.`;
    } else {
        adminAlert.classList.remove('hidden');
        alertText.innerHTML = `<span class="text-emerald-400 font-bold">Inventario saludable</span>. Todos los repuestos tienen stock óptimo.`;
    }
}

function toggleFiltroStockCritico() {
    const btnToggle = document.getElementById('btn-stock-toggle');
    
    if (!mostrandoSoloCriticos) {
        const criticos = listaRepuestos.filter(r => parseInt(r.stock) <= 2);
        renderRepuestos(criticos);
        
        mostrandoSoloCriticos = true;
        if (btnToggle) {
            btnToggle.textContent = "Ver stock completo";
            btnToggle.className = "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl text-xs font-semibold transition-colors";
        }
    } else {
        renderRepuestos(listaRepuestos);
        
        mostrandoSoloCriticos = false;
        if (btnToggle) {
            btnToggle.textContent = "Ver críticos";
            btnToggle.className = "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-4 py-2 rounded-xl text-xs font-semibold transition-colors";
        }
    }
}

// ==========================================
// ACTUALIZACIÓN DINÁMICA DE OPEN GRAPH (OG TAGS)
// ==========================================
function actualizarOpenGraph(repuesto = null) {
    const titleMeta = document.getElementById('og-title');
    const descMeta = document.getElementById('og-description');
    const imageMeta = document.getElementById('og-image');
    const urlMeta = document.getElementById('og-url');
    
    const twTitle = document.getElementById('twitter-title');
    const twDesc = document.getElementById('twitter-desc');
    const twImage = document.getElementById('twitter-image');

    if (repuesto) {
        const imagenesArray = repuesto.imagen ? repuesto.imagen.split(',').map(img => img.trim()).filter(img => img !== '') : [];
        const imgPrincipal = imagenesArray.length > 0 ? imagenesArray[0] : 'https://ochoamotos.com/img/REPMOTOS.png';
        const tituloTexto = `${repuesto.nombre} - REP MOTOS`;
        const descTexto = `Precio: $${formatearPrecio(repuesto.precio)} | Categoría: ${repuesto.categoria}. Consultá disponibilidad y stock.`;

        if (titleMeta) titleMeta.setAttribute('content', tituloTexto);
        if (descMeta) descMeta.setAttribute('content', descTexto);
        if (imageMeta) imageMeta.setAttribute('content', imgPrincipal);
        if (urlMeta) urlMeta.setAttribute('content', window.location.href);

        if (twTitle) twTitle.setAttribute('content', tituloTexto);
        if (twDesc) twDesc.setAttribute('content', descTexto);
        if (twImage) twImage.setAttribute('content', imgPrincipal);
    } else {
        const tituloDefault = "REP MOTOS - Catálogo y Stock de Repuestos";
        const descDefault = "Encontrá componentes de motor, transmisión, frenos y electricidad para tu moto con calidad garantizada y atención directa.";
        const imgDefault = "https://ochoamotos.com/img/REPMOTOS.png";

        if (titleMeta) titleMeta.setAttribute('content', tituloDefault);
        if (descMeta) descMeta.setAttribute('content', descDefault);
        if (imageMeta) imageMeta.setAttribute('content', imgDefault);
        if (urlMeta) urlMeta.setAttribute('content', window.location.href);

        if (twTitle) twTitle.setAttribute('content', tituloDefault);
        if (twDesc) twDesc.setAttribute('content', descDefault);
        if (twImage) twImage.setAttribute('content', imgDefault);
    }
}

// ==========================================
// FORMATEAR PRECIOS
// ==========================================
function formatearPrecio(precio) {
    const numero = parseFloat(precio);
    if (isNaN(numero)) return '0,00';
    
    return numero.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ==========================================
// CERRAR MODALES CON TECLA ESC
// ==========================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modalDetalle = document.getElementById('detalle-modal');
        const modalOfertaDetalle = document.getElementById('detalle-oferta-modal');
        const modalOfertaEdit = document.getElementById('edit-oferta-modal');
        
        if (modalDetalle && !modalDetalle.classList.contains('hidden')) {
            closeDetalleModal();
        }
        if (modalOfertaDetalle && !modalOfertaDetalle.classList.contains('hidden')) {
            closeDetalleOfertaModal();
        }
        if (modalOfertaEdit && !modalOfertaEdit.classList.contains('hidden')) {
            closeEditOfertaModal();
        }
    }
});

function toggleMenuMobile() {
    const menu = document.getElementById('menu-mobile');
    const icono = document.getElementById('icono-menu');
    if (!menu) return;

    menu.classList.toggle('hidden');
    if (menu.classList.contains('hidden')) {
        icono.className = "fa-solid fa-bars";
    } else {
        icono.className = "fa-solid fa-xmark";
    }
}