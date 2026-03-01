// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract EquityToken is Initializable, ERC20Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 public totalShares;

    mapping(uint256 => uint256) public dividendPerShare;
    uint256 public currentEpoch;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(string memory name, string memory symbol, uint256 _totalShares, address initialOwner) initializer public {
        __ERC20_init(name, symbol);
        __Ownable_init(initialOwner);


        totalShares = _totalShares;
        _mint(initialOwner, _totalShares * 10 ** decimals());
    }

    function claimDividend(uint256 epoch) external {
        // Dividend claim logic placeholder
    }

    function distributeDividend() external onlyOwner {
        // Dividend distribution logic placeholder
        currentEpoch++;
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyOwner
        override
    {}
}
