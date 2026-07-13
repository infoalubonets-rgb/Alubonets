(function () {
  /* Soft Olipop-style top curve — page bg “bites” into navy */
  function curveHtml(fill) {
    return (
      '<div class="site-curve" aria-hidden="true">' +
      '<svg viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">' +
      '<path d="M0,0 L1440,0 L1440,48 C1280,108 1120,18 960,62 C780,118 620,28 480,70 C300,120 160,36 0,78 Z" fill="' +
      fill +
      '"></path>' +
      "</svg>" +
      "</div>"
    );
  }

  function detectCurveFill() {
    var main = document.querySelector("main");
    if (main) {
      var el = main.lastElementChild;
      while (el && el.classList && el.classList.contains("site-motto-band")) {
        el = el.previousElementSibling;
      }
      if (el) {
        var bg = window.getComputedStyle(el).backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
      }
      var bodyBg = window.getComputedStyle(document.body).backgroundColor;
      if (bodyBg && bodyBg !== "rgba(0, 0, 0, 0)") return bodyBg;
    }
    return "#f9f9f7";
  }

  function enhanceNavyCurve() {
    document.querySelectorAll(".footer-waves").forEach(function (n) {
      n.remove();
    });

    var fill = detectCurveFill();
    document.documentElement.style.setProperty("--site-curve-fill", fill);

    var motto = document.querySelector(".site-motto-band");
    var footers = document.querySelectorAll("footer");

    footers.forEach(function (footer) {
      footer.classList.add("site-footer");
      footer.querySelectorAll(".border-t").forEach(function (line) {
        line.classList.remove(
          "border-t",
          "border-on-primary/10",
          "dark:border-on-primary-container/10"
        );
      });
    });

    var curveHost = motto || footers[0];
    if (!curveHost) return;

    curveHost.querySelectorAll(".site-curve").forEach(function (n) {
      n.remove();
    });
    curveHost.insertAdjacentHTML("afterbegin", curveHtml(fill));

    /* Don't stack a second curve on footer when motto already has one */
    if (motto) {
      footers.forEach(function (footer) {
        footer.querySelectorAll(".site-curve").forEach(function (n) {
          n.remove();
        });
      });
    }
  }

  function markReveals() {
    var main = document.querySelector("main");
    if (!main) return;

    var blocks = main.querySelectorAll(":scope > section, :scope > div");
    blocks.forEach(function (block, i) {
      if (block.classList.contains("site-motto-band")) return;

      var cards = block.querySelectorAll(
        ":scope .grid > div, :scope .value-card, :scope article, :scope .break-inside-avoid"
      );

      if (cards.length) {
        cards.forEach(function (card, ki) {
          if (card.classList.contains("reveal")) return;
          card.classList.add("reveal");
          card.style.setProperty("--reveal-delay", Math.min(ki * 80, 320) + "ms");
        });
        var heading = block.querySelector("h1, h2");
        if (heading && !heading.classList.contains("reveal")) {
          heading.classList.add("reveal");
          heading.style.setProperty("--reveal-delay", "0ms");
        }
      } else if (!block.classList.contains("reveal")) {
        block.classList.add("reveal");
        block.style.setProperty("--reveal-delay", Math.min(i * 60, 180) + "ms");
      }
    });
  }

  function observeReveals() {
    var nodes = document.querySelectorAll(".reveal, .reveal-left, .reveal-scale");
    if (!nodes.length) return;

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      nodes.forEach(function (n) {
        n.classList.add("is-visible");
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );

    nodes.forEach(function (n) {
      if (n.classList.contains("is-visible")) return;
      var rect = n.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.9 && rect.bottom > 40) {
        n.classList.add("is-visible");
      } else {
        io.observe(n);
      }
    });
  }

  function setupPasswordToggles() {
    document.addEventListener(
      "click",
      function (e) {
        var btn = e.target.closest(".auth-password-toggle");
        if (!btn) return;
        var wrap = btn.closest(".auth-password-wrap");
        if (!wrap) return;
        var input = wrap.querySelector("input");
        var icon = btn.querySelector(".material-symbols-outlined");
        if (!input) return;
        var show = input.type === "password";
        input.type = show ? "text" : "password";
        if (icon) icon.textContent = show ? "visibility_off" : "visibility";
        btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      },
      true
    );
  }

  function boot() {
    enhanceNavyCurve();
    markReveals();
    observeReveals();
    setupPasswordToggles();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
