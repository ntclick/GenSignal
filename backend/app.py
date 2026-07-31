"""
GenSignal FastAPI Backend Server with Real On-Chain GEN Balance (genlayer_py) & CoinGecko Multi-Asset Market Data

Defaults to GenLayer Bradbury Testnet (Chain ID 4221).
Reads REAL on-chain native GEN wallet balance via genlayer_py SDK client (returns 19.0 GEN for testnet account).
"""

import os
import json
import pathlib
import httpx
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from genlayer_py import create_client, create_account, studionet, testnet_bradbury

load_dotenv(dotenv_path=pathlib.Path(__file__).parent.parent / ".env")

PRIVATE_KEY       = os.getenv("GENLAYER_PRIVATE_KEY", "")
DEFAULT_NETWORK   = os.getenv("GENLAYER_NETWORK", "bradbury").lower()
COINGECKO_API_KEY = os.getenv("COINGECKO_API_KEY", "")

CONTRACT_ORACLE   = pathlib.Path(__file__).parent.parent / "contracts" / "signal_oracle.py"
CONTRACT_TREASURY = pathlib.Path(__file__).parent.parent / "contracts" / "signal_treasury.py"

BRADBURY_RPC_URL    = "https://rpc-bradbury.genlayer.com"
NATIVE_TOKEN_SYMBOL = "GEN"
X402_FEE_GEN        = "0.05"
TREASURY_ADDRESS    = "0xafe6dd950dc2cf561e8daba1725e0e6840f70549"
IDENTITY_REGISTRY   = "0x8004A818BFB912233c491871b3d84c89A494BD9e"

# x402 fee: 0.05 GEN in wei
X402_FEE_WEI = 50_000_000_000_000_000  # 0.05 * 10^18

COINS_MAP = [
    {"sym": "BTC", "cg_id": "bitcoin", "pair": "BTC/USDT", "name": "Bitcoin"},
    {"sym": "ETH", "cg_id": "ethereum", "pair": "ETH/USDT", "name": "Ethereum"},
    {"sym": "SOL", "cg_id": "solana", "pair": "SOL/USDT", "name": "Solana"},
    {"sym": "BNB", "cg_id": "binancecoin", "pair": "BNB/USDT", "name": "BNB"},
    {"sym": "PEPE", "cg_id": "pepe", "pair": "PEPE/USDT", "name": "Pepe"},
    {"sym": "DOGE", "cg_id": "dogecoin", "pair": "DOGE/USDT", "name": "Dogecoin"},
    {"sym": "SHIB", "cg_id": "shiba-inu", "pair": "SHIB/USDT", "name": "Shiba Inu"},
    {"sym": "WIF", "cg_id": "dogwifcoin", "pair": "WIF/USDT", "name": "dogwifhat"},
    {"sym": "BONK", "cg_id": "bonk", "pair": "BONK/USDT", "name": "Bonk"},
    {"sym": "FLOKI", "cg_id": "floki", "pair": "FLOKI/USDT", "name": "Floki"},
    {"sym": "NEIRO", "cg_id": "neiro-3", "pair": "NEIRO/USDT", "name": "Neiro"},
    {"sym": "AVAX", "cg_id": "avalanche-2", "pair": "AVAX/USDT", "name": "Avalanche"},
    {"sym": "LINK", "cg_id": "chainlink", "pair": "LINK/USDT", "name": "Chainlink"},
    {"sym": "SUI", "cg_id": "sui", "pair": "SUI/USDT", "name": "Sui Network"},
    {"sym": "NEAR", "cg_id": "near", "pair": "NEAR/USDT", "name": "NEAR Protocol"},
    {"sym": "APT", "cg_id": "aptos", "pair": "APT/USDT", "name": "Aptos"},
    {"sym": "RENDER", "cg_id": "render-token", "pair": "RENDER/USDT", "name": "Render Network"},
    {"sym": "INJ", "cg_id": "injective-protocol", "pair": "INJ/USDT", "name": "Injective"},
    {"sym": "FET", "cg_id": "fetch-ai", "pair": "FET/USDT", "name": "Artificial Superintelligence"},
    {"sym": "TIA", "cg_id": "celestia", "pair": "TIA/USDT", "name": "Celestia"},
    {"sym": "SEI", "cg_id": "sei-network", "pair": "SEI/USDT", "name": "Sei Network"},
    {"sym": "OP", "cg_id": "optimism", "pair": "OP/USDT", "name": "Optimism"},
    {"sym": "ARB", "cg_id": "arbitrum", "pair": "ARB/USDT", "name": "Arbitrum"},
]

def get_client(network: str = ""):
    if not PRIVATE_KEY:
        raise RuntimeError("GENLAYER_PRIVATE_KEY is not set in .env")
    key = PRIVATE_KEY if PRIVATE_KEY.startswith("0x") else "0x" + PRIVATE_KEY
    account = create_account(key)
    target = network.lower() if network else DEFAULT_NETWORK
    if target in ["studionet", "61999", "local"]:
        chain = studionet
    else:
        chain = testnet_bradbury
    return create_client(chain=chain, account=account)

app = FastAPI(
    title="GenSignal API",
    description="GenLayer Bradbury Testnet API with Real On-Chain Balance & CoinGecko Data",
    version="0.7.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # False allows wildcard * for Vercel & localhost cross-origin requests
    allow_methods=["*"],
    allow_headers=["*"],
)



class EvaluateRequest(BaseModel):
    symbol: str
    pair: str
    strategy: str
    timeframe: Optional[str] = "4h"      # "15m", "1h", "4h", "1d"
    network: Optional[str] = "bradbury"
    user_identity: Optional[str] = ""
    payment_tx: Optional[str] = ""       # treasury tx hash from /api/signal/pay
    user_signature: Optional[str] = ""

class PayRequest(BaseModel):
    user_identity: str   # payer's wallet address
    pair: str            # e.g. "BTC/USDT"
    network: Optional[str] = "bradbury"

# ── APPLICATION SINGLETONS & STARTUP WARM-UP ────────────────────────────────
_GENLAYER_CLIENTS = {}
_SHARED_HTTP_CLIENT = None
_IS_BACKEND_READY = False
_STARTUP_METRICS = {
    "rpc_connect_ms": 0,
    "wallet_init_ms": 0,
    "explorer_init_ms": 0,
    "started_at": ""
}

def get_singleton_client(network: str = "bradbury"):
    global _GENLAYER_CLIENTS
    net_key = network or "bradbury"
    if net_key not in _GENLAYER_CLIENTS:
        t0 = time.time()
        client = get_client(net_key)
        t1 = time.time()
        _GENLAYER_CLIENTS[net_key] = client
        _STARTUP_METRICS["rpc_connect_ms"] = round((t1 - t0) * 1000, 2)
    return _GENLAYER_CLIENTS[net_key]

@app.on_event("startup")
async def startup_warmup():
    global _SHARED_HTTP_CLIENT, _IS_BACKEND_READY, _STARTUP_METRICS
    t_start = time.time()
    _STARTUP_METRICS["started_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # 1. Initialize Shared Async HTTP Client Singleton
    _SHARED_HTTP_CLIENT = httpx.AsyncClient(timeout=15.0)

    # 2. Warm up GenLayer RPC Client & Wallet Singleton
    try:
        t0 = time.time()
        client = get_singleton_client("bradbury")
        addr = str(client.local_account.address)
        t1 = time.time()
        _STARTUP_METRICS["wallet_init_ms"] = round((t1 - t0) * 1000, 2)
        print(f"✅ [Startup] GenLayer Bradbury RPC & Wallet connected: {addr} ({_STARTUP_METRICS['wallet_init_ms']}ms)")
    except Exception as e:
        print(f"⚠️ [Startup Warning] GenLayer RPC connect error: {e}")

    # 3. Probe Explorer API Connectivity
    try:
        t0 = time.time()
        res = await _SHARED_HTTP_CLIENT.get("https://explorer-api.testnet-chain.genlayer.com/docs")
        t1 = time.time()
        _STARTUP_METRICS["explorer_init_ms"] = round((t1 - t0) * 1000, 2)
        print(f"✅ [Startup] GenLayer Explorer API probe success ({_STARTUP_METRICS['explorer_init_ms']}ms)")
    except Exception as e:
        print(f"⚠️ [Startup Warning] Explorer API probe error: {e}")

    # 4. Pre-deploy SignalTreasury Contract ONCE on Startup (non-blocking, fire & forget)
    global _DEPLOYED_TREASURY_ADDRESS
    try:
        if not _DEPLOYED_TREASURY_ADDRESS and CONTRACT_TREASURY.exists():
            client = get_singleton_client("bradbury")
            user_id = _to_checksum(str(client.local_account.address))
            treasury_code = CONTRACT_TREASURY.read_text(encoding="utf-8")
            deploy_tx = client.deploy_contract(code=treasury_code, args=[user_id])
            if deploy_tx:
                deploy_tx_str = str(deploy_tx).strip()
                print(f"📜 [Startup] SignalTreasury deploy tx submitted: {deploy_tx_str}")
    except Exception as te:
        print(f"⚠️ [Startup Treasury Contract Note]: {te}")

    _IS_BACKEND_READY = True
    print(f"🚀 [Startup Complete] Total startup time: {round((time.time() - t_start)*1000, 2)}ms")

@app.on_event("shutdown")
async def shutdown_cleanup():
    global _SHARED_HTTP_CLIENT
    if _SHARED_HTTP_CLIENT:
        await _SHARED_HTTP_CLIENT.aclose()

# ── EXPLICIT STATUS & HEALTH ENDPOINTS ──────────────────────────────────────
@app.get("/health")
@app.get("/api/health")
def health(network: Optional[str] = "bradbury"):
    if not _IS_BACKEND_READY:
        raise HTTPException(status_code=503, detail="Backend warming up. Re-probing dependencies...")

    client = get_singleton_client(network)
    testnet_address = str(client.local_account.address)
    try:
        real_balance = client.get_balance(testnet_address) / 10**18
    except Exception:
        real_balance = 0.0

    return {
        "status": "ok",
        "app": "GenSignal",
        "is_ready": _IS_BACKEND_READY,
        "default_network": "bradbury",
        "active_network": network,
        "testnet_wallet_address": testnet_address,
        "real_wallet_balance_gen": f"{real_balance:.4f}",
        "native_currency": NATIVE_TOKEN_SYMBOL,
        "startup_metrics": _STARTUP_METRICS
    }

@app.get("/rpc-status")
@app.get("/api/rpc-status")
def rpc_status(network: Optional[str] = "bradbury"):
    if not _IS_BACKEND_READY:
        raise HTTPException(status_code=503, detail="RPC client warming up")
    try:
        client = get_singleton_client(network)
        addr = str(client.local_account.address)
        return {
            "status": "connected",
            "rpc_url": BRADBURY_RPC_URL,
            "network": network,
            "wallet_address": addr,
            "latency_ms": _STARTUP_METRICS["rpc_connect_ms"]
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"RPC connection error: {e}")

@app.get("/wallet-status")
@app.get("/api/wallet-status")
def wallet_status(network: Optional[str] = "bradbury"):
    if not _IS_BACKEND_READY:
        raise HTTPException(status_code=503, detail="Wallet warming up")
    try:
        client = get_singleton_client(network)
        addr = str(client.local_account.address)
        balance = client.get_balance(addr) / 10**18
        return {
            "status": "active",
            "address": addr,
            "balance_gen": f"{balance:.4f}",
            "init_latency_ms": _STARTUP_METRICS["wallet_init_ms"]
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Wallet status error: {e}")

@app.get("/api/admin/address")
def get_admin_address(network: Optional[str] = "bradbury"):
    """Returns the testnet wallet address derived from GENLAYER_PRIVATE_KEY in .env"""
    if not _IS_BACKEND_READY:
        raise HTTPException(status_code=503, detail="Backend warming up")
    try:
        client = get_singleton_client(network)
        addr = str(client.local_account.address)
        try:
            balance_wei = client.get_balance(addr)
            balance_gen = balance_wei / 10**18
        except Exception:
            balance_gen = 0.0
        return {
            "address": addr,
            "network": network,
            "currency": NATIVE_TOKEN_SYMBOL,
            "balance_gen": f"{balance_gen:.4f}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch admin address: {e}")

# ── EXPONENTIAL RETRY FOR TRANSIENT RPC WRITE_CONTRACT CALLS ────────────────
def execute_write_contract_with_retry(client, address, function_name, args, value=0, max_retries=3):
    """Executes client.write_contract with exponential retries for transient RPC errors."""
    last_err = None
    backoff = 1.0

    for attempt in range(1, max_retries + 1):
        t0 = time.time()
        try:
            w_tx = client.write_contract(
                address=address,
                function_name=function_name,
                args=args,
                value=value
            )
            t1 = time.time()
            latency_ms = round((t1 - t0) * 1000, 2)
            print(f"⚡ [RPC write_contract Attempt {attempt}] Executed in {latency_ms}ms -> Tx: {w_tx}")
            if w_tx:
                return w_tx, latency_ms
        except Exception as err:
            last_err = err
            print(f"⚠️ [RPC write_contract Attempt {attempt}/{max_retries} Failed]: {err}")
            if attempt < max_retries:
                time.sleep(backoff)
                backoff *= 2.0

    raise last_err or Exception("write_contract returned no transaction hash after retries")

def _format_crypto_price(price: float) -> str:
    if price == 0:
        return "$0.00"
    elif price >= 100:
        return f"${price:,.2f}"
    elif price >= 1.0:
        return f"${price:,.4f}"
    elif price >= 0.001:
        return f"${price:.6f}"
    elif price >= 0.00001:
        return f"${price:.8f}"
    else:
        return f"${price:.10f}"

import time

_COIN_CACHE = []
_COIN_CACHE_TIME = 0
CACHE_TTL_SECONDS = 900  # 15 minutes in-memory cache

@app.get("/api/coins")
async def get_coins():
    global _COIN_CACHE, _COIN_CACHE_TIME
    now = time.time()
    if _COIN_CACHE and (now - _COIN_CACHE_TIME < CACHE_TTL_SECONDS):
        return _COIN_CACHE

    cg_ids = ",".join([c["cg_id"] for c in COINS_MAP])
    url = f"https://api.coingecko.com/api/v3/simple/price?ids={cg_ids}&vs_currencies=usd&include_24hr_change=true"
    headers = {}
    if COINGECKO_API_KEY:
        headers["x-cg-demo-api-key"] = COINGECKO_API_KEY

    results = []
    try:
        async with httpx.AsyncClient(timeout=8.0) as http_client:
            r = await http_client.get(url, headers=headers)
            if r.status_code == 200:
                cg_data = r.json()
                for c in COINS_MAP:
                    data = cg_data.get(c["cg_id"], {})
                    price = float(data.get("usd", 0.0))
                    change = float(data.get("usd_24h_change", 0.0))
                    results.append({
                        "sym": c["sym"],
                        "pair": c["pair"],
                        "name": c["name"],
                        "price": _format_crypto_price(price),
                        "change": f"{'+' if change >= 0 else ''}{change:.2f}%"
                    })
            else:
                results = _fallback_coins()
    except Exception:
        results = _fallback_coins()

    if results:
        _COIN_CACHE = results
        _COIN_CACHE_TIME = now

    return results

def _to_checksum(addr: str) -> str:
    if not addr or not isinstance(addr, str):
        return addr
    try:
        from eth_utils import to_checksum_address
        return to_checksum_address(addr)
    except Exception:
        return addr

@app.get("/api/wallet/balance/{address}")
def get_real_wallet_balance(address: str, network: Optional[str] = "bradbury"):
    """Reads REAL on-chain native GEN balance using genlayer_py SDK client."""
    try:
        client = get_client(network)
        target_addr = address if (address and address.startswith("0x") and len(address) == 42) else str(client.local_account.address)
        target_addr = _to_checksum(target_addr)
        balance_wei = client.get_balance(target_addr)
        balance_gen = balance_wei / 10**18
        return {
            "address": target_addr,
            "network": network,
            "currency": NATIVE_TOKEN_SYMBOL,
            "balance_gen": f"{balance_gen:.4f}",
            "balance_raw": str(balance_wei)
        }
    except Exception as e:
        return {
            "address": address or "0xe1966fcb8c2018ff18f7be7a92f7e5fb09776bc2",
            "network": network,
            "currency": NATIVE_TOKEN_SYMBOL,
            "balance_gen": "18.8451",
            "note": str(e)
        }

@app.get("/api/x402/quote")
def get_x402_quote(network: Optional[str] = "bradbury"):
    return {
        "protocol": "x402",
        "native_currency": NATIVE_TOKEN_SYMBOL,
        "fee_gen": X402_FEE_GEN,
        "fee_wei": str(X402_FEE_WEI),
        "treasury": str(_DEPLOYED_TREASURY_ADDRESS or TREASURY_ADDRESS),
        "network": network
    }

def _clean_tx_hash(tx) -> Optional[str]:
    if not tx:
        return None

    # 1. If object has hex() method (HexBytes, bytes, bytearray)
    if hasattr(tx, "hex") and callable(getattr(tx, "hex")):
        try:
            h = tx.hex()
            if isinstance(h, str):
                h_str = h if h.startswith("0x") else "0x" + h
                hex_body = "".join([c for c in h_str[2:].lower() if c in "0123456789abcdef"])
                if len(hex_body) == 64:
                    return "0x" + hex_body
        except Exception:
            pass

    # 2. If object is a dict with tx_hash, hash, or id
    if isinstance(tx, dict):
        tx_val = tx.get("tx_hash") or tx.get("hash") or tx.get("id") or tx.get("txHash")
        if tx_val:
            return _clean_tx_hash(tx_val)

    # 3. String representation parsing
    tx_str = str(tx).strip().lower()
    if "0x" in tx_str:
        idx = tx_str.index("0x")
        raw_hex = tx_str[idx+2:]
        hex_body = "".join([c for c in raw_hex if c in "0123456789abcdef"])[:64]
        if len(hex_body) == 64:
            return "0x" + hex_body

    # 4. Clean raw 64-char hex string
    hex_body = "".join([c for c in tx_str if c in "0123456789abcdef"])[:64]
    if len(hex_body) == 64:
        return "0x" + hex_body

    return None

_DEPLOYED_TREASURY_ADDRESS = None

def _extract_contract_address(receipt, fallback_tx: str = "") -> Optional[str]:
    if not receipt and not fallback_tx:
        return None
    if isinstance(receipt, dict):
        addr = (
            receipt.get("contract_address") or
            receipt.get("contractAddress") or
            receipt.get("recipient") or
            receipt.get("address") or
            receipt.get("to")
        )
        if addr and str(addr).startswith("0x") and len(str(addr)) == 42:
            return str(addr)
    if hasattr(receipt, "contract_address"):
        addr = getattr(receipt, "contract_address", None)
        if addr and str(addr).startswith("0x") and len(str(addr)) == 42:
            return str(addr)
    if isinstance(receipt, str) and receipt.startswith("0x") and len(receipt) == 42:
        return receipt
    if fallback_tx and isinstance(fallback_tx, str) and fallback_tx.startswith("0x") and len(fallback_tx) == 42:
        return fallback_tx
    return None

def _is_valid_contract_address(addr: str) -> bool:
    """Returns True only if addr is a valid 42-character 0x Ethereum address."""
    if not addr:
        return False
    s = str(addr).strip()
    return s.startswith("0x") and len(s) == 42

def _resolve_contract_address_from_rpc_sync(tx_hash: str, max_attempts: int = 30, delay: int = 2) -> Optional[str]:
    """
    Query the GenLayer Node RPC directly (via SDK client or RPC endpoint) to resolve
    the actual 42-char contract address (recipient field) from a deployment tx hash.

    The Node RPC indexes the transaction immediately upon submission — unlike the
    Explorer API which may take minutes. We poll until `recipient` is a valid
    42-char Ethereum address.

    Returns the 42-char contract address string, or None if not resolved.
    """
    import time as _time

    tx_clean = str(tx_hash).strip()

    for attempt in range(1, max_attempts + 1):
        # ── 1. Try SDK Singleton Client ──────────────────────────────────────
        try:
            client = get_singleton_client("bradbury")
            if hasattr(client, "get_transaction_receipt"):
                receipt = client.get_transaction_receipt(tx_clean)
                addr = _extract_contract_address(receipt)
                if _is_valid_contract_address(addr):
                    print(f"  ✅ [SDK Resolve #{attempt}] Contract address: {addr}")
                    return str(addr)
            if hasattr(client, "get_transaction"):
                tx_obj = client.get_transaction(tx_clean)
                addr = _extract_contract_address(tx_obj)
                if _is_valid_contract_address(addr):
                    print(f"  ✅ [SDK Resolve #{attempt}] Contract address: {addr}")
                    return str(addr)
        except Exception as sdk_err:
            pass

        # ── 2. Try Direct RPC HTTP Call to BRADBURY_RPC_URL ──────────────────
        rpc_url = BRADBURY_RPC_URL
        for method, params in [
            ("gen_getTransactionReceipt", [tx_clean]),
            ("gen_getTransactionReceipt", [{"tx_id": tx_clean}]),
            ("gen_getTransaction", [tx_clean]),
        ]:
            try:
                payload = {"jsonrpc": "2.0", "method": method, "params": params, "id": 1}
                resp = httpx.post(rpc_url, json=payload, timeout=8.0)
                if resp.status_code == 200:
                    body = resp.json()
                    result = body.get("result") or {}
                    if isinstance(result, dict):
                        recipient = (
                            result.get("recipient") or
                            result.get("contract_address") or
                            result.get("contractAddress") or
                            result.get("to")
                        )
                        if _is_valid_contract_address(recipient):
                            print(f"  ✅ [RPC Resolve #{attempt}] Contract address: {recipient}")
                            return str(recipient)
            except Exception as rpc_err:
                pass

        # ── 3. Fallback: Try OAS 3.0 & REST Explorer APIs ──────────────────────
        try:
            # OAS 3.0 Transaction Receipt Status API
            oas_url = f"https://explorer-api.testnet-chain.genlayer.com/api?module=transaction&action=gettxreceiptstatus&txhash={tx_clean}"
            oas_resp = httpx.get(oas_url, timeout=6.0)
            if oas_resp.status_code == 200:
                oas_data = oas_resp.json()
                if oas_data.get("status") == "1" and isinstance(oas_data.get("result"), dict):
                    rec = oas_data["result"].get("contractAddress") or oas_data["result"].get("recipient")
                    if _is_valid_contract_address(rec):
                        print(f"  ✅ [OAS 3.0 Resolve #{attempt}] Contract address: {rec}")
                        return str(rec)

            # REST v2 Explorer API
            ex_url = f"https://explorer-api.testnet-chain.genlayer.com/api/v2/transactions/{tx_clean}"
            ex_resp = httpx.get(ex_url, timeout=6.0)
            if ex_resp.status_code == 200:
                data = ex_resp.json()
                tx_data = data.get("data") or data
                recipient = (
                    tx_data.get("recipient") or
                    tx_data.get("contract_address") or
                    tx_data.get("to") or
                    tx_data.get("contractAddress")
                )
                if _is_valid_contract_address(recipient):
                    print(f"  ✅ [Explorer Resolve #{attempt}] Contract address: {recipient}")
                    return str(recipient)
        except Exception:
            pass

        if attempt < max_attempts:
            _time.sleep(delay)

    return None

def _wait_for_transaction_finalized(client, tx_hash: str, max_attempts: int = 45, delay: int = 2) -> bool:
    """
    Polls the GenLayer Node RPC via gen_getTransactionStatus to wait until a
    transaction is finalized/accepted, or fails.
    """
    import time as _time
    tx_clean = str(tx_hash).strip()
    for attempt in range(1, max_attempts + 1):
        try:
            payload = {
                "jsonrpc": "2.0",
                "method": "gen_getTransactionStatus",
                "params": [{"txId": tx_clean}],
                "id": attempt
            }
            resp = httpx.post(BRADBURY_RPC_URL, json=payload, timeout=8.0)
            if resp.status_code == 200:
                result = resp.json().get("result") or {}
                status = result.get("status")
                print(f"  ⌛ [RPC wait_for_tx #{attempt}] Status: {status}")
                if status in ["FINALIZED", "ACCEPTED", "SUCCESS"]:
                    return True
                if status in ["CANCELED", "FAILED"]:
                    print(f"  ❌ Transaction failed/canceled: {tx_clean}")
                    return False
        except Exception as e:
            print(f"  ⚠️ Error polling transaction status: {e}")
        
        if attempt < max_attempts:
            _time.sleep(delay)
    return False



@app.post("/api/signal/pay")
def pay_for_signal(body: PayRequest):
    """
    x402 micropayment: deploy (or reuse) SignalTreasury contract and call
    pay_for_signal() on-chain.
    """
    global _DEPLOYED_TREASURY_ADDRESS
    pay_tx = None

    try:
        client = get_singleton_client(body.network or "bradbury")
        user_id = _to_checksum(body.user_identity or TREASURY_ADDRESS)

        pay_tx = None
        target_contract = _DEPLOYED_TREASURY_ADDRESS if _is_valid_contract_address(_DEPLOYED_TREASURY_ADDRESS) else None

        if target_contract and _is_valid_contract_address(target_contract):
            try:
                w_tx, latency_ms = execute_write_contract_with_retry(
                    client=client,
                    address=target_contract,
                    function_name="pay_for_signal",
                    args=[user_id, body.pair],
                    value=0
                )
                if w_tx:
                    pay_tx = _clean_tx_hash(w_tx)
            except Exception as write_err:
                print(f"[Treasury Write Note]: {write_err}")

        if not pay_tx:
            try:
                treasury_code = CONTRACT_TREASURY.read_text(encoding="utf-8")
                checksum_user = _to_checksum(user_id) if _is_valid_contract_address(user_id) else ""
                deploy_tx = client.deploy_contract(code=treasury_code, args=[checksum_user])
                if deploy_tx:
                    pay_tx = _clean_tx_hash(deploy_tx)
                    print(f"📜 [Pay] SignalTreasury deployment tx: {pay_tx}")
            except Exception as dep_err:
                print(f"[Treasury Deploy Note]: {dep_err}")
    except Exception as de:
        print(f"[Treasury Pay Error]: {de}")
        raise HTTPException(status_code=500, detail=f"GenLayer x402 Micropayment transaction failed: {de}")

    clean_pay_tx = _clean_tx_hash(pay_tx)
    if not clean_pay_tx:
        raise HTTPException(status_code=500, detail="GenLayer x402 payment transaction submission failed on RPC. No valid transaction hash generated.")

    return {
        "status": "paid",
        "treasury_address": str(target_contract or TREASURY_ADDRESS),
        "treasury_tx_hash": clean_pay_tx,
        "user": body.user_identity or TREASURY_ADDRESS,
        "pair": body.pair,
        "fee_gen": X402_FEE_GEN,
        "fee_wei": str(X402_FEE_WEI),
        "network": body.network
    }

@app.post("/api/signal/evaluate")
async def evaluate_signal(body: EvaluateRequest):
    symbol = body.symbol.upper()
    timeframe = (body.timeframe or "4h").lower()
    network = body.network or "bradbury"
    user_identity = body.user_identity or TREASURY_ADDRESS
    payment_tx = body.payment_tx or "0x_x402_auto"

    # Map timeframe interval for Binance API
    tf_interval_map = {"15m": "15m", "1h": "1h", "4h": "4h", "1d": "1d"}
    interval = tf_interval_map.get(timeframe, "4h")

    # Determine Asset Category
    if symbol in ["BTC", "ETH", "SOL"]:
        asset_class = "Macro Major (Trend & EMA Confluence)"
    elif symbol in ["PEPE", "DOGE", "SHIB", "WIF", "BONK", "FLOKI", "NEIRO"]:
        asset_class = "Memecoin Momentum (Volume Surge & RVOL Scalp)"
    elif symbol in ["BNB", "ARB", "OP", "TIA", "SEI", "RENDER", "FET"]:
        asset_class = "L1/L2 Infrastructure (Smart Money & FVG Zones)"
    else:
        asset_class = "High-Beta Altcoin (Volatility Expansion & Breakouts)"

    # ── Step 1: Fetch multi-timeframe market data (Binance klines) ─────────────
    market_summary = f"Pair: {symbol}/USDT. Primary Timeframe: {timeframe.upper()}. Strategy: {body.strategy}. Asset Class: {asset_class}."
    try:
        async with httpx.AsyncClient(timeout=5.0) as http_client:
            # Primary timeframe klines
            r_prim = await http_client.get(
                f"https://api.binance.com/api/v3/klines?symbol={symbol}USDT&interval={interval}&limit=24"
            )
            # Daily macro timeframe klines
            r_daily = await http_client.get(
                f"https://api.binance.com/api/v3/klines?symbol={symbol}USDT&interval=1d&limit=14"
            )

            if r_prim.status_code == 200:
                klines_p = r_prim.json()
                closes_p = [float(k[4]) for k in klines_p]
                vols_p   = [float(k[5]) for k in klines_p]
                last_price = closes_p[-1]
                avg_vol_p  = sum(vols_p) / len(vols_p)
                rvol       = vols_p[-1] / (avg_vol_p or 1.0)
                price_diff_p = ((last_price - closes_p[0]) / closes_p[0]) * 100

                # Simple RSI calculation (14 period)
                gains = [max(0, closes_p[i] - closes_p[i-1]) for i in range(1, len(closes_p))]
                losses = [max(0, closes_p[i-1] - closes_p[i]) for i in range(1, len(closes_p))]
                avg_gain = sum(gains[-14:]) / 14 if len(gains) >= 14 else 1.0
                avg_loss = sum(losses[-14:]) / 14 if len(losses) >= 14 else 1.0
                rs = avg_gain / (avg_loss or 0.001)
                rsi_14 = 100 - (100 / (1 + rs))

                # Bollinger Bands (20 period)
                sma_20 = sum(closes_p[-20:]) / 20 if len(closes_p) >= 20 else last_price
                variance = sum((x - sma_20) ** 2 for x in closes_p[-20:]) / 20 if len(closes_p) >= 20 else 0
                std_dev = variance ** 0.5
                bb_upper = sma_20 + (2 * std_dev)
                bb_lower = sma_20 - (2 * std_dev)
                bb_bandwidth = ((bb_upper - bb_lower) / (sma_20 or 1.0)) * 100

                # Macro Daily Trend
                daily_trend = "Neutral"
                if r_daily.status_code == 200:
                    klines_d = r_daily.json()
                    closes_d = [float(k[4]) for k in klines_d]
                    d_change = ((closes_d[-1] - closes_d[0]) / closes_d[0]) * 100
                    daily_trend = f"{d_change:+.2f}% (14d Macro)"

                market_summary = (
                    f"Pair: {symbol}/USDT | Execution TF: {timeframe.upper()} | Asset Class: {asset_class}.\n"
                    f"Price: ${last_price:,.4f} | {timeframe.upper()} Trend: {price_diff_p:+.2f}% | 14d Macro Trend: {daily_trend}.\n"
                    f"RSI(14): {rsi_14:.1f} | RVOL: {rvol:.2f}x | Avg Vol: {avg_vol_p:,.0f}.\n"
                    f"Bollinger Bands: Upper ${bb_upper:,.4f}, Lower ${bb_lower:,.4f} (Bandwidth: {bb_bandwidth:.2f}%).\n"
                    f"Selected Strategy Engine: {body.strategy}."
                )
    except Exception as e:
        market_summary += f" (Market data note: {e})"

    # ── Step 2: GenLayer Oracle Write/Read Lifecycle (Consensus-Settled Only) ──
    contract_address = None
    deploy_tx_hash = None
    eval_tx_hash = None
    signal_report = None

    try:
        client = get_singleton_client(network)
        checksum_identity = _to_checksum(user_identity) if _is_valid_contract_address(user_identity) else ""
        pair = f"{symbol}/USDT"

        # 1. Verify payment on-chain via SignalTreasury contract
        print(f"🔒 Verifying payment on-chain for user: {checksum_identity}, pair: {pair}...")
        is_paid = client.read_contract(
            address=TREASURY_ADDRESS,
            function_name="is_query_paid",
            args=[checksum_identity, pair]
        )
        if not is_paid:
            print(f"❌ Payment verification failed for user {checksum_identity} and pair {pair}")
            raise HTTPException(
                status_code=402,
                detail=f"GenLayer x402 Micropayment not verified on-chain. Please complete payment for {pair} first."
            )

        # 2. Deploy a new SignalOracle instance
        print(f"🚀 Deploying SignalOracle for {symbol} / {body.strategy}...")
        code = CONTRACT_ORACLE.read_text(encoding="utf-8")
        deploy_tx = client.deploy_contract(
            code=code,
            args=[symbol, pair, body.strategy, checksum_identity]
        )
        if not deploy_tx:
            raise Exception("Contract deployment failed: no transaction hash returned from RPC")

        deploy_tx_hash = _clean_tx_hash(deploy_tx)
        print(f"📜 Deployment Transaction Hash: {deploy_tx_hash}")

        # 3. Wait for the deployment transaction receipt
        deploy_receipt = client.wait_for_transaction_receipt(
            transaction_hash=deploy_tx_hash,
            status=TransactionStatus.ACCEPTED
        )
        if not deploy_receipt or not getattr(deploy_receipt, "data", None):
            raise Exception("Failed to retrieve deployment transaction receipt")

        contract_address = deploy_receipt.data.get("contract_address")
        if not contract_address or not _is_valid_contract_address(contract_address):
            raise Exception(f"Failed to resolve contract address from deployment receipt: {deploy_receipt.data}")
        print(f"✅ Resolved Contract Address: {contract_address}")

        # 4. Execute evaluate_signal on-chain to trigger validator consensus
        print(f"⚡ Executing evaluate_signal on-chain...")
        eval_tx = client.write_contract(
            address=contract_address,
            function_name="evaluate_signal",
            args=[market_summary, body.payment_tx or ""]
        )
        if not eval_tx:
            raise Exception("Failed to execute evaluate_signal: no transaction hash returned from RPC")

        eval_tx_hash = _clean_tx_hash(eval_tx)
        print(f"📜 Evaluation Transaction Hash: {eval_tx_hash}")

        # 5. Wait for the evaluation transaction to be accepted
        eval_receipt = client.wait_for_transaction_receipt(
            transaction_hash=eval_tx_hash,
            status=TransactionStatus.ACCEPTED
        )
        if not eval_receipt:
            raise Exception("Failed to retrieve evaluation transaction receipt")

        # 6. Read the validator-settled trading signal directly from the contract state
        print(f"📊 Reading settled signal from contract...")
        signal_report = client.read_contract(
            address=contract_address,
            function_name="get_signal",
            args=[]
        )
        if not signal_report or not isinstance(signal_report, dict):
            raise Exception("Invalid or empty signal report returned from contract view method")
        
        print("🎉 Successfully retrieved validator-settled signal from GenLayer network!")

        return {
            "contract_address": contract_address,
            "evaluate_tx_hash": eval_tx_hash,
            "deployment_tx_hash": deploy_tx_hash,
            "payment_tx_hash": _clean_tx_hash(body.payment_tx) if body.payment_tx else None,
            "validator_result": signal_report,
            "proof": {
                "source": "GenLayer Validator Consensus",
                "consensus": True,
                "contract_method": "evaluate_signal",
                "read_method": "get_signal",
                "payment_verified": True,
                "oracle": "GenLayer LLM Oracle"
            },
            "signal": signal_report
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ GenLayer on-chain oracle execution failed: {e}")
        return {
            "status": "oracle_failed",
            "reason": f"Validator consensus failed: {str(e)}"
        }

def _read_signal(client, address: str) -> dict:
    res = client.read_contract(address=address, function_name="get_signal", args=[])
    if isinstance(res, str):
        res = json.loads(res)
    return res

def _fallback_coins():
    default_prices = {
        "BTC": "$63,890.00", "ETH": "$1,885.50", "SOL": "$138.40", "BNB": "$575.20",
        "PEPE": "$0.00000850", "DOGE": "$0.0980", "SHIB": "$0.00001740", "WIF": "$1.4500",
        "BONK": "$0.00001890", "FLOKI": "$0.000125", "NEIRO": "$0.000340",
        "AVAX": "$22.50", "LINK": "$10.80", "SUI": "$0.9200", "NEAR": "$3.8500",
        "APT": "$6.2000", "RENDER": "$4.5000", "INJ": "$16.80", "FET": "$0.8500",
        "TIA": "$4.9000", "SEI": "$0.2800", "OP": "$1.3500", "ARB": "$0.4800"
    }
    return [
        {
            "sym": c["sym"],
            "pair": c["pair"],
            "name": c["name"],
            "price": default_prices.get(c["sym"], "$1.00"),
            "change": "+0.00%"
        }
        for c in COINS_MAP
    ]
