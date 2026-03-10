import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Menu, X, ArrowRight, Zap, ChevronLeft, ChevronRight, BarChart3, Mail, ShoppingBag, Bot, MessageSquare, CircleCheckBig } from 'lucide-react'

// Intersection Observer hook for scroll animations
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.unobserve(el) }
    }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

// Animated wrapper — slides up + fades in when scrolled into view
function AnimateIn({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useInView()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  )
}


const getAppUrl = (path: string) => {
  const h = window.location.hostname
  if (h === 'localhost' || h === '127.0.0.1') return path
  return `https://app.replyna.me${path}`
}

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [heroLine1, setHeroLine1] = useState('')
  const [heroLine2, setHeroLine2] = useState('')
  const [heroVisible, setHeroVisible] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  // Floating Lines shader (blue glowing lines on black)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false })
    if (!gl) return
    let animId = 0
    const startTime = performance.now()
    let tMx = -1000, tMy = -1000, cMx = -1000, cMy = -1000
    let tInf = 0, cInf = 0, tPx = 0, tPy = 0, cPx = 0, cPy = 0

    const vertSrc = `attribute vec2 a_pos; void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }`
    const fragSrc = `
precision mediump float;
uniform float iTime;
uniform vec3 iResolution;
uniform vec2 iMouse;
uniform float bendInfluence;
uniform vec2 parallaxOffset;
uniform vec3 lineGradient[4];

mat2 rotate(float r) { return mat2(cos(r), sin(r), -sin(r), cos(r)); }

vec3 getLineColor(float t) {
  float ct = clamp(t, 0.0, 0.9999);
  float s = ct * 3.0;
  int idx = int(floor(s));
  float f = fract(s);
  vec3 c1, c2;
  if (idx == 0) { c1 = lineGradient[0]; c2 = lineGradient[1]; }
  else if (idx == 1) { c1 = lineGradient[1]; c2 = lineGradient[2]; }
  else { c1 = lineGradient[2]; c2 = lineGradient[3]; }
  return mix(c1, c2, f) * 0.5;
}

float wave(vec2 uv, float offset, vec2 screenUv, vec2 mouseUv) {
  float time = iTime * 0.8;
  float amp = sin(offset + time * 0.2) * 0.3;
  float y = sin(uv.x + offset + time * 0.1) * amp;
  vec2 d = screenUv - mouseUv;
  y += (mouseUv.y - screenUv.y) * exp(-dot(d, d) * 5.0) * -0.5 * bendInfluence;
  return 0.0175 / max(abs(uv.y - y) + 0.01, 1e-3) + 0.01;
}

void main() {
  vec2 baseUv = (2.0 * gl_FragCoord.xy - iResolution.xy) / iResolution.y;
  baseUv.y *= -1.0;
  baseUv += parallaxOffset;
  vec2 mouseUv = (2.0 * iMouse - iResolution.xy) / iResolution.y;
  mouseUv.y *= -1.0;
  vec3 col = vec3(0.0);
  float len = length(baseUv);

  float a1 = -1.0 * log(len + 1.0);
  mat2 r1 = rotate(a1);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    col += getLineColor(fi / 3.0) * wave(baseUv * r1 + vec2(0.08 * fi + 2.0, -0.7), 1.5 + 0.2 * fi, baseUv, mouseUv) * 0.2;
  }
  float a2 = 0.2 * log(len + 1.0);
  mat2 r2 = rotate(a2);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    col += getLineColor(fi / 5.0) * wave(baseUv * r2 + vec2(0.05 * fi + 5.0, 0.0), 2.0 + 0.15 * fi, baseUv, mouseUv);
  }
  float a3 = -0.4 * log(len + 1.0);
  mat2 r3 = rotate(a3);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 ruv = baseUv * r3; ruv.x *= -1.0;
    col += getLineColor(fi / 2.0) * wave(ruv + vec2(0.1 * fi + 10.0, 0.5), 1.0 + 0.2 * fi, baseUv, mouseUv) * 0.1;
  }

  col = pow(col, vec3(1.5));
  gl_FragColor = vec4(col, 1.0);
}
`
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error('Shader:', gl.getShaderInfoLog(s))
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertSrc))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc))
    gl.linkProgram(prog); gl.useProgram(prog)

    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uT = gl.getUniformLocation(prog, 'iTime')
    const uR = gl.getUniformLocation(prog, 'iResolution')
    const uM = gl.getUniformLocation(prog, 'iMouse')
    const uBI = gl.getUniformLocation(prog, 'bendInfluence')
    const uPX = gl.getUniformLocation(prog, 'parallaxOffset')

    const colors = [[0.235,0.337,0.484],[0.314,0.345,0.612],[0.388,0.424,0.796],[0.431,0.549,0.984]]
    for (let i = 0; i < 4; i++) gl.uniform3f(gl.getUniformLocation(prog, `lineGradient[${i}]`), colors[i][0], colors[i][1], colors[i][2])

    let resizeTimer: ReturnType<typeof setTimeout>
    const resize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const d = Math.min(devicePixelRatio, 1.5)
        canvas.width = canvas.offsetWidth * d; canvas.height = canvas.offsetHeight * d
        gl.viewport(0, 0, canvas.width, canvas.height)
      }, 100)
    }
    const d = Math.min(devicePixelRatio, 1.5)
    canvas.width = canvas.offsetWidth * d; canvas.height = canvas.offsetHeight * d
    gl.viewport(0, 0, canvas.width, canvas.height)
    window.addEventListener('resize', resize)

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect(), ratio = canvas.width / r.width
      tMx = (e.clientX - r.left) * ratio; tMy = (r.height - (e.clientY - r.top)) * ratio
      tInf = 1.0
      tPx = ((e.clientX - r.left) - r.width / 2) / r.width * 0.15
      tPy = -((e.clientY - r.top) - r.height / 2) / r.height * 0.15
    }
    const onLeave = () => { tInf = 0 }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)

    const render = () => {
      cMx += (tMx - cMx) * 0.05; cMy += (tMy - cMy) * 0.05
      cInf += (tInf - cInf) * 0.05; cPx += (tPx - cPx) * 0.05; cPy += (tPy - cPy) * 0.05
      gl.uniform1f(uT, (performance.now() - startTime) * 0.001)
      gl.uniform3f(uR, canvas.width, canvas.height, 1)
      gl.uniform2f(uM, cMx, cMy); gl.uniform1f(uBI, cInf); gl.uniform2f(uPX, cPx, cPy)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      animId = requestAnimationFrame(render)
    }
    render()
    return () => {
      cancelAnimationFrame(animId); clearTimeout(resizeTimer)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  // Typewriter text animation
  useEffect(() => {
    const t1 = 'Seus clientes reclamam.'
    const t2 = 'A IA resolve em segundos.'
    let i1 = 0, i2 = 0, phase = 1
    const delay = setTimeout(() => {
      const iv = setInterval(() => {
        if (phase === 1) {
          i1++; setHeroLine1(t1.slice(0, i1))
          if (i1 >= t1.length) phase = 2
        } else {
          i2++; setHeroLine2(t2.slice(0, i2))
          if (i2 >= t2.length) clearInterval(iv)
        }
      }, 55)
      return () => clearInterval(iv)
    }, 600)
    return () => clearTimeout(delay)
  }, [])

  // Staggered entrance
  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 200)
    return () => clearTimeout(t)
  }, [])

  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault(); setMobileMenuOpen(false)
    const el = document.getElementById(id)
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 80, behavior: 'smooth' })
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000', color: '#fff', fontFamily: '"Inter", "Segoe UI", sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes heroFadeUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        .lp-hero-fadeup { opacity: 0; animation: heroFadeUp 1s cubic-bezier(0.16,1,0.3,1) forwards; }
        @media (max-width: 768px) {
          .lp-hero-section {
            min-height: auto !important;
            align-items: flex-start !important;
            justify-content: flex-start !important;
            padding-top: 120px !important;
            padding-bottom: 60px !important;
          }
          .lp-hero-content {
            padding: 32px 28px !important;
            width: 100% !important;
            text-align: center !important;
            align-items: center !important;
            margin-bottom: 0 !important;
            background: radial-gradient(ellipse 120% 100% at 50% 50%, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 60%, transparent 100%);
            border-radius: 24px;
          }
          .lp-hero-content h1 {
            font-size: clamp(1.9rem, 8vw, 2.5rem) !important;
            line-height: 1.2 !important;
            text-shadow: 0 2px 40px rgba(0,0,0,0.9), 0 0 80px rgba(0,0,0,0.5) !important;
          }
          .lp-hero-content p {
            font-size: 15px !important;
            max-width: 100% !important;
            margin-top: 20px !important;
            line-height: 1.7 !important;
            color: rgba(255,255,255,0.85) !important;
            text-shadow: 0 1px 20px rgba(0,0,0,0.8) !important;
          }
          .lp-hero-btns {
            justify-content: center !important;
            margin-top: 32px !important;
            gap: 12px !important;
          }
          .lp-hero-btns a {
            padding: 14px 24px !important;
            font-size: 14px !important;
          }
        }
        .lp-nav-link { color: rgba(255,255,255,0.6); text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; position: relative; }
        .lp-nav-link:hover { color: #fff; }
        .lp-nav-link::after { content: ''; position: absolute; bottom: -4px; left: 0; width: 0; height: 2px; background: linear-gradient(90deg, #4672ec, #8b5cf6); transition: width 0.3s; }
        .lp-nav-link:hover::after { width: 100%; }
        .lp-btn-primary { position: relative; overflow: hidden; transition: all 0.3s cubic-bezier(0.16,1,0.3,1); background: linear-gradient(135deg, #4672ec 0%, #3b5fd9 100%); }
        .lp-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(70,114,236,0.4); }
        @media (max-width: 768px) {
          .lp-nav-desktop { display: none !important; }
          .lp-nav-mobile-toggle { display: flex !important; }
          .lp-grid-3 { grid-template-columns: 1fr !important; }
          .lp-grid-2 { grid-template-columns: 1fr !important; }
          .lp-section { padding: 40px 20px !important; }
        }
        .lp-section-label {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 6px 14px; border-radius: 9999px;
          background: rgba(70,114,236,0.06); border: 1px solid rgba(70,114,236,0.12);
          font-family: 'JetBrains Mono', monospace; font-size: 12px;
          letter-spacing: 2px; text-transform: uppercase; color: #6b93ff;
        }
        .lp-section-label::before {
          content: ''; width: 6px; height: 6px; border-radius: 50%;
          background: #4672ec; box-shadow: 0 0 8px rgba(70,114,236,0.6);
        }
        .lp-glow-orb {
          position: absolute; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, rgba(70,114,236,0.08) 0%, transparent 70%);
          filter: blur(40px);
        }

        /* ── Network Grid Section ── */
        .net-section {
          position: relative; padding: 80px 24px 60px; overflow: hidden;
          background: linear-gradient(180deg, #000 0%, #060618 30%, #080822 50%, #060618 70%, #000 100%);
        }
        /* Radial light behind hub */
        .net-section::before {
          content: ''; position: absolute;
          width: 700px; height: 700px; border-radius: 50%;
          top: 55%; left: 50%; transform: translate(-50%,-50%);
          background: radial-gradient(circle, rgba(70,114,236,0.08) 0%, rgba(139,92,246,0.04) 30%, transparent 65%);
          pointer-events: none; z-index: 0;
        }
        .net-section-header {
          text-align: center; max-width: 640px; margin: 0 auto 100px; position: relative; z-index: 3;
        }
        .net-section-header h2 {
          font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(2.2rem, 4.5vw, 3.2rem);
          font-weight: 800; color: #fff; letter-spacing: -0.03em;
          line-height: 1.1; margin: 24px 0 0;
        }
        .net-section-header p {
          font-family: 'Inter', sans-serif; font-size: 17px;
          color: rgba(255,255,255,0.4); line-height: 1.7; margin: 16px auto 0;
          max-width: 480px;
        }
        .net-canvas {
          position: relative; max-width: 1000px; margin: 0 auto; height: 640px; z-index: 1;
        }

        /* Center hub */
        @keyframes netPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(70,114,236,0.4), 0 0 60px rgba(70,114,236,0.15); }
          50% { box-shadow: 0 0 0 24px rgba(70,114,236,0), 0 0 80px rgba(70,114,236,0.25); }
        }
        @keyframes netCoreSpin {
          from { transform: translate(-50%,-50%) rotate(0deg); }
          to { transform: translate(-50%,-50%) rotate(360deg); }
        }
        .net-hub {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
          width: 150px; height: 150px; border-radius: 50%; z-index: 5;
          background: radial-gradient(circle, rgba(20,20,50,0.95) 0%, rgba(8,8,20,0.98) 100%);
          border: 2px solid rgba(70,114,236,0.4);
          display: flex; align-items: center; justify-content: center;
          animation: netPulse 3s ease-in-out infinite;
        }
        .net-hub::before {
          content: ''; position: absolute; inset: -30px; border-radius: 50%;
          background: radial-gradient(circle, rgba(70,114,236,0.12) 0%, transparent 70%);
          z-index: -1; pointer-events: none;
          animation: netPulse 3s ease-in-out infinite;
        }
        @keyframes netRingSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .net-hub-ring {
          position: absolute; border-radius: 50%;
          border: 1px solid rgba(70,114,236,0.12);
          top: 50%; left: 50%;
          width: 188px; height: 188px;
          margin-left: -94px; margin-top: -94px;
          animation: netRingSpin 18s linear infinite;
        }
        .net-hub-ring::before {
          content: ''; position: absolute; top: -4px; left: 50%;
          width: 8px; height: 8px; border-radius: 50%;
          background: #6b93ff; box-shadow: 0 0 14px #6b93ff, 0 0 30px rgba(107,147,255,0.3);
          transform: translateX(-50%);
        }
        .net-hub-ring--mid {
          width: 236px; height: 236px;
          margin-left: -118px; margin-top: -118px;
          border-color: rgba(70,114,236,0.08);
          animation: netRingSpin 28s linear infinite reverse;
        }
        .net-hub-ring--mid::before { background: #8b5cf6; box-shadow: 0 0 14px #8b5cf6; }
        .net-hub-ring--outer {
          width: 284px; height: 284px;
          margin-left: -142px; margin-top: -142px;
          border-color: rgba(70,114,236,0.04);
          animation: netRingSpin 40s linear infinite;
        }
        .net-hub-ring--outer::before { width: 5px; height: 5px; background: rgba(107,147,255,0.5); box-shadow: 0 0 8px rgba(107,147,255,0.3); }
        .net-hub-icon {
          width: 120px; height: 120px; object-fit: contain;
          filter: drop-shadow(0 0 20px rgba(70,114,236,0.4));
        }

        /* Grid lines SVG */
        .net-lines {
          position: absolute; inset: 0; z-index: 1; pointer-events: none;
        }
        .net-line {
          stroke: rgba(70,114,236,0.1); stroke-width: 1; fill: none;
          stroke-dasharray: 4 6;
        }
        @keyframes netLineDash {
          to { stroke-dashoffset: -60; }
        }
        @keyframes netLineGlow {
          0%, 100% { stroke-opacity: 0.2; }
          50% { stroke-opacity: 0.5; }
        }
        .net-line--animated {
          stroke: rgba(70,114,236,0.4); stroke-width: 1.5;
          stroke-dasharray: 12 8;
          animation: netLineDash 2.5s linear infinite, netLineGlow 4s ease-in-out infinite;
          filter: drop-shadow(0 0 3px rgba(70,114,236,0.3));
        }

        /* Data flow particles on lines */
        @keyframes netFlowParticle {
          0% { offset-distance: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { offset-distance: 100%; opacity: 0; }
        }

        /* Orbit nodes */
        @keyframes netNodeFloat {
          0%, 100% { transform: translate(-50%,-50%) translateY(0); }
          50% { transform: translate(-50%,-50%) translateY(-14px); }
        }
        .net-node {
          position: absolute; width: 72px; height: 72px;
          transform: translate(-50%,-50%);
          z-index: 4;
        }
        .net-node-inner {
          width: 100%; height: 100%; border-radius: 22px;
          background: rgba(12,12,30,0.85);
          border: 1px solid rgba(255,255,255,0.07);
          backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.4s cubic-bezier(0.16,1,0.3,1);
          box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04);
          color: #6b93ff;
        }
        .net-node::after {
          content: ''; position: absolute; inset: -1px; border-radius: 22px;
          background: conic-gradient(from 0deg, transparent 0%, rgba(70,114,236,0.15) 25%, transparent 50%);
          z-index: -1; opacity: 0; transition: opacity 0.4s;
          animation: netCoreSpin 6s linear infinite;
        }
        .net-node:hover::after { opacity: 1; }
        .net-node:hover .net-node-inner {
          border-color: rgba(70,114,236,0.5);
          box-shadow: 0 12px 48px rgba(70,114,236,0.2), inset 0 1px 0 rgba(255,255,255,0.06);
          transform: scale(1.12);
          color: #fff;
        }
        .net-node-label {
          position: absolute; top: calc(100% + 14px); left: 50%; transform: translateX(-50%);
          font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;
          color: rgba(255,255,255,0.35); white-space: nowrap; letter-spacing: 0.3px;
          transition: color 0.3s;
        }
        .net-node:hover .net-node-label { color: rgba(255,255,255,0.8); }

        /* Sparkle dots */
        @keyframes netSparkle {
          0%, 100% { opacity: 0.1; transform: translate(-50%,-50%) scale(0.5); }
          50% { opacity: 1; transform: translate(-50%,-50%) scale(1.8); }
        }
        .net-sparkle {
          position: absolute; width: 4px; height: 4px; border-radius: 50%;
          background: #6b93ff; box-shadow: 0 0 12px rgba(107,147,255,0.6);
          z-index: 2;
          animation: netSparkle 3s ease-in-out infinite;
        }

        /* Pulse waves from center */
        @keyframes netPulseWave {
          0% { width: 0; height: 0; opacity: 0.5; border-width: 2px; }
          100% { width: 600px; height: 600px; opacity: 0; border-width: 0.5px; }
        }
        .net-pulse-wave {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%,-50%);
          border-radius: 50%;
          border: 1px solid rgba(70,114,236,0.3);
          pointer-events: none; z-index: 1;
          animation: netPulseWave 4s ease-out infinite;
        }
        .net-pulse-wave:nth-child(2) { animation-delay: 1.3s; }
        .net-pulse-wave:nth-child(3) { animation-delay: 2.6s; }

        /* Data flow dots traveling on lines */
        @keyframes netDataFlow1 {
          0% { left: 20%; top: 20%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 45%; top: 44%; opacity: 0; }
        }
        @keyframes netDataFlow2 {
          0% { left: 80%; top: 20%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 55%; top: 44%; opacity: 0; }
        }
        @keyframes netDataFlow3 {
          0% { left: 50%; top: 8%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 50%; top: 42%; opacity: 0; }
        }
        @keyframes netDataFlow4 {
          0% { left: 20%; top: 80%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 45%; top: 56%; opacity: 0; }
        }
        @keyframes netDataFlow5 {
          0% { left: 80%; top: 80%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 55%; top: 56%; opacity: 0; }
        }
        @keyframes netDataFlow6 {
          0% { left: 50%; top: 92%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 50%; top: 58%; opacity: 0; }
        }
        .net-data-dot {
          position: absolute; width: 6px; height: 6px; border-radius: 50%;
          background: #6b93ff;
          box-shadow: 0 0 8px #6b93ff, 0 0 20px rgba(107,147,255,0.4);
          z-index: 3; pointer-events: none;
          transform: translate(-50%,-50%);
        }
        .net-data-dot:nth-child(1) { animation: netDataFlow1 3s ease-in-out infinite; }
        .net-data-dot:nth-child(2) { animation: netDataFlow2 3s ease-in-out infinite 0.5s; }
        .net-data-dot:nth-child(3) { animation: netDataFlow3 3s ease-in-out infinite 1s; }
        .net-data-dot:nth-child(4) { animation: netDataFlow4 3s ease-in-out infinite 1.5s; }
        .net-data-dot:nth-child(5) { animation: netDataFlow5 3s ease-in-out infinite 2s; }
        .net-data-dot:nth-child(6) { animation: netDataFlow6 3s ease-in-out infinite 2.5s; }

        /* Node glow halos */
        .net-node-inner::before {
          content: ''; position: absolute; inset: -8px; border-radius: 26px;
          background: radial-gradient(circle, rgba(70,114,236,0.06) 0%, transparent 70%);
          z-index: -1; pointer-events: none;
        }

        /* Ambient glow blobs */
        .net-ambient {
          position: absolute; border-radius: 50%; pointer-events: none; z-index: 0;
          filter: blur(80px);
        }

        /* CTA below */
        .net-cta {
          text-align: center; margin-top: 100px; position: relative; z-index: 3;
        }


        /* Noise Texture Overlay */
        .lp-noise {
          position: fixed;
          inset: 0;
          opacity: 0.03;
          pointer-events: none;
          z-index: 1000;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }

        /* Grid Pattern */
        .lp-grid-pattern {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 80px 80px;
          mask-image: linear-gradient(to bottom, black 0%, black 85%, transparent 100%);
          z-index: 0;
        }

        /* Fade In Animation */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .lp-fade-in {
          animation: fadeInUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .lp-fade-in-delay-1 { animation-delay: 0.1s; opacity: 0; }
        .lp-fade-in-delay-2 { animation-delay: 0.2s; opacity: 0; }
        .lp-fade-in-delay-3 { animation-delay: 0.35s; opacity: 0; }
        .lp-fade-in-delay-4 { animation-delay: 0.5s; opacity: 0; }
        .lp-fade-in-delay-5 { animation-delay: 0.65s; opacity: 0; }

        /* Glow Effects */
        .lp-glow-blue {
          box-shadow: 0 0 80px rgba(70, 114, 236, 0.25), 0 0 160px rgba(70, 114, 236, 0.1);
        }
        .lp-glow-text {
          text-shadow: 0 0 60px rgba(70, 114, 236, 0.6), 0 0 120px rgba(70, 114, 236, 0.3);
        }

        /* Glassmorphism Card */
        .lp-glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        /* Card with Shine Effect */
        .lp-card-shine {
          position: relative;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-card-shine::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.05),
            transparent
          );
          transition: left 0.6s ease;
        }
        .lp-card-shine:hover::before {
          left: 100%;
        }
        .lp-card-shine:hover {
          transform: translateY(-8px);
          border-color: rgba(70, 114, 236, 0.3);
          box-shadow: 0 25px 50px rgba(0,0,0,0.4), 0 0 60px rgba(70, 114, 236, 0.15);
        }

        /* Gradient Border Card */
        .lp-gradient-border {
          position: relative;
          background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
          border-radius: 20px;
        }
        .lp-gradient-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 20px;
          padding: 1px;
          background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.02) 100%);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
          -webkit-mask-composite: xor;
          pointer-events: none;
        }

        /* Primary Button */
        .lp-btn-primary {
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          background: linear-gradient(135deg, #4672ec 0%, #3b5fd9 100%);
        }
        .lp-btn-primary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .lp-btn-primary:hover::before {
          opacity: 1;
        }
        .lp-btn-primary:hover {
          transform: translateY(-3px);
          box-shadow: 0 15px 40px rgba(70, 114, 236, 0.4), 0 0 20px rgba(70, 114, 236, 0.3);
        }

        /* Secondary Button */
        .lp-btn-secondary {
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .lp-btn-secondary:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.2);
          transform: translateY(-2px);
        }

        /* Animated Badge */
        .lp-badge {
          position: relative;
          overflow: hidden;
        }
        .lp-badge::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            45deg,
            transparent 40%,
            rgba(255,255,255,0.1) 50%,
            transparent 60%
          );
          animation: badgeShine 3s ease-in-out infinite;
        }
        @keyframes badgeShine {
          0%, 100% { transform: translateX(-100%) rotate(45deg); }
          50% { transform: translateX(100%) rotate(45deg); }
        }

        /* Number Counter Animation */
        .lp-number {
          background: linear-gradient(135deg, #4672ec 0%, #8b5cf6 50%, #06b6d4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Header Mobile Menu */
        .lp-nav-desktop {
          display: flex;
          gap: 32px;
          align-items: center;
        }
        .lp-nav-mobile-toggle {
          display: none;
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          padding: 8px;
        }
        .lp-nav-link {
          color: rgba(255,255,255,0.6);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s ease;
          position: relative;
        }
        .lp-nav-link:hover {
          color: #fff;
        }
        .lp-nav-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, #4672ec, #8b5cf6);
          transition: width 0.3s ease;
        }
        .lp-nav-link:hover::after {
          width: 100%;
        }

        /* Stats Grid */
        .lp-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          max-width: 700px;
          margin: 48px auto 0;
        }

        /* Problem/Solution Grid */
        .lp-problem-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          align-items: stretch;
        }

        /* Steps Timeline */
        .lp-steps-grid {
          display: flex;
          flex-direction: column;
          gap: 0;
          position: relative;
          max-width: 700px;
          margin: 0 auto;
        }

        .lp-steps-grid::before {
          content: '';
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 2px;
          background: linear-gradient(180deg, transparent 0%, rgba(70, 114, 236, 0.3) 10%, rgba(139, 92, 246, 0.3) 90%, transparent 100%);
          transform: translateX(-50%);
        }

        .lp-step-item {
          display: flex;
          align-items: flex-start;
          gap: 40px;
          padding: 40px 0;
          position: relative;
          opacity: 0;
          transform: translateY(40px);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .lp-step-item.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .lp-step-item:nth-child(odd) {
          flex-direction: row-reverse;
          text-align: right;
        }

        .lp-step-item:nth-child(even) {
          text-align: left;
        }

        .lp-step-content {
          flex: 1;
        }

        .lp-step-center {
          position: relative;
          z-index: 2;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .lp-step-number {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4672ec 0%, #8b5cf6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 700;
          box-shadow: 0 0 20px rgba(70, 114, 236, 0.5), 0 0 40px rgba(70, 114, 236, 0.2);
          position: relative;
        }

        .lp-step-number::before {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid rgba(70, 114, 236, 0.3);
          animation: lp-pulse-ring 2s ease-in-out infinite;
        }

        @keyframes lp-pulse-ring {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0; }
        }

        .lp-step-icon-box {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(70, 114, 236, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%);
          border: 1px solid rgba(70, 114, 236, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4672ec;
          margin-bottom: 16px;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .lp-step-item.visible .lp-step-icon-box {
          animation: lp-icon-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both;
        }

        @keyframes lp-icon-pop {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        .lp-step-label {
          font-size: 12px;
          font-weight: 600;
          color: #4672ec;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 8px;
        }

        .lp-step-title {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 8px;
          letter-spacing: -0.01em;
        }

        .lp-step-desc {
          font-size: 14px;
          color: rgba(255,255,255,0.45);
          line-height: 1.6;
        }

        /* Benefits Grid */
        .lp-benefits-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        /* Influencers Grid */
        .lp-influencers-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        /* Plans Grid */
        .lp-plans-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 20px;
          align-items: stretch;
        }
        .lp-plans-grid > * {
          display: flex;
          flex-direction: column;
        }

        /* Testimonials Grid for Mobile */
        .lp-testimonials-grid {
          display: none;
        }

        /* Carousel Animation */
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .testimonial-carousel {
          display: flex;
          gap: 24px;
          animation: scroll 40s linear infinite;
        }
        .testimonial-carousel:hover {
          animation-play-state: paused;
        }

        /* Floating Elements */
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        .lp-float {
          animation: float 5s ease-in-out infinite;
        }

        /* Pulse Ring Animation */
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .lp-pulse-ring {
          position: relative;
        }
        .lp-pulse-ring::before,
        .lp-pulse-ring::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(70, 114, 236, 0.3);
        }
        .lp-pulse-ring::before {
          animation: pulseRing 2s ease-out infinite;
        }
        .lp-pulse-ring::after {
          animation: pulseRing 2s ease-out infinite 1s;
        }

        /* WhatsApp Floating Button */
        @keyframes whatsappPulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2); opacity: 0; }
        }
        .lp-whatsapp-btn {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: #25D366;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          cursor: pointer;
          z-index: 999;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          text-decoration: none;
        }
        .lp-whatsapp-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
        }
        .lp-whatsapp-btn::before,
        .lp-whatsapp-btn::after {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background-color: #25D366;
          animation: whatsappPulse 2s ease-out infinite;
          z-index: -1;
        }
        .lp-whatsapp-btn::after {
          animation-delay: 1s;
        }
        .lp-whatsapp-tooltip {
          position: absolute;
          right: 68px;
          background: #fff;
          color: #1a1a2e;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          opacity: 0;
          pointer-events: none;
          transform: translateX(8px);
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .lp-whatsapp-tooltip::after {
          content: '';
          position: absolute;
          right: -6px;
          top: 50%;
          transform: translateY(-50%);
          border: 6px solid transparent;
          border-left-color: #fff;
          border-right: none;
        }
        .lp-whatsapp-btn:hover .lp-whatsapp-tooltip {
          opacity: 1;
          transform: translateX(0);
        }

        /* Section Divider */
        .lp-section-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          margin: 0 auto;
          max-width: 1200px;
        }

        /* Dashboard Preview Grid */
        .lp-dashboard-preview {
          display: grid;
          grid-template-columns: 1fr 1.3fr;
          gap: 60px;
          align-items: center;
        }

        /* Mobile Styles */
        @media (max-width: 1280px) {
          .lp-plans-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }
        }

        @media (max-width: 1024px) {
          .lp-plans-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          .lp-benefits-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
        }

        @media (max-width: 768px) {
          .net-section { padding: 40px 16px 40px; }
          .net-section-header { margin-bottom: 0; }
          .net-section-header h2 { font-size: clamp(1.6rem, 7vw, 2rem); }
          .net-section-header p { font-size: 14px; margin-top: 12px; }
          .net-canvas { height: 340px; transform: scale(0.55); transform-origin: center center; margin-top: -20px; margin-bottom: -40px; }
          .net-cta { margin-top: 20px; }
          .net-cta a { font-size: 15px; padding: 14px 28px; }
          .net-node { width: 60px; height: 60px; }
          .net-node-inner { border-radius: 18px; }
          .net-node-label { font-size: 10px; top: calc(100% + 10px); }
          .net-hub { width: 120px; height: 120px; }
          .net-hub-icon { width: 90px; height: 90px; }
        }

        /* ── Influencers Carousel ── */
        @keyframes infBorderGlow {
          0%, 100% { opacity: 0.4; filter: hue-rotate(0deg); }
          50% { opacity: 1; filter: hue-rotate(30deg); }
        }
        @keyframes infShimmer {
          0% { transform: translateX(-100%) rotate(15deg); }
          100% { transform: translateX(200%) rotate(15deg); }
        }
        @keyframes infFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes infPulseGlow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.15); }
        }
        @keyframes infGridMove {
          0% { background-position: 0 0; }
          100% { background-position: 60px 60px; }
        }

        .inf-section {
          position: relative; padding: 60px 24px; overflow: hidden;
          background: linear-gradient(180deg, #000 0%, #060612 50%, #000 100%);
        }
        /* Subtle moving grid background */
        .inf-section::before {
          content: ''; position: absolute; inset: 0; z-index: 0;
          background-image:
            linear-gradient(rgba(107,147,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(107,147,255,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          animation: infGridMove 20s linear infinite;
        }
        /* Ambient glow behind cards */
        .inf-ambient-glow {
          position: absolute; width: 600px; height: 400px;
          top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: radial-gradient(ellipse, rgba(70,114,236,0.12) 0%, transparent 70%);
          animation: infPulseGlow 6s ease-in-out infinite;
          pointer-events: none; z-index: 0;
        }

        .inf-header {
          text-align: center; max-width: 640px; margin: 0 auto 64px; position: relative; z-index: 2;
        }
        .inf-header h2 {
          font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(2rem, 4vw, 3rem);
          font-weight: 800; color: #fff; letter-spacing: -0.03em;
          line-height: 1.1; margin: 24px 0 0;
        }
        .inf-header h2 span {
          background: linear-gradient(135deg, #6b93ff, #a78bfa, #6b93ff);
          background-size: 200% 200%;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: infBorderGlow 4s ease-in-out infinite;
        }
        .inf-header p {
          font-family: 'Inter', sans-serif; font-size: 17px;
          color: rgba(255,255,255,0.4); line-height: 1.7; margin: 16px auto 0;
        }

        /* Carousel — 3D perspective slider */
        .inf-carousel-wrapper {
          max-width: 1100px; margin: 0 auto; position: relative; z-index: 2;
          perspective: 1200px;
        }
        .inf-carousel {
          display: flex; align-items: center; justify-content: center;
          position: relative; height: 520px;
        }

        /* Each card is absolutely positioned and transitions */
        .inf-card {
          position: absolute; width: 340px; height: 460px; border-radius: 24px;
          overflow: visible; cursor: pointer;
          transition: all 0.7s cubic-bezier(0.16,1,0.3,1);
          will-change: transform, opacity, filter;
        }
        .inf-card-inner {
          position: relative; width: 100%; height: 100%;
          border-radius: 24px; overflow: hidden;
          background: rgba(255,255,255,0.03);
        }

        /* Blue glow behind each card */
        .inf-card-glow {
          position: absolute;
          inset: -50px; z-index: -1; border-radius: 50%;
          background: radial-gradient(circle, rgba(70,114,236,0.3) 0%, rgba(107,147,255,0.1) 40%, transparent 70%);
          filter: blur(40px);
          opacity: 0;
          transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1);
          pointer-events: none;
        }

        /* States: center, left, right, hidden */
        .inf-card--center {
          z-index: 5; transform: translateX(0) scale(1);
          opacity: 1; filter: brightness(1);
        }
        .inf-card--center .inf-card-inner {
          box-shadow: 0 30px 100px rgba(0,0,0,0.6), 0 0 80px rgba(70,114,236,0.15);
        }
        .inf-card--center .inf-card-glow {
          opacity: 1;
          animation: infPulseGlow 4s ease-in-out infinite;
        }
        .inf-card--left {
          z-index: 3; transform: translateX(-380px) scale(0.82) rotateY(8deg);
          opacity: 0.6; filter: brightness(0.6);
        }
        .inf-card--left .inf-card-glow { opacity: 0.4; }
        .inf-card--right {
          z-index: 3; transform: translateX(380px) scale(0.82) rotateY(-8deg);
          opacity: 0.6; filter: brightness(0.6);
        }
        .inf-card--right .inf-card-glow { opacity: 0.4; }
        .inf-card--hidden-left {
          z-index: 1; transform: translateX(-600px) scale(0.6);
          opacity: 0; pointer-events: none;
        }
        .inf-card--hidden-right {
          z-index: 1; transform: translateX(600px) scale(0.6);
          opacity: 0; pointer-events: none;
        }

        /* Gradient border on active card */
        .inf-card--center .inf-card-inner::before {
          content: ''; position: absolute; inset: 0; z-index: 3;
          border-radius: 24px; padding: 1.5px;
          background: linear-gradient(135deg, rgba(107,147,255,0.5), rgba(167,139,250,0.3), rgba(107,147,255,0.15), rgba(167,139,250,0.5));
          background-size: 300% 300%;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
          animation: infBorderGlow 4s ease-in-out infinite;
          pointer-events: none;
        }

        .inf-card img {
          width: 100%; height: 100%; object-fit: cover;
          transition: transform 0.7s cubic-bezier(0.16,1,0.3,1), filter 0.5s;
        }
        .inf-card--center:hover img {
          transform: scale(1.05);
        }

        /* Shimmer effect on center card hover */
        .inf-card-shimmer {
          position: absolute; inset: 0; z-index: 2; overflow: hidden;
          pointer-events: none; border-radius: 24px;
        }
        .inf-card-shimmer::after {
          content: ''; position: absolute;
          top: -50%; left: -50%; width: 50%; height: 200%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          transform: translateX(-100%) rotate(15deg);
        }
        .inf-card--center:hover .inf-card-shimmer::after {
          animation: infShimmer 1.2s ease-in-out;
        }

        /* Overlay — Zouti style: dark bottom bar with name + description */
        .inf-card-overlay {
          position: absolute; inset: 0; z-index: 1;
          display: flex; flex-direction: column; justify-content: flex-end;
          background: linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.6) 100%);
          pointer-events: none;
        }
        .inf-card-info {
          background: rgba(15,15,25,0.92);
          backdrop-filter: blur(6px);
          padding: 18px 22px;
          border-radius: 0 0 24px 24px;
        }
        .inf-card-name {
          font-family: 'Bricolage Grotesque', sans-serif; font-size: 17px;
          font-weight: 700; color: #fff; line-height: 1.2;
        }
        .inf-card-desc {
          font-family: 'Inter', sans-serif; font-size: 12.5px;
          color: rgba(255,255,255,0.45); line-height: 1.5;
          margin-top: 5px;
        }

        /* Nav buttons — positioned on sides */
        .inf-nav {
          display: flex; justify-content: center; gap: 20px; margin-top: 48px;
          position: relative; z-index: 10;
        }
        .inf-nav-btn {
          width: 56px; height: 56px; border-radius: 50%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.5); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.4s cubic-bezier(0.16,1,0.3,1);
          backdrop-filter: blur(8px);
        }
        .inf-nav-btn:hover {
          background: rgba(70,114,236,0.2); border-color: rgba(70,114,236,0.5);
          color: #fff; transform: scale(1.12);
          box-shadow: 0 0 30px rgba(70,114,236,0.2);
        }

        /* Dots */
        .inf-dots {
          display: flex; justify-content: center; gap: 10px; margin-top: 28px;
          position: relative; z-index: 10;
        }
        .inf-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: rgba(255,255,255,0.12); cursor: pointer;
          transition: all 0.4s cubic-bezier(0.16,1,0.3,1);
        }
        .inf-dot--active {
          background: #6b93ff; width: 28px; border-radius: 4px;
          box-shadow: 0 0 12px rgba(107,147,255,0.5);
        }

        @media (max-width: 900px) {
          .inf-carousel { height: 420px; }
          .inf-card { width: 280px; height: 380px; }
          .inf-card--left { transform: translateX(-200px) scale(0.75) rotateY(8deg); }
          .inf-card--right { transform: translateX(200px) scale(0.75) rotateY(-8deg); }
          .inf-card--center .inf-card-desc { opacity: 1; max-height: 80px; }
          .inf-card--center .inf-card-badge { opacity: 1; transform: translateY(0); }
          .inf-card--center .inf-card-social { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 600px) {
          .inf-section { padding: 40px 16px; }
          .inf-header { margin-bottom: 20px; }
          .inf-header h2 { font-size: clamp(1.5rem, 6.5vw, 1.9rem); }
          .inf-header p { font-size: 14px; margin-top: 10px; }
          .inf-carousel { height: 320px; }
          .inf-card { width: 220px; height: 300px; }
          .inf-card--left { transform: translateX(-140px) scale(0.7) rotateY(6deg); opacity: 0.4; }
          .inf-card--right { transform: translateX(140px) scale(0.7) rotateY(-6deg); opacity: 0.4; }
          .inf-card-info { padding: 12px 16px; }
          .inf-card-name { font-size: 14px; }
          .inf-card-desc { font-size: 11px; }
          .inf-nav { margin-top: 24px; gap: 16px; }
          .inf-nav-btn { width: 44px; height: 44px; }
          .inf-dots { margin-top: 16px; }
        }

        /* ── About Section ── */
        @keyframes aboutGlowDrift {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
          33% { transform: translate(-45%, -55%) scale(1.1); opacity: 0.8; }
          66% { transform: translate(-55%, -45%) scale(0.95); opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
        }
        /* ── About Section ── */
        @keyframes aboutGlowFloat {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
        }
        @keyframes aboutGlowFloat2 {
          0%, 100% { transform: translate(-50%, -50%) translateX(-30px); opacity: 0.5; }
          50% { transform: translate(-50%, -50%) translateX(30px); opacity: 0.8; }
        }
        @keyframes aboutFeedSlide {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes aboutDotPulse {
          0%, 100% { box-shadow: 0 0 6px currentColor, 0 0 0 0 currentColor; }
          50% { box-shadow: 0 0 8px currentColor, 0 0 0 6px transparent; }
        }
        @keyframes aboutStatCount {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes aboutBadgeGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(107,147,255,0); }
          50% { box-shadow: 0 0 20px rgba(107,147,255,0.15); }
        }
        @keyframes aboutCardBorderSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes aboutSpotlightSweep {
          0% { opacity: 0; transform: translateX(-100%) rotate(15deg); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: translateX(200%) rotate(15deg); }
        }
        .about-section {
          position: relative; padding: 60px 24px; overflow: hidden;
          background: linear-gradient(180deg, #000 0%, #050510 30%, #080818 50%, #050510 70%, #000 100%);
        }
        /* Dot grid background */
        .about-section::before {
          content: '';
          position: absolute; inset: 0;
          background-image: radial-gradient(rgba(70,114,236,0.12) 1px, transparent 1px);
          background-size: 40px 40px;
          -webkit-mask-image: radial-gradient(ellipse 70% 60% at 60% 50%, black 20%, transparent 70%);
          mask-image: radial-gradient(ellipse 70% 60% at 60% 50%, black 20%, transparent 70%);
          pointer-events: none;
        }
        /* Ambient glow blobs */
        .about-section::after {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 50% 40% at 65% 45%, rgba(70,114,236,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 35% 35% at 25% 55%, rgba(139,92,246,0.04) 0%, transparent 50%);
          pointer-events: none;
        }
        .about-row {
          max-width: 1200px; margin: 0 auto; position: relative; z-index: 2;
          display: flex; align-items: center; gap: 72px;
        }

        /* Left column */
        .about-left {
          flex: 1; min-width: 0;
        }
        @keyframes aboutBadgeShimmer {
          0% { left: -100%; }
          50%, 100% { left: 200%; }
        }
        .about-badge {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500;
          color: #fff; padding: 8px 20px;
          background: rgba(70,114,236,0.06);
          border: 1px solid rgba(70,114,236,0.15);
          border-radius: 100px; margin-bottom: 32px;
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          animation: aboutBadgeGlow 3s ease-in-out infinite;
          transition: all 0.3s;
          position: relative; overflow: hidden;
        }
        .about-badge::after {
          content: ''; position: absolute; top: 0; left: -100%;
          width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
          animation: aboutBadgeShimmer 4s ease-in-out infinite;
        }
        .about-badge:hover {
          border-color: rgba(70,114,236,0.35);
          background: rgba(70,114,236,0.1);
        }
        .about-badge svg { color: #6b93ff; }
        .about-left h2 {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-size: clamp(2rem, 4vw, 2.8rem);
          font-weight: 800; color: #fff; letter-spacing: -0.03em;
          line-height: 1.15; margin: 0;
        }
        .about-left h2 span {
          background: linear-gradient(135deg, #6b93ff 0%, #93b4ff 50%, #6b93ff 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: aboutGlowDrift 6s ease-in-out infinite;
        }

        /* Feature cards grid */
        .about-features {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 16px; margin: 44px 0 0;
        }
        .about-feat {
          padding: 20px 16px; border-radius: 16px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          transition: all 0.4s cubic-bezier(0.16,1,0.3,1);
          position: relative; overflow: hidden;
        }
        .about-feat::after {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
        }
        .about-feat:hover {
          background: rgba(70,114,236,0.06);
          border-color: rgba(70,114,236,0.15);
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.2), 0 0 30px rgba(70,114,236,0.05);
        }
        /* Spotlight cursor glow on feature cards */
        .about-feat-spotlight {
          position: absolute; inset: 0; border-radius: 16px;
          background: radial-gradient(
            350px circle at var(--feat-x, 50%) var(--feat-y, 50%),
            rgba(70,114,236,0.1), transparent 40%
          );
          opacity: var(--feat-spot, 0);
          transition: opacity 0.3s;
          pointer-events: none; z-index: 0;
        }
        .about-feat-icon {
          width: 42px; height: 42px; border-radius: 12px;
          background: rgba(70,114,236,0.08);
          border: 1px solid rgba(70,114,236,0.12);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 14px; position: relative;
          transition: all 0.3s;
        }
        .about-feat-icon::before {
          content: ''; position: absolute; inset: -8px; border-radius: 16px;
          background: radial-gradient(circle, rgba(70,114,236,0.3) 0%, transparent 70%);
          filter: blur(10px); z-index: -1; opacity: 0;
          transition: opacity 0.3s;
        }
        .about-feat:hover .about-feat-icon::before { opacity: 1; }
        .about-feat:hover .about-feat-icon {
          background: rgba(70,114,236,0.15);
          border-color: rgba(70,114,236,0.3);
          box-shadow: 0 0 20px rgba(70,114,236,0.2);
        }
        .about-feat-icon svg { width: 18px; height: 18px; color: #6b93ff; transition: color 0.3s; }
        .about-feat:hover .about-feat-icon svg { color: #8aafff; }
        .about-feat p {
          font-family: 'Inter', sans-serif; font-size: 13px;
          color: rgba(255,255,255,0.4); line-height: 1.6; margin: 0;
          transition: color 0.3s;
        }
        .about-feat:hover p { color: rgba(255,255,255,0.6); }

        /* Right — welcome card */
        .about-card-wrap {
          flex: 0 0 420px; position: relative;
        }
        .about-card {
          position: relative; z-index: 2;
          background: linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 32px 28px;
          transition: box-shadow 0.5s ease, border-color 0.3s;
          overflow: hidden;
          backdrop-filter: blur(20px) saturate(1.2); -webkit-backdrop-filter: blur(20px) saturate(1.2);
          transform-style: preserve-3d;
          will-change: transform;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 80px rgba(70,114,236,0.06), inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .about-card:hover {
          box-shadow: 0 24px 80px rgba(0,0,0,0.45), 0 0 80px rgba(70,114,236,0.1), inset 0 1px 0 rgba(255,255,255,0.06);
          border-color: rgba(70,114,236,0.25);
        }
        /* Spinning conic border */
        .about-card-border-spin {
          position: absolute; inset: -1px; border-radius: 24px;
          overflow: hidden; pointer-events: none; z-index: -1;
        }
        .about-card-border-spin::before {
          content: ''; position: absolute; inset: -50%;
          width: 200%; height: 200%;
          background: conic-gradient(from 0deg, transparent 0%, rgba(70,114,236,0.25) 8%, transparent 16%, transparent 50%, rgba(139,92,246,0.15) 58%, transparent 66%);
          animation: aboutCardBorderSpin 8s linear infinite;
        }
        .about-card-border-spin::after {
          content: ''; position: absolute; inset: 1px; border-radius: 23px;
          background: linear-gradient(145deg, rgba(12,12,30,0.97), rgba(8,8,22,0.99));
        }
        /* Top shimmer highlight */
        .about-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(107,147,255,0.2), transparent);
          z-index: 5;
        }
        /* Periodic light sweep */
        .about-card::after {
          content: ''; position: absolute; top: -50%; left: -50%;
          width: 40%; height: 200%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);
          animation: aboutSpotlightSweep 6s ease-in-out infinite;
          pointer-events: none; z-index: 4;
        }
        .about-card-glow {
          position: absolute; width: 350px; height: 350px;
          top: 30%; left: 60%; transform: translate(-50%, -50%);
          border-radius: 50%;
          background: radial-gradient(circle, rgba(70,114,236,0.15) 0%, transparent 65%);
          filter: blur(60px); pointer-events: none; z-index: 0;
          animation: aboutGlowFloat 8s ease-in-out infinite;
        }
        .about-card-glow-2 {
          position: absolute; width: 250px; height: 250px;
          top: 70%; left: 30%; transform: translate(-50%, -50%);
          border-radius: 50%;
          background: radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 65%);
          filter: blur(50px); pointer-events: none; z-index: 0;
          animation: aboutGlowFloat2 10s ease-in-out infinite;
        }
        /* Noise overlay on card */
        .about-card-noise {
          position: absolute; inset: 0; border-radius: 24px;
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          opacity: 0.03; mix-blend-mode: overlay;
          pointer-events: none; z-index: 3;
        }

        /* Card header */
        .about-card-head {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 24px; position: relative; z-index: 5;
        }
        .about-card-avatar {
          width: 48px; height: 48px; border-radius: 14px;
          background: linear-gradient(135deg, #1a2a5e, #223470);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 16px rgba(70,114,236,0.2);
        }
        .about-card-greet {
          display: flex; flex-direction: column;
        }
        .about-card-greet strong {
          font-family: 'Inter', sans-serif; font-size: 16px;
          font-weight: 600; color: rgba(255,255,255,0.9);
        }
        .about-card-greet span {
          font-family: 'Inter', sans-serif; font-size: 12px;
          color: rgba(255,255,255,0.3); margin-top: 2px;
        }

        /* Mini stats row */
        .about-card-stats {
          display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
          margin-bottom: 24px; position: relative; z-index: 5;
        }
        .about-card-stat {
          padding: 14px 16px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 14px;
          transition: all 0.3s ease;
        }
        .about-card-stat:hover {
          background: rgba(70,114,236,0.06);
          border-color: rgba(70,114,236,0.15);
          transform: translateY(-2px);
        }
        .about-card-stat-val {
          font-family: 'JetBrains Mono', monospace; font-size: 20px;
          font-weight: 700; color: #fff; line-height: 1;
          animation: aboutStatCount 0.6s cubic-bezier(0.16,1,0.3,1) both;
        }
        .about-card-stat:nth-child(1) .about-card-stat-val { animation-delay: 0.1s; }
        .about-card-stat:nth-child(2) .about-card-stat-val { animation-delay: 0.25s; }
        .about-card-stat:nth-child(3) .about-card-stat-val { animation-delay: 0.4s; }
        .about-card-stat:nth-child(4) .about-card-stat-val { animation-delay: 0.55s; }
        .about-card-stat-val .about-card-stat-accent {
          color: #6b93ff;
        }
        .about-card-stat-label {
          font-family: 'Inter', sans-serif; font-size: 11px;
          color: rgba(255,255,255,0.3); margin-top: 6px;
        }

        /* Activity feed */
        .about-card-feed {
          display: flex; flex-direction: column; gap: 10px;
          position: relative; z-index: 5;
        }
        .about-card-feed-title {
          font-family: 'Inter', sans-serif; font-size: 11px;
          color: rgba(255,255,255,0.25); text-transform: uppercase;
          letter-spacing: 0.5px; margin-bottom: 2px;
        }
        .about-card-feed-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 12px;
          transition: all 0.3s ease;
          animation: aboutFeedSlide 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        .about-card-feed-item:nth-child(2) { animation-delay: 0.7s; }
        .about-card-feed-item:nth-child(3) { animation-delay: 0.9s; }
        .about-card-feed-item:nth-child(4) { animation-delay: 1.1s; }
        .about-card-feed-item:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.08);
          transform: translateX(4px);
        }
        .about-card-feed-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
          animation: aboutDotPulse 2s ease-in-out infinite;
        }
        .about-card-feed-dot--green { color: #22c55e; background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.4); }
        .about-card-feed-dot--blue { color: #6b93ff; background: #6b93ff; box-shadow: 0 0 6px rgba(107,147,255,0.4); }
        .about-card-feed-dot--yellow { color: #eab308; background: #eab308; box-shadow: 0 0 6px rgba(234,179,8,0.4); }
        .about-card-feed-dot--green { animation-delay: 0s; }
        .about-card-feed-dot--blue { animation-delay: 0.7s; }
        .about-card-feed-dot--yellow { animation-delay: 1.4s; }
        .about-card-feed-text {
          font-family: 'Inter', sans-serif; font-size: 12px;
          color: rgba(255,255,255,0.5); line-height: 1.4;
          flex: 1;
        }
        .about-card-feed-text strong { color: rgba(255,255,255,0.75); font-weight: 600; }
        .about-card-feed-time {
          font-family: 'JetBrains Mono', monospace; font-size: 9px;
          color: rgba(255,255,255,0.15); flex-shrink: 0;
        }

        @media (max-width: 900px) {
          .about-section { padding: 80px 20px; }
          .about-row { flex-direction: column; gap: 48px; }
          .about-features { grid-template-columns: 1fr; gap: 16px; }
          .about-card-wrap { flex: none; width: 100%; }
          .about-card {
            transform: none; max-width: 420px; margin: 0 auto;
          }
          .about-card:hover { transform: none; }
        }

        /* ── Pricing Cards ── */
        @keyframes pricingBorderSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pricingShimmer {
          0% { transform: translateX(-100%) rotate(25deg); }
          100% { transform: translateX(200%) rotate(25deg); }
        }
        @keyframes pricingBadgePulse {
          0%, 100% { box-shadow: 0 2px 12px rgba(70,114,236,0.4), 0 0 0 0 rgba(70,114,236,0.3); }
          50% { box-shadow: 0 2px 16px rgba(70,114,236,0.6), 0 0 0 8px rgba(70,114,236,0); }
        }
        @keyframes pricingGlow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes pricingFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .pricing-grid {
          display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px;
          align-items: stretch;
        }
        .pricing-grid > div { display: flex; flex-direction: column; height: 100%; }

        /* Spotlight cursor glow */
        .pricing-spotlight {
          position: absolute; inset: 0; border-radius: inherit;
          background: radial-gradient(
            500px circle at var(--spot-x, 50%) var(--spot-y, 50%),
            rgba(70,114,236,0.12),
            transparent 40%
          );
          opacity: var(--spot-opacity, 0);
          transition: opacity 0.35s ease;
          pointer-events: none; z-index: 1;
        }
        .pricing-card--highlight .pricing-spotlight {
          background: radial-gradient(
            600px circle at var(--spot-x, 50%) var(--spot-y, 50%),
            rgba(70,114,236,0.2),
            rgba(139,92,246,0.06) 30%,
            transparent 50%
          );
        }
        /* Noise texture overlay */
        .pricing-noise {
          position: absolute; inset: 0; border-radius: inherit;
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          opacity: 0.03; mix-blend-mode: overlay;
          pointer-events: none; z-index: 2;
        }
        .pricing-card--highlight .pricing-noise { opacity: 0.04; }

        .pricing-card {
          background: rgba(255,255,255,0.02);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 24px; padding: 36px 24px;
          display: flex; flex-direction: column; gap: 20px;
          position: relative; overflow: hidden;
          transition: border-color 0.3s ease, box-shadow 0.5s ease;
          flex: 1;
          transform-style: preserve-3d;
          will-change: transform;
        }
        /* Subtle inner glow on all cards */
        .pricing-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
        }
        /* Shimmer on hover */
        .pricing-card::after {
          content: ''; position: absolute; top: -50%; left: -50%;
          width: 50%; height: 200%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
          transform: translateX(-100%) rotate(25deg);
          transition: none; pointer-events: none;
        }
        .pricing-card:hover::after {
          animation: pricingShimmer 0.8s ease forwards;
        }
        .pricing-card:hover {
          border-color: rgba(255,255,255,0.12);
          box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 30px rgba(70,114,236,0.08);
        }

        /* ── Business Highlight ── */
        .pricing-card--highlight {
          background: linear-gradient(170deg, rgba(70,114,236,0.14) 0%, rgba(30,50,120,0.06) 40%, rgba(70,114,236,0.04) 100%);
          border: 1px solid rgba(70,114,236,0.4);
          transform: scale(1.06);
          z-index: 2; padding: 40px 28px;
          box-shadow:
            0 0 80px rgba(70,114,236,0.12),
            0 0 40px rgba(70,114,236,0.06),
            0 16px 48px rgba(0,0,0,0.4);
        }
        /* Spinning conic border glow */
        .pricing-card--highlight .pricing-border-glow {
          position: absolute; inset: -1px; border-radius: 24px; z-index: -1;
          overflow: hidden; pointer-events: none;
        }
        .pricing-card--highlight .pricing-border-glow::before {
          content: ''; position: absolute;
          inset: -40%; width: 180%; height: 180%;
          background: conic-gradient(from 0deg, transparent 0%, rgba(70,114,236,0.4) 10%, transparent 20%, transparent 50%, rgba(107,147,255,0.3) 60%, transparent 70%);
          animation: pricingBorderSpin 6s linear infinite;
        }
        .pricing-card--highlight .pricing-border-glow::after {
          content: ''; position: absolute; inset: 1px; border-radius: 23px;
          background: linear-gradient(170deg, rgba(12,12,35,0.97) 0%, rgba(8,8,25,0.99) 100%);
        }
        /* Top gradient bar */
        .pricing-card--highlight::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, transparent, #4672ec, #6b93ff, #8b5cf6, transparent);
          z-index: 3;
        }
        /* Radial glow from top */
        .pricing-card--highlight::after {
          content: ''; position: absolute; top: -60%; left: -30%; width: 160%; height: 160%;
          background: radial-gradient(ellipse at 50% 0%, rgba(70,114,236,0.1) 0%, rgba(70,114,236,0.04) 30%, transparent 60%);
          pointer-events: none; animation: pricingGlow 4s ease-in-out infinite;
        }
        .pricing-card--highlight:hover {
          box-shadow:
            0 0 100px rgba(70,114,236,0.2),
            0 0 60px rgba(70,114,236,0.1),
            0 20px 60px rgba(0,0,0,0.45);
          border-color: rgba(70,114,236,0.6);
        }
        .pricing-badge {
          position: absolute; top: 18px; right: 18px;
          background: linear-gradient(135deg, #4672ec, #6b93ff);
          color: #fff; font-size: 10px; font-weight: 700;
          padding: 5px 14px; border-radius: 9999px;
          letter-spacing: 1.2px; text-transform: uppercase;
          animation: pricingBadgePulse 2.5s ease-in-out infinite;
          z-index: 5;
        }
        .pricing-name {
          font-family: 'Inter', sans-serif; font-size: 15px;
          font-weight: 600; color: rgba(255,255,255,0.6);
          transition: color 0.3s;
        }
        .pricing-card:hover .pricing-name { color: rgba(255,255,255,0.85); }
        .pricing-card--highlight .pricing-name {
          color: #fff; font-size: 17px;
        }
        .pricing-desc {
          font-family: 'Inter', sans-serif; font-size: 13px;
          color: rgba(255,255,255,0.28); margin-top: 4px; line-height: 1.5;
        }
        .pricing-card--highlight .pricing-desc { color: rgba(255,255,255,0.45); }
        .pricing-price {
          font-family: 'Bricolage Grotesque', sans-serif; font-size: 34px;
          font-weight: 800; color: #fff; letter-spacing: -0.03em; margin-top: 14px;
          position: relative;
        }
        .pricing-card--highlight .pricing-price {
          font-size: 44px;
          background: linear-gradient(135deg, #fff 30%, #8aafff 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .pricing-price span {
          font-size: 14px; font-weight: 400; color: rgba(255,255,255,0.3);
          -webkit-text-fill-color: rgba(255,255,255,0.3);
        }
        .pricing-stats {
          display: flex; gap: 8px;
        }
        .pricing-stat {
          flex: 1; border-radius: 12px; padding: 12px 10px; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          transition: all 0.3s ease;
        }
        .pricing-stat-label {
          font-family: 'Inter', sans-serif; font-size: 10px;
          text-transform: uppercase; letter-spacing: 0.5px;
          color: rgba(255,255,255,0.25); font-weight: 500;
        }
        .pricing-stat-value {
          font-family: 'JetBrains Mono', monospace; font-size: 16px;
          font-weight: 700; transition: all 0.3s;
        }
        .pricing-stat--email {
          background: rgba(70,114,236,0.06); border: 1px solid rgba(70,114,236,0.08);
        }
        .pricing-stat--email .pricing-stat-value { color: #6b93ff; }
        .pricing-card:hover .pricing-stat--email { background: rgba(70,114,236,0.1); }
        .pricing-card--highlight .pricing-stat--email {
          background: rgba(70,114,236,0.15); border-color: rgba(70,114,236,0.2);
        }
        .pricing-card--highlight .pricing-stat--email .pricing-stat-value { color: #8aafff; font-size: 18px; }
        .pricing-stat--loja {
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04);
        }
        .pricing-stat--loja .pricing-stat-value { color: rgba(255,255,255,0.4); }
        .pricing-card:hover .pricing-stat--loja { background: rgba(255,255,255,0.04); }
        .pricing-card--highlight .pricing-stat--loja {
          background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.08);
        }
        .pricing-card--highlight .pricing-stat--loja .pricing-stat-value { color: rgba(255,255,255,0.65); font-size: 18px; }
        .pricing-card--highlight .pricing-stat-label { color: rgba(255,255,255,0.4); }
        .pricing-divider {
          width: 100%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
        }
        .pricing-card--highlight .pricing-divider {
          background: linear-gradient(90deg, transparent, rgba(70,114,236,0.35), transparent);
        }
        .pricing-features {
          display: flex; flex-direction: column; gap: 11px; flex: 1;
        }
        .pricing-feat {
          display: flex; align-items: center; gap: 10px;
          transition: transform 0.2s;
        }
        .pricing-card:hover .pricing-feat { transform: translateX(2px); }
        .pricing-feat svg {
          color: rgba(70,114,236,0.4); flex-shrink: 0;
          transition: color 0.3s;
        }
        .pricing-card:hover .pricing-feat svg { color: rgba(70,114,236,0.7); }
        .pricing-card--highlight .pricing-feat svg { color: #4672ec; }
        .pricing-feat span {
          font-family: 'Inter', sans-serif; font-size: 13px;
          color: rgba(255,255,255,0.4); transition: color 0.3s;
        }
        .pricing-card:hover .pricing-feat span { color: rgba(255,255,255,0.6); }
        .pricing-card--highlight .pricing-feat span { color: rgba(255,255,255,0.7); }
        .pricing-btn {
          display: block; text-align: center; padding: 14px; border-radius: 14px;
          text-decoration: none; font-size: 14px; font-weight: 600; margin-top: auto;
          color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          transition: all 0.4s cubic-bezier(0.16,1,0.3,1);
          position: relative; overflow: hidden;
        }
        .pricing-btn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
          transform: translateX(-100%); transition: transform 0.5s;
        }
        .pricing-btn:hover::after { transform: translateX(100%); }
        .pricing-btn:hover {
          background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.15);
          color: #fff; transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        }
        .pricing-btn--primary {
          color: #fff; border: none; padding: 15px;
          background: linear-gradient(135deg, #4672ec 0%, #5a83f0 50%, #4672ec 100%);
          background-size: 200% 100%;
          box-shadow: 0 6px 24px rgba(70,114,236,0.35);
          transition: all 0.4s cubic-bezier(0.16,1,0.3,1);
        }
        .pricing-btn--primary::after {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
        }
        .pricing-btn--primary:hover {
          background-position: 100% 0;
          box-shadow: 0 8px 36px rgba(70,114,236,0.5), 0 0 60px rgba(70,114,236,0.15);
          transform: translateY(-2px);
        }
        @media (max-width: 1100px) {
          .pricing-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; }
        }
        @media (max-width: 700px) {
          .pricing-grid { grid-template-columns: 1fr; gap: 14px; max-width: 400px; margin: 0 auto; }
          .pricing-card--highlight { padding: 36px 24px; }
        }

        /* Marquee Carousel */
        .lp-marquee-section {
          padding: 80px 0; position: relative; overflow: hidden;
        }
        .lp-marquee-inner {
          max-width: 1200px; margin: 0 auto; padding: 0 24px;
          display: flex; align-items: center; gap: 0;
        }
        .lp-marquee-text {
          min-width: 240px; padding-right: 48px;
          border-right: 1px solid rgba(255,255,255,0.08);
          flex-shrink: 0;
        }
        .lp-marquee-text h3 {
          font-family: 'Bricolage Grotesque', sans-serif; font-size: 22px; font-weight: 700;
          color: #fff; margin: 0 0 8px; letter-spacing: -0.02em;
        }
        .lp-marquee-text p {
          font-family: 'Inter', sans-serif; font-size: 14px;
          color: rgba(255,255,255,0.4); margin: 0; line-height: 1.6;
        }
        .lp-marquee-track-wrapper {
          flex: 1; overflow: hidden; position: relative;
          mask-image: linear-gradient(90deg, transparent 0%, #000 10%, #000 90%, transparent 100%);
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 10%, #000 90%, transparent 100%);
          padding-left: 48px;
        }
        .lp-marquee-track {
          display: flex; align-items: center; gap: 56px;
          width: max-content;
          animation: marqueeScroll 25s linear infinite;
        }
        .lp-marquee-track:hover { animation-play-state: paused; }
        @keyframes marqueeScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .lp-marquee-logo {
          font-family: 'Bricolage Grotesque', sans-serif; font-size: 26px; font-weight: 700;
          color: rgba(255,255,255,0.35); white-space: nowrap;
          transition: color 0.3s; flex-shrink: 0;
          display: flex; align-items: center; gap: 14px;
          letter-spacing: -0.01em;
        }
        .lp-marquee-logo:hover { color: rgba(255,255,255,0.7); }
        .lp-marquee-logo svg { flex-shrink: 0; width: 32px; height: 32px; }
        @media (max-width: 768px) {
          .lp-marquee-inner { flex-direction: column; gap: 32px; }
          .lp-marquee-text { border-right: none; padding-right: 0; text-align: center; min-width: auto; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 32px; width: 100%; }
          .lp-marquee-track-wrapper { padding-left: 0; }
        }

        /* Scrollytelling Timeline — FXIFY curved style */
        .st-section { position: relative; padding: 60px 24px; overflow: hidden; }
        .st-inner { max-width: 1200px; margin: 0 auto; position: relative; }
        .st-header { text-align: center; margin-bottom: 100px; }
        .st-header h2 {
          font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(2.5rem, 5vw, 3.8rem);
          font-weight: 800; color: #fff; letter-spacing: -0.04em;
          line-height: 1.1; margin: 24px 0 0;
        }
        .st-header p {
          font-family: 'Inter', sans-serif; font-size: 15px;
          color: rgba(255,255,255,0.3); margin: 20px auto 0; max-width: 400px;
        }
        .st-timeline { position: relative; min-height: 200px; }
        .st-curve-svg {
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none; z-index: 1;
        }
        .st-curve-bg {
          fill: none; stroke: rgba(255,255,255,0.03); stroke-width: 1;
          stroke-linecap: round; stroke-dasharray: 8 12;
        }
        /* Wide soft aurora glow */
        .st-curve-glow-wide {
          fill: none; stroke: rgba(70,114,236,0.06); stroke-width: 90;
          filter: blur(50px); stroke-linecap: round;
        }
        /* Medium glow */
        .st-curve-glow {
          fill: none; stroke: rgba(70,114,236,0.14); stroke-width: 24;
          filter: blur(18px); stroke-linecap: round;
        }
        /* Tight bright glow */
        .st-curve-glow-tight {
          fill: none; stroke: rgba(107,147,255,0.3); stroke-width: 8;
          filter: blur(5px); stroke-linecap: round;
        }
        /* Core line */
        .st-curve-fill {
          fill: none; stroke: url(#stGrad); stroke-width: 2;
          stroke-linecap: round;
        }
        /* White-hot center */
        .st-curve-core {
          fill: none; stroke: rgba(255,255,255,0.6); stroke-width: 0.8;
          stroke-linecap: round;
        }
        /* Comet trail — bright section near the airplane that fades */
        .st-curve-trail {
          fill: none; stroke: url(#trailGrad); stroke-width: 4;
          filter: blur(1px); stroke-linecap: round;
        }
        /* Flowing particles along the drawn path */
        .st-curve-particles {
          fill: none; stroke: rgba(107,147,255,0.7); stroke-width: 2;
          stroke-linecap: round; stroke-dasharray: 3 40;
          animation: stParticleFlow 3s linear infinite;
        }
        @keyframes stParticleFlow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -86; }
        }
        /* Shimmer pulse on the filled line */
        .st-curve-shimmer {
          fill: none; stroke: rgba(255,255,255,0.15); stroke-width: 3;
          stroke-linecap: round;
          animation: stShimmer 2.5s ease-in-out infinite;
        }
        @keyframes stShimmer {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        /* Dot follow glow - large ambient */
        .st-dot-ambient {
          fill: rgba(70,114,236,0.15);
          filter: blur(30px);
          transition: cx 0.05s linear, cy 0.05s linear;
        }
        /* Dot outer ring pulse */
        .st-dot-ring {
          fill: none; stroke: rgba(70,114,236,0.4); stroke-width: 2;
          animation: stPulseRing 2s ease-in-out infinite;
        }
        @keyframes stPulseRing {
          0%, 100% { r: 14; opacity: 0.4; }
          50% { r: 22; opacity: 0; }
        }
        /* Paper airplane icon */
        .st-plane-icon {
          filter: drop-shadow(0 0 6px rgba(107,147,255,1)) drop-shadow(0 0 16px rgba(70,114,236,0.8)) drop-shadow(0 0 36px rgba(70,114,236,0.4));
        }
        .st-plane-glow {
          fill: rgba(70,114,236,0.5);
          filter: blur(10px);
        }
        /* Background glow that follows dot */
        .st-bg-glow {
          position: absolute; width: 400px; height: 400px; border-radius: 50%;
          background: radial-gradient(circle, rgba(70,114,236,0.12) 0%, rgba(70,114,236,0.04) 40%, transparent 70%);
          pointer-events: none; z-index: 0;
          transform: translate(-50%, -50%);
          transition: left 0.1s linear, top 0.1s linear, opacity 0.3s;
          filter: blur(20px);
        }
        .st-steps-wrapper {
          position: relative; z-index: 2;
          display: flex; flex-direction: column;
        }
        .st-step {
          position: relative; display: flex; align-items: flex-start;
          min-height: 280px;
          opacity: 0; transform: translateY(40px) scale(0.96);
          transition: opacity 1s cubic-bezier(0.16,1,0.3,1), transform 1s cubic-bezier(0.16,1,0.3,1);
        }
        .st-step.visible { opacity: 1; transform: translateY(0) scale(1); }
        .st-step:last-child { min-height: 180px; }

        .st-step-content {
          max-width: 380px; position: relative; padding: 24px 24px 24px 28px;
          background: rgba(6,8,20,0.9);
          border: 1px solid rgba(70,114,236,0.1);
          border-radius: 16px;
          backdrop-filter: blur(12px);
          z-index: 3;
          box-shadow: 0 0 0 1px rgba(70,114,236,0.05), 0 4px 24px rgba(0,0,0,0.4);
          transition: border-color 0.6s, box-shadow 0.6s;
        }
        .st-step.visible .st-step-content {
          border-color: rgba(70,114,236,0.2);
          box-shadow: 0 0 0 1px rgba(70,114,236,0.08), 0 0 30px rgba(70,114,236,0.08), 0 4px 24px rgba(0,0,0,0.4);
        }
        .st-step-content::before {
          content: ''; position: absolute; left: 0; top: 16px; bottom: 16px;
          width: 3px; background: linear-gradient(180deg, #4672ec, #6b93ff, transparent);
          border-radius: 3px; opacity: 0; transition: opacity 0.6s;
          box-shadow: 0 0 12px rgba(70,114,236,0.5), 0 0 4px rgba(107,147,255,0.8);
        }
        .st-step.visible .st-step-content::before { opacity: 1; }
        .st-step-content::after {
          content: ''; position: absolute; inset: -1px; border-radius: 16px;
          background: linear-gradient(135deg, rgba(70,114,236,0.15) 0%, transparent 50%, rgba(107,147,255,0.08) 100%);
          z-index: -1; opacity: 0; transition: opacity 0.6s;
          pointer-events: none;
        }
        .st-step.visible .st-step-content::after { opacity: 1; }

        .st-step:nth-child(odd) { justify-content: flex-start; padding-left: 2%; }
        .st-step:nth-child(even) { justify-content: flex-end; padding-right: 2%; }

        .st-step-plus {
          display: flex; align-items: center; gap: 10px;
          font-family: 'Bricolage Grotesque', sans-serif; font-size: 17px; font-weight: 600;
          color: #fff; margin-bottom: 12px;
        }
        .st-step-plus svg { color: #6b93ff; flex-shrink: 0; filter: drop-shadow(0 0 4px rgba(107,147,255,0.6)); }
        .st-step.visible .st-step-plus { text-shadow: 0 0 20px rgba(70,114,236,0.3); }
        .st-step p {
          font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.8;
          color: rgba(255,255,255,0.4); margin: 0;
        }

        /* Ghost step number on opposite side */
        .st-step-ghost {
          position: absolute; top: 10px;
          font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(100px, 12vw, 160px);
          font-weight: 900; line-height: 1;
          color: rgba(70,114,236,0.06);
          opacity: 0; transform: translateY(30px);
          transition: opacity 1.2s cubic-bezier(0.16,1,0.3,1), transform 1.2s cubic-bezier(0.16,1,0.3,1);
          pointer-events: none; z-index: 1; user-select: none;
        }
        .st-step.visible .st-step-ghost {
          opacity: 1; transform: translateY(0);
          color: rgba(70,114,236,0.08);
        }
        .st-step:nth-child(odd) .st-step-ghost { right: 4%; }
        .st-step:nth-child(even) .st-step-ghost { left: 4%; }

        /* Subtle dot grid background for the section */
        .st-dot-grid {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse 60% 50% at 50% 50%, black 20%, transparent 70%);
          -webkit-mask-image: radial-gradient(ellipse 60% 50% at 50% 50%, black 20%, transparent 70%);
        }

        @media (max-width: 768px) {
          .st-section { padding: 100px 16px; }
          .st-header { margin-bottom: 60px; }
          .st-curve-svg { display: none; }
          .st-step { justify-content: flex-start !important; padding-left: 0 !important; padding-right: 0 !important; min-height: 180px; }
          .st-step-content { max-width: 100%; padding-left: 20px; }
          .st-step-content::before { opacity: 1 !important; }
          .st-step-ghost { display: none; }
          .st-dot-grid { display: none; }
        }

        /* ── FAQ SECTION ── */
        @keyframes faqOrbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.1); }
          66% { transform: translate(-20px, 15px) scale(0.95); }
        }
        @keyframes faqOrbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-25px, 25px) scale(1.05); }
          66% { transform: translate(20px, -15px) scale(0.9); }
        }
        @keyframes faqBorderGlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
        @keyframes faqPlusRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(45deg); }
        }
        @keyframes faqBadgeShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        .faq-wrapper {
          position: relative;
          max-width: 1200px;
          margin: 0 auto;
          overflow: hidden;
        }
        .faq-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
        }
        .faq-orb--1 {
          width: 350px; height: 350px;
          background: radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%);
          top: -50px; left: -100px;
          animation: faqOrbFloat 12s ease-in-out infinite;
        }
        .faq-orb--2 {
          width: 280px; height: 280px;
          background: radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%);
          bottom: -40px; right: -80px;
          animation: faqOrbFloat2 14s ease-in-out infinite;
        }

        .faq-layout {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr 1.4fr;
          gap: 80px;
          align-items: start;
        }

        .faq-left {
          position: sticky;
          top: 120px;
        }
        .faq-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          border-radius: 9999px;
          background: linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.12));
          border: 1px solid rgba(59,130,246,0.2);
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          font-weight: 600;
          color: rgba(59,130,246,0.9);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 24px;
          background-size: 200% 100%;
          animation: faqBadgeShimmer 4s ease-in-out infinite;
        }
        .faq-title {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-size: clamp(2rem, 3.5vw, 2.8rem);
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.03em;
          line-height: 1.15;
          margin: 0 0 20px;
        }
        .faq-subtitle {
          font-family: 'Inter', sans-serif;
          font-size: 16px;
          color: rgba(255,255,255,0.45);
          line-height: 1.7;
          margin: 0 0 32px;
        }
        .faq-contact-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          font-weight: 500;
          color: rgba(59,130,246,0.85);
          text-decoration: none;
          transition: color 0.3s, gap 0.3s;
        }
        .faq-contact-link:hover {
          color: rgba(59,130,246,1);
          gap: 12px;
        }

        .faq-accordion {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .faq-card {
          position: relative;
          border-radius: 16px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          overflow: hidden;
          transition: border-color 0.4s, background 0.4s, box-shadow 0.4s;
        }
        .faq-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 16px;
          padding: 1px;
          background: linear-gradient(135deg, rgba(59,130,246,0.3), rgba(139,92,246,0.3));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0;
          transition: opacity 0.4s;
          pointer-events: none;
        }
        .faq-card:hover {
          border-color: rgba(59,130,246,0.15);
          background: rgba(255,255,255,0.035);
          box-shadow: 0 0 30px rgba(59,130,246,0.05);
        }
        .faq-card:hover::before {
          opacity: 1;
        }
        .faq-card--open {
          border-color: rgba(59,130,246,0.12) !important;
          background: rgba(255,255,255,0.04) !important;
          box-shadow: 0 4px 40px rgba(59,130,246,0.06) !important;
        }
        .faq-card--open::before {
          opacity: 0.6 !important;
        }

        .faq-card-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 22px 28px;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
        }
        .faq-card-num {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          font-weight: 600;
          color: rgba(59,130,246,0.5);
          flex-shrink: 0;
          width: 28px;
        }
        .faq-card-q {
          font-family: 'Inter', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
          flex: 1;
          transition: color 0.3s;
        }
        .faq-card--open .faq-card-q {
          color: #fff;
        }
        .faq-card-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.3s, border-color 0.3s, transform 0.4s cubic-bezier(0.34,1.56,0.64,1);
        }
        .faq-card--open .faq-card-icon {
          background: rgba(59,130,246,0.1);
          border-color: rgba(59,130,246,0.25);
          transform: rotate(45deg);
        }
        .faq-card-icon svg {
          color: rgba(255,255,255,0.4);
          transition: color 0.3s;
        }
        .faq-card--open .faq-card-icon svg {
          color: rgba(59,130,246,0.8);
        }

        .faq-card-body {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 0.45s cubic-bezier(0.16,1,0.3,1);
        }
        .faq-card-body--open {
          grid-template-rows: 1fr;
        }
        .faq-card-body-inner {
          overflow: hidden;
        }
        .faq-card-answer {
          padding: 0 28px 24px 68px;
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          line-height: 1.75;
          color: rgba(255,255,255,0.5);
          margin: 0;
        }

        @media (max-width: 768px) {
          .faq-layout {
            grid-template-columns: 1fr;
            gap: 48px;
          }
          .faq-left {
            position: relative;
            top: 0;
            text-align: center;
          }

          .lp-steps-grid {
            max-width: 100%;
          }

          .lp-steps-grid::before {
            left: 22px;
            transform: none;
          }

          .lp-step-item,
          .lp-step-item:nth-child(odd) {
            flex-direction: row !important;
            text-align: left !important;
            gap: 20px;
            padding: 24px 0;
          }

          .lp-step-content {
            flex: 1;
          }

          .lp-benefits-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .lp-influencers-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .lp-plans-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .lp-section-title {
            font-size: 28px !important;
          }

          .lp-hero-buttons {
            flex-direction: column;
            width: 100%;
          }
          .lp-hero-buttons a {
            width: 100%;
            justify-content: center;
          }

          .lp-footer-content {
            flex-direction: column;
            text-align: center;
          }
          .faq-card-btn { padding: 18px 20px; }
          .faq-card-answer { padding: 0 20px 20px 52px; }
          .faq-card-num { width: 24px; }
        }

        /* ── FOOTER ── */
        @keyframes footerGlowPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes footerGlowFloat {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, -15px); }
        }
        @keyframes footerGlowFloat2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-25px, 10px); }
        }
        @keyframes footerBeamSweep {
          0% { transform: translateX(-100%) rotate(-45deg); }
          100% { transform: translateX(300%) rotate(-45deg); }
        }
        @keyframes footerRayPulse1 {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes footerRayPulse2 {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes footerRayPulse3 {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.9; }
        }
        .footer-rays {
          position: absolute;
          top: 0; left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
          z-index: 0;
        }
        .footer-ray {
          position: absolute;
          top: -20%;
          transform-origin: top center;
        }
        .footer-ray--1 {
          left: 30%;
          width: 80px;
          height: 120%;
          background: linear-gradient(180deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.03) 40%, transparent 70%);
          transform: rotate(-15deg);
          filter: blur(30px);
          animation: footerRayPulse1 6s ease-in-out infinite;
        }
        .footer-ray--2 {
          left: 42%;
          width: 40px;
          height: 100%;
          background: linear-gradient(180deg, rgba(99,102,241,0.2) 0%, rgba(99,102,241,0.04) 35%, transparent 65%);
          transform: rotate(-5deg);
          filter: blur(20px);
          animation: footerRayPulse2 8s ease-in-out infinite;
        }
        .footer-ray--3 {
          left: 50%;
          width: 120px;
          height: 130%;
          background: linear-gradient(180deg, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0.05) 30%, transparent 60%);
          transform: rotate(2deg) translateX(-50%);
          filter: blur(40px);
          animation: footerRayPulse3 5s ease-in-out infinite;
        }
        .footer-ray--4 {
          left: 55%;
          width: 50px;
          height: 110%;
          background: linear-gradient(180deg, rgba(139,92,246,0.18) 0%, rgba(139,92,246,0.03) 40%, transparent 70%);
          transform: rotate(8deg);
          filter: blur(22px);
          animation: footerRayPulse1 7s ease-in-out infinite 1s;
        }
        .footer-ray--5 {
          left: 65%;
          width: 70px;
          height: 120%;
          background: linear-gradient(180deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.02) 45%, transparent 70%);
          transform: rotate(18deg);
          filter: blur(35px);
          animation: footerRayPulse2 9s ease-in-out infinite 0.5s;
        }
        @keyframes footerStarTwinkle {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        @keyframes footerGridPulse {
          0%, 100% { opacity: 0.025; }
          50% { opacity: 0.05; }
        }
        @keyframes footerTopLineGlow {
          0%, 100% { opacity: 0.5; filter: blur(0px); }
          50% { opacity: 1; filter: blur(1px); }
        }
        @keyframes footerParticleRise {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          20% { opacity: 0.6; }
          100% { transform: translateY(-80px) scale(0); opacity: 0; }
        }
        @keyframes footerLinkGlow {
          0%, 100% { text-shadow: 0 0 0 transparent; }
          50% { text-shadow: 0 0 8px rgba(59,130,246,0.3); }
        }

        .footer-main {
          position: relative;
          border-top: 1px solid rgba(255,255,255,0.06);
          overflow: hidden;
        }
        .footer-main::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.4) 30%, rgba(139,92,246,0.4) 70%, transparent);
          animation: footerTopLineGlow 4s ease-in-out infinite;
        }
        .footer-main::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0;
          width: 100%; height: 80px;
          background: linear-gradient(to top, rgba(59,130,246,0.03) 0%, transparent 100%);
          pointer-events: none;
        }
        .footer-dot-grid {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(59,130,246,0.15) 1px, transparent 1px);
          background-size: 32px 32px;
          animation: footerGridPulse 8s ease-in-out infinite;
          pointer-events: none;
          -webkit-mask-image: radial-gradient(ellipse 60% 50% at 50% 30%, rgba(0,0,0,0.4) 0%, transparent 70%);
          mask-image: radial-gradient(ellipse 60% 50% at 50% 30%, rgba(0,0,0,0.4) 0%, transparent 70%);
        }
        .footer-noise {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.3;
          overflow: hidden;
        }
        .footer-particles {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .footer-particle {
          position: absolute;
          bottom: 0;
          width: 2px;
          height: 2px;
          border-radius: 50%;
          background: rgba(59,130,246,0.4);
          animation: footerParticleRise 6s ease-out infinite;
        }
        .footer-glow {
          position: absolute;
          top: -100px;
          left: 50%;
          transform: translateX(-50%);
          width: 700px;
          height: 300px;
          background: radial-gradient(ellipse, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.04) 50%, transparent 70%);
          pointer-events: none;
          animation: footerGlowPulse 6s ease-in-out infinite;
        }
        .footer-glow-orb1 {
          position: absolute;
          top: 30%;
          left: 5%;
          width: 250px;
          height: 250px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%);
          filter: blur(60px);
          pointer-events: none;
          animation: footerGlowFloat 10s ease-in-out infinite;
        }
        .footer-glow-orb2 {
          position: absolute;
          bottom: 10%;
          right: 8%;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%);
          filter: blur(50px);
          pointer-events: none;
          animation: footerGlowFloat2 12s ease-in-out infinite;
        }
        .footer-beam {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          overflow: hidden;
          pointer-events: none;
        }
        .footer-beam::after {
          content: '';
          position: absolute;
          top: -50%; left: -50%;
          width: 30%; height: 200%;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.03), rgba(255,255,255,0.015), transparent);
          animation: footerBeamSweep 12s ease-in-out infinite;
        }
        .footer-stars {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .footer-star {
          position: absolute;
          width: 2px;
          height: 2px;
          border-radius: 50%;
          background: rgba(59,130,246,0.5);
          animation: footerStarTwinkle 4s ease-in-out infinite;
        }
        .footer-inner {
          position: relative;
          z-index: 1;
          max-width: 1200px;
          margin: 0 auto;
          padding: 72px 24px 40px;
        }
        .footer-top {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr 1fr;
          gap: 48px;
          margin-bottom: 56px;
        }
        .footer-brand {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .footer-logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .footer-logo img {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          object-fit: contain;
        }
        .footer-logo span {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-size: 22px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.02em;
        }
        .footer-brand-desc {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          line-height: 1.7;
          color: rgba(255,255,255,0.4);
          max-width: 280px;
          margin: 0;
        }
        .footer-socials {
          display: flex;
          gap: 10px;
          margin-top: 4px;
        }
        .footer-social-link {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.4);
          text-decoration: none;
          transition: all 0.3s;
        }
        .footer-social-link:hover {
          background: rgba(59,130,246,0.1);
          border-color: rgba(59,130,246,0.3);
          color: rgba(59,130,246,0.9);
          transform: translateY(-2px);
          box-shadow: 0 0 20px rgba(59,130,246,0.15), 0 4px 12px rgba(0,0,0,0.2);
        }
        .footer-col-title {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: rgba(59,130,246,0.7);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin: 0 0 20px;
          position: relative;
          padding-bottom: 12px;
        }
        .footer-col-title::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0;
          width: 24px; height: 2px;
          background: linear-gradient(90deg, rgba(59,130,246,0.5), transparent);
          border-radius: 2px;
        }
        .footer-col-links {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .footer-col-links a {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          color: rgba(255,255,255,0.35);
          text-decoration: none;
          transition: color 0.3s, transform 0.3s, text-shadow 0.3s;
          display: inline-block;
        }
        .footer-col-links a:hover {
          color: rgba(255,255,255,0.85);
          transform: translateX(4px);
          text-shadow: 0 0 12px rgba(59,130,246,0.2);
        }

        .footer-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.15) 30%, rgba(139,92,246,0.15) 70%, transparent);
          margin-bottom: 32px;
          position: relative;
        }
        .footer-divider::after {
          content: '';
          position: absolute;
          top: -4px; left: 50%;
          transform: translateX(-50%);
          width: 200px;
          height: 8px;
          background: radial-gradient(ellipse, rgba(59,130,246,0.15) 0%, transparent 70%);
          filter: blur(4px);
        }
        .footer-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        .footer-copy {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: rgba(255,255,255,0.25);
          margin: 0;
        }
        .footer-bottom-links {
          display: flex;
          gap: 24px;
        }
        .footer-bottom-links a {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: rgba(255,255,255,0.25);
          text-decoration: none;
          transition: color 0.3s;
        }
        .footer-bottom-links a:hover {
          color: rgba(255,255,255,0.6);
        }

        @media (max-width: 768px) {
          .footer-top {
            grid-template-columns: 1fr;
            gap: 40px;
          }
          .footer-bottom {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
        }

        /* ── CTA SECTION ── */
        @keyframes ctaBeamSweep {
          0% { transform: translateX(-100%) rotate(-45deg); }
          100% { transform: translateX(200%) rotate(-45deg); }
        }
        @keyframes ctaGlowPulse {
          0%, 100% { opacity: 0.15; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.3; transform: translate(-50%, -50%) scale(1.15); }
        }
        @keyframes ctaGlowPulse2 {
          0%, 100% { opacity: 0.1; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.22; transform: translate(-50%, -50%) scale(1.1); }
        }
        @keyframes ctaShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes ctaPulseRing {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
        }
        @keyframes ctaStarTwinkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }

        .cta-section {
          position: relative;
          padding: 80px 24px;
          text-align: center;
          overflow: hidden;
        }
        .cta-glow-center {
          position: absolute;
          top: 45%; left: 50%;
          width: 600px; height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(99,102,241,0.08) 40%, transparent 70%);
          filter: blur(60px);
          animation: ctaGlowPulse 6s ease-in-out infinite;
          pointer-events: none;
        }
        .cta-glow-accent {
          position: absolute;
          top: 50%; left: 50%;
          width: 400px; height: 400px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 60%);
          filter: blur(50px);
          animation: ctaGlowPulse2 8s ease-in-out infinite;
          pointer-events: none;
        }
        .cta-beam {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          overflow: hidden;
          pointer-events: none;
        }
        .cta-beam::after {
          content: '';
          position: absolute;
          top: -50%; left: -50%;
          width: 40%; height: 200%;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.04), rgba(255,255,255,0.02), transparent);
          animation: ctaBeamSweep 8s ease-in-out infinite;
        }
        .cta-stars {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .cta-star {
          position: absolute;
          width: 3px; height: 3px;
          border-radius: 50%;
          background: rgba(255,255,255,0.6);
          animation: ctaStarTwinkle 3s ease-in-out infinite;
        }

        .cta-content {
          position: relative;
          z-index: 1;
        }
        .cta-title {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-size: clamp(2.4rem, 5vw, 3.6rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin: 0 0 24px;
          background: linear-gradient(135deg, #fff 0%, rgba(200,210,255,0.85) 40%, #fff 60%, rgba(180,190,255,0.8) 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: ctaShimmer 5s ease-in-out infinite;
        }
        .cta-line {
          display: block;
          width: 60px;
          height: 2px;
          margin: 0 auto 28px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.5), rgba(139,92,246,0.5), transparent);
          border-radius: 2px;
        }
        .cta-desc {
          font-family: 'Inter', sans-serif;
          font-size: 18px;
          color: rgba(255,255,255,0.45);
          max-width: 460px;
          margin: 0 auto 48px;
          line-height: 1.7;
        }
        .cta-btn-wrap {
          position: relative;
          display: inline-flex;
        }
        .cta-pulse {
          position: absolute;
          top: 50%; left: 50%;
          width: 100%; height: 100%;
          border-radius: 9999px;
          border: 1px solid rgba(59,130,246,0.3);
          animation: ctaPulseRing 3s ease-out infinite;
          pointer-events: none;
        }
        .cta-btn {
          position: relative;
          z-index: 1;
          color: #fff;
          padding: 20px 48px;
          border-radius: 9999px;
          text-decoration: none;
          font-family: 'Inter', sans-serif;
          font-size: 17px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #3b82f6, #6366f1);
          box-shadow: 0 0 40px rgba(59,130,246,0.3), 0 0 80px rgba(99,102,241,0.1);
          transition: transform 0.3s, box-shadow 0.3s;
          overflow: hidden;
        }
        .cta-btn::after {
          content: '';
          position: absolute;
          top: -50%; left: -50%;
          width: 40%; height: 200%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          animation: ctaBeamSweep 4s ease-in-out infinite;
        }
        .cta-btn:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 0 60px rgba(59,130,246,0.4), 0 0 120px rgba(99,102,241,0.15), 0 8px 32px rgba(0,0,0,0.3);
        }

        @media (max-width: 480px) {
          .lp-steps-grid::before {
            left: 22px;
          }
        }
      `}</style>

      {/* NAVBAR */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        backgroundColor: scrolled ? 'rgba(5,5,8,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.05)' : 'none',
        transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 24px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
          <img src="/replyna-logo.webp" alt="Replyna" style={{ height: '32px', width: 'auto', justifySelf: 'start' }} />
          <nav className="lp-nav-desktop" style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
            <a href="#como-funciona" onClick={(e) => scrollTo(e, 'como-funciona')} className="lp-nav-link">Como funciona</a>
            <a href="/chargeback" className="lp-nav-link">Calculadora</a>
            <a href="#precos" onClick={(e) => scrollTo(e, 'precos')} className="lp-nav-link">Precos</a>
            <a href="#faq" onClick={(e) => scrollTo(e, 'faq')} className="lp-nav-link">FAQ</a>
          </nav>
          <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <a href={getAppUrl('/login')} className="lp-nav-link">Entrar</a>
            <a href={getAppUrl('/register?trial=true')} className="lp-btn-primary" style={{ color: '#fff', padding: '10px 22px', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>Testar gratis</a>
          </div>
          <button
            className="lp-nav-mobile-toggle"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu"
            style={{ display: 'none', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '8px' }}
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(5,5,8,0.98)', backdropFilter: 'blur(20px)', zIndex: 200, display: 'flex', flexDirection: 'column', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px' }}>
            <img src="/replyna-logo.webp" alt="Replyna" style={{ height: '32px', width: 'auto' }} />
            <button onClick={() => setMobileMenuOpen(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', cursor: 'pointer', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Fechar menu">
              <X size={20} />
            </button>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            {[
              { label: 'Como funciona', id: 'como-funciona' },
              { label: 'Calculadora', href: '/chargeback' },
              { label: 'Precos', id: 'precos' },
              { label: 'FAQ', id: 'faq' },
              { label: 'Entrar', href: getAppUrl('/login') },
            ].map((item, i) => (
              <a
                key={i}
                href={item.href || `#${item.id}`}
                onClick={item.id ? (e) => scrollTo(e, item.id!) : undefined}
                style={{ color: '#fff', textDecoration: 'none', fontSize: '18px', fontWeight: 500, padding: '16px', borderRadius: '12px', transition: 'background 0.2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <a href={getAppUrl('/register')} className="lp-btn-primary" style={{ color: '#fff', padding: '16px', borderRadius: '12px', textDecoration: 'none', fontSize: '16px', fontWeight: 600, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            Comecar agora <ArrowRight size={18} />
          </a>
        </div>
      )}

      {/* HERO */}
      <section className="lp-hero-section" style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <img src="/hero-banner-1.png" alt="Hero" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, objectFit: 'cover' }} />

        {/* Hero text content */}
        <div className="lp-hero-content" style={{ position: 'relative', zIndex: 10, paddingTop: '18vh', paddingLeft: '24px', paddingRight: '24px', width: '100%', maxWidth: '760px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

          {/* Title */}
          <div
            className="lp-hero-fadeup"
            style={{ animationDelay: heroVisible ? '0.1s' : '99s', animationPlayState: heroVisible ? 'running' : 'paused' }}
          >
            <h1 style={{
              fontFamily: '"Bricolage Grotesque", sans-serif',
              fontSize: 'clamp(2.8rem, 5vw, 4rem)',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.15,
              letterSpacing: '-0.035em',
              margin: 0,
              textShadow: '0 2px 30px rgba(0,0,0,0.4)',
            }}>
              {heroLine1}
              <br />
              {heroLine2}
            </h1>
          </div>

          {/* Subtitle */}
          <div
            className="lp-hero-fadeup"
            style={{ animationDelay: heroVisible ? '0.3s' : '99s', animationPlayState: heroVisible ? 'running' : 'paused' }}
          >
            <p style={{
              fontFamily: '"Inter", sans-serif',
              fontSize: '20px',
              lineHeight: 1.7,
              color: 'rgba(255,255,255,0.80)',
              fontWeight: 400,
              textShadow: '0 2px 20px rgba(0,0,0,0.4)',
              margin: 0,
              marginTop: '20px',
            }}>
              Automatize o atendimento pos-venda da sua loja com inteligencia artificial. Resolva reclamacoes em segundos e proteja seu Shopify Payments.
            </p>
          </div>

          {/* CTA buttons */}
          <div
            className="lp-hero-fadeup"
            style={{ animationDelay: heroVisible ? '0.5s' : '99s', animationPlayState: heroVisible ? 'running' : 'paused' }}
          >
            <div className="lp-hero-btns" style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '36px', justifyContent: 'center' }}>
              <a
                href={getAppUrl('/register')}
                className="lp-btn-primary"
                style={{
                  color: '#fff', padding: '16px 32px', borderRadius: '9999px',
                  textDecoration: 'none', fontSize: '16px', fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                }}
              >
                Comecar agora <ArrowRight size={16} />
              </a>
              <a
                href="#como-funciona"
                onClick={(e) => scrollTo(e, 'como-funciona')}
                style={{
                  color: 'rgba(255,255,255,0.8)', padding: '16px 32px', borderRadius: '9999px',
                  textDecoration: 'none', fontSize: '16px', fontWeight: 500,
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
              >
                Como funciona
              </a>
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '150px', background: 'linear-gradient(to bottom, transparent, #000000)', zIndex: 2, pointerEvents: 'none' }} />
      </section>

      {/* INTEGRATIONS MARQUEE */}
      <section className="lp-marquee-section">
        <div className="lp-marquee-inner">
          <div className="lp-marquee-text">
            <h3>Nossas Integrações</h3>
            <p>Conectamos com as ferramentas<br />que você já usa</p>
          </div>
          <div className="lp-marquee-track-wrapper">
            <div className="lp-marquee-track">
              {[...Array(2)].map((_, setIdx) => (
                [
                  { name: 'Shopify', icon: <svg width="24" height="24" viewBox="0 0 256 292"><path d="M223.774 57.34c-.201-1.46-1.48-2.268-2.537-2.357-1.055-.088-23.383-1.743-23.383-1.743s-15.507-15.395-17.209-17.099c-1.703-1.703-5.029-1.185-6.32-.828-.19.053-3.386 1.046-8.678 2.68-5.18-14.906-14.322-28.604-30.405-28.604-.444 0-.901.018-1.358.044C129.31 3.407 123.644.779 118.75.779c-37.465 0-55.364 46.835-60.952 70.634-14.558 4.514-24.917 7.73-26.245 8.126-8.172 2.563-8.424 2.817-9.496 10.535C21.146 96.693 0 268.398 0 268.398l166.898 31.266 90.39-19.49S223.977 58.8 223.774 57.34zM156.515 40.848l-11.756 3.645c0-2.455-.267-6.06-.79-10.163 7.726 1.528 12.895 10.18 12.546 6.518zm-20.422 6.334l-25.376 7.867c2.455-9.437 7.093-18.86 12.78-25.042 2.122-2.31 5.09-4.86 8.543-6.35 3.38 7.046 4.12 17.02 4.053 23.525zm-16.464-34.13c2.788 0 5.09.924 7.093 2.788-10.195 4.794-21.146 16.87-25.743 41.063l-20.057 6.216C86.4 43.142 99.028 13.052 119.63 13.052z" fill="#95BF47"/><path d="M221.237 54.983c-1.055-.088-23.383-1.743-23.383-1.743s-15.507-15.395-17.209-17.099c-.637-.634-1.496-.945-2.42-1.074l-11.327 230.535 90.39-19.49S223.977 58.8 223.774 57.34c-.201-1.46-1.48-2.268-2.537-2.357z" fill="#5E8E3E"/><path d="M135.242 104.585l-11.083 32.926s-9.725-5.178-21.588-5.178c-17.418 0-18.291 10.928-18.291 13.685 0 15.023 39.161 20.795 39.161 56.024 0 27.713-17.577 45.558-41.274 45.558-28.428 0-42.94-17.686-42.94-17.686l7.6-25.09s14.932 12.834 27.524 12.834c8.241 0 11.59-6.491 11.59-11.232 0-19.616-32.133-20.491-32.133-52.724 0-27.129 19.472-53.382 58.778-53.382 15.145 0 22.656 4.265 22.656 4.265z" fill="#FFF"/></svg> },
                  { name: 'cPanel Mail', icon: <svg width="24" height="24" viewBox="0 0 256 256"><path d="M128 0C57.3 0 0 57.3 0 128s57.3 128 128 128 128-57.3 128-128S198.7 0 128 0z" fill="#FF6C2C"/><path d="M186 108h-36V82c0-12.1-9.9-22-22-22s-22 9.9-22 22v26H70c-5.5 0-10 4.5-10 10v60c0 5.5 4.5 10 10 10h116c5.5 0 10-4.5 10-10v-60c0-5.5-4.5-10-10-10zm-48 44.7V168h-20v-15.3c-5.8-3.2-10-9.3-10-16.7 0-11 9-20 20-20s20 9 20 20c0 7.4-4.2 13.5-10 16.7z" fill="#FFF"/></svg> },
                  { name: 'Locaweb', icon: <svg width="24" height="24" viewBox="0 0 256 256"><rect width="256" height="256" rx="40" fill="#0054A6"/><path d="M60 80h20v76h46v20H60V80zm76 0h20v96h-20V80zm40 0h20v76h-10l30 20h-30l-30-20v-20h20V100h-20V80z" fill="#FFF"/></svg> },
                  { name: 'Zoho Mail', icon: <svg width="24" height="24" viewBox="0 0 256 256"><path d="M30.4 0L0 30.4v195.2L30.4 256h195.2l30.4-30.4V30.4L225.6 0H30.4z" fill="#E8423F"/><path d="M196.8 77.6L128 128l-68.8-50.4v-12L128 118l68.8-52.4v12zm0 12L128 140l-68.8-50.4V192h137.6V89.6z" fill="#FFF"/></svg> },
                  { name: 'GoDaddy', icon: <svg width="24" height="24" viewBox="0 0 256 256"><path d="M128 0C57.3 0 0 57.3 0 128s57.3 128 128 128 128-57.3 128-128S198.7 0 128 0z" fill="#1BDBDB"/><path d="M183.2 96.8c-6-14.7-20.3-23.2-40.4-23.2-11 0-21 2.7-29.6 7.3-2.3-4.7-7.2-7.3-13.6-7.3-5.3 0-9.4 1.6-12.6 4.3V78h-18v90.4h18.8v-49.2c0-10.3 5.5-16 14.5-16 8.4 0 12.7 5 12.7 14.8v50.4h18.8v-49.2c0-10 5.3-16 14.3-16 8.6 0 13 5 13 14.8v50.4H180v-54.2c0-4.4-.3-8-1-11.2l4.2 5.8z" fill="#111"/></svg> },
                  { name: 'Hostinger', icon: <svg width="24" height="24" viewBox="0 0 256 303"><path d="M0 0v220.2l128 82.8 128-82.8V0H128L42.7 52.3V183l85.3 52.3 85.3-52.3V89.3L128 141.6 85.3 115V68l42.7-26L213.3 94v131.5L128 277.8 42.7 225.5V78.5L128 26l85.3 52.3" fill="#673DE6"/></svg> },
                  { name: 'Titan Email', icon: <svg width="24" height="24" viewBox="0 0 256 256"><path d="M128 0L0 74v108l128 74 128-74V74L128 0z" fill="#6C47FF"/><path d="M128 96l-48 28v56l48 28 48-28v-56l-48-28zm32 70.4L128 184l-32-17.6v-38.8L128 110l32 17.6v38.8z" fill="#FFF"/></svg> },
                  { name: 'IMAP / SMTP', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="2" stroke="#6b93ff" strokeWidth="1.5"/><path d="M2 7l10 6 10-6" stroke="#6b93ff" strokeWidth="1.5"/><circle cx="18" cy="8" r="3.5" fill="#000000" stroke="#4ade80" strokeWidth="1.2"/><path d="M16.5 8l1 1 2-2" stroke="#4ade80" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                ].map((logo, i) => (
                  <span key={`${setIdx}-${i}`} className="lp-marquee-logo">
                    {logo.icon} {logo.name}
                  </span>
                ))
              )).flat()}
            </div>
          </div>
        </div>
      </section>

      {/* SCROLLYTELLING TIMELINE */}
      <ScrollyTimeline />

      {/* NETWORK GRID — Como a Replyna funciona */}
      <section className="net-section">
        {/* Ambient glow blobs */}
        <div className="net-ambient" style={{ width: '500px', height: '500px', top: '30%', left: '10%', background: 'rgba(70,114,236,0.06)' }} />
        <div className="net-ambient" style={{ width: '400px', height: '400px', bottom: '10%', right: '10%', background: 'rgba(139,92,246,0.05)' }} />
        <div className="net-ambient" style={{ width: '300px', height: '300px', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(70,114,236,0.08)' }} />

        <AnimateIn>
          <div className="net-section-header">
            <h2>Tudo conectado ao<br />seu pos-venda</h2>
            <p>A Replyna integra e-mail, loja e IA em um unico fluxo automatizado.</p>
          </div>
        </AnimateIn>

        <AnimateIn delay={0.15}>
          <div className="net-canvas">
            {/* SVG grid lines */}
            <svg className="net-lines" viewBox="0 0 1000 640" preserveAspectRatio="xMidYMid meet">
              {/* Background grid */}
              <line className="net-line" x1="100" y1="130" x2="900" y2="130" />
              <line className="net-line" x1="100" y1="320" x2="900" y2="320" />
              <line className="net-line" x1="100" y1="510" x2="900" y2="510" />
              <line className="net-line" x1="200" y1="50" x2="200" y2="590" />
              <line className="net-line" x1="500" y1="30" x2="500" y2="610" />
              <line className="net-line" x1="800" y1="50" x2="800" y2="590" />

              {/* Animated connection lines to center */}
              <line className="net-line--animated" x1="200" y1="130" x2="430" y2="280" />
              <line className="net-line--animated" x1="800" y1="130" x2="570" y2="280" />
              <line className="net-line--animated" x1="500" y1="80" x2="500" y2="260" />
              <line className="net-line--animated" x1="200" y1="510" x2="430" y2="360" />
              <line className="net-line--animated" x1="800" y1="510" x2="570" y2="360" />
              <line className="net-line--animated" x1="500" y1="560" x2="500" y2="380" />
            </svg>

            {/* Sparkle dots at intersections */}
            {[
              { x: '20%', y: '20%', d: '0s' }, { x: '80%', y: '20%', d: '1.2s' },
              { x: '20%', y: '80%', d: '0.6s' }, { x: '80%', y: '80%', d: '1.8s' },
              { x: '50%', y: '12%', d: '0.3s' }, { x: '50%', y: '88%', d: '2.1s' },
              { x: '38%', y: '42%', d: '0.9s' }, { x: '62%', y: '42%', d: '1.5s' },
              { x: '38%', y: '58%', d: '0.4s' }, { x: '62%', y: '58%', d: '1.1s' },
              { x: '30%', y: '50%', d: '2.4s' }, { x: '70%', y: '50%', d: '0.7s' },
            ].map((s, i) => (
              <div key={i} className="net-sparkle" style={{ left: s.x, top: s.y, animationDelay: s.d }} />
            ))}

            {/* Pulse waves expanding from center */}
            <div className="net-pulse-wave" />
            <div className="net-pulse-wave" />
            <div className="net-pulse-wave" />

            {/* Data flow dots traveling from nodes to center */}
            <div className="net-data-dot" />
            <div className="net-data-dot" />
            <div className="net-data-dot" />
            <div className="net-data-dot" />
            <div className="net-data-dot" />
            <div className="net-data-dot" />

            {/* Center hub with Replyna icon */}
            <div className="net-hub">
              <div className="net-hub-ring" />
              <div className="net-hub-ring net-hub-ring--mid" />
              <div className="net-hub-ring net-hub-ring--outer" />
              <img src="/Logo Replyna.png" alt="Replyna" className="net-hub-icon" />
            </div>

            {/* Orbit nodes with Lucide icons */}
            {([
              { x: '20%', y: '20%', icon: <Mail size={26} />, label: 'E-mail recebido' },
              { x: '80%', y: '20%', icon: <Bot size={26} />, label: 'IA classifica' },
              { x: '50%', y: '8%', icon: <ShoppingBag size={26} />, label: 'Sua loja' },
              { x: '20%', y: '80%', icon: <MessageSquare size={26} />, label: 'Resposta gerada' },
              { x: '80%', y: '80%', icon: <BarChart3 size={26} />, label: 'Dashboard' },
              { x: '50%', y: '92%', icon: <CircleCheckBig size={26} />, label: 'Caso resolvido' },
            ] as const).map((node, i) => (
              <div
                key={i}
                className="net-node"
                style={{
                  left: node.x, top: node.y,
                  animation: `netNodeFloat ${3.5 + i * 0.5}s ease-in-out infinite`,
                  animationDelay: `${i * 0.4}s`,
                }}
              >
                <div className="net-node-inner">
                  {node.icon}
                </div>
                <span className="net-node-label">{node.label}</span>
              </div>
            ))}
          </div>
        </AnimateIn>

        <AnimateIn delay={0.3}>
          <div className="net-cta">
            <a
              href="#precos"
              className="lp-btn-primary"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '10px',
                padding: '16px 36px', borderRadius: '14px',
                color: '#fff', fontFamily: '"Inter", sans-serif', fontSize: '15px',
                fontWeight: 600, textDecoration: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              Comecar agora <ArrowRight size={16} />
            </a>
          </div>
        </AnimateIn>
      </section>

      {/* INFLUENCERS CAROUSEL */}
      <section className="inf-section">
        <div className="lp-glow-orb" style={{ width: '500px', height: '500px', top: '20%', right: '-150px' }} />
        <div className="lp-glow-orb" style={{ width: '400px', height: '400px', bottom: '10%', left: '-100px', background: 'radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%)' }} />
        <div className="inf-ambient-glow" />

        <AnimateIn>
          <div className="inf-header">
            <h2>Indicado por quem<br /><span>entende do assunto</span></h2>
            <p>Influenciadores e especialistas em e-commerce que confiam na Replyna.</p>
          </div>
        </AnimateIn>

        {/* Carousel cards */}
        <AnimateIn delay={0.2}>
          <InfCarousel />
        </AnimateIn>
      </section>

      {/* ABOUT — Text + MacBook 3D */}
      <AboutSection />

      {/* PRECOS */}
      <section id="precos" className="lp-section" style={{ padding: '60px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 0%, rgba(70,114,236,0.02) 50%, transparent 100%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '1280px', margin: '0 auto', position: 'relative' }}>
          <AnimateIn>
            <div style={{ textAlign: 'center', marginBottom: '72px' }}>
              <h2 style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', margin: '24px 0 0' }}>
                Simples e transparente
              </h2>
              <p style={{ fontFamily: '"Inter", sans-serif', fontSize: '17px', color: 'rgba(255,255,255,0.4)', maxWidth: '480px', margin: '16px auto 0', lineHeight: 1.6 }}>
                Escolha o plano ideal para o tamanho da sua operacao.
              </p>
            </div>
          </AnimateIn>

          <div className="pricing-grid">
            {[
              {
                name: 'Starter',
                desc: 'Ideal para quem esta comecando',
                price: 'R$ 197',
                period: '/mes',
                emails: '300',
                lojas: '1',
                features: ['Integracao com 1 loja', '300 e-mails/mes inclusos', 'R$1,00 por email extra', 'Atendimento 24 horas por dia'],
                highlight: false,
              },
              {
                name: 'Business',
                desc: 'Para operacoes em crescimento',
                price: 'R$ 397',
                period: '/mes',
                emails: '900',
                lojas: '3',
                features: ['Integracao com 3 lojas', '900 e-mails/mes inclusos', 'R$0,70 por e-mail extra', 'Atendimento 24 horas por dia'],
                highlight: true,
              },
              {
                name: 'Scale',
                desc: 'Escale sem limites',
                price: 'R$ 597',
                period: '/mes',
                emails: '1.500',
                lojas: '5',
                features: ['Integracao com 5 lojas', '1.500 e-mails/mes inclusos', 'R$0,60 por email extra', 'Atendimento 24 horas por dia'],
                highlight: false,
              },
              {
                name: 'High Scale',
                desc: 'Para grandes operacoes',
                price: 'R$ 997',
                period: '/mes',
                emails: '3.000',
                lojas: '10',
                features: ['Integracao com 10 lojas', '3.000 e-mails/mes inclusos', 'R$0,50 por email extra', 'Atendimento 24 horas por dia'],
                highlight: false,
              },
              {
                name: 'Enterprise',
                desc: 'Solucao personalizada',
                price: 'Sob consulta',
                period: '',
                emails: 'Ilimitado',
                lojas: 'Ilimitado',
                features: ['Lojas ilimitadas', 'Emails ilimitados', 'Sem custo extra por email', 'Atendimento 24 horas por dia'],
                highlight: false,
              },
            ].map((plan, i) => (
              <PricingCard key={i} plan={plan} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="lp-section" style={{ padding: '60px 24px' }}>
        <div className="faq-wrapper">
          <div className="faq-orb faq-orb--1" />
          <div className="faq-orb faq-orb--2" />

          <div className="faq-layout">
            {/* Left sticky column */}
            <AnimateIn>
              <div className="faq-left">
                <h2 className="faq-title">
                  Perguntas<br />frequentes
                </h2>
                <p className="faq-subtitle">
                  Tudo o que voce precisa saber sobre a Replyna e como ela pode transformar seu pos-venda.
                </p>
                <a href="#contato" className="faq-contact-link">
                  Ainda tem duvidas? Fale conosco <ArrowRight size={16} />
                </a>
              </div>
            </AnimateIn>

            {/* Right accordion column */}
            <div className="faq-accordion">
              {[
                { q: 'Quanto tempo leva para integrar com minha loja?', a: 'A integracao leva menos de 2 minutos. Basta conectar sua loja Shopify e seu provedor de email, e a IA ja comeca a processar e responder as mensagens automaticamente. Nao precisa de conhecimento tecnico.' },
                { q: 'A IA realmente entende reclamacoes e devolucoes?', a: 'Sim. A Replyna foi treinada com milhares de conversas reais de pos-venda do e-commerce brasileiro. Ela entende contexto, tom do cliente e sabe diferenciar uma reclamacao de uma duvida simples, respondendo de forma personalizada para cada situacao.' },
                { q: 'Posso enviar respostas manualmente?', a: 'Sim! Alem do modo automatico onde a IA responde sozinha, a Replyna tambem oferece a opcao de envio manual. Voce pode escrever e enviar suas proprias respostas diretamente pela plataforma sempre que preferir.' },
                { q: 'Como funciona o limite de emails por plano?', a: 'Cada plano inclui uma quantidade mensal de emails. Se ultrapassar o limite, emails extras sao cobrados a um valor reduzido por unidade. No plano Enterprise, o volume e ilimitado.' },
                { q: 'A Replyna funciona com quais plataformas?', a: 'Atualmente a Replyna integra exclusivamente com a Shopify. Novas plataformas estao sendo planejadas e serao adicionadas em breve.' },
                { q: 'Meus dados e dos meus clientes estao seguros?', a: 'Sim. Utilizamos criptografia de ponta a ponta e infraestrutura em nuvem com certificacoes de seguranca. Nenhum dado de cliente e compartilhado com terceiros ou usado para treinar modelos externos.' },
                { q: 'Existe periodo de teste gratuito?', a: 'Sim! Voce tem 7 dias de free trial com 30 emails inclusos para testar a plataforma sem compromisso. Nao precisa de cartao de credito para comecar.' },
              ].map((item, i) => (
                <AnimateIn key={i} delay={i * 0.06}>
                  <FaqCard num={String(i + 1).padStart(2, '0')} question={item.q} answer={item.a} />
                </AnimateIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="cta-section">
        <div className="cta-glow-center" />
        <div className="cta-glow-accent" />
        <div className="cta-beam" />
        <div className="cta-stars">
          {[
            { top: '15%', left: '12%', delay: '0s', dur: '3s' },
            { top: '25%', left: '85%', delay: '0.8s', dur: '4s' },
            { top: '70%', left: '8%', delay: '1.5s', dur: '3.5s' },
            { top: '60%', left: '90%', delay: '2s', dur: '2.8s' },
            { top: '80%', left: '30%', delay: '0.5s', dur: '3.2s' },
            { top: '10%', left: '60%', delay: '1.8s', dur: '4.2s' },
            { top: '45%', left: '5%', delay: '2.5s', dur: '3s' },
            { top: '35%', left: '95%', delay: '1s', dur: '3.8s' },
          ].map((s, i) => (
            <div key={i} className="cta-star" style={{ top: s.top, left: s.left, animationDelay: s.delay, animationDuration: s.dur }} />
          ))}
        </div>

        <AnimateIn>
          <div className="cta-content">
            <h2 className="cta-title">Pronto para automatizar?</h2>
            <span className="cta-line" />
            <p className="cta-desc">
              Comece gratis e veja a IA resolver reclamacoes pela sua loja em segundos.
            </p>
            <div className="cta-btn-wrap">
              <span className="cta-pulse" />
              <span className="cta-pulse" style={{ animationDelay: '1s' }} />
              <a href={getAppUrl('/register')} className="cta-btn">
                Comecar agora gratis <ArrowRight size={18} />
              </a>
            </div>
          </div>
        </AnimateIn>
      </section>

      {/* FOOTER */}
      <footer className="footer-main">
        <div className="footer-rays">
          <div className="footer-ray footer-ray--1" />
          <div className="footer-ray footer-ray--2" />
          <div className="footer-ray footer-ray--3" />
          <div className="footer-ray footer-ray--4" />
          <div className="footer-ray footer-ray--5" />
        </div>
        <div className="footer-dot-grid" />
        <div className="footer-noise">
          <svg width="100%" height="100%"><filter id="footerNoise"><feTurbulence baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter="url(#footerNoise)" opacity="0.06" /></svg>
        </div>
        <div className="footer-glow" />
        <div className="footer-glow-orb1" />
        <div className="footer-glow-orb2" />
        <div className="footer-beam" />
        <div className="footer-particles">
          {[
            { left: '10%', delay: '0s', dur: '5s' },
            { left: '25%', delay: '1.5s', dur: '6s' },
            { left: '40%', delay: '3s', dur: '5.5s' },
            { left: '55%', delay: '0.8s', dur: '7s' },
            { left: '70%', delay: '2.2s', dur: '4.5s' },
            { left: '85%', delay: '4s', dur: '6.5s' },
          ].map((p, i) => (
            <div key={i} className="footer-particle" style={{ left: p.left, animationDelay: p.delay, animationDuration: p.dur }} />
          ))}
        </div>
        <div className="footer-stars">
          {[
            { top: '20%', left: '15%', delay: '0s' },
            { top: '40%', left: '88%', delay: '1.2s' },
            { top: '65%', left: '25%', delay: '2.4s' },
            { top: '30%', left: '72%', delay: '0.6s' },
            { top: '75%', left: '60%', delay: '1.8s' },
            { top: '15%', left: '45%', delay: '3s' },
            { top: '55%', left: '8%', delay: '0.9s' },
            { top: '85%', left: '92%', delay: '2.1s' },
            { top: '50%', left: '35%', delay: '1.5s' },
            { top: '10%', left: '80%', delay: '3.3s' },
          ].map((s, i) => (
            <div key={i} className="footer-star" style={{ top: s.top, left: s.left, animationDelay: s.delay }} />
          ))}
        </div>
        <div className="footer-inner">
          <div className="footer-top">
            {/* Brand column */}
            <div className="footer-brand">
              <div className="footer-logo">
                <img src="/replyna-logo.webp" alt="Replyna" style={{ width: 'auto', height: '32px', borderRadius: 0 }} />
              </div>
              <p className="footer-brand-desc">
                Automatize seu pos-venda com IA. Respostas inteligentes para reclamacoes, trocas e devolucoes.
              </p>
              <div className="footer-socials">
                {/* WhatsApp */}
                <a href="https://wa.me/" target="_blank" rel="noopener noreferrer" className="footer-social-link" aria-label="WhatsApp">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
                {/* Instagram */}
                <a href="https://www.instagram.com/replyna.me/" target="_blank" rel="noopener noreferrer" className="footer-social-link" aria-label="Instagram">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                </a>
                {/* Facebook */}
                <a href="https://www.facebook.com/replyna.ia" target="_blank" rel="noopener noreferrer" className="footer-social-link" aria-label="Facebook">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                {/* Email */}
                <a href="mailto:contato@replyna.com" className="footer-social-link" aria-label="Email">
                  <Mail size={18} />
                </a>
              </div>
            </div>

            {/* Produto */}
            <div>
              <p className="footer-col-title">Produto</p>
              <ul className="footer-col-links">
                <li><a href="#como-funciona">Como funciona</a></li>
                <li><a href="#precos">Precos</a></li>
                <li><a href="#faq">FAQ</a></li>
                <li><a href={getAppUrl('/register')}>Comecar gratis</a></li>
              </ul>
            </div>

            {/* Conta */}
            <div>
              <p className="footer-col-title">Conta</p>
              <ul className="footer-col-links">
                <li><a href={getAppUrl('/login')}>Login</a></li>
                <li><a href={getAppUrl('/register')}>Criar conta</a></li>
                <li><a href="/masterclass">Masterclass</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="footer-col-title">Legal</p>
              <ul className="footer-col-links">
                <li><a href="/privacidade">Politica de privacidade</a></li>
                <li><a href="/privacidade">LGPD</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-divider" />
          <div className="footer-bottom">
            <p className="footer-copy">&copy; {new Date().getFullYear()} Replyna. Todos os direitos reservados.</p>
            <div className="footer-bottom-links">
              <a href="/privacidade">Privacidade</a>
              <a href={getAppUrl('/login')}>Login</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function ScrollyTimeline() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const [progress, setProgress] = useState(0)
  const [visibleSteps, setVisibleSteps] = useState<boolean[]>([false, false, false, false])
  const [dotPos, setDotPos] = useState({ x: 0, y: 0, angle: 0 })

  const steps = [
    { title: 'Conecte seu e-mail', desc: 'Vincule o e-mail da sua loja (IMAP/SMTP de qualquer provedor). A Replyna começa a monitorar reclamações em tempo real.' },
    { title: 'A IA classifica automaticamente', desc: 'Cada e-mail recebido é categorizado instantaneamente: troca, devolução, atraso, defeito, chargeback e mais. Sem regras manuais.' },
    { title: 'Respostas geradas em segundos', desc: 'A IA gera respostas personalizadas com o tom ideal, baseadas nas políticas da sua loja e no histórico do pedido.' },
    { title: 'Acompanhe os resultados', desc: 'Dashboard com métricas em tempo real: tempo de resposta, satisfação, economia gerada e taxa de resolução automática.' },
  ]

  // Curve nodes: wide S-curve like FXIFY — nodes spread far apart
  const nodeXPcts = [20, 80, 20, 80]
  const svgW = 1000
  const stepH = 280
  const totalH = stepH * (steps.length - 1) + 280
  const numSteps = steps.length
  const points = steps.map((_, i) => ({
    x: (nodeXPcts[i] / 100) * svgW,
    y: stepH * i + 200,
  }))

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const onScroll = () => {
      const timeline = section.querySelector('.st-timeline') as HTMLElement
      if (!timeline) return

      const tRect = timeline.getBoundingClientRect()
      const viewMid = window.innerHeight * 0.6
      const raw = (viewMid - tRect.top) / tRect.height
      const p = Math.max(0, Math.min(1, raw))
      setProgress(p)

      if (pathRef.current) {
        const len = pathRef.current.getTotalLength()
        const dist = p * len
        const pt = pathRef.current.getPointAtLength(dist)
        // Get tangent angle by sampling two nearby points
        const delta = 2
        const pt1 = pathRef.current.getPointAtLength(Math.max(0, dist - delta))
        const pt2 = pathRef.current.getPointAtLength(Math.min(len, dist + delta))
        const angle = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x) * (180 / Math.PI)
        setDotPos({ x: pt.x, y: pt.y, angle })

        // Steps appear when the dot reaches each node
        const next = new Array(numSteps).fill(false)
        for (let i = 0; i < numSteps; i++) {
          const nodeThreshold = i / (numSteps - 1)
          if (p >= nodeThreshold - 0.08) next[i] = true
        }
        setVisibleSteps(next)
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [numSteps])

  // Build wide sweeping S-curve like FXIFY
  let pathD = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i]
    const next = points[i + 1]
    const midY = (curr.y + next.y) / 2
    const cpX1 = curr.x + (curr.x < next.x ? -80 : 80)
    const cpX2 = next.x + (next.x < curr.x ? 80 : -80)
    pathD += ` C ${cpX1} ${midY}, ${cpX2} ${midY}, ${next.x} ${next.y}`
  }
  const pathLen = 2800

  return (
    <section id="como-funciona" className="st-section" ref={sectionRef}>
      <div className="st-dot-grid" />
      <div className="lp-glow-orb" style={{ width: '500px', height: '500px', top: '15%', right: '-150px' }} />
      <div className="lp-glow-orb" style={{ width: '400px', height: '400px', bottom: '10%', left: '-100px' }} />
      <div className="st-inner">
        <div className="st-header">
          <h2>Como funciona</h2>
          <p>Da conexão ao resultado em minutos.</p>
        </div>

        <div className="st-timeline">
          {/* Background radial glow that follows the dot */}
          {progress > 0.01 && (
            <div
              className="st-bg-glow"
              style={{
                left: `${((dotPos.x || points[0].x) / svgW) * 100}%`,
                top: `${((dotPos.y || points[0].y) / totalH) * 100}%`,
                opacity: Math.min(1, progress * 3),
              }}
            />
          )}
          <svg className="st-curve-svg" viewBox={`0 0 ${svgW} ${totalH}`} preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="stGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4672ec" />
                <stop offset="100%" stopColor="#6b93ff" />
              </linearGradient>
              {/* Trail gradient: bright at front (near airplane), fading behind */}
              <linearGradient id="trailGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(107,147,255,0)" />
                <stop offset="85%" stopColor="rgba(107,147,255,0)" />
                <stop offset="95%" stopColor="rgba(107,147,255,0.6)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.9)" />
              </linearGradient>
              <radialGradient id="dotGlow">
                <stop offset="0%" stopColor="rgba(107,147,255,0.5)" />
                <stop offset="100%" stopColor="rgba(70,114,236,0)" />
              </radialGradient>
            </defs>
            {/* Wide ambient aurora glow */}
            <path d={pathD} className="st-curve-glow-wide"
              strokeDasharray={pathLen}
              strokeDashoffset={pathLen - pathLen * progress}
            />
            {/* Medium glow */}
            <path d={pathD} className="st-curve-glow"
              strokeDasharray={pathLen}
              strokeDashoffset={pathLen - pathLen * progress}
            />
            {/* Faint dashed background (full path) */}
            <path d={pathD} className="st-curve-bg" />
            {/* Tight bright glow */}
            <path d={pathD} className="st-curve-glow-tight"
              strokeDasharray={pathLen}
              strokeDashoffset={pathLen - pathLen * progress}
            />
            {/* Main filled curve */}
            <path
              ref={pathRef}
              d={pathD}
              className="st-curve-fill"
              strokeDasharray={pathLen}
              strokeDashoffset={pathLen - pathLen * progress}
            />
            {/* White-hot center line */}
            <path d={pathD} className="st-curve-core"
              strokeDasharray={pathLen}
              strokeDashoffset={pathLen - pathLen * progress}
            />
            {/* Comet energy trail near the airplane */}
            <path d={pathD} className="st-curve-trail"
              strokeDasharray={`${pathLen * 0.12} ${pathLen * 0.88}`}
              strokeDashoffset={pathLen - pathLen * progress}
            />
            {/* Shimmer pulse on drawn portion */}
            <path d={pathD} className="st-curve-shimmer"
              strokeDasharray={`${pathLen * 0.05} ${pathLen * 0.15}`}
              strokeDashoffset={pathLen - pathLen * progress}
            />
            {/* Flowing particles */}
            {progress > 0.05 && (
              <path d={pathD} className="st-curve-particles"
                strokeDasharray="3 40"
                style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}
              />
            )}
            {/* Static node dots */}
            {points.map((pt, i) => {
              const active = visibleSteps[i]
              return (
                <g key={i}>
                  {active && <circle cx={pt.x} cy={pt.y} r="20" fill="url(#dotGlow)" style={{ transition: 'opacity 0.6s' }} />}
                  <circle
                    cx={pt.x} cy={pt.y} r={active ? 5 : 4}
                    fill={active ? '#fff' : 'rgba(255,255,255,0.1)'}
                    stroke={active ? 'rgba(107,147,255,0.8)' : 'rgba(255,255,255,0.1)'}
                    strokeWidth="2"
                    style={{ transition: 'all 0.6s', filter: active ? 'drop-shadow(0 0 6px rgba(107,147,255,0.8))' : 'none' }}
                  />
                </g>
              )
            })}
            {/* Moving paper airplane */}
            {progress > 0.01 && (() => {
              const dx = dotPos.x || points[0].x
              const dy = dotPos.y || points[0].y
              const ang = dotPos.angle || 0
              return (
                <g>
                  {/* Glows stay at position without rotation */}
                  <circle className="st-dot-ambient" cx={dx} cy={dy} r="60" />
                  <circle className="st-plane-glow" cx={dx} cy={dy} r="18" />
                  <circle className="st-dot-ring" cx={dx} cy={dy} r="16" />
                  {/* Airplane rotates to follow the curve direction */}
                  <g transform={`translate(${dx}, ${dy}) rotate(${ang})`}>
                    <g className="st-plane-icon" transform="translate(-12, -12)">
                      <path d="M2.5 2L22 12L2.5 22L6 12L2.5 2Z" fill="white" stroke="none" />
                      <path d="M6 12H22" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    </g>
                  </g>
                </g>
              )
            })()}
          </svg>

          <div className="st-steps-wrapper">
            {steps.map((step, i) => (
              <div
                key={i}
                className={`st-step${visibleSteps[i] ? ' visible' : ''}`}
                style={{ minHeight: i === steps.length - 1 ? '180px' : '280px' }}
              >
                {/* Ghost number on opposite side */}
                <span className="st-step-ghost">{String(i + 1).padStart(2, '0')}</span>
                <div className="st-step-content">
                  <div className="st-step-plus">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    {step.title}
                  </div>
                  <p>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

const INF_DATA = [
  {
    name: 'Guilherme Smith',
    img: '/influencers/guilherme-smith.webp',
    desc: 'Mentor e gestor de multiplas operacoes de Dropshipping Global. Expert em vendas e conversao.',
    followers: '120K',
    badge: 'Parceiro',
  },
  {
    name: 'Lhucas Maciel',
    img: '/influencers/lhucas-maciel.webp',
    desc: 'Criador de conteudo sobre Shopify e automacoes para lojistas.',
    followers: '85K',
    badge: 'Creator',
  },
  {
    name: 'Carlos Azevedo',
    img: '/influencers/carlos-azevedo.webp',
    desc: 'Especialista em e-commerce e consultor de operacoes digitais.',
    followers: '200K',
    badge: 'Especialista',
  },
]

// Pricing card with spotlight glow, 3D tilt, and counter animation
function PricingCard({ plan, index }: { plan: { name: string; desc: string; price: string; period: string; emails: string; lojas: string; features: string[]; highlight: boolean }; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [counter, setCounter] = useState({ emails: '0', lojas: '0' })
  const counted = useRef(false)
  const { ref: viewRef, visible } = useInView(0.3)

  // Counter animation when visible
  useEffect(() => {
    if (!visible || counted.current) return
    counted.current = true
    const target = plan.emails === 'Ilimitado' ? 0 : parseInt(plan.emails.replace(/\./g, ''))
    const targetL = plan.lojas === 'Ilimitado' ? 0 : parseInt(plan.lojas)
    if (target === 0) { setCounter({ emails: plan.emails, lojas: plan.lojas }); return }
    const duration = 1800
    const start = performance.now()
    const fmt = (n: number) => n.toLocaleString('pt-BR')
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setCounter({
        emails: fmt(Math.floor(ease * target)),
        lojas: String(Math.floor(ease * targetL)),
      })
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [visible, plan.emails, plan.lojas])

  // Spotlight + 3D tilt
  const handleMove = (e: React.MouseEvent) => {
    const card = cardRef.current
    if (!card) return
    const r = card.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const cx = r.width / 2
    const cy = r.height / 2
    const rotX = ((y - cy) / cy) * -6
    const rotY = ((x - cx) / cx) * 6
    const scale = plan.highlight ? 1.06 : 1
    card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${scale})`
    card.style.setProperty('--spot-x', `${x}px`)
    card.style.setProperty('--spot-y', `${y}px`)
    card.style.setProperty('--spot-opacity', '1')
  }
  const handleLeave = () => {
    const card = cardRef.current
    if (!card) return
    const scale = plan.highlight ? 1.06 : 1
    card.style.transform = `perspective(800px) rotateX(0) rotateY(0) scale(${scale})`
    card.style.transition = 'transform 0.5s cubic-bezier(0.16,1,0.3,1)'
    card.style.setProperty('--spot-opacity', '0')
    setTimeout(() => { if (card) card.style.transition = '' }, 500)
  }

  const getAppUrl = (path: string) => {
    const h = window.location.hostname
    if (h === 'localhost' || h === '127.0.0.1') return path
    return `https://app.replyna.me${path}`
  }

  return (
    <AnimateIn delay={index * 0.1}>
      <div ref={(el: HTMLDivElement | null) => { (viewRef as { current: HTMLDivElement | null }).current = el; }}
        style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          ref={cardRef}
          className={`pricing-card${plan.highlight ? ' pricing-card--highlight' : ''}`}
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
        >
          <div className="pricing-spotlight" />
          <div className="pricing-noise" />
          {plan.highlight && <div className="pricing-border-glow" />}
          {plan.highlight && <div className="pricing-badge">Mais popular</div>}
          <div style={{ position: 'relative', zIndex: 3 }}>
            <div className="pricing-name">{plan.name}</div>
            <div className="pricing-desc">{plan.desc}</div>
            <div className="pricing-price">
              {plan.price}<span>{plan.period}</span>
            </div>
          </div>
          <div className="pricing-stats" style={{ position: 'relative', zIndex: 3 }}>
            <div className="pricing-stat pricing-stat--email">
              <div className="pricing-stat-label">Emails/mes</div>
              <div className="pricing-stat-value">{counter.emails}</div>
            </div>
            <div className="pricing-stat pricing-stat--loja">
              <div className="pricing-stat-label">Lojas</div>
              <div className="pricing-stat-value">{counter.lojas}</div>
            </div>
          </div>
          <div className="pricing-divider" style={{ position: 'relative', zIndex: 3 }} />
          <div className="pricing-features" style={{ position: 'relative', zIndex: 3 }}>
            {plan.features.map((f, fi) => (
              <div key={fi} className="pricing-feat">
                <CircleCheckBig size={14} />
                <span>{f}</span>
              </div>
            ))}
          </div>
          <a
            href={plan.name === 'Enterprise' ? '#contato' : getAppUrl(`/register?plan=${encodeURIComponent(plan.name)}`)}
            className={plan.highlight ? 'pricing-btn pricing-btn--primary' : 'pricing-btn'}
            style={{ position: 'relative', zIndex: 3 }}
          >
            {plan.name === 'Enterprise' ? 'Falar com vendas' : 'Selecionar plano'}
          </a>
        </div>
      </div>
    </AnimateIn>
  )
}

const ABOUT_FEED_DATA = [
  { color: 'green', text: '<strong>Troca aprovada</strong> — Pedido #7841', time: '2min' },
  { color: 'blue', text: '<strong>Reembolso processado</strong> — Pedido #7839', time: '5min' },
  { color: 'yellow', text: '<strong>Duvida respondida</strong> — Rastreio enviado', time: '8min' },
  { color: 'green', text: '<strong>Devolucao aceita</strong> — Pedido #7836', time: '12min' },
  { color: 'blue', text: '<strong>Ticket resolvido</strong> — Pedido #7833', time: '15min' },
  { color: 'yellow', text: '<strong>Status atualizado</strong> — Pedido #7830', time: '18min' },
  { color: 'green', text: '<strong>Troca concluida</strong> — Pedido #7828', time: '22min' },
]

function AboutSection() {
  const cardRef = useRef<HTMLDivElement>(null)
  const { ref: sectionRef, visible } = useInView(0.2)
  const [stats, setStats] = useState({ tickets: '0', taxa: '0', tempo: '0', emails: '0' })
  const counted = useRef(false)
  const [feedItems, setFeedItems] = useState(ABOUT_FEED_DATA.slice(0, 3))
  const feedIdx = useRef(3)

  // Counter animation
  useEffect(() => {
    if (!visible || counted.current) return
    counted.current = true
    const dur = 2000
    const start = performance.now()
    const step = (now: number) => {
      const p = Math.min((now - start) / dur, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setStats({
        tickets: Math.floor(e * 1247).toLocaleString('pt-BR'),
        taxa: (e * 98.2).toFixed(1),
        tempo: Math.floor(e * 12).toString(),
        emails: (e * 10.6).toFixed(1),
      })
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [visible])

  // Live feed rotation
  useEffect(() => {
    if (!visible) return
    const iv = setInterval(() => {
      const next = ABOUT_FEED_DATA[feedIdx.current % ABOUT_FEED_DATA.length]
      feedIdx.current++
      setFeedItems(prev => [next, ...prev.slice(0, 2)])
    }, 4000)
    return () => clearInterval(iv)
  }, [visible])

  // 3D tilt on welcome card
  const handleCardMove = (e: React.MouseEvent) => {
    const card = cardRef.current
    if (!card) return
    const r = card.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    card.style.transform = `perspective(1000px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`
  }
  const handleCardLeave = () => {
    const card = cardRef.current
    if (!card) return
    card.style.transform = 'perspective(1000px) rotateY(0) rotateX(0)'
    card.style.transition = 'transform 0.5s cubic-bezier(0.16,1,0.3,1)'
    setTimeout(() => { if (card) card.style.transition = '' }, 500)
  }

  // Spotlight on feature cards
  const handleFeatMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.style.setProperty('--feat-x', `${e.clientX - r.left}px`)
    el.style.setProperty('--feat-y', `${e.clientY - r.top}px`)
    el.style.setProperty('--feat-spot', '1')
  }
  const handleFeatLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--feat-spot', '0')
  }

  return (
    <section className="about-section" ref={(el: HTMLDivElement | null) => { (sectionRef as { current: HTMLDivElement | null }).current = el; }}>
      <div className="about-row">
        {/* Left */}
        <div className="about-left">
          <AnimateIn>
            <div className="about-badge">
              <Bot size={16} />
              Pos-Venda Autonomo
            </div>

            <h2>Enquanto voce dorme,<br />a Replyna <span>resolve.</span></h2>
          </AnimateIn>

          <div className="about-features">
            <AnimateIn delay={0.15}>
              <div className="about-feat" onMouseMove={handleFeatMove} onMouseLeave={handleFeatLeave}>
                <div className="about-feat-spotlight" />
                <div className="about-feat-icon"><Zap size={18} /></div>
                <p>Responde em menos de 30 segundos, 24 horas por dia, sem intervencao humana.</p>
              </div>
            </AnimateIn>
            <AnimateIn delay={0.25}>
              <div className="about-feat" onMouseMove={handleFeatMove} onMouseLeave={handleFeatLeave}>
                <div className="about-feat-spotlight" />
                <div className="about-feat-icon"><MessageSquare size={18} /></div>
                <p>Le, entende e responde com o tom da sua marca. Como alguem da sua equipe.</p>
              </div>
            </AnimateIn>
            <AnimateIn delay={0.35}>
              <div className="about-feat" onMouseMove={handleFeatMove} onMouseLeave={handleFeatLeave}>
                <div className="about-feat-spotlight" />
                <div className="about-feat-icon"><BarChart3 size={18} /></div>
                <p>Resolve 95% dos casos sozinha. Voce so acompanha pelo dashboard.</p>
              </div>
            </AnimateIn>
          </div>
        </div>

        {/* Right — welcome card */}
        <AnimateIn delay={0.3}>
          <div className="about-card-wrap">
            <div className="about-card-glow" />
            <div className="about-card-glow-2" />
            <div
              ref={cardRef}
              className="about-card"
              onMouseMove={handleCardMove}
              onMouseLeave={handleCardLeave}
            >
              <div className="about-card-border-spin" />
              <div className="about-card-noise" />
              <div className="about-card-head">
                <div className="about-card-avatar"><img src="/Logo Replyna.png" alt="Replyna" style={{ width: '38px', height: '38px', objectFit: 'contain' }} /></div>
                <div className="about-card-greet">
                  <strong>Bem-vindo a Replyna</strong>
                  <span>Seu pos-venda esta no piloto automatico</span>
                </div>
              </div>

              <div className="about-card-stats">
                <div className="about-card-stat">
                  <div className="about-card-stat-val">{stats.tickets}</div>
                  <div className="about-card-stat-label">Tickets resolvidos hoje</div>
                </div>
                <div className="about-card-stat">
                  <div className="about-card-stat-val"><span className="about-card-stat-accent">{stats.taxa}</span>%</div>
                  <div className="about-card-stat-label">Taxa de resolucao</div>
                </div>
                <div className="about-card-stat">
                  <div className="about-card-stat-val">{stats.tempo}s</div>
                  <div className="about-card-stat-label">Tempo medio resposta</div>
                </div>
                <div className="about-card-stat">
                  <div className="about-card-stat-val">{stats.emails}<span className="about-card-stat-accent">k</span></div>
                  <div className="about-card-stat-label">E-mails este mes</div>
                </div>
              </div>

              <div className="about-card-feed">
                <div className="about-card-feed-title">Atividade recente</div>
                {feedItems.map((item, i) => (
                  <div
                    key={`${item.text}-${feedIdx.current}-${i}`}
                    className="about-card-feed-item"
                    style={{ animation: i === 0 ? 'aboutFeedSlide 0.4s cubic-bezier(0.16,1,0.3,1) both' : undefined }}
                  >
                    <div className={`about-card-feed-dot about-card-feed-dot--${item.color}`} />
                    <div className="about-card-feed-text" dangerouslySetInnerHTML={{ __html: item.text }} />
                    <span className="about-card-feed-time">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AnimateIn>
      </div>
    </section>
  )
}

function InfCarousel() {
  const [active, setActive] = useState(0)
  const total = INF_DATA.length

  const prev = () => setActive((a) => (a - 1 + total) % total)
  const next = () => setActive((a) => (a + 1) % total)

  // Auto-advance every 5s
  useEffect(() => {
    const iv = setInterval(next, 5000)
    return () => clearInterval(iv)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getPosition = (index: number) => {
    const diff = (index - active + total) % total
    if (diff === 0) return 'center'
    if (diff === 1) return 'right'
    if (diff === total - 1) return 'left'
    if (diff <= Math.floor(total / 2)) return 'hidden-right'
    return 'hidden-left'
  }

  return (
    <div className="inf-carousel-wrapper">
      <div className="inf-carousel">
        {INF_DATA.map((inf, i) => {
          const pos = getPosition(i)
          return (
            <div
              key={i}
              className={`inf-card inf-card--${pos}`}
              onClick={() => {
                if (pos === 'left') prev()
                if (pos === 'right') next()
              }}
            >
              <div className="inf-card-glow" />
              <div className="inf-card-inner">
                <img src={inf.img} alt={inf.name} loading="lazy" />
                <div className="inf-card-shimmer" />
                <div className="inf-card-overlay">
                  <div className="inf-card-info">
                    <div className="inf-card-name">{inf.name}</div>
                    <div className="inf-card-desc">{inf.desc}</div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="inf-nav">
        <button className="inf-nav-btn" aria-label="Anterior" onClick={prev}>
          <ChevronLeft size={22} />
        </button>
        <button className="inf-nav-btn" aria-label="Proximo" onClick={next}>
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="inf-dots">
        {INF_DATA.map((_, i) => (
          <div
            key={i}
            className={`inf-dot ${i === active ? 'inf-dot--active' : ''}`}
            onClick={() => setActive(i)}
          />
        ))}
      </div>
    </div>
  )
}

function FaqCard({ num, question, answer }: { num: string; question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`faq-card ${open ? 'faq-card--open' : ''}`}>
      <button className="faq-card-btn" onClick={() => setOpen(!open)}>
        <span className="faq-card-num">{num}</span>
        <span className="faq-card-q">{question}</span>
        <span className="faq-card-icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="7" y1="2" x2="7" y2="12" />
            <line x1="2" y1="7" x2="12" y2="7" />
          </svg>
        </span>
      </button>
      <div className={`faq-card-body ${open ? 'faq-card-body--open' : ''}`}>
        <div className="faq-card-body-inner">
          <p className="faq-card-answer">{answer}</p>
        </div>
      </div>
    </div>
  )
}
