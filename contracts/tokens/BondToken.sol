// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../core/BaseAssetToken.sol";
import "../libraries/AssetTypes.sol";

contract BondToken is BaseAssetToken {
    AssetTypes.BondTerms public bondTerms;

    mapping(address => uint256) public lastCouponClaimed;
    uint256 public totalCouponsPaid;
    bool public matured;

    event CouponClaimed(address indexed holder, uint256 amount);
    event BondRedeemed(address indexed holder, uint256 amount);
    event BondMatured(uint256 maturityDate);
    event CouponsFunded(uint256 amount);
    event RedemptionFunded(uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        address registry,
        address oracle,
        address issuer_,
        AssetTypes.BondTerms memory terms
    ) public initializer {
        __BaseAssetToken_init(
            name_,
            symbol_,
            registry,
            oracle,
            AssetTypes.AssetCategory.BOND,
            issuer_
        );

        if (terms.maturityDate <= block.timestamp)
            revert AssetTypes.InvalidParameter("maturityDate");
        if (terms.faceValue == 0)
            revert AssetTypes.InvalidParameter("faceValue");
        if (terms.couponInterval == 0)
            revert AssetTypes.InvalidParameter("couponInterval");

        bondTerms = terms;
        if (terms.issueDate == 0) {
            bondTerms.issueDate = block.timestamp;
        }
    }

    function fundCoupons() external payable onlyRole(ISSUER_ROLE) {
        if (msg.value == 0) revert AssetTypes.InvalidParameter("amount");
        emit CouponsFunded(msg.value);
    }

    function fundRedemption() external payable onlyRole(ISSUER_ROLE) {
        if (msg.value == 0) revert AssetTypes.InvalidParameter("amount");
        emit RedemptionFunded(msg.value);
    }

    function claimCoupon() external nonReentrant {
        uint256 coupon = accruedCoupon(msg.sender);
        if (coupon == 0)
            revert AssetTypes.InvalidParameter("no coupon accrued");
        if (address(this).balance < coupon)
            revert AssetTypes.InsufficientFunds();

        lastCouponClaimed[msg.sender] = block.timestamp;
        totalCouponsPaid += coupon;

        (bool sent, ) = payable(msg.sender).call{value: coupon}("");
        if (!sent) revert AssetTypes.InsufficientFunds();

        emit CouponClaimed(msg.sender, coupon);
    }

    function redeem() external nonReentrant {
        if (block.timestamp < bondTerms.maturityDate)
            revert AssetTypes.ContractNotExpired();

        if (!matured) {
            matured = true;
            emit BondMatured(bondTerms.maturityDate);
        }

        uint256 balance = balanceOf(msg.sender);
        if (balance == 0)
            revert AssetTypes.InvalidParameter("no bonds to redeem");

        // Proportional face value: (holderBalance / totalSupply) * faceValue
        uint256 redemptionAmount = (bondTerms.faceValue * balance) /
            totalSupply();

        if (address(this).balance < redemptionAmount)
            revert AssetTypes.InsufficientFunds();

        _burn(msg.sender, balance);

        (bool sent, ) = payable(msg.sender).call{value: redemptionAmount}(
            ""
        );
        if (!sent) revert AssetTypes.InsufficientFunds();

        emit BondRedeemed(msg.sender, redemptionAmount);
    }

    function accruedCoupon(address holder) public view returns (uint256) {
        uint256 balance = balanceOf(holder);
        if (balance == 0) return 0;

        uint256 lastClaim = lastCouponClaimed[holder];
        if (lastClaim == 0) lastClaim = bondTerms.issueDate;

        uint256 endTime = block.timestamp < bondTerms.maturityDate
            ? block.timestamp
            : bondTerms.maturityDate;

        if (endTime <= lastClaim) return 0;

        uint256 periodsOwed = (endTime - lastClaim) /
            bondTerms.couponInterval;
        if (periodsOwed == 0) return 0;

        // coupon per period = faceValue * couponRate / 10000
        uint256 couponPerPeriod = (bondTerms.faceValue *
            bondTerms.couponRateBps) / 10000;
        uint256 holderShare = (couponPerPeriod * balance) / totalSupply();

        return holderShare * periodsOwed;
    }

    function timeToMaturity() external view returns (uint256) {
        if (block.timestamp >= bondTerms.maturityDate) return 0;
        return bondTerms.maturityDate - block.timestamp;
    }

    function couponPeriodsElapsed() external view returns (uint256) {
        return
            (block.timestamp - bondTerms.issueDate) /
            bondTerms.couponInterval;
    }

    function isMatured() external view returns (bool) {
        return block.timestamp >= bondTerms.maturityDate;
    }
}
