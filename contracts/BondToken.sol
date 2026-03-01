// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract BondToken is Initializable, ERC20Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 public faceValue;
    uint256 public couponRate; // in basis points
    uint256 public maturityDate;
    uint256 public couponFrequency; // seconds between payments

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol,
        uint256 _faceValue,
        uint256 _couponRate,
        uint256 _maturityDate,
        uint256 _couponFrequency,
        address initialOwner
    ) initializer public {
        __ERC20_init(name, symbol);
        __Ownable_init(initialOwner);


        faceValue = _faceValue;
        couponRate = _couponRate;
        maturityDate = _maturityDate;
        couponFrequency = _couponFrequency;
    }

    function payCoupon() external {
        // Coupon payment logic placeholder
    }

    function redeem() external {
        // Redemption logic placeholder
        require(block.timestamp >= maturityDate, "Bond has not matured");
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyOwner
        override
    {}
}
