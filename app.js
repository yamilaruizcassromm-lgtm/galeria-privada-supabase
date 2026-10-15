// Importar el cliente de Supabase desde CDN
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// TODO: Reemplaza estos valores con tu URL y tu Anon Key de Supabase
const SUPABASE_URL = 'https://wvbmmhnmqzsdqdioczbe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2Ym1taG5tcXpzZHFkaW9jemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNDkyNzcsImV4cCI6MjEwNjcyNTI3N30.4tbsLLGvbvjbc-LnxUNDrjtO7P92hiW-fae4t9RRez4';

// Inicializar el cliente de Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Seleccionar elementos del DOM
const fileInput = document.getElementById("file-input");
const uploadBtn = document.getElementById("upload-btn");
const uploadMsg = document.getElementById("upload-msg");
const galleryGrid = document.getElementById("gallery-grid");
const userStatus = document.getElementById("user-status"); // Asegúrate de tener este elemento en tu HTML si deseas mostrar el estado

let currentUser = null;

// Verificar sesión activa al cargar la página
document.addEventListener("DOMContentLoaded", async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        if (userStatus) userStatus.textContent = `Conectado: ${currentUser.email}`;
        cargarGaleria();
    } else {
        if (userStatus) userStatus.textContent = "Modo invitado o sesión no iniciada.";
        // Si necesitas inicio de sesión anónimo o por correo, puedes gestionarlo aquí
    }
});

// Botón para subir imagen a Supabase Storage y registrarla en la base de datos
uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    
    if (!file) {
        alert("Por favor selecciona una imagen.");
        return;
    }

    if (!file.type.startsWith("image/")) {
        alert("El archivo debe ser una imagen válida.");
        return;
    }

    if (!currentUser) {
        alert("Debes iniciar sesión para subir imágenes.");
        return;
    }

    try {
        uploadMsg.textContent = "Subiendo imagen...";

        // 1. Crear ruta única en el Storage: /usuarios/{user_id}/{timestamp}_{nombre}
        const filePath = `usuarios/${currentUser.id}/${Date.now()}_${file.name}`;
        
        // Subir archivo al Storage de Supabase (asegúrate de tener un bucket llamado 'galeria' o el nombre que uses)
        const { data: storageData, error: storageError } = await supabase.storage
            .from('galeria') // Nombre de tu bucket en Supabase Storage
            .upload(filePath, file);

        if (storageError) throw storageError;

        // 2. Obtener la URL pública de la imagen
        const { data: urlData } = supabase.storage
            .from('galeria')
            .getPublicUrl(filePath);

        const imageUrl = urlData.publicUrl;

        // 3. Guardar el registro en la tabla SQL 'galeria_imagenes'
        const { error: dbError } = await supabase
            .from('galeria_imagenes')
            .insert([
                { 
                    user_id: currentUser.id, 
                    imagen_url: imageUrl, 
                    nombre_archivo: file.name 
                }
            ]);

        if (dbError) throw dbError;

        uploadMsg.textContent = "¡Imagen subida y guardada con éxito!";
        fileInput.value = "";
        cargarGaleria();
        
        setTimeout(() => {
            uploadMsg.textContent = "";
        }, 3000);

    } catch (error) {
        console.error("Error al procesar la imagen:", error.message);
        uploadMsg.textContent = "Error al subir la imagen: " + error.message;
    }
});

// Función para cargar y listar las imágenes del usuario desde Supabase
async function cargarGaleria() {
    galleryGrid.innerHTML = "";

    if (!currentUser) return;

    try {
        // Consultar la tabla filtrando por el usuario actual
        const { data: imagenes, error } = await supabase
            .from('galeria_imagenes')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!imagenes || imagenes.length === 0) {
            galleryGrid.innerHTML = "<p>No hay imágenes guardadas todavía.</p>";
            return;
        }

        imagenes.forEach((imgRecord) => {
            const img = document.createElement("img");
            img.src = imgRecord.imagen_url;
            img.alt = imgRecord.nombre_archivo;
            galleryGrid.appendChild(img);
        });

    } catch (error) {
        console.error("Error al cargar la galería:", error.message);
    }
};
