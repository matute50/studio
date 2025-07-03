
"use client"; 

import React, { useState } from 'react'; 

export default function GestorHcdPage() {
  
  const handleClick = () => {
    console.log("Botón presionado!");
  };

  return (
    <div>
      <h1>Gestor HCD</h1>
      <button onClick={handleClick}>Acción Interactiva</button>
    </div>
  );
}