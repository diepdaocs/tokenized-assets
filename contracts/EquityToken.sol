// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "./AssetBase.sol";

contract EquityToken is ERC20Upgradeable, AssetBase {
    struct Dividend {
        uint256 amountPerShare;
        uint256 totalDistributed;
        uint256 timestamp;
    }

    Dividend[] public dividendHistory;
    mapping(address => uint256) public lastClaimedDividendIndex;

    event DividendDistributed(uint256 amountPerShare);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address admin
    ) public initializer {
        __ERC20_init(name, symbol);
        __AssetBase_init();

        _mint(admin, initialSupply);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
    }

    function _update(address from, address to, uint256 value) internal override(ERC20Upgradeable) whenNotPaused {
        if (from != address(0) && to != address(0)) {
            require(whitelist[from], "EquityToken: sender not whitelisted");
            require(whitelist[to], "EquityToken: receiver not whitelisted");
        }
        super._update(from, to, value);
    }

    function distributeDividend(uint256 amountPerShare) external onlyRole(ISSUER_ROLE) {
        dividendHistory.push(Dividend({
            amountPerShare: amountPerShare,
            totalDistributed: amountPerShare * totalSupply() / 1e18, // Scaling by 1e18
            timestamp: block.timestamp
        }));
        emit DividendDistributed(amountPerShare);
    }

    // Note: This is a simplified dividend claim logic for demonstration.
    // In a real scenario, this would involve transferring actual funds (e.g., stablecoins).
    function claimDividend() external {
        // Logic to claim pending dividends (not fully implemented to keep it focused)
    }
}
