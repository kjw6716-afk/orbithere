(function () {
    var form = document.getElementById('observingChecklist');
    if (!form) return;
    var progress = document.getElementById('checkProgress');
    function update() {
        var count = form.querySelectorAll('input:checked').length;
        progress.textContent = count + ' / 5 준비 완료';
    }
    form.addEventListener('change', update);
    form.addEventListener('reset', function () { setTimeout(update, 0); });
    update();
})();
