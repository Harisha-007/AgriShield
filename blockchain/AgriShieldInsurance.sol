
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AgriShieldInsurance {

    address public oracle;
    receive() external payable {}
    function fundContract() external payable {}
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    struct Policy {
        address farmer;
        uint256 premium;
        uint256 coverageAmount;
        uint256 startTime;
        uint256 endTime;
        bool active;
        bool payoutTriggered;
    }

    mapping(uint256 => Policy) public policies;

    constructor() {
        oracle = msg.sender;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle can trigger payout");
        _;
    }

    function createPolicy(
        uint256 policyId,
        uint256 premium,
        uint256 coverageAmount,
        uint256 duration
    ) public {
        policies[policyId] = Policy(
            msg.sender,
            premium,
            coverageAmount,
            block.timestamp,
            block.timestamp + duration,
            true,
            false
        );
    }

    function triggerPayout(uint256 policyId) public onlyOracle {
        Policy storage policy = policies[policyId];

        require(policy.active, "Policy is not active");
        require(!policy.payoutTriggered, "Payout already triggered");
        require(address(this).balance >= policy.coverageAmount, "Insufficient contract balance");

        policy.payoutTriggered = true;
        policy.active = false;

        payable(policy.farmer).transfer(policy.coverageAmount);
   }
}