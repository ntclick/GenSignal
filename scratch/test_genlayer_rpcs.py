import time
import json
import urllib.request
import urllib.error

RPC_ENDPOINTS = [
    {
        "name": "GenLayer RPC (Primary)",
        "url": "https://rpc-bradbury.genlayer.com"
    },
    {
        "name": "GenLayer Chain RPC (Secondary)",
        "url": "https://rpc.testnet-chain.genlayer.com"
    }
]

TEST_ADDRESS = "0xe1966fcb8c2018ff18f7be7a92f7e5fb09776bc2"
TEST_CONTRACT = "0x9e70bFAD6bd7721758ec3dae57622616d63Ed975"

def post_rpc(url: str, method: str, params: list = None, req_id: int = 1):
    payload = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params or [],
        "id": req_id
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "GenSignal-RPCTester/1.0"}
    )
    
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            t1 = time.time()
            res_body = json.loads(resp.read().decode('utf-8'))
            latency_ms = round((t1 - t0) * 1000, 2)
            return {"success": True, "latency_ms": latency_ms, "response": res_body, "error": None}
    except urllib.error.HTTPError as he:
        t1 = time.time()
        err_text = he.read().decode('utf-8', errors='ignore')
        return {"success": False, "latency_ms": round((t1 - t0) * 1000, 2), "response": None, "error": f"HTTP {he.code}: {err_text[:120]}"}
    except Exception as e:
        t1 = time.time()
        return {"success": False, "latency_ms": round((t1 - t0) * 1000, 2), "response": None, "error": str(e)}

def run_tests():
    print("========================================================================")
    print("[+] GENLAYER BRADBURY DUAL RPC HEALTH & BENCHMARK TESTER")
    print("========================================================================\n")
    
    results = []

    for ep in RPC_ENDPOINTS:
        name = ep["name"]
        url = ep["url"]
        print(f"[*] Testing Endpoint: {name}")
        print(f"    URL: {url}")

        # Test 1: eth_blockNumber
        res_bn = post_rpc(url, "eth_blockNumber")
        block_num = "N/A"
        if res_bn["success"] and "result" in res_bn["response"]:
            try:
                block_num = str(int(res_bn["response"]["result"], 16))
            except Exception:
                block_num = str(res_bn["response"]["result"])
        
        bn_status = f"OK ({res_bn['latency_ms']}ms) -> Block #{block_num}" if res_bn["success"] else f"FAIL ({res_bn['error']})"
        print(f"    |- [1/3] eth_blockNumber: {bn_status}")

        # Test 2: eth_getBalance
        res_bal = post_rpc(url, "eth_getBalance", [TEST_ADDRESS, "latest"])
        balance_gen = "N/A"
        if res_bal["success"] and "result" in res_bal["response"]:
            try:
                wei = int(res_bal["response"]["result"], 16)
                balance_gen = f"{wei / 1e18:.4f} GEN"
            except Exception:
                balance_gen = str(res_bal["response"]["result"])
        
        bal_status = f"OK ({res_bal['latency_ms']}ms) -> Balance: {balance_gen}" if res_bal["success"] else f"FAIL ({res_bal['error']})"
        print(f"    |- [2/3] eth_getBalance:   {bal_status}")

        # Test 3: gen_call (read view on contract)
        gen_call_param = [{
            "from": TEST_ADDRESS,
            "to": TEST_CONTRACT,
            "data": "0x",
            "type": "read"
        }]
        res_gc = post_rpc(url, "gen_call", gen_call_param)
        gc_status = f"OK ({res_gc['latency_ms']}ms)" if res_gc["success"] and "error" not in res_gc["response"] else f"FAIL ({res_gc.get('error') or res_gc['response'].get('error')})"
        print(f"    |- [3/3] gen_call (Read):  {gc_status}\n")

        results.append({
            "name": name,
            "url": url,
            "block_num": block_num,
            "balance": balance_gen,
            "latency_ms": res_bn["latency_ms"] if res_bn["success"] else "FAIL",
            "ok": res_bn["success"] and res_bal["success"]
        })

    print("========================================================================")
    print("RPC TEST SUMMARY & COMPARISON")
    print("========================================================================")
    print(f"{'Endpoint':<32} | {'Status':<10} | {'Latency':<10} | {'Block #':<12}")
    print("-" * 72)
    for r in results:
        status_str = "ONLINE" if r["ok"] else "OFFLINE"
        lat_str = f"{r['latency_ms']}ms" if isinstance(r['latency_ms'], (int, float)) else "N/A"
        print(f"{r['name']:<32} | {status_str:<10} | {lat_str:<10} | #{r['block_num']:<11}")
    print("========================================================================\n")

if __name__ == "__main__":
    run_tests()
