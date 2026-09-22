import os
import json
from eth_account import Account
from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")

with open("../blockchain/AgriShieldInsuranceABI.json", "r") as file:
    ABI = json.load(file)

w3 = Web3(Web3.HTTPProvider(os.getenv("SEPOLIA_RPC_URL")))
private_key = os.getenv("ORACLE_PRIVATE_KEY")

if private_key:
    account = Account.from_key(private_key)
    print("Oracle wallet loaded:", account.address)
else:
    print("Oracle private key not set yet")

contract = w3.eth.contract(
    address=Web3.to_checksum_address(CONTRACT_ADDRESS),
    abi=ABI
)

print("Contract address:", CONTRACT_ADDRESS)
print("ABI loaded:", len(ABI), "items")
print("Contract object created:", contract is not None)

oracle = contract.functions.oracle().call()

print("Oracle address:", oracle)
print("Chain ID:", w3.eth.chain_id)