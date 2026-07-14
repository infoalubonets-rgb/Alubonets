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

function markReveals() {
  const main = document.querySelector('main')
  if (!main) return
  const blocks = main.querySelectorAll(':scope > section, :scope > div')
  blocks.forEach((block, i) => {
    if (block.classList.contains('site-motto-band')) return
    const cards = block.querySelectorAll(
      ':scope .grid > div, :scope .value-card, :scope article, :scope .break-inside-avoid'
    )
    if (cards.length) {
      cards.forEach((card, ki) => {
        if (card.classList.contains('reveal')) return
        card.classList.add('reveal')
        ;(card as HTMLElement).style.setProperty('--reveal-delay', Math.min(ki * 80, 320) + 'ms')
      })
      const heading = block.querySelector('h1, h2')
      if (heading && !heading.classList.contains('reveal')) {
        heading.classList.add('reveal')
        ;(heading as HTMLElement).style.setProperty('--reveal-delay', '0ms')
      }
    } else if (!block.classList.contains('reveal')) {
      block.classList.add('reveal')
      ;(block as HTMLElement).style.setProperty('--reveal-delay', Math.min(i * 60, 180) + 'ms')
    }
  })
}

function observeReveals() {
  const nodes = document.querySelectorAll('.reveal, .reveal-left, .reveal-scale')
  if (!nodes.length) return
  if (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    !('IntersectionObserver' in window)
  ) {
    nodes.forEach(n => n.classList.add('is-visible'))
    return
  }
  const io = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        io.unobserve(entry.target)
      })
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
  )
  nodes.forEach(n => {
    if (n.classList.contains('is-visible')) return
    const rect = n.getBoundingClientRect()
    if (rect.top < window.innerHeight * 0.9 && rect.bottom > 40) {
      n.classList.add('is-visible')
    } else {
      io.observe(n)
    }
  })
}

export default function SiteScripts() {
  const pathname = usePathname()

  useEffect(() => {
    enhanceNavyCurve()
    markReveals()
    observeReveals()
  }, [pathname])

  return null
}
