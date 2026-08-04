from genlayer_py import create_client, create_account, testnet_bradbury

acc = create_account("2c3daa7fd43bcb61851e1b186fcfdb539816b80e3b4a6602de65e28496f92f0f")
c = create_client(chain=testnet_bradbury, account=acc)

# Patch c.provider.make_request to unwrap dict result for gen_call
orig_make_request = c.provider.make_request

def safe_make_request(method, params):
    res = orig_make_request(method, params)
    if method == "gen_call" and isinstance(res, dict) and isinstance(res.get("result"), dict):
        r = res["result"]
        hex_data = r.get("data") if isinstance(r.get("data"), str) else ""
        res["result"] = hex_data
    return res

c.provider.make_request = safe_make_request

res = c.read_contract(
    address="0x9e70bFAD6bd7721758ec3dae57622616d63Ed975",
    function_name="is_query_paid",
    args=["0xe1966fcb8c2018Ff18f7bE7A92F7E5fB09776bC2", "BTC/USDT"]
)
print("SUCCESS READ CONTRACT RESULT:", res, type(res))
