/* Local re-encoding keeps EXIF/GPS and original filenames out of uploads. */
(function () {
  'use strict';
  function blob(canvas, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (result) {
          if (result) resolve(result);
          else reject(new Error('사진을 변환하지 못했어요. 다른 사진을 선택해주세요.'));
        },
        'image/jpeg',
        quality,
      );
    });
  }
  async function prepare(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      throw new Error('JPG·PNG·WebP 사진만 첨부할 수 있어요.');
    if (file.size > 15 * 1024 * 1024) throw new Error('한 장에 15MB 이하인 사진을 선택해주세요.');
    var bitmap;
    try {
      if (typeof createImageBitmap === 'function')
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      else
        bitmap = await new Promise(function (resolve, reject) {
          var objectURL = URL.createObjectURL(file),
            img = new Image();
          img.onload = function () {
            img.width = img.naturalWidth;
            img.height = img.naturalHeight;
            img.close = function () {
              URL.revokeObjectURL(objectURL);
            };
            resolve(img);
          };
          img.onerror = function () {
            URL.revokeObjectURL(objectURL);
            reject(new Error('Invalid image'));
          };
          img.src = objectURL;
        });
    } catch (e) {
      throw new Error('이 사진을 읽을 수 없어요. JPG·PNG·WebP 파일을 다시 선택해주세요.');
    }
    try {
      if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40000000)
        throw new Error('4,000만 화소 이하의 사진을 선택해주세요.');
      async function resize(max, quality) {
        var scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        var ctx = canvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        var result = await blob(canvas, quality);
        while (result.size > 2097152 && quality > 0.4) {
          quality -= 0.1;
          result = await blob(canvas, quality);
        }
        canvas.width = canvas.height = 1;
        if (result.size > 2097152)
          throw new Error('사진 용량을 줄이지 못했어요. 더 작은 사진을 선택해주세요.');
        return result;
      }
      var full = await resize(2048, 0.88),
        thumb = await resize(200, 0.76);
      return { full: full, thumb: thumb, url: URL.createObjectURL(thumb), name: file.name };
    } finally {
      bitmap.close();
    }
  }
  window.OrbitBoardMedia = {
    prepare: prepare,
    thumbnail: function (path) {
      return path.replace(/\.jpg$/, '.thumb.jpg');
    },
  };
})();
