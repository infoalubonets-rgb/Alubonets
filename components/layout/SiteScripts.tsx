'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

function curveHtml(fill: string) {
  return `<div class="site-curve" aria-hidden="true"><svg viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false"><path d="M0,0 L1440,0 L1440,48 C1280,108 1120,18 960,62 C780,118 620,28 480,70 C300,120 160,36 0,78 Z" fill="${fill}"></path></svg></div>`
}

function detectCurveFill(): string {
  const main = document.querySelector('main')
  if (main) {
    let el = main.lastElementChild as HTMLElement | null
    while (el && el.classList?.contains('site-motto-band')) {
      el = el.previousElementSibling as HTMLElement | null
    }
    if (el) {
      const bg = window.getComputedStyle(el).backgroundColor
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg
    }
    const bodyBg = window.getComputedStyle(document.body).backgroundColor
    if (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)') return bodyBg
  }
  return '#f9f9f7'
}

function enhanceNavyCurve() {
  document.querySelectorAll('.footer-waves').forEach(n => n.remove())
  const fill = detectCurveFill()
  document.documentElement.style.setProperty('--site-curve-fill', fill)
  const motto = document.querySelector('.site-motto-band')
  const footers = document.querySelectorAll('footer')
  footers.forEach(footer => {
    footer.classList.add('site-footer')
    footer.querySelectorAll('.border-t').forEach(line => {
      line.classList.remove('border-t', 'border-on-primary/10', 'dark:border-on-primary-container/10')
    })
  })
  const curveHost = motto || footers[0]
  if (!curveHost) return
  curveHost.querySelectorAll('.site-curve').forEach(n => n.remove())
  curveHost.insertAdjacentHTML('afterbegin', curveHtml(fill))
  if (motto) {
    footers.forEach(footer => {
      footer.querySelectorAll('.site-curve').forEach(n => n.remove())
    })
  }
}

// Trigger CSS animations by toggling data-pr on <html>.
// Never mutate React-managed nodes (e.g. .reveal-left) — that causes hydration mismatches.
function triggerPageReveal() {
  const html = document.documentElement
  html.removeAttribute('data-pr')
  void html.offsetHeight // force reflow so CSS animations restart
  html.setAttribute('data-pr', '1')
}

export default function SiteScripts() {
  const pathname = usePathname()

  useEffect(() => {
    enhanceNavyCurve()
    triggerPageReveal()
    const onRefresh = () => triggerPageReveal()
    window.addEventListener('public-reveal-refresh', onRefresh)
    return () => window.removeEventListener('public-reveal-refresh', onRefresh)
  }, [pathname])

  return null
}
