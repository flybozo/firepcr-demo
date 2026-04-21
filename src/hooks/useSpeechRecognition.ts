import { useState, useRef } from 'react'
import { toast } from '@/lib/toast'

export function useSpeechRecognition(
  input: string,
  setInput: (v: string) => void
) {
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<any>(null)
  const manualStopRef = useRef(false)
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)

  const startRecording = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.info('Speech recognition is not supported in this browser. Try Chrome or Safari.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
    } catch {
      toast.warning(`Microphone access denied. Please allow microphone access in Settings > Safari > ${window.location.hostname}`)
      return
    }
    manualStopRef.current = false
    const recognition = new SpeechRecognition()
    recognition.continuous = !isIOS
    recognition.interimResults = true
    recognition.lang = 'en-US'
    let fullTranscript = input
    recognition.onresult = (event: any) => {
      let sessionFinal = ''
      let sessionInterim = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          sessionFinal += event.results[i][0].transcript + ' '
        } else {
          sessionInterim += event.results[i][0].transcript
        }
      }
      const prefix = fullTranscript ? fullTranscript.trimEnd() + ' ' : ''
      setInput(prefix + sessionFinal + sessionInterim)
      if (sessionFinal) {
        fullTranscript = prefix + sessionFinal
      }
    }
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error, event)
      const nonFatal = ['no-speech', 'aborted']
      if (!nonFatal.includes(event.error)) {
        if (event.error === 'not-allowed') {
          toast.warning('Microphone permission was denied. Go to Settings > Safari and allow microphone access for this site.')
        }
        setIsRecording(false)
      }
    }
    recognition.onend = () => {
      if (!manualStopRef.current && isIOS) {
        try {
          recognition.start()
        } catch {
          setIsRecording(false)
        }
      } else {
        setIsRecording(false)
      }
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
      setIsRecording(true)
    } catch (e) {
      console.error('Failed to start speech recognition:', e)
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    manualStopRef.current = true
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* ignore */ }
      recognitionRef.current = null
    }
    setIsRecording(false)
  }

  return { isRecording, startRecording, stopRecording }
}
