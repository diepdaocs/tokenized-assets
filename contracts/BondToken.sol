// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "./AssetBase.sol";

contract BondToken is ERC20Upgradeable, AssetBase {
    uint256 public couponRate; // Basis points (e.g., 500 = 5%)
    uint256 public maturityDate;
    uint256 public lastCouponPayment;
    uint256 public couponFrequency; // e.g., 180 days

    event CouponPaid(uint256 amount);
    event BondRedeemed(address indexed holder, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        uint256 _couponRate,
        uint256 _maturityDate,
        uint256 _couponFrequency,
        address admin
    ) public initializer {
        __ERC20_init(name, symbol);
        __AssetBase_init();

        _mint(admin, initialSupply);
        couponRate = _couponRate;
        maturityDate = _maturityDate;
        couponFrequency = _couponFrequency;
        lastCouponPayment = block.timestamp;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
    }

    function _update(address from, address to, uint256 value) internal override(ERC20Upgradeable) whenNotPaused {
        if (from != address(0) && to != address(0)) {
            require(whitelist[from], "BondToken: sender not whitelisted");
            require(whitelist[to], "BondToken: receiver not whitelisted");
        }
        super._update(from, to, value);
    }

    function distributeCoupon() external onlyRole(ISSUER_ROLE) {
        require(block.timestamp >= lastCouponPayment + couponFrequency, "BondToken: too early for next coupon");
        lastCouponPayment = block.timestamp;
        // In a real scenario, this would distribute payments (e.g., stablecoins).
        emit CouponPaid(couponRate);
    }

    function redeem() external {
        require(block.timestamp >= maturityDate, "BondToken: bond not yet matured");
        uint256 amount = balanceOf(msg.sender);
        require(amount > 0, "BondToken: no balance to redeem");
        _burn(msg.sender, amount);
        // Redemption logic for returning principal...
        emit BondRedeemed(msg.sender, amount);
    }
}
