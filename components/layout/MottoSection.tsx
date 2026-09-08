export default function MottoSection() {
  return (
    <section className="site-motto-band relative overflow-visible bg-primary px-md py-xl text-on-primary sm:py-xxl md:px-lg">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1.5px)',
          backgroundSize: '28px 28px',
          backgroundPosition: '14px 14px',
        }}
      />
      <div className="reveal relative z-10 mx-auto max-w-3xl text-center">
        <p className="font-h2 text-h2-mobile font-bold italic leading-tight md:text-h2">
          &ldquo;One Family, One Vision, Endless Possibilities.&rdquo;
        </p>
      </div>
    </section>
  )
}
