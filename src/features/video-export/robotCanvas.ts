/**
 * Canvas port of the robot in RobotStage.vue, so the exact same robot can be recorded to video.
 * It is purely a renderer: give it a RobotFrame (what the robot is doing right now) and it draws
 * the robot, spotlight and speech bubble. The geometry is copied from RobotStage's SVG.
 *
 * Head tilt, bob, squint etc. ease toward their targets (RobotStage does this with CSS
 * transitions), so the video moves like the live stage.
 */

export type Mood = 'happy' | 'wow' | null

export interface RobotNote {
  /** Seconds, same clock as RobotFrame.now. */
  born: number
  /** Pink note flying left instead of the yellow one flying up-left. */
  alt: boolean
}

export interface RobotFrame {
  /** Word sung right now ('' between words). */
  word: string
  /** Monotonic seconds (performance.now() / 1000). */
  now: number
  bob: boolean
  sing: boolean
  blink: boolean
  lean: 'l' | 'r' | null
  mood: Mood
  /** Eye offset in head-image pixels. */
  gaze: [number, number]
  /** Speaker-screen waveform, SVG coordinates. */
  wave: [number, number][]
  notes: RobotNote[]
}

export const IDLE_WAVE: [number, number][] = [
  [128, 204],
  [136, 192],
  [144, 212],
  [152, 188],
  [160, 210],
  [168, 196],
  [180, 203],
]

const INK = '#0b0614'
const NOTE_SECONDS = 1.1
const rad = (deg: number) => (deg * Math.PI) / 180
const ease = (dt: number, tau = 0.045) => 1 - Math.exp(-dt / tau)

interface EyeShape {
  cx: number
  cy: number
  angry: Path2D
  happy: Path2D
  wow: { x: number; y: number; r: number; pupil: number }
}

export class RobotCanvas {
  private ctx: CanvasRenderingContext2D
  private layer: HTMLCanvasElement
  private lctx: CanvasRenderingContext2D
  private last = 0
  private lastWord = ''
  private popAt = -10

  /** Eased values. */
  private st = { y: 0, speaker: 1, head: 0, headSx: 1, headSy: 1, mic: 0, eyeY: 1 }

  private neck = new Path2D('M100 124 L130 124 L128 164 L102 164 Z')
  private neckShade = new Path2D('M121 124 L130 124 L128 164 L120 164 Z')
  private neckRopes = new Path2D('M101 137 Q115 142 129 137M101 150 Q115 155 129 150')
  private bodyOutline = new Path2D(
    'M28 160 Q115 150 202 158 Q210 210 202 262 Q115 270 30 262 Q20 210 28 160 Z',
  )
  private bodyShade = new Path2D(
    'M182 157 Q192 157 202 158 Q210 210 202 262 Q193 263 184 263 Q192 210 182 157 Z',
  )
  private slot = new Path2D('M82 162 Q115 152 148 161 L146 171 Q115 163 84 172 Z')
  private glint = new Path2D('M58 196 Q66 188 76 188')
  private screen = new Path2D('M122 182 L188 180 L186 224 L124 224 Z')
  private micArm = new Path2D('M202 200 C230 184 228 150 212 132')
  private micHead = new Path2D('M200 98 Q212 92 224 98 L222 134 Q212 140 202 134 Z')
  private micGrill = new Path2D('M203 108 Q212 105 221 108M203 117 Q212 114 221 117')
  private noteStem = new Path2D('M11,-4 L11,-44 Q26,-38 28,-22')
  private eyes: EyeShape[] = [
    {
      cx: 190,
      cy: 212,
      angry: new Path2D('M166,187 L210,236'),
      happy: new Path2D('M150,236 Q182,188 218,230'),
      wow: { x: 190, y: 214, r: 27, pupil: 14 },
    },
    {
      cx: 386,
      cy: 237,
      angry: new Path2D('M347,259 L426,215'),
      happy: new Path2D('M344,256 Q386,204 432,244'),
      wow: { x: 388, y: 238, r: 31, pupil: 15 },
    },
  ]

  constructor(
    private canvas: HTMLCanvasElement,
    private head: HTMLImageElement,
  ) {
    this.ctx = canvas.getContext('2d')!
    this.layer = document.createElement('canvas')
    this.layer.width = canvas.width
    this.layer.height = canvas.height
    this.lctx = this.layer.getContext('2d')!
  }

  draw(f: RobotFrame): void {
    const { ctx, lctx, canvas, st } = this
    const W = canvas.width
    const dt = this.last ? Math.min(0.1, Math.max(0.001, f.now - this.last)) : 0.016
    this.last = f.now

    const a = ease(dt)
    st.y += ((f.bob ? 4 : 0) - st.y) * a
    st.speaker += ((f.bob ? 1.14 : 1) - st.speaker) * a
    st.head += ((f.lean === 'l' ? -6 : f.lean === 'r' ? 5 : 0) - st.head) * ease(dt, 0.06)
    st.headSx += ((f.sing ? 1.05 : 1) - st.headSx) * a
    st.headSy += ((f.sing ? 0.95 : 1) - st.headSy) * a
    st.mic += ((f.sing ? -6 : 0) - st.mic) * a
    st.eyeY += ((f.blink ? 0.1 : f.sing ? 0.72 : 1) - st.eyeY) * ease(dt, 0.03)

    if (f.word !== this.lastWord) {
      this.lastWord = f.word
      this.popAt = f.now
    }

    // Background and spotlight
    const bg = ctx.createLinearGradient(0, 0, 0, W)
    bg.addColorStop(0, '#2a0f45')
    bg.addColorStop(1, '#14061f')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, W)
    ctx.fillStyle = 'rgba(255, 242, 0, 0.13)'
    ctx.beginPath()
    ctx.moveTo(W * 0.4, W * 0.1)
    ctx.lineTo(W * 0.6, W * 0.1)
    ctx.lineTo(W * 0.98, W * 0.98)
    ctx.lineTo(W * 0.02, W * 0.98)
    ctx.closePath()
    ctx.fill()

    // Robot goes on its own layer so the ink drop shadow is one silhouette, like CSS drop-shadow
    const s = (W * 0.82) / 262
    const ox = (W - 214 * s) / 2
    const oy = W * 0.15
    lctx.setTransform(1, 0, 0, 1, 0, 0)
    lctx.clearRect(0, 0, W, W)
    lctx.setTransform(s, 0, 0, s, ox - 14 * s, oy + 18 * s)
    this.drawRobot(lctx, f)
    lctx.setTransform(1, 0, 0, 1, 0, 0)

    ctx.save()
    ctx.shadowColor = INK
    ctx.shadowOffsetX = 4.8 * s
    ctx.shadowOffsetY = 5.6 * s
    ctx.shadowBlur = 0
    ctx.drawImage(this.layer, 0, 0)
    ctx.restore()

    this.drawBubble(f.word || '…', f.now)
  }

  private shape(g: CanvasRenderingContext2D, p: Path2D, fill: string | null, sw: number, stroke = INK) {
    if (fill) {
      g.fillStyle = fill
      g.fill(p)
    }
    if (sw > 0) {
      g.strokeStyle = stroke
      g.lineWidth = sw
      g.stroke(p)
    }
  }

  private circle(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, sw: number) {
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fillStyle = fill
    g.fill()
    if (sw > 0) {
      g.strokeStyle = INK
      g.lineWidth = sw
      g.stroke()
    }
  }

  private drawRobot(g: CanvasRenderingContext2D, f: RobotFrame): void {
    const { st } = this
    g.lineJoin = 'round'
    g.lineCap = 'round'

    g.save()
    g.translate(0, st.y)

    // Body, scaled to 76% around (115,150) so the head leads
    g.save()
    g.translate(115, 150)
    g.scale(0.76, 0.76)
    g.translate(-115, -150)
    this.shape(g, this.neck, '#a9c1d7', 0)
    this.shape(g, this.neckShade, '#96b0c7', 0)
    this.shape(g, this.neckRopes, null, 4.5)
    this.shape(g, this.neck, null, 6)
    this.shape(g, this.bodyOutline, '#4aa9c0', 0)
    this.shape(g, this.bodyShade, '#37899f', 0)
    this.shape(g, this.bodyOutline, null, 6.5)
    this.shape(g, this.slot, '#24093a', 5)

    g.save()
    g.translate(76, 212)
    g.scale(st.speaker, st.speaker)
    g.translate(-76, -212)
    this.circle(g, 76, 212, 33, '#24093a', 5.5)
    this.circle(g, 76, 212, 13, '#4a2a8a', 4.5)
    g.globalAlpha = 0.5
    this.shape(g, this.glint, null, 3.5, '#fff7e3')
    g.globalAlpha = 1
    g.restore()

    this.shape(g, this.screen, '#0b3a4a', 5.5)
    g.beginPath()
    f.wave.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    g.strokeStyle = '#f2e04a'
    g.lineWidth = 4
    g.stroke()
    this.circle(g, 134, 244, 7, '#f2e04a', 4.5)
    this.circle(g, 155, 244, 7, '#e6589f', 4.5)
    this.circle(g, 176, 244, 7, '#5fd3a0', 4.5)
    g.restore()

    // Head: eyeless image plus redrawn eyes
    g.save()
    g.translate(113, 132)
    g.rotate(rad(st.head))
    g.scale(st.headSx, st.headSy)
    g.translate(-113, -132)
    g.translate(113, 132)
    g.rotate(rad(-9))
    g.translate(-113, -132)
    g.translate(40, 2)
    g.scale(0.29333, 0.29333)
    g.drawImage(this.head, 0, 0, 600, 511)
    g.translate(f.gaze[0], f.gaze[1])
    g.strokeStyle = '#000000'
    g.lineWidth = 13
    for (const e of this.eyes) {
      g.save()
      g.translate(e.cx, e.cy)
      g.scale(1, st.eyeY)
      g.translate(-e.cx, -e.cy)
      if (f.mood === 'wow') {
        g.lineWidth = 11
        this.circle(g, e.wow.x, e.wow.y, e.wow.r, '#ddefff', 11)
        g.beginPath()
        g.arc(e.wow.x, e.wow.y, e.wow.pupil, 0, Math.PI * 2)
        g.fillStyle = '#000000'
        g.fill()
      } else {
        g.lineWidth = 13
        g.strokeStyle = '#000000'
        g.stroke(f.mood === 'happy' ? e.happy : e.angry)
      }
      g.restore()
    }
    g.restore()

    // Mic, in front of the head
    g.save()
    g.translate(115, 150)
    g.scale(0.76, 0.76)
    g.translate(-115, -150)
    g.translate(202, 200)
    g.rotate(rad(st.mic))
    g.translate(-202, -200)
    this.shape(g, this.micArm, null, 11)
    this.shape(g, this.micHead, '#3a3a4a', 5.5)
    this.shape(g, this.micGrill, null, 3.5)
    g.restore()

    g.restore()

    // Floating notes (not affected by the bob)
    for (const n of f.notes) {
      const p = (f.now - n.born) / NOTE_SECONDS
      if (p < 0 || p > 1) continue
      const bx = n.alt ? 56 : 70
      const by = n.alt ? 206 : 184
      const dx = n.alt ? -55 : -40
      const dy = n.alt ? -20 : -55
      const sc = 0.5 + (n.alt ? 0.5 : 0.65) * p
      g.save()
      g.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3
      g.translate(bx + dx * p, by + dy * p)
      g.rotate(rad((n.alt ? 14 : -18) * p))
      g.scale(0.38 * sc, 0.38 * sc)
      g.beginPath()
      g.ellipse(0, 0, 13, 10, rad(-20), 0, Math.PI * 2)
      g.fillStyle = n.alt ? '#ff3da5' : '#fff200'
      g.fill()
      g.strokeStyle = INK
      g.lineWidth = 5
      g.stroke()
      g.stroke(this.noteStem)
      g.restore()
    }
  }

  private drawBubble(text: string, now: number): void {
    const { ctx, canvas } = this
    const W = canvas.width
    const u = W / 720
    const t = Math.min(1, Math.max(0, (now - this.popAt) / 0.22))
    const sc = 0.7 + 0.3 * (1 - Math.pow(1 - t, 3))

    let fs = Math.round(42 * u)
    const font = (size: number) => `${size}px "Luckiest Guy", sans-serif`
    ctx.save()
    ctx.font = font(fs)
    while (ctx.measureText(text).width > W * 0.72 && fs > 14) {
      fs = Math.round(fs * 0.9)
      ctx.font = font(fs)
    }
    const tw = ctx.measureText(text).width
    const w = Math.max(80 * u, tw + fs * 0.9)
    const h = fs * 1.45

    ctx.translate(W * 0.06, W * 0.05)
    ctx.rotate(rad(-3))
    ctx.translate(w * 0.2, h)
    ctx.scale(sc, sc)
    ctx.translate(-w * 0.2, -h)

    ctx.lineJoin = 'round'
    ctx.lineWidth = 4 * u
    ctx.strokeStyle = INK

    // Tail
    const tail = new Path2D()
    tail.moveTo(w * 0.1, h - 2 * u)
    tail.lineTo(w * 0.1 + 24 * u, h - 2 * u)
    tail.lineTo(w * 0.1 + 6 * u, h + 28 * u)
    tail.closePath()

    const body = new Path2D()
    body.roundRect(0, 0, w, h, [24 * u, 18 * u, 26 * u, 14 * u])

    ctx.save()
    ctx.translate(5 * u, 7 * u)
    ctx.fillStyle = INK
    ctx.fill(body)
    ctx.fill(tail)
    ctx.restore()

    ctx.fillStyle = '#f7ebcc'
    ctx.fill(tail)
    ctx.stroke(tail)
    ctx.fill(body)
    ctx.stroke(body)
    // cover the tail's top edge so tail and bubble read as one shape
    ctx.fillRect(w * 0.1 + 2 * u, h - 4 * u, 20 * u, 6 * u)

    ctx.fillStyle = '#1a0b2e'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, h / 2 + 2 * u)
    ctx.restore()
  }
}
