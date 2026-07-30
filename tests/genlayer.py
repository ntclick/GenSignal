"""
Mock genlayer module for GenSignal direct pytest execution.
"""

class Address(str):
    pass

class u32(int):
    pass

class u64(int):
    pass

def allow_storage(cls):
    return cls

class TreeMap(dict):
    pass

class DynArray(list):
    pass

class PublicDecorators:
    def write(self, fn):
        return fn

    def view(self, fn):
        return fn

class VM:
    class UserError(Exception):
        pass

    class Return:
        def __init__(self, calldata):
            self.calldata = calldata

    def run_nondet_unsafe(self, leader_fn, validator_fn):
        return leader_fn()

class NonDet:
    def exec_prompt(self, prompt: str, response_format: str = "json"):
        return {}

class Message:
    def __init__(self):
        self.sender_address = Address("0x0000000000000000000000000000000000000000")

class GL:
    def __init__(self):
        self.message = Message()
        self.public = PublicDecorators()
        self.vm = VM()
        self.nondet = NonDet()

    class Contract:
        pass

gl = GL()

__all__ = [
    "gl",
    "Address",
    "u32",
    "u64",
    "TreeMap",
    "DynArray",
    "allow_storage"
]
