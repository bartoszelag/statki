const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315]

export default function Explosion() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      style={{ overflow: 'visible' }}
    >
      {/* rozbłysk jądra */}
      <div
        className="exp-core absolute inset-0 rounded-sm"
        style={{
          background:
            'radial-gradient(circle, rgba(255,230,100,1) 0%, rgba(255,100,0,0.85) 50%, transparent 100%)',
        }}
      />

      {/* pierścień fali uderzeniowej */}
      <div
        className="exp-ring absolute rounded-full"
        style={{
          inset: '-60%',
          border: '2px solid rgba(255,140,0,0.7)',
        }}
      />

      {/* iskry radialne */}
      {SPARKS.map((angle) => {
        const rad = (angle * Math.PI) / 180
        const tx = Math.cos(rad) * 18
        const ty = Math.sin(rad) * 18
        return (
          <div
            key={angle}
            className="exp-spark absolute rounded-full"
            style={
              {
                width: 3,
                height: 3,
                top: '50%',
                left: '50%',
                marginTop: -1.5,
                marginLeft: -1.5,
                background: 'rgba(255, 200, 50, 1)',
                '--tx': `${tx}px`,
                '--ty': `${ty}px`,
              } as React.CSSProperties
            }
          />
        )
      })}
    </div>
  )
}
