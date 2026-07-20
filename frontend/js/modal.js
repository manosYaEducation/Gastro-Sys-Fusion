/**
 * Lógica del Modal de Personalización (US-H1.3)
 */
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('customization-modal');
  const overlay = document.getElementById('custom-modal-overlay');
  const closeBtn = document.getElementById('custom-modal-close');
  const addBtn = document.getElementById('modal-add-btn');
  
  const titleEl = document.getElementById('modal-dish-name');
  const descEl = document.getElementById('modal-dish-desc');
  const priceEl = document.getElementById('modal-total-price');
  const modifiersContainer = document.getElementById('modal-modifiers-container');
  const notesEl = document.getElementById('modal-notes');
  const notesCounterEl = document.getElementById('modal-notes-counter');
  const notesCounter = document.getElementById('modal-notes-counter');
  const MAX_NOTES = 250;

  let currentDish = null;
  
  
  function formatMoney(value) {
    return '$' + Number(value).toLocaleString('es-CL');
  }
/**
 * caracter limit
 */
 function updateNotesCounter() {
  const max = notesEl.maxLength;
  const remaining = max - notesEl.value.length;

  notesCounterEl.textContent = remaining;

  if (remaining <= 20) {
    notesCounterEl.style.color = '#dc3545'; // rojo
  } else if (remaining <= 50) {
    notesCounterEl.style.color = '#fd7e14'; // naranja
  } else {
    notesCounterEl.style.color = '';
  }
}

  // Calculate and update total price
  function updatePrice() {
    if (!currentDish) return;
    let total = parseFloat(currentDish.precio) || 0;
    
    // Add selected modifiers
    const inputs = modifiersContainer.querySelectorAll('input:checked');
    inputs.forEach(input => {
      total += parseInt(input.dataset.price || 0, 10);
    });
    
    priceEl.textContent = formatMoney(total);
    return total;
  }

  // Open Modal function (exposed globally so menu.html can call it)
  window.openCustomizationModal = function(dishData) {
    currentDish = dishData;
    
    // Set basic info
    titleEl.textContent = dishData.nombre;
    descEl.textContent = dishData.descripcion;
    notesEl.value = '';
    updateNotesCounter();

    
    // Clear old modifiers
    modifiersContainer.innerHTML = '';
    
    // Build modifiers if they exist
    if (dishData.modificadores && dishData.modificadores.length > 0) {
      dishData.modificadores.forEach(mod => {
        const isMultiple = mod.multiple;
        const inputType = isMultiple ? 'checkbox' : 'radio';
        
        const groupDiv = document.createElement('div');
        groupDiv.className = 'custom-modifier';
        
        const reqBadge = mod.requerido 
          ? '<span class="custom-modifier__req-badge">Obligatorio</span>'
          : '<span class="custom-modifier__req-badge custom-modifier__req-badge--optional">Opcional</span>';
          
        groupDiv.innerHTML = `
          <div class="custom-modifier__header">
            <h3 class="custom-modifier__title">${mod.nombre}</h3>
            ${reqBadge}
          </div>
          <div class="custom-modifier__options"></div>
        `;
        
        const optionsContainer = groupDiv.querySelector('.custom-modifier__options');
        
        mod.opciones.forEach((opt, idx) => {
          const label = document.createElement('label');
          label.className = 'custom-option-label';
          
          const priceText = opt.precio > 0 ? `+${formatMoney(opt.precio)}` : '';
          
          // Select first by default if required and single choice
          const checkedAttr = (mod.requerido && !isMultiple && idx === 0) ? 'checked' : '';
          
          label.innerHTML = `
            <div class="custom-option-name">
              <input type="${inputType}" name="mod_${mod.id}" value="${opt.id}" data-price="${opt.precio}" ${checkedAttr}>
              <span class="custom-option-icon"></span>
              ${opt.nombre}
            </div>
            <span class="custom-option-price">${priceText}</span>
          `;
          
          // Listen for changes to update total price
          label.querySelector('input').addEventListener('change', updatePrice);
          
          optionsContainer.appendChild(label);
        });
        
        modifiersContainer.appendChild(groupDiv);
      });
    }

    updatePrice();
    modal.classList.add('custom-modal--open');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  };

  // Close Modal
  function closeModal() {
    modal.classList.remove('custom-modal--open');
    document.body.style.overflow = '';
    currentDish = null;
  }

  // Event Listeners for closing
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay) overlay.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('custom-modal--open')) {
      closeModal();
    }
  });
if (notesEl) {
  notesEl.addEventListener('input', updateNotesCounter);
}
  // Add to Cart
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (!currentDish) return;
      
      // Validate required modifiers
      let isValid = true;
      if (currentDish.modificadores) {
        currentDish.modificadores.forEach(mod => {
          if (mod.requerido && !mod.multiple) {
            const selected = modifiersContainer.querySelector(`input[name="mod_${mod.id}"]:checked`);
            if (!selected) {
              isValid = false;
              alert(`Por favor, selecciona una opción para: ${mod.nombre}`);
            }
          }
        });
      }
      
      if (!isValid) return;

      // Build the final object
      const finalPrice = updatePrice();
      const selectedMods = [];
      
      const checkedInputs = modifiersContainer.querySelectorAll('input:checked');
      checkedInputs.forEach(input => {
        const groupName = input.name.replace('mod_', '');
        selectedMods.push({
          grupo: groupName,
          opcion_id: input.value,
          precio_extra: parseInt(input.dataset.price || 0, 10)
        });
      });

      const cartItem = {
        plato_id: currentDish.id,
        nombre: currentDish.nombre,
        precio_base: currentDish.precio,
        precio_total: finalPrice,
        modificadores: selectedMods,
        notas: notesEl.value.trim()
      };

      console.log('✅ PLATO LISTO PARA EL CARRITO (US-1.2):');
      console.log(JSON.stringify(cartItem, null, 2));

// Guardar en localStorage y preguntar si se reemplaza o acumula el pedido
try {
  let currentCart = JSON.parse(localStorage.getItem('gastro_cart') || '[]');

  if (currentCart.length > 0) {
    const reemplazar = confirm(
      'Ya existen productos en tu carrito.\n\n' +
      '¿Deseas reemplazar el pedido actual?\n\n' +
      'Aceptar = Reemplazar\n' +
      'Cancelar = Acumular'
    );

    if (reemplazar) {
      currentCart = [cartItem];
    } else {
      currentCart.push(cartItem);
    }
  } else {
    currentCart.push(cartItem);
  }

  // Guardar carrito y marca de tiempo
  localStorage.setItem('gastro_cart', JSON.stringify(currentCart));
  localStorage.setItem('gastro_cart_timestamp', Date.now());

  // Notificar al widget del carrito
  window.dispatchEvent(new CustomEvent('cart-updated'));

} catch (e) {
  console.error('Error al guardar en el carrito:', e);
}
      
      const originalText = addBtn.innerHTML;
      addBtn.innerHTML = '¡Agregado! ✓';
      addBtn.style.background = '#4CAF50';
      addBtn.style.color = '#fff';
      
      setTimeout(() => {
        closeModal();
       
        setTimeout(() => {
          addBtn.innerHTML = originalText;
          addBtn.style.background = '';
          addBtn.style.color = '';
        }, 300);
      }, 800);
    });
  }

});
