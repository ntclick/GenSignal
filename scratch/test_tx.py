from genlayer_py import create_client, create_account, testnet_bradbury
import json

acc = create_account("2c3daa7fd43bcb61851e1b186fcfdb539816b80e3b4a6602de65e28496f92f0f")
c = create_client(chain=testnet_bradbury, account=acc)

tx = c.get_transaction("0x5de8419c968af2ae80278132a4ba4036a07e851b43659cdd996cab52419981d0")
print("TX TYPE:", type(tx))
print("TX DIR:", dir(tx))
if isinstance(tx, dict):
    print("TX KEYS:", tx.keys())
    print("TX DICT:", tx)
else:
    print("TX VARS:", vars(tx) if hasattr(tx, "__dict__") else "no __dict__")
    print("TX STR:", str(tx))
