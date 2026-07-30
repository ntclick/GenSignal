import React, { useEffect, useRef } from 'react'
import { createChart, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts'

export const TradingViewLightweightChart = ({
  symbol = 'BTCUSDT',
  currentPrice = 64484.0,
  overlays = [],
  tradeData = null
}) => {
  const chartContainerRef = useRef(null)
  const chartRef          = useRef(null)

  useEffect(() => {
    if (!chartContainerRef.current) return

    // Clean up previous instance
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const container = chartContainerRef.current

    // Initialize TradingView Chart
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 320,
      layout: {
        background: { type: ColorType.Solid, color: '#09090B' },
        textColor: '#a1a1aa'
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' }
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#3b82f6', width: 1, style: LineStyle.Dashed },
        horzLine: { color: '#3b82f6', width: 1, style: LineStyle.Dashed }
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: { top: 0.15, bottom: 0.25 }
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false
      }
    })

    chartRef.current = chart

    // Add Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderUpColor: '#10b981',
      borderDownColor: '#f43f5e',
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e'
    })

    // Add Volume Histogram Series
    const volumeSeries = chart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.75, bottom: 0 }
    })

    // Generate 40 synthetic historical candles around currentPrice for full visual context
    const basePrice = currentPrice || 64484.0
    const nowSec = Math.floor(Date.now() / 1000)
    const candles = []
    const volumeData = []
    let price = basePrice * 0.95

    for (let i = 40; i >= 0; i--) {
      const time = nowSec - i * 4 * 3600 // 4H intervals
      const change = (Math.random() - 0.48) * (basePrice * 0.015)
      const open = price
      const close = open + change
      const high = Math.max(open, close) + Math.random() * (basePrice * 0.008)
      const low = Math.min(open, close) - Math.random() * (basePrice * 0.008)
      price = close

      candles.push({ time, open, high, low, close })
      volumeData.push({
        time,
        value: Math.round(1000 + Math.random() * 5000),
        color: close >= open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'
      })
    }

    // Set last candle close to match currentPrice exactly
    candles[candles.length - 1].close = basePrice
    candleSeries.setData(candles)
    volumeSeries.setData(volumeData)

    // Calculate EMA series data for dynamic overlays
    const calculateEMA = (period) => {
      const k = 2 / (period + 1)
      let ema = candles[0].close
      const emaData = []
      for (let i = 0; i < candles.length; i++) {
        ema = candles[i].close * k + ema * (1 - k)
        emaData.push({ time: candles[i].time, value: ema })
      }
      return emaData
    }

    // ── DYNAMIC OVERLAY ENGINE (Renders chart.overlays dynamically) ───────
    const effectiveOverlays = overlays && overlays.length > 0 ? overlays : [
      { type: 'entry', price: tradeData?.entry || basePrice },
      { type: 'tp', price: tradeData?.takeProfit || basePrice * 1.057 },
      { type: 'sl', price: tradeData?.stopLoss || basePrice * 0.978 },
      { type: 'ema', period: 20 },
      { type: 'ema', period: 50 },
      { type: 'marker', title: 'AI Confluence Signal', description: 'Multi-validator consensus entry', price: basePrice }
    ]

    const markersList = []

    effectiveOverlays.forEach((ov) => {
      switch (ov.type?.toLowerCase()) {
        case 'entry': {
          const entryVal = ov.price || tradeData?.entry || basePrice
          candleSeries.createPriceLine({
            price: entryVal,
            color: '#3b82f6',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `ENTRY $${entryVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          })
          break
        }
        case 'tp':
        case 'take_profit': {
          const tpVal = ov.price || tradeData?.takeProfit || basePrice * 1.057
          candleSeries.createPriceLine({
            price: tpVal,
            color: '#10b981',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `TP $${tpVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          })
          break
        }
        case 'sl':
        case 'stop_loss': {
          const slVal = ov.price || tradeData?.stopLoss || basePrice * 0.978
          candleSeries.createPriceLine({
            price: slVal,
            color: '#f43f5e',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `SL $${slVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
          })
          break
        }
        case 'ema': {
          const period = ov.period || 20
          const colorMap = { 20: '#06b6d4', 50: '#a855f7', 200: '#f59e0b' }
          const emaLine = chart.addLineSeries({
            color: colorMap[period] || '#3b82f6',
            lineWidth: 1,
            title: `EMA ${period}`
          })
          emaLine.setData(calculateEMA(period))
          break
        }
        case 'marker':
        case 'bos':
        case 'choch': {
          markersList.push({
            time: candles[candles.length - 2].time,
            position: 'aboveBar',
            color: '#a855f7',
            shape: 'arrowDown',
            text: ov.title || 'AI Confluence'
          })
          break
        }
        default:
          break
      }
    })

    if (markersList.length > 0) {
      candleSeries.setMarkers(markersList)
    }

    // Auto-fit content
    chart.timeScale().fitContent()

    // Handle Window Resize
    const handleResize = () => {
      if (container && chartRef.current) {
        chartRef.current.applyOptions({ width: container.clientWidth })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [symbol, currentPrice, JSON.stringify(overlays), JSON.stringify(tradeData)])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        background: '#09090B',
        borderRadius: 18,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        padding: 16
      }}
    >
      {/* Chart Top Indicator Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          padding: '0 4px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 800, color: '#fff', fontSize: 13 }}>{symbol} 4H</span>
          <span style={{ color: '#06b6d4' }}>● EMA 20</span>
          <span style={{ color: '#a855f7' }}>● EMA 50</span>
          <span style={{ color: '#f59e0b' }}>● EMA 200</span>
        </div>
        <div style={{ color: 'var(--text-muted)' }}>
          Interactive TradingView Engine
        </div>
      </div>

      {/* TradingView Chart Container Element */}
      <div ref={chartContainerRef} style={{ width: '100%', height: 320 }} />
    </div>
  )
}
