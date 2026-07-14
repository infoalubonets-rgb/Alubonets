export default function MottoSection() {
  return (
    <section className="site-motto-band bg-primary text-on-primary py-xxl px-lg relative overflow-visible">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1.5px)',
          backgroundSize: '28px 28px',
          backgroundPosition: '14px 14px',
        }}
      />
      <div className="max-w-3xl mx-auto text-center relative z-10">
        <p className="font-h2 text-h2-mobile md:text-h2 font-bold italic leading-tight">
          &ldquo;One Family, One Vision, Endless Possibilities.&rdquo;
        </p>
      </div>
    </section>
  )
}
