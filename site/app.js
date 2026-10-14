(function () {
  var deck = document.getElementById("deck");
  var slides = Array.prototype.slice.call(deck.querySelectorAll(".slide"));
  var pager = document.querySelector(".pager");
  var count = document.getElementById("count");
  var prev = document.getElementById("prev");
  var next = document.getElementById("next");
  var index = -1;

  function go(i, smooth) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    deck.scrollTo({ left: i * deck.clientWidth, behavior: smooth === false ? "auto" : "smooth" });
  }

  function update() {
    var i = Math.round(deck.scrollLeft / deck.clientWidth);
    if (i === index) return;
    index = i;
    count.textContent = i + 1 + " / " + slides.length;
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
    pager.classList.toggle("pager--start", i === 0);
    slides.forEach(function (s, n) {
      if (n === i) s.removeAttribute("inert");
      else s.setAttribute("inert", "");
    });
    history.replaceState(null, "", i === 0 ? location.pathname : "#sida-" + (i + 1));
  }

  var frame;
  deck.addEventListener("scroll", function () {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }, { passive: true });

  prev.addEventListener("click", function () { go(index - 1); });
  next.addEventListener("click", function () { go(index + 1); });

  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight") { go(index + 1); e.preventDefault(); }
    if (e.key === "ArrowLeft") { go(index - 1); e.preventDefault(); }
  });

  window.addEventListener("resize", function () { go(index, false); });

  var match = location.hash.match(/^#sida-(\d+)$/);
  if (match) go(parseInt(match[1], 10) - 1, false);
  update();
})();
