(function () {
  "use strict";

  /* ---------- 文字逐字出現：把每個字包成 <span class="char"> ---------- */
  // 英文等以空白分詞的語言：同一個單字的字母包在 .word 裡，避免換行時把單字拆開
  const WORD_PATTERN = /[A-Za-z0-9\u00C0-\u024F'’&.,:;!?\-]+|\s+|[\s\S]/gu;

  function splitChars(el, startIndex) {
    // <br> 視為換行（"\n"），其餘取純文字
    const text = Array.from(el.childNodes)
      .map(function (node) {
        return node.nodeName === "BR" ? "\n" : node.textContent;
      })
      .join("");
    el.setAttribute("aria-label", text.replace(/\n/g, " "));
    el.textContent = "";
    let i = 0;

    function makeChar(ch) {
      const span = document.createElement("span");
      span.className = "char";
      span.setAttribute("aria-hidden", "true");
      span.textContent = ch;
      span.style.setProperty("--i", startIndex + i);
      i++;
      return span;
    }

    (text.match(WORD_PATTERN) || []).forEach(function (token) {
      if (token.indexOf("\n") !== -1) {
        el.appendChild(document.createElement("br"));
      } else if (/^\s+$/.test(token)) {
        // 空白保留為一般文字，讓瀏覽器可在此換行
        el.appendChild(document.createTextNode(" "));
        i++;
      } else if (Array.from(token).length > 1) {
        const word = document.createElement("span");
        word.className = "word";
        word.setAttribute("aria-hidden", "true");
        Array.from(token).forEach(function (ch) {
          word.appendChild(makeChar(ch));
        });
        el.appendChild(word);
      } else {
        el.appendChild(makeChar(token));
      }
    });
    return startIndex + i;
  }

  // 同一個 section 裡的標題與敘述依序接續出現
  document.querySelectorAll("[data-reveal]").forEach(function (block) {
    let index = 0;
    block.querySelectorAll("[data-type]").forEach(function (el) {
      el.style.setProperty("--char-delay", "150ms");
      index = splitChars(el, index) + 2; // 換行間稍作停頓
    });
  });

  /* ---------- Section 進入畫面時淡入 ---------- */
  const revealObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
  );
  document.querySelectorAll("[data-reveal]").forEach(function (el) {
    revealObserver.observe(el);
  });

  /* ---------- Header：滑過第一個 section 後出現 ---------- */
  const header = document.getElementById("siteHeader");
  const hero = document.getElementById("hero");
  function updateHeader() {
    // 沒有 hero 的頁面（例如使用條款）header 一律顯示
    const heroBottom = hero ? hero.getBoundingClientRect().bottom : 0;
    header.classList.toggle("is-visible", heroBottom <= 0);
  }
  window.addEventListener("scroll", updateHeader, { passive: true });
  window.addEventListener("resize", updateHeader);
  updateHeader();

  /* ---------- 介面文字（依 <html lang> 切換） ---------- */
  const lang = (document.documentElement.lang || "").toLowerCase();
  const STRINGS = {
    zh: { copied: "已複製 ", copyFailed: "無法複製，請手動選取" },
    en: { copied: "Copied ", copyFailed: "Couldn't copy. Please select it manually." },
    ja: { copied: "コピーしました ", copyFailed: "コピーできませんでした。手動で選択してください。" },
  };
  const t = STRINGS[lang.split("-")[0]] || STRINGS.zh;

  /* ---------- 滾動顏文字 ---------- */
  const toast = document.getElementById("toast");
  let toastTimer;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 1600);
  }

  function copyText(text) {
    // 優先使用 Clipboard API；若不支援或被拒絕（例如部分 App 內建瀏覽器），改用舊方法
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () {
        return legacyCopy(text);
      });
    }
    return legacyCopy(text);
  }

  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy") ? resolve() : reject();
      } catch (e) {
        reject(e);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  const PX_PER_SECOND = 40; // 移動速度（px / 秒）

  document.querySelectorAll(".rolling__row").forEach(function (row) {
    const set = row.querySelector(".rolling__set");
    if (!set || !set.children.length) return;

    // 一條 track 內放兩組相同內容，移動 -50% 時即可無縫循環
    const track = document.createElement("div");
    track.className = "rolling__track";
    row.insertBefore(track, set);
    track.appendChild(set);

    // 若一組內容比畫面窄，就重複內容避免出現空白
    const originals = Array.from(set.children);
    let guard = 0;
    while (set.getBoundingClientRect().width < window.innerWidth + 200 && guard++ < 8) {
      originals.forEach(function (btn) {
        set.appendChild(btn.cloneNode(true));
      });
    }

    const clone = set.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll("button").forEach(function (btn) {
      btn.tabIndex = -1;
    });
    track.appendChild(clone);

    const width = set.getBoundingClientRect().width;
    track.style.setProperty("--duration", Math.round(width / PX_PER_SECOND) + "s");

    row.addEventListener("click", function (e) {
      const btn = e.target.closest(".kaomoji-btn");
      if (!btn) return;
      copyText(btn.textContent).then(
        function () {
          showToast(t.copied + btn.textContent);
        },
        function () {
          showToast(t.copyFailed);
        }
      );
    });
  });

  /* ---------- Hero 影片：系統開啟「減少動態效果」時不自動播放 ---------- */
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll(".hero-phone__video").forEach(function (video) {
      video.removeAttribute("autoplay");
      video.pause();
    });
  }

  /* ---------- 記住使用者在 footer 手動選擇的語言（首頁語言導向會優先使用） ---------- */
  document.querySelectorAll(".site-footer__lang a[data-lang]").forEach(function (link) {
    link.addEventListener("click", function () {
      try {
        localStorage.setItem("kaomojiru-lang", link.dataset.lang);
      } catch (e) {
        // 無痕模式等情況無法儲存時，忽略即可
      }
    });
  });

  /* ---------- 常見問題：點整列展開 / 收合 ---------- */
  document.querySelectorAll(".faq-item__question").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const item = btn.closest(".faq-item");
      const open = item.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    });
  });
})();
