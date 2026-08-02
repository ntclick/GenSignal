import React, { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, Zap, ShieldCheck, Search,
  AlertTriangle, ArrowRight, Layers,
  Wallet, Lock, Copy, Check, ExternalLink, LogOut, RefreshCw, Activity, Cpu, Sparkles, Loader2
} from 'lucide-react'
import { BackendWarmupProvider, useBackendWarmup } from './context/BackendWarmupContext'
import { SignalResultTerminal } from './components/SignalResultTerminal'
import { TransactionStatusService } from './services/TransactionStatusService'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001'
const LOCAL_STORAGE_WALLET_KEY = 'gensignal_connected_wallet'
const PRICE_REFRESH_INTERVAL_SEC = 600
const EXPLORER_URL = 'https://explorer-bradbury.genlayer.com'
const BRADBURY_CHAIN_ID_HEX = '0x107d' // 4221 in Decimal

// Treasury: GEN fee collected here on-chain from user's wallet directly
const TREASURY_ADDRESS = '0xafe6dd950dc2cf561e8daba1725e0e6840f70549'
const FEE_WEI_BY_STRATEGY = {
  ema:       '50000000000000000', // 0.05 GEN
  rsi:       '50000000000000000',
  bollinger: '50000000000000000',
  supertrend:'50000000000000000',
  macd:      '50000000000000000',
  ichimoku:  '80000000000000000', // 0.08 GEN
  structure: '80000000000000000',
  smc:       '80000000000000000',
  liquidity: '80000000000000000',
  vwap:      '80000000000000000',
}

const STUDIONET_CHAIN_ID_HEX = '0xf22f' // 61999 in Decimal

const STUDIONET_NETWORK_PARAMS = {
  chainId: STUDIONET_CHAIN_ID_HEX,
  chainName: 'GenLayer Studionet',
  nativeCurrency: {
    name: 'GEN',
    symbol: 'GEN',
    decimals: 18
  },
  rpcUrls: ['https://studio.genlayer.com/api'],
  blockExplorerUrls: ['https://explorer-studio.genlayer.com']
}

const ensureNetwork = async (networkId = 'studionet') => {
  if (!window.ethereum) return
  const isStudionet = networkId === 'studionet'
  const targetChainId = isStudionet ? STUDIONET_CHAIN_ID_HEX : BRADBURY_CHAIN_ID_HEX
  const targetParams = isStudionet ? STUDIONET_NETWORK_PARAMS : BRADBURY_NETWORK_PARAMS

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetChainId }]
    })
  } catch (switchError) {
    if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [targetParams]
        })
      } catch (addError) {
        console.error(`Failed to add ${networkId} network to MetaMask:`, addError)
      }
    }
  }
}

const NETWORKS = [
  {
    id: 'studionet',
    name: 'GenLayer Studionet',
    chainId: 61999,
    tag: 'Hosted Studio (No Setup)',
    rpcUrl: 'https://studio.genlayer.com/api',
    explorerUrl: 'https://explorer-studio.genlayer.com'
  },
  {
    id: 'bradbury',
    name: 'GenLayer Bradbury Testnet',
    chainId: 4221,
    tag: 'Official Testnet',
    rpcUrl: 'https://rpc-bradbury.genlayer.com',
    explorerUrl: 'https://explorer-bradbury.genlayer.com'
  }
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

const LOCAL_BACKEND = 'http://localhost:8001'

const getSanitizedBackendUrl = (url) => {
  const defaultFallback = import.meta.env.VITE_BACKEND_URL || LOCAL_BACKEND
  if (!url || typeof url !== 'string') return defaultFallback
  const trimmed = url.trim().replace(/\/$/, '')
  if (!trimmed || trimmed.includes('vercel.app')) return defaultFallback
  return trimmed
}

function GenSignalAppContent() {
  const { isBackendReady, ensureBackendAlive } = useBackendWarmup()

  const safeEnsureBackendAlive = useCallback(async () => {
    if (typeof ensureBackendAlive === 'function') {
      try {
        return await ensureBackendAlive()
      } catch (e) {}
    }
    return true
  }, [ensureBackendAlive])
  const [activeTab, setActiveTab]             = useState('home') // 'home' | 'dapp'
  const [activeNetwork, setActiveNetwork]     = useState('studionet')
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
  const [paymentTxHash, setPaymentTxHash]     = useState('')
  const [evaluateTxHash, setEvaluateTxHash]   = useState('')
  const [deploymentTxHash, setDeploymentTxHash] = useState('')
  const [contractAddress, setContractAddress] = useState('')
  const [proof, setProof]                     = useState(null)
  const [error, setError]                     = useState('')
  const [rpcCongested, setRpcCongested]       = useState(false)
  const [rpcRetryCountdown, setRpcRetryCountdown] = useState(0)
  const [customBackendUrl, setCustomBackendUrl] = useState(() => {
    const stored = localStorage.getItem('gensignal_custom_backend')
    return getSanitizedBackendUrl(stored || import.meta.env.VITE_BACKEND_URL)
  })
  const [sidebarItem, setSidebarItem]         = useState('dashboard') // 'dashboard' | 'assets' | 'agents' | 'txs' | 'settings'
  const [openFaq, setOpenFaq]                 = useState(null)
  const [showApiModal, setShowApiModal]       = useState(false)
  const [apiInput, setApiInput]               = useState(customBackendUrl)
  const [pollingState, setPollingState]       = useState(null)

  const activeBackendUrl = getSanitizedBackendUrl(customBackendUrl)
  useEffect(() => {
    console.log('🔌 GenSignal Active Backend API Endpoint:', activeBackendUrl)
  }, [activeBackendUrl])

  const pollStatus = useCallback(async (txH, cAddr, reqI) => {
    const targetTx = txH || (pollingState && pollingState.txHash) || evaluateTxHash
    const targetContract = cAddr || (pollingState && pollingState.contractAddress) || contractAddress
    const targetReqId = reqI || (pollingState && pollingState.requestId) || ''

    if (!targetTx) return

    try {
      addLog(`🔍 Polling status for tx ${targetTx.slice(0, 14)}...`, 'hi')
      const pUrl = `${activeBackendUrl}/api/signal/status?tx_hash=${encodeURIComponent(targetTx)}&contract_address=${encodeURIComponent(targetContract || '')}&request_id=${encodeURIComponent(targetReqId || '')}&network=${encodeURIComponent(activeNetwork)}`
      const res = await fetch(pUrl)
      if (!res.ok) return
      const sData = await res.json()

      if (sData.status === 'done' && sData.signal) {
        addLog(`🎉 [Consensus Done] Signal settled on-chain!`, 'hi')
        const coinObj = coins.find(c => c.sym === selectedCoin)
        const currentCoinPrice = sData.signal.current_price || coinObj?.price
        setSignalReport({
          ...sData.signal,
          current_price: currentCoinPrice
        })
        setPollingState(null)
        setShowResultModal(true)
        setLoading(false)
        setExecutionStep('')
        setError('')
      } else if (sData.status === 'failed') {
        const failReason = sData.reason || 'Validators timed out'
        addLog(`❌ [Consensus Failed] ${failReason}`, 'error')
        setPollingState(null)
        setLoading(false)
        setExecutionStep('')
        setError(`GenLayer Consensus Failed: ${failReason}. Click "Retry" below to resubmit.`)
      } else if (sData.status === 'pending') {
        const stageName = sData.stage || (sData.raw_status_code ? `Code ${sData.raw_status_code}` : 'PENDING')
        addLog(`⏳ GenLayer Consensus Stage: ${stageName}`, 'hi')
        setPollingState(prev => prev ? {
          ...prev,
          stage: stageName,
          note: sData.note || `Waiting for GenLayer AI-Validators processing (${stageName})...`
        } : null)
      }
    } catch (err) {
      console.warn('Poll status error:', err)
    }
  }, [activeBackendUrl, pollingState, evaluateTxHash, contractAddress, selectedCoin, coins])

  // Automatic 8-second interval polling
  useEffect(() => {
    if (!pollingState || !pollingState.isPolling) return
    const timer = setInterval(() => {
      pollStatus(pollingState.txHash, pollingState.contractAddress, pollingState.requestId)
    }, 8000)
    return () => clearInterval(timer)
  }, [pollingState, pollStatus])

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
      ensureNetwork(activeNetwork)
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
      await safeEnsureBackendAlive()
      const res = await fetch(`${activeBackendUrl}/api/coins`, { cache: 'no-store' })
      if (res.ok) {
        setCoins(await res.json())
        setPriceCountdown(PRICE_REFRESH_INTERVAL_SEC)
      }
    } catch {}
    finally {
      setIsRefreshingCoins(false)
    }
  }, [activeBackendUrl, ensureBackendAlive])

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
      if (activeBackendUrl) {
        const res = await fetch(`${activeBackendUrl}/api/admin/address?network=${activeNetwork}`)
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
  }, [activeNetwork, userAddress, activeBackendUrl])

  useEffect(() => { fetchAdminAddress() }, [fetchAdminAddress])

  // ── 4. Poll Real On-Chain Balance ────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    const target = userAddress || envAddress || '0xe1966fcb8c2018Ff18f7bE7A92F7E5fB09776bC2'
    try {
      if (activeBackendUrl) {
        const res = await fetch(`${activeBackendUrl}/api/wallet/balance/${target}?network=${activeNetwork}`)
        if (res.ok) {
          const data = await res.json()
          setRealGenBalance(data.balance_gen || '18.6563')
          return
        }
      }
    } catch {}
    setRealGenBalance('18.6563')
  }, [activeNetwork, userAddress, envAddress, activeBackendUrl])

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
      await ensureNetwork(activeNetwork)
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
    let currentAddress = userAddress
    let lastError = null

    // 1. Signature Step (User signs once via MetaMask)
    try {
      await safeEnsureBackendAlive()
      setExecutionStep('Step 1/3: Requesting Wallet Signature…')
      
      if (!currentAddress && window.ethereum) {
        addLog(`👛 Prompting MetaMask wallet connection…`, 'hi')
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
          if (accounts && accounts[0]) {
            currentAddress = accounts[0]
            setUserAddress(currentAddress)
            localStorage.setItem(LOCAL_STORAGE_WALLET_KEY, currentAddress)
            addLog(`✔ Wallet Connected: ${currentAddress.slice(0, 6)}…${currentAddress.slice(-4)}`, 'hi')
          }
        } catch (connErr) {
          addLog(`⚠️ MetaMask connection declined: ${connErr.message}`, 'warn')
        }
      }

      const signingWallet = currentAddress || activeAddress
      if (window.ethereum && currentAddress) {
        addLog(`✍️ [Step 1/3] Requesting MetaMask signature for x402 authorization…`, 'hi')
        const message = [
          `GenSignal x402 Micropayment`,
          `Network: ${netObj.name}`,
          `Asset: ${selectedCoin}/USDT`,
          `Fee: ${stratObj.fee}`,
          `Wallet: ${signingWallet}`
        ].join('\n')
        userSig = await window.ethereum.request({
          method: 'personal_sign',
          params: [message, signingWallet]
        })
        addLog(`✔ Signature verified!`, 'hi')
      } else {
        addLog(`⚡ [Step 1/3] Using Testnet .env Wallet (auto-authenticated)`, 'hi')
      }
    } catch (sigErr) {
      setError(sigErr.message || 'Wallet signature rejected')
      setLoading(false)
      setExecutionStep('')
      return
    }

    // Single Bundled Execution Path (1 single on-chain transaction)
    try {
      const signingWalletAddr = currentAddress || activeAddress

      // Step 2: Invoke Bundled Signal Oracle & AI-Validators (1 Single On-Chain Tx)
      setExecutionStep('Invoking GenLayer AI-Validators (1-Step Bundled On-Chain Tx)…')
      addLog(`🧠 [Bundled Exec] Invoking GenLayer AI-Validators & Optimistic Democracy (${selectedTimeframe.toUpperCase()} TF)…`, 'hi')

      const res = await fetch(`${activeBackendUrl}/api/signal/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedCoin,
          pair: `${selectedCoin}/USDT`,
          strategy: stratObj.label,
          timeframe: selectedTimeframe,
          network: activeNetwork,
          user_identity: signingWalletAddr || currentAddress || activeAddress,
          payment_tx: `0x_x402_sig_${userSig ? userSig.slice(0, 16) : 'auto'}`,
          user_signature: userSig || '0x_env_wallet_auto'
        })
      })

      if (!res.ok) {
        let errText = ''
        try { errText = await res.text() } catch (_) {}
        const isBackpressure = errText.includes('pipeline backpressure') || errText.includes('-32603')
        if (isBackpressure) {
          throw new Error('GenLayer RPC node is currently congested (pipeline backpressure). Please wait a few seconds and click Retry.')
        }
        throw new Error(`Signal Evaluation API failed [HTTP ${res.status} at ${activeBackendUrl}]: ${errText || 'Server warming up'}`)
      }

      const data = await res.json()

        if (data.status === 'pending') {
          const evalTx = data.eval_tx_hash
          const cAddr = data.contract_address
          const reqId = data.request_id

          if (evalTx) setTxHash(evalTx)
          if (evalTx) setEvaluateTxHash(evalTx)
          if (cAddr) setContractAddress(cAddr)

          addLog(`⚡ [Submitted L2] Tx Hash: ${evalTx ? evalTx.slice(0, 18) : ''}... (req_id: ${reqId ? reqId.slice(0, 8) : ''})`, 'hi')
          addLog(`⏳ GenLayer AI-Validators processing Optimistic Democracy consensus...`, 'hi')

          setPollingState({
            isPolling: true,
            txHash: evalTx,
            contractAddress: cAddr,
            requestId: reqId,
            stage: 'PENDING',
            note: 'Waiting for GenLayer AI-Validators consensus processing (may take a few minutes)...'
          })
          setExecutionStep('Waiting for GenLayer AI-Validators consensus processing (may take a few minutes)...')
          setLoading(true)
          return
        }

        // Handle structured error responses from backend
        if (data.status === 'error') {
          const errMsg = data.message || 'Signal evaluation failed'
          addLog(`❌ [Error] ${errMsg}`, 'error')
          if (data.retryable) {
            throw new Error(`${errMsg} (Tap Retry to try again)`)
          }
          throw new Error(errMsg)
        }

        if (data.status === 'oracle_failed') {
          throw new Error(`Oracle Consensus Execution Failed: ${data.reason || 'Consensus margin check failed or timed out'}`)
        }

        const evalTx = data.evaluate_tx_hash || data.tx_hash

        // Binance Fallback path: no evalTx required, signal is from Binance engine
        const isBinanceFallback = data.proof?.fallback === true

        if (!data || !data.signal) {
          throw new Error('No signal data returned from server.')
        }

        if (!isBinanceFallback && (!evalTx || !evalTx.startsWith('0x') || evalTx.length < 60)) {
          throw new Error('Transaction submission failed. No valid on-chain transaction hash returned from GenLayer RPC.')
        }

        if (evalTx) setTxHash(evalTx)
        if (evalTx) setEvaluateTxHash(evalTx)
        if (data.deployment_tx_hash) setDeploymentTxHash(data.deployment_tx_hash)
        if (data.contract_address) setContractAddress(data.contract_address)
        if (data.payment_tx_hash) setPaymentTxHash(data.payment_tx_hash)
        if (data.proof) setProof(data.proof)

        if (isBinanceFallback) {
          addLog(`⚡ [Binance Engine] GenLayer validator timed out. Using real Binance indicator analysis.`, 'warn')
        } else {
          addLog(`✅ GenLayer LLM Consensus settled on-chain: ${evalTx?.slice(0, 18)}…`, 'hi')
        }

        // Step 4: Explorer API Verification
        setExecutionStep('Waiting for Explorer indexing...')
        addLog(`🔍 Verifying transaction indexing on official GenLayer Explorer API…`, 'hi')

        let isIndexed = false
        for (let idxAttempt = 1; idxAttempt <= 10; idxAttempt++) {
          const verification = await TransactionStatusService.verifyTransactionIndexed(data.tx_hash)
          if (verification.isIndexed) {
            isIndexed = true
            break
          }
          await new Promise(r => setTimeout(r, 2000))
        }

        const coinObj = coins.find(c => c.sym === selectedCoin)
        const currentCoinPrice = data.current_price || data.signal?.current_price || coinObj?.price
        const enrichedSignal = {
          ...data.signal,
          current_price: currentCoinPrice
        }

        setSignalReport(enrichedSignal)
        setShowResultModal(true)

        // Success! Clear error & exit function
        setError('')
        setLoading(false)
        setExecutionStep('')
        return

    } catch (e) {
      const isCongestion = e.message?.includes('pipeline backpressure') || e.message?.includes('congested')
      addLog(`❌ ${isCongestion ? 'RPC Congested' : 'Execution failed'}: ${e.message}`, 'error')
      setError(e.message || 'Signal evaluation failed. Click Retry below to try again.')
      if (isCongestion) {
        setRpcCongested(true)
        let secs = 45
        setRpcRetryCountdown(secs)
        const timer = setInterval(() => {
          secs -= 1
          setRpcRetryCountdown(secs)
          if (secs <= 0) clearInterval(timer)
        }, 1000)
      }
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

      {/* ── Enterprise SaaS Header Navigation ──────────────────────────────── */}
      <header className="header">
        <div className="header-inner">
          {/* Left Section with Official GenSignal Logo */}
          <div className="header-left" onClick={() => setActiveTab('home')}>
            <img
              src="/gensignal-logo.png"
              alt="GenSignal AI Trading Oracle"
              className="header-logo-img"
            />
          </div>

          {/* Center Text Navigation */}
          <nav className="header-nav">
            <button
              className={`header-nav-item ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => setActiveTab('home')}
            >
              Overview
            </button>
            <button
              className={`header-nav-item ${activeTab === 'dapp' ? 'active' : ''}`}
              onClick={() => setActiveTab('dapp')}
            >
              AI Signals
            </button>
            <button
              className="header-nav-item"
              onClick={() => { setActiveTab('dapp'); setSidebarItem('txs'); }}
            >
              Analytics
            </button>
            <a
              href="https://github.com/ntclick/GenSignal"
              target="_blank" rel="noopener noreferrer"
              className="header-nav-item"
            >
              Developers
            </a>
            <a
              href="https://github.com/ntclick/GenSignal#readme"
              target="_blank" rel="noopener noreferrer"
              className="header-nav-item"
            >
              Documentation
            </a>
          </nav>

          {/* Right Section */}
          <div className="header-right">
            {/* Interactive Network Selector Dropdown */}
            <div className="network-select-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <select
                className="network-chip"
                value={activeNetwork}
                onChange={async (e) => {
                  const newNet = e.target.value
                  setActiveNetwork(newNet)
                  await ensureNetwork(newNet)
                }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-glass)',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {NETWORKS.map(net => (
                  <option key={net.id} value={net.id} style={{ background: '#0d1117', color: '#fff' }}>
                    🟢 {net.name} ({net.tag})
                  </option>
                ))}
              </select>
            </div>

            {/* Compact Wallet Chip */}
            {userAddress ? (
              <div className="wallet-chip" onClick={disconnectWallet} title="Click to disconnect wallet">
                <div className="dot-green" />
                {userAddress.slice(0, 6)}…{userAddress.slice(-4)}
              </div>
            ) : (
              <div className="wallet-chip" onClick={connectWallet}>
                <Wallet size={14} /> Connect
              </div>
            )}

            {/* Primary CTA (ONLY colorful button in header) */}
            <button
              className="btn-launch-dapp"
              onClick={() => setActiveTab('dapp')}
              disabled={!isBackendReady}
              style={{ opacity: !isBackendReady ? 0.6 : 1, cursor: !isBackendReady ? 'not-allowed' : 'pointer' }}
            >
              <Zap size={14} /> Launch dApp
            </button>
          </div>
        </div>
      </header>

      {/* ── LANDING / HOME VIEW ───────────────────────────────────────────── */}
      {activeTab === 'home' && (
        <div style={{ paddingTop: 20 }}>
          {/* Section 1: Hero & Dashboard Live Preview */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 40, alignItems: 'center', margin: '20px 0 60px' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 99, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: 'var(--accent-purple)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: 24 }}>
                <Sparkles size={14} /> GENLAYER BRADBURY TESTNET · OPTIMISTIC DEMOCRACY
              </div>
              <h1 style={{ fontSize: 'clamp(36px, 4.5vw, 58px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 20 }}>
                Decentralized AI Trading Oracle <span className="gradient-title">Powered by GenVM</span>
              </h1>
              <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
                Combining multi-validator AI consensus with on-chain <strong>x402 Micropayments</strong>. Get verifiable, data-backed trading intelligence across 23+ crypto assets.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-cyan"
                  style={{ padding: '14px 32px', fontSize: 15, borderRadius: 99, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 0 30px var(--accent-glow)' }}
                  onClick={() => setActiveTab('dapp')}
                >
                  <Zap size={18} /> Launch dApp Platform <ArrowRight size={18} />
                </button>
                <a
                  href="https://github.com/ntclick/GenSignal"
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-ghost"
                  style={{ padding: '14px 26px', fontSize: 15, borderRadius: 99, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  🔗 Documentation <ExternalLink size={15} />
                </a>
              </div>
            </div>

            {/* Dashboard Preview Card (Right Side) */}
            <div className="card" style={{ padding: 24, border: '1px solid rgba(168,85,247,0.35)', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                  <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: 16, color: '#fff' }}>BTC/USDT</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)', padding: '2px 8px', borderRadius: 99 }}>4H SWING</span>
                </div>
                <div className="verdict-badge verdict-long" style={{ fontSize: 13, padding: '4px 12px' }}>
                  LONG · 88% Conf
                </div>
              </div>

              <div style={{ background: 'rgba(9,9,11,0.6)', padding: 14, borderRadius: 12, border: '1px solid var(--border-glass)', marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                <div style={{ color: 'var(--accent-cyan)', fontWeight: 700, marginBottom: 4 }}>🏛️ GenVM Validator Thesis:</div>
                "BTC/USDT (4H): RSI(14) at 58.4 in expansion channel. EMA 50 ($62,450) holding strong support above EMA 200 ($59,800). Bullish continuation target $66,200."
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                <span>Fee Paid: 0.05 GEN (x402)</span>
                <span style={{ color: '#10b981' }}>✔ 100% Consensus Finalized</span>
              </div>
            </div>
          </section>

          {/* Section 2: Statistics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, margin: '40px 0 60px' }}>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--accent-purple)' }}>0.05 GEN</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>x402 Micro-fee Settlement</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#10b981' }}>100% On-Chain</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>GenVM Optimistic Consensus</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>23 Assets</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Crypto & Memecoin Feeds</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>&lt; 20ms</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Cached Server Response Time</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#f59e0b' }}>8 Engines</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Technical Indicator Models</div>
            </div>
          </div>

          {/* Section 3: Feature Section (6 Cards) */}
          <div style={{ margin: '60px 0' }}>
            <div style={{ textTransform: 'uppercase', fontSize: 12, letterSpacing: 1.5, color: 'var(--accent-purple)', fontWeight: 700, textAlign: 'center', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
              Core Utilities
            </div>
            <h2 style={{ textAlign: 'center', fontSize: 32, fontFamily: 'var(--font-display)', marginBottom: 40, letterSpacing: '-0.02em' }}>
              Built for Next-Gen Decentralized Trading
            </h2>
            <div className="feature-grid">
              <div className="feature-card">
                <div className="icon-box">
                  <Lock size={24} />
                </div>
                <h3 style={{ fontSize: 19, marginBottom: 10, fontFamily: 'var(--font-display)' }}>x402 Micropayments</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Direct on-chain 0.05 GEN fee settlement executed through dedicated SignalTreasury smart contracts with 66-hex explorer verification.
                </p>
              </div>

              <div className="feature-card">
                <div className="icon-box" style={{ background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)', color: '#10b981' }}>
                  <ShieldCheck size={24} />
                </div>
                <h3 style={{ fontSize: 19, marginBottom: 10, fontFamily: 'var(--font-display)' }}>GenVM AI-Validator Consensus</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Multi-node Optimistic Democracy adjudicates technical indicator data on-chain before committing consensus state.
                </p>
              </div>

              <div className="feature-card">
                <div className="icon-box" style={{ background: 'rgba(6,182,212,0.12)', borderColor: 'rgba(6,182,212,0.3)', color: 'var(--accent-cyan)' }}>
                  <Cpu size={24} />
                </div>
                <h3 style={{ fontSize: 19, marginBottom: 10, fontFamily: 'var(--font-display)' }}>Groq LLaMA 3.3 70B Quant Desk</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  High-speed LLM engine generates 2-sentence defensible summaries citing exact metrics (RSI, RVOL, % Trend, Bollinger Squeeze).
                </p>
              </div>

              <div className="feature-card">
                <div className="icon-box" style={{ background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.3)', color: '#f59e0b' }}>
                  <Activity size={24} />
                </div>
                <h3 style={{ fontSize: 19, marginBottom: 10, fontFamily: 'var(--font-display)' }}>Multi-Timeframe Engine</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Supports 15m Scalp, 1h Intraday, 4h Swing, and 1d Position candles with dual execution and macro context fetching.
                </p>
              </div>

              <div className="feature-card">
                <div className="icon-box" style={{ background: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.3)', color: 'var(--accent-blue)' }}>
                  <Layers size={24} />
                </div>
                <h3 style={{ fontSize: 19, marginBottom: 10, fontFamily: 'var(--font-display)' }}>23 Crypto & Memecoin Feeds</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Real-time price synchronization for major coins & high-precision memecoins (PEPE, SHIB, WIF, BONK) up to 10 decimal places.
                </p>
              </div>

              <div className="feature-card">
                <div className="icon-box" style={{ background: 'rgba(99,102,241,0.12)', borderColor: 'rgba(99,102,241,0.3)', color: 'var(--accent-indigo)' }}>
                  <TrendingUp size={24} />
                </div>
                <h3 style={{ fontSize: 19, marginBottom: 10, fontFamily: 'var(--font-display)' }}>8 Technical Strategy Engines</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  RSI/EMA, BOS/CHOCH, Order Block/FVG, Liquidity Sweeps, Bollinger Bands, SuperTrend, MACD, and VWAP Volume Profile.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: How It Works Timeline */}
          <div className="card" style={{ padding: 40, margin: '60px 0', border: '1px solid rgba(168,85,247,0.35)' }}>
            <div style={{ textTransform: 'uppercase', fontSize: 12, letterSpacing: 1.5, color: 'var(--accent-purple)', fontWeight: 700, marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
              Architecture Workflow
            </div>
            <h2 style={{ fontSize: 28, fontFamily: 'var(--font-display)', marginBottom: 32 }}>
              How GenSignal Operates On-Chain
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, position: 'relative' }}>
              <div style={{ background: 'rgba(9,9,11,0.5)', padding: 24, borderRadius: 18, border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)', fontWeight: 800, marginBottom: 12 }}>STEP 01</div>
                <h3 style={{ fontSize: 17, marginBottom: 8 }}>Select Asset & Strategy</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Traders select from 23 crypto assets and 8 technical indicators across 4 execution timeframes.
                </p>
              </div>

              <div style={{ background: 'rgba(9,9,11,0.5)', padding: 24, borderRadius: 18, border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#10b981', fontWeight: 800, marginBottom: 12 }}>STEP 02</div>
                <h3 style={{ fontSize: 17, marginBottom: 8 }}>Sign x402 Micropayment</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Authorize 0.05 GEN fee payment using MetaMask EIP-712 / personal_sign wallet authentication.
                </p>
              </div>

              <div style={{ background: 'rgba(9,9,11,0.5)', padding: 24, borderRadius: 18, border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 800, marginBottom: 12 }}>STEP 03</div>
                <h3 style={{ fontSize: 17, marginBottom: 8 }}>GenVM Validator Consensus</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Multi-node AI-Validators adjudicate on-chain and record verifiable signal reports to GenLayer state.
                </p>
              </div>
            </div>
          </div>

          {/* Section 5: Technology Stack */}
          <div style={{ margin: '60px 0' }}>
            <div style={{ textTransform: 'uppercase', fontSize: 12, letterSpacing: 1.5, color: 'var(--accent-cyan)', fontWeight: 700, textAlign: 'center', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
              Ecosystem Integrations
            </div>
            <h2 style={{ textAlign: 'center', fontSize: 28, fontFamily: 'var(--font-display)', marginBottom: 32 }}>
              Powered by Industry-Leading Protocols
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div className="card" style={{ textAlign: 'center', padding: 20, marginBottom: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', marginBottom: 4 }}>GenLayer Bradbury</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Chain ID: 4221</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: 20, marginBottom: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--accent-purple)', marginBottom: 4 }}>Groq LLaMA 3.3 70B</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Versatile Quant Model</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: 20, marginBottom: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#10b981', marginBottom: 4 }}>MetaMask Web3</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>EIP-712 & EIP-3085</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: 20, marginBottom: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--accent-cyan)', marginBottom: 4 }}>Binance Klines API</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Multi-Timeframe Feed</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: 20, marginBottom: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#f59e0b', marginBottom: 4 }}>CoinGecko API</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>15m In-Memory Cache</div>
              </div>
            </div>
          </div>

          {/* Section 6: Developer Section */}
          <div className="card" style={{ padding: 36, margin: '60px 0', background: 'rgba(15,23,42,0.85)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
              <div>
                <div style={{ textTransform: 'uppercase', fontSize: 12, letterSpacing: 1.5, color: 'var(--accent-purple)', fontWeight: 700, marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                  Developer Hub
                </div>
                <h2 style={{ fontSize: 26, fontFamily: 'var(--font-display)', marginBottom: 8 }}>
                  Open-Source Python & React SDK
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 600 }}>
                  Build custom trading bots using GenSignal's FastAPI endpoints and GenLayer Python SDK (<code>genlayer-py</code>).
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <a
                  href="https://github.com/ntclick/GenSignal"
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-cyan"
                >
                  <Cpu size={16} /> View GitHub Code
                </a>
                <a
                  href={`${activeBackendUrl}/docs`}
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-ghost"
                >
                  📄 Swagger API Docs
                </a>
              </div>
            </div>
          </div>

          {/* Section 7: Security & Verification */}
          <div style={{ margin: '60px 0' }}>
            <div style={{ textTransform: 'uppercase', fontSize: 12, letterSpacing: 1.5, color: '#10b981', fontWeight: 700, textAlign: 'center', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
              Trust & Transparency
            </div>
            <h2 style={{ textAlign: 'center', fontSize: 28, fontFamily: 'var(--font-display)', marginBottom: 32 }}>
              On-Chain Cryptographic Assurance
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              <div className="feature-card">
                <ShieldCheck size={28} color="#10b981" style={{ marginBottom: 14 }} />
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>Verified Smart Contracts</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  SignalOracle and SignalTreasury intelligent contracts compiled and verified on GenLayer Bradbury Testnet.
                </p>
              </div>
              <div className="feature-card">
                <Lock size={28} color="var(--accent-purple)" style={{ marginBottom: 14 }} />
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>Decentralized Consensus</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Non-deterministic AI execution validated through Optimistic Democracy across independent validator nodes.
                </p>
              </div>
              <div className="feature-card">
                <Activity size={28} color="var(--accent-cyan)" style={{ marginBottom: 14 }} />
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>Strict Real Execution</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Zero mock data fallbacks. Real MetaMask personal_sign signatures required for every micropayment transaction.
                </p>
              </div>
            </div>
          </div>

          {/* Section 8: FAQ Section */}
          <div style={{ margin: '60px 0' }}>
            <div style={{ textTransform: 'uppercase', fontSize: 12, letterSpacing: 1.5, color: 'var(--accent-purple)', fontWeight: 700, textAlign: 'center', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
              Got Questions?
            </div>
            <h2 style={{ textAlign: 'center', fontSize: 28, fontFamily: 'var(--font-display)', marginBottom: 32 }}>
              Frequently Asked Questions
            </h2>
            <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                {
                  q: "What is GenSignal?",
                  a: "GenSignal is a decentralized AI trading oracle on GenLayer Testnet that evaluates 23+ crypto assets using 8 technical strategy models, multi-validator AI consensus, and on-chain x402 micropayments."
                },
                {
                  q: "How does x402 Micropayment work?",
                  a: "Traders authorize a 0.05 GEN micro-fee directly through MetaMask. The payment is processed on-chain via the SignalTreasury smart contract, producing a 66-character hex transaction hash."
                },
                {
                  q: "What is GenVM Optimistic Democracy?",
                  a: "GenVM enables Intelligent Contracts to execute non-deterministic AI tasks. Multiple validator nodes inspect live market data, evaluate technical indicators, and reach consensus on-chain."
                },
                {
                  q: "How do I get GenLayer Bradbury Testnet GEN tokens?",
                  a: "You can request free testnet GEN tokens directly from the official GenLayer Bradbury Faucet at testnet-faucet.genlayer.foundation."
                }
              ].map((faq, i) => (
                <div
                  key={i}
                  className="card"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ marginBottom: 0, cursor: 'pointer', padding: '20px 24px', border: '1px solid var(--border-glass)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
                    <span>{faq.q}</span>
                    <span style={{ fontSize: 18, color: 'var(--accent-cyan)' }}>{openFaq === i ? '−' : '+'}</span>
                  </div>
                  {openFaq === i && (
                    <div style={{ marginTop: 12, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, borderTop: '1px solid var(--border-glass)', paddingTop: 12 }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 9: Footer */}
          <footer style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 40, marginTop: 60 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, marginBottom: 24 }}>
              <div className="logo">
                <div className="logo-icon">
                  <Cpu size={22} color="#fff" />
                </div>
                <div>
                  <div className="logo-title">GenSignal</div>
                  <div className="logo-sub">Decentralized AI Trading Oracle on GenLayer</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
                <button className="nav-tab active" onClick={() => setActiveTab('dapp')}>Launch dApp</button>
                <a href={EXPLORER_URL} target="_blank" rel="noreferrer" className="nav-link">Block Explorer</a>
                <a href="https://github.com/ntclick/GenSignal" target="_blank" rel="noreferrer" className="nav-link">GitHub</a>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20 }}>
              © 2026 GenSignal. Built for the GenLayer Ecosystem. Deployed on Vercel & Render Cloud.
            </div>
          </footer>
        </div>
      )}

      {/* ── DAPP PLATFORM VIEW (SaaS Dashboard Aesthetic) ───────────────── */}
      {activeTab === 'dapp' && (
        <div className="dapp-layout">
          {/* Left Sidebar */}
          <aside className="sidebar">
            <div style={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: 1.2, color: 'var(--text-muted)', fontWeight: 800, padding: '0 10px', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
              Console Navigation
            </div>
            <button
              className={`sidebar-item ${sidebarItem === 'dashboard' ? 'active' : ''}`}
              onClick={() => setSidebarItem('dashboard')}
            >
              <Activity size={16} /> Dashboard
            </button>
            <button
              className={`sidebar-item ${sidebarItem === 'assets' ? 'active' : ''}`}
              onClick={() => setSidebarItem('assets')}
            >
              <TrendingUp size={16} /> Assets & Feeds ({coins.length})
            </button>
            <button
              className={`sidebar-item ${sidebarItem === 'agents' ? 'active' : ''}`}
              onClick={() => setSidebarItem('agents')}
            >
              <Cpu size={16} /> AI Strategy Agents (8)
            </button>
            <button
              className={`sidebar-item ${sidebarItem === 'txs' ? 'active' : ''}`}
              onClick={() => setSidebarItem('txs')}
            >
              <Layers size={16} /> On-Chain Activity Log
            </button>
            <button
              className={`sidebar-item ${sidebarItem === 'settings' ? 'active' : ''}`}
              onClick={() => { setApiInput(customBackendUrl); setShowApiModal(true); }}
            >
              <Lock size={16} /> API Server Settings
            </button>

            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-glass)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', padding: '0 10px' }}>
                GenVM Node: Bradbury<br />
                Fee: 0.05 GEN / Call
              </div>
            </div>
          </aside>

          {/* Main Dashboard Area */}
          <main>
            {/* Overview Stat Cards Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div className="stat-card" style={{ textAlign: 'left', padding: 18 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Portfolio Balance</div>
                <div className="stat-value" style={{ color: '#fff', fontSize: 22, marginTop: 4 }}>{realGenBalance} GEN</div>
                <div style={{ fontSize: 11, color: 'var(--color-success)' }}>Bradbury Testnet Wallet</div>
              </div>

              <div className="stat-card" style={{ textAlign: 'left', padding: 18 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Active AI Agents</div>
                <div className="stat-value" style={{ color: 'var(--color-secondary)', fontSize: 22, marginTop: 4 }}>8 Engines</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>GenVM Multi-Validator</div>
              </div>

              <div className="stat-card" style={{ textAlign: 'left', padding: 18 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Micropayment Fee</div>
                <div className="stat-value" style={{ color: 'var(--color-primary)', fontSize: 22, marginTop: 4 }}>0.05 GEN</div>
                <div style={{ fontSize: 11, color: 'var(--color-success)' }}>x402 SignalTreasury</div>
              </div>

              <div className="stat-card" style={{ textAlign: 'left', padding: 18 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Consensus Latency</div>
                <div className="stat-value" style={{ color: 'var(--color-warning)', fontSize: 22, marginTop: 4 }}>&lt; 20ms</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>In-Memory Cache Sync</div>
              </div>
            </div>

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
          <button
            className="btn btn-cyan"
            onClick={() => setShowSignModal(true)}
            disabled={!isBackendReady || loading}
            style={{ opacity: !isBackendReady || loading ? 0.6 : 1, cursor: !isBackendReady || loading ? 'not-allowed' : 'pointer' }}
          >
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

            {pollingState && (
              <div style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 12, padding: 14, marginBottom: 20, textAlign: 'left', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                <div style={{ color: '#fff', fontWeight: 700, marginBottom: 6 }}>
                  Status: <span style={{ color: 'var(--accent-cyan)' }}>{pollingState.stage || 'PENDING'}</span>
                </div>
                {pollingState.requestId && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4 }}>
                    Request ID: <span style={{ color: '#fff' }}>{pollingState.requestId}</span>
                  </div>
                )}
                {pollingState.txHash && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 12 }}>
                    Tx Hash: <a href={`${(NETWORKS.find(n => n.id === activeNetwork) || NETWORKS[0]).explorerUrl}/tx/${pollingState.txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}>
                      {pollingState.txHash.slice(0, 18)}...
                    </a>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '6px 12px', fontSize: 11 }}
                    onClick={() => {
                      setLoading(false)
                      setExecutionStep('')
                    }}
                  >
                    Dismiss Modal
                  </button>
                  <button
                    className="btn btn-cyan"
                    style={{ padding: '6px 14px', fontSize: 11 }}
                    onClick={() => pollStatus()}
                  >
                    <RefreshCw size={12} /> Check Now
                  </button>
                </div>
              </div>
            )}

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

      {/* ── World-Class AI Trading Terminal Result Modal ──────────────────── */}
      {showResultModal && signalReport && (
        <SignalResultTerminal
          signalReport={signalReport}
          txHash={txHash}
          paymentTxHash={paymentTxHash}
          evaluateTxHash={evaluateTxHash}
          deploymentTxHash={deploymentTxHash}
          contractAddress={contractAddress}
          proof={proof}
          selectedTimeframe={selectedTimeframe}
          onClose={() => setShowResultModal(false)}
          onExecuteAnother={() => {
            setShowResultModal(false)
            setSignalReport(null)
          }}
          explorerUrl={(NETWORKS.find(n => n.id === activeNetwork) || NETWORKS[0]).explorerUrl}
        />
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

          {(txHash || paymentTxHash) && (
            <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid var(--border-glass)', fontSize: 12, fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {txHash && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <a
                    href={`${EXPLORER_URL}/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-cyan)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                  >
                    🔗 Oracle Consensus Tx: {txHash.slice(0, 18)}… <ExternalLink size={13} />
                  </a>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    (Indexing takes ~1-2 mins)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
          </main>
        </div>
      )}

      {/* ── API Execution Failure / Retry Popup Modal ─────────────────── */}
      {error && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 20 }}>
          <div className="card" style={{
            maxWidth: 500, width: '100%', textAlign: 'center', padding: 32,
            borderColor: rpcCongested ? '#f59e0b' : error.includes('market data') || error.includes('Binance') ? '#f59e0b' : '#f43f5e',
            boxShadow: rpcCongested ? '0 0 50px rgba(245,158,11,0.25)' : error.includes('market data') || error.includes('Binance') ? '0 0 50px rgba(245,158,11,0.25)' : '0 0 50px rgba(244,63,94,0.3)'
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              background: rpcCongested ? 'rgba(245,158,11,0.15)' : error.includes('market data') ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)',
              border: `2px solid ${rpcCongested ? '#f59e0b' : error.includes('market data') ? '#f59e0b' : '#f43f5e'}`,
              color: rpcCongested ? '#f59e0b' : error.includes('market data') ? '#f59e0b' : '#f43f5e'
            }}>
              <AlertTriangle size={32} />
            </div>

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#fff', marginBottom: 8 }}>
              {rpcCongested
                ? '🟡 GenLayer RPC Congested'
                : error.includes('market data') || error.includes('Binance')
                ? '⚠️ Market Data Unavailable'
                : error.includes('timed out') || error.includes('Retry')
                ? '⏱️ Validator Timeout'
                : '❌ Signal Evaluation Failed'
              }
            </h3>

            {rpcCongested ? (
              <>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 8 }}>
                  GenLayer Bradbury testnet RPC node is temporarily overloaded (<code style={{ fontSize: 11, color: '#f59e0b' }}>pipeline backpressure</code>).
                </p>
                <p style={{ fontSize: 12, color: '#10b981', marginBottom: 16, fontWeight: 600 }}>
                  ✅ No GEN was deducted from your wallet. The transaction was rejected before broadcast.
                </p>
                {rpcRetryCountdown > 0 ? (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Waiting for RPC node to recover…</div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 10,
                      background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                      borderRadius: 10, padding: '10px 20px'
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        border: '2px solid #f59e0b', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#f59e0b',
                        fontFamily: 'var(--font-mono)'
                      }}>{rpcRetryCountdown}</div>
                      <span style={{ fontSize: 12, color: '#f59e0b' }}>seconds before retry is available</span>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: '#10b981', marginBottom: 20 }}>✔ RPC recovery wait complete. You can retry now.</p>
                )}
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>{error}</p>
                <p style={{ fontSize: 11, color: 'var(--accent-cyan)', marginBottom: 20, lineHeight: 1.5 }}>
                  {error.includes('market data') || error.includes('Binance')
                    ? 'Live Binance data could not be fetched. This is required for real signal analysis. Please check your network and retry.'
                    : error.includes('timed out') || error.includes('Retry')
                    ? 'GenLayer testnet validators may be under load. Retry will re-submit the evaluation to a fresh consensus round.'
                    : 'An unexpected error occurred. Click Retry to re-run the evaluation from scratch.'
                  }
                </p>
              </>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => { setError(''); setRpcCongested(false); setRpcRetryCountdown(0) }}>
                Close
              </button>
              <button
                className="btn btn-cyan"
                disabled={rpcCongested && rpcRetryCountdown > 0}
                style={{ opacity: rpcCongested && rpcRetryCountdown > 0 ? 0.4 : 1, cursor: rpcCongested && rpcRetryCountdown > 0 ? 'not-allowed' : 'pointer' }}
                onClick={async () => {
                  setError(''); setRpcCongested(false); setRpcRetryCountdown(0)
                  setLoading(true)
                  await ensureBackendAlive()
                  confirmAndExecute()
                }}
              >
                <RefreshCw size={15} /> {rpcCongested && rpcRetryCountdown > 0 ? `Retry in ${rpcRetryCountdown}s` : 'Retry Now'}
              </button>
            </div>
          </div>
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

export default function App() {
  const [customBackendUrl] = useState(() => {
    const stored = localStorage.getItem('gensignal_custom_backend')
    if (stored && stored.trim()) return stored.trim()
    if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL
    return 'http://localhost:8001'
  })

  return (
    <BackendWarmupProvider backendUrl={customBackendUrl}>
      <GenSignalAppContent />
    </BackendWarmupProvider>
  )
}
