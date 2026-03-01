// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./DerivativeBase.sol";
import "../libraries/AssetTypes.sol";

contract FuturesContract is DerivativeBase {
    AssetTypes.FuturesTerms public futuresTerms;
    uint256 public settlementPrice;

    event PositionLiquidated(
        uint256 indexed positionId,
        address indexed liquidator,
        uint256 margin
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory /* name_ */,
        string memory /* symbol_ */,
        address registry,
        address oracle,
        address issuer_,
        AssetTypes.FuturesTerms memory terms
    ) public initializer {
        __DerivativeBase_init(registry, oracle, issuer_);

        if (terms.settlementDate <= block.timestamp)
            revert AssetTypes.InvalidParameter("settlementDate");
        if (terms.contractSize == 0)
            revert AssetTypes.InvalidParameter("contractSize");
        if (terms.initialMarginBps == 0)
            revert AssetTypes.InvalidParameter("initialMarginBps");
        if (terms.maintenanceMarginBps == 0)
            revert AssetTypes.InvalidParameter("maintenanceMarginBps");

        futuresTerms = terms;
    }

    function openPosition(
        bool isLong,
        uint256 numContracts
    )
        external
        payable
        nonReentrant
        whenNotPaused
        onlyActive
        onlyCompliant(msg.sender)
    {
        if (numContracts == 0)
            revert AssetTypes.InvalidParameter("numContracts");

        (int256 currentPrice, , ) = priceOracle.getLatestPrice(
            futuresTerms.priceId
        );
        uint256 price = uint256(currentPrice);
        uint256 notionalValue = price *
            numContracts *
            futuresTerms.contractSize;
        uint256 requiredMargin = (notionalValue *
            futuresTerms.initialMarginBps) / 10000;

        if (msg.value < requiredMargin) revert AssetTypes.InsufficientMargin();

        _openPosition(msg.sender, isLong, numContracts, msg.value, price);
    }

    function settle() external nonReentrant onlyRole(OPERATOR_ROLE) {
        if (block.timestamp < futuresTerms.settlementDate)
            revert AssetTypes.ContractNotExpired();
        if (state != AssetTypes.DerivativeState.ACTIVE)
            revert AssetTypes.AlreadySettled();

        (int256 finalPrice, , ) = priceOracle.getLatestPrice(
            futuresTerms.priceId
        );
        settlementPrice = uint256(finalPrice);
        state = AssetTypes.DerivativeState.SETTLED;

        emit ContractSettled(settlementPrice);
    }

    function closePosition(
        uint256 positionId
    ) external nonReentrant {
        Position storage pos = positions[positionId];
        if (!pos.active) revert AssetTypes.InvalidParameter("not active");
        if (pos.holder != msg.sender && state != AssetTypes.DerivativeState.SETTLED)
            revert AssetTypes.Unauthorized();

        uint256 currentPrice;
        if (state == AssetTypes.DerivativeState.SETTLED) {
            currentPrice = settlementPrice;
        } else {
            (int256 price, , ) = priceOracle.getLatestPrice(
                futuresTerms.priceId
            );
            currentPrice = uint256(price);
        }

        uint256 payout = _calculatePayout(pos, currentPrice);
        _closePosition(positionId, payout);
    }

    function liquidatePosition(
        uint256 positionId
    ) external nonReentrant onlyActive {
        Position storage pos = positions[positionId];
        if (!pos.active) revert AssetTypes.InvalidParameter("not active");

        (int256 currentPrice, , ) = priceOracle.getLatestPrice(
            futuresTerms.priceId
        );

        uint256 notionalValue = uint256(currentPrice) *
            pos.size *
            futuresTerms.contractSize;
        uint256 maintenanceMargin = (notionalValue *
            futuresTerms.maintenanceMarginBps) / 10000;

        int256 pnl = _calculatePnL(pos, uint256(currentPrice));
        uint256 effectiveMargin = pnl >= 0
            ? pos.margin + uint256(pnl)
            : pos.margin - uint256(-pnl);

        if (effectiveMargin >= maintenanceMargin)
            revert AssetTypes.InvalidParameter("above maintenance margin");

        // Liquidated: margin goes to liquidator as reward
        uint256 reward = pos.margin / 10; // 10% reward
        uint256 remaining = pos.margin - reward;

        pos.active = false;
        if (pos.isLong) {
            totalLongSize -= pos.size;
        } else {
            totalShortSize -= pos.size;
        }

        (bool sent1, ) = payable(msg.sender).call{value: reward}("");
        if (!sent1) revert AssetTypes.InsufficientFunds();

        // Remaining stays in contract for other settlements
        emit PositionLiquidated(positionId, msg.sender, remaining);
        emit PositionClosed(positionId, pos.holder, 0);
    }

    function getPositionValue(
        uint256 positionId
    ) external view returns (int256) {
        Position storage pos = positions[positionId];
        if (!pos.active) return 0;

        (int256 currentPrice, , ) = priceOracle.getLatestPrice(
            futuresTerms.priceId
        );
        return _calculatePnL(pos, uint256(currentPrice));
    }

    function _calculatePnL(
        Position storage pos,
        uint256 currentPrice
    ) internal view returns (int256) {
        int256 priceDiff = int256(currentPrice) - int256(pos.entryPrice);
        int256 pnl = priceDiff *
            int256(pos.size) *
            int256(futuresTerms.contractSize);

        return pos.isLong ? pnl : -pnl;
    }

    function _calculatePayout(
        Position storage pos,
        uint256 currentPrice
    ) internal view returns (uint256) {
        int256 pnl = _calculatePnL(pos, currentPrice);
        int256 total = int256(pos.margin) + pnl;

        if (total <= 0) return 0;
        uint256 payout = uint256(total);
        return payout > address(this).balance ? address(this).balance : payout;
    }

    function isExpired() external view returns (bool) {
        return block.timestamp >= futuresTerms.settlementDate;
    }
}
