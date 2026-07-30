import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { Cpu, RefreshCw, AlertTriangle, ShieldCheck, Zap } from 'lucide-react'

const BackendWarmupContext = createContext({
  isBackendReady: false,
  backendStatus: 'warming', // 'warming' | 'ready' | 'error'
  retryCount: 0,
  maxRetries: 20,
  estimatedWait: 30,
  retryWarmup: () => {}
})

export const useBackendWarmup = () => useContext(BackendWarmupContext)

export const BackendWarmupProvider = ({ children, backendUrl }) => {
  const [isBackendReady, setIsBackendReady] = useState(false)
  const [backendStatus, setBackendStatus]   = useState('warming') // 'warming', 'ready', 'error'
  const [retryCount, setRetryCount]         = useState(0)
  const [estimatedWait, setEstimatedWait]   = useState(30)
  const isWarmedUpRef                       = useRef(false)
  const pollTimerRef                        = useRef(null)

  const checkHealth = async (currentRetry = 0) => {
    if (isWarmedUpRef.current) return

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)

      const sanitizedUrl = (backendUrl || 'https://gensignal.onrender.com').replace(/\/+$/, '')
      const response = await fetch(`${sanitizedUrl}/api/health`, {
        signal: controller.signal,
        cache: 'no-store'
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        if (data.status === 'ok') {
          isWarmedUpRef.current = true
          setIsBackendReady(true)
          setBackendStatus('ready')
          if (pollTimerRef.current) clearInterval(pollTimerRef.current)
          return
        }
      }
    } catch (err) {
      // Backend is cold / sleeping or offline
    }

    const nextRetry = currentRetry + 1
    setRetryCount(nextRetry)
    setEstimatedWait(Math.max(0, 30 - nextRetry * 3))

    if (nextRetry >= 20) {
      setBackendStatus('error')
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }

  const startWarmup = () => {
    if (isWarmedUpRef.current) return

    setBackendStatus('warming')
    setRetryCount(0)
    setEstimatedWait(30)

    // Immediate check
    checkHealth(0)

    // Poll every 3 seconds
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    let count = 0
    pollTimerRef.current = setInterval(() => {
      count++
      if (count <= 20 && !isWarmedUpRef.current) {
        checkHealth(count)
      } else {
        clearInterval(pollTimerRef.current)
      }
    }, 3000)
  }

  useEffect(() => {
    startWarmup()
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [backendUrl])

  return (
    <BackendWarmupContext.Provider
      value={{
        isBackendReady,
        backendStatus,
        retryCount,
        maxRetries: 20,
        estimatedWait,
        retryWarmup: startWarmup
      }}
    >
      {children}
      {!isBackendReady && (
        <BackendWarmupOverlay
          status={backendStatus}
          retryCount={retryCount}
          maxRetries={20}
          onRetry={startWarmup}
        />
      )}
    </BackendWarmupContext.Provider>
  )
}

/* ─── Premium AI Infrastructure Warm-up Overlay Component ─────────────────── */
const BackendWarmupOverlay = ({ status, retryCount, maxRetries, onRetry }) => {
  const progressPercent = Math.min(100, Math.round((retryCount / maxRetries) * 100))

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#09090B',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'var(--font-body)',
        color: '#f8fafc'
      }}
    >
      {/* Background Animated Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          pointerEvents: 'none'
        }}
      />

      {/* Floating Lights */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(168, 85, 247, 0.1) 50%, transparent 70%)',
          filter: 'blur(100px)',
          pointerEvents: 'none'
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 460,
          width: '100%',
          background: '#18181B',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 24,
          padding: 40,
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)'
        }}
      >
        {/* Animated Icon Container */}
        <div
          style={{
            position: 'relative',
            width: 72,
            height: 72,
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #3b82f6, #a855f7)',
              opacity: 0.2,
              filter: 'blur(12px)',
              animation: 'pulse 2s infinite'
            }}
          />
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #3b82f6, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 0 30px rgba(59, 130, 246, 0.4)'
            }}
          >
            {status === 'error' ? (
              <AlertTriangle size={30} style={{ color: '#f43f5e' }} />
            ) : (
              <Cpu size={30} className="spin" />
            )}
          </div>
        </div>

        {/* Text Headers */}
        {status === 'error' ? (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
              Unable to connect to AI Engine
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
              The free backend service on Render took longer than expected to wake up. Please click below to re-attempt connection.
            </p>
            <button
              onClick={onRetry}
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #a855f7)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                padding: '12px 28px',
                borderRadius: 14,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 0 24px rgba(59, 130, 246, 0.3)'
              }}
            >
              <RefreshCw size={16} /> Retry Connection
            </button>
          </>
        ) : (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
              Starting AI Engine…
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
              Preparing backend services…<br />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                This usually takes 10–30 seconds on the free server.
              </span>
            </p>

            {/* Progress Bar Container */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 999,
                height: 8,
                width: '100%',
                overflow: 'hidden',
                marginBottom: 16,
                position: 'relative'
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(10, progressPercent)}%`,
                  background: 'linear-gradient(90deg, #3b82f6, #a855f7)',
                  borderRadius: 999,
                  transition: 'width 0.4s ease',
                  boxShadow: '0 0 12px rgba(59, 130, 246, 0.5)'
                }}
              />
            </div>

            {/* Status Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)'
              }}
            >
              <span>Waking Render Cloud API</span>
              <span style={{ color: '#3b82f6', fontWeight: 700 }}>
                Attempt {retryCount} of {maxRetries}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
