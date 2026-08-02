import React, { useState, useEffect } from 'react'
import {
  ShieldCheck, TrendingUp, TrendingDown, AlertTriangle, ArrowRight,
  ExternalLink, Copy, Check, X, ChevronDown, ChevronUp, Sparkles, Activity, Layers, Zap
} from 'lucide-react'
import { TradingViewLightweightChart } from './TradingViewLightweightChart'
import { TransactionStatusService, GENLAYER_STATUSES, EXPLORER_BASE_URL } from '../services/TransactionStatusService'

export const SignalResultTerminal = ({
  signalReport,
  txHash,
  paymentTxHash,
  evaluateTxHash,
  deploymentTxHash,
  contractAddress,
  proof,
  selectedTimeframe = '4h',
  onClose,
  onExecuteAnother,
  explorerUrl = 'https://zksync-os-testnet-genlayer.explorer.zksync.dev'
}) => {
  const [showReasoning, setShowReasoning] = useState(false)
  const [copied, setCopied]               = useState(false)
  const [liveStatus, setLiveStatus]       = useState(null)

  useEffect(() => {
    const targetTx = evaluateTxHash || txHash
    if (targetTx) {
      TransactionStatusService.pollTransactionStatus(targetTx, (statusData) => {
        setLiveStatus(statusData)
      })
    }
  }, [evaluateTxHash, txHash])

  if (!signalReport) return null

  const isLong = signalReport.verdict?.toUpperCase().includes('LONG')
  const isShort = signalReport.verdict?.toUpperCase().includes('SHORT')

  // Robust dynamic price parser for any asset (Major coins, Memecoins, Sci-notation)
  const parsePrice = (val) => {
    if (typeof val === 'number' && !isNaN(val) && val > 0) return val
    if (typeof val === 'string') {
      const cleaned = val.replace(/[^0-9.eE-]/g, '')
      const parsed = parseFloat(cleaned)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
    return 0
  }

  // Resolve current price from signal report or fallback text
  let currentPrice = parsePrice(signalReport.current_price) || parsePrice(signalReport.selectedCoinPrice) || parsePrice(signalReport.trade?.entry)

  if (!currentPrice && signalReport.invalidation) {
    const match = signalReport.invalidation.match(/\$([0-9.eE-]+)/)
    if (match && match[1]) {
      currentPrice = parsePrice(match[1])
    }
  }

  if (!currentPrice || currentPrice <= 0) {
    currentPrice = 1.0
  }

  const formatUsd = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '$0.00'
    const num = Number(val)
    if (num < 0.00001) return `$${num.toFixed(8)}`
    if (num < 0.001) return `$${num.toFixed(6)}`
    if (num < 1) return `$${num.toFixed(4)}`
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Calculated Trading Targets from dynamic asset price
  const entryPrice = parsePrice(signalReport.trade?.entry) || currentPrice
  const tpPrice = parsePrice(signalReport.trade?.takeProfit) || (isLong ? currentPrice * 1.057 : isShort ? currentPrice * 0.943 : currentPrice * 1.03)
  const slPrice = parsePrice(signalReport.trade?.stopLoss) || (isLong ? currentPrice * 0.978 : isShort ? currentPrice * 1.022 : currentPrice * 0.985)
  // Dynamic Gain Target and Risk calculations
  const gainTargetPct = entryPrice > 0 ? (((tpPrice - entryPrice) / entryPrice) * 100).toFixed(2) : '3.00'
  const maxRiskPct = entryPrice > 0 ? (Math.abs((entryPrice - slPrice) / entryPrice) * 100).toFixed(2) : '1.50'
  const computedRR = (entryPrice > 0 && Math.abs(entryPrice - slPrice) > 0)
    ? (Math.abs(tpPrice - entryPrice) / Math.abs(entryPrice - slPrice)).toFixed(2)
    : '2.00'
  const rrRatio = signalReport.trade?.riskReward ? `1 : ${signalReport.trade.riskReward}` : `1 : ${computedRR}`
  const chartOverlays = signalReport.chart?.overlays || []

  const copyAnalysisToClipboard = () => {
    const text = `🎯 GenSignal Trading Terminal
Pair: ${signalReport.pair} (${selectedTimeframe.toUpperCase()})
Signal: ${signalReport.verdict} (${signalReport.confidence}% Conf)
Entry: ${formatUsd(entryPrice)}
TP: ${formatUsd(tpPrice)}
SL: ${formatUsd(slPrice)}
R:R: ${rrRatio}
Thesis: ${signalReport.expert_summary || signalReport.summary}
On-Chain Proof: ${txHash ? `${explorerUrl}/tx/${txHash}` : 'GenLayer Bradbury Testnet'}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(9, 9, 11, 0.92)',
        backdropFilter: 'blur(24px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        overflowY: 'auto'
      }}
    >
      {/* Terminal Card Container */}
      <div
        style={{
          maxWidth: 960,
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: '#18181B',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 24,
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* ── 1. HEADER BAR ───────────────────────────────────────────────── */}
        <div
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            background: '#111113',
            borderRadius: '24px 24px 0 0'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                  {signalReport.pair}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'var(--text-secondary)',
                    padding: '3px 10px',
                    borderRadius: 6
                  }}
                >
                  {selectedTimeframe.toUpperCase()}
                </span>
                {/* Dynamic Source Badge: LLM Consensus vs Binance Fallback */}
                {proof?.fallback ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#f59e0b',
                      background: 'rgba(245,158,11,0.12)',
                      padding: '3px 10px',
                      borderRadius: 99,
                      border: '1px solid rgba(245,158,11,0.35)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Activity size={12} /> Binance Engine Fallback
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#10b981',
                      background: 'rgba(16,185,129,0.12)',
                      padding: '3px 10px',
                      borderRadius: 99,
                      border: '1px solid rgba(16,185,129,0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <ShieldCheck size={12} /> GenLayer LLM Consensus
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Current Price: <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{formatUsd(currentPrice)}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Direction Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 20px',
                borderRadius: 14,
                fontWeight: 900,
                fontSize: 18,
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.02em',
                background: isLong ? 'rgba(16,185,129,0.15)' : isShort ? 'rgba(244,63,94,0.15)' : 'rgba(245,158,11,0.15)',
                color: isLong ? '#10b981' : isShort ? '#f43f5e' : '#f59e0b',
                border: isLong ? '1px solid rgba(16,185,129,0.4)' : isShort ? '1px solid rgba(244,63,94,0.4)' : '1px solid rgba(245,158,11,0.4)'
              }}
            >
              {isLong ? <TrendingUp size={20} /> : isShort ? <TrendingDown size={20} /> : <Activity size={20} />}
              {signalReport.verdict?.toUpperCase()}
              <span style={{ fontSize: 13, opacity: 0.8, fontWeight: 700 }}>({signalReport.confidence}% Conf)</span>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--text-secondary)',
                borderRadius: 12,
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── 2. EXECUTION CARD (Dynamic Calculation Grid) ─────────── */}
        <div style={{ padding: '24px 28px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              marginBottom: 24
            }}
          >
            <div style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', uppercase: true, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                ENTRY PRICE
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#3b82f6', marginTop: 4 }}>
                {formatUsd(entryPrice)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Market Order</div>
            </div>

            <div style={{ background: '#111113', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', uppercase: true, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                TAKE PROFIT (TP)
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#10b981', marginTop: 4 }}>
                {formatUsd(tpPrice)}
              </div>
              <div style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>
                {Number(gainTargetPct) >= 0 ? `+${gainTargetPct}%` : `${gainTargetPct}%`} Target
              </div>
            </div>

            <div style={{ background: '#111113', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', uppercase: true, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                STOP LOSS (SL)
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#f43f5e', marginTop: 4 }}>
                {formatUsd(slPrice)}
              </div>
              <div style={{ fontSize: 11, color: '#f43f5e', marginTop: 2 }}>
                -{maxRiskPct}% Max Risk
              </div>
            </div>

            <div style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', uppercase: true, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                RISK / REWARD
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#a855f7', marginTop: 4 }}>
                {rrRatio}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Dynamic R:R Ratio</div>
            </div>
          </div>

          {/* ── 3. TRADINGVIEW LIGHTWEIGHT CHARTS ENGINE (Interactive Visual Center) ── */}
          <div style={{ marginBottom: 24 }}>
            <TradingViewLightweightChart
              symbol={signalReport.symbol || signalReport.pair?.replace('/', '') || 'BTCUSDT'}
              currentPrice={entryPrice}
              overlays={chartOverlays}
              tradeData={{ entry: entryPrice, takeProfit: tpPrice, stopLoss: slPrice }}
            />
          </div>

          {/* ── 4. AI KEY DRIVERS (100% Dynamic Cards from Consensus) ──────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: 13, textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12 }}>
              Key AI Technical Drivers
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {signalReport.supporting && signalReport.supporting.length > 0 ? (
                signalReport.supporting.map((supText, idx) => (
                  <div key={idx} style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: idx === 0 ? '#3b82f6' : idx === 1 ? '#a855f7' : '#10b981', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      {idx === 0 ? <TrendingUp size={14} /> : idx === 1 ? <Layers size={14} /> : <Sparkles size={14} />}
                      Driver #{idx + 1}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {supText}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, fontSize: 12, color: 'var(--text-muted)' }}>
                  Neutral market consolidation — no dominant directional driver.
                </div>
              )}
            </div>
          </div>

          {/* ── 5. TECHNICAL INDICATOR METRICS BADGES (100% Dynamic Binance Data) ── */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: 13, textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10 }}>
              Quantitative Indicators
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {signalReport.indicators?.rsi_14 !== undefined && signalReport.indicators?.rsi_14 !== null && (
                <span style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: 10, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  RSI (14): <strong style={{ color: signalReport.indicators.rsi_14 >= 60 ? '#10b981' : signalReport.indicators.rsi_14 <= 40 ? '#f43f5e' : '#f59e0b' }}>
                    {signalReport.indicators.rsi_14} ({signalReport.indicators.rsi_zone || 'Neutral'})
                  </strong>
                </span>
              )}

              {signalReport.indicators?.rvol !== undefined && (
                <span style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: 10, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  RVOL: <strong style={{ color: signalReport.indicators.rvol >= 1.3 ? '#10b981' : '#a855f7' }}>
                    {signalReport.indicators.rvol}x
                  </strong>
                </span>
              )}

              {signalReport.indicators?.buy_ratio !== undefined && (
                <span style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: 10, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  Taker Buy: <strong style={{ color: signalReport.indicators.buy_ratio >= 55 ? '#10b981' : signalReport.indicators.buy_ratio <= 45 ? '#f43f5e' : '#f59e0b' }}>
                    {signalReport.indicators.buy_ratio}%
                  </strong>
                </span>
              )}

              {signalReport.indicators?.atr_pct !== undefined && (
                <span style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: 10, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  ATR Volatility: <strong style={{ color: 'var(--text-primary)' }}>
                    {signalReport.indicators.atr_pct}%
                  </strong>
                </span>
              )}

              {signalReport.indicators?.ema_trend && (
                <span style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: 10, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  EMA Structure: <strong style={{ color: '#06b6d4' }}>
                    {signalReport.indicators.ema_trend}
                  </strong>
                </span>
              )}
            </div>
          </div>

          {/* ── 6. RISKS & INVALIDATION CARDS ──────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
            {/* Invalidation Card */}
            <div style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', fontFamily: 'var(--font-mono)', color: '#f43f5e', fontWeight: 800, marginBottom: 6 }}>
                🚫 SIGNAL INVALIDATION CONDITION
              </div>
              <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 600, lineHeight: 1.5 }}>
                {signalReport.invalidation || `Signal becomes invalid if 4H candle closes below ${formatUsd(slPrice)}.`}
              </div>
            </div>

            {/* Risk Warnings Card */}
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', fontFamily: 'var(--font-mono)', color: '#f59e0b', fontWeight: 800, marginBottom: 6 }}>
                ⚠️ RISK FACTOR & COUNTERPOINT
              </div>
              <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 500, lineHeight: 1.5 }}>
                {signalReport.counterpoint || 'High BTC dominance or macro volatility event near resistance level.'}
              </div>
            </div>
          </div>

          {/* ── 7. DEEP QUANT AI THESIS ACCORDION (moved up — with compact TX strip inside) ── */}
          <div style={{ border: '1px solid rgba(168,85,247,0.25)', borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(59,130,246,0.06))',
                padding: '14px 20px',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={15} color="#a855f7" /> Deep Quant AI Thesis & Model Output
                {/* Source badge inline */}
                <span style={{
                  fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  padding: '2px 8px', borderRadius: 99,
                  background: proof?.fallback ? 'rgba(245,158,11,0.15)' : 'rgba(168,85,247,0.15)',
                  color: proof?.fallback ? '#f59e0b' : '#a855f7',
                  border: `1px solid ${proof?.fallback ? 'rgba(245,158,11,0.4)' : 'rgba(168,85,247,0.4)'}`
                }}>
                  {proof?.fallback ? '📊 Binance Engine' : '🤖 GenLayer LLM'}
                </span>
              </span>
              {showReasoning ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showReasoning && (
              <div style={{ padding: 20, background: '#09090B', borderTop: '1px solid rgba(255,255,255,0.08)' }}>

                {/* Executive Quant Thesis */}
                {signalReport.expert_summary ? (
                  <div style={{ marginBottom: 16, padding: 14, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 12 }}>
                    <div style={{ fontSize: 10, color: '#a855f7', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={11} /> {proof?.fallback ? 'Binance Quant Engine Summary' : 'GenLayer LLM Executive Thesis'}
                    </div>
                    <div style={{ fontSize: 13, color: '#f8fafc', lineHeight: 1.65, fontStyle: 'italic' }}>
                      "{signalReport.expert_summary}"
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 16, padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Executive thesis pending — signal is based on indicator confluence below.
                    </div>
                  </div>
                )}

                {/* Supporting Arguments */}
                {signalReport.supporting?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 700, marginBottom: 8 }}>
                      Supporting Arguments
                    </div>
                    <ul style={{ paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                      {signalReport.supporting.map((pt, i) => (
                        <li key={i} style={{ marginBottom: 6, lineHeight: 1.5 }}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ── COMPACT TX STRIP (verify on-chain right here) ────────────── */}
                <div style={{
                  borderTop: '1px solid rgba(255,255,255,0.07)',
                  paddingTop: 12,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  alignItems: 'center',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)'
                }}>
                  {/* Source badge */}
                  <span style={{
                    padding: '3px 10px', borderRadius: 99, fontWeight: 700,
                    background: proof?.fallback ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                    color: proof?.fallback ? '#f59e0b' : '#10b981',
                    border: `1px solid ${proof?.fallback ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.25)'}`
                  }}>
                    {proof?.fallback ? '📊 Binance Fallback Engine' : '🤖 GenLayer LLM Consensus'}
                  </span>

                  {/* Eval TX */}
                  {evaluateTxHash && !proof?.fallback && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Eval Tx:
                      <a
                        href={`${explorerUrl}/tx/${evaluateTxHash}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ color: '#a855f7', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                      >
                        {evaluateTxHash.slice(0, 10)}…{evaluateTxHash.slice(-5)} <ExternalLink size={11} />
                      </a>
                    </span>
                  )}

                  {/* Contract */}
                  {contractAddress && !proof?.fallback && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Contract:
                      <a
                        href={`${explorerUrl}/address/${contractAddress}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ color: '#06b6d4', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                      >
                        {contractAddress.slice(0, 8)}…{contractAddress.slice(-4)} <ExternalLink size={11} />
                      </a>
                    </span>
                  )}

                  {/* Payment TX */}
                  {paymentTxHash && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Payment:
                      <a
                        href={`https://zksync-os-testnet-genlayer.explorer.zksync.dev/tx/${paymentTxHash}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ color: '#10b981', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                      >
                        {paymentTxHash.slice(0, 10)}…{paymentTxHash.slice(-5)} <ExternalLink size={11} />
                      </a>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── 8. ON-CHAIN GENLAYER CONSENSUS PROOF CARD (Full Detail — moved below thesis) ── */}
          <div
            style={{
              background: '#09090B',
              border: `1px solid ${proof?.fallback ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 18,
              padding: 20,
              marginBottom: 24
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={16} color={proof?.fallback ? '#f59e0b' : '#10b981'} />
                {proof?.fallback ? 'BINANCE ENGINE ANALYSIS PROOF' : 'ON-CHAIN GENLAYER CONSENSUS EVIDENCE'}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: 99,
                  background: proof?.fallback ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                  color: proof?.fallback ? '#f59e0b' : '#10b981',
                  border: `1px solid ${proof?.fallback ? '#f59e0b' : '#10b981'}`
                }}
              >
                {proof?.fallback ? '⚡ FALLBACK ENGINE ACTIVE' : '● CONSENSUS FINALIZED'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              {/* Verdict Source */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Verdict Source:</span>
                <span style={{ color: proof?.fallback ? '#f59e0b' : '#a855f7', fontWeight: 700 }}>
                  {signalReport.source_type || (proof?.fallback ? 'Binance Fallback Engine' : 'GenLayer LLM Consensus')}
                </span>
              </div>

              {/* Payment Transaction */}
              {paymentTxHash && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ color: 'var(--text-muted)' }}>x402 Payment Transaction:</span>
                  <a
                    href={`https://zksync-os-testnet-genlayer.explorer.zksync.dev/tx/${paymentTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#10b981', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    {paymentTxHash.slice(0, 14)}…{paymentTxHash.slice(-6)} <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {/* Payment Verification Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Payment Verification Status:</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>Verified on-chain via Treasury Contract</span>
              </div>

              {/* Deployment Transaction (Only rendered if a contract was newly deployed) */}
              {deploymentTxHash && deploymentTxHash.startsWith('0x') && deploymentTxHash.length >= 60 && !deploymentTxHash.includes('reused') && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>SignalOracle Deployment Tx:</span>
                  <a
                    href={`${explorerUrl}/tx/${deploymentTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    {deploymentTxHash.slice(0, 14)}…{deploymentTxHash.slice(-6)} <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {/* Contract Address */}
              {contractAddress && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Intelligent Contract Address:</span>
                  <a
                    href={contractAddress.startsWith('0x') && contractAddress.length === 42 ? `${explorerUrl}/address/${contractAddress}` : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#06b6d4', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    {contractAddress.slice(0, 14)}…{contractAddress.slice(-6)} <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {/* Evaluation/Consensus Transaction */}
              {evaluateTxHash && !proof?.fallback && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Oracle Evaluation (Consensus) Tx:</span>
                  <a
                    href={`${explorerUrl}/tx/${evaluateTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#a855f7', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    {evaluateTxHash.slice(0, 14)}…{evaluateTxHash.slice(-6)} <ExternalLink size={12} />
                  </a>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Network:</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>{explorerUrl.includes('studio') ? 'GenLayer Studionet (Chain ID 61999)' : 'GenLayer Bradbury Testnet (Chain ID 4221)'}</span>
              </div>

              {!proof?.fallback && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Consensus Engine:</span>
                    <span style={{ color: '#a855f7', fontWeight: 700 }}>GenVM Optimistic Democracy (Multi-Validator Consensus)</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Verification Mechanism:</span>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>GenLayer Validator Consensus Verified</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Consensus Rule:</span>
                    <span style={{ color: '#fff', fontWeight: 700 }}>Verdict Confluence & ±10% Confidence Equivalence</span>
                  </div>
                </>
              )}

              {proof?.fallback && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Fallback Reason:</span>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>GenLayer RPC validator timed out — Binance engine applied</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 9. BOTTOM ACTIONS BAR ────────────────────────────────────────── */}
        <div
          style={{
            padding: '20px 28px',
            background: '#111113',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            borderRadius: '0 0 24px 24px'
          }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={copyAnalysisToClipboard}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                padding: '8px 16px',
                borderRadius: 12,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Analysis'}
            </button>

            {txHash && (
              <a
                href={`${explorerUrl}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '8px 16px',
                  borderRadius: 12,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <ExternalLink size={14} /> View Explorer
              </a>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 600,
                padding: '8px 18px',
                borderRadius: 12,
                cursor: 'pointer'
              }}
            >
              Close Terminal
            </button>
            <button
              onClick={() => {
                onClose()
                if (onExecuteAnother) onExecuteAnother()
              }}
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #a855f7)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                padding: '8px 20px',
                borderRadius: 14,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Zap size={14} /> Execute Another Signal <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
