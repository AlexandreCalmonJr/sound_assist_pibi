import { useEffect, useRef } from 'react'

interface RtaCanvasProps {
  freqData: Float32Array | null
  sampleRate: number
  fftSize: number
  minDb: number
  maxDb: number
}

const IEC_CENTERS = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 
  500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 
  6300, 8000, 10000, 12500, 16000, 20000
]

const HALF_STEP = Math.pow(2, 1 / 6)

const RtaCanvas = ({ freqData, sampleRate, fftSize, minDb, maxDb }: RtaCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !freqData) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      if (!freqData) return

      const width = canvas.width
      const height = canvas.height
      const bufferLength = freqData.length

      // Limpar canvas
      ctx.fillStyle = '#0f172a' // Deep Slate Blue
      ctx.fillRect(0, 0, width, height)

      const numBands = IEC_CENTERS.length
      const spacing = 2
      const barWidth = (width - (spacing * (numBands - 1))) / numBands
      
      let x = 0

      for (let i = 0; i < numBands; i++) {
        const fc = IEC_CENTERS[i]
        const freqStart = fc / HALF_STEP
        const freqEnd = fc * HALF_STEP

        const binStart = Math.max(0, Math.floor(freqStart * fftSize / sampleRate))
        const binEnd = Math.min(bufferLength, Math.ceil(freqEnd * fftSize / sampleRate))
        
        let maxDbInBin = -120
        if (binStart >= binEnd) {
          const bin = Math.max(0, Math.round(fc * fftSize / sampleRate))
          maxDbInBin = freqData[bin] || -120
        } else {
          for (let j = binStart; j < binEnd; j++) {
            if (freqData[j] > maxDbInBin) maxDbInBin = freqData[j]
          }
        }
        
        // Cores padrão SoundMaster
        let fillStyle = '#64748b' // Default
        if (fc < 60) fillStyle = '#3b82f6'        // Sub
        else if (fc < 250) fillStyle = '#10b981'  // Low
        else if (fc < 2000) fillStyle = '#f59e0b' // Mid
        else if (fc < 6000) fillStyle = '#f97316' // High-Mid
        else fillStyle = '#ef4444'                // High

        const normalized = Math.max(0, Math.min(1, (maxDbInBin - minDb) / (maxDb - minDb)))
        const barHeight = normalized * height

        ctx.fillStyle = fillStyle
        ctx.fillRect(x, height - barHeight, barWidth, barHeight)
        x += barWidth + spacing
      }
    }

    const animationId = requestAnimationFrame(function loop() {
      draw()
      requestAnimationFrame(loop)
    })

    return () => cancelAnimationFrame(animationId)
  }, [freqData, sampleRate, fftSize, minDb, maxDb])

  return (
    <canvas 
      ref={canvasRef} 
      width={1024} 
      height={400} 
      className="w-full h-full rounded-xl"
    />
  )
}

export default RtaCanvas
