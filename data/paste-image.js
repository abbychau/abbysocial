(function() {
  var forms = document.querySelectorAll('form[enctype="multipart/form-data"]');
  forms.forEach(function(form) {
    var textarea = form.querySelector('textarea[name="content"]');
    if (!textarea) return;
    
    textarea.addEventListener('paste', function(e) {
      var items = (e.clipboardData || e.originalEvent.clipboardData).items;
      
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          var blob = items[i].getAsFile();
          var fileName = 'pasted-image-' + Date.now() + '.png';
          
          var fileInputs = form.querySelectorAll('input[type="file"]');
          var targetInput = null;
          
          for (var j = 0; j < fileInputs.length; j++) {
            if (!fileInputs[j].files || fileInputs[j].files.length === 0) {
              targetInput = fileInputs[j];
              break;
            }
          }
          
          if (targetInput) {
            var dataTransfer = new DataTransfer();
            dataTransfer.items.add(new File([blob], fileName, { type: blob.type }));
            targetInput.files = dataTransfer.files;
            
            var feedback = document.createElement('div');
            feedback.style.cssText = 'background: #4CAF50; color: white; padding: 10px; margin: 10px 0; border-radius: 4px;';
            feedback.textContent = '✓ Image pasted: ' + fileName;
            targetInput.parentNode.insertBefore(feedback, targetInput);
            setTimeout(function() { feedback.style.opacity = '0'; setTimeout(function() { feedback.remove(); }, 300); }, 3000);
            
            var attDetails = targetInput.closest('details');
            if (attDetails && !attDetails.open) {
              attDetails.open = true;
            }
            targetInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            alert('All attachment slots are full. Please remove an attachment first.');
          }
          break;
        }
      }
    });
    
    textarea.addEventListener('focus', function() {
      this.setAttribute('title', 'You can paste images here (Ctrl+V or Cmd+V)');
    });
  });
})();
