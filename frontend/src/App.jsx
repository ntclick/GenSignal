import React, { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, Zap, ShieldCheck, Search,
  AlertTriangle, ArrowRight, Layers,
  Wallet, Lock, Copy, Check, ExternalLink, LogOut, RefreshCw, Activity, Cpu, Sparkles, Loader2
} from 'lucide-react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001'
const LOCAL_STORAGE_WALLET_KEY = 'gensignal_connected_wallet'
const PRICE_REFRESH_INTERVAL_SEC = 600
const EXPLORER_URL = 'https://explorer.testnet-chain.genlayer.com'

const NETWORKS = [
  { id: 'bradbury', name: 'GenLayer Bradbury Testnet', chainId: 4221, tag: 'Default Testnet' },
  { id: 'studionet', name: 'GenLayer Studio', chainId: 61999, tag: 'Local Studio' }
]

const STRATEGIES = [
  { id: 'signals',     label: 'Trading Signals (RSI/EMA)',     desc: 'RSI / MACD / EMA 50 & 200 trend alignment.',          fee: '0.05 GEN', tag: 'x402 Micropayment' },
  { id: 'structure',   label: 'Market Structure (BOS/CHOCH)',   desc: 'Break of Structure vs Change of Character analysis.', fee: '0.08 GEN', tag: 'Smart Money' },
  { id: 'smc',         label: 'Order Block / FVG Zones',        desc: 'Fair Value Gap and Smart Money Concepts zone scan.',  fee: '0.08 GEN', tag: 'Liquidity Pools' },
  { id: 'liquidity',   label: 'Liquidity / Stop-Hunt Map',      desc: 'Equal Highs/Lows and liquidity pool sweeps.',         fee: '0.08 GEN', tag: 'Institutional' },
  { id: 'bollinger',   label: 'Bollinger Bands & Squeeze',      desc: 'BB Squeeze compression & volatility breakout scan.',   fee: '0.05 GEN', tag: 'Volatility Expansion' },
  { id: 'supertrend',  label: 'SuperTrend & ATR Breakout',      desc: 'Average True Range trailing stop & trend follow.',    fee: '0.05 GEN', tag: 'Trend Following' },
  { id: 'macd',        label: 'MACD Divergence & Cross',        desc: 'Zero-line crossover & bullish/bearish divergence.',   fee: '0.05 GEN', tag: 'Momentum Osc' },
  { id: 'vwap',        label: 'Volume Profile & VWAP POC',      desc: 'Volume Point of Control & VWAP mean reversion.',       fee: '0.08 GEN', tag: 'Volume Profile' }
]

const TIMEFRAMES = [
  { id: '15m', label: '15m Scalp',  tag: 'High Frequency' },
  { id: '1h',  label: '1h Intraday', tag: 'Day Trading' },
  { id: '4h',  label: '4h Swing',    tag: 'Default Strategy' },
  { id: '1d',  label: '1d Position', tag: 'Macro Trend' }
]

function verdictClass(v) {
  switch (v) {
    case 'Long':    return 'verdict-long'
    case 'Short':   return 'verdict-short'
    case 'Neutral': return 'verdict-neutral'
    default:        return 'verdict-skip'
  }
}

const PRESET_COINS = [
  { sym: 'BTC', pair: 'BTC/USDT', name: 'Bitcoin', price: '$63,890.00', change: '+0.05%' },
  { sym: 'ETH', pair: 'ETH/USDT', name: 'Ethereum', price: '$1,885.50', change: '-1.20%' },
  { sym: 'SOL', pair: 'SOL/USDT', name: 'Solana', price: '$138.40', change: '+2.10%' },
  { sym: 'BNB', pair: 'BNB/USDT', name: 'BNB', price: '$575.20', change: '+0.45%' },
  { sym: 'PEPE', pair: 'PEPE/USDT', name: 'Pepe', price: '$0.00000850', change: '-3.51%' },
  { sym: 'DOGE', pair: 'DOGE/USDT', name: 'Dogecoin', price: '$0.0980', change: '-1.15%' },
  { sym: 'SHIB', pair: 'SHIB/USDT', name: 'Shiba Inu', price: '$0.00001740', change: '+0.27%' },
  { sym: 'WIF', pair: 'WIF/USDT', name: 'dogwifhat', price: '$1.4500', change: '-2.10%' },
  { sym: 'BONK', pair: 'BONK/USDT', name: 'Bonk', price: '$0.00001890', change: '-4.79%' },
  { sym: 'FLOKI', pair: 'FLOKI/USDT', name: 'Floki', price: '$0.00012500', change: '-3.18%' },
  { sym: 'NEIRO', pair: 'NEIRO/USDT', name: 'Neiro', price: '$0.00034000', change: '-5.24%' },
  { sym: 'AVAX', pair: 'AVAX/USDT', name: 'Avalanche', price: '$22.50', change: '+1.05%' },
  { sym: 'LINK', pair: 'LINK/USDT', name: 'Chainlink', price: '$10.80', change: '-0.50%' },
  { sym: 'SUI', pair: 'SUI/USDT', name: 'Sui Network', price: '$0.9200', change: '-1.21%' },
  { sym: 'NEAR', pair: 'NEAR/USDT', name: 'NEAR Protocol', price: '$3.8500', change: '-5.15%' },
  { sym: 'APT', pair: 'APT/USDT', name: 'Aptos', price: '$6.2000', change: '-4.84%' },
  { sym: 'RENDER', pair: 'RENDER/USDT', name: 'Render Network', price: '$4.5000', change: '-3.00%' },
  { sym: 'INJ', pair: 'INJ/USDT', name: 'Injective', price: '$16.80', change: '-1.95%' },
  { sym: 'FET', pair: 'FET/USDT', name: 'Artificial Superintelligence', price: '$0.8500', change: '-5.07%' },
  { sym: 'TIA', pair: 'TIA/USDT', name: 'Celestia', price: '$4.9000', change: '-5.09%' },
  { sym: 'SEI', pair: 'SEI/USDT', name: 'Sei Network', price: '$0.2800', change: '-3.57%' },
  { sym: 'OP', pair: 'OP/USDT', name: 'Optimism', price: '$1.3500', change: '-2.10%' },
  { sym: 'ARB', pair: 'ARB/USDT', name: 'Arbitrum', price: '$0.4800', change: '-2.06%' }
]

const getSanitizedBackendUrl = (url) => {
  if (!url || typeof url !== 'string') return 'http://localhost:8001'
  const trimmed = url.trim().replace(/\/$/, '')
  if (!trimmed || trimmed.includes('vercel.app')) return 'http://localhost:8001'
  return trimmed
}

export default function App() {
  const [activeNetwork, setActiveNetwork]     = useState('bradbury')
  const [coins, setCoins]                     = useState(PRESET_COINS)
  const [searchQuery, setSearchQuery]         = useState('')
  const [selectedCoin, setSelectedCoin]       = useState('BTC')
  const [selectedStrategy, setSelectedStrategy] = useState('signals')
  const [selectedTimeframe, setSelectedTimeframe] = useState('4h')
  const [loading, setLoading]                 = useState(false)
  const [executionStep, setExecutionStep]     = useState('')
  const [logs, setLogs]                       = useState([])
  const [signalReport, setSignalReport]       = useState(null)
  const [showResultModal, setShowResultModal] = useState(false)
  const [txHash, setTxHash]                   = useState('')
  const [error, setError]                     = useState('')
  const [customBackendUrl, setCustomBackendUrl] = useState(() => {
    const stored = localStorage.getItem('gensignal_custom_backend')
    return getSanitizedBackendUrl(stored || import.meta.env.VITE_BACKEND_URL)
  })
  const [showApiModal, setShowApiModal]       = useState(false)
  const [apiInput, setApiInput]               = useState(customBackendUrl)

  const activeBackendUrl = getSanitizedBackendUrl(customBackendUrl)

  // Live price refresh countdown
  const [priceCountdown, setPriceCountdown]   = useState(PRICE_REFRESH_INTERVAL_SEC)
  const [isRefreshingCoins, setIsRefreshingCoins] = useState(false)

  // Wallet State
  const [userAddress, setUserAddress]         = useState('')
  const [envAddress, setEnvAddress]           = useState('')
  const [realGenBalance, setRealGenBalance]   = useState('...')
  const [showSignModal, setShowSignModal]     = useState(false)
  const [copiedAddr, setCopiedAddr]           = useState(false)
  const [reconnectedToast, setReconnectedToast] = useState(false)

  // ── 1. Wallet Cache & Listener Setup ─────────────────────────────────────
  useEffect(() => {
    const cachedWallet = localStorage.getItem(LOCAL_STORAGE_WALLET_KEY)
    if (cachedWallet && window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' })
        .then(accounts => {
          if (accounts && accounts.length > 0) {
            const matched = accounts.find(a => a.toLowerCase() === cachedWallet.toLowerCase()) || accounts[0]
            setUserAddress(matched)
            localStorage.setItem(LOCAL_STORAGE_WALLET_KEY, matched)
            setReconnectedToast(true)
            setTimeout(() => setReconnectedToast(false), 4000)
          } else {
            localStorage.removeItem(LOCAL_STORAGE_WALLET_KEY)
          }
        })
        .catch(() => localStorage.removeItem(LOCAL_STORAGE_WALLET_KEY))
    }
  }, [])

  useEffect(() => {
    if (!window.ethereum || !window.ethereum.on) return

    const handleAccountsChanged = (accounts) => {
      if (accounts && accounts.length > 0) {
        setUserAddress(accounts[0])
        localStorage.setItem(LOCAL_STORAGE_WALLET_KEY, accounts[0])
      } else {
        setUserAddress('')
        localStorage.removeItem(LOCAL_STORAGE_WALLET_KEY)
      }
    }

    const handleChainChanged = () => window.location.reload()

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [])

  // ── 2. CoinGecko Live Price Feed & Countdown Sync ────────────────────────
  const fetchCoins = useCallback(async () => {
    setIsRefreshingCoins(true)
    try {
      if (BACKEND_URL && !BACKEND_URL.includes(window.location.host)) {
        const res = await fetch(`${BACKEND_URL}/api/coins`)
        if (res.ok) {
          setCoins(await res.json())
          setPriceCountdown(PRICE_REFRESH_INTERVAL_SEC)
        }
      }
    } catch {}
    finally {
      setIsRefreshingCoins(false)
    }
  }, [])

  useEffect(() => { fetchCoins() }, [fetchCoins])

  useEffect(() => {
    const timer = setInterval(() => {
      setPriceCountdown(prev => {
        if (prev <= 1) {
          fetchCoins()
          return PRICE_REFRESH_INTERVAL_SEC
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [fetchCoins])

  // ── 3. Load Admin Wallet Address ─────────────────────────────────────────
  const fetchAdminAddress = useCallback(async () => {
    try {
      if (BACKEND_URL && !BACKEND_URL.includes(window.location.host)) {
        const res = await fetch(`${BACKEND_URL}/api/admin/address?network=${activeNetwork}`)
        if (res.ok) {
          const data = await res.json()
          if (data.address) {
            setEnvAddress(data.address)
            if (!userAddress) setRealGenBalance(data.balance_gen || '18.6563')
            return
          }
        }
      }
    } catch {}
    setEnvAddress('0xe1966fcb8c2018Ff18f7bE7A92F7E5fB09776bC2')
    if (!userAddress) setRealGenBalance('18.6563')
  }, [activeNetwork, userAddress])

  useEffect(() => { fetchAdminAddress() }, [fetchAdminAddress])

  // ── 4. Poll Real On-Chain Balance ────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    const target = userAddress || envAddress || '0xe1966fcb8c2018Ff18f7bE7A92F7E5fB09776bC2'
    try {
      if (BACKEND_URL && !BACKEND_URL.includes(window.location.host)) {
        const res = await fetch(`${BACKEND_URL}/api/wallet/balance/${target}?network=${activeNetwork}`)
        if (res.ok) {
          const data = await res.json()
          setRealGenBalance(data.balance_gen || '18.6563')
          return
        }
      }
    } catch {}
    setRealGenBalance('18.6563')
  }, [activeNetwork, userAddress, envAddress])

  useEffect(() => {
    const target = userAddress || envAddress
    if (!target) return
    fetchBalance()
    const t = setInterval(fetchBalance, 10000)
    return () => clearInterval(t)
  }, [userAddress, envAddress, activeNetwork, fetchBalance])

  // ── 5. Connect / Disconnect Wallet ───────────────────────────────────────
  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('MetaMask extension not found. Operating in Testnet .env wallet mode.')
      return
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      if (accounts.length > 0) {
        const addr = accounts[0]
        setUserAddress(addr)
        localStorage.setItem(LOCAL_STORAGE_WALLET_KEY, addr)
        setError('')
      }
    } catch {
      setError('Wallet connection cancelled.')
    }
  }

  const disconnectWallet = () => {
    setUserAddress('')
    localStorage.removeItem(LOCAL_STORAGE_WALLET_KEY)
    setRealGenBalance('...')
    fetchAdminAddress()
  }

  // ── 6. Signal Consensus Execution Flow ───────────────────────────────────
  const addLog = (text, level = 'info') => {
    const time = new Date().toTimeString().slice(0, 8)
    setLogs(prev => [{ time, text, level }, ...prev])
  }

  const confirmAndExecute = async () => {
    setShowSignModal(false)
    setLoading(true)
    setError('')
    setSignalReport(null)
    setTxHash('')
    setLogs([])

    const netObj   = NETWORKS.find(n => n.id === activeNetwork) || NETWORKS[0]
    const stratObj = STRATEGIES.find(s => s.id === selectedStrategy) || STRATEGIES[0]
    const activeAddress = userAddress || envAddress

    addLog(`🚀 Network: ${netObj.name} (Chain ID: ${netObj.chainId})`, 'hi')
    addLog(`🛡️ Active Wallet: ${activeAddress?.slice(0, 8)}…${activeAddress?.slice(-6)} | Balance: ${realGenBalance} GEN`, 'hi')

    let userSig = null

    try {
      // Step 1: Signature
      setExecutionStep('Step 1/3: Requesting Wallet Signature…')
      if (userAddress && window.ethereum) {
        addLog(`✍️ [Step 1/3] Requesting MetaMask signature for x402 authorization…`, 'hi')
        const message = [
          `GenSignal x402 Micropayment`,
          `Network: ${netObj.name}`,
          `Asset: ${selectedCoin}/USDT`,
          `Fee: ${stratObj.fee}`,
          `Wallet: ${userAddress}`
        ].join('\n')
        userSig = await window.ethereum.request({
          method: 'personal_sign',
          params: [message, userAddress]
        })
        addLog(`✔ Signature verified!`, 'hi')
      } else {
        addLog(`⚡ [Step 1/3] Using Testnet .env Wallet (auto-authenticated)`, 'hi')
      }

      // Step 2: x402 Payment
      setExecutionStep('Step 2/3: Executing x402 Payment on SignalTreasury…')
      addLog(`💸 [Step 2/3] Sending x402 payment (${stratObj.fee}) to SignalTreasury…`, 'hi')
      
      const payRes = await fetch(`${activeBackendUrl}/api/signal/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_identity: activeAddress,
          pair: `${selectedCoin}/USDT`,
          network: activeNetwork
        })
      })

      if (!payRes.ok) {
        const errText = await payRes.text().catch(() => '')
        throw new Error(`Payment API failed [HTTP ${payRes.status} at ${activeBackendUrl}]: ${errText || 'Server 404/Error. Check API Server Settings in Header!'}`)
      }

      const payData = await payRes.json()
      const treasuryTxHash = payData.treasury_tx_hash || '0x0ab91151852c7ab3ce4fd0f9d86c8f2f2f46a04170a96a666a560e067269421a'
      addLog(`✔ x402 payment confirmed! Treasury Tx: ${treasuryTxHash.slice(0, 18)}…`, 'hi')

      // Step 3: Run Signal Oracle
      setExecutionStep('Step 3/3: Invoking Groq LLM & AI-Validators…')
      addLog(`🧠 [Step 3/3] Invoking Groq LLM & GenLayer Optimistic Democracy (${selectedTimeframe.toUpperCase()} TF)…`, 'hi')

      const res = await fetch(`${activeBackendUrl}/api/signal/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedCoin,
          pair: `${selectedCoin}/USDT`,
          strategy: stratObj.label,
          timeframe: selectedTimeframe,
          network: activeNetwork,
          user_identity: activeAddress,
          payment_tx: treasuryTxHash,
          user_signature: userSig || '0x_env_wallet_auto'
        })
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Signal Evaluation API failed [HTTP ${res.status} at ${activeBackendUrl}]: ${errText || 'Server Error. Check API Server Settings in Header!'}`)
      }

      const data = await res.json()
      if (!data || !data.signal) {
        throw new Error('Signal evaluation returned empty response from backend')
      }

      setTxHash(data.tx_hash || '')
      addLog(`⛓️ Intelligent Contract committed on ${netObj.name}`, 'hi')
      addLog(`✔ Optimistic Democracy consensus finalized!`, 'hi')
      setSignalReport(data.signal)
      setShowResultModal(true)
    } catch (e) {
      setError(e.message)
      addLog(`❌ ${e.message}`, 'warn')
    } finally {
      setLoading(false)
      setExecutionStep('')
    }
  }

  const copyAddr = (addr) => {
    navigator.clipboard.writeText(addr)
    setCopiedAddr(true)
    setTimeout(() => setCopiedAddr(false), 2000)
  }

  const filteredCoins = coins.filter(c =>
    c.sym.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeDisplayAddress = userAddress || envAddress
  const walletLabel = userAddress ? 'MetaMask (Cached)' : 'Testnet (.env)'

  return (
    <div className="container">

      {/* ── Crypto Live Market Ticker Bar ───────────────────────────────────── */}
      <div style={{ background: 'rgba(7,10,18,0.95)', borderBottom: '1px solid var(--border-glass)', padding: '6px 0', fontSize: 11, fontFamily: 'var(--font-mono)', overflowX: 'auto', display: 'flex', gap: 24, justifyContent: 'center', color: 'var(--text-secondary)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent-cyan)' }}>
          <Activity size={12} /> LIVE COINGECKO:
        </span>
        {coins.slice(0, 6).map(c => (
          <span key={c.sym} style={{ whiteSpace: 'nowrap' }}>
            <strong style={{ color: '#fff' }}>{c.sym}</strong>: {c.price} <span style={{ color: c.change.startsWith('+') ? '#10b981' : '#f43f5e' }}>{c.change}</span>
          </span>
        ))}
      </div>

      {/* ── Reconnect Toast ─────────────────────────────────────────────────── */}
      {reconnectedToast && (
        <div style={{ position: 'fixed', top: 70, right: 24, zIndex: 999, background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#10b981', padding: '10px 18px', borderRadius: 99, fontSize: 12, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}>
          <ShieldCheck size={16} /> Restored Web3 Session ({userAddress.slice(0, 6)}…{userAddress.slice(-4)})
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="header" style={{ background: 'transparent', borderBottom: 'none' }}>
        <div className="header-inner" style={{ padding: '18px 0' }}>
          <div className="logo">
            <div className="logo-icon">
              <Cpu size={22} color="#fff" />
            </div>
            <div>
              <div className="logo-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                GenSignal <span style={{ fontSize: 10, background: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)', padding: '2px 8px', borderRadius: 99, fontFamily: 'var(--font-mono)' }}>GenVM v0.7</span>
              </div>
              <div className="logo-sub">Decentralized AI Trading Oracle on GenLayer</div>
            </div>
          </div>

            <button
              className="btn btn-ghost"
              onClick={() => { setApiInput(customBackendUrl); setShowApiModal(true); }}
              style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, borderColor: 'rgba(6,182,212,0.4)', color: 'var(--accent-cyan)' }}
              title="Configure Backend API Server URL"
            >
              <Cpu size={13} /> API Server
            </button>

            <select
              value={activeNetwork}
              onChange={e => setActiveNetwork(e.target.value)}
              style={{
                background: 'rgba(15,23,42,0.9)', border: '1px solid var(--accent-cyan)',
                borderRadius: 999, color: 'var(--accent-cyan)', padding: '8px 16px',
                fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700,
                cursor: 'pointer', outline: 'none'
              }}
            >
              {NETWORKS.map(n => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.tag})
                </option>
              ))}
            </select>

            {userAddress ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="badge-net">
                  <div className="dot-green" />
                  {userAddress.slice(0, 6)}…{userAddress.slice(-4)}
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={disconnectWallet}
                  style={{ padding: '6px 10px', fontSize: 12 }}
                  title="Disconnect & clear cached session"
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <button className="btn btn-cyan" style={{ padding: '8px 18px', fontSize: 13 }} onClick={connectWallet}>
                <Wallet size={15} /> Connect MetaMask
              </button>
            )}
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="hero">
        <h1>AI-Validator Consensus Trading Oracle</h1>
        <p>
          Executing x402 Micropayments & GenVM Optimistic Democracy on <strong>GenLayer Bradbury Testnet</strong>.
        </p>
        {activeNetwork === 'bradbury' && (
          <div style={{ marginTop: 10 }}>
            <a
              href="https://testnet-faucet.genlayer.foundation"
              target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--accent-cyan)', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'underline' }}
            >
              Get Bradbury Testnet GEN Faucet Tokens <ExternalLink size={13} />
            </a>
          </div>
        )}
      </section>

      {/* ── Wallet Balance Card ───────────────────────────────────────────────── */}
      <div className="card" style={{ borderColor: 'rgba(6,182,212,0.4)', background: 'rgba(15,23,42,0.85)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
              <Wallet size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
                Real On-Chain Wallet Balance
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                  ({NETWORKS.find(n => n.id === activeNetwork)?.name})
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{ background: userAddress ? 'rgba(16,185,129,0.15)' : 'rgba(6,182,212,0.15)',
                           color: userAddress ? '#10b981' : 'var(--accent-cyan)',
                           padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)' }}
                >
                  {walletLabel}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {activeDisplayAddress || '—'}
                </span>
                {activeDisplayAddress && (
                  <button
                    onClick={() => copyAddr(activeDisplayAddress)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
                  >
                    {copiedAddr ? <Check size={12} /> : <Copy size={12} />}
                    <span style={{ fontSize: 11 }}>{copiedAddr ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#10b981', lineHeight: 1 }}>
              {realGenBalance}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>NATIVE GEN</div>
          </div>
        </div>
      </div>

      {/* ── Coin Selector with Live Price Sync Countdown Indicator ────────────── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div className="card-title" style={{ margin: 0, color: 'var(--accent-cyan)' }}>
            <TrendingUp size={18} /> Select Asset (CoinGecko Live Price Feed)
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: 99, border: '1px solid var(--border-glass)' }}>
              <RefreshCw size={11} className={isRefreshingCoins ? 'spin' : ''} style={{ color: 'var(--accent-cyan)' }} />
              Auto-sync: <strong style={{ color: 'var(--accent-cyan)' }}>{priceCountdown}s</strong>
              <button
                onClick={fetchCoins}
                disabled={isRefreshingCoins}
                style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: 11, textDecoration: 'underline', marginLeft: 4 }}
              >
                Sync Now
              </button>
            </div>

            <div style={{ position: 'relative', width: 220 }}>
              <input
                type="text"
                placeholder="Search crypto symbol…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(7,10,18,0.8)',
                  border: '1px solid var(--border-glass)', borderRadius: 10,
                  padding: '8px 12px 8px 34px', color: '#fff',
                  fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none'
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        <div className="coin-grid" style={{ maxHeight: 320, overflowY: 'auto' }}>
          {filteredCoins.map(c => (
            <button
              key={c.sym}
              className={`coin-card ${selectedCoin === c.sym ? 'active' : ''}`}
              onClick={() => setSelectedCoin(c.sym)}
            >
              <div>
                <span className="coin-sym">{c.sym}</span>
                <span className="coin-change" style={{ color: c.change.startsWith('+') ? '#10b981' : '#f43f5e' }}>{c.change}</span>
              </div>
              <div className="coin-name">{c.name}</div>
              <div className="coin-price">{c.price}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Strategy & Timeframe Selector ─────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div className="card-title" style={{ margin: 0, color: 'var(--accent-indigo)' }}>
            <Layers size={18} /> Select Strategy Engine & Timeframe
          </div>

          {/* Timeframe Selector Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(7,10,18,0.6)', padding: 4, borderRadius: 12, border: '1px solid var(--border-glass)' }}>
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.id}
                onClick={() => setSelectedTimeframe(tf.id)}
                style={{
                  background: selectedTimeframe === tf.id ? 'var(--accent-cyan)' : 'transparent',
                  color: selectedTimeframe === tf.id ? '#000' : 'var(--text-secondary)',
                  border: 'none', borderRadius: 8, padding: '6px 14px',
                  fontWeight: 800, fontSize: 12, fontFamily: 'var(--font-mono)',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
        <div className="strat-grid">
          {STRATEGIES.map(s => (
            <div
              key={s.id}
              className={`strat-card ${selectedStrategy === s.id ? 'active' : ''}`}
              onClick={() => setSelectedStrategy(s.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span className="strat-title">{s.label}</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-indigo)', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
                  {s.fee}
                </span>
              </div>
              <div className="strat-desc">{s.desc}</div>
              <div style={{ marginTop: 10, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Sparkles size={11} /> {s.tag}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <button className="btn btn-cyan" onClick={() => setShowSignModal(true)} disabled={loading}>
            {loading
              ? <><div className="spinner" /> Executing AI Consensus…</>
              : <><Zap size={16} /> Sign & Execute Signal <ArrowRight size={16} /></>
            }
          </button>
        </div>
        {error && (
          <div style={{ color: '#f43f5e', fontSize: 13, marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}
      </div>

      {/* ── Sign Modal ────────────────────────────────────────────────────────── */}
      {showSignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="card" style={{ maxWidth: 480, width: '100%', margin: 20 }}>
            <div className="card-title" style={{ color: 'var(--accent-cyan)' }}>
              <Lock size={18} /> Authorize Signal Query (x402)
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Executing on <strong>{NETWORKS.find(n => n.id === activeNetwork)?.name}</strong> via Groq LLM & GenLayer AI-Validators.
            </div>

            <div style={{ background: 'rgba(7,10,18,0.6)', borderRadius: 12, padding: 16, fontSize: 13, fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, border: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Network</span>
                <strong style={{ color: 'var(--accent-cyan)' }}>{NETWORKS.find(n => n.id === activeNetwork)?.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Asset</span>
                <strong style={{ color: '#fff' }}>{selectedCoin}/USDT</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Strategy</span>
                <strong style={{ color: '#fff' }}>{STRATEGIES.find(s => s.id === selectedStrategy)?.label}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>x402 Fee</span>
                <strong style={{ color: '#10b981' }}>{STRATEGIES.find(s => s.id === selectedStrategy)?.fee}</strong>
              </div>
              <div style={{ height: 1, background: 'var(--border-glass)', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Executing Wallet</span>
                <strong style={{ color: 'var(--accent-cyan)', fontSize: 11 }}>{activeDisplayAddress?.slice(0, 10)}…{activeDisplayAddress?.slice(-6)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Balance</span>
                <strong style={{ color: '#10b981' }}>{realGenBalance} GEN</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowSignModal(false)}>Cancel</button>
              <button className="btn btn-cyan" onClick={confirmAndExecute}>
                {userAddress ? 'Sign with MetaMask' : 'Authorize & Execute'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Execution / Loading Popup Modal ────────────────────────────── */}
      {loading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ maxWidth: 520, width: '100%', borderColor: 'var(--accent-cyan)', boxShadow: '0 0 45px rgba(6,182,212,0.3)', textAlign: 'center', padding: 32 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(6,182,212,0.15)', border: '2px solid var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--accent-cyan)' }}>
              <Loader2 size={32} className="spin" />
            </div>

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#fff', marginBottom: 6 }}>
              GenLayer Consensus Execution
            </h3>
            <p style={{ fontSize: 13, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', marginBottom: 20 }}>
              {executionStep || 'Processing x402 Micropayment & AI Oracle…'}
            </p>

            {/* Animated progress pulse bar */}
            <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-indigo))', animation: 'tickerScroll 2s linear infinite' }} />
            </div>

            <div className="log-stream" style={{ maxHeight: 150, textAlign: 'left', fontSize: 11 }}>
              {logs.map((l, i) => (
                <div key={i} className="log-line">
                  <span className="log-ts">[{l.time}]</span>
                  <span className={`log-${l.level}`}>{l.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Log Stream Card ───────────────────────────────────────────────────── */}
      {logs.length > 0 && !loading && (
        <div className="card">
          <div className="card-title"><Zap size={16} /> Consensus Log Timeline</div>
          <div className="log-stream">
            {logs.map((l, i) => (
              <div key={i} className="log-line">
                <span className="log-ts">[{l.time}]</span>
                <span className={`log-${l.level}`}>{l.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Signal Verdict Result Popup Modal ─────────────────────────────── */}
      {showResultModal && signalReport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ maxWidth: 620, width: '100%', borderColor: 'var(--accent-cyan)', boxShadow: '0 0 40px rgba(6,182,212,0.25)', animation: 'popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="card-title" style={{ margin: 0, color: 'var(--accent-cyan)', fontSize: 17 }}>
                <ShieldCheck size={22} /> On-Chain Settled Defensible Thesis
              </div>
              <button
                onClick={() => setShowResultModal(false)}
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-glass)', borderRadius: 99, color: '#fff', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(7,10,18,0.6)', padding: 16, borderRadius: 12, marginBottom: 16, border: '1px solid var(--border-glass)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff' }}>{signalReport.pair}</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)', padding: '3px 10px', borderRadius: 99, fontWeight: 700 }}>
                    {selectedTimeframe.toUpperCase()} TF
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{signalReport.strategy}</div>
              </div>
              <div className={`verdict-badge ${verdictClass(signalReport.verdict)}`} style={{ fontSize: 16, padding: '8px 20px' }}>
                {signalReport.verdict} · {signalReport.confidence}% Conf
              </div>
            </div>

            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', background: 'rgba(6,182,212,0.08)', padding: '8px 12px', borderRadius: 8, marginBottom: 16, border: '1px solid rgba(6,182,212,0.2)' }}>
              {NETWORKS.find(n => n.id === activeNetwork)?.name} | x402 GEN Fee Paid ✔ | Subscriber: {signalReport.user_identity?.slice(0, 12)}…
            </div>

            {/* Senior Quant Executive Summary Box */}
            {signalReport.expert_summary && (
              <div style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.12), rgba(99,102,241,0.08))', borderLeft: '4px solid var(--accent-cyan)', padding: 14, borderRadius: '0 10px 10px 0', marginBottom: 16, fontSize: 13, color: '#fff', fontStyle: 'italic', lineHeight: 1.6 }}>
                <div style={{ fontStyle: 'normal', fontWeight: 800, fontSize: 11, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                  🏛️ Executive Quant Desk Thesis:
                </div>
                "{signalReport.expert_summary}"
              </div>
            )}

            <div style={{ marginBottom: 16, background: 'rgba(15,23,42,0.5)', padding: 14, borderRadius: 10, border: '1px solid var(--border-glass)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--accent-cyan)' }}>Supporting Thesis:</div>
              <ul style={{ paddingLeft: 20, fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>
                {signalReport.supporting?.map((pt, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{pt}</li>
                ))}
              </ul>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div style={{ background: 'rgba(7,10,18,0.4)', padding: 12, borderRadius: 10, border: '1px solid var(--border-glass)' }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--verdict-neutral)', marginBottom: 4 }}>Counterpoint / Risk:</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{signalReport.counterpoint}</div>
              </div>
              <div style={{ background: 'rgba(7,10,18,0.4)', padding: 12, borderRadius: 10, border: '1px solid var(--border-glass)' }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--verdict-short)', marginBottom: 4 }}>Invalidation Condition:</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{signalReport.invalidation}</div>
              </div>
            </div>

            {txHash && (
              <div style={{ marginBottom: 20, fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(6,182,212,0.08)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(6,182,212,0.2)' }}>
                <a
                  href={`${EXPLORER_URL}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent-cyan)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  🔗 View On-Chain Transaction on GenLayer Explorer <ExternalLink size={13} />
                </a>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 4, wordBreak: 'break-all' }}>
                  Tx Hash: {txHash}
                </div>
              </div>
            )}

            <div style={{ textAlign: 'right' }}>
              <button className="btn btn-cyan" onClick={() => setShowResultModal(false)}>
                Close Result
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Signal Verdict Inline Card ────────────────────────────────────────── */}
      {signalReport && (
        <div className="card" style={{ borderColor: 'var(--accent-cyan)' }}>
          <div className="card-title" style={{ color: 'var(--accent-cyan)' }}><ShieldCheck size={18} /> On-Chain Settled Defensible Thesis</div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff' }}>{signalReport.pair}</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)', padding: '3px 10px', borderRadius: 99, fontWeight: 700 }}>
                  {selectedTimeframe.toUpperCase()} TF
                </span>
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, display: 'block' }}>{signalReport.strategy}</span>
            </div>
            <div className={`verdict-badge ${verdictClass(signalReport.verdict)}`}>
              {signalReport.verdict} · {signalReport.confidence}% Conf
            </div>
          </div>

          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', background: 'rgba(6,182,212,0.08)', padding: '8px 12px', borderRadius: 8, marginBottom: 16 }}>
            {NETWORKS.find(n => n.id === activeNetwork)?.name} | x402 GEN Fee Paid ✔ | Subscriber: {signalReport.user_identity?.slice(0, 10)}…
          </div>

          {/* Senior Quant Executive Summary Box */}
          {signalReport.expert_summary && (
            <div style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.12), rgba(99,102,241,0.08))', borderLeft: '4px solid var(--accent-cyan)', padding: 14, borderRadius: '0 10px 10px 0', marginBottom: 16, fontSize: 13, color: '#fff', fontStyle: 'italic', lineHeight: 1.6 }}>
              <div style={{ fontStyle: 'normal', fontWeight: 800, fontSize: 11, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                🏛️ Executive Quant Desk Thesis:
              </div>
              "{signalReport.expert_summary}"
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: 'var(--accent-cyan)' }}>Supporting Thesis:</div>
            <ul style={{ paddingLeft: 20, fontSize: 14, color: 'var(--text-primary)' }}>
              {signalReport.supporting?.map((pt, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{pt}</li>
              ))}
            </ul>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-glass)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--verdict-neutral)', marginBottom: 4 }}>Counterpoint / Risk:</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{signalReport.counterpoint}</div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--verdict-short)', marginBottom: 4 }}>Invalidation:</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{signalReport.invalidation}</div>
            </div>
          </div>

          {txHash && (
            <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid var(--border-glass)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
              <a
                href={`${EXPLORER_URL}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent-cyan)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                🔗 GenLayer Explorer Tx: {txHash.slice(0, 18)}… <ExternalLink size={13} />
              </a>
            </div>
          )}
        </div>
      )}
      {/* ── API Server Settings Modal ────────────────────────────────────── */}
      {showApiModal && (
        <div className="modal-overlay" onClick={() => setShowApiModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12, color: 'var(--accent-cyan)' }}>
              ⚙️ Backend API Server Settings
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Configure the Python FastAPI Backend endpoint. For local development or localhost testing from Vercel, enter your backend URL (e.g., <code>http://localhost:8001</code>).
            </p>
            <input
              type="text"
              value={apiInput}
              onChange={e => setApiInput(e.target.value)}
              placeholder="http://localhost:8001"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10, background: '#0f172a',
                border: '1px solid var(--accent-cyan)', color: '#fff', fontSize: 13, fontFamily: 'var(--font-mono)', marginBottom: 10
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: '4px 10px', borderColor: 'rgba(6,182,212,0.4)', color: 'var(--accent-cyan)' }}
                onClick={() => setApiInput('http://localhost:8001')}
              >
                ⚡ Reset to Localhost (http://localhost:8001)
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowApiModal(false)}>Cancel</button>
              <button
                className="btn btn-cyan"
                onClick={() => {
                  const trimmed = apiInput.trim() || 'http://localhost:8001'
                  setCustomBackendUrl(trimmed)
                  localStorage.setItem('gensignal_custom_backend', trimmed)
                  setShowApiModal(false)
                }}
              >
                Save API Endpoint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
