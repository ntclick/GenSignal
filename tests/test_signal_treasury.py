import pytest
from genlayer import gl
from contracts.signal_treasury import SignalTreasury


def test_treasury_deposit_and_pay(monkeypatch):
    owner_address = "0x1111111111111111111111111111111111111111"
    user_address = "0x2222222222222222222222222222222222222222"
    monkeypatch.setattr("genlayer.gl.message.sender_address", owner_address)

    treasury = SignalTreasury()

    info = treasury.get_treasury_info()
    assert info["owner"] == owner_address
    assert info["total_collected"] == 0

    # Deposit payment
    treasury.deposit_payment(user_address, 100)
    assert treasury.get_user_balance(user_address) == 100
    assert treasury.get_treasury_info()["total_collected"] == 100

    # Pay query
    treasury.pay_query(user_address, "BTC/USDT", 5)
    assert treasury.get_user_balance(user_address) == 95
    assert treasury.is_query_paid(user_address, "BTC/USDT") is True

    # Failed pay query due to insufficient balance
    with pytest.raises(Exception):
        treasury.pay_query(user_address, "ETH/USDT", 200)
