// Imagina que tu código original era algo así:
async function handleDelete() {
  const response = await fetch('/api/tu-endpoint', {
    method: 'DELETE', // <-- ESTA ES LA LÍNEA CORRECTA DENTRO DE SU CONTEXTO
    headers: {
      'Content-Type': 'application/json',
    },
  });
  // ... resto de tu lógica
}

// Y todo esto dentro de tu componente de página de React/Next.js
export default function GestorHcdPage() {
  return (
    <div>
      <h1>Gestor HCD</h1>
      <button onClick={handleDelete}>Borrar Algo</button>
      {/* ... resto de tu JSX */}
    </div>
  );
}