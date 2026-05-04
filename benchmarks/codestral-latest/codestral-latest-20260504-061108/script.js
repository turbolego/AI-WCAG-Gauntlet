document.addEventListener('DOMContentLoaded', function() {
    const openDialogButton = document.getElementById('open-dialog');
    const closeDialogButton = document.getElementById('close-dialog');
    const sampleDialog = document.getElementById('sample-dialog');

    openDialogButton.addEventListener('click', function() {
        sampleDialog.showModal();
    });

    closeDialogButton.addEventListener('click', function() {
        sampleDialog.close();
    });

    const canvas = document.getElementById('sample-canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Sample Canvas', canvas.width / 2, canvas.height / 2);
});