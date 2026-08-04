import urllib.request
import json

base_url = "http://127.0.0.1:8001"
user_id = "0xe1966fcb8c2018Ff18f7bE7A92F7E5fB09776bC2"
pair = "RENDER/USDT"

print("1. Requesting x402 payment via /api/signal/pay...")
pay_req = urllib.request.Request(
    f"{base_url}/api/signal/pay",
    data=json.dumps({
        "user_identity": user_id,
        "pair": pair,
        "network": "bradbury"
    }).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

pay_res = json.loads(urllib.request.urlopen(pay_req).read().decode())
print("PAY RES:", pay_res)
pay_tx = pay_res.get("treasury_tx_hash")

print("\n2. Executing evaluate_signal via /api/signal/evaluate...")
eval_req = urllib.request.Request(
    f"{base_url}/api/signal/evaluate",
    data=json.dumps({
        "symbol": "RENDER",
        "pair": pair,
        "strategy": "signals",
        "timeframe": "4h",
        "network": "bradbury",
        "user_identity": user_id,
        "payment_tx": pay_tx
    }).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

eval_res = json.loads(urllib.request.urlopen(eval_req).read().decode())
print("EVAL RES:", json.dumps(eval_res, indent=2))
