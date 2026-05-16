import { useEffect } from 'react'
import { socketService } from '../services/socketService'
import { useMixerStore } from '../store/useMixerStore'

export const useMixerConnection = () => {
  const { setConnected, updateMasterLevel, updateChannel } = useMixerStore()

  useEffect(() => {
    const socket = socketService.connect()

    socket.on('connect', () => {
      setConnected(true)
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    // Recebe o estado completo da mesa ao conectar
    socket.on('mixer_state_full', (state: any) => {
      console.log('[Socket] Estado completo recebido:', state)
      if (state.master) {
        updateMasterLevel(state.master.level)
      }
      if (state.inputs) {
        state.inputs.forEach((ch: any, index: number) => {
          updateChannel(index + 1, {
            level: ch.level,
            mute: !!ch.mute,
            name: ch.name || `Ch ${index + 1}`
          })
        })
      }
    })

    // Escuta atualizações de fader do master
    socket.on('master_level', (data: any) => {
      updateMasterLevel(data.level)
    })

    // Escuta atualizações de canais individuais
    socket.on('channel_level', (data: any) => {
      updateChannel(data.channel, { level: data.level })
    })

    socket.on('channel_mute', (data: any) => {
      updateChannel(data.channel, { mute: !!data.mute })
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('mixer_state_full')
      socket.off('master_level')
      socket.off('channel_level')
      socket.off('channel_mute')
    }
  }, [setConnected, updateMasterLevel, updateChannel])

  const setMasterLevel = (level: number) => {
    socketService.emit('masterLevel', { level })
  }

  const setChannelLevel = (channel: number, level: number) => {
    socketService.emit('channelLevel', { channel, level })
  }

  const setChannelMute = (channel: number, mute: boolean) => {
    socketService.emit('channelMute', { channel, enabled: mute })
  }

  return {
    setMasterLevel,
    setChannelLevel,
    setChannelMute
  }
}
