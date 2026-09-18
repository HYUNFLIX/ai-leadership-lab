/*!
 * scroll-reveal.js — 프레임워크 없는 등장 애니메이션(scroll-reveal 스킬). reveal.css와 짝.
 * React가 아닌 곳(정적 HTML, Vue, Svelte, Astro, 서버 템플릿)에서 쓴다.
 *
 * 설치: </body> 바로 앞에
 *   <script src="/scroll-reveal.js" defer></script>
 *   범위를 바꾸려면 data-scope:  <script src="/scroll-reveal.js" data-scope="#app" defer></script>
 * 표시: <section data-reveal="up" style="--reveal-order: 3">…</section>
 *       <h2 data-reveal="line"><span class="reveal-text">구역 제목</span></h2>
 * SPA에서 화면을 바꾼 뒤에도 자동으로 따라간다(MutationObserver). 수동으로 다시 살피려면 window.ScrollReveal.refresh()
 *
 * 첫 화면 등장은 CSS 키프레임이 맡고, 여기서는 첫 화면 아래 요소를 스크롤에 맞춰 띄운다.
 * 상태는 data-reveal-state(pending → in → done). 움직임 줄이기 설정이면 아무것도 숨기지 않는다.
 */
;(function () {
  'use strict'
  var STEP = 110 // 스크롤 등장 간격(ms)
  var MAX_STEPS = 5 // 한꺼번에 들어와도 최대 0.55초만 기다리게
  var DONE_AFTER = 1100 // 전환이 끝난 뒤 done으로 바꾸는 시점(ms)
  var NAMES = { 'reveal-rise': 1, 'reveal-line': 1 }
  var SEL = '[data-reveal]'
  var me = document.currentScript
  var scopeSelector = (me && me.getAttribute('data-scope')) || 'main'

  function stateOf(el) {
    return el.getAttribute('data-reveal-state')
  }
  function collect(root) {
    return Array.prototype.slice.call(root.querySelectorAll(SEL))
  }
  /** 키프레임이 도는 중이면 transform만큼 내려가 있으므로 그만큼 빼서 제자리 위치를 잰다 */
  function layoutTop(el) {
    var top = el.getBoundingClientRect().top
    var t = getComputedStyle(el).transform
    if (!t || t === 'none' || typeof DOMMatrixReadOnly === 'undefined') return top
    return top - new DOMMatrixReadOnly(t).m42
  }
  function stillAnimating(el) {
    if (!el.getAnimations) return false
    return el.getAnimations({ subtree: true }).some(function (a) {
      return a.animationName && NAMES[a.animationName] && a.playState !== 'finished'
    })
  }

  function init() {
    var scope = document.querySelector(scopeSelector) || document.body
    if (!('IntersectionObserver' in window) || !('MutationObserver' in window)) return
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    function finish(el) {
      el.setAttribute('data-reveal-state', 'done')
      el.style.removeProperty('--reveal-delay')
    }
    function show(el, delay) {
      io.unobserve(el)
      el.style.setProperty('--reveal-delay', delay + 'ms')
      el.setAttribute('data-reveal-state', 'in')
      setTimeout(function () {
        if (stateOf(el) === 'in') finish(el)
      }, delay + DONE_AFTER)
    }
    // 위→아래, 같은 줄은 왼쪽부터
    function showInOrder(els) {
      els
        .map(function (el) {
          return { el: el, r: el.getBoundingClientRect() }
        })
        .sort(function (a, b) {
          return a.r.top - b.r.top || a.r.left - b.r.left
        })
        .forEach(function (x, i) {
          show(x.el, Math.min(i, MAX_STEPS) * STEP)
        })
    }

    var io = new IntersectionObserver(
      function (entries) {
        var entering = entries.filter(function (e) {
          return e.isIntersecting
        })
        // 크게 건너뛰어 이미 위로 지나친 요소는 순서 없이 바로
        entering
          .filter(function (e) {
            return e.boundingClientRect.top < 0
          })
          .forEach(function (e) {
            show(e.target, 0)
          })
        showInOrder(
          entering
            .filter(function (e) {
              return e.boundingClientRect.top >= 0
            })
            .map(function (e) {
              return e.target
            }),
        )
      },
      // 화면 맨 아래에서 움직이면 눈에 잘 안 띈다. 아래 12% 선을 넘어와야 띄운다
      { rootMargin: '0px 0px -12% 0px', threshold: 0.1 },
    )

    // 첫 화면(40px 이상 보임)은 키프레임에 맡기고 끝나면 done, 그 아래는 pending으로 멈춘다
    function process(els) {
      var fold = window.innerHeight - 40
      els.forEach(function (el) {
        if (stateOf(el)) return
        if (el.getBoundingClientRect().height > 0 && layoutTop(el) >= fold) {
          el.setAttribute('data-reveal-state', 'pending')
          io.observe(el)
          return
        }
        if (!stillAnimating(el)) finish(el)
      })
    }

    // 첫 화면 키프레임이 끝나면 애니메이션을 떼어 낸다(남아 있으면 요소마다 층이 생겨 드롭다운이 카드 밑에 깔린다)
    scope.addEventListener('animationend', function (e) {
      if (!NAMES[e.animationName]) return
      var el = e.target.closest && e.target.closest(SEL)
      if (el && !stateOf(el)) finish(el)
    })

    process(collect(scope))

    // 화면 전환·지연 로딩으로 나중에 붙는 요소
    new MutationObserver(function (records) {
      var added = []
      records.forEach(function (r) {
        Array.prototype.forEach.call(r.addedNodes, function (n) {
          if (n.nodeType !== 1) return
          if (n.matches(SEL)) added.push(n)
          added.push.apply(added, collect(n))
        })
        Array.prototype.forEach.call(r.removedNodes, function (n) {
          if (n.nodeType !== 1) return
          if (n.matches(SEL)) io.unobserve(n)
          collect(n).forEach(function (x) {
            io.unobserve(x)
          })
        })
      })
      if (added.length) process(added)
    }).observe(scope, { childList: true, subtree: true })

    // 페이지 맨 끝 요소는 12% 선을 못 넘을 수 있다. 바닥에 닿으면 보이는 것을 모두 띄운다
    var raf = 0
    window.addEventListener(
      'scroll',
      function () {
        if (raf) return
        raf = requestAnimationFrame(function () {
          raf = 0
          if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 4) return
          showInOrder(
            collect(scope).filter(function (el) {
              return stateOf(el) === 'pending' && el.getBoundingClientRect().top < window.innerHeight
            }),
          )
        })
      },
      { passive: true },
    )

    window.ScrollReveal = {
      refresh: function () {
        process(collect(scope))
      },
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()
