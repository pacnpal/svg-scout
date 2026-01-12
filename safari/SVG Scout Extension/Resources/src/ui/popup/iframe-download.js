// Safari download helper - runs inside an iframe to bypass popup download restrictions
function downloadFile(filename, dataUrl) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

window.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'DOWNLOAD') {
    downloadFile(event.data.filename, event.data.dataUrl);
  }
}, false);
