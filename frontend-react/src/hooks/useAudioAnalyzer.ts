import { useEffect, useRef, useState } from 'react'

export const useAudioAnalyzer = (fftSize: number = 8192) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [freqData, setFreqData] = useState<Float32Array | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const start = async () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      analyserRef.current = ctx.createAnalyser()
      analyserRef.current.fftSize = fftSize
      analyserRef.current.smoothingTimeConstant = 0.8

      sourceRef.current = ctx.createMediaStreamSource(stream)
      sourceRef.current.connect(analyserRef.current)

      const bufferLength = analyserRef.current.frequencyBinCount
      setFreqData(new Float32Array(bufferLength))
      setIsAnalyzing(true)
    } catch (err) {
      console.error('Erro ao iniciar analisador:', err)
      setIsAnalyzing(false)
    }
  }

  const stop = () => {
    setIsAnalyzing(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect()
    }
  }

  useEffect(() => {
    if (!isAnalyzing || !analyserRef.current || !freqData) return

    let animationId: number

    const update = () => {
      if (analyserRef.current && freqData) {
        analyserRef.current.getFloatFrequencyData(freqData)
        // Forçamos uma atualização do estado para que o Canvas receba o novo array (opcional se passarmos a ref)
        // Mas como o RtaCanvas usa requestAnimationFrame interno com a ref do array, 
        // só precisamos garantir que o array seja o mesmo objeto.
      }
      animationId = requestAnimationFrame(update)
    }

    update()
    return () => cancelAnimationFrame(animationId)
  }, [isAnalyzing, freqData])

  return {
    isAnalyzing,
    start,
    stop,
    freqData,
    sampleRate: audioCtxRef.current?.sampleRate || 48000,
    analyser: analyserRef.current
  }
}
