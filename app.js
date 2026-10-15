// Como se carga por script global, usamos window.supabase
const SUPABASE_URL = 'https://wvbmmhnmqzsdqdioczbe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2Ym1taG5tcXpzZHFkaW9jemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNDkyNzcsImV4cCI6MjEwNjcyNTI3N30.4tbsLLGvbvjbc-LnxUNDrjtO7P92hiW-fae4t9RRez4';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Seleccionar elementos del DOM
const fileInput = document.getElementById("file-input");
const uploadBtn = document.getElementById("upload-btn");
const uploadMsg = document.getElementById("upload-msg");
const galleryGrid = document.getElementById("gallery-grid");
const userStatus = document.getElementById("user-status");

let currentUser = null;

// Verificar sesión activa o iniciar anónimamente
document.addEventListener("DOMContentLoaded", async () => {
    let { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
        if (!anonError) {
            session = anonData.session;
        }
    }

    if (session) {
        currentUser = session.user;
        if (userStatus) userStatus.textContent = `Conectado (ID: ${currentUser.id.substring(0, 6)}...)`;
        cargarGaleria();
    } else {
        if (userStatus) userStatus.textContent = "No se pudo iniciar sesión.";
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
        alert("No hay un usuario activo. Espera un momento o recarga la página.");
        return;
    }

    try {
        uploadMsg.textContent = "Subiendo imagen...";

        const filePath = `usuarios/${currentUser.id}/${Date.now()}_${file.name}`;
        
        const { data: storageData, error: storageError } = await supabase.storage
            .from('galeria')
            .upload(filePath, file);

        if (storageError) throw storageError;

        const { data: urlData } = supabase.storage
            .from('galeria')
            .getPublicUrl(filePath);

        const imageUrl = urlData.publicUrl;

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
        uploadMsg.textContent = "Error: " + error.message;
    }
});

// Función para cargar y listar las imágenes del usuario desde Supabase
async function cargarGaleria() {
    galleryGrid.innerHTML = "";

    if (!currentUser) return;

    try {
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
}
