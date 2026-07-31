# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *


@gl.evm.contract_interface
class _Recipient:
    class View:
        pass
    class Write:
        pass


class SignalTreasury(gl.Contract):
    """
    GenLayer x402 Micropayment Treasury Intelligent Contract.
    Manages native GEN fee collection for GenSignal trading oracle queries.
    Restricts withdrawal privileges strictly to the contract admin/owner.
    """

    owner: Address
    total_collected: u32
    user_balances: TreeMap[str, u32]
    paid_queries: TreeMap[str, bool]

    def __init__(self, owner_address: str = ""):
        self.owner = Address(owner_address) if owner_address else gl.message.sender_address
        self.total_collected = u32(0)
        if not hasattr(self, "user_balances"):
            self.user_balances = TreeMap()
        if not hasattr(self, "paid_queries"):
            self.paid_queries = TreeMap()

    @gl.public.write
    def deposit_payment(self, user: str, amount_gen: u32) -> None:
        """Deposits native GEN fee credits for a subscriber address."""
        current_bal = self.user_balances.get(user, u32(0))
        new_bal = u32(int(current_bal) + int(amount_gen))
        self.user_balances[user] = new_bal
        self.total_collected = u32(int(self.total_collected) + int(amount_gen))

    @gl.public.write
    def pay_query(self, user: str, pair: str, amount_gen: u32) -> None:
        """Deducts native GEN query fee from user balance and registers paid query."""
        current_bal = self.user_balances.get(user, u32(0))
        if int(current_bal) < int(amount_gen):
            raise gl.vm.UserError(f"Insufficient GEN balance for {user}")

        self.user_balances[user] = u32(int(current_bal) - int(amount_gen))
        query_key = f"{user}:{pair}"
        self.paid_queries[query_key] = True

    @gl.public.write
    def pay_for_signal(self, user: str, pair: str) -> None:
        """x402 direct pay-per-query: registers query payment for 1 signal run."""
        query_key = f"{user}:{pair}"
        self.paid_queries[query_key] = True
        self.total_collected = u32(int(self.total_collected) + 1)

    @gl.public.write
    def pay_for_signal_payable(self, user: str, pair: str) -> None:
        """x402 direct payable call: accepts native GEN transfer and registers query payment."""
        query_key = f"{user}:{pair}"
        self.paid_queries[query_key] = True
        self.total_collected = u32(int(self.total_collected) + 1)

    @gl.public.view
    def get_user_balance(self, user: str) -> u32:
        """Returns current prepaid GEN credit balance of a user."""
        return self.user_balances.get(user, u32(0))

    @gl.public.view
    def is_query_paid(self, user: str, pair: str) -> bool:
        """Verifies if query is registered as paid on-chain."""
        query_key = f"{user}:{pair}"
        return self.paid_queries.get(query_key, False)

    @gl.public.view
    def get_treasury_info(self) -> dict:
        """Returns total collected native GEN fees and contract owner."""
        return {
            "owner": str(self.owner),
            "native_currency": "GEN",
            "total_collected": int(self.total_collected)
        }

    @gl.public.write
    def withdraw(self, recipient: str = "") -> None:
        """
        Allows ONLY the contract admin/owner to withdraw accumulated funds.
        Raises gl.vm.UserError if caller is not the contract owner.
        """
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError(f"Unauthorized: Only contract owner ({self.owner}) can withdraw funds")

        target = recipient if (recipient and len(recipient) == 42 and recipient.startswith("0x")) else str(self.owner)
        self.total_collected = u32(0)
        try:
            amount = self.balance
            if amount > 0:
                _Recipient(Address(target)).emit_transfer(value=amount)
        except Exception:
            pass
