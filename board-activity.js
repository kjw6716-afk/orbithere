(function () {
  'use strict';
  window.OrbitBoardActivity = {
    createReader: function (options) {
      var observer, generation = 0, timer, pending = new Set(), saved = new Set();
      var postId, actor, sending = false, failed = false;
      function reset() {
        generation++;
        clearTimeout(timer);
        if (observer) observer.disconnect();
        observer = null;
        pending.clear();
        saved.clear();
        sending = failed = false;
      }
      async function flush() {
        if (sending || failed || document.hidden || !pending.size || options.user() !== actor) return;
        var token = generation, currentActor = actor, ids = Array.from(pending).slice(0, 50);
        ids.forEach(function (id) { pending.delete(id); });
        sending = true;
        options.invalidate();
        try {
          var result = await options.client.rpc('mark_board_comments_read', { p_post_id: postId, p_comment_ids: ids });
          if (result.error) throw result.error;
          if (token !== generation || options.user() !== currentActor) return;
          ids.forEach(function (id) { saved.add(id); });
          options.changed();
        } catch (_) {
          if (token !== generation || options.user() !== currentActor) return;
          ids.forEach(function (id) { pending.add(id); });
          failed = true;
          options.error();
        } finally {
          if (token === generation) {
            sending = false;
            if (pending.size && !failed) timer = setTimeout(flush, 150);
          }
        }
      }
      function observe(root, id, rows) {
        reset();
        postId = id;
        actor = options.user();
        if (!actor || !window.IntersectionObserver) return;
        var token = generation;
        observer = new IntersectionObserver(function (entries) {
          if (token !== generation || document.hidden || options.user() !== actor) return;
          entries.forEach(function (entry) {
            var commentId = entry.target.id.slice('comment-'.length);
            if (!entry.isIntersecting || entry.intersectionRatio < 0.1 || saved.has(commentId)) return;
            pending.add(commentId);
            observer.unobserve(entry.target);
          });
          clearTimeout(timer);
          timer = setTimeout(flush, 150);
        }, { threshold: 0.1 });
        rows.filter(function (row) { return row.author_id !== actor; }).forEach(function (row) {
          var item = root.querySelector('#comment-' + row.id);
          if (item) observer.observe(item);
        });
      }
      return { reset: reset, observe: observe, retry: function () { failed = false; flush(); } };
    },
  };
})();
